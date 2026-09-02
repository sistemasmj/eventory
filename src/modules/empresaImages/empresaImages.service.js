const { Imagen } = require('../../models');
const imageProcessor = require('../../utils/imageProcessor');
const {
  generateImageToken,
  ensureImageDirectory,
  getImageDirectory,
  removeImageDirectory,
  getImageFilePath
} = require('../../config/imageStorage');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const pLimit = require('p-limit');
const { Op } = require('sequelize');

class EmpresaImagesService {
  constructor() {
    this.uploadLimit = pLimit(require('os').cpus().length * 2);
  }

  /**
   * Obtiene la galería completa de una empresa en UNA sola consulta SQL
   * Construye las URLs lógicas dinámicamente sin almacenarlas completas en base de datos.
   */
  async getGallery(empresaId, options = {}) {
    const where = {
      empresa_id: empresaId,
      estado: 1
    };

    // UNA sola consulta optimizada a MySQL sin N+1
    const images = await Imagen.findAll({
      where,
      attributes: ['id', 'image_token', 'orden', 'width', 'height', 'size', 'nombre_original', 'created_at'],
      order: [
        ['orden', 'ASC'],
        ['id', 'ASC']
      ],
      limit: options.limit || 500,
      offset: options.offset || 0,
      raw: true
    });

    const items = images.map(img => ({
      id: img.id,
      token: img.image_token,
      orden: img.orden,
      urls: {
        thumb: `/api/media/${empresaId}/${img.image_token}/thumb`,
        preview: `/api/media/${empresaId}/${img.image_token}/preview`,
        original: `/api/media/${empresaId}/${img.image_token}/original`
      }
    }));

    return {
      total: items.length,
      items
    };
  }

  /**
   * Procesa la subida de imágenes para una empresa
   * Genera tokens criptográficos, estructura de carpetas privada y variantes WebP
   */
  async uploadImages(empresaId, files, options = {}) {
    const uploaded = [];
    const errors = [];

    for (const file of files) {
      try {
        const imageResult = await this.uploadLimit(async () => {
          return await this.processSingleImage(empresaId, file, options);
        });
        uploaded.push(imageResult);
      } catch (error) {
        errors.push({
          filename: file.filename || 'desconocido',
          error: error.message
        });
      }
    }

    return {
      success: uploaded.length > 0,
      uploaded,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Procesa y almacena una imagen individual
   */
  async processSingleImage(empresaId, file, options = {}) {
    // 1. Generar token único y seguro (Date.now() + randomBytes)
    const token = generateImageToken();
    const originalName = file.filename || `image-${token}.jpg`;

    // 2. Crear directorio físico privado /data/storage/images/empresa-{id}/{token}/
    const imageDir = await ensureImageDirectory(empresaId, token);
    const originalPath = path.join(imageDir, 'original.jpg');
    const previewPath = path.join(imageDir, 'preview.webp');
    const thumbPath = path.join(imageDir, 'thumb.webp');

    // 3. Guardar archivo original
    let fileBuffer;
    if (Buffer.isBuffer(file.file || file.data)) {
      fileBuffer = file.file || file.data;
    } else if (file.file && typeof file.file.pipe === 'function') {
      const chunks = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    } else if (file.buffer) {
      fileBuffer = file.buffer;
    } else {
      throw new Error('Formato de archivo inválido o buffer no disponible');
    }

    await fs.writeFile(originalPath, fileBuffer);

    // 4. Procesar y optimizar con Sharp
    // 4.1 Preview WebP (máx 1600px, calidad 82)
    const previewMetadata = await sharp(fileBuffer)
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: options.quality || 82, effort: 4 })
      .toFile(previewPath);

    // 4.2 Thumbnail WebP (300x300 cover, calidad 75)
    await sharp(fileBuffer)
      .resize({
        width: 300,
        height: 300,
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 75 })
      .toFile(thumbPath);

    // 5. Guardar metadata en MySQL
    const imagen = await Imagen.create({
      empresa_id: empresaId,
      image_token: token,
      orden: options.orden || 0,
      estado: 1,
      nombre_original: originalName,
      mime_type: 'image/jpeg',
      size: fileBuffer.length,
      width: previewMetadata.width,
      height: previewMetadata.height,
      metadata: {
        preview_size: previewMetadata.size,
        uploaded_at: new Date().toISOString()
      }
    });

    return {
      id: imagen.id,
      token: imagen.image_token,
      orden: imagen.orden,
      urls: {
        thumb: `/api/media/${empresaId}/${imagen.image_token}/thumb`,
        preview: `/api/media/${empresaId}/${imagen.image_token}/preview`,
        original: `/api/media/${empresaId}/${imagen.image_token}/original`
      }
    };
  }

  /**
   * Elimina una imagen de MySQL y sus archivos físicos en disco
   */
  async deleteImage(empresaId, tokenOrId) {
    const isNumericId = /^\d+$/.test(String(tokenOrId));
    const where = {
      empresa_id: empresaId
    };

    if (isNumericId) {
      where.id = parseInt(tokenOrId, 10);
    } else {
      where.image_token = String(tokenOrId);
    }

    const imagen = await Imagen.findOne({ where });
    if (!imagen) {
      return {
        success: false,
        message: 'Imagen no encontrada'
      };
    }

    const token = imagen.image_token;

    // Eliminar de base de datos
    await imagen.destroy({ force: true });

    // Eliminar archivos físicos
    await removeImageDirectory(empresaId, token);

    return {
      success: true,
      message: 'Imagen eliminada correctamente de BD y disco',
      deletedToken: token
    };
  }

  /**
   * Actualiza el orden de visualización de una imagen
   */
  async updateOrder(empresaId, tokenOrId, newOrder) {
    const isNumericId = /^\d+$/.test(String(tokenOrId));
    const where = { empresa_id: empresaId };

    if (isNumericId) {
      where.id = parseInt(tokenOrId, 10);
    } else {
      where.image_token = String(tokenOrId);
    }

    const imagen = await Imagen.findOne({ where });
    if (!imagen) {
      throw new Error('Imagen no encontrada');
    }

    imagen.orden = newOrder;
    await imagen.save();

    return {
      id: imagen.id,
      token: imagen.image_token,
      orden: imagen.orden
    };
  }
}

module.exports = new EmpresaImagesService();
