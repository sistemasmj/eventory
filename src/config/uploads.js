const path = require('path');
const fs = require('fs');

// Raíz del proyecto (un nivel más arriba de backend -> /eventsdigital)
const projectRoot = path.resolve(__dirname, '../../..');

// Por defecto: /eventsdigital/storage/uploads
const defaultUploadPath = path.resolve(projectRoot, 'storage/uploads');

const configuredUploadPath = process.env.UPLOAD_PATH
  ? (path.isAbsolute(process.env.UPLOAD_PATH)
      ? process.env.UPLOAD_PATH
      : path.resolve(__dirname, '../..', process.env.UPLOAD_PATH))
  : defaultUploadPath;

const uploadRoot = path.resolve(configuredUploadPath);

// Asegurar existencia de subdirectorios requeridos
try {
  fs.mkdirSync(path.join(uploadRoot, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(uploadRoot, 'thumbs'), { recursive: true });
  fs.mkdirSync(path.join(uploadRoot, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(uploadRoot, 'temp'), { recursive: true });
} catch (e) {
  // Ignorar si ya existen
}

module.exports = {
  uploadRoot,
  publicPrefix: '/api/uploads/'
};
