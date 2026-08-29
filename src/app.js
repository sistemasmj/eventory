const fastify = require('fastify')({
  logger: process.env.NODE_ENV === 'development',
  trustProxy: true,
  connectionTimeout: 30000,
  keepAliveTimeout: 65000
});

// Middlewares
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const compress = require('@fastify/compress');
const static = require('@fastify/static');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Configuración
require('dotenv').config();
const path = require('path');
const { testConnection } = require('./config/database');
const { uploadRoot, publicPrefix } = require('./config/uploads');

// Módulos
const { fileRoutes } = require('./modules/files');
const { eventsRoutes } = require('./modules/events');

async function buildApp() {
  // Plugins globales
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  });

  await fastify.register(compress, {
    global: true,
    threshold: 1024,
    brotli: true,
    zlib: { level: 9 }
  });

  await fastify.register(rateLimiter);

  // Servir archivos estáticos optimizado
  await fastify.register(static, {
    root: uploadRoot,
    prefix: publicPrefix,
    cacheControl: true,
    maxAge: 31536000000, // 1 año
    immutable: true,
    lastModified: true,
    etag: true,
    sendOptions: {
      maxAge: 31536000000,
      immutable: true
    }
  });

  // Middleware de autenticación (opcional)
  // fastify.addHook('preHandler', authMiddleware);

  // Rutas de los módulos
  await fastify.register(fileRoutes, { prefix: '/api' });
  await fastify.register(eventsRoutes, { prefix: '/api' });

  // Ruta de health check
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // Ruta raíz
  fastify.get('/', async (request, reply) => {
    return {
      name: 'Gallery API',
      version: '1.0.0',
      endpoints: {
        events: '/api/events',
        gallery: '/api/events/:eventId/gallery',
        upload: '/api/events/:eventId/images',
        stats: '/api/stats/events'
      }
    };
  });

  // Error handler global
  fastify.setErrorHandler(errorHandler);

  // Conectar a base de datos
  await testConnection();
  await fastify.ready();

  return fastify;
}

module.exports = buildApp;