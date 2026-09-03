const EmpresaImagesService = require('./empresaImages.service');
const {
  ALLOWED_TYPES,
  isValidImageToken,
  getImageFilePath,
  getImageDirectory
} = require('../../config/imageStorage');
const path = require('path');
const { Readable } = require('stream');
const fs = require('fs').promises;
const { createReadStream } = require('fs');

class EmpresaImagesController {
  /**
   * Helper para validar autorización de empresa
   * Evita confiar en Referer/Origin y verifica el contexto de autenticación/sesión
   */
  checkAuthorization(request, empresaId) {
    const targetEmpresaId = parseInt(empresaId, 10);
    
    // Si existe sesión o usuario autenticado, validar que coincida
    const sessionEmpresaId = request.session?.empresaId || request.user?.empresaId;
    if (sessionEmpresaId !== undefined && sessionEmpresaId !== null) {
      if (parseInt(sessionEmpresaId, 10) !== targetEmpresaId) {
        return false;
      }
    }

    // Si se envía una cabecera de contexto de empresa protegida (por ejemplo en gateways internos)
    const headerEmpresaId = request.headers['x-auth-empresa-id'];
    if (headerEmpresaId && parseInt(headerEmpresaId, 10) !== targetEmpresaId) {
      return false;
    }

    return true;
  }

  /**
   * Endpoint protegido /media/:empresaId/:imageToken/:type
   * Emite la cabecera X-Accel-Redirect para que Nginx sirva los bytes directamente desde disco en producción.
   * Soporta posters WebP, streaming de video con HTTP Range Requests (206 Partial Content) y fallback directo.
   */
  async serveMedia(request, reply) {
    const { empresaId, imageToken, type } = request.params;

    // 1. Validar empresaId (entero positivo)
    if (!/^\d+$/.test(empresaId) || parseInt(empresaId, 10) <= 0) {
      return reply.status(400).send({
        success: false,
        error: 'Identificador de empresa inválido'
      });
    }

    // 2. Validar imageToken con regex estricto (previene path traversal y nombres arbitrarios)
    if (!isValidImageToken(imageToken)) {
      return reply.status(400).send({
        success: false,
        error: 'Formato de imageToken inválido o no permitido'
      });
    }

    // 3. Validar tipo permitido (thumb, preview, poster, original)
    const typeConfig = ALLOWED_TYPES[type];
    if (!typeConfig) {
      return reply.status(400).send({
        success: false,
        error: `Tipo '${type}' no permitido. Valores válidos: thumb, preview, poster, original`
      });
    }

    // 4. Verificación de Path Traversal adicional (defensa en profundidad)
    const rawUrl = request.raw?.url || '';
    if (rawUrl.includes('..') || rawUrl.includes('%2e') || rawUrl.includes('%2E')) {
      return reply.status(400).send({
        success: false,
        error: 'Intento de navegación de directorio detectado'
      });
    }

    // 5. Autorización de acceso
    if (!this.checkAuthorization(request, empresaId)) {
      return reply.status(403).send({
        success: false,
        error: 'Acceso denegado a los recursos de esta empresa'
      });
    }

    // 6. Determinar archivo físico y Content-Type
    const dir = getImageDirectory(empresaId, imageToken);
    let targetFileName = typeConfig.fileName;
    let contentType = typeConfig.contentType;
    let isVideo = false;

    if (type === 'original') {
      // Buscar archivos de video u otros formatos compatibles en disco
      const videoCandidates = ['original.mp4', 'original.webm', 'original.mov', 'original.jpg', 'original.png', 'original.webp'];
      for (const candidate of videoCandidates) {
        try {
          await fs.access(path.join(dir, candidate));
          targetFileName = candidate;
          if (candidate.endsWith('.mp4')) {
            contentType = 'video/mp4';
            isVideo = true;
          } else if (candidate.endsWith('.webm')) {
            contentType = 'video/webm';
            isVideo = true;
          } else if (candidate.endsWith('.mov')) {
            contentType = 'video/quicktime';
            isVideo = true;
          } else if (candidate.endsWith('.png')) {
            contentType = 'image/png';
          } else if (candidate.endsWith('.webp')) {
            contentType = 'image/webp';
          } else {
            contentType = 'image/jpeg';
          }
          break;
        } catch {
          // Continuar buscando
        }
      }
    } else if (type === 'thumb') {
      // Si thumb.webp no existe pero existe poster.webp, usar poster.webp
      try {
        await fs.access(path.join(dir, 'thumb.webp'));
      } catch {
        try {
          await fs.access(path.join(dir, 'poster.webp'));
          targetFileName = 'poster.webp';
        } catch {
          // Mantener targetFileName por defecto
        }
      }
    }

    // 7. Construir ruta interna de Nginx y cabeceras
    const internalPath = `/protected/empresa-${empresaId}/${imageToken}/${targetFileName}`;

    reply.header('X-Accel-Redirect', internalPath);
    reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Accept-Ranges', 'bytes');

    // 8. En desarrollo o acceso directo sin Nginx, servimos el archivo desde disco con Range Requests
    const filePath = path.join(dir, targetFileName);
    try {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = request.headers.range;

      // Soporte para HTTP Range Requests (206 Partial Content) para videos
      if (range && isVideo) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          reply.header('Content-Range', `bytes */${fileSize}`);
          return reply.status(416).send('Requested range not satisfiable');
        }

        const chunksize = end - start + 1;
        const fileStream = createReadStream(filePath, { start, end });

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunksize);
        return reply.send(fileStream);
      }

      const fileStream = createReadStream(filePath);
      return reply.status(200).send(fileStream);
    } catch {
      // En producción, Nginx se encarga de servir el archivo desde el alias protegido
    }

    return reply.status(200).send('');
  }

  /**
   * Endpoint GET /api/empresas/:empresaId/imagenes
   * Obtiene la lista actualizada de imágenes en UNA sola consulta SQL sin N+1.
   * Aplica cabeceras para evitar caché desactualizada de la metadata.
   */
  async getGallery(request, reply) {
    try {
      const { empresaId } = request.params;
      const { limit, offset } = request.query;

      if (!/^\d+$/.test(empresaId) || parseInt(empresaId, 10) <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Identificador de empresa inválido'
        });
      }

      if (!this.checkAuthorization(request, empresaId)) {
        return reply.status(403).send({
          success: false,
          error: 'Acceso denegado a los recursos de esta empresa'
        });
      }

      const gallery = await EmpresaImagesService.getGallery(parseInt(empresaId, 10), {
        limit: parseInt(limit, 10) || 500,
        offset: parseInt(offset, 10) || 0
      });

      // Headers para garantizar que la lista de la galería siempre esté fresca
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');

      return reply.status(200).send(gallery);

    } catch (error) {
      console.error('❌ Error en getGallery:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Error al obtener imágenes de la galería'
      });
    }
  }

  /**
   * Endpoint POST /api/empresas/:empresaId/imagenes
   * Procesa la subida de archivos multipart, genera variantes WebP y guarda metadata
   */
  async uploadImages(request, reply) {
    try {
      const { empresaId } = request.params;

      if (!/^\d+$/.test(empresaId) || parseInt(empresaId, 10) <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Identificador de empresa inválido'
        });
      }

      if (!this.checkAuthorization(request, empresaId)) {
        return reply.status(403).send({
          success: false,
          error: 'Acceso denegado a los recursos de esta empresa'
        });
      }

      const files = [];

      // Procesar partes multipart de forma segura acumulando chunks del stream
      if (typeof request.files === 'function') {
        const parts = request.files();
        for await (const part of parts) {
          if (part && part.file) {
            const chunks = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            files.push({
              filename: part.filename,
              mimetype: part.mimetype,
              buffer: buffer,
              data: buffer,
              size: buffer.length
            });
          }
        }
      } else if (typeof request.parts === 'function') {
        for await (const part of request.parts()) {
          if (part.type === 'file' && part.file) {
            const chunks = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            files.push({
              filename: part.filename,
              mimetype: part.mimetype,
              buffer: buffer,
              data: buffer,
              size: buffer.length
            });
          }
        }
      }

      if (files.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No se enviaron archivos multimedia'
        });
      }

      const result = await EmpresaImagesService.uploadImages(parseInt(empresaId, 10), files, {
        quality: 82
      });

      return reply.status(201).send(result);

    } catch (error) {
      console.error('❌ Error en uploadImages:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Error al subir imágenes'
      });
    }
  }

  /**
   * Endpoint DELETE /api/empresas/:empresaId/imagenes/:tokenOrId
   * Elimina el registro de MySQL y los archivos físicos en disco
   */
  async deleteImage(request, reply) {
    try {
      const { empresaId, tokenOrId } = request.params;

      if (!/^\d+$/.test(empresaId) || parseInt(empresaId, 10) <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Identificador de empresa inválido'
        });
      }

      if (!this.checkAuthorization(request, empresaId)) {
        return reply.status(403).send({
          success: false,
          error: 'Acceso denegado a los recursos de esta empresa'
        });
      }

      const result = await EmpresaImagesService.deleteImage(parseInt(empresaId, 10), tokenOrId);
      
      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.status(200).send(result);

    } catch (error) {
      console.error('❌ Error en deleteImage:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Error al eliminar la imagen'
      });
    }
  }

  /**
   * Endpoint PUT /api/empresas/:empresaId/imagenes/:tokenOrId/order
   * Actualiza el orden de visualización de una imagen
   */
  async updateOrder(request, reply) {
    try {
      const { empresaId, tokenOrId } = request.params;
      const { orden } = request.body || {};

      if (typeof orden !== 'number' || orden < 0) {
        return reply.status(400).send({
          success: false,
          error: 'El campo orden debe ser un número entero positivo'
        });
      }

      const result = await EmpresaImagesService.updateOrder(
        parseInt(empresaId, 10),
        tokenOrId,
        orden
      );

      return reply.status(200).send({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('❌ Error en updateOrder:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Error al actualizar orden'
      });
    }
  }
}

module.exports = new EmpresaImagesController();
