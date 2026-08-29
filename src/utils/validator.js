const path = require('path');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'];
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

    // Validar extensión
    const ext = path.extname(file.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push({
        filename: file.filename,
        error: `Extensión no permitida: ${ext}. Permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
      continue;
    }

    // Validar mime type (si está disponible)
    if (file.mimetype && !ALLOWED_MIMES.includes(file.mimetype)) {
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

  if (!data.nombre || data.nombre.trim().length < 3) {
    errors.push('El nombre debe tener al menos 3 caracteres');
  }

  if (data.nombre && data.nombre.length > 255) {
    errors.push('El nombre no debe exceder 255 caracteres');
  }

  if (data.estado && !['activo', 'inactivo', 'finalizado'].includes(data.estado)) {
    errors.push('Estado no válido');
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