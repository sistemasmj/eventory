const categoriesService = require('./categories.service');

class CategoriesController {
  /**
   * Listar categorías
   * GET /api/categories
   */
  async getCategories(request, reply) {
    try {
      const { search, estado, page, limit } = request.query || {};
      const result = await categoriesService.getCategories({
        search,
        estado,
        page,
        limit
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Error al listar categorías'
      });
    }
  }

  /**
   * Obtener categoría por ID
   * GET /api/categories/:id
   */
  async getCategoryById(request, reply) {
    try {
      const { id } = request.params;
      const category = await categoriesService.getCategoryById(id);

      return reply.send({
        success: true,
        data: category
      });
    } catch (error) {
      const statusCode = error.message.includes('no encontrada') ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Crear nueva categoría
   * POST /api/categories
   */
  async createCategory(request, reply) {
    try {
      const data = request.body || {};
      const newCategory = await categoriesService.createCategory(data);

      return reply.code(201).send({
        success: true,
        message: 'Categoría creada correctamente',
        data: newCategory
      });
    } catch (error) {
      const statusCode = error.message.includes('requerida') ? 400 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Actualizar categoría
   * PUT /api/categories/:id
   */
  async updateCategory(request, reply) {
    try {
      const { id } = request.params;
      const data = request.body || {};
      const updatedCategory = await categoriesService.updateCategory(id, data);

      return reply.send({
        success: true,
        message: 'Categoría actualizada correctamente',
        data: updatedCategory
      });
    } catch (error) {
      let statusCode = 500;
      if (error.message.includes('no encontrada')) statusCode = 404;
      else if (error.message.includes('vacía') || error.message.includes('estado debe ser')) statusCode = 400;

      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Alternar estado ('S' / 'N')
   * PATCH /api/categories/:id/status
   */
  async toggleStatus(request, reply) {
    try {
      const { id } = request.params;
      const result = await categoriesService.toggleCategoryStatus(id);

      return reply.send({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      const statusCode = error.message.includes('no encontrada') ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Eliminar categoría
   * DELETE /api/categories/:id
   */
  async deleteCategory(request, reply) {
    try {
      const { id } = request.params;
      const result = await categoriesService.deleteCategory(id);

      return reply.send(result);
    } catch (error) {
      const statusCode = error.message.includes('no encontrada') ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new CategoriesController();
