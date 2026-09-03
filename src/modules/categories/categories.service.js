const { Op } = require('sequelize');
const { Category, GalleryImage } = require('../../models');

class CategoriesService {
  /**
   * Obtiene la lista de categorías con filtros y paginación
   */
  async getCategories(options = {}) {
    const { search, estado, page = 1, limit = 50 } = options;
    const where = {};

    // Filtro por búsqueda en descripción
    if (search && search.trim() !== '') {
      where.descripcion = {
        [Op.like]: `%${search.trim()}%`
      };
    }

    // Filtro por estado ('S' o 'N')
    if (estado && (estado === 'S' || estado === 'N')) {
      where.estado = estado;
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { count, rows } = await Category.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      limit: parsedLimit,
      offset
    });

    // Mapear con información de imágenes vinculadas
    const items = await Promise.all(
      rows.map(async (cat) => {
        const imageCount = await GalleryImage.count({
          where: { categoria_id: cat.id }
        });

        return {
          id: cat.id,
          descripcion: cat.descripcion,
          estado: cat.estado,
          imageCount,
          createdAt: cat.created_at,
          updatedAt: cat.updated_at
        };
      })
    );

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parsedLimit,
      totalPages: Math.ceil(count / parsedLimit),
      items
    };
  }

  /**
   * Obtiene una categoría por su ID
   */
  async getCategoryById(id) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const imageCount = await GalleryImage.count({
      where: { categoria_id: category.id }
    });

    return {
      id: category.id,
      descripcion: category.descripcion,
      estado: category.estado,
      imageCount,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  /**
   * Crea una nueva categoría
   */
  async createCategory(data) {
    const { descripcion, estado = 'S' } = data;

    if (!descripcion || descripcion.trim() === '') {
      throw new Error('La descripción de la categoría es requerida');
    }

    const cleanEstado = estado === 'N' ? 'N' : 'S';

    const newCategory = await Category.create({
      descripcion: descripcion.trim(),
      estado: cleanEstado
    });

    return {
      id: newCategory.id,
      descripcion: newCategory.descripcion,
      estado: newCategory.estado,
      createdAt: newCategory.created_at,
      updatedAt: newCategory.updated_at
    };
  }

  /**
   * Actualiza una categoría existente
   */
  async updateCategory(id, data) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const { descripcion, estado } = data;

    if (descripcion !== undefined) {
      if (!descripcion || descripcion.trim() === '') {
        throw new Error('La descripción no puede estar vacía');
      }
      category.descripcion = descripcion.trim();
    }

    if (estado !== undefined) {
      if (estado !== 'S' && estado !== 'N') {
        throw new Error("El estado debe ser 'S' (Activo) o 'N' (Inactivo)");
      }
      category.estado = estado;
    }

    await category.save();

    return {
      id: category.id,
      descripcion: category.descripcion,
      estado: category.estado,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  /**
   * Alterna el estado de una categoría ('S' <-> 'N')
   */
  async toggleCategoryStatus(id) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    category.estado = category.estado === 'S' ? 'N' : 'S';
    await category.save();

    return {
      id: category.id,
      descripcion: category.descripcion,
      estado: category.estado,
      message: `Categoría ${category.estado === 'S' ? 'activada' : 'desactivada'} correctamente`
    };
  }

  /**
   * Elimina una categoría
   */
  async deleteCategory(id) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    // Desvincular imágenes antes de eliminar
    await GalleryImage.update(
      { categoria_id: null },
      { where: { categoria_id: id } }
    );

    await category.destroy();

    return {
      success: true,
      message: 'Categoría eliminada correctamente'
    };
  }
}

module.exports = new CategoriesService();
