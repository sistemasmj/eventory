const buildApp = require('./src/app');

// Manejo de señales para graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Iniciar servidor
const start = async () => {
  try {
    const app = await buildApp();
    
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    console.log(`📁 Uploads: http://${host}:${port}/uploads/`);
    console.log(`📚 API Documentation: http://${host}:${port}/`);
    
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

start();