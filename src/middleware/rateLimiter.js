const fastifyRateLimit = require('@fastify/rate-limit');

async function rateLimiter(fastify) {
  fastify.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
    cache: 10000,
    allowList: ['127.0.0.1'],
    keyGenerator: (request) => {
      return request.ip || request.headers['x-forwarded-for'] || 'unknown';
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        message: 'Demasiadas peticiones. Por favor, espera un momento.',
        retryAfter: context.after
      };
    }
  });
}

module.exports = rateLimiter;