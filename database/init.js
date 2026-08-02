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
    
    // 1. Tabla usuarios (COMPLETA)
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
        updated_at DATETIME DEFAULT GETDATE(),
        cedula NVARCHAR(20) NULL,
        fecha_nacimiento NVARCHAR(20) NULL,
        direccion NVARCHAR(500) NULL,
        telefono NVARCHAR(50) NULL,
        info_padron NVARCHAR(MAX) NULL,
        aprobado BIT DEFAULT 1,
        puede_solicitar BIT DEFAULT 1,
        cargo NVARCHAR(255) NULL,
        departamento NVARCHAR(255) NULL
      )
    `);

    // 2. Tabla tipos_beca
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
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 3. Tabla solicitudes (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='solicitudes' AND xtype='U')
      CREATE TABLE solicitudes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) UNIQUE NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        estudiante_email NVARCHAR(255) NOT NULL,
        nombres NVARCHAR(255) NOT NULL,
        apellidos NVARCHAR(255) NOT NULL,
        cedula NVARCHAR(50) NULL,
        correo NVARCHAR(255) NULL,
        telefono NVARCHAR(50) NULL,
        tipo_beca NVARCHAR(255) NOT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Enviada',
        progreso INT DEFAULT 10,
        puntaje INT DEFAULT 0,
        promedio FLOAT DEFAULT 0,
        ingreso_familiar FLOAT DEFAULT 0,
        datos_completos NVARCHAR(MAX) DEFAULT '{}',
        aceptado BIT DEFAULT 0,
        porcentaje_cobertura NVARCHAR(50) NULL,
        observacion_ts NVARCHAR(MAX) NULL,
        observaciones_comite NVARCHAR(MAX) NULL,
        motivo_rechazo NVARCHAR(MAX) NULL,
        suspension_motivo NVARCHAR(MAX) NULL,
        suspension_observaciones NVARCHAR(MAX) NULL,
        suspension_fecha NVARCHAR(50) NULL,
        restaurado_fecha NVARCHAR(50) NULL,
        fecha_cierre NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        documentos NVARCHAR(MAX) DEFAULT '{}',
        historial NVARCHAR(MAX) DEFAULT '[]',
        fecha_nacimiento NVARCHAR(50) NULL,
        carrera NVARCHAR(255) NULL,
        sede NVARCHAR(255) NULL,
        facultad NVARCHAR(255) NULL,
        ano_ingreso NVARCHAR(50) NULL,
        avance_curricular NVARCHAR(50) NULL,
        dependientes_economicos INT DEFAULT 0,
        miembros_trabajan INT DEFAULT 0,
        tipo_vivienda NVARCHAR(100) NULL,
        gastos_mensuales FLOAT DEFAULT 0,
        situacion_laboral NVARCHAR(255) NULL,
        discapacidad BIT DEFAULT 0,
        beca_anterior BIT DEFAULT 0,
        justificacion_merito NVARCHAR(MAX) NULL,
        ingreso_percapita FLOAT DEFAULT 0,
        fecha_aprobacion NVARCHAR(50) NULL,
        fecha_rechazo NVARCHAR(50) NULL
      )
    `);

    // 4. Tabla documentos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='documentos' AND xtype='U')
      CREATE TABLE documentos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        solicitud_id INT NULL,
        doc_key NVARCHAR(50) NULL,
        label NVARCHAR(150) NULL,
        nombre NVARCHAR(255) NULL,
        tipo NVARCHAR(100) NULL,
        tamano INT NULL,
        fecha NVARCHAR(50) NULL,
        datos NVARCHAR(MAX) NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        observacion NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 5. Tabla integrantes_familia
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='integrantes_familia' AND xtype='U')
      CREATE TABLE integrantes_familia (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        nombre_completo NVARCHAR(255) NULL,
        edad INT NULL,
        estudia BIT DEFAULT 0,
        trabaja BIT DEFAULT 0,
        salario_mensual FLOAT DEFAULT 0,
        tiene_transporte BIT DEFAULT 0,
        casa_propia BIT DEFAULT 0,
        vivienda_nombre_propio BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 6. Tabla visitas (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='visitas' AND xtype='U')
      CREATE TABLE visitas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        condiciones NVARCHAR(MAX) NULL,
        coincide NVARCHAR(50) NULL,
        archivo NVARCHAR(MAX) NULL,
        fecha_registro NVARCHAR(50) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        created_at DATETIME DEFAULT GETDATE(),
        nombreEstudiante VARCHAR(200) NULL,
        evidencia_fecha NVARCHAR(50) NULL,
        evidencia_hora NVARCHAR(20) NULL,
        evidencia_cedula NVARCHAR(20) NULL,
        metadata NVARCHAR(MAX) NULL
      )
    `);

    // 7. Tabla suspensiones (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='suspensiones' AND xtype='U')
      CREATE TABLE suspensiones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        expediente NVARCHAR(50) NULL,
        tipo NVARCHAR(50) NOT NULL,
        dias NVARCHAR(50) NULL,
        motivo NVARCHAR(MAX) NOT NULL,
        observaciones NVARCHAR(MAX) NULL,
        fecha NVARCHAR(50) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Activa',
        evidencia NVARCHAR(MAX) NULL,
        nombre_estudiante NVARCHAR(255) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 8. Tabla apelaciones (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='apelaciones' AND xtype='U')
      CREATE TABLE apelaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        nombre_estudiante NVARCHAR(255) NULL,
        motivo NVARCHAR(MAX) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        fecha NVARCHAR(50) NOT NULL,
        decision NVARCHAR(MAX) NULL,
        archivo NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 9. Tabla justificaciones (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='justificaciones' AND xtype='U')
      CREATE TABLE justificaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        estudiante_email NVARCHAR(255) NOT NULL,
        nombre_estudiante NVARCHAR(255) NULL,
        curso NVARCHAR(255) NOT NULL,
        codigo NVARCHAR(50) NULL,
        periodo NVARCHAR(50) NOT NULL,
        nota FLOAT NULL,
        motivo NVARCHAR(MAX) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'Pendiente',
        observacion NVARCHAR(MAX) DEFAULT '',
        fecha NVARCHAR(50) NOT NULL,
        archivo NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 10. Tabla convocatorias (COMPLETA)
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
        created_at DATETIME DEFAULT GETDATE(),
        hora_apertura NVARCHAR(5) DEFAULT '00:00',
        hora_cierre NVARCHAR(5) DEFAULT '23:59'
      )
    `);

    // 11. Tabla noticias (COMPLETA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='noticias' AND xtype='U')
      CREATE TABLE noticias (
        id INT IDENTITY(1,1) PRIMARY KEY,
        titulo NVARCHAR(255) NOT NULL,
        contenido NVARCHAR(MAX) NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        fecha_edicion NVARCHAR(50) NULL,
        fecha_publicacion NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 12. Tabla notificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notificaciones' AND xtype='U')
      CREATE TABLE notificaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_email NVARCHAR(255) NOT NULL,
        titulo NVARCHAR(255) NOT NULL,
        mensaje NVARCHAR(MAX) NULL,
        tipo NVARCHAR(20) DEFAULT 'info',
        leida BIT DEFAULT 0,
        expediente NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 13. Tabla bitacora
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

    // 14. Tabla empleados
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='empleados' AND xtype='U')
      CREATE TABLE empleados (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NOT NULL,
        departamento NVARCHAR(255) NULL,
        cargo NVARCHAR(255) NULL,
        correo NVARCHAR(255) NULL,
        telefono NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 15. Tabla alertas_seguridad
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

    // 16. Tabla config
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='config' AND xtype='U')
      CREATE TABLE config (
        [key] NVARCHAR(255) PRIMARY KEY,
        value NVARCHAR(MAX) NOT NULL
      )
    `);

    // 17. Tabla borrador_solicitud
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='borrador_solicitud' AND xtype='U')
      CREATE TABLE borrador_solicitud (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_email NVARCHAR(255) NULL,
        datos NVARCHAR(MAX) DEFAULT '{}',
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 18. Tabla chatbot_preguntas
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='chatbot_preguntas' AND xtype='U')
      CREATE TABLE chatbot_preguntas (
        id_pregunta INT IDENTITY(1,1) PRIMARY KEY,
        pregunta NVARCHAR(MAX) NOT NULL,
        respuesta NVARCHAR(MAX) NOT NULL,
        categoria NVARCHAR(100) NULL,
        activa BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // 19. Tabla miembros_comite (NUEVA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='miembros_comite' AND xtype='U')
      CREATE TABLE miembros_comite (
        id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id INT NOT NULL,
        rol_en_comite NVARCHAR(100) DEFAULT 'Miembro',
        activo BIT DEFAULT 1,
        fecha_agregado DATETIME DEFAULT GETDATE()
      )
    `);

    // 20. Tabla votaciones (NUEVA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='votaciones' AND xtype='U')
      CREATE TABLE votaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        fecha_inicio DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_cierre DATETIME NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'En curso',
        resultado NVARCHAR(50) NULL
      )
    `);

    // 21. Tabla votos (NUEVA)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='votos' AND xtype='U')
      CREATE TABLE votos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        votacion_id INT NOT NULL,
        miembro_comite_id INT NOT NULL,
        decision NVARCHAR(20) NULL,
        observacion NVARCHAR(MAX) NULL,
        fecha_voto DATETIME DEFAULT GETDATE()
      )
    `);

    // 22. Tabla votaciones_comite (deprecada - compatibilidad)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='votaciones_comite' AND xtype='U')
      CREATE TABLE votaciones_comite (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        id_miembro_comite INT NOT NULL,
        decision NVARCHAR(20) NOT NULL,
        observaciones NVARCHAR(MAX) NULL,
        porcentaje_cobertura NVARCHAR(10) NULL,
        fecha_voto DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('✅ Tablas creadas correctamente');

    // =====================================================
    // CREAR ÍNDICES
    // =====================================================
    console.log('📋 Creando índices...');

    // Índices para solicitudes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_solicitudes_estudiante_email' AND object_id = OBJECT_ID('solicitudes'))
      CREATE NONCLUSTERED INDEX idx_solicitudes_estudiante_email ON solicitudes (estudiante_email)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_solicitudes_estado' AND object_id = OBJECT_ID('solicitudes'))
      CREATE NONCLUSTERED INDEX idx_solicitudes_estado ON solicitudes (estado)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_solicitudes_expediente' AND object_id = OBJECT_ID('solicitudes'))
      CREATE NONCLUSTERED INDEX idx_solicitudes_expediente ON solicitudes (expediente)
    `);

    // Índices para documentos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_documentos_expediente' AND object_id = OBJECT_ID('documentos'))
      CREATE NONCLUSTERED INDEX idx_documentos_expediente ON documentos (expediente)
    `);

    // Índices para visitas
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_visitas_expediente' AND object_id = OBJECT_ID('visitas'))
      CREATE NONCLUSTERED INDEX idx_visitas_expediente ON visitas (expediente)
    `);

    // Índices para suspensiones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_suspensiones_expediente' AND object_id = OBJECT_ID('suspensiones'))
      CREATE NONCLUSTERED INDEX idx_suspensiones_expediente ON suspensiones (expediente)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_suspensiones_email' AND object_id = OBJECT_ID('suspensiones'))
      CREATE NONCLUSTERED INDEX idx_suspensiones_email ON suspensiones (email)
    `);

    // Índices para apelaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_apelaciones_expediente' AND object_id = OBJECT_ID('apelaciones'))
      CREATE NONCLUSTERED INDEX idx_apelaciones_expediente ON apelaciones (expediente)
    `);

    // Índices para justificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_justificaciones_estudiante_email' AND object_id = OBJECT_ID('justificaciones'))
      CREATE NONCLUSTERED INDEX idx_justificaciones_estudiante_email ON justificaciones (estudiante_email)
    `);

    // Índices para notificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_notificaciones_usuario' AND object_id = OBJECT_ID('notificaciones'))
      CREATE NONCLUSTERED INDEX idx_notificaciones_usuario ON notificaciones (usuario_email)
    `);

    // Índices para bitácora
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_bitacora_fecha' AND object_id = OBJECT_ID('bitacora'))
      CREATE NONCLUSTERED INDEX idx_bitacora_fecha ON bitacora (fecha DESC)
    `);

    // Índices para convocatorias
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_convocatorias_fecha_apertura' AND object_id = OBJECT_ID('convocatorias'))
      CREATE NONCLUSTERED INDEX idx_convocatorias_fecha_apertura ON convocatorias (fecha_apertura)
    `);

    // Índices para miembros_comite
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_miembros_comite_usuario_id' AND object_id = OBJECT_ID('miembros_comite'))
      CREATE NONCLUSTERED INDEX idx_miembros_comite_usuario_id ON miembros_comite (usuario_id)
    `);

    // Índices para votaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_votaciones_expediente' AND object_id = OBJECT_ID('votaciones'))
      CREATE NONCLUSTERED INDEX idx_votaciones_expediente ON votaciones (expediente)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_votaciones_estado' AND object_id = OBJECT_ID('votaciones'))
      CREATE NONCLUSTERED INDEX idx_votaciones_estado ON votaciones (estado)
    `);

    // Índices para votos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_votos_votacion_id' AND object_id = OBJECT_ID('votos'))
      CREATE NONCLUSTERED INDEX idx_votos_votacion_id ON votos (votacion_id)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_votos_miembro_comite_id' AND object_id = OBJECT_ID('votos'))
      CREATE NONCLUSTERED INDEX idx_votos_miembro_comite_id ON votos (miembro_comite_id)
    `);

    // Índice único para solicitudes activas
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UX_solicitudes_una_beca_activa' AND object_id = OBJECT_ID('solicitudes'))
      CREATE UNIQUE NONCLUSTERED INDEX UX_solicitudes_una_beca_activa ON solicitudes (estudiante_email) WHERE (estado IN ('Aprobada', 'Beneficio Activo'))
    `);

    console.log('✅ Índices creados correctamente');

    // =====================================================
    // CREAR FOREIGN KEYS
    // =====================================================
    console.log('📋 Creando relaciones (FOREIGN KEYS)...');

    // Relaciones de solicitudes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_solicitudes_usuarios')
      ALTER TABLE solicitudes ADD CONSTRAINT FK_solicitudes_usuarios FOREIGN KEY (estudiante_email) REFERENCES usuarios(email)
    `);

    // Relaciones de documentos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_documentos_solicitudes')
      ALTER TABLE documentos ADD CONSTRAINT FK_documentos_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);

    // Relaciones de integrantes_familia
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_integrantes_familia_solicitudes')
      ALTER TABLE integrantes_familia ADD CONSTRAINT FK_integrantes_familia_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);

    // Relaciones de visitas
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_visitas_solicitudes')
      ALTER TABLE visitas ADD CONSTRAINT FK_visitas_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);

    // Relaciones de suspensiones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_suspensiones_solicitudes')
      ALTER TABLE suspensiones ADD CONSTRAINT FK_suspensiones_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_suspensiones_usuarios')
      ALTER TABLE suspensiones ADD CONSTRAINT FK_suspensiones_usuarios FOREIGN KEY (email) REFERENCES usuarios(email)
    `);

    // Relaciones de apelaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_apelaciones_solicitudes')
      ALTER TABLE apelaciones ADD CONSTRAINT FK_apelaciones_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_apelaciones_usuarios')
      ALTER TABLE apelaciones ADD CONSTRAINT FK_apelaciones_usuarios FOREIGN KEY (email) REFERENCES usuarios(email)
    `);

    // Relaciones de justificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_justificaciones_usuarios')
      ALTER TABLE justificaciones ADD CONSTRAINT FK_justificaciones_usuarios FOREIGN KEY (estudiante_email) REFERENCES usuarios(email)
    `);

    // Relaciones de notificaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_notificaciones_usuarios')
      ALTER TABLE notificaciones ADD CONSTRAINT FK_notificaciones_usuarios FOREIGN KEY (usuario_email) REFERENCES usuarios(email)
    `);

    // Relaciones de borrador_solicitud
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_borrador_usuarios')
      ALTER TABLE borrador_solicitud ADD CONSTRAINT FK_borrador_usuarios FOREIGN KEY (session_email) REFERENCES usuarios(email)
    `);

    // Relaciones de miembros_comite
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_miembros_comite_usuarios')
      ALTER TABLE miembros_comite ADD CONSTRAINT FK_miembros_comite_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    `);

    // Relaciones de votaciones
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_votaciones_solicitudes')
      ALTER TABLE votaciones ADD CONSTRAINT FK_votaciones_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);

    // Relaciones de votos
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_votos_votaciones')
      ALTER TABLE votos ADD CONSTRAINT FK_votos_votaciones FOREIGN KEY (votacion_id) REFERENCES votaciones(id)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_votos_miembros_comite')
      ALTER TABLE votos ADD CONSTRAINT FK_votos_miembros_comite FOREIGN KEY (miembro_comite_id) REFERENCES miembros_comite(id)
    `);

    // Relaciones de votaciones_comite
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_votaciones_comite_solicitudes')
      ALTER TABLE votaciones_comite ADD CONSTRAINT FK_votaciones_comite_solicitudes FOREIGN KEY (expediente) REFERENCES solicitudes(expediente)
    `);

    console.log('✅ Foreign Keys creados correctamente');

    // =====================================================
    // INSERTAR DATOS DE PRUEBA
    // =====================================================
    console.log('📥 Insertando datos de prueba...');

    // ---- 1. USUARIOS ----
    console.log('📌 Insertando usuarios...');
    const usuarios = [
      ['estudiante@becas.com', cifrarPassword('123456'), 'estudiante', 'María Gómez', '1-2345-6789', '8888-1111', 'San José, Montes de Oca, Sabanilla', 1, 1],
      ['estudiante2@becas.com', cifrarPassword('123456'), 'estudiante', 'José Ramírez', '2-3456-7890', '8888-2222', 'Alajuela, San Ramón', 1, 1],
      ['estudiante3@becas.com', cifrarPassword('123456'), 'estudiante', 'Ana López', '3-4567-8901', '8888-3333', 'Cartago, Paraíso', 1, 1],
      ['estudiante4@becas.com', cifrarPassword('123456'), 'estudiante', 'Carlos Méndez', '4-5678-9012', '8888-4444', 'Heredia, San Pablo', 1, 1],
      ['estudiante5@becas.com', cifrarPassword('123456'), 'estudiante', 'Laura Fernández', '5-6789-0123', '8888-5555', 'Puntarenas, Esparza', 1, 1],
      ['social@becas.com', cifrarPassword('123456'), 'trabajador_social', 'Carlos Rodríguez', '6-7890-1234', '8888-6666', 'San José, Central', 1, 0],
      ['social2@becas.com', cifrarPassword('123456'), 'trabajador_social', 'Ana Martínez', '7-8901-2345', '8888-7777', 'San José, Curridabat', 1, 0],
      ['comite@becas.com', cifrarPassword('123456'), 'comite', 'Dra. Ana Méndez', '8-9012-3456', '8888-8888', 'San José, Escazú', 1, 0],
      ['comite2@becas.com', cifrarPassword('123456'), 'comite', 'Dr. Roberto Jiménez', '9-0123-4567', '8888-9999', 'San José, Santa Ana', 1, 0],
      ['carlos.montero@becas.com', cifrarPassword('123456'), 'comite', 'Dr. Carlos Montero', '7-8901-2345', '8888-7777', 'Cartago, Cartago', 1, 0],
      ['laura.chaves@becas.com', cifrarPassword('123456'), 'comite', 'Dra. Laura Chaves', '8-9012-3456', '8888-8888', 'Heredia, Heredia', 1, 0],
      ['admin@becas.com', cifrarPassword('123456'), 'admin', 'Admin Sistema', '1-2345-6789', '8888-0000', 'San José, Central', 1, 0],
      ['auditor@becas.com', cifrarPassword('123456'), 'auditor', 'Luis Fernández', '9-0123-4567', '8888-9999', 'San José, San Pedro', 1, 0]
    ];

    for (const u of usuarios) {
      await pool.request()
        .input('email', u[0])
        .input('password', u[1])
        .input('rol', u[2])
        .input('nombre', u[3])
        .input('cedula', u[4])
        .input('telefono', u[5])
        .input('direccion', u[6])
        .input('aprobado', u[7])
        .input('puede_solicitar', u[8])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = @email)
          INSERT INTO usuarios (email, password, rol, nombre, intentos, bloqueado, two_factor_enabled, cedula, telefono, direccion, aprobado, puede_solicitar)
          VALUES (@email, @password, @rol, @nombre, 0, 0, 0, @cedula, @telefono, @direccion, @aprobado, @puede_solicitar)
        `);
    }
    console.log('✅ Usuarios insertados (' + usuarios.length + ' registros)');

    // ---- 2. MIEMBROS DEL COMITÉ ----
    console.log('📌 Insertando miembros del comité...');
    // Obtener IDs de usuarios del comité
    const miembrosData = [
      ['comite@becas.com', 'Presidenta', 1],
      ['comite2@becas.com', 'Vocal', 1],
      ['carlos.montero@becas.com', 'Vocal', 1],
      ['laura.chaves@becas.com', 'Vocal', 1]
    ];

    for (const m of miembrosData) {
      const result = await pool.request()
        .input('email', m[0])
        .query('SELECT id FROM usuarios WHERE email = @email');
      
      if (result.recordset.length > 0) {
        const usuarioId = result.recordset[0].id;
        await pool.request()
          .input('usuario_id', usuarioId)
          .input('rol_en_comite', m[1])
          .input('activo', m[2])
          .query(`
            IF NOT EXISTS (SELECT 1 FROM miembros_comite WHERE usuario_id = @usuario_id)
            INSERT INTO miembros_comite (usuario_id, rol_en_comite, activo)
            VALUES (@usuario_id, @rol_en_comite, @activo)
          `);
      }
    }
    console.log('✅ Miembros del comité insertados (' + miembrosData.length + ' registros)');

    // ---- 3. TIPOS DE BECA ----
    console.log('📌 Insertando tipos de beca...');
    const tipos = [
      ['Socioeconómica', '💰', 'Apoyo financiero para estudiantes con recursos limitados', 25, 100, '["Matrícula", "Aranceles", "Materiales"]', '["Promedio mínimo 80", "Ingreso familiar máximo 2 salarios mínimos"]', 1],
      ['Excelencia Académica', '🎓', 'Para estudiantes con promedio destacado', 50, 100, '["Matrícula", "Aranceles"]', '["Promedio mínimo 90", "Sin sanciones disciplinarias"]', 1],
      ['Deportiva', '⚽', 'Para estudiantes con alto rendimiento deportivo', 25, 75, '["Matrícula"]', '["Promedio mínimo 80"]', 1],
      ['Cultural', '🎭', 'Artes, música, teatro', 25, 75, '["Matrícula"]', '["Promedio mínimo 80"]', 1],
      ['Investigación', '🔬', 'Para asistentes de investigación', 25, 75, '["Matrícula", "Estipendio"]', '["Promedio mínimo 85", "Proyecto de investigación activo"]', 1]
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
        .query(`
          IF NOT EXISTS (SELECT 1 FROM tipos_beca WHERE nombre = @nombre)
          INSERT INTO tipos_beca (nombre, icon, description, min_pct, max_pct, rubros, requisitos, activo)
          VALUES (@nombre, @icon, @description, @min_pct, @max_pct, @rubros, @requisitos, @activo)
        `);
    }
    console.log('✅ Tipos de beca insertados (' + tipos.length + ' registros)');

    // ---- 4. CONFIGURACIÓN ----
    console.log('📌 Insertando configuración...');
    const configs = [
      ['socio', '40'], ['academico', '35'], ['vulnerabilidad', '15'], ['meritos', '10'],
      ['promedioMin', '80'], ['ingresoMax', '500000'],
      ['plazoSubsanacion', '5'], ['plazoApelacion', '10'], ['plazoRenovacion', '15'],
      ['msgAprobacion', 'Felicidades, tu solicitud de beca ha sido APROBADA. El beneficio se activará en tu matrícula.'],
      ['msgRechazo', 'Lamentamos informarte que tu solicitud ha sido RECHAZADA. Puedes solicitar una revisión dentro de los próximos 10 días hábiles.'],
      ['msgSubsanacion', 'Tu solicitud requiere correcciones. Revisa los documentos pendientes y completa la información faltante dentro del plazo establecido de 5 días hábiles.']
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
    console.log('✅ Configuración insertada (' + configs.length + ' registros)');

    // ---- 5. NOTICIAS ----
    console.log('📌 Insertando noticias...');
    const noticias = [
      ['Convocatoria 2026 abierta', 'Ya están disponibles las becas para el período 2026. Las solicitudes se recibirán hasta el 31 de marzo de 2026.', CONVERT(nvarchar(50), GETDATE(), 103), CONVERT(nvarchar(50), GETDATE(), 23)],
      ['Plazo de subsanación extendido', 'Se extiende el plazo de subsanación de documentos hasta el 15 de abril de 2026.', CONVERT(nvarchar(50), GETDATE(), 103), CONVERT(nvarchar(50), GETDATE(), 23)],
      ['Nuevas becas de investigación', 'Se abre convocatoria para becas de investigación con un estipendio mensual de ₡300,000.', CONVERT(nvarchar(50), GETDATE(), 103), CONVERT(nvarchar(50), GETDATE(), 23)]
    ];

    for (const n of noticias) {
      await pool.request()
        .input('titulo', n[0])
        .input('contenido', n[1])
        .input('fecha', n[2])
        .input('fecha_publicacion', n[3])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM noticias WHERE titulo = @titulo)
          INSERT INTO noticias (titulo, contenido, fecha, fecha_publicacion)
          VALUES (@titulo, @contenido, @fecha, @fecha_publicacion)
        `);
    }
    console.log('✅ Noticias insertadas (' + noticias.length + ' registros)');

    // ---- 6. EMPLEADOS ----
    console.log('📌 Insertando empleados...');
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
          IF NOT EXISTS (SELECT 1 FROM empleados WHERE correo = @correo)
          INSERT INTO empleados (nombre, departamento, cargo, correo, telefono)
          VALUES (@nombre, @departamento, @cargo, @correo, @telefono)
        `);
    }
    console.log('✅ Empleados insertados (' + empleados.length + ' registros)');

    // ---- 7. SOLICITUDES ----
    console.log('📌 Insertando solicitudes...');
    const solicitudes = [
      {
        expediente: 'BEC-2026-001',
        fecha: '2026-01-15',
        estudiante_email: 'estudiante@becas.com',
        nombres: 'María',
        apellidos: 'Gómez',
        cedula: '1-2345-6789',
        correo: 'estudiante@becas.com',
        telefono: '8888-1111',
        tipo_beca: 'Excelencia Académica',
        estado: 'Beneficio Activo',
        progreso: 100,
        puntaje: 95,
        promedio: 92,
        ingreso_familiar: 450000,
        aceptado: 1,
        porcentaje_cobertura: '75%',
        observacion_ts: 'Documentación completa. Visita realizada y condiciones verificadas.',
        observaciones_comite: 'Aprobada por unanimidad. Excelente perfil académico.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Medicina', 'f-sede': 'Central', 'f-facultad': 'Ciencias de la Salud' })
      },
      {
        expediente: 'BEC-2026-002',
        fecha: '2026-06-20',
        estudiante_email: 'estudiante2@becas.com',
        nombres: 'José',
        apellidos: 'Ramírez',
        cedula: '2-3456-7890',
        correo: 'estudiante2@becas.com',
        telefono: '8888-2222',
        tipo_beca: 'Socioeconómica',
        estado: 'En revisión TS',
        progreso: 50,
        puntaje: 0,
        promedio: 85,
        ingreso_familiar: 350000,
        aceptado: 0,
        observacion_ts: 'Pendiente de visita domiciliaria.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Ingeniería en Sistemas', 'f-sede': 'Central', 'f-facultad': 'Ingeniería' })
      },
      {
        expediente: 'BEC-2026-003',
        fecha: '2026-07-01',
        estudiante_email: 'estudiante3@becas.com',
        nombres: 'Ana',
        apellidos: 'López',
        cedula: '3-4567-8901',
        correo: 'estudiante3@becas.com',
        telefono: '8888-3333',
        tipo_beca: 'Excelencia Académica',
        estado: 'En revisión TS',
        progreso: 50,
        puntaje: 0,
        promedio: 94,
        ingreso_familiar: 280000,
        aceptado: 0,
        observacion_ts: 'Pendiente de verificación de documentación.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Derecho', 'f-sede': 'Central', 'f-facultad': 'Ciencias Sociales' })
      },
      {
        expediente: 'BEC-2026-004',
        fecha: '2026-07-10',
        estudiante_email: 'estudiante4@becas.com',
        nombres: 'Carlos',
        apellidos: 'Méndez',
        cedula: '4-5678-9012',
        correo: 'estudiante4@becas.com',
        telefono: '8888-4444',
        tipo_beca: 'Deportiva',
        estado: 'Enviada',
        progreso: 20,
        puntaje: 0,
        promedio: 82,
        ingreso_familiar: 420000,
        aceptado: 0,
        datos_completos: JSON.stringify({ 'f-carrera': 'Administración', 'f-sede': 'Occidente', 'f-facultad': 'Ciencias Sociales' })
      },
      {
        expediente: 'BEC-2026-005',
        fecha: '2026-07-15',
        estudiante_email: 'estudiante5@becas.com',
        nombres: 'Laura',
        apellidos: 'Fernández',
        cedula: '5-6789-0123',
        correo: 'estudiante5@becas.com',
        telefono: '8888-5555',
        tipo_beca: 'Cultural',
        estado: 'Pendiente subsanación',
        progreso: 30,
        puntaje: 0,
        promedio: 88,
        ingreso_familiar: 320000,
        aceptado: 0,
        observacion_ts: 'Documentación incompleta. Se requiere subsanación.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Arquitectura', 'f-sede': 'Atlántica', 'f-facultad': 'Arquitectura y Diseño' })
      },
      {
        expediente: 'BEC-2026-006',
        fecha: '2026-07-20',
        estudiante_email: 'estudiante@becas.com',
        nombres: 'María',
        apellidos: 'Gómez',
        cedula: '1-2345-6789',
        correo: 'estudiante@becas.com',
        telefono: '8888-1111',
        tipo_beca: 'Investigación',
        estado: 'En comité',
        progreso: 80,
        puntaje: 88,
        promedio: 91,
        ingreso_familiar: 450000,
        aceptado: 0,
        observacion_ts: 'Visita realizada. Documentación completa.',
        observaciones_comite: 'En evaluación por el comité.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Medicina', 'f-sede': 'Central', 'f-facultad': 'Ciencias de la Salud' })
      },
      {
        expediente: 'BEC-2026-007',
        fecha: '2026-08-01',
        estudiante_email: 'estudiante2@becas.com',
        nombres: 'José',
        apellidos: 'Ramírez',
        cedula: '2-3456-7890',
        correo: 'estudiante2@becas.com',
        telefono: '8888-2222',
        tipo_beca: 'Investigación',
        estado: 'Aprobada',
        progreso: 100,
        puntaje: 90,
        promedio: 88,
        ingreso_familiar: 350000,
        aceptado: 1,
        porcentaje_cobertura: '50%',
        observacion_ts: 'Visita realizada exitosamente.',
        observaciones_comite: 'Aprobada por el comité. Buen perfil investigativo.',
        datos_completos: JSON.stringify({ 'f-carrera': 'Ingeniería en Sistemas', 'f-sede': 'Central', 'f-facultad': 'Ingeniería' })
      },
      {
        expediente: 'BEC-2026-008',
        fecha: '2026-08-05',
        estudiante_email: 'estudiante3@becas.com',
        nombres: 'Ana',
        apellidos: 'López',
        cedula: '3-4567-8901',
        correo: 'estudiante3@becas.com',
        telefono: '8888-3333',
        tipo_beca: 'Socioeconómica',
        estado: 'Rechazada',
        progreso: 60,
        puntaje: 0,
        promedio: 76,
        ingreso_familiar: 520000,
        aceptado: 0,
        observacion_ts: 'Visita realizada. No cumple requisitos de ingreso.',
        motivo_rechazo: 'Ingreso familiar supera el límite establecido',
        datos_completos: JSON.stringify({ 'f-carrera': 'Derecho', 'f-sede': 'Central', 'f-facultad': 'Ciencias Sociales' })
      }
    ];

    for (const s of solicitudes) {
      await pool.request()
        .input('expediente', s.expediente)
        .input('fecha', s.fecha)
        .input('estudiante_email', s.estudiante_email)
        .input('nombres', s.nombres)
        .input('apellidos', s.apellidos)
        .input('cedula', s.cedula || null)
        .input('correo', s.correo || null)
        .input('telefono', s.telefono || null)
        .input('tipo_beca', s.tipo_beca)
        .input('estado', s.estado)
        .input('progreso', s.progreso)
        .input('puntaje', s.puntaje)
        .input('promedio', s.promedio)
        .input('ingreso_familiar', s.ingreso_familiar)
        .input('aceptado', s.aceptado)
        .input('porcentaje_cobertura', s.porcentaje_cobertura || null)
        .input('observacion_ts', s.observacion_ts || null)
        .input('observaciones_comite', s.observaciones_comite || null)
        .input('motivo_rechazo', s.motivo_rechazo || null)
        .input('datos_completos', s.datos_completos)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM solicitudes WHERE expediente = @expediente)
          INSERT INTO solicitudes (
            expediente, fecha, estudiante_email, nombres, apellidos, cedula, correo, telefono,
            tipo_beca, estado, progreso, puntaje, promedio, ingreso_familiar, aceptado,
            porcentaje_cobertura, observacion_ts, observaciones_comite, motivo_rechazo,
            datos_completos
          ) VALUES (
            @expediente, @fecha, @estudiante_email, @nombres, @apellidos, @cedula, @correo, @telefono,
            @tipo_beca, @estado, @progreso, @puntaje, @promedio, @ingreso_familiar, @aceptado,
            @porcentaje_cobertura, @observacion_ts, @observaciones_comite, @motivo_rechazo,
            @datos_completos
          )
        `);
    }
    console.log('✅ Solicitudes insertadas (' + solicitudes.length + ' registros)');

    // ---- 8. VISITAS ----
    console.log('📌 Insertando visitas...');
    const visitas = [
      ['BEC-2026-001', '2026-07-15', 'Vivienda en buen estado, familia presente, condiciones económicas estables.', 'Sí', 'María Gómez', '2026-07-15 14:30:00', 'Realizada'],
      ['BEC-2026-002', '2026-07-20', 'Vivienda modesta, familia numerosa (5 miembros), ingreso limitado.', 'Sí', 'José Ramírez', '2026-07-20 10:15:00', 'Realizada'],
      ['BEC-2026-003', '2026-07-25', 'Vivienda en zona rural, acceso limitado a servicios básicos.', 'Parcialmente', 'Ana López', '2026-07-25 16:45:00', 'Realizada'],
      ['BEC-2026-006', '2026-08-01', 'Vivienda en alquiler, buen estado, familia con 2 dependientes económicos.', 'Sí', 'María Gómez', '2026-08-01 09:30:00', 'Realizada'],
      ['BEC-2026-005', '2026-08-10', 'Pendiente de realizar', 'Pendiente', 'Laura Fernández', '2026-08-10 13:20:00', 'Pendiente']
    ];

    for (const v of visitas) {
      await pool.request()
        .input('expediente', v[0])
        .input('fecha', v[1])
        .input('condiciones', v[2])
        .input('coincide', v[3])
        .input('nombreEstudiante', v[4])
        .input('fecha_registro', v[5])
        .input('estado', v[6])
        .query(`
          INSERT INTO visitas (expediente, fecha, condiciones, coincide, nombreEstudiante, fecha_registro, estado)
          VALUES (@expediente, @fecha, @condiciones, @coincide, @nombreEstudiante, @fecha_registro, @estado)
        `);
    }
    console.log('✅ Visitas insertadas (' + visitas.length + ' registros)');

    // ---- 9. JUSTIFICACIONES ----
    console.log('📌 Insertando justificaciones...');
    const justificaciones = [
      ['estudiante@becas.com', 'María Gómez', 'Matemática I', 'MA-1001', 'I-2026', 65, 'Problemas de salud durante el periodo de exámenes.', 'Pendiente', '', '2026-07-15 14:30:00'],
      ['estudiante2@becas.com', 'José Ramírez', 'Física I', 'FI-1001', 'I-2026', 58, 'Fallecimiento de un familiar cercano.', 'Aprobada', 'Justificación aceptada.', '2026-07-20 10:15:00'],
      ['estudiante3@becas.com', 'Ana López', 'Química I', 'QU-1001', 'I-2026', 70, 'Problemas económicos que me obligaron a trabajar tiempo completo.', 'Pendiente', '', '2026-07-25 16:45:00']
    ];

    for (const j of justificaciones) {
      await pool.request()
        .input('estudiante_email', j[0])
        .input('nombre_estudiante', j[1])
        .input('curso', j[2])
        .input('codigo', j[3])
        .input('periodo', j[4])
        .input('nota', j[5])
        .input('motivo', j[6])
        .input('estado', j[7])
        .input('observacion', j[8])
        .input('fecha', j[9])
        .query(`
          INSERT INTO justificaciones (estudiante_email, nombre_estudiante, curso, codigo, periodo, nota, motivo, estado, observacion, fecha)
          VALUES (@estudiante_email, @nombre_estudiante, @curso, @codigo, @periodo, @nota, @motivo, @estado, @observacion, @fecha)
        `);
    }
    console.log('✅ Justificaciones insertadas (' + justificaciones.length + ' registros)');

    // ---- 10. APELACIONES ----
    console.log('📌 Insertando apelaciones...');
    const apelaciones = [
      ['BEC-2026-008', 'estudiante3@becas.com', 'Ana López', 'Considero que mi solicitud fue rechazada injustamente. El ingreso familiar que declaré es correcto.', 'Pendiente', '2026-08-20 10:00:00', null],
      ['BEC-2026-005', 'estudiante5@becas.com', 'Laura Fernández', 'La subsanación solicitada ya fue completada. Subí todos los documentos requeridos dentro del plazo.', 'Revisada', '2026-08-10 15:30:00', 'Se acepta la apelación. La documentación presentada es correcta y completa.']
    ];

    for (const a of apelaciones) {
      await pool.request()
        .input('expediente', a[0])
        .input('email', a[1])
        .input('nombre_estudiante', a[2])
        .input('motivo', a[3])
        .input('estado', a[4])
        .input('fecha', a[5])
        .input('decision', a[6])
        .query(`
          INSERT INTO apelaciones (expediente, email, nombre_estudiante, motivo, estado, fecha, decision)
          VALUES (@expediente, @email, @nombre_estudiante, @motivo, @estado, @fecha, @decision)
        `);
    }
    console.log('✅ Apelaciones insertadas (' + apelaciones.length + ' registros)');

    // ---- 11. SUSPENSIONES ----
    console.log('📌 Insertando suspensiones...');
    const suspensiones = [
      ['estudiante@becas.com', 'BEC-2026-001', 'suspension', '30', 'Bajo rendimiento académico', 'El estudiante no mantuvo el promedio mínimo requerido de 80.', '2026-07-01 08:00:00', 'Activa', 'María Gómez'],
      ['estudiante2@becas.com', 'BEC-2026-007', 'suspension', '15', 'Incumplimiento de requisitos', 'El estudiante no presentó la documentación requerida para la renovación.', '2026-08-01 10:00:00', 'Restaurada', 'José Ramírez']
    ];

    for (const sus of suspensiones) {
      await pool.request()
        .input('email', sus[0])
        .input('expediente', sus[1])
        .input('tipo', sus[2])
        .input('dias', sus[3])
        .input('motivo', sus[4])
        .input('observaciones', sus[5])
        .input('fecha', sus[6])
        .input('estado', sus[7])
        .input('nombre_estudiante', sus[8])
        .query(`
          INSERT INTO suspensiones (email, expediente, tipo, dias, motivo, observaciones, fecha, estado, nombre_estudiante)
          VALUES (@email, @expediente, @tipo, @dias, @motivo, @observaciones, @fecha, @estado, @nombre_estudiante)
        `);
    }
    console.log('✅ Suspensiones insertadas (' + suspensiones.length + ' registros)');

    // ---- 12. CONVOCATORIAS ----
    console.log('📌 Insertando convocatorias...');
    const hoy = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const apertura = new Date(hoy.getTime() - 10 * 86400000);
    const cierre = new Date(hoy.getTime() + 20 * 86400000);
    const apertura2 = new Date(hoy.getTime() + 30 * 86400000);
    const cierre2 = new Date(hoy.getTime() + 60 * 86400000);

    const convocatorias = [
      ['Beca Socioeconómica 2026-I', 'Socioeconómica', 20, fmt(apertura), fmt(cierre), 'Activa', '08:00', '17:00'],
      ['Beca de Excelencia Académica 2026-I', 'Excelencia Académica', 10, fmt(apertura), fmt(cierre), 'Activa', '08:00', '17:00'],
      ['Beca Deportiva 2026-I', 'Deportiva', 15, fmt(apertura), fmt(cierre), 'Activa', '08:00', '17:00'],
      ['Beca Cultural 2026-I', 'Cultural', 10, fmt(apertura), fmt(cierre), 'Activa', '08:00', '17:00'],
      ['Beca Investigación 2026-I', 'Investigación', 5, fmt(apertura), fmt(cierre), 'Activa', '08:00', '17:00'],
      ['Beca Socioeconómica 2026-II', 'Socioeconómica', 25, fmt(apertura2), fmt(cierre2), 'Borrador', '08:00', '17:00']
    ];

    for (const c of convocatorias) {
      await pool.request()
        .input('nombre', c[0])
        .input('tipo', c[1])
        .input('cupos', c[2])
        .input('fecha_apertura', c[3])
        .input('fecha_cierre', c[4])
        .input('estado', c[5])
        .input('hora_apertura', c[6])
        .input('hora_cierre', c[7])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM convocatorias WHERE nombre = @nombre)
          INSERT INTO convocatorias (nombre, tipo, cupos, fecha_apertura, fecha_cierre, estado, hora_apertura, hora_cierre)
          VALUES (@nombre, @tipo, @cupos, @fecha_apertura, @fecha_cierre, @estado, @hora_apertura, @hora_cierre)
        `);
    }
    console.log('✅ Convocatorias insertadas (' + convocatorias.length + ' registros)');

    // ---- 13. VOTACIONES ----
    console.log('📌 Insertando votaciones...');
    const votaciones = [
      ['BEC-2026-006', DATEADD(HOUR, -2, GETDATE()), 'En curso', null],
      ['BEC-2026-001', DATEADD(DAY, -2, GETDATE()), 'Cerrada', 'Aprobada']
    ];

    for (const v of votaciones) {
      await pool.request()
        .input('expediente', v[0])
        .input('fecha_inicio', v[1])
        .input('estado', v[2])
        .input('resultado', v[3])
        .query(`
          INSERT INTO votaciones (expediente, fecha_inicio, estado, resultado)
          VALUES (@expediente, @fecha_inicio, @estado, @resultado)
        `);
    }
    console.log('✅ Votaciones insertadas (' + votaciones.length + ' registros)');

    // ---- 14. VOTOS ----
    console.log('📌 Insertando votos...');
    // Obtener IDs de miembros del comité y votaciones
    const miembros = await pool.request().query('SELECT id FROM miembros_comite');
    const votacionesIds = await pool.request().query('SELECT id, expediente FROM votaciones WHERE estado = "En curso"');

    if (miembros.recordset.length >= 3 && votacionesIds.recordset.length > 0) {
      const votacionId = votacionesIds.recordset[0].id;
      const votosData = [
        [votacionId, miembros.recordset[0].id, 'A favor', 'Excelente expediente, recomiendo aprobar.'],
        [votacionId, miembros.recordset[1].id, 'A favor', 'Cumple con todos los requisitos.'],
        [votacionId, miembros.recordset[2].id, null, null]
      ];

      for (const voto of votosData) {
        await pool.request()
          .input('votacion_id', voto[0])
          .input('miembro_comite_id', voto[1])
          .input('decision', voto[2])
          .input('observacion', voto[3])
          .query(`
            INSERT INTO votos (votacion_id, miembro_comite_id, decision, observacion)
            VALUES (@votacion_id, @miembro_comite_id, @decision, @observacion)
          `);
      }
      console.log('✅ Votos insertados (' + votosData.length + ' registros)');
    }

    // ---- 15. BITACORA ----
    console.log('📌 Insertando bitácora...');
    const ahora2 = new Date();
    const hace = (mins) => new Date(ahora2.getTime() - mins * 60000).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
    
    const bitacora = [
      [hace(180), 'María Gómez', 'estudiante', 'Solicitud creada', 'BEC-2026-001'],
      [hace(150), 'Carlos Rodríguez', 'trabajador_social', 'Revisión TS iniciada', 'BEC-2026-001'],
      [hace(120), 'Carlos Rodríguez', 'trabajador_social', 'Visita domiciliaria registrada', 'BEC-2026-001'],
      [hace(90), 'Dra. Ana Méndez', 'comite', 'Aprobación Comité', 'BEC-2026-001'],
      [hace(80), 'José Ramírez', 'estudiante', 'Solicitud creada', 'BEC-2026-002'],
      [hace(70), 'Carlos Rodríguez', 'trabajador_social', 'Revisión TS iniciada', 'BEC-2026-002'],
      [hace(60), 'Ana López', 'estudiante', 'Solicitud creada', 'BEC-2026-003'],
      [hace(40), 'Admin Sistema', 'admin', 'Configuración actualizada', '—'],
      [hace(30), 'Luis Fernández', 'auditor', 'Consulta de expedientes', '—'],
      [hace(20), 'Carlos Rodríguez', 'trabajador_social', 'Subsanación solicitada', 'BEC-2026-005']
    ];

    for (const b of bitacora) {
      await pool.request()
        .input('fecha', b[0])
        .input('usuario', b[1])
        .input('rol', b[2])
        .input('accion', b[3])
        .input('expediente', b[4])
        .query(`
          INSERT INTO bitacora (fecha, usuario, rol, accion, expediente)
          VALUES (@fecha, @usuario, @rol, @accion, @expediente)
        `);
    }
    console.log('✅ Bitácora insertada (' + bitacora.length + ' registros)');

    // =====================================================
    // RESUMEN FINAL
    // =====================================================
    console.log('');
    console.log('🎉 ============================================');
    console.log('🎉 BASE DE DATOS INICIALIZADA CORRECTAMENTE');
    console.log('🎉 ============================================');
    console.log('');
    console.log('📊 TABLAS CREADAS:');
    console.log('   1. usuarios');
    console.log('   2. tipos_beca');
    console.log('   3. solicitudes');
    console.log('   4. documentos');
    console.log('   5. integrantes_familia');
    console.log('   6. visitas');
    console.log('   7. suspensiones');
    console.log('   8. apelaciones');
    console.log('   9. justificaciones');
    console.log('  10. convocatorias');
    console.log('  11. noticias');
    console.log('  12. notificaciones');
    console.log('  13. bitacora');
    console.log('  14. empleados');
    console.log('  15. alertas_seguridad');
    console.log('  16. config');
    console.log('  17. borrador_solicitud');
    console.log('  18. chatbot_preguntas');
    console.log('  19. miembros_comite ⭐ NUEVA');
    console.log('  20. votaciones ⭐ NUEVA');
    console.log('  21. votos ⭐ NUEVA');
    console.log('  22. votaciones_comite (deprecada)');
    console.log('');
    console.log('📊 DATOS INSERTADOS:');
    console.log('   👤 Usuarios: ' + usuarios.length);
    console.log('   👥 Miembros Comité: ' + miembrosData.length);
    console.log('   📋 Tipos de beca: ' + tipos.length);
    console.log('   ⚙️ Configuración: ' + configs.length);
    console.log('   📅 Convocatorias: ' + convocatorias.length);
    console.log('   📰 Noticias: ' + noticias.length);
    console.log('   👔 Empleados: ' + empleados.length);
    console.log('   📄 Solicitudes: ' + solicitudes.length);
    console.log('   🏠 Visitas: ' + visitas.length);
    console.log('   📝 Justificaciones: ' + justificaciones.length);
    console.log('   ⚖️ Apelaciones: ' + apelaciones.length);
    console.log('   ⛔ Suspensiones: ' + suspensiones.length);
    console.log('   📋 Bitácora: ' + bitacora.length);
    console.log('   🗳️ Votaciones: ' + votaciones.length);
    console.log('');
    console.log('🔑 CREDENCIALES DE ACCESO:');
    console.log('   📧 estudiante@becas.com / 123456');
    console.log('   📧 estudiante2@becas.com / 123456');
    console.log('   📧 estudiante3@becas.com / 123456');
    console.log('   📧 estudiante4@becas.com / 123456');
    console.log('   📧 estudiante5@becas.com / 123456');
    console.log('   📧 social@becas.com / 123456 (Trabajador Social)');
    console.log('   📧 comite@becas.com / 123456 (Comité - Presidenta)');
    console.log('   📧 carlos.montero@becas.com / 123456 (Comité - Vocal)');
    console.log('   📧 laura.chaves@becas.com / 123456 (Comité - Vocal)');
    console.log('   📧 admin@becas.com / 123456 (Administrador)');
    console.log('   📧 auditor@becas.com / 123456 (Auditor)');
    console.log('');
    console.log('✅ Proceso completado exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    process.exit(1);
  }
}

initDatabase();