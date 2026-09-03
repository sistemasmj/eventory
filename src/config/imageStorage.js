const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Directorio raíz de almacenamiento privado (por defecto /data/storage/images en Linux VPS)
const defaultStorageRoot = process.platform === 'win32'
  ? path.resolve(__dirname, '../../storage/images')
  : '/data/storage/images';

const imageStorageRoot = process.env.IMAGE_STORAGE_PATH || defaultStorageRoot;

// Mapeo estricto de tipos de medios a nombres de archivo y tipos MIME por defecto
const ALLOWED_TYPES = {
  thumb: {
    fileName: 'thumb.webp',
    contentType: 'image/webp'
  },
  preview: {
    fileName: 'preview.webp',
    contentType: 'image/webp'
  },
  poster: {
    fileName: 'poster.webp',
    contentType: 'image/webp'
  },
  original: {
    fileName: 'original.jpg',
    contentType: 'image/jpeg'
  }
};

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg'
];

const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.ogv'];

const MIME_TO_EXT = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/ogg': 'ogv',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const EXT_TO_MIME = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

// Regex estricto para validar el identificador único de imagen/medio
// Formato esperado: <timestamp_ms>-<8_hex_chars>, ejemplo: 1756772985123-a83f21c7
const TOKEN_REGEX = /^\d{10,16}-[a-f0-9]{8}$/i;

/**
 * Genera un identificador único y criptográficamente seguro para el medio
 * Evita colisiones en el mismo milisegundo mediante bytes aleatorios seguros.
 */
function generateImageToken() {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${randomHex}`;
}

/**
 * Valida si un token cumple con el formato exacto permitido
 */
function isValidImageToken(token) {
  if (typeof token !== 'string') return false;
  return TOKEN_REGEX.test(token.trim());
}

/**
 * Comprueba si un MIME type corresponde a video
 */
function isVideoMime(mime) {
  if (!mime || typeof mime !== 'string') return false;
  return ALLOWED_VIDEO_MIMES.includes(mime.toLowerCase()) || mime.toLowerCase().startsWith('video/');
}

/**
 * Comprueba si una extensión corresponde a video
 */
function isVideoExt(ext) {
  if (!ext || typeof ext !== 'string') return false;
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return ALLOWED_VIDEO_EXTENSIONS.includes(cleanExt);
}

/**
 * Obtiene la ruta del directorio físico para una imagen o video específico
 */
function getImageDirectory(empresaId, imageToken) {
  return path.join(imageStorageRoot, `empresa-${empresaId}`, imageToken);
}

/**
 * Obtiene la ruta física absoluta de un tipo de imagen/video
 */
function getImageFilePath(empresaId, imageToken, type, extension = 'jpg') {
  const typeConfig = ALLOWED_TYPES[type];
  if (!typeConfig) return null;

  const dir = getImageDirectory(empresaId, imageToken);

  if (type === 'original') {
    const cleanExt = (extension || 'jpg').replace(/^\./, '').toLowerCase();
    const candidatePath = path.join(dir, `original.${cleanExt}`);
    return candidatePath;
  }

  return path.join(dir, typeConfig.fileName);
}

/**
 * Asegura que el directorio físico exista
 */
async function ensureImageDirectory(empresaId, imageToken) {
  const dirPath = getImageDirectory(empresaId, imageToken);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Elimina el directorio físico y todos sus archivos de una imagen/video
 */
async function removeImageDirectory(empresaId, imageToken) {
  const dirPath = getImageDirectory(empresaId, imageToken);
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Error al eliminar directorio físico ${dirPath}:`, error.message);
    }
    return false;
  }
}

module.exports = {
  imageStorageRoot,
  ALLOWED_TYPES,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_VIDEO_EXTENSIONS,
  MIME_TO_EXT,
  EXT_TO_MIME,
  TOKEN_REGEX,
  generateImageToken,
  isValidImageToken,
  isVideoMime,
  isVideoExt,
  getImageDirectory,
  getImageFilePath,
  ensureImageDirectory,
  removeImageDirectory
};
