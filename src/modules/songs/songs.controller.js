const songsService = require('./songs.service');
const { uploadRoot } = require('../../config/uploads');
const path = require('path');
const fs = require('fs');
const { stat } = require('fs').promises;

class SongsController {
  /**
   * Listar canciones
   */
  async getSongs(request, reply) {
    try {
      const { search, estado, limit, offset } = request.query || {};
      const songs = await songsService.getSongs({
        search,
        estado,
        limit: parseInt(limit, 10) || 200,
        offset: parseInt(offset, 10) || 0
      });

      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.status(200).send({
        success: true,
        data: songs,
        total: songs.length
      });
    } catch (error) {
      console.error('Error en getSongs:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener canciones'
      });
    }
  }

  /**
   * Obtener detalle de canción
   */
  async getSongById(request, reply) {
    try {
      const { id } = request.params;
      const song = await songsService.getSongById(id);
      return reply.status(200).send({
        success: true,
        data: song
      });
    } catch (error) {
      return reply.status(404).send({
        success: false,
        message: error.message || 'Canción no encontrada'
      });
    }
  }

  /**
   * Subir nueva canción (soporta Multipart Form-Data y JSON Base64/Buffer)
   */
  async uploadSong(request, reply) {
    try {
      let file = null;
      let nombre = null;

      if (request.isMultipart && request.isMultipart()) {
        if (typeof request.parts === 'function') {
          for await (const part of request.parts()) {
            if (part.file) {
              const chunks = [];
              for await (const chunk of part.file) {
                chunks.push(chunk);
              }
              const buffer = Buffer.concat(chunks);
              file = {
                filename: part.filename,
                mimetype: part.mimetype,
                buffer: buffer,
                size: buffer.length
              };
            } else if (part.fieldname === 'nombre' || part.name === 'nombre') {
              nombre = part.value;
            }
          }
        } else if (typeof request.files === 'function') {
          const parts = request.files();
          for await (const part of parts) {
            if (part && part.file) {
              const chunks = [];
              for await (const chunk of part.file) {
                chunks.push(chunk);
              }
              const buffer = Buffer.concat(chunks);
              file = {
                filename: part.filename,
                mimetype: part.mimetype,
                buffer: buffer,
                size: buffer.length
              };
              if (part.fields?.nombre?.value) {
                nombre = part.fields.nombre.value;
              }
              break;
            }
          }
        }
      }

      // Fallback para JSON / Buffer directo
      if (!file && request.body) {
        if (request.body.fileBase64 || request.body.buffer) {
          const buffer = request.body.buffer 
            ? Buffer.from(request.body.buffer)
            : Buffer.from(request.body.fileBase64, 'base64');
          file = {
            filename: request.body.filename || request.body.fileName || 'cancion.mp3',
            mimetype: request.body.mimetype || request.body.mimeType || 'audio/mpeg',
            buffer: buffer,
            size: buffer.length
          };
          nombre = request.body.nombre;
        } else if (request.body.file) {
          file = request.body.file;
          nombre = request.body.nombre;
        }
      }

      if (!file) {
        return reply.status(400).send({
          success: false,
          message: 'No se envió ningún archivo de audio válido'
        });
      }

      const song = await songsService.uploadSong(file, { nombre });

      return reply.status(201).send({
        success: true,
        message: 'Canción subida y registrada exitosamente',
        data: song
      });
    } catch (error) {
      console.error('Error en uploadSong:', error);
      return reply.status(400).send({
        success: false,
        message: error.message || 'Error al subir la canción'
      });
    }
  }

  /**
   * Actualizar nombre o estado de la canción
   */
  async updateSong(request, reply) {
    try {
      const { id } = request.params;
      const { nombre, estado } = request.body || {};

      const song = await songsService.updateSong(id, { nombre, estado });

      return reply.status(200).send({
        success: true,
        message: 'Canción actualizada exitosamente',
        data: song
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        message: error.message || 'Error al actualizar canción'
      });
    }
  }

  /**
   * Eliminar canción
   */
  async deleteSong(request, reply) {
    try {
      const { id } = request.params;
      const result = await songsService.deleteSong(id);
      return reply.status(200).send(result);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        message: error.message || 'Error al eliminar canción'
      });
    }
  }

  /**
   * Streaming de audio con soporte para Range Requests (206 Partial Content)
   */
  async streamAudio(request, reply) {
    try {
      const { id } = request.params;
      const song = await songsService.getSongById(id);

      const filePath = path.join(uploadRoot, song.rutaArchivo.replace(/^uploads[\\/]/, ''));
      const fileStats = await stat(filePath);
      const fileSize = fileStats.size;
      const range = request.headers.range;

      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Type', song.mimeType || 'audio/mpeg');
      reply.header('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      reply.header('ETag', `"${song.id}-${fileStats.mtimeMs.toString(36)}-${fileSize.toString(36)}"`);
      reply.header('Last-Modified', fileStats.mtime.toUTCString());

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          reply.header('Content-Range', `bytes */${fileSize}`);
          return reply.status(416).send('Requested range not satisfiable');
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunksize);
        return reply.send(fileStream);
      }

      reply.header('Content-Length', fileSize);
      const fileStream = fs.createReadStream(filePath);
      return reply.status(200).send(fileStream);
    } catch (error) {
      return reply.status(404).send({
        success: false,
        message: 'Archivo de audio no encontrado'
      });
    }
  }
}

module.exports = new SongsController();
