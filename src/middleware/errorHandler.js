async function errorHandler(error, request, reply) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor';

  // Log del error
  console.error(`[${new Date().toISOString()}] Error:`, {
    statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: request.url,
    method: request.method
  });

  // Respuesta de error
  reply.status(statusCode).send({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      details: error.details
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;