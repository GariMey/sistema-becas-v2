// database/db.js - Conexión a SQL Server con manejo de errores y respaldos

const sql = require('mssql');
require('dotenv').config();

// ============================================================
// CONFIGURACIÓN DE CONEXIÓN
// ============================================================
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

// ============================================================
// CLASE DATABASE
// ============================================================
class Database {
  constructor() {
    this.pool = null;
    this.connected = false;
    this.lastConnectionAttempt = null;
    this.connectionErrors = 0;
    this.maxConnectionErrors = 5;
    this.isReconnecting = false;
  }

  /**
   * Obtiene una conexión a la base de datos
   * @returns {Promise<sql.ConnectionPool>} Pool de conexiones
   */
  async getConnection() {
    // Si ya hay una conexión activa, devolverla
    if (this.pool && this.connected) {
      try {
        // Verificar que la conexión sigue activa
        await this.pool.request().query('SELECT 1');
        this.connectionErrors = 0;
        return this.pool;
      } catch (error) {
        console.warn('⚠️ Conexión perdida, reconectando...');
        this.connected = false;
        this.pool = null;
      }
    }

    // Si hay un pool pero no está conectado, intentar reconectar
    if (this.pool) {
      try {
        await this.pool.connect();
        this.connected = true;
        this.connectionErrors = 0;
        return this.pool;
      } catch (error) {
        this.connected = false;
        this.pool = null;
        console.error('❌ Error reconectando:', error.message);
      }
    }

    // Verificar si se han superado los intentos máximos
    if (this.connectionErrors >= this.maxConnectionErrors) {
      console.error(`❌ Demasiados errores de conexión (${this.connectionErrors}/${this.maxConnectionErrors})`);
      throw new Error('No se puede conectar a la base de datos después de múltiples intentos');
    }

    // Crear nueva conexión
    try {
      console.log('🔌 Conectando a SQL Server...');
      console.log(`   📍 Servidor: ${config.server}:${config.port}`);
      console.log(`   📂 Base de datos: ${config.database}`);
      console.log(`   👤 Usuario: ${config.user}`);
      
      this.pool = await sql.connect(config);
      this.connected = true;
      this.connectionErrors = 0;
      this.lastConnectionAttempt = new Date();
      console.log('✅ Conectado a SQL Server correctamente');
      return this.pool;
    } catch (error) {
      this.connected = false;
      this.pool = null;
      this.connectionErrors++;
      this.lastConnectionAttempt = new Date();
      
      console.error('❌ Error conectando a SQL Server:', error.message);
      
      // Si es un error de autenticación, no reintentar automáticamente
      if (error.message.includes('Login failed') || error.message.includes('authentication')) {
        console.error('🔑 Error de autenticación. Verifica las credenciales.');
      }
      
      throw error;
    }
  }

  /**
   * Verifica si la base de datos está conectada
   * @returns {Promise<boolean>} Estado de conexión
   */
  async isConnected() {
    if (!this.pool || !this.connected) {
      return false;
    }

    try {
      // Verificar conexión con un query simple
      await this.pool.request().query('SELECT 1');
      return true;
    } catch (error) {
      this.connected = false;
      console.warn('⚠️ Conexión verificada como inactiva:', error.message);
      return false;
    }
  }

