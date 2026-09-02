const { sequelize } = require('../config/database');
const Event = require('./Event');
const GalleryImage = require('./GalleryImage');
const Imagen = require('./Imagen');

// Definir relaciones (protegido contra reinicializaciones)
if (!Event.associations || !Event.associations.images) {
  Event.hasMany(GalleryImage, {
    foreignKey: {
      name: 'event_id',
      allowNull: false
    },
    as: 'images',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
}

if (!GalleryImage.associations || !GalleryImage.associations.event) {
  GalleryImage.belongsTo(Event, {
    foreignKey: {
      name: 'event_id',
      allowNull: false
    },
    as: 'event'
  });
}

// Función para sincronizar y crear índices
const syncModels = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✅ Models synchronized with MySQL');
    
    // Crear índices adicionales si no existen (compatible con MySQL 5.7+)
    try {
      const [indexes] = await sequelize.query("SHOW INDEX FROM events WHERE Key_name = 'idx_events_nombre_estado'");
      if (!indexes || indexes.length === 0) {
        await sequelize.query('CREATE INDEX idx_events_nombre_estado ON events(nombre, estado)');
      }
    } catch (err) {
      // Ignorar si ya existe
    }

    try {
      const [imgIndexes] = await sequelize.query("SHOW INDEX FROM imagenes WHERE Key_name = 'idx_imagenes_empresa_estado_orden'");
      if (!imgIndexes || imgIndexes.length === 0) {
        await sequelize.query('CREATE INDEX idx_imagenes_empresa_estado_orden ON imagenes(empresa_id, estado, orden)');
      }
    } catch (err) {
      // Ignorar si ya existe o la tabla aún no se ha creado
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error syncing models:', error);
    throw error;
  }
};

// Función para ejecutar migraciones manuales
const runMigrations = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Migrations executed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Event,
  GalleryImage,
  Imagen,
  syncModels,
  runMigrations
};