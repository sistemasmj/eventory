const { sequelize } = require('../config/database');
const Event = require('./Event');
const GalleryImage = require('./GalleryImage');

// Definir relaciones
Event.hasMany(GalleryImage, {
  foreignKey: {
    name: 'event_id',
    allowNull: false
  },
  as: 'images',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

GalleryImage.belongsTo(Event, {
  foreignKey: {
    name: 'event_id',
    allowNull: false
  },
  as: 'event'
});

// Función para sincronizar y crear índices
const syncModels = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✅ Models synchronized with MySQL');
    
    // Crear índices adicionales si es necesario
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_events_nombre_estado ON events(nombre, estado)
    `).catch(() => {});
    
    return true;
  } catch (error) {
    console.error('❌ Error syncing models:', error);
    throw error;
  }
};

// Función para ejecutar migraciones manuales
const runMigrations = async () => {
  try {
    // Crear tablas si no existen
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
  syncModels,
  runMigrations
};