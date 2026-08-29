const { GalleryImage, Event } = require('../../models');
const { fileEvents, EVENTS } = require('./files.events');
const imageProcessor = require('../../utils/imageProcessor');
const cache = require('../../utils/cache');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');
const { Op } = require('sequelize');
const { uploadRoot, publicPrefix } = require('../../config/uploads');


class FileService {
  constructor() {
    this.uploadLimit = pLimit(require('os').cpus().length * 2);
    this.thumbQueue = pLimit(4);
  }

  /**
   * Subir imágenes a un evento
   */
  async uploadImages(eventId, files, options = {}) {
    try {
      // Verificar que existe el evento
      const event = await Event.findByPk(eventId);
      if (!event) {
        throw new Error('Evento no encontrado');
      }

      const uploadedImages = [];
      const errors = [];

      // Procesar cada archivo
      const uploadPromises = files.map(async (file) => {
        try {
          const image = await this.processSingleImage(eventId, file, options);
          uploadedImages.push(image);
          
          // Emitir evento por imagen subida
          fileEvents.emit(EVENTS.IMAGE_UPLOADED, {
            eventId,
            image,
            timestamp: new Date()
          });

          return image;
        } catch (error) {
          errors.push({
            filename: file.filename,
            error: error.message
          });
          fileEvents.emit(EVENTS.UPLOAD_ERROR, {
            eventId,
            filename: file.filename,
            error: error.message
          });
        }
      });

      await Promise.all(uploadPromises);

      // Invalidar caché
      cache.del(`gallery:${eventId}`);
      cache.del('gallery:all');

      // Emitir evento de completado
      if (uploadedImages.length > 0) {
        fileEvents.emit(EVENTS.BULK_UPLOAD_COMPLETED, {
          eventId,
          total: uploadedImages.length,
          images: uploadedImages
        });
      }

      return {
        success: true,
        uploaded: uploadedImages,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Error en uploadImages:', error);
      throw error;
    }
  }

  /**
   * Procesar una imagen individual
   */
  async processSingleImage(eventId, file, options = {}) {
    const id = uuidv4();
    const extension = path.extname(file.filename).toLowerCase().substring(1);
    const nombre = `${id}.webp`;
    const nombreOriginal = file.filename;

    // Crear directorios si no existen
    await this.ensureDirectories();

    const rawRelativePath = path.join('raw', nombre);
    const thumbRelativePath = path.join('thumbs', `thumb_${nombre}`);
    const rawPath = path.join(uploadRoot, rawRelativePath);
    const thumbPath = path.join(uploadRoot, thumbRelativePath);

    // Procesar imagen principal
    const metadata = await this.uploadLimit(async () => {
      return await imageProcessor.processImage(file.file, {
        outputPath: rawPath,
        quality: options.quality || parseInt(process.env.IMAGE_QUALITY) || 82,
        maxWidth: options.maxWidth || parseInt(process.env.RAW_SIZE) || 2000,
        maxHeight: options.maxHeight || parseInt(process.env.RAW_SIZE) || 2000,
        format: 'webp'
      });
    });
    const processedFile = await fs.stat(rawPath);

    await this.thumbQueue(() => imageProcessor.generateThumbnail(rawPath, thumbPath, {
      width: options.thumbSize || parseInt(process.env.THUMB_SIZE) || 300,
      height: options.thumbSize || parseInt(process.env.THUMB_SIZE) || 300,
      quality: 75,
      format: 'webp'
    }));

    fileEvents.emit(EVENTS.THUMBNAIL_GENERATED, {
      imageId: id,
      path: thumbPath
    });

    // Guardar en base de datos
    const imageData = {
      id,
      event_id: eventId,
      nombre,
      nombre_original: nombreOriginal,
      ruta_raw: path.posix.join('uploads', rawRelativePath.split(path.sep).join('/')),
      ruta_thumb: path.posix.join('uploads', thumbRelativePath.split(path.sep).join('/')),
      extension: 'webp', // Siempre convertimos a WebP
      size: processedFile.size,
      width: metadata.width,
      height: metadata.height,
      estado: 'activo',
      orden: options.orden || 0,
      metadata: {
        original_extension: extension,
        original_size: file.size,
        processed_at: new Date().toISOString()
      }
    };

    const image = await GalleryImage.create(imageData);
    
    // Emitir evento de procesado
    fileEvents.emit(EVENTS.IMAGE_PROCESSED, {
      image,
      rawPath,
      thumbPath
    });

    return image.toJSON();
  }

  /**
   * Obtener galería de un evento
   */
  async getGallery(eventId, options = {}) {
    const cacheKey = `gallery:${eventId}`;
    
    // Intentar obtener de caché
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Query optimizada
    const where = { 
      event_id: eventId,
      estado: 'activo'
    };

    const images = await GalleryImage.findAll({
      where,
      attributes: [
        'id', 'nombre', 'nombre_original', 'ruta_raw', 
        'ruta_thumb', 'extension', 'width', 'height',
        'size', 'orden', 'fecha_subida', 'metadata'
      ],
      order: [['orden', 'ASC'], ['fecha_subida', 'DESC']],
      limit: options.limit || 100,
      offset: options.offset || 0
    });

    // Formatear respuesta con URLs completas
    const result = images.map(img => ({
      id: img.id,
      nombre: img.nombre,
      nombreOriginal: img.nombre_original,
      urlRaw: `${publicPrefix}${img.ruta_raw.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}`,
      urlThumb: `${publicPrefix}${img.ruta_thumb.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}`,
      width: img.width,
      height: img.height,
      size: img.size,
      orden: img.orden,
      fecha: img.fecha_subida,
      metadata: img.metadata
    }));

    // Guardar en caché
    cache.set(cacheKey, result);

    return result;
  }

  /**
   * Obtener todas las galerías (eventos con imágenes)
   */
async getAllGalleries(options = {}) {
    const cacheKey = 'gallery:all';
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Obtener eventos con conteo de imágenes en una sola consulta
    const events = await Event.findAll({
      where: { estado: 'activo' },
      attributes: [
        'id', 
        'nombre', 
        'fecha', 
        'estado',
        // Subconsulta para contar imágenes
        [sequelize.literal(`(
          SELECT COUNT(*) 
          FROM gallery_images 
          WHERE gallery_images.event_id = Event.id 
          AND gallery_images.estado = 'activo'
        )`), 'imageCount']
      ],
      include: [{
        model: GalleryImage,
        as: 'images',
        where: { estado: 'activo' },
        attributes: [
          'id', 'nombre', 'ruta_raw', 'ruta_thumb', 
          'width', 'height', 'size'
        ],
        limit: 1,
        order: [['orden', 'ASC'], ['fecha_subida', 'ASC']],
        required: false,
        // No traer el conteo por separado
        separate: false
      }],
      order: [['fecha', 'DESC']],
      limit: options.limit || 50,
      // Agrupar para evitar duplicados
      group: ['Event.id', 'images.id']
    });

    // Mapear resultados (sin await porque ya tenemos los datos)
    const result = events.map(event => {
      // Obtener el conteo del literal
      const imageCount = parseInt(event.getDataValue('imageCount')) || 0;
      
      return {
        id: event.id,
        nombre: event.nombre,
        fecha: event.fecha,
        estado: event.estado,
        coverImage: event.images && event.images.length > 0 ? {
          id: event.images[0].id,
          urlThumb: `${publicPrefix}${event.images[0].ruta_thumb.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}`,
          urlRaw: `${publicPrefix}${event.images[0].ruta_raw.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}`
        } : null,
        imageCount
      };
    });

    cache.set(cacheKey, result);
    return result;
}

  /**
   * Eliminar imagen
   */
  async deleteImage(imageId) {
    const image = await GalleryImage.findByPk(imageId);
    if (!image) {
      throw new Error('Imagen no encontrada');
    }

    // Soft delete
    image.estado = 'eliminado';
    await image.save();

    // Emitir evento de eliminación
    fileEvents.emit(EVENTS.IMAGE_DELETED, {
      imageId,
      eventId: image.event_id,
      paths: [image.ruta_raw, image.ruta_thumb]
    });

    // Invalidar cachés
    cache.del(`gallery:${image.event_id}`);
    cache.del('gallery:all');

    return { success: true, message: 'Imagen eliminada correctamente' };
  }

  /**
   * Actualizar orden de imágenes
   */
  async updateOrder(imageId, newOrder) {
    const image = await GalleryImage.findByPk(imageId);
    if (!image) {
      throw new Error('Imagen no encontrada');
    }

    image.orden = newOrder;
    await image.save();

    // Emitir evento
    fileEvents.emit(EVENTS.IMAGE_UPDATED, {
      imageId,
      eventId: image.event_id,
      updates: { orden: newOrder }
    });

    // Invalidar caché
    cache.del(`gallery:${image.event_id}`);

    return image;
  }

  /**
   * Asegurar que existen los directorios
   */
  async ensureDirectories() {
    const dirs = ['raw', 'thumbs', 'temp'];
    for (const dir of dirs) {
      try {
        await fs.mkdir(path.join(uploadRoot, dir), { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.error(`Error creando directorio ${dir}:`, error);
        }
      }
    }
  }

  /**
   * Obtener estadísticas de imágenes
   */
  async getStats() {
    const total = await GalleryImage.count({ where: { estado: 'activo' } });
    const byEvent = await GalleryImage.findAll({
      attributes: [
        'event_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { estado: 'activo' },
      group: ['event_id']
    });

    return {
      total,
      byEvent: byEvent.map(item => ({
        eventId: item.event_id,
        count: parseInt(item.dataValues.count)
      }))
    };
  }
}

const { sequelize } = require('../../models');
module.exports = new FileService();