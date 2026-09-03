const path = require('path');

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif',
  '.mp4', '.webm', '.mov', '.avi', '.ogv', '.m4v'
];
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
  'video/mp4v-es',
  'video/x-m4v'
];
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE) || 20971520; // 20MB
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE) || 52428800; // 50MB (50 megas)
const MAX_FILE_SIZE = MAX_VIDEO_SIZE;

/**
 * Validar archivos subidos
 */
function validateUpload(files) {
  const errors = [];

  if (!files || files.length === 0) {
    return {
      valid: false,
      errors: ['No se enviaron archivos']
    };
  }

  for (const file of files) {
    const ext = path.extname(file.filename || '').toLowerCase();
    const isVideo = (file.mimetype && file.mimetype.startsWith('video/')) || 
                    ['.mp4', '.webm', '.mov', '.avi', '.ogv', '.m4v'].includes(ext);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const maxMb = isVideo ? 50 : 20;

    // Validar tamaño máximo (50MB para videos, 20MB para fotos)
    if (file.size && file.size > maxSize) {
      errors.push({
        filename: file.filename,
        error: `El ${isVideo ? 'video' : 'archivo'} excede el tamaño máximo permitido de ${maxMb}MB`
      });
      continue;
    }

    // Validar extensión
    const isImageOrVideoMime = typeof file.mimetype === 'string' && 
      (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'));

    if (!isImageOrVideoMime && !ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push({
        filename: file.filename,
        error: `Extensión no permitida: ${ext}. Permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
      continue;
    }

    // Validar mime type (si está disponible)
    if (file.mimetype && !isImageOrVideoMime && !ALLOWED_MIMES.includes(file.mimetype)) {
      errors.push({
        filename: file.filename,
        error: `Tipo de archivo no permitido: ${file.mimetype}`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validar datos de evento
 */
function validateEvent(data) {
  const errors = [];

  const nombre = data.nombre_cliente || data.nombre;
  if (!nombre && data.tipo_ceremonia === undefined) {
    errors.push('El nombre del cliente o tipo de ceremonia es requerido');
  }

  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('El formato de correo electrónico no es válido');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

module.exports = {
  validateUpload,
  validateEvent,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
  MAX_FILE_SIZE
};