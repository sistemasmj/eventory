const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  codigo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  tipo_ceremonia: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  nombre_cliente: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      customEmailValidator(value) {
        if (value && value.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error('El formato de email no es válido');
          }
        }
      }
    }
  },
  fecha_evento: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  hora_evento: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  lugar: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  numero_invitados: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  presupuesto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  nombre_paquete: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cancion_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID de la canción seleccionada para la secuencia del evento'
  },
  estado: {
    type: DataTypes.STRING(50),
    defaultValue: 'En Preparación',
    allowNull: false
  },
  fecha_registro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  // Campos de compatibilidad
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
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
      fields: ['codigo'],
      name: 'idx_event_codigo'
    },
    {
      fields: ['estado'],
      name: 'idx_event_estado'
    },
    {
      fields: ['tipo_ceremonia'],
      name: 'idx_event_tipo_ceremonia'
    },
    {
      fields: ['fecha_evento'],
      name: 'idx_event_fecha_evento'
    },
    {
      fields: ['nombre_cliente'],
      name: 'idx_event_nombre_cliente'
    },
    {
      fields: ['fecha_registro'],
      name: 'idx_event_fecha_registro'
    }
  ],
  
  // Hooks de MySQL
  hooks: {
    beforeCreate: (event) => {
      if (!event.nombre && event.nombre_cliente) {
        event.nombre = event.nombre_cliente;
      }
      if (!event.fecha && event.fecha_evento) {
        event.fecha = new Date(event.fecha_evento);
      }
      if (!event.descripcion && event.notas) {
        event.descripcion = event.notas;
      }
      console.log(`📝 Creando evento: ${event.nombre_cliente || event.nombre || 'Nuevo Evento'}`);
    },
    beforeUpdate: (event) => {
      console.log(`📝 Actualizando evento: ${event.id}`);
    }
  }
});

module.exports = Event;