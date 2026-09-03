const EmpresaImagesController = require('./empresaImages.controller');

async function empresaImagesRoutes(fastify, options) {
  // Asegurar registro de multipart para subidas si no está registrado
  if (!fastify.hasContentTypeParser('multipart/form-data')) {
    await fastify.register(require('@fastify/multipart'), {
      limits: {
        fileSize: parseInt(process.env.MAX_VIDEO_SIZE, 10) || parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800, // 50MB
        files: 20
      }
    });
  }

  // 1. Endpoint /api/media para entrega protegida con X-Accel-Redirect
  fastify.get('/media/:empresaId/:imageToken/:type', {
    handler: EmpresaImagesController.serveMedia.bind(EmpresaImagesController)
  });

  // 2. Endpoints de la API REST para galerías de empresas
  fastify.get('/empresas/:empresaId/imagenes', {
    handler: EmpresaImagesController.getGallery.bind(EmpresaImagesController)
  });

  fastify.post('/empresas/:empresaId/imagenes', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    },
    handler: EmpresaImagesController.uploadImages.bind(EmpresaImagesController)
  });

  fastify.delete('/empresas/:empresaId/imagenes/:tokenOrId', {
    handler: EmpresaImagesController.deleteImage.bind(EmpresaImagesController)
  });

  fastify.put('/empresas/:empresaId/imagenes/:tokenOrId/order', {
    handler: EmpresaImagesController.updateOrder.bind(EmpresaImagesController)
  });
}

module.exports = empresaImagesRoutes;
