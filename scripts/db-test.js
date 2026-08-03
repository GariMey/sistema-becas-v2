// test/db-test.js - Prueba de conexión a la base de datos

const db = require('../database/db');

async function testConnection() {
  console.log('🧪 Probando conexión a SQL Server...');
  console.log('='.repeat(50));

  try {
    // 1. Probar conexión
    console.log('📡 Intentando conectar...');
    await db.getConnection();
    console.log('✅ Conexión exitosa');

    // 2. Probar query simple
    console.log('📡 Ejecutando query de prueba...');
    const result = await db.queryOne('SELECT @@VERSION as version');
    console.log('📋 Versión de SQL Server:', result?.version || 'No disponible');

    // 3. Listar tablas
    console.log('📡 Listando tablas...');
    const tables = await db.queryAll(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_TYPE = 'BASE TABLE'"
    );
    console.log('📋 Tablas encontradas:', tables.map(t => t.TABLE_NAME).join(', ') || 'Ninguna');

    // 4. Contar usuarios
    console.log('📡 Contando usuarios...');
    const users = await db.queryOne('SELECT COUNT(*) as count FROM usuarios');
    console.log(`📋 Usuarios registrados: ${users ? users.count : 0}`);

    console.log('='.repeat(50));
    console.log('✅ Todas las pruebas pasaron correctamente');

  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    console.error('📋 Detalles:', error);
  } finally {
    await db.close();
  }
}

// Ejecutar prueba
testConnection();