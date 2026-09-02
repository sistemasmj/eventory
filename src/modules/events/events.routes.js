const EventsController = require('./events.controller');

async function eventsRoutes(fastify, options) {
  // Rutas CRUD para eventos
  fastify.post('/events', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    },
    handler: EventsController.createEvent.bind(EventsController)
  });

  fastify.get('/events', {
    handler: EventsController.getEvents.bind(EventsController)
  });

  fastify.get('/events/list', {
    handler: EventsController.getEvents.bind(EventsController)
  });

  fastify.get('/events/:eventId', {
    handler: EventsController.getEventById.bind(EventsController)
  });

  fastify.put('/events/:eventId', {
    handler: EventsController.updateEvent.bind(EventsController)
  });

  fastify.delete('/events/:eventId', {
    handler: EventsController.deleteEvent.bind(EventsController)
  });

  fastify.get('/stats/events', {
    handler: EventsController.getStats.bind(EventsController)
  });
}

module.exports = eventsRoutes;