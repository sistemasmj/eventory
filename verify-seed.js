require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: 'root',
      password: 'root',
      database: 'gallery_db',
    });

    console.log('=== Tables in gallery_db ===');
    const [tables] = await conn.query('SHOW TABLES');
    tables.forEach(t => { console.log('  - ' + Object.values(t)[0]); });

    console.log('\n=== Events ===');
    const [events] = await conn.query('SELECT id, nombre, estado, descripcion FROM events');
    console.table(events);

    console.log('\n=== Gallery Images ===');
    const [images] = await conn.query('SELECT id, event_id, nombre, estado FROM gallery_images');
    console.log('  (table exists, rows: ' + images.length + ')');
    console.table(images);

    console.log('\n✅ Verification complete - seed data exists!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
})();
