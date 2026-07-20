const db = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function cifrarPassword(pwd) {
  return bcrypt.hashSync(pwd, 10);
}

async function initDatabase() {
  console.log('🗄️ Inicializando base de datos SQL Server...');
  
  try {
    const pool = await db.getConnection();
    
    console.log('📋 Creando tablas...');
    
    // =====================================================
    // CREAR TABLAS
    // =====================================================
    
    // Tabla usuarios
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usuarios' AND xtype='U')
      CREATE TABLE usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) UNIQUE NOT NULL,
        password NVARCHAR(255) NOT NULL,
        rol NVARCHAR(50) NOT NULL DEFAULT 'estudiante',
        nombre NVARCHAR(255) NOT NULL,
        intentos INT DEFAULT 0,
        bloqueado BIT DEFAULT 0,
        two_factor_enabled BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla tipos_beca
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tipos_beca' AND xtype='U')
      CREATE TABLE tipos_beca (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NOT NULL,
        icon NVARCHAR(50) DEFAULT '🎓',
        description NVARCHAR(500),
        min_pct INT DEFAULT 25,
        max_pct INT DEFAULT 100,
        rubros NVARCHAR(MAX) DEFAULT '[]',
        requisitos NVARCHAR(MAX) DEFAULT '[]',
        activo BIT DEFAULT 1,
        campos_personalizados NVARCHAR(MAX) DEFAULT '[]',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla solicitudes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='solicitudes' AND xtype='U')
      CREATE TABLE solicitudes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) UNIQUE NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        estudiante_email NVARCHAR(255) NOT NULL,
        nombres NVARCHAR(255) NOT NULL,
        apellidos NVARCHAR(255) NOT NULL,
        cedula NVARCHAR(50),
        correo NVARCHAR(255),
        telefono NVARCHAR(50),
        tipo_beca NVARCHAR(255) NOT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Enviada',
        progreso INT DEFAULT 10,
        puntaje INT DEFAULT 0,
        promedio FLOAT DEFAULT 0,
        ingreso_familiar FLOAT DEFAULT 0,
        datos_completos NVARCHAR(MAX) DEFAULT '{}',
        aceptado BIT DEFAULT 0,
        porcentaje_cobertura NVARCHAR(50),
        observacion_ts NVARCHAR(MAX),
        observaciones_comite NVARCHAR(MAX),
        motivo_rechazo NVARCHAR(MAX),
        suspension_motivo NVARCHAR(MAX),
        suspension_observaciones NVARCHAR(MAX),
        suspension_fecha NVARCHAR(50),
        restaurado_fecha NVARCHAR(50),
        fecha_cierre NVARCHAR(50),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla documentos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='documentos' AND xtype='U')
      CREATE TABLE documentos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        solicitud_id INT NOT NULL,
        doc_key NVARCHAR(50) NOT NULL,
        label NVARCHAR(255),
        nombre NVARCHAR(255),
        tipo NVARCHAR(100),
        tamano INT,
        fecha NVARCHAR(50),
        datos NVARCHAR(MAX),
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        observacion NVARCHAR(MAX) DEFAULT '',
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
      )
    `);

    // Tabla noticias
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='noticias' AND xtype='U')
      CREATE TABLE noticias (
        id INT IDENTITY(1,1) PRIMARY KEY,
        titulo NVARCHAR(255) NOT NULL,
        contenido NVARCHAR(MAX) NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        fecha_edicion NVARCHAR(50),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla justificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='justificaciones' AND xtype='U')
      CREATE TABLE justificaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        estudiante_email NVARCHAR(255) NOT NULL,
        nombre_estudiante NVARCHAR(255),
        curso NVARCHAR(255) NOT NULL,
        codigo NVARCHAR(50),
        periodo NVARCHAR(50) NOT NULL,
        nota FLOAT,
        motivo NVARCHAR(MAX) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        observacion NVARCHAR(MAX) DEFAULT '',
        fecha NVARCHAR(50) NOT NULL,
        archivo NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla apelaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='apelaciones' AND xtype='U')
      CREATE TABLE apelaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        nombre_estudiante NVARCHAR(255),
        motivo NVARCHAR(MAX) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        fecha NVARCHAR(50) NOT NULL,
        decision NVARCHAR(MAX),
        archivo NVARCHAR(MAX),
        tipo_beca NVARCHAR(255),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla suspensiones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='suspensiones' AND xtype='U')
      CREATE TABLE suspensiones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        expediente NVARCHAR(50),
        tipo NVARCHAR(50) NOT NULL,
        dias NVARCHAR(50),
        motivo NVARCHAR(MAX) NOT NULL,
        observaciones NVARCHAR(MAX),
        fecha NVARCHAR(50) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Activa',
        evidencia NVARCHAR(MAX),
        nombre_estudiante NVARCHAR(255),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla visitas
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='visitas' AND xtype='U')
      CREATE TABLE visitas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        condiciones NVARCHAR(MAX),
        coincide NVARCHAR(50),
        archivo NVARCHAR(MAX),
        fecha_registro NVARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla convocatorias
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='convocatorias' AND xtype='U')
      CREATE TABLE convocatorias (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NOT NULL,
        tipo NVARCHAR(255) NOT NULL,
        cupos INT DEFAULT 10,
        fecha_apertura NVARCHAR(50) NOT NULL,
        fecha_cierre NVARCHAR(50) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Borrador',
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla empleados
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='empleados' AND xtype='U')
      CREATE TABLE empleados (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NOT NULL,
        departamento NVARCHAR(255),
        cargo NVARCHAR(255),
        correo NVARCHAR(255),
        telefono NVARCHAR(50),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla config (CORREGIDA - key es palabra reservada)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='config' AND xtype='U')
      CREATE TABLE config (
        [key] NVARCHAR(255) PRIMARY KEY,
        value NVARCHAR(MAX) NOT NULL
      )
    `);

    // Tabla bitacora
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bitacora' AND xtype='U')
      CREATE TABLE bitacora (
        id INT IDENTITY(1,1) PRIMARY KEY,
        fecha NVARCHAR(50) NOT NULL,
        usuario NVARCHAR(255) NOT NULL,
        rol NVARCHAR(50) DEFAULT 'visitante',
        accion NVARCHAR(MAX) NOT NULL,
        expediente NVARCHAR(50) DEFAULT '—',
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla alertas_seguridad
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='alertas_seguridad' AND xtype='U')
      CREATE TABLE alertas_seguridad (
        id INT IDENTITY(1,1) PRIMARY KEY,
        fecha NVARCHAR(50) NOT NULL,
        tipo NVARCHAR(50) DEFAULT 'Baja',
        descripcion NVARCHAR(MAX) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Tabla borrador_solicitud
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='borrador_solicitud' AND xtype='U')
      CREATE TABLE borrador_solicitud (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_email NVARCHAR(255),
        datos NVARCHAR(MAX) DEFAULT '{}',
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('✅ Tablas creadas correctamente');

    // =====================================================
    // INSERTAR DATOS DE PRUEBA
    // =====================================================
    console.log('📥 Insertando datos de prueba...');

    // Insertar usuarios
    const usuarios = [
      ['estudiante@becas.com', cifrarPassword('123456'), 'estudiante', 'María Gómez'],
      ['estudiante2@becas.com', cifrarPassword('123456'), 'estudiante', 'José Ramírez'],
      ['estudiante3@becas.com', cifrarPassword('123456'), 'estudiante', 'Ana López'],
      ['social@becas.com', cifrarPassword('123456'), 'trabajador_social', 'Carlos Rodríguez'],
      ['comite@becas.com', cifrarPassword('123456'), 'comite', 'Dra. Ana Méndez'],
      ['admin@becas.com', cifrarPassword('123456'), 'admin', 'Admin Sistema'],
      ['auditor@becas.com', cifrarPassword('123456'), 'auditor', 'Luis Fernández']
    ];

    for (const u of usuarios) {
      await pool.request()
        .input('email', u[0])
        .input('password', u[1])
        .input('rol', u[2])
        .input('nombre', u[3])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = @email)
          INSERT INTO usuarios (email, password, rol, nombre)
          VALUES (@email, @password, @rol, @nombre)
        `);
    }
    console.log('✅ Usuarios insertados');

    // =====================================================
    // INSERTAR TIPOS DE BECA (SIN ID EXPLÍCITO)
    // =====================================================
    const tipos = [
      ['Socioeconómica', '💰', 'Apoyo financiero para estudiantes con recursos limitados', 25, 100, 
       JSON.stringify(['Matrícula', 'Aranceles', 'Materiales']),
       JSON.stringify(['Promedio mínimo 80', 'Ingreso familiar máximo 2 salarios mínimos']), 1, '[]'],
      ['Excelencia Académica', '🎓', 'Para estudiantes con promedio destacado', 50, 100,
       JSON.stringify(['Matrícula', 'Aranceles']),
       JSON.stringify(['Promedio mínimo 90', 'Sin sanciones disciplinarias']), 1,
       JSON.stringify([
         { id: 'f-publicaciones', label: 'Publicaciones o investigaciones', type: 'textarea' }
       ])],
      ['Deportiva', '⚽', 'Para estudiantes con alto rendimiento deportivo', 25, 75,
       JSON.stringify(['Matrícula']),
       JSON.stringify(['Promedio mínimo 80', 'Representación universitaria']), 1, '[]'],
      ['Cultural', '🎭', 'Artes, música, teatro', 25, 75,
       JSON.stringify(['Matrícula']),
       JSON.stringify(['Promedio mínimo 80', 'Portafolio artístico']), 1, '[]'],
      ['Discapacidad', '♿', 'Apoyo para estudiantes con discapacidad certificada', 50, 100,
       JSON.stringify(['Matrícula', 'Aranceles', 'Materiales']),
       JSON.stringify(['Promedio mínimo 80', 'Certificado médico vigente']), 1, '[]'],
      ['Investigación', '🔬', 'Para asistentes de investigación', 25, 75,
       JSON.stringify(['Matrícula', 'Estipendio']),
       JSON.stringify(['Promedio mínimo 85', 'Proyecto de investigación activo']), 1, '[]']
    ];

    for (const t of tipos) {
      await pool.request()
        .input('nombre', t[0])
        .input('icon', t[1])
        .input('description', t[2])
        .input('min_pct', t[3])
        .input('max_pct', t[4])
        .input('rubros', t[5])
        .input('requisitos', t[6])
        .input('activo', t[7])
        .input('campos', t[8])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM tipos_beca WHERE nombre = @nombre)
          INSERT INTO tipos_beca (nombre, icon, description, min_pct, max_pct, rubros, requisitos, activo, campos_personalizados)
          VALUES (@nombre, @icon, @description, @min_pct, @max_pct, @rubros, @requisitos, @activo, @campos)
        `);
    }
    console.log('✅ Tipos de beca insertados');

    // =====================================================
    // INSERTAR CONFIGURACIÓN
    // =====================================================
    const configs = [
      ['socio', '40'], ['academico', '35'], ['vulnerabilidad', '15'], ['meritos', '10'],
      ['promedioMin', '80'], ['ingresoMax', '500000'],
      ['plazoSubsanacion', '5'], ['plazoApelacion', '10'], ['plazoRenovacion', '15'],
      ['msgAprobacion', 'Felicidades, tu solicitud de beca ha sido APROBADA.'],
      ['msgRechazo', 'Lamentamos informarte que tu solicitud ha sido RECHAZADA.'],
      ['msgSubsanacion', 'Tu solicitud requiere correcciones. Revisa los documentos pendientes.']
    ];

    for (const c of configs) {
      await pool.request()
        .input('key', c[0])
        .input('value', c[1])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM config WHERE [key] = @key)
          INSERT INTO config ([key], value) VALUES (@key, @value)
        `);
    }
    console.log('✅ Configuración insertada');

    // =====================================================
    // INSERTAR CONVOCATORIAS (SIN ID EXPLÍCITO)
    // =====================================================
    const hoy = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const apertura = new Date(hoy.getTime() - 10 * 86400000);
    const cierre = new Date(hoy.getTime() + 20 * 86400000);

    const convocatorias = [
      ['Beca Socioeconómica 2026-I', 'Socioeconómica', 20, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca de Excelencia Académica 2026-I', 'Excelencia Académica', 10, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Cultural 2025-II', 'Cultural', 5, fmt(new Date(hoy.getTime() - 60 * 86400000)), fmt(new Date(hoy.getTime() - 30 * 86400000)), 'Borrador']
    ];

    for (const c of convocatorias) {
      await pool.request()
        .input('nombre', c[0])
        .input('tipo', c[1])
        .input('cupos', c[2])
        .input('fecha_apertura', c[3])
        .input('fecha_cierre', c[4])
        .input('estado', c[5])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM convocatorias WHERE nombre = @nombre)
          INSERT INTO convocatorias (nombre, tipo, cupos, fecha_apertura, fecha_cierre, estado)
          VALUES (@nombre, @tipo, @cupos, @fecha_apertura, @fecha_cierre, @estado)
        `);
    }
    console.log('✅ Convocatorias insertadas');

    // Insertar noticias
    await pool.request()
      .input('titulo', 'Convocatoria 2026 abierta')
      .input('contenido', 'Ya están disponibles las becas para el período 2026. Fecha límite: 31/03/2026')
      .input('fecha', '15/01/2026')
      .query(`
        IF NOT EXISTS (SELECT 1 FROM noticias WHERE titulo = @titulo)
        INSERT INTO noticias (titulo, contenido, fecha) VALUES (@titulo, @contenido, @fecha)
      `);
    console.log('✅ Noticias insertadas');

    // Insertar empleados (SIN ID EXPLÍCITO)
    const empleados = [
      ['Dra. Laura Chaves', 'Oficina de Becas', 'Coordinadora de Becas', 'laura.chaves@becas.ac.cr', '2200-1001'],
      ['M.Sc. Roberto Jiménez', 'Registro Académico', 'Analista de Expedientes', 'roberto.jimenez@becas.ac.cr', '2200-1002'],
      ['Lic. Marcela Solano', 'Finanzas', 'Tesorera', 'marcela.solano@becas.ac.cr', '2200-1003'],
      ['Dr. Carlos Montero', 'Comité de Becas', 'Miembro del Comité', 'carlos.montero@becas.ac.cr', '2200-1004']
    ];

    for (const e of empleados) {
      await pool.request()
        .input('nombre', e[0])
        .input('departamento', e[1])
        .input('cargo', e[2])
        .input('correo', e[3])
        .input('telefono', e[4])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM empleados WHERE nombre = @nombre AND correo = @correo)
          INSERT INTO empleados (nombre, departamento, cargo, correo, telefono)
          VALUES (@nombre, @departamento, @cargo, @correo, @telefono)
        `);
    }
    console.log('✅ Empleados insertados');

    console.log('🎉 Base de datos inicializada correctamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    process.exit(1);
  }
}

initDatabase();