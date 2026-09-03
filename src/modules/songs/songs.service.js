const { Song, Event } = require('../../models');
const { uploadRoot, publicPrefix } = require('../../config/uploads');
const videoProcessor = require('../../utils/videoProcessor');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.opus', '.wma'];
const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/x-aac',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/x-flac'
];

class SongsService {
  /**
   * Asegura la existencia del directorio de audio
   */
  async ensureAudioDirectory() {
    const audioDir = path.join(uploadRoot, 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    return audioDir;
  }

  /**
   * Obtiene la lista de canciones activas
   */
  async getSongs(options = {}) {
    const where = {
      estado: options.estado || 'activo'
    };

    if (options.search) {
      where.nombre = { [Op.like]: `%${options.search}%` };
    }

    const songs = await Song.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: options.limit || 200,
      offset: options.offset || 0
    });

    return songs.map((s) => this.formatSong(s));
  }

  /**
   * Obtiene una canción por ID
   */
  async getSongById(id) {
    const song = await Song.findByPk(id);
    if (!song) {
      throw new Error('Canción no encontrada');
    }
    return this.formatSong(song);
  }

  /**
   * Formatea un registro de canción con URLs completas
   */
  formatSong(song) {
    const songJson = song.toJSON ? song.toJSON() : song;
    const cleanPath = (songJson.ruta_archivo || '').replace(/\\/g, '/').replace(/^uploads\//, '');
    const audioUrl = `${publicPrefix}${cleanPath}`;

    return {
      id: songJson.id,
      nombre: songJson.nombre,
      nombreOriginal: songJson.nombre_original,
      rutaArchivo: songJson.ruta_archivo,
      url: audioUrl,
      streamUrl: `/api/songs/${songJson.id}/stream`,
      mimeType: songJson.mime_type,
      size: songJson.size,
      duracion: songJson.duracion,
      estado: songJson.estado,
      metadata: songJson.metadata,
      createdAt: songJson.createdAt || songJson.created_at,
      updatedAt: songJson.updatedAt || songJson.updated_at
    };
  }

  /**
   * Sube y registra una nueva canción
   */
  async uploadSong(file, data = {}) {
    const audioDir = await this.ensureAudioDirectory();
    const originalName = file.filename || 'cancion.mp3';
    const ext = (path.extname(originalName) || '.mp3').toLowerCase();

    // Validar extensión
    if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext) && !file.mimetype?.startsWith('audio/')) {
      throw new Error(`Formato de audio no permitido: ${ext}. Formatos permitidos: mp3, m4a, wav, aac, ogg, flac`);
    }

    // Extraer buffer
    let fileBuffer;
    if (Buffer.isBuffer(file.buffer)) {
      fileBuffer = file.buffer;
    } else if (Buffer.isBuffer(file.file || file.data)) {
      fileBuffer = file.file || file.data;
    } else if (file.file && typeof file.file.pipe === 'function') {
      const chunks = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    } else {
      throw new Error('Buffer de archivo de audio no disponible');
    }

    // Validar límite de 50MB
    if (fileBuffer.length > 52428800) {
      throw new Error('El archivo de audio excede el límite máximo permitido de 50MB');
    }

    const uniqueId = `song_${uuidv4()}${ext}`;
    const relativePath = path.posix.join('uploads', 'audio', uniqueId);
    const absolutePath = path.join(audioDir, uniqueId);

    // Escribir archivo físico
    await fs.writeFile(absolutePath, fileBuffer);

    // Extraer duración estimada con ffprobe si está disponible
    let duracion = null;
    try {
      const meta = await videoProcessor.getVideoMetadata(absolutePath);
      if (meta && meta.duration) {
        duracion = meta.duration;
      }
    } catch {}

    const songTitle = (data.nombre && data.nombre.trim()) 
      ? data.nombre.trim() 
      : originalName.replace(/\.[^/.]+$/, '');

    const song = await Song.create({
      nombre: songTitle,
      nombre_original: originalName,
      ruta_archivo: relativePath,
      mime_type: file.mimetype || 'audio/mpeg',
      size: fileBuffer.length,
      duracion: duracion,
      estado: 'activo',
      metadata: {
        original_name: originalName,
        extension: ext,
        uploaded_at: new Date().toISOString()
      }
    });

    return this.formatSong(song);
  }

  /**
   * Actualiza el nombre o estado de una canción
   */
  async updateSong(id, data = {}) {
    const song = await Song.findByPk(id);
    if (!song) {
      throw new Error('Canción no encontrada');
    }

    if (data.nombre && data.nombre.trim()) {
      song.nombre = data.nombre.trim();
    }
    if (data.estado) {
      song.estado = data.estado;
    }

    await song.save();
    return this.formatSong(song);
  }

  /**
   * Elimina una canción (BD y archivo en disco)
   */
  async deleteSong(id) {
    const song = await Song.findByPk(id);
    if (!song) {
      throw new Error('Canción no encontrada');
    }

    // Desvincular eventos asociados a esta canción
    await Event.update(
      { cancion_id: null },
      { where: { cancion_id: id } }
    );

    const relativePath = song.ruta_archivo;
    if (relativePath) {
      const absolutePath = path.join(uploadRoot, relativePath.replace(/^uploads[\\/]/, ''));
      await fs.unlink(absolutePath).catch(() => {});
    }

    await song.destroy({ force: true });

    return {
      success: true,
      message: 'Canción eliminada exitosamente'
    };
  }
}

module.exports = new SongsService();
