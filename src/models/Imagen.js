const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { removeImageDirectory } = require('../config/imageStorage');

const Imagen = sequelize.define('Imagen', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Identificador de la empresa propietaria'
  },
  image_token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: 'Token único y seguro de la imagen (Date.now() + random)'
  },
  orden: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Posición u orden de visualización en la galería'
  },
  estado: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    allowNull: false,
    comment: '1: activo, 0: inactivo o eliminado'
  },
  nombre_original: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nombre original del archivo subido'
  },
  mime_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Tamaño del archivo en bytes'
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'imagenes',
  timestamps: true,
  paranoid: true, // Borrado lógico (deleted_at)
  underscored: true,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB',

  // Índices de alto rendimiento para búsquedas y ordenamiento
  indexes: [
    {
      name: 'idx_imagenes_empresa_estado_orden',
      fields: ['empresa_id', 'estado', 'orden']
    },
    {
      name: 'idx_imagenes_image_token_unique',
      unique: true,
      fields: ['image_token']
    },
    {
      name: 'idx_imagenes_empresa_id',
      fields: ['empresa_id']
    }
  ],

  hooks: {
    beforeDestroy: async (imagen) => {
      // Eliminar archivos físicos asociados cuando se realiza borrado permanente
      if (imagen.empresa_id && imagen.image_token) {
        await removeImageDirectory(imagen.empresa_id, imagen.image_token);
        console.log(`🗑️ Directorio y archivos eliminados para imagen token ${imagen.image_token}`);
      }
    }
  }
});

module.exports = Imagen;
