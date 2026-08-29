const EventsService = require('./events.service');

class EventsController {
  /**
   * Crear evento
   */
  async createEvent(request, reply) {
    try {
      const { nombre, fecha, estado, descripcion } = request.body;

      if (!nombre) {
        return reply.status(400).send({
          success: false,
          message: 'El nombre es requerido'
        });
      }

      const event = await EventsService.createEvent({
        nombre,
        fecha,
        estado,
        descripcion
      });

      return reply.status(201).send({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error en createEvent:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al crear evento'
      });
    }
  }

  /**
   * Obtener todos los eventos
   */
  async getEvents(request, reply) {
    try {
      const { limit, offset, estado } = request.query;

      const events = await EventsService.getEvents({
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        estado
      });

      return reply.status(200).send({
        success: true,
        data: events
      });

    } catch (error) {
      console.error('Error en getEvents:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener eventos'
      });
    }
  }

  /**
   * Obtener evento por ID
   */
  async getEventById(request, reply) {
    try {
      const { eventId } = request.params;

      const event = await EventsService.getEventById(eventId);

      return reply.status(200).send({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error en getEventById:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener evento'
      });
    }
  }

  /**
   * Actualizar evento
   */
  async updateEvent(request, reply) {
    try {
      const { eventId } = request.params;
      const { nombre, fecha, estado, descripcion } = request.body;

      const event = await EventsService.updateEvent(eventId, {
        nombre,
        fecha,
        estado,
        descripcion
      });

      return reply.status(200).send({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error en updateEvent:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al actualizar evento'
      });
    }
  }

  /**
   * Eliminar evento
   */
  async deleteEvent(request, reply) {
    try {
      const { eventId } = request.params;

      const result = await EventsService.deleteEvent(eventId);

      return reply.status(200).send(result);

    } catch (error) {
      console.error('Error en deleteEvent:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al eliminar evento'
      });
    }
  }

  /**
   * Obtener estadísticas
   */
  async getStats(request, reply) {
    try {
      const stats = await EventsService.getStats();
      return reply.status(200).send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getStats:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      });
    }
  }
}

module.exports = new EventsController();