const songsController = require('./songs.controller');

async function songsRoutes(fastify, options) {
  // Asegurar registro de multipart para subidas de archivos de audio
  if (!fastify.hasContentTypeParser('multipart/form-data')) {
    await fastify.register(require('@fastify/multipart'), {
      limits: {
        fileSize: 52428800, // 50MB
        files: 5,
        fields: 10
      },
      attachFieldsToBody: false,
      throwFileSizeLimit: true
    });
  }

  // Listar canciones
  fastify.get('/songs', (req, reply) => songsController.getSongs(req, reply));

  // Detalle de canción
  fastify.get('/songs/:id', (req, reply) => songsController.getSongById(req, reply));

  // Subir canción (multipart)
  fastify.post('/songs', (req, reply) => songsController.uploadSong(req, reply));

  // Actualizar canción
  fastify.put('/songs/:id', (req, reply) => songsController.updateSong(req, reply));

  // Eliminar canción
  fastify.delete('/songs/:id', (req, reply) => songsController.deleteSong(req, reply));

  // Streaming de audio (206 Partial Content)
  fastify.get('/songs/:id/stream', (req, reply) => songsController.streamAudio(req, reply));
}

module.exports = songsRoutes;
