require('dotenv').config();
const { sequelize, Event, GalleryImage } = require('../models');
const { testConnection } = require('./database');

async function seedDatabase() {
  console.log('🌱 Sembrando datos de prueba...');
  
  try {
    await testConnection();
    await sequelize.sync({ force: true });
    
    // Crear eventos de prueba
    const events = await Event.bulkCreate([
      {
        nombre: 'Boda de Ana y Carlos',
        fecha: new Date('2024-12-15'),
        estado: 'activo',
        descripcion: 'Celebración de bodas en la playa'
      },
      {
        nombre: 'Graduación 2024',
        fecha: new Date('2024-06-20'),
        estado: 'activo',
        descripcion: 'Ceremonia de graduación universitaria'
      },
      {
        nombre: 'Cumpleaños de María',
        fecha: new Date('2024-08-10'),
        estado: 'inactivo',
        descripcion: 'Fiesta de cumpleaños número 30'
      }
    ]);
    
    console.log(`✅ Creados ${events.length} eventos de prueba`);
    
    console.log('📊 Datos de prueba sembrados exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error sembrando datos:', error);
    process.exit(1);
  }
}

seedDatabase();