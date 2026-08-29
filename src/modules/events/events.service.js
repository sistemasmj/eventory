const { Event, GalleryImage } = require('../../models');
const { fileEvents, EVENTS } = require('../files/files.events');
const cache = require('../../utils/cache');
const { Op } = require('sequelize');

class EventsService {
  /**
   * Crear nuevo evento
   */
  async createEvent(data) {
    const event = await Event.create({
      nombre: data.nombre,
      fecha: data.fecha || new Date(),
      estado: data.estado || 'activo',
      descripcion: data.descripcion
    });

    cache.del('gallery:all');
    return event;
  }

  /**
   * Obtener todos los eventos
   */
  async getEvents(options = {}) {
    const cacheKey = 'events:all';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const where = {};
    if (options.estado) {
      where.estado = options.estado;
    }

    const events = await Event.findAll({
      where,
      attributes: ['id', 'nombre', 'fecha', 'estado', 'descripcion'],
      include: [{
        model: GalleryImage,
        as: 'images',
        attributes: ['id', 'ruta_thumb', 'ruta_raw'],
        limit: 1,
        order: [['orden', 'ASC'], ['fecha_subida', 'ASC']],
        required: false,
        where: { estado: 'activo' }
      }],
      order: [['fecha', 'DESC']],
      limit: options.limit || 100,
      offset: options.offset || 0
    });

    const result = events.map(event => {
      const eventData = event.toJSON();
      if (eventData.images && eventData.images.length > 0) {
        eventData.cover = {
          id: eventData.images[0].id,
          thumb: `/${eventData.images[0].ruta_thumb}`,
          raw: `/${eventData.images[0].ruta_raw}`
        };
        delete eventData.images;
      }
      return eventData;
    });

    cache.set(cacheKey, result);
    return result;
  }

  /**
   * Obtener evento por ID
   */
  async getEventById(id) {
    const event = await Event.findByPk(id, {
      include: [{
        model: GalleryImage,
        as: 'images',
        where: { estado: 'activo' },
        attributes: ['id', 'nombre', 'ruta_thumb', 'ruta_raw'],
        order: [['orden', 'ASC'], ['fecha_subida', 'ASC']],
        required: false
      }]
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    return event;
  }

  /**
   * Actualizar evento
   */
  async updateEvent(id, data) {
    const event = await Event.findByPk(id);
    if (!event) {
      throw new Error('Evento no encontrado');
    }

    await event.update(data);

    // Invalidar cachés
    cache.del('events:all');
    cache.del('gallery:all');

    return event;
  }

  /**
   * Eliminar evento (soft delete)
   */
  async deleteEvent(id) {
    const event = await Event.findByPk(id);
    if (!event) {
      throw new Error('Evento no encontrado');
    }

    await event.destroy();

    // Las imágenes se eliminarán en cascada
    cache.del('events:all');
    cache.del('gallery:all');

    return { success: true, message: 'Evento eliminado correctamente' };
  }

  /**
   * Obtener estadísticas de eventos
   */
  async getStats() {
    const total = await Event.count();
    const byEstado = await Event.findAll({
      attributes: [
        'estado',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['estado']
    });

    const imagesTotal = await GalleryImage.count({
      where: { estado: 'activo' }
    });

    return {
      totalEvents: total,
      byEstado: byEstado.map(item => ({
        estado: item.estado,
        count: parseInt(item.dataValues.count)
      })),
      totalImages: imagesTotal
    };
  }
}

const { sequelize } = require('../../models');
module.exports = new EventsService();