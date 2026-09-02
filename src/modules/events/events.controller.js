const EventsService = require('./events.service');

class EventsController {
  /**
   * Crear evento
   */
  async createEvent(request, reply) {
    try {
      const body = request.body || {};

      const nombre = body.nombre_cliente || body.nombre;
      if (!nombre && body.tipo_ceremonia === undefined) {
        return reply.status(400).send({
          success: false,
          message: 'El nombre del cliente o tipo de ceremonia es requerido'
        });
      }

      const event = await EventsService.createEvent(body);
      const raw = event.toJSON ? event.toJSON() : event;

      return reply.status(201).send({
        success: true,
        message: 'Evento registrado exitosamente en la bandeja',
        data: {
          id: raw.id,
          codigo: raw.codigo,
          tipo_ceremonia: raw.tipo_ceremonia,
          nombre_cliente: raw.nombre_cliente,
          telefono: raw.telefono,
          email: raw.email,
          fecha_evento: raw.fecha_evento,
          hora_evento: raw.hora_evento,
          lugar: raw.lugar,
          numero_invitados: raw.numero_invitados,
          presupuesto: raw.presupuesto !== null && raw.presupuesto !== undefined ? parseFloat(raw.presupuesto) : null,
          nombre_paquete: raw.nombre_paquete,
          notas: raw.notas,
          estado: raw.estado,
          fecha_registro: raw.fecha_registro ? new Date(raw.fecha_registro).toISOString() : new Date().toISOString(),
          created_at: raw.createdAt ? new Date(raw.createdAt).toISOString() : (raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString()),
          updated_at: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : (raw.updated_at ? new Date(raw.updated_at).toISOString() : new Date().toISOString())
        }
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
      const { limit, offset, estado, tipo_ceremonia } = request.query || {};

      const events = await EventsService.getEvents({
        limit: parseInt(limit, 10) || 100,
        offset: parseInt(offset, 10) || 0,
        estado,
        tipo_ceremonia: tipo_ceremonia !== undefined ? parseInt(tipo_ceremonia, 10) : undefined
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
      return reply.status(error.message === 'Evento no encontrado' ? 404 : 500).send({
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
      const body = request.body || {};

      const event = await EventsService.updateEvent(eventId, body);

      return reply.status(200).send({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error en updateEvent:', error);
      return reply.status(error.message === 'Evento no encontrado' ? 404 : 500).send({
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
      return reply.status(error.message === 'Evento no encontrado' ? 404 : 500).send({
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