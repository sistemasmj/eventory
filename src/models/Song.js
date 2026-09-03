const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nombre de la canción ingresado por el usuario'
  },
  nombre_original: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nombre original del archivo de audio subido'
  },
  ruta_archivo: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Ruta relativa del archivo de audio en el servidor (ej: uploads/audio/cancion.mp3)'
  },
  mime_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'audio/mpeg',
    comment: 'Tipo MIME del archivo de audio'
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Tamaño del archivo en bytes'
  },
  duracion: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Duración estimada en segundos'
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activo',
    comment: 'Estado de la canción: activo, inactivo, eliminado'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Metadatos adicionales del audio'
  }
}, {
  tableName: 'songs',
  timestamps: true,
  paranoid: true, // Soft delete con deleted_at
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  indexes: [
    {
      name: 'idx_songs_estado',
      fields: ['estado']
    },
    {
      name: 'idx_songs_nombre',
      fields: ['nombre']
    }
  ]
});

module.exports = Song;
