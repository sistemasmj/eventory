const FileService = require('./files.service');
const { fileEvents, EVENTS } = require('./files.events');
const { validateUpload } = require('../../utils/validators');
const { Readable } = require('stream');

class FileController {
  /**
   * Subir imágenes a un evento
   */
  async uploadImages(request, reply) {
    try {
      const { eventId } = request.params;
      const files = [];

      // Leer archivos multipart de forma segura acumulando chunks del stream
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
              encoding: part.encoding,
              file: Readable.from(buffer),
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
              encoding: part.encoding,
              file: Readable.from(buffer),
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
          message: 'No se enviaron archivos'
        });
      }

      // Validar archivos (imágenes hasta 20MB, videos hasta 50MB)
      const validation = validateUpload(files);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          errors: validation.errors
        });
      }

      const result = await FileService.uploadImages(eventId, files, {
        quality: 82,
        thumbSize: 300
      });

      return reply.status(200).send(result);

    } catch (error) {
      console.error('Error en uploadImages:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al subir archivos multimedia'
      });
    }
  }

  /**
   * Obtener galería de un evento
   */
  async getGallery(request, reply) {
    try {
      const { eventId } = request.params;
      const { limit, offset, categoria_id, categoria } = request.query;

      const gallery = await FileService.getGallery(eventId, {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        categoria_id: categoria_id || categoria
      });

      // La lista cambia después de cada subida; nunca reutilizar una respuesta antigua.
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
      reply.header('Vary', 'Accept-Encoding');

      return reply.status(200).send({
        success: true,
        data: gallery,
        total: gallery.length
      });

    } catch (error) {
      console.error('Error en getGallery:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener galería'
      });
    }
  }

  /**
   * Obtener todas las galerías
   */
  async getAllGalleries(request, reply) {
    try {
      const { limit } = request.query;

      const galleries = await FileService.getAllGalleries({
        limit: parseInt(limit) || 50
      });

      return reply.status(200).send({
        success: true,
        data: galleries
      });

    } catch (error) {
      console.error('Error en getAllGalleries:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener galerías'
      });
    }
  }

  /**
   * Eliminar múltiples archivos / imágenes por ID
   */
  async deleteFiles(request, reply) {
    try {
      const body = request.body || {};
      const ids = body.ids || body.imageIds || (Array.isArray(body) ? body : (body.id ? [body.id] : []));

      if (!ids || (Array.isArray(ids) && ids.length === 0)) {
        return reply.status(400).send({
          success: false,
          message: 'Debe proporcionar al menos un ID de imagen a eliminar'
        });
      }

      const result = await FileService.deleteFiles(ids);
      return reply.status(200).send(result);

    } catch (error) {
      console.error('Error en deleteFiles:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al eliminar archivos'
      });
    }
  }

  /**
   * Eliminar imagen
   */
  async deleteImage(request, reply) {
    try {
      const { imageId } = request.params;

      const result = await FileService.deleteImage(imageId);

      return reply.status(200).send(result);

    } catch (error) {
      console.error('Error en deleteImage:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al eliminar imagen'
      });
    }
  }

  /**
   * Actualizar orden de imagen
   */
  async updateOrder(request, reply) {
    try {
      const { imageId } = request.params;
      const { orden } = request.body;

      if (typeof orden !== 'number' || orden < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Orden debe ser un número positivo'
        });
      }

      const result = await FileService.updateOrder(imageId, orden);

      return reply.status(200).send({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error en updateOrder:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al actualizar orden'
      });
    }
  }

  /**
   * Obtener estadísticas
   */
  async getStats(request, reply) {
    try {
      const stats = await FileService.getStats();
      return reply.status(200).send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getStats:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      });
    }
  }

  /**
   * Rotar imagen (girar a la derecha o izquierda)
   */
  async rotateImage(request, reply) {
    try {
      const imageId = request.params.imageId || request.body?.imageId || request.body?.id;
      const { direction, degrees, tipo } = request.body || {};

      if (!imageId) {
        return reply.status(400).send({
          success: false,
          message: 'El identificador de la imagen es requerido'
        });
      }

      const targetDirection = direction || tipo || (degrees < 0 ? 'left' : 'right');

      const result = await FileService.rotateImage(imageId, {
        direction: targetDirection,
        degrees
      });

      return reply.status(200).send(result);
    } catch (error) {
      console.error('Error en rotateImage:', error);
      const isNotFound = error.message === 'Imagen no encontrada';
      return reply.status(isNotFound ? 404 : 500).send({
        success: false,
        message: error.message || 'Error al rotar la imagen'
      });
    }
  }

  /**
   * Actualizar orden de la galería (bulk)
   */
  async updateGalleryOrder(request, reply) {
    try {
      const { eventId } = request.params;
      const { items } = request.body || {};

      if (!Array.isArray(items)) {
        return reply.status(400).send({
          success: false,
          message: 'Se requiere una lista de elementos (items)'
        });
      }

      const result = await FileService.updateGalleryOrder(eventId, items);
      return reply.status(200).send(result);
    } catch (error) {
      console.error('Error en updateGalleryOrder:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al actualizar el orden de la galería'
      });
    }
  }

  /**
   * Webhook para eventos de archivos
   */
  async getFileEvents(request, reply) {
    // Esto sería para SSE o WebSocket
    reply.status(200).send({
      message: 'Events endpoint - Conectar via WebSocket para eventos en tiempo real'
    });
  }
}

module.exports = new FileController();