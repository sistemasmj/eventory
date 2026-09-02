const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Directorio raíz de almacenamiento privado (por defecto /data/storage/images en Linux VPS)
const defaultStorageRoot = process.platform === 'win32'
  ? path.resolve(__dirname, '../../storage/images')
  : '/data/storage/images';

const imageStorageRoot = process.env.IMAGE_STORAGE_PATH || defaultStorageRoot;

// Mapeo estricto de tipos de imagen a nombres de archivo y tipos MIME
const ALLOWED_TYPES = {
  thumb: {
    fileName: 'thumb.webp',
    contentType: 'image/webp'
  },
  preview: {
    fileName: 'preview.webp',
    contentType: 'image/webp'
  },
  original: {
    fileName: 'original.jpg',
    contentType: 'image/jpeg'
  }
};

// Regex estricto para validar el identificador único de imagen
// Formato esperado: <timestamp_ms>-<8_hex_chars>, ejemplo: 1756772985123-a83f21c7
const TOKEN_REGEX = /^\d{10,16}-[a-f0-9]{8}$/i;

/**
 * Genera un identificador único y criptográficamente seguro para la imagen
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
 * Obtiene la ruta del directorio físico para una imagen específica
 */
function getImageDirectory(empresaId, imageToken) {
  return path.join(imageStorageRoot, `empresa-${empresaId}`, imageToken);
}

/**
 * Obtiene la ruta física absoluta de un tipo de imagen
 */
function getImageFilePath(empresaId, imageToken, type) {
  const typeConfig = ALLOWED_TYPES[type];
  if (!typeConfig) return null;
  return path.join(getImageDirectory(empresaId, imageToken), typeConfig.fileName);
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
 * Elimina el directorio físico y todos sus archivos de una imagen
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
  TOKEN_REGEX,
  generateImageToken,
  isValidImageToken,
  getImageDirectory,
  getImageFilePath,
  ensureImageDirectory,
  removeImageDirectory
};
