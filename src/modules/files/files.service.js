const { GalleryImage, Event } = require('../../models');
const { fileEvents, EVENTS } = require('./files.events');
const imageProcessor = require('../../utils/imageProcessor');
const videoProcessor = require('../../utils/videoProcessor');
const cache = require('../../utils/cache');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const pLimit = require('p-limit');
const { Op } = require('sequelize');
const { uploadRoot, publicPrefix } = require('../../config/uploads');
const { isVideoMime, isVideoExt } = require('../../config/imageStorage');

class FileService {
  constructor() {
    this.uploadLimit = pLimit(require('os').cpus().length * 2);
    this.thumbQueue = pLimit(4);
  }

  /**
   * Subir imágenes y videos a un evento
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
          const isVideo = isVideoMime(file.mimetype) || isVideoExt(file.filename);
          let mediaItem;

          if (isVideo) {
            mediaItem = await this.processSingleVideo(eventId, file, options);
          } else {
            mediaItem = await this.processSingleImage(eventId, file, options);
          }

          uploadedImages.push(mediaItem);
          
          // Emitir evento por medio subido
          fileEvents.emit(EVENTS.IMAGE_UPLOADED, {
            eventId,
            image: mediaItem,
            timestamp: new Date()
          });

          return mediaItem;
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
      cache.delPattern(`gallery:${eventId}`);
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
   * Procesar un video individual para un evento
   */
  async processSingleVideo(eventId, file, options = {}) {
    const id = uuidv4();
    const ext = (path.extname(file.filename || '').replace(/^\./, '') || 'mp4').toLowerCase();
    const nombre = `${id}.${ext}`;
    const nombreOriginal = file.filename || `video-${id}.${ext}`;

    await this.ensureDirectories();

    const rawRelativePath = path.join('raw', nombre);
    const posterRelativePath = path.join('thumbs', `poster_${id}.webp`);
    const thumbRelativePath = path.join('thumbs', `thumb_${id}.webp`);
    const rawPath = path.join(uploadRoot, rawRelativePath);
    const posterPath = path.join(uploadRoot, posterRelativePath);
    const thumbPath = path.join(uploadRoot, thumbRelativePath);

    // Extraer buffer de video
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
    } else if (typeof file.toBuffer === 'function') {
      fileBuffer = await file.toBuffer();
    } else {
      throw new Error('Buffer de video no disponible');
    }

    // Validar límite estricto de 50MB (50 megas)
    if (fileBuffer.length > 52428800) {
      throw new Error(`El video "${nombreOriginal}" excede el límite máximo permitido de 50MB`);
    }

    await fs.writeFile(rawPath, fileBuffer);

    // Generar poster y thumb con fallback elegante
    const posterMeta = await videoProcessor.generatePoster(rawPath, posterPath, {
      title: nombreOriginal,
      width: 1280,
      quality: 82
    });

    try {
      await sharp(posterPath)
        .resize({ width: 300, height: 300, fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toFile(thumbPath);
    } catch {
      await fs.copyFile(posterPath, thumbPath).catch(() => {});
    }

    const videoMeta = await videoProcessor.getVideoMetadata(rawPath);

    // Guardar en base de datos
    const imageData = {
      id,
      event_id: eventId,
      nombre,
      nombre_original: nombreOriginal,
      tipo: 'video',
      duracion: videoMeta.duration || null,
      ruta_raw: path.posix.join('uploads', rawRelativePath.split(path.sep).join('/')),
      ruta_thumb: path.posix.join('uploads', thumbRelativePath.split(path.sep).join('/')),
      ruta_poster: path.posix.join('uploads', posterRelativePath.split(path.sep).join('/')),
      extension: ext,
      size: fileBuffer.length,
      width: videoMeta.width || posterMeta.width || 1920,
      height: videoMeta.height || posterMeta.height || 1080,
      estado: 'activo',
      categoria_id: options.categoria_id !== undefined ? (options.categoria_id ? parseInt(options.categoria_id, 10) : null) : 1,
      orden: options.orden !== undefined ? parseInt(options.orden, 10) : 0,
      metadata: {
        original_extension: ext,
        original_size: fileBuffer.length,
        poster_size: posterMeta.size,
        processed_at: new Date().toISOString()
      }
    };

    const image = await GalleryImage.create(imageData);
    return image.toJSON();
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
      tipo: 'image',
      duracion: null,
      ruta_raw: path.posix.join('uploads', rawRelativePath.split(path.sep).join('/')),
      ruta_thumb: path.posix.join('uploads', thumbRelativePath.split(path.sep).join('/')),
      extension: 'webp', // Siempre convertimos a WebP
      size: processedFile.size,
      width: metadata.width,
      height: metadata.height,
      estado: 'activo',
      categoria_id: options.categoria_id !== undefined ? (options.categoria_id ? parseInt(options.categoria_id, 10) : null) : 1,
      orden: options.orden !== undefined ? parseInt(options.orden, 10) : 0,
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
   * Obtener galería de un evento (opcionalmente filtrada por categoria_id)
   */
  async getGallery(eventId, options = {}) {
    const catId = options.categoria_id !== undefined 
      ? options.categoria_id 
      : (options.categoria !== undefined ? options.categoria : undefined);

    const cacheKey = catId !== undefined && catId !== null && catId !== ''
      ? `gallery:${eventId}:cat_${catId}`
      : `gallery:${eventId}`;
    
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

    if (catId !== undefined && catId !== null && catId !== '') {
      where.categoria_id = parseInt(catId, 10);
    }

    const images = await GalleryImage.findAll({
      where,
      attributes: [
        'id', 'nombre', 'nombre_original', 'tipo', 'duracion', 'ruta_raw', 
        'ruta_thumb', 'ruta_poster', 'extension', 'width', 'height',
        'size', 'orden', 'categoria_id', 'fecha_subida', 'metadata'
      ],
      order: [['orden', 'ASC'], ['fecha_subida', 'DESC']],
      limit: options.limit || 100,
      offset: options.offset || 0
    });

    // Formatear respuesta con URLs completas y objeto urls unificado (con versionado si fue rotada/modificada)
    const result = images.map(img => {
      const isVideo = img.tipo === 'video';
      const versionParam = img.metadata?.v ? `?v=${img.metadata.v}` : '';
      const rawUrl = `${publicPrefix}${img.ruta_raw.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}${versionParam}`;
      const thumbUrl = `${publicPrefix}${img.ruta_thumb.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}${versionParam}`;
      const posterUrl = img.ruta_poster
        ? `${publicPrefix}${img.ruta_poster.replace(/^uploads[\\/]/, '').replace(/\\/g, '/')}${versionParam}`
        : thumbUrl;

      return {
        id: img.id,
        nombre: img.nombre,
        nombreOriginal: img.nombre_original,
        type: img.tipo || 'image',
        duracion: img.duracion || null,
        urlRaw: rawUrl,
        urlThumb: isVideo ? posterUrl : thumbUrl,
        urlPoster: isVideo ? posterUrl : undefined,
        urls: {
          thumb: isVideo ? posterUrl : thumbUrl,
          poster: isVideo ? posterUrl : undefined,
          preview: rawUrl,
          original: rawUrl
        },
        width: img.width,
        height: img.height,
        size: img.size,
        orden: img.orden,
        categoria_id: img.categoria_id,
        categoriaId: img.categoria_id,
        fecha: img.fecha_subida,
        metadata: img.metadata
      };
    });

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
   * Eliminar múltiples imágenes por ID (registro en BD y archivos físicos)
   */
  async deleteFiles(imageIds) {
    if (!imageIds) {
      throw new Error('No se proporcionaron IDs de imágenes para eliminar');
    }

    const ids = Array.isArray(imageIds) ? imageIds.filter(Boolean) : [imageIds].filter(Boolean);

    if (ids.length === 0) {
      return {
        success: true,
        message: 'No se enviaron identificadores válidos',
        deletedCount: 0,
        deletedIds: []
      };
    }

    // Buscar todas las imágenes a eliminar
    const images = await GalleryImage.findAll({
      where: {
        id: {
          [Op.in]: ids
        }
      }
    });

    if (!images || images.length === 0) {
      return {
        success: true,
        message: 'No se encontraron archivos para eliminar',
        deletedCount: 0,
        deletedIds: []
      };
    }

    const eventIdsToInvalidate = new Set();
    const deletedIds = [];

    for (const image of images) {
      eventIdsToInvalidate.add(image.event_id);

      // Eliminar registro y archivos físicos mediante hook beforeDestroy
      await image.destroy({ force: true });
      deletedIds.push(image.id);

      // Emitir evento por imagen eliminada
      fileEvents.emit(EVENTS.IMAGE_DELETED, {
        imageId: image.id,
        eventId: image.event_id,
        paths: [image.ruta_raw, image.ruta_thumb]
      });
    }

    // Invalidar caché de los eventos afectados
    for (const eventId of eventIdsToInvalidate) {
      cache.delPattern(`gallery:${eventId}`);
    }
    cache.del('gallery:all');

    const count = deletedIds.length;
    const friendlyMessage = count === 1 
      ? 'Se eliminó 1 archivo satisfactoriamente'
      : `Se eliminaron ${count} archivos satisfactoriamente`;

    return {
      success: true,
      message: friendlyMessage,
      deletedCount: count,
      deletedIds
    };
  }

  /**
   * Eliminar imagen individual
   */
  async deleteImage(imageId) {
    return this.deleteFiles([imageId]);
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
   * Actualizar el orden de las imágenes de un evento (bulk)
   * @param {number|string} eventId
   * @param {Array<{ id: string, orden: number } | string>} items
   */
  async updateGalleryOrder(eventId, items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const updates = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const imageId = typeof item === 'string' ? item : (item && item.id);
      const order = typeof item === 'object' && item && item.orden !== undefined ? parseInt(item.orden, 10) : index + 1;

      if (imageId) {
        updates.push(
          GalleryImage.update(
            { orden: order },
            { where: { id: imageId, event_id: eventId } }
          )
        );
      }
    }

    await Promise.all(updates);

    // Invalidar cachés
    cache.delPattern(`gallery:${eventId}`);
    cache.del('gallery:all');

    return {
      success: true,
      message: 'Orden de galería actualizado correctamente',
      updatedCount: updates.length
    };
  }

  /**
   * Rotar una imagen física y actualizar sus metadatos
   * @param {string} imageId - ID o token de la imagen
   * @param {object} options - { direction: 'right' | 'left', degrees: 90 | -90 | 270 }
   */
  async rotateImage(imageId, options = {}) {
    const { direction = 'right', degrees } = options;

    let angle = 90;
    if (
      direction === 'left' ||
      direction === 'izquierda' ||
      degrees === -90 ||
      degrees === 270 ||
      degrees === '270' ||
      degrees === '-90'
    ) {
      angle = 270;
    } else if (degrees === 180 || degrees === '180') {
      angle = 180;
    } else {
      angle = 90;
    }

    // 1. Buscar en GalleryImage (Álbumes de eventos)
    let galleryImage = await GalleryImage.findByPk(imageId);
    if (!galleryImage) {
      galleryImage = await GalleryImage.findOne({
        where: {
          [Op.or]: [
            { id: imageId },
            { nombre: imageId }
          ]
        }
      });
    }

    if (galleryImage) {
      if (galleryImage.tipo === 'video') {
        throw new Error('No se puede rotar un archivo de video');
      }

      const rawRelativePath = galleryImage.ruta_raw.replace(/^uploads[\\/]/, '');
      const thumbRelativePath = galleryImage.ruta_thumb.replace(/^uploads[\\/]/, '');
      const rawFullPath = path.join(uploadRoot, rawRelativePath);
      const thumbFullPath = path.join(uploadRoot, thumbRelativePath);

      // Rotar archivo principal raw
      const rawBuffer = await fs.readFile(rawFullPath);
      const rotatedRawBuffer = await sharp(rawBuffer).rotate(angle).toBuffer();
      await fs.writeFile(rawFullPath, rotatedRawBuffer);
      const rawMeta = await sharp(rotatedRawBuffer).metadata();

      // Rotar / Regenerar thumbnail
      try {
        const rotatedThumbBuffer = await sharp(rotatedRawBuffer)
          .resize({ width: 300, height: 300, fit: 'cover', position: 'center' })
          .webp({ quality: 75 })
          .toBuffer();
        await fs.writeFile(thumbFullPath, rotatedThumbBuffer);
      } catch (thumbErr) {
        console.warn('Advertencia al regenerar miniatura tras rotar:', thumbErr.message);
      }

      // Actualizar registro en DB
      galleryImage.width = rawMeta.width || galleryImage.height;
      galleryImage.height = rawMeta.height || galleryImage.width;
      galleryImage.size = rotatedRawBuffer.length;
      const currentMeta = galleryImage.metadata || {};
      const currentRotation = currentMeta.rotation || 0;
      const newRotation = (currentRotation + (angle === 270 ? -90 : 90) + 360) % 360;
      const newVersion = Date.now();
      galleryImage.metadata = {
        ...currentMeta,
        rotation: newRotation,
        v: newVersion,
        rotated_at: new Date().toISOString()
      };
      galleryImage.changed('metadata', true);
      await galleryImage.save();

      // Invalidar caché
      cache.del(`gallery:${galleryImage.event_id}`);
      cache.del('gallery:all');

      // Emitir evento
      fileEvents.emit(EVENTS.IMAGE_UPDATED, {
        imageId: galleryImage.id,
        eventId: galleryImage.event_id,
        updates: { rotation: newRotation }
      });

      return {
        success: true,
        message: `Imagen girada ${angle === 90 ? 'a la derecha (+90°)' : 'a la izquierda (-90°)'} correctamente`,
        data: galleryImage.toJSON()
      };
    }

    // 2. Si no es GalleryImage, buscar en Imagen (Módulo Empresas)
    const { Imagen } = require('../../models');
    if (Imagen) {
      let empresaImg = await Imagen.findByPk(imageId);
      if (!empresaImg) {
        empresaImg = await Imagen.findOne({
          where: {
            [Op.or]: [
              { id: isNaN(imageId) ? 0 : parseInt(imageId, 10) },
              { image_token: imageId }
            ]
          }
        });
      }

      if (empresaImg) {
        const { getImageDirectory, getImageFilePath } = require('../../config/imageStorage');
        const token = empresaImg.image_token;
        const empresaId = empresaImg.empresa_id;

        const previewPath = getImageFilePath(empresaId, token, 'preview');
        const thumbPath = getImageFilePath(empresaId, token, 'thumb');
        const originalPath = getImageFilePath(empresaId, token, 'original', empresaImg.extension || 'jpg');

        if (previewPath) {
          try {
            const buf = await fs.readFile(previewPath);
            const rotated = await sharp(buf).rotate(angle).toBuffer();
            await fs.writeFile(previewPath, rotated);
          } catch {}
        }

        if (originalPath) {
          try {
            const buf = await fs.readFile(originalPath);
            const rotated = await sharp(buf).rotate(angle).toBuffer();
            await fs.writeFile(originalPath, rotated);
          } catch {}
        }

        if (thumbPath) {
          try {
            const buf = await fs.readFile(thumbPath);
            const rotated = await sharp(buf).rotate(angle).toBuffer();
            await fs.writeFile(thumbPath, rotated);
          } catch {}
        }

        return {
          success: true,
          message: `Imagen de empresa girada ${angle === 90 ? 'a la derecha (+90°)' : 'a la izquierda (-90°)'} correctamente`,
          data: empresaImg.toJSON ? empresaImg.toJSON() : empresaImg
        };
      }
    }

    throw new Error('Imagen no encontrada');
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