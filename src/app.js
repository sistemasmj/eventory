const fastify = require('fastify')({
  logger: process.env.NODE_ENV === 'development',
  trustProxy: true,
  connectionTimeout: 600000, // 10 minutos para dar tiempo suficiente al usuario al tomar fotos y subir videos
  keepAliveTimeout: 610000,
  requestTimeout: 600000,
  bodyLimit: 52428800 // 50MB máximo
});

// Middlewares
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const compress = require('@fastify/compress');
const fastifyStatic = require('@fastify/static');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Configuración
require('dotenv').config();
const path = require('path');
const { testConnection } = require('./config/database');
const { syncModels } = require('./models');
const { uploadRoot, publicPrefix } = require('./config/uploads');

// Módulos
const { fileRoutes } = require('./modules/files');
const { eventsRoutes } = require('./modules/events');
const { empresaImagesRoutes } = require('./modules/empresaImages');
const { songsRoutes } = require('./modules/songs');
const { categoriesRoutes } = require('./modules/categories');

async function buildApp() {
  // Plugins globales
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-auth-empresa-id', 'Range', 'Accept-Ranges', 'Accept'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
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

  // Servir archivos estáticos optimizado bajo /api/uploads/
  await fastify.register(fastifyStatic, {
    root: uploadRoot,
    prefix: publicPrefix, // '/api/uploads/'
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

  // Alias para retrocompatibilidad con /uploads/
  await fastify.register(fastifyStatic, {
    root: uploadRoot,
    prefix: '/uploads/',
    decorateReply: false,
    cacheControl: true,
    maxAge: 31536000000,
    immutable: true,
    lastModified: true,
    etag: true
  });

  // Middleware de autenticación (opcional)
  // fastify.addHook('preHandler', authMiddleware);

  // Rutas de los módulos (TODAS bajo /api)
  await fastify.register(fileRoutes, { prefix: '/api' });
  await fastify.register(eventsRoutes, { prefix: '/api' });
  await fastify.register(empresaImagesRoutes, { prefix: '/api' });
  await fastify.register(songsRoutes, { prefix: '/api' });
  await fastify.register(categoriesRoutes, { prefix: '/api' });
  // Alias de entrega /media para compatibilidad si fuera necesario
  await fastify.register(empresaImagesRoutes);

  // Rutas de health check mínima
  fastify.get('/api/health', async (request, reply) => {
    return { status: 'OK' };
  });

  // Error handler global
  fastify.setErrorHandler(errorHandler);

  // Conectar a base de datos y sincronizar modelos
  await testConnection();
  await syncModels();
  await fastify.ready();

  return fastify;
}

module.exports = buildApp;