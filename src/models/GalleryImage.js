const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { uploadRoot } = require('../config/uploads');

const GalleryImage = sequelize.define('GalleryImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  categoria_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categorias',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  nombre_original: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  ruta_raw: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  ruta_temp: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ruta_thumb: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(20),
    defaultValue: 'image',
    allowNull: false
  },
  duracion: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  ruta_poster: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  extension: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  estado: {
    type: DataTypes.ENUM('activo', 'inactivo', 'eliminado'),
    defaultValue: 'activo',
    allowNull: false
  },
  fecha_subida: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  orden: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    comment: 'Versión incremental del medio para cache busting'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'gallery_images',
  timestamps: true,
  paranoid: true,
  underscored: true,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB',
  
  // Índices optimizados para consultas frecuentes
  indexes: [
    {
      fields: ['event_id'],
      name: 'idx_image_event'
    },
    {
      fields: ['estado'],
      name: 'idx_image_estado'
    },
    {
      fields: ['fecha_subida'],
      name: 'idx_image_fecha'
    },
    {
      fields: ['event_id', 'orden'],
      name: 'idx_image_event_orden'
    },
    {
      fields: ['event_id', 'estado'],
      name: 'idx_image_event_estado'
    },
    {
      fields: ['event_id', 'estado', 'orden'],
      name: 'idx_image_composite'
    }
  ],
  
  hooks: {
    beforeDestroy: async (image) => {
      const deleteSafe = async (filePath) => {
        if (!filePath) return;
        try {
          const cleanPath = filePath.replace(/^uploads[\\/]/, '').replace(/[\\/]/g, path.sep);
          const fullPath = path.join(uploadRoot, cleanPath);
          await fs.unlink(fullPath);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`❌ Error eliminando archivo físico ${filePath}:`, error.message);
          }
        }
      };

      await deleteSafe(image.ruta_raw);
      await deleteSafe(image.ruta_temp);
      await deleteSafe(image.ruta_thumb);
      if (image.ruta_poster) {
        await deleteSafe(image.ruta_poster);
      }
      console.log(`🗑️ Archivo y registro eliminados para medio ${image.id}`);
    },
    afterCreate: (image) => {
      console.log(`📸 Imagen creada: ${image.nombre} (${image.id})`);
    },
    afterUpdate: (image) => {
      console.log(`📸 Imagen actualizada: ${image.id}`);
    }
  }
});

module.exports = GalleryImage;