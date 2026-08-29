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
    });
    console.log('Connected as root');
    await conn.query("GRANT REFERENCES ON *.* TO 'admindb'@'%'");
    await conn.query('FLUSH PRIVILEGES');
    console.log('REFERENCES privilege granted');
    const [rows] = await conn.query("SHOW GRANTS FOR 'admindb'@'%'");
    rows.forEach(r => { console.log('  ' + r); });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
})();