  /**
   * Ejecuta una consulta que devuelve múltiples filas
   * @param {string} query - Consulta SQL
   * @param {Array} params - Parámetros para la consulta
   * @returns {Promise<Array>} Resultados
   */
  async queryAll(query, params = []) {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const pool = await this.getConnection();
        const request = pool.request();
        
        // Agregar parámetros
        params.forEach((param, index) => {
          const paramName = `p${index}`;
          // Manejar diferentes tipos de datos
          if (param === null || param === undefined) {
            request.input(paramName, sql.NVarChar, null);
          } else if (typeof param === 'number') {
            request.input(paramName, sql.Int, param);
          } else if (param instanceof Date) {
            request.input(paramName, sql.DateTime, param);
          } else if (typeof param === 'boolean') {
            request.input(paramName, sql.Bit, param ? 1 : 0);
          } else {
            request.input(paramName, sql.NVarChar, param);
          }
        });

        // Reemplazar ? por @p0, @p1, etc.
        let preparedQuery = query;
        for (let i = 0; i < params.length; i++) {
          preparedQuery = preparedQuery.replace('?', `@p${i}`);
        }

        // Si la consulta usa TOP sin SELECT, agregar SELECT
        if (preparedQuery.trim().toUpperCase().startsWith('TOP')) {
          preparedQuery = `SELECT ${preparedQuery}`;
        }

        const result = await request.query(preparedQuery);
        return result.recordset || [];
      } catch (error) {
        console.error(`❌ Error en queryAll (intento ${retries + 1}/${maxRetries + 1}):`, error.message);
        console.error('📋 Query:', query);
        console.error('📋 Params:', JSON.stringify(params));
        
        // Si es un error de conexión, reintentar
        if (error.message.includes('Connection') || 
            error.message.includes('ETIMEOUT') || 
            error.message.includes('ECONNREFUSED')) {
          this.connected = false;
          this.pool = null;
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`🔄 Reintentando en 2 segundos...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw new Error('No se pudo ejecutar la consulta después de múltiples intentos');
  }

  /**
   * Ejecuta una consulta que devuelve una sola fila
   * @param {string} query - Consulta SQL
   * @param {Array} params - Parámetros para la consulta
   * @returns {Promise<Object>} Resultado
   */
  async queryOne(query, params = []) {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const pool = await this.getConnection();
        const request = pool.request();
        
        params.forEach((param, index) => {
          const paramName = `p${index}`;
          if (param === null || param === undefined) {
            request.input(paramName, sql.NVarChar, null);
          } else if (typeof param === 'number') {
            request.input(paramName, sql.Int, param);
          } else if (param instanceof Date) {
            request.input(paramName, sql.DateTime, param);
          } else if (typeof param === 'boolean') {
            request.input(paramName, sql.Bit, param ? 1 : 0);
          } else {
            request.input(paramName, sql.NVarChar, param);
          }
        });

        let preparedQuery = query;
        for (let i = 0; i < params.length; i++) {
          preparedQuery = preparedQuery.replace('?', `@p${i}`);
        }

        if (preparedQuery.trim().toUpperCase().startsWith('TOP')) {
          preparedQuery = `SELECT ${preparedQuery}`;
        }

        const result = await request.query(preparedQuery);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
      } catch (error) {
        console.error(`❌ Error en queryOne (intento ${retries + 1}/${maxRetries + 1}):`, error.message);
        console.error('📋 Query:', query);
        console.error('📋 Params:', JSON.stringify(params));
        
        if (error.message.includes('Connection') || 
            error.message.includes('ETIMEOUT') || 
            error.message.includes('ECONNREFUSED')) {
          this.connected = false;
          this.pool = null;
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`🔄 Reintentando en 2 segundos...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw new Error('No se pudo ejecutar la consulta después de múltiples intentos');
  }

  /**
   * Ejecuta una consulta de modificación (INSERT, UPDATE, DELETE)
   * @param {string} query - Consulta SQL
   * @param {Array} params - Parámetros para la consulta
   * @returns {Promise<Object>} Resultado con affectedRows y lastInsertRowid
   */
  async queryRun(query, params = []) {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const pool = await this.getConnection();
        const request = pool.request();
        
        params.forEach((param, index) => {
          const paramName = `p${index}`;
          if (param === null || param === undefined) {
            request.input(paramName, sql.NVarChar, null);
          } else if (typeof param === 'number') {
            request.input(paramName, sql.Int, param);
          } else if (param instanceof Date) {
            request.input(paramName, sql.DateTime, param);
          } else if (typeof param === 'boolean') {
            request.input(paramName, sql.Bit, param ? 1 : 0);
          } else {
            request.input(paramName, sql.NVarChar, param);
          }
        });

        let preparedQuery = query;
        for (let i = 0; i < params.length; i++) {
          preparedQuery = preparedQuery.replace('?', `@p${i}`);
        }

        // Si la consulta no tiene OUTPUT, agregar para obtener el ID
        let result;
        if (preparedQuery.trim().toUpperCase().startsWith('INSERT') && 
            !preparedQuery.toUpperCase().includes('OUTPUT')) {
          // Para SQL Server, usar SCOPE_IDENTITY()
          const insertQuery = preparedQuery;
          const identityQuery = `${insertQuery}; SELECT SCOPE_IDENTITY() as id;`;
          result = await request.query(identityQuery);
        } else {
          result = await request.query(preparedQuery);
        }
        
        return {
          affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0,
          lastInsertRowid: result.recordset && result.recordset.length > 0 ? result.recordset[0].id : null
        };
      } catch (error) {
        console.error(`❌ Error en queryRun (intento ${retries + 1}/${maxRetries + 1}):`, error.message);
        console.error('📋 Query:', query);
        console.error('📋 Params:', JSON.stringify(params));
        
        if (error.message.includes('Connection') || 
            error.message.includes('ETIMEOUT') || 
            error.message.includes('ECONNREFUSED')) {
          this.connected = false;
          this.pool = null;
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`🔄 Reintentando en 2 segundos...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw new Error('No se pudo ejecutar la consulta después de múltiples intentos');
  }

  /**
   * Ejecuta una transacción
   * @param {Function} callback - Función que recibe el cliente de transacción
   * @returns {Promise<any>} Resultado de la transacción
   */
  async transaction(callback) {
    try {
      const pool = await this.getConnection();
      const transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
      try {
        const result = await callback(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('❌ Error en transacción:', error.message);
      throw error;
    }
  }

  /**
   * Ejecuta una transacción con múltiples queries
   * @param {Array<{query: string, params: Array}>} queries - Lista de consultas
   * @returns {Promise<Array>} Resultados de las consultas
   */
  async transactionQueries(queries) {
    return this.transaction(async (transaction) => {
      const results = [];
      
      for (const q of queries) {
        const request = transaction.request();
        
        if (q.params) {
          q.params.forEach((param, index) => {
            const paramName = `p${index}`;
            if (param === null || param === undefined) {
              request.input(paramName, sql.NVarChar, null);
            } else if (typeof param === 'number') {
              request.input(paramName, sql.Int, param);
            } else if (param instanceof Date) {
              request.input(paramName, sql.DateTime, param);
            } else if (typeof param === 'boolean') {
              request.input(paramName, sql.Bit, param ? 1 : 0);
            } else {
              request.input(paramName, sql.NVarChar, param);
            }
          });
        }

        let preparedQuery = q.query;
        if (q.params) {
          for (let i = 0; i < q.params.length; i++) {
            preparedQuery = preparedQuery.replace('?', `@p${i}`);
          }
        }

        const result = await request.query(preparedQuery);
        results.push({
          query: q.query,
          affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0,
          recordset: result.recordset || []
        });
      }
      
      return results;
    });
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        this.connected = false;
        console.log('🔌 Conexión a SQL Server cerrada');
      }
    } catch (error) {
      console.error('❌ Error cerrando conexión:', error.message);
    }
  }

  /**
   * Obtiene estadísticas de conexión
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      connected: this.connected,
      poolExists: !!this.pool,
      lastConnectionAttempt: this.lastConnectionAttempt,
      connectionErrors: this.connectionErrors,
      maxConnectionErrors: this.maxConnectionErrors,
      uptime: this.lastConnectionAttempt ? Date.now() - this.lastConnectionAttempt.getTime() : 0
    };
  }
}

// ============================================================
// SINGLETON
// ============================================================
const db = new Database();

// ============================================================
// EXPORTAR
// ============================================================
module.exports = db;

// ============================================================
// FUNCIONES DE UTILIDAD PARA INICIALIZACIÓN
// ============================================================
/**
 * Inicializa la base de datos con tablas si no existen
 * @returns {Promise<boolean>} Estado de la inicialización
 */
async function initDatabase() {
  try {
    const connected = await db.isConnected();
    if (!connected) {
      console.warn('⚠️ No se puede inicializar la base de datos porque no hay conexión');
      return false;
    }

    console.log('📦 Verificando estructura de la base de datos...');

    // Crear tablas si no existen
    const tables = [
      {
        name: 'usuarios',
        create: `
          CREATE TABLE usuarios (
            id INT IDENTITY(1,1) PRIMARY KEY,
            email NVARCHAR(255) UNIQUE NOT NULL,
            password NVARCHAR(255) NOT NULL,
            nombre NVARCHAR(255) NOT NULL,
            cedula NVARCHAR(50),
            telefono NVARCHAR(50),
            direccion NVARCHAR(500),
            rol NVARCHAR(50) NOT NULL,
            intentos INT DEFAULT 0,
            bloqueado BIT DEFAULT 0,
            two_factor_enabled BIT DEFAULT 0,
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME DEFAULT GETDATE(),
            aprobado BIT DEFAULT 1,
            puedeSolicitar BIT DEFAULT 1,
            datosAcademicos NVARCHAR(MAX)
          )
        `
      },
      {
        name: 'solicitudes',
        create: `
          CREATE TABLE solicitudes (
            id INT IDENTITY(1,1) PRIMARY KEY,
            expediente NVARCHAR(50) UNIQUE NOT NULL,
            fecha DATE NOT NULL,
            estudiante_email NVARCHAR(255) NOT NULL,
            nombres NVARCHAR(255) NOT NULL,
            apellidos NVARCHAR(255) NOT NULL,
            cedula NVARCHAR(50),
            correo NVARCHAR(255),
            telefono NVARCHAR(50),
            tipo_beca NVARCHAR(100) NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Enviada',
            progreso INT DEFAULT 10,
            puntaje INT DEFAULT 0,
            promedio DECIMAL(5,2) DEFAULT 0,
            ingreso_familiar DECIMAL(12,2) DEFAULT 0,
            datos_completos NVARCHAR(MAX),
            documentos NVARCHAR(MAX),
            aceptado BIT DEFAULT 0,
            porcentaje_cobertura NVARCHAR(50),
            observacion_ts NVARCHAR(MAX),
            observaciones_comite NVARCHAR(MAX),
            motivo_rechazo NVARCHAR(MAX),
            suspension_motivo NVARCHAR(MAX),
            suspension_observaciones NVARCHAR(MAX),
            suspension_fecha DATETIME,
            restaurado_fecha DATETIME,
            fecha_aprobacion DATE,
            fecha_rechazo DATE,
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (estudiante_email) REFERENCES usuarios(email)
          )
        `
      },
      {
        name: 'tipos_beca',
        create: `
          CREATE TABLE tipos_beca (
            id INT IDENTITY(1,1) PRIMARY KEY,
            nombre NVARCHAR(100) NOT NULL,
            icon NVARCHAR(10) DEFAULT '🎓',
            description NVARCHAR(500),
            min_pct INT DEFAULT 25,
            max_pct INT DEFAULT 100,
            rubros NVARCHAR(MAX),
            requisitos NVARCHAR(MAX),
            campos_personalizados NVARCHAR(MAX),
            activo BIT DEFAULT 1,
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'convocatorias',
        create: `
          CREATE TABLE convocatorias (
            id INT IDENTITY(1,1) PRIMARY KEY,
            nombre NVARCHAR(200) NOT NULL,
            tipo NVARCHAR(100) NOT NULL,
            cupos INT NOT NULL,
            fecha_apertura DATE NOT NULL,
            hora_apertura TIME DEFAULT '08:00',
            fecha_cierre DATE NOT NULL,
            hora_cierre TIME DEFAULT '17:00',
            estado NVARCHAR(50) DEFAULT 'Borrador',
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'noticias',
        create: `
          CREATE TABLE noticias (
            id INT IDENTITY(1,1) PRIMARY KEY,
            titulo NVARCHAR(200) NOT NULL,
            contenido NVARCHAR(MAX) NOT NULL,
            fecha_publicacion DATE NOT NULL,
            fecha DATE NOT NULL,
            fecha_edicion DATE,
            created_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'bitacora',
        create: `
          CREATE TABLE bitacora (
            id INT IDENTITY(1,1) PRIMARY KEY,
            fecha DATETIME NOT NULL,
            usuario NVARCHAR(255) NOT NULL,
            rol NVARCHAR(50) NOT NULL,
            accion NVARCHAR(MAX) NOT NULL,
            expediente NVARCHAR(50),
            detalle NVARCHAR(MAX),
            created_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'documentos',
        create: `
          CREATE TABLE documentos (
            id INT IDENTITY(1,1) PRIMARY KEY,
            solicitud_id INT NOT NULL,
            expediente NVARCHAR(50) NOT NULL,
            doc_key NVARCHAR(100) NOT NULL,
            label NVARCHAR(200),
            nombre NVARCHAR(255),
            tipo NVARCHAR(100),
            tamano BIGINT,
            fecha DATETIME,
            datos VARBINARY(MAX),
            estado NVARCHAR(50) DEFAULT 'Pendiente',
            observacion NVARCHAR(MAX),
            created_at DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
          )
        `
      },
      {
        name: 'justificaciones',
        create: `
          CREATE TABLE justificaciones (
            id INT IDENTITY(1,1) PRIMARY KEY,
            estudiante_email NVARCHAR(255) NOT NULL,
            nombre_estudiante NVARCHAR(255) NOT NULL,
            curso NVARCHAR(200) NOT NULL,
            codigo NVARCHAR(50),
            periodo NVARCHAR(50) NOT NULL,
            nota DECIMAL(5,2),
            motivo NVARCHAR(MAX) NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Pendiente',
            observacion NVARCHAR(MAX),
            archivo VARBINARY(MAX),
            fecha DATETIME NOT NULL,
            created_at DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (estudiante_email) REFERENCES usuarios(email)
          )
        `
      },
      {
        name: 'apelaciones',
        create: `
          CREATE TABLE apelaciones (
            id INT IDENTITY(1,1) PRIMARY KEY,
            expediente NVARCHAR(50) NOT NULL,
            email NVARCHAR(255) NOT NULL,
            nombre_estudiante NVARCHAR(255) NOT NULL,
            motivo NVARCHAR(MAX) NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Pendiente',
            fecha DATETIME NOT NULL,
            decision NVARCHAR(50),
            archivo VARBINARY(MAX),
            created_at DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (email) REFERENCES usuarios(email)
          )
        `
      },
      {
        name: 'suspensiones',
        create: `
          CREATE TABLE suspensiones (
            id INT IDENTITY(1,1) PRIMARY KEY,
            email NVARCHAR(255) NOT NULL,
            expediente NVARCHAR(50),
            tipo NVARCHAR(50) NOT NULL,
            dias NVARCHAR(50),
            motivo NVARCHAR(MAX) NOT NULL,
            observaciones NVARCHAR(MAX) NOT NULL,
            fecha DATETIME NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Activa',
            evidencia VARBINARY(MAX),
            nombre_estudiante NVARCHAR(255),
            created_at DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (email) REFERENCES usuarios(email)
          )
        `
      },
      {
        name: 'visitas',
        create: `
          CREATE TABLE visitas (
            id INT IDENTITY(1,1) PRIMARY KEY,
            expediente NVARCHAR(50) NOT NULL,
            fecha DATE NOT NULL,
            condiciones NVARCHAR(MAX) NOT NULL,
            coincide NVARCHAR(50),
            archivo VARBINARY(MAX),
            nombre_estudiante NVARCHAR(255),
            fecha_registro DATETIME NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Pendiente',
            metadata NVARCHAR(500),
            created_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'config',
        create: `
          CREATE TABLE config (
            id INT IDENTITY(1,1) PRIMARY KEY,
            [key] NVARCHAR(100) UNIQUE NOT NULL,
            value NVARCHAR(MAX) NOT NULL,
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME DEFAULT GETDATE()
          )
        `
      },
      {
        name: 'alertas_seguridad',
        create: `
          CREATE TABLE alertas_seguridad (
            id INT IDENTITY(1,1) PRIMARY KEY,
            tipo NVARCHAR(50) NOT NULL,
            descripcion NVARCHAR(MAX) NOT NULL,
            fecha DATETIME NOT NULL,
            estado NVARCHAR(50) DEFAULT 'Pendiente',
            created_at DATETIME DEFAULT GETDATE()
          )
        `
      }
    ];

    for (const table of tables) {
      try {
        // Verificar si la tabla existe
        const checkResult = await db.queryOne(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = ?`,
          [table.name]
        );
        
        if (!checkResult || checkResult.count === 0) {
          console.log(`   📋 Creando tabla: ${table.name}`);
          await db.queryRun(table.create);
        } else {
          console.log(`   ✅ Tabla ${table.name} existe`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Error verificando/creando tabla ${table.name}:`, error.message);
      }
    }

    // Insertar datos iniciales si no existen
    console.log('📦 Verificando datos iniciales...');

    // Verificar tipos de beca
    const tiposCount = await db.queryOne('SELECT COUNT(*) as count FROM tipos_beca');
    if (!tiposCount || tiposCount.count === 0) {
      console.log('   📋 Insertando tipos de beca iniciales...');
      await db.queryRun(`
        INSERT INTO tipos_beca (nombre, icon, description, min_pct, max_pct, rubros, requisitos, activo)
        VALUES 
          ('Socioeconómica', '💰', 'Apoyo financiero para estudiantes con recursos limitados', 25, 100, '["Matrícula","Aranceles","Materiales"]', '["Promedio mínimo 80","Ingreso familiar máximo 2 salarios mínimos"]', 1),
          ('Excelencia Académica', '🎓', 'Para estudiantes con promedio destacado', 50, 100, '["Matrícula","Aranceles"]', '["Promedio mínimo 90","Sin sanciones disciplinarias"]', 1),
          ('Deportiva', '⚽', 'Para estudiantes con alto rendimiento deportivo', 25, 75, '["Matrícula"]', '["Promedio mínimo 80","Representación universitaria"]', 1),
          ('Cultural', '🎭', 'Artes, música, teatro', 25, 75, '["Matrícula"]', '["Promedio mínimo 80","Portafolio artístico"]', 1),
          ('Investigación', '🔬', 'Para asistentes de investigación', 25, 75, '["Matrícula","Estipendio"]', '["Promedio mínimo 85","Proyecto de investigación activo"]', 1)
      `);
    }

    // Verificar configuración inicial
    const configCount = await db.queryOne('SELECT COUNT(*) as count FROM config');
    if (!configCount || configCount.count === 0) {
      console.log('   📋 Insertando configuración inicial...');
      await db.queryRun(`
        INSERT INTO config ([key], value) VALUES
          ('socio', '40'),
          ('academico', '35'),
          ('vulnerabilidad', '15'),
          ('meritos', '10'),
          ('promedioMin', '80'),
          ('ingresoMax', '500000'),
          ('plazoSubsanacion', '5'),
          ('plazoApelacion', '10'),
          ('plazoRenovacion', '15'),
          ('msgAprobacion', 'Felicidades, tu solicitud de beca ha sido APROBADA.'),
          ('msgRechazo', 'Lamentamos informarte que tu solicitud ha sido RECHAZADA.'),
          ('msgSubsanacion', 'Tu solicitud requiere correcciones. Revisa los documentos pendientes.')
      `);
    }

    console.log('✅ Base de datos inicializada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    return false;
  }
}

// ============================================================
// EXPORTAR FUNCIONES DE UTILIDAD
// ============================================================
module.exports.initDatabase = initDatabase;