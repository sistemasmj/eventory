const categoriesController = require('./categories.controller');

async function categoriesRoutes(fastify, options) {
  // Listar categorías con filtros
  fastify.get('/categories', (req, reply) => categoriesController.getCategories(req, reply));

  // Obtener categoría por ID
  fastify.get('/categories/:id', (req, reply) => categoriesController.getCategoryById(req, reply));

  // Crear categoría
  fastify.post('/categories', (req, reply) => categoriesController.createCategory(req, reply));

  // Actualizar categoría
  fastify.put('/categories/:id', (req, reply) => categoriesController.updateCategory(req, reply));

  // Alternar estado 'S' <-> 'N'
  fastify.patch('/categories/:id/status', (req, reply) => categoriesController.toggleStatus(req, reply));
  fastify.put('/categories/:id/status', (req, reply) => categoriesController.toggleStatus(req, reply));

  // Eliminar categoría
  fastify.delete('/categories/:id', (req, reply) => categoriesController.deleteCategory(req, reply));
}

module.exports = categoriesRoutes;
