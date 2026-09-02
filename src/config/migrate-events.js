require('dotenv').config();
const { sequelize } = require('./database');

async function migrateEventsTable() {
  console.log('🚀 Iniciando migración de la tabla events...');
  try {
    const [columns] = await sequelize.query('SHOW COLUMNS FROM events');
    const existingCols = columns.map(c => c.Field);
    console.log('Columnas actuales:', existingCols);

    // 1. Modificar estado para que sea VARCHAR(50)
    await sequelize.query("ALTER TABLE events MODIFY COLUMN estado VARCHAR(50) NOT NULL DEFAULT 'En Preparación'");
    console.log('✅ Modificado estado a VARCHAR(50)');

    // 2. Modificar nombre y fecha para que sean NULLables si no se envían
    await sequelize.query('ALTER TABLE events MODIFY COLUMN nombre VARCHAR(255) NULL');
    await sequelize.query('ALTER TABLE events MODIFY COLUMN fecha DATETIME NULL');
    console.log('✅ Modificados nombre y fecha a NULLable');

    // 3. Agregar columnas que falten
    const newCols = [
      { name: 'codigo', def: 'VARCHAR(50) NULL AFTER id' },
      { name: 'tipo_ceremonia', def: 'INT NULL AFTER codigo' },
      { name: 'nombre_cliente', def: 'VARCHAR(255) NULL AFTER tipo_ceremonia' },
      { name: 'telefono', def: 'VARCHAR(50) NULL AFTER nombre_cliente' },
      { name: 'email', def: 'VARCHAR(255) NULL AFTER telefono' },
      { name: 'fecha_evento', def: 'DATE NULL AFTER email' },
      { name: 'hora_evento', def: 'VARCHAR(50) NULL AFTER fecha_evento' },
      { name: 'lugar', def: 'VARCHAR(255) NULL AFTER hora_evento' },
      { name: 'numero_invitados', def: 'INT NULL AFTER lugar' },
      { name: 'presupuesto', def: 'DECIMAL(12, 2) NULL AFTER numero_invitados' },
      { name: 'nombre_paquete', def: 'VARCHAR(255) NULL AFTER presupuesto' },
      { name: 'notas', def: 'TEXT NULL AFTER nombre_paquete' },
      { name: 'fecha_registro', def: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER notas' }
    ];

    for (const col of newCols) {
      if (!existingCols.includes(col.name)) {
        await sequelize.query(`ALTER TABLE events ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Agregada columna ${col.name}`);
      } else {
        console.log(`ℹ️ Columna ${col.name} ya existe`);
      }
    }

    // 4. Verificar índices
    const [indexes] = await sequelize.query('SHOW INDEX FROM events');
    const existingIndexes = indexes.map(i => i.Key_name);
    
    if (!existingIndexes.includes('idx_event_codigo')) {
      await sequelize.query('CREATE INDEX idx_event_codigo ON events(codigo)');
      console.log('✅ Creado índice idx_event_codigo');
    }
    if (!existingIndexes.includes('idx_event_tipo_ceremonia')) {
      await sequelize.query('CREATE INDEX idx_event_tipo_ceremonia ON events(tipo_ceremonia)');
      console.log('✅ Creado índice idx_event_tipo_ceremonia');
    }
    if (!existingIndexes.includes('idx_event_fecha_evento')) {
      await sequelize.query('CREATE INDEX idx_event_fecha_evento ON events(fecha_evento)');
      console.log('✅ Creado índice idx_event_fecha_evento');
    }
    if (!existingIndexes.includes('idx_event_nombre_cliente')) {
      await sequelize.query('CREATE INDEX idx_event_nombre_cliente ON events(nombre_cliente)');
      console.log('✅ Creado índice idx_event_nombre_cliente');
    }
    if (!existingIndexes.includes('idx_event_fecha_registro')) {
      await sequelize.query('CREATE INDEX idx_event_fecha_registro ON events(fecha_registro)');
      console.log('✅ Creado índice idx_event_fecha_registro');
    }

    const [updatedCols] = await sequelize.query('DESCRIBE events');
    console.log('\n📋 Tabla Events actualizada con éxito:');
    console.table(updatedCols);

    console.log('🎉 Migración completada correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  }
}

migrateEventsTable();
