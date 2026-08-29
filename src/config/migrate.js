require('dotenv').config();
const { sequelize, syncModels, runMigrations } = require('../models');
const { testConnection } = require('./database');

async function migrate() {
  console.log('🚀 Iniciando migración a MySQL...');
  
  try {
    // Verificar conexión
    await testConnection();
    
    // Sincronizar modelos
    await syncModels({ alter: true });
    
    console.log('✅ Migración completada exitosamente');
    console.log('📊 Base de datos lista para usar');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrate();