const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
    comment: 'Identificador único autoincremental de la categoría'
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Descripción o nombre de la categoría'
  },
  estado: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    defaultValue: 'S',
    validate: {
      isIn: [['S', 'N']]
    },
    comment: 'Estado de la categoría: S (Activo) / N (Inactivo)'
  }
}, {
  tableName: 'categorias',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_categorias_estado',
      fields: ['estado']
    },
    {
      name: 'idx_categorias_descripcion',
      fields: ['descripcion']
    }
  ]
});

module.exports = Category;
