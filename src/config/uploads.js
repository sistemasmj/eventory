const path = require('path');

const configuredUploadPath = process.env.UPLOAD_PATH || './uploads';

module.exports = {
  uploadRoot: path.resolve(__dirname, '../..', configuredUploadPath),
  publicPrefix: '/uploads/'
};
