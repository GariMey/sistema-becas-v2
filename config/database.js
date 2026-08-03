// config/database.js - Configuración de base de datos

require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

function validateConfig() {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ Variables de entorno faltantes: ${missing.join(', ')}`);
    console.warn('💡 El sistema funcionará en modo offline con datos de respaldo');
    return false;
  }

  return true;
}

module.exports = {
  config,
  validateConfig
};