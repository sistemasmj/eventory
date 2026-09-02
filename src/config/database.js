const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'gallery_db',
  username: process.env.DB_USER || 'gallery_user',
  password: process.env.DB_PASSWORD || 'password',
  
  pool: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    evict: 1000
  },
  
  dialectOptions: {
    charset: 'utf8mb4',
    connectTimeout: 60000,
    decimalNumbers: true
  },
  
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    engine: 'InnoDB'
  },
  
  timezone: '-05:00',
  retry: {
    max: 3,
    timeout: 10000
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL database connection established successfully.');
    
    const [results] = await sequelize.query('SELECT VERSION() as version');
    console.log(`📊 MySQL Version: ${results[0].version}`);
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to MySQL database:', error.message);
    console.error('📌 Verifica:');
    console.error('   - Servidor MySQL está corriendo');
    console.error('   - Credenciales correctas');
    console.error('   - Base de datos existe');
    console.error('   - Usuario tiene permisos');
    throw error;
  }
};

const syncDatabase = async (force = false) => {
  if (process.env.NODE_ENV === 'production' && force) {
    throw new Error('No se puede forzar sincronización en producción');
  }
  
  try {
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      force: force && process.env.NODE_ENV === 'development'
    });
    console.log('✅ Database synced successfully');
  } catch (error) {
    console.error('❌ Error syncing database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};