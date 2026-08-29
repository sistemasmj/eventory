const FileController = require('./files.controller');

async function fileRoutes(fastify, options) {
  // Configurar multipart para uploads
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
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
        max: 10,
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

  fastify.put('/images/:imageId/order', {
    handler: FileController.updateOrder.bind(FileController)
  });

  fastify.get('/stats/images', {
    handler: FileController.getStats.bind(FileController)
  });

  fastify.get('/events/files', {
    handler: FileController.getFileEvents.bind(FileController)
  });
}

module.exports = fileRoutes;