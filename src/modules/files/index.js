const fileRoutes = require('./files.routes');
const FileService = require('./files.service');
const { fileEvents, EVENTS } = require('./files.events');

module.exports = {
  fileRoutes,
  FileService,
  fileEvents,
  EVENTS
};