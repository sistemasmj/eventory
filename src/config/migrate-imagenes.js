require('dotenv').config();
const { sequelize } = require('./database');

async function migrateImagenesTable() {
  console.log('🚀 Iniciando migración de la tabla imagenes...');
  try {
    // 1. Crear tabla si no existe
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS imagenes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa_id INT NOT NULL,
        image_token VARCHAR(64) NOT NULL,
        orden INT NOT NULL DEFAULT 0,
        estado TINYINT NOT NULL DEFAULT 1,
        nombre_original VARCHAR(255) NULL,
        mime_type VARCHAR(50) NULL,
        size BIGINT NULL,
        width INT NULL,
        height INT NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla imagenes creada o verificada');

    // 2. Verificar y agregar columnas multimedia si no existen
    const [existingCols] = await sequelize.query('SHOW COLUMNS FROM imagenes');
    const colNames = existingCols.map(c => c.Field);

    if (!colNames.includes('tipo')) {
      await sequelize.query("ALTER TABLE imagenes ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'image' AFTER nombre_original");
      console.log("✅ Columna 'tipo' agregada a imagenes");
    }

    if (!colNames.includes('duracion')) {
      await sequelize.query("ALTER TABLE imagenes ADD COLUMN duracion FLOAT NULL AFTER tipo");
      console.log("✅ Columna 'duracion' agregada a imagenes");
    }

    if (!colNames.includes('extension')) {
      await sequelize.query("ALTER TABLE imagenes ADD COLUMN extension VARCHAR(10) NULL AFTER duracion");
      console.log("✅ Columna 'extension' agregada a imagenes");
    }

    // Asegurar que registros existentes no queden nulos en tipo
    await sequelize.query("UPDATE imagenes SET tipo = 'image' WHERE tipo IS NULL OR tipo = ''");

    // 3. Verificar índices requeridos
    const [indexes] = await sequelize.query('SHOW INDEX FROM imagenes');
    const existingIndexes = indexes.map(i => i.Key_name);

    if (!existingIndexes.includes('idx_imagenes_image_token_unique')) {
      await sequelize.query('CREATE UNIQUE INDEX idx_imagenes_image_token_unique ON imagenes(image_token)');
      console.log('✅ Creado índice UNIQUE idx_imagenes_image_token_unique');
    }

    if (!existingIndexes.includes('idx_imagenes_empresa_estado_orden')) {
      await sequelize.query('CREATE INDEX idx_imagenes_empresa_estado_orden ON imagenes(empresa_id, estado, orden)');
      console.log('✅ Creado índice compuesto idx_imagenes_empresa_estado_orden');
    }

    if (!existingIndexes.includes('idx_imagenes_empresa_id')) {
      await sequelize.query('CREATE INDEX idx_imagenes_empresa_id ON imagenes(empresa_id)');
      console.log('✅ Creado índice idx_imagenes_empresa_id');
    }

    const [columns] = await sequelize.query('DESCRIBE imagenes');
    console.log('\n📋 Estructura de la tabla imagenes:');
    console.table(columns);

    console.log('🎉 Migración de imagenes completada exitosamente.');
    if (require.main === module) process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la migración de imagenes:', err);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

if (require.main === module) {
  migrateImagenesTable();
}

module.exports = migrateImagenesTable;
