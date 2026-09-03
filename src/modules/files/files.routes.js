const FileController = require('./files.controller');

async function fileRoutes(fastify, options) {
  // Configurar multipart para uploads (soporte para videos hasta 50MB)
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50MB
      files: 20,
      fields: 10
    },
    attachFieldsToBody: false,
    throwFileSizeLimit: true
  });

  // Rutas del módulo de archivos
  fastify.post('/events/:eventId/images', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    },
    handler: FileController.uploadImages.bind(FileController)
  });

  fastify.get('/events/:eventId/gallery', {
    handler: FileController.getGallery.bind(FileController)
  });

  fastify.get('/galleries', {
    handler: FileController.getAllGalleries.bind(FileController)
  });

  fastify.delete('/images/:imageId', {
    handler: FileController.deleteImage.bind(FileController)
  });

  // Eliminar múltiples archivos por ID
  fastify.post('/files/delete', {
    handler: FileController.deleteFiles.bind(FileController)
  });

  fastify.delete('/files/delete', {
    handler: FileController.deleteFiles.bind(FileController)
  });

  fastify.put('/images/:imageId/order', {
    handler: FileController.updateOrder.bind(FileController)
  });

  // Actualizar orden en bloque de la galería
  fastify.put('/events/:eventId/gallery/order', {
    handler: FileController.updateGalleryOrder.bind(FileController)
  });

  fastify.post('/events/:eventId/gallery/order', {
    handler: FileController.updateGalleryOrder.bind(FileController)
  });

  // Rotar imagen a la derecha o izquierda
  fastify.post('/images/:imageId/rotate', {
    handler: FileController.rotateImage.bind(FileController)
  });

  fastify.put('/images/:imageId/rotate', {
    handler: FileController.rotateImage.bind(FileController)
  });

  fastify.post('/files/rotate', {
    handler: FileController.rotateImage.bind(FileController)
  });

  fastify.get('/stats/images', {
    handler: FileController.getStats.bind(FileController)
  });

  fastify.get('/events/files', {
    handler: FileController.getFileEvents.bind(FileController)
  });
}

module.exports = fileRoutes;