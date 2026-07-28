const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

async function getConnection() {
  try {
    if (pool) {
      // Verificar si la conexión sigue activa
      try {
        await pool.request().query('SELECT 1');
        return pool;
      } catch (e) {
        pool = null;
      }
    }
    
    console.log('🔄 Conectando a SQL Server...');
    pool = await sql.connect(config);
    console.log('✅ Conectado a SQL Server');
    return pool;
  } catch (err) {
    console.error('❌ Error conectando a SQL Server:', err.message);
    throw err;
  }
}

async function query(queryString, params = []) {
  const pool = await getConnection();
  const request = pool.request();
  
  // Agregar parámetros
  params.forEach((param, index) => {
    request.input(`p${index}`, param);
  });
  
  // Reemplazar ? por @p0, @p1, etc.
  let sqlQuery = queryString;
  let paramIndex = 0;
  sqlQuery = sqlQuery.replace(/\?/g, () => `@p${paramIndex++}`);
  
  try {
    const result = await request.query(sqlQuery);
    return result;
  } catch (err) {
    console.error('❌ Error en query:', err.message);
    console.error('Query:', sqlQuery);
    throw err;
  }
}

async function queryOne(queryString, params = []) {
  const result = await query(queryString, params);
  return result.recordset[0] || null;
}

async function queryAll(queryString, params = []) {
  const result = await query(queryString, params);
  return result.recordset || [];
}

async function queryRun(queryString, params = []) {
  const result = await query(queryString, params);
  return {
    lastInsertRowid: result.recordset && result.recordset.length > 0 ? result.recordset[0].id : null,
    changes: result.rowsAffected ? result.rowsAffected[0] : 0
  };
}

async function transaction(callback) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

function close() {
  if (pool) {
    pool.close();
    pool = null;
    console.log('🔒 Conexión a SQL Server cerrada');
  }
}

module.exports = {
  getConnection,
  query,
  queryOne,
  queryAll,
  queryRun,
  transaction,
  close,
  sql
};