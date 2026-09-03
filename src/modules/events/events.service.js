const { Event, GalleryImage, Song, sequelize } = require('../../models');
const { publicPrefix } = require('../../config/uploads');
const cache = require('../../utils/cache');
const { Op } = require('sequelize');
const crypto = require('crypto');

class EventsService {
  /**
   * Crear nuevo evento
   */
  async createEvent(data) {
    const estado = data.estado || 'En Preparación';
    const fechaRegistro = data.fecha_registro ? new Date(data.fecha_registro) : new Date();
    const nombreCliente = data.nombre_cliente || data.nombre || null;
    const fechaEvento = data.fecha_evento || null;
    const notas = data.notas || data.descripcion || null;
    const cancionId = data.cancion_id !== undefined && data.cancion_id !== null && data.cancion_id !== '' 
      ? parseInt(data.cancion_id, 10) 
      : null;
    // Generar código único aleatorio UUID con números y letras
    const codigoGenerado = data.codigo || crypto.randomUUID();

    const event = await Event.create({
      codigo: codigoGenerado,
      tipo_ceremonia: data.tipo_ceremonia !== undefined && data.tipo_ceremonia !== null ? parseInt(data.tipo_ceremonia, 10) : null,
      nombre_cliente: nombreCliente,
      telefono: data.telefono || null,
      email: data.email || null,
      fecha_evento: fechaEvento,
      hora_evento: data.hora_evento || null,
      lugar: data.lugar || null,
      numero_invitados: data.numero_invitados !== undefined && data.numero_invitados !== null ? parseInt(data.numero_invitados, 10) : null,
      presupuesto: data.presupuesto !== undefined && data.presupuesto !== null ? parseFloat(data.presupuesto) : null,
      nombre_paquete: data.nombre_paquete || null,
      notas: notas,
      cancion_id: cancionId,
      estado: estado,
      fecha_registro: fechaRegistro,
      // Compatibilidad
      nombre: nombreCliente || 'Evento',
      fecha: fechaEvento ? new Date(fechaEvento) : new Date(),
      descripcion: notas
    });

    // Invalidar cachés
    cache.del('events:all');
    cache.del('gallery:all');

    return event;
  }

  /**
   * Obtener todos los eventos
   */
  async getEvents(options = {}) {
    const cacheKey = `events:all:${JSON.stringify(options)}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const where = {};
    if (options.estado) {
      where.estado = options.estado;
    }
    if (options.tipo_ceremonia) {
      where.tipo_ceremonia = options.tipo_ceremonia;
    }

    const events = await Event.findAll({
      where,
      attributes: [
        'id',
        'codigo',
        'tipo_ceremonia',
        'nombre_cliente',
        'telefono',
        'email',
        'fecha_evento',
        'hora_evento',
        'lugar',
        'numero_invitados',
        'presupuesto',
        'nombre_paquete',
        'notas',
        'cancion_id',
        'estado',
        'fecha_registro',
        'nombre',
        'fecha',
        'descripcion',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: GalleryImage,
          as: 'images',
          attributes: ['id', 'ruta_thumb', 'ruta_raw'],
          limit: 1,
          order: [['orden', 'ASC'], ['fecha_subida', 'ASC']],
          required: false,
          where: { estado: 'activo' }
        },
        {
          model: Song,
          as: 'cancion',
          attributes: ['id', 'nombre', 'ruta_archivo', 'mime_type', 'duracion', 'size'],
          required: false
        }
      ],
      order: [['fecha_registro', 'DESC'], ['id', 'DESC']],
      limit: options.limit || 100,
      offset: options.offset || 0
    });

    const result = events.map(event => {
      const eventData = event.toJSON();
      if (eventData.presupuesto !== null && eventData.presupuesto !== undefined) {
        eventData.presupuesto = parseFloat(eventData.presupuesto);
      }
      if (eventData.images && eventData.images.length > 0) {
        eventData.cover = {
          id: eventData.images[0].id,
          thumb: `/${eventData.images[0].ruta_thumb}`,
          raw: `/${eventData.images[0].ruta_raw}`
        };
        delete eventData.images;
      }
      if (eventData.cancion) {
        const cleanPath = (eventData.cancion.ruta_archivo || '').replace(/\\/g, '/').replace(/^uploads\//, '');
        eventData.cancion.url = `${publicPrefix}${cleanPath}`;
        eventData.cancion.streamUrl = `/api/songs/${eventData.cancion.id}/stream`;
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
      include: [
        {
          model: GalleryImage,
          as: 'images',
          where: { estado: 'activo' },
          attributes: ['id', 'nombre', 'ruta_thumb', 'ruta_raw'],
          order: [['orden', 'ASC'], ['fecha_subida', 'ASC']],
          required: false
        },
        {
          model: Song,
          as: 'cancion',
          attributes: ['id', 'nombre', 'ruta_archivo', 'mime_type', 'duracion', 'size'],
          required: false
        }
      ]
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    const eventData = event.toJSON();
    if (eventData.presupuesto !== null && eventData.presupuesto !== undefined) {
      eventData.presupuesto = parseFloat(eventData.presupuesto);
    }
    if (eventData.cancion) {
      const cleanPath = (eventData.cancion.ruta_archivo || '').replace(/\\/g, '/').replace(/^uploads\//, '');
      eventData.cancion.url = `${publicPrefix}${cleanPath}`;
      eventData.cancion.streamUrl = `/api/songs/${eventData.cancion.id}/stream`;
    }

    return eventData;
  }

  /**
   * Actualizar evento
   */
  async updateEvent(id, data) {
    const event = await Event.findByPk(id);
    if (!event) {
      throw new Error('Evento no encontrado');
    }

    const updatePayload = { ...data };
    if (updatePayload.presupuesto !== undefined && updatePayload.presupuesto !== null) {
      updatePayload.presupuesto = parseFloat(updatePayload.presupuesto);
    }
    if (updatePayload.numero_invitados !== undefined && updatePayload.numero_invitados !== null) {
      updatePayload.numero_invitados = parseInt(updatePayload.numero_invitados, 10);
    }
    if (updatePayload.tipo_ceremonia !== undefined && updatePayload.tipo_ceremonia !== null) {
      updatePayload.tipo_ceremonia = parseInt(updatePayload.tipo_ceremonia, 10);
    }
    if (updatePayload.cancion_id !== undefined) {
      updatePayload.cancion_id = updatePayload.cancion_id ? parseInt(updatePayload.cancion_id, 10) : null;
    }
    if (updatePayload.nombre_cliente && !updatePayload.nombre) {
      updatePayload.nombre = updatePayload.nombre_cliente;
    }
    if (updatePayload.notas && !updatePayload.descripcion) {
      updatePayload.descripcion = updatePayload.notas;
    }

    await event.update(updatePayload);

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
        count: parseInt(item.dataValues.count, 10)
      })),
      totalImages: imagesTotal
    };
  }
}

module.exports = new EventsService();