// Simple authentication middleware (puedes expandir con JWT)
async function authMiddleware(request, reply) {
  // Ejemplo simple - puedes implementar JWT aquí
  const apiKey = request.headers['x-api-key'];
  
  // Si no hay API key configurada, permitir todo (modo desarrollo)
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // Verificar API key
  if (!apiKey || apiKey !== process.env.API_KEY) {
    throw new Error('API Key inválida o no proporcionada');
  }
}

module.exports = authMiddleware;