const path = require('path');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif'];
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff'
];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB

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
    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      errors.push({
        filename: file.filename,
        error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1048576}MB`
      });
      continue;
    }

    // Validar extensión solo cuando el navegador no informa el tipo MIME.
    const ext = path.extname(file.filename).toLowerCase();
    const isImageMime = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');
    if (!isImageMime && !ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push({
        filename: file.filename,
        error: `Extensión no permitida: ${ext}. Permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
      continue;
    }

    // Validar mime type (si está disponible)
    if (file.mimetype && !isImageMime && !ALLOWED_MIMES.includes(file.mimetype)) {
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