require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixPrivileges() {
  const rootPassword = process.argv[2] || 'root';
  let connection;
  try {
    // Connect as root
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: 'root',
      password: rootPassword,
    });

    console.log('✅ Connected as root');

    // Show current grants for admindb
    const [grants] = await connection.query("SHOW GRANTS FOR 'admindb'@'%'");
    console.log('\n📋 Current grants for admindb@% :');
    grants.forEach(g => console.log('  -', g['Grants for admindb@%']));

        // Check if REFERENCES privilege is missing
    const hasReferences = grants.some(g => {
      const grantStr = g['Grants for admindb@%'];
      return grantStr.includes('REFERENCES');
    });

    if (!hasReferences) {
      console.log('\n🔧 Granting REFERENCES privilege to admindb...');
      await connection.query("GRANT REFERENCES ON *.* TO 'admindb'@'%'");
      await connection.query('FLUSH PRIVILEGES');
      console.log('✅ REFERENCES privilege granted successfully!');
    } else {
      console.log('\n✅ REFERENCES privilege already present');
    }

    // Verify the grants after
    const [newGrants] = await connection.query("SHOW GRANTS FOR 'admindb'@'%'");
    console.log('\n📋 Updated grants for admindb@% :');
    newGrants.forEach(g => console.log('  -', g['Grants for admindb@%']));

    await connection.end();
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

fixPrivileges();
