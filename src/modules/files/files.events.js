// Eventos del módulo de archivos
const EventEmitter = require('events');

class FileEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

const fileEvents = new FileEvents();

// Definir eventos
const EVENTS = {
  IMAGE_UPLOADED: 'image:uploaded',
  IMAGE_PROCESSED: 'image:processed',
  IMAGE_DELETED: 'image:deleted',
  IMAGE_UPDATED: 'image:updated',
  THUMBNAIL_GENERATED: 'thumbnail:generated',
  BULK_UPLOAD_COMPLETED: 'bulk:upload:completed',
  UPLOAD_ERROR: 'upload:error'
};

module.exports = {
  fileEvents,
  EVENTS
};