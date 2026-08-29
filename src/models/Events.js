const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre no puede estar vacío'
      },
      len: {
        args: [3, 255],
        msg: 'El nombre debe tener entre 3 y 255 caracteres'
      }
    }
  },
  estado: {
    type: DataTypes.ENUM('activo', 'inactivo', 'finalizado'),
    defaultValue: 'activo',
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'events',
  timestamps: true,
  paranoid: true, // Soft delete (deleted_at)
  underscored: true,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB',
  
  // Índices para optimizar consultas
  indexes: [
    {
      fields: ['estado'],
      name: 'idx_event_estado'
    },
    {
      fields: ['fecha'],
      name: 'idx_event_fecha'
    },
    {
      fields: ['nombre'],
      name: 'idx_event_nombre'
    },
    {
      fields: ['estado', 'fecha'],
      name: 'idx_event_estado_fecha'
    }
  ],
  
  // Hooks de MySQL
  hooks: {
    beforeCreate: (event) => {
      console.log(`📝 Creando evento: ${event.nombre}`);
    },
    beforeUpdate: (event) => {
      console.log(`📝 Actualizando evento: ${event.id}`);
    }
  }
});

module.exports = Event;