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
        documentos NVARCHAR(MAX) DEFAULT '{}',
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

    // Tabla visitas - CON nombreEstudiante
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='visitas' AND xtype='U')
      CREATE TABLE visitas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        expediente NVARCHAR(50) NOT NULL,
        fecha NVARCHAR(50) NOT NULL,
        condiciones NVARCHAR(MAX),
        coincide NVARCHAR(50) DEFAULT 'Sí',
        archivo NVARCHAR(MAX),
        nombreEstudiante NVARCHAR(255) NULL,
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

    // Tabla config
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

    // ---- 1. USUARIOS ----
    console.log('📌 Insertando usuarios...');
    const usuarios = [
      ['estudiante@becas.com', cifrarPassword('123456'), 'estudiante', 'María Gómez'],
      ['estudiante2@becas.com', cifrarPassword('123456'), 'estudiante', 'José Ramírez'],
      ['estudiante3@becas.com', cifrarPassword('123456'), 'estudiante', 'Ana López'],
      ['estudiante4@becas.com', cifrarPassword('123456'), 'estudiante', 'Carlos Méndez'],
      ['estudiante5@becas.com', cifrarPassword('123456'), 'estudiante', 'Laura Fernández'],
      ['social@becas.com', cifrarPassword('123456'), 'trabajador_social', 'Carlos Rodríguez'],
      ['social2@becas.com', cifrarPassword('123456'), 'trabajador_social', 'Ana Martínez'],
      ['comite@becas.com', cifrarPassword('123456'), 'comite', 'Dra. Ana Méndez'],
      ['comite2@becas.com', cifrarPassword('123456'), 'comite', 'Dr. Roberto Jiménez'],
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
          INSERT INTO usuarios (email, password, rol, nombre, intentos, bloqueado, two_factor_enabled)
          VALUES (@email, @password, @rol, @nombre, 0, 0, 0)
        `);
    }
    console.log('✅ Usuarios insertados (' + usuarios.length + ' registros)');

    // ---- 2. TIPOS DE BECA ----
    console.log('📌 Insertando tipos de beca...');
    const tipos = [
      ['Socioeconómica', '💰', 'Apoyo financiero para estudiantes con recursos limitados', 25, 100, 
       JSON.stringify(['Matrícula', 'Aranceles', 'Materiales']),
       JSON.stringify(['Promedio mínimo 80', 'Ingreso familiar máximo 2 salarios mínimos', 'Constancia de ingresos', 'Recibo de servicios públicos']), 1, '[]'],
      ['Excelencia Académica', '🎓', 'Para estudiantes con promedio destacado', 50, 100,
       JSON.stringify(['Matrícula', 'Aranceles']),
       JSON.stringify(['Promedio mínimo 90', 'Sin sanciones disciplinarias', 'Carga mínima 12 créditos', 'Carta de recomendación']), 1,
       JSON.stringify([
         { id: 'f-publicaciones', label: 'Publicaciones o investigaciones', type: 'textarea', placeholder: 'Lista de publicaciones' },
         { id: 'f-proyectos', label: 'Proyectos de investigación', type: 'textarea', placeholder: 'Proyectos de investigación' }
       ])],
      ['Deportiva', '⚽', 'Para estudiantes con alto rendimiento deportivo', 25, 75,
       JSON.stringify(['Matrícula']),
       JSON.stringify(['Promedio mínimo 80', 'Representación universitaria', 'Carta de la coordinación deportiva', 'Participación activa']), 1,
       JSON.stringify([
         { id: 'f-deporte', label: 'Deporte que practica', type: 'text', placeholder: 'Ej: Natación' },
         { id: 'f-nivel-deporte', label: 'Nivel de competencia', type: 'select', options: ['Local', 'Regional', 'Nacional', 'Internacional'] },
         { id: 'f-logros-deportivos', label: 'Logros deportivos', type: 'textarea', placeholder: 'Principales logros' }
       ])],
      ['Cultural', '🎭', 'Artes, música, teatro', 25, 75,
       JSON.stringify(['Matrícula']),
       JSON.stringify(['Promedio mínimo 80', 'Portafolio artístico', 'Carta de la coordinación cultural', 'Participación en actividades']), 1,
       JSON.stringify([
         { id: 'f-disciplina', label: 'Disciplina artística', type: 'text', placeholder: 'Ej: Teatro' },
         { id: 'f-portafolio', label: 'Descripción del portafolio artístico', type: 'textarea', placeholder: 'Describa su portafolio' }
       ])],
      ['Discapacidad', '♿', 'Apoyo para estudiantes con discapacidad certificada', 50, 100,
       JSON.stringify(['Matrícula', 'Aranceles', 'Materiales', 'Transporte']),
       JSON.stringify(['Promedio mínimo 80', 'Certificado médico vigente', 'Constancia de ingresos', 'Informe de necesidades especiales']), 1,
       JSON.stringify([
         { id: 'f-tipo-discapacidad', label: 'Tipo de discapacidad', type: 'text', placeholder: 'Ej: Motora' },
         { id: 'f-requiere-adaptacion', label: '¿Requiere adaptaciones curriculares?', type: 'select', options: ['No', 'Sí'] }
       ])],
      ['Investigación', '🔬', 'Para asistentes de investigación', 25, 75,
       JSON.stringify(['Matrícula', 'Estipendio']),
       JSON.stringify(['Promedio mínimo 85', 'Proyecto de investigación activo', 'Carta del director del proyecto', 'Disponibilidad horaria']), 1,
       JSON.stringify([
         { id: 'f-area-investigacion', label: 'Área de investigación', type: 'text', placeholder: 'Ej: Biología Molecular' },
         { id: 'f-proyecto-investigacion', label: 'Nombre del proyecto', type: 'text', placeholder: 'Nombre del proyecto' }
       ])]
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
    console.log('✅ Tipos de beca insertados (' + tipos.length + ' registros)');

    // ---- 3. CONFIGURACIÓN ----
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

    // ---- 4. CONVOCATORIAS ----
    console.log('📌 Insertando convocatorias...');
    const hoy = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const apertura = new Date(hoy.getTime() - 10 * 86400000);
    const cierre = new Date(hoy.getTime() + 20 * 86400000);

    const convocatorias = [
      ['Beca Socioeconómica 2026-I', 'Socioeconómica', 20, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca de Excelencia Académica 2026-I', 'Excelencia Académica', 10, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Deportiva 2026-I', 'Deportiva', 15, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Cultural 2026-I', 'Cultural', 10, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Discapacidad 2026-I', 'Discapacidad', 8, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Investigación 2026-I', 'Investigación', 5, fmt(apertura), fmt(cierre), 'Activa'],
      ['Beca Socioeconómica 2026-II', 'Socioeconómica', 25, fmt(new Date(hoy.getTime() + 30 * 86400000)), fmt(new Date(hoy.getTime() + 60 * 86400000)), 'Borrador'],
      ['Beca Excelencia Académica 2026-II', 'Excelencia Académica', 12, fmt(new Date(hoy.getTime() + 30 * 86400000)), fmt(new Date(hoy.getTime() + 60 * 86400000)), 'Borrador']
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
    console.log('✅ Convocatorias insertadas (' + convocatorias.length + ' registros)');

    // ---- 5. NOTICIAS ----
    console.log('📌 Insertando noticias...');
    const noticias = [
      ['Convocatoria 2026 abierta', 'Ya están disponibles las becas para el período 2026. Las solicitudes se recibirán hasta el 31 de marzo de 2026. No pierdas esta oportunidad de obtener apoyo para tus estudios.', '15/01/2026'],
      ['Plazo de subsanación extendido', 'Se extiende el plazo de subsanación de documentos hasta el 15 de abril de 2026. Los estudiantes podrán completar la documentación faltante sin penalización.', '01/03/2026'],
      ['Nuevas becas de investigación', 'Se abre convocatoria para becas de investigación con un estipendio mensual de ₡300,000. Dirigido a estudiantes de posgrado y últimos años de carrera.', '01/06/2026'],
      ['Resultados de becas 2026-I', 'Ya están disponibles los resultados de las becas para el primer semestre de 2026. Los estudiantes pueden consultar su estado en el sistema.', '30/06/2026'],
      ['Importante: Actualización de requisitos', 'Se han actualizado los requisitos para la beca de Excelencia Académica. El promedio mínimo requerido es ahora 90.', '15/07/2026'],
      ['Cierre de convocatoria 2026-II', 'La convocatoria para el segundo semestre de 2026 cierra el 31 de agosto. Asegúrate de completar tu solicitud a tiempo.', '01/08/2026']
    ];

    for (const n of noticias) {
      await pool.request()
        .input('titulo', n[0])
        .input('contenido', n[1])
        .input('fecha', n[2])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM noticias WHERE titulo = @titulo)
          INSERT INTO noticias (titulo, contenido, fecha) VALUES (@titulo, @contenido, @fecha)
        `);
    }
    console.log('✅ Noticias insertadas (' + noticias.length + ' registros)');

    // ---- 6. EMPLEADOS ----
    console.log('📌 Insertando empleados...');
    const empleados = [
      ['Dra. Laura Chaves', 'Oficina de Becas', 'Coordinadora de Becas', 'laura.chaves@becas.ac.cr', '2200-1001'],
      ['M.Sc. Roberto Jiménez', 'Registro Académico', 'Analista de Expedientes', 'roberto.jimenez@becas.ac.cr', '2200-1002'],
      ['Lic. Marcela Solano', 'Finanzas', 'Tesorera', 'marcela.solano@becas.ac.cr', '2200-1003'],
      ['Dr. Carlos Montero', 'Comité de Becas', 'Miembro del Comité', 'carlos.montero@becas.ac.cr', '2200-1004'],
      ['Lic. Patricia Fernández', 'Oficina de Becas', 'Asistente de Becas', 'patricia.fernandez@becas.ac.cr', '2200-1005'],
      ['M.Sc. Eduardo Rojas', 'Registro Académico', 'Jefe de Registro', 'eduardo.rojas@becas.ac.cr', '2200-1006'],
      ['Dra. María José Mora', 'Comité de Becas', 'Presidenta del Comité', 'maria.mora@becas.ac.cr', '2200-1007']
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
        datos_completos: JSON.stringify({ 'f-nombres': 'María', 'f-apellidos': 'Gómez', 'f-carrera': 'Medicina', 'f-sede': 'Central' }),
        documentos: JSON.stringify({
          'f-cedula-f': { label: 'Copia de cédula (frontal)', nombre: 'cedula_f.jpg', tipo: 'image/jpeg', tamano: 245678, fecha: '2026-01-15T10:00:00.000Z', estado: 'Aprobado' },
          'f-constancia': { label: 'Constancia de ingresos', nombre: 'constancia.pdf', tipo: 'application/pdf', tamano: 123456, fecha: '2026-01-15T10:00:00.000Z', estado: 'Aprobado' }
        })
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
        datos_completos: JSON.stringify({ 'f-nombres': 'José', 'f-apellidos': 'Ramírez', 'f-carrera': 'Ingeniería en Sistemas', 'f-sede': 'Central' }),
        documentos: JSON.stringify({
          'f-cedula-f': { label: 'Copia de cédula (frontal)', nombre: 'cedula_jose.jpg', tipo: 'image/jpeg', tamano: 189234, fecha: '2026-06-20T10:00:00.000Z', estado: 'Pendiente' }
        })
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
        datos_completos: JSON.stringify({ 'f-nombres': 'Ana', 'f-apellidos': 'López', 'f-carrera': 'Derecho', 'f-sede': 'Central' }),
        documentos: JSON.stringify({})
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
        datos_completos: JSON.stringify({ 'f-nombres': 'Carlos', 'f-apellidos': 'Méndez', 'f-carrera': 'Administración', 'f-sede': 'Occidente' }),
        documentos: JSON.stringify({})
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
        motivo_rechazo: 'Falta constancia de ingresos',
        datos_completos: JSON.stringify({ 'f-nombres': 'Laura', 'f-apellidos': 'Fernández', 'f-carrera': 'Arquitectura', 'f-sede': 'Atlántica' }),
        documentos: JSON.stringify({})
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
        tipo_beca: 'Discapacidad',
        estado: 'En comité',
        progreso: 80,
        puntaje: 88,
        promedio: 91,
        ingreso_familiar: 450000,
        aceptado: 0,
        observacion_ts: 'Visita realizada. Documentación completa.',
        observaciones_comite: 'En evaluación por el comité.',
        datos_completos: JSON.stringify({ 'f-nombres': 'María', 'f-apellidos': 'Gómez', 'f-carrera': 'Medicina', 'f-sede': 'Central' }),
        documentos: JSON.stringify({
          'f-certificado': { label: 'Certificado médico', nombre: 'certificado.pdf', tipo: 'application/pdf', tamano: 234567, fecha: '2026-07-20T10:00:00.000Z', estado: 'Aprobado' }
        })
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
        datos_completos: JSON.stringify({ 'f-nombres': 'José', 'f-apellidos': 'Ramírez', 'f-carrera': 'Ingeniería en Sistemas', 'f-sede': 'Central' }),
        documentos: JSON.stringify({
          'f-proyecto': { label: 'Proyecto de investigación', nombre: 'proyecto.pdf', tipo: 'application/pdf', tamano: 456789, fecha: '2026-08-01T10:00:00.000Z', estado: 'Aprobado' }
        })
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
        datos_completos: JSON.stringify({ 'f-nombres': 'Ana', 'f-apellidos': 'López', 'f-carrera': 'Derecho', 'f-sede': 'Central' }),
        documentos: JSON.stringify({})
      },
      {
        expediente: 'BEC-2026-009',
        fecha: '2026-08-10',
        estudiante_email: 'estudiante4@becas.com',
        nombres: 'Carlos',
        apellidos: 'Méndez',
        cedula: '4-5678-9012',
        correo: 'estudiante4@becas.com',
        telefono: '8888-4444',
        tipo_beca: 'Excelencia Académica',
        estado: 'Enviada',
        progreso: 10,
        puntaje: 0,
        promedio: 93,
        ingreso_familiar: 380000,
        aceptado: 0,
        datos_completos: JSON.stringify({ 'f-nombres': 'Carlos', 'f-apellidos': 'Méndez', 'f-carrera': 'Administración', 'f-sede': 'Occidente' }),
        documentos: JSON.stringify({})
      },
      {
        expediente: 'BEC-2026-010',
        fecha: '2026-08-15',
        estudiante_email: 'estudiante5@becas.com',
        nombres: 'Laura',
        apellidos: 'Fernández',
        cedula: '5-6789-0123',
        correo: 'estudiante5@becas.com',
        telefono: '8888-5555',
        tipo_beca: 'Cultural',
        estado: 'Beneficio Activo',
        progreso: 100,
        puntaje: 85,
        promedio: 89,
        ingreso_familiar: 320000,
        aceptado: 1,
        porcentaje_cobertura: '75%',
        observacion_ts: 'Documentación verificada y aprobada.',
        observaciones_comite: 'Aprobada. Excelente portafolio artístico.',
        datos_completos: JSON.stringify({ 'f-nombres': 'Laura', 'f-apellidos': 'Fernández', 'f-carrera': 'Arquitectura', 'f-sede': 'Atlántica' }),
        documentos: JSON.stringify({
          'f-portafolio': { label: 'Portafolio artístico', nombre: 'portafolio.pdf', tipo: 'application/pdf', tamano: 567890, fecha: '2026-08-15T10:00:00.000Z', estado: 'Aprobado' }
        })
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
        .input('documentos', s.documentos)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM solicitudes WHERE expediente = @expediente)
          INSERT INTO solicitudes (
            expediente, fecha, estudiante_email, nombres, apellidos, cedula, correo, telefono,
            tipo_beca, estado, progreso, puntaje, promedio, ingreso_familiar, aceptado,
            porcentaje_cobertura, observacion_ts, observaciones_comite, motivo_rechazo,
            datos_completos, documentos
          ) VALUES (
            @expediente, @fecha, @estudiante_email, @nombres, @apellidos, @cedula, @correo, @telefono,
            @tipo_beca, @estado, @progreso, @puntaje, @promedio, @ingreso_familiar, @aceptado,
            @porcentaje_cobertura, @observacion_ts, @observaciones_comite, @motivo_rechazo,
            @datos_completos, @documentos
          )
        `);
    }
    console.log('✅ Solicitudes insertadas (' + solicitudes.length + ' registros)');

    // ---- 8. VISITAS ----
    console.log('📌 Insertando visitas...');
    const visitas = [
      ['BEC-2026-001', '2026-07-15', 'Vivienda en buen estado, familia presente, condiciones económicas estables. La información proporcionada coincide con lo declarado.', 'Sí', null, 'María Gómez', '2026-07-15 14:30:00'],
      ['BEC-2026-002', '2026-07-20', 'Vivienda modesta, familia numerosa (5 miembros), ingreso limitado, necesidades básicas cubiertas.', 'Sí', null, 'José Ramírez', '2026-07-20 10:15:00'],
      ['BEC-2026-003', '2026-07-25', 'Vivienda en zona rural, acceso limitado a servicios básicos, condiciones de hacinamiento. Se recomienda seguimiento.', 'Parcialmente', null, 'Ana López', '2026-07-25 16:45:00'],
      ['BEC-2026-006', '2026-08-01', 'Vivienda en alquiler, buen estado, familia con 2 dependientes económicos, ingreso estable.', 'Sí', null, 'Carlos Méndez', '2026-08-01 09:30:00'],
      ['BEC-2026-007', '2026-08-05', 'Vivienda propia, condiciones regulares, problemas estructurales menores, familia de 4 miembros.', 'Parcialmente', null, 'Laura Fernández', '2026-08-05 11:00:00'],
      ['BEC-2026-008', '2026-08-10', 'Vivienda en condición precaria, falta de servicios básicos, situación económica crítica.', 'No', null, 'Pedro Sánchez', '2026-08-10 13:20:00']
    ];

    for (const v of visitas) {
      await pool.request()
        .input('expediente', v[0])
        .input('fecha', v[1])
        .input('condiciones', v[2])
        .input('coincide', v[3])
        .input('archivo', v[4])
        .input('nombreEstudiante', v[5])
        .input('fecha_registro', v[6])
        .query(`
          IF NOT EXISTS (SELECT 1 FROM visitas WHERE expediente = @expediente AND fecha = @fecha)
          INSERT INTO visitas (expediente, fecha, condiciones, coincide, archivo, nombreEstudiante, fecha_registro)
          VALUES (@expediente, @fecha, @condiciones, @coincide, @archivo, @nombreEstudiante, @fecha_registro)
        `);
    }
    console.log('✅ Visitas insertadas (' + visitas.length + ' registros)');

    // ---- 9. JUSTIFICACIONES ----
    console.log('📌 Insertando justificaciones...');
    const justificaciones = [
      ['estudiante@becas.com', 'María Gómez', 'Matemática I', 'MA-1001', 'I-2026', 65, 'Problemas de salud durante el periodo de exámenes. Adjunto certificado médico.', 'Pendiente', '', '2026-07-15 14:30:00', null],
      ['estudiante2@becas.com', 'José Ramírez', 'Física I', 'FI-1001', 'I-2026', 58, 'Fallecimiento de un familiar cercano que afectó mi rendimiento académico.', 'Aprobada', 'Justificación aceptada. Se adjunta acta de defunción.', '2026-07-20 10:15:00', null],
      ['estudiante3@becas.com', 'Ana López', 'Química I', 'QU-1001', 'I-2026', 70, 'Problemas económicos que me obligaron a trabajar tiempo completo durante el semestre.', 'Pendiente', '', '2026-07-25 16:45:00', null],
      ['estudiante4@becas.com', 'Carlos Méndez', 'Cálculo I', 'CA-1001', 'II-2025', 60, 'Enfermedad prolongada que me impidió asistir a clases regularmente.', 'Aprobada', 'Justificación aceptada. Se adjunta certificado médico.', '2026-08-01 09:30:00', null],
      ['estudiante5@becas.com', 'Laura Fernández', 'Dibujo Técnico', 'DT-1001', 'II-2025', 55, 'Problemas familiares que afectaron mi concentración durante el semestre.', 'Rechazada', 'No se presentó evidencia suficiente para justificar la pérdida del curso.', '2026-08-05 11:00:00', null]
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
        .input('archivo', j[10])
        .query(`
          INSERT INTO justificaciones (estudiante_email, nombre_estudiante, curso, codigo, periodo, nota, motivo, estado, observacion, fecha, archivo)
          VALUES (@estudiante_email, @nombre_estudiante, @curso, @codigo, @periodo, @nota, @motivo, @estado, @observacion, @fecha, @archivo)
        `);
    }
    console.log('✅ Justificaciones insertadas (' + justificaciones.length + ' registros)');

    // ---- 10. APELACIONES ----
    console.log('📌 Insertando apelaciones...');
    const apelaciones = [
      ['BEC-2026-008', 'estudiante3@becas.com', 'Ana López', 'Considero que mi solicitud fue rechazada injustamente. El ingreso familiar que declaré es correcto y cumple con todos los requisitos establecidos para la beca socioeconómica. Adjunto documentación adicional que respalda mi situación.', 'Pendiente', '2026-08-20 10:00:00', null, null, 'Socioeconómica'],
      ['BEC-2026-005', 'estudiante5@becas.com', 'Laura Fernández', 'La subsanación solicitada ya fue completada. Subí todos los documentos requeridos dentro del plazo establecido. Solicito una revisión de mi expediente.', 'Revisada', '2026-08-10 15:30:00', 'Se acepta la apelación. La documentación presentada es correcta y completa. La solicitud pasa a revisión.', null, 'Cultural'],
      ['BEC-2026-004', 'estudiante4@becas.com', 'Carlos Méndez', 'Mi solicitud de beca deportiva fue rechazada pero tengo evidencia de mi participación en competencias nacionales. Adjunto cartas de la federación deportiva que confirman mi rendimiento.', 'Pendiente', '2026-08-25 14:00:00', null, null, 'Deportiva']
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
        .input('archivo', a[7])
        .input('tipo_beca', a[8])
        .query(`
          INSERT INTO apelaciones (expediente, email, nombre_estudiante, motivo, estado, fecha, decision, archivo, tipo_beca)
          VALUES (@expediente, @email, @nombre_estudiante, @motivo, @estado, @fecha, @decision, @archivo, @tipo_beca)
        `);
    }
    console.log('✅ Apelaciones insertadas (' + apelaciones.length + ' registros)');

    // ---- 11. SUSPENSIONES ----
    console.log('📌 Insertando suspensiones...');
    const suspensiones = [
      ['estudiante@becas.com', 'BEC-2026-001', 'suspension', '30', 'Bajo rendimiento académico', 'El estudiante no mantuvo el promedio mínimo requerido de 80. Se le otorga un plazo de 30 días para mejorar su rendimiento.', '2026-07-01 08:00:00', 'Activa', null, 'María Gómez'],
      ['estudiante2@becas.com', 'BEC-2026-007', 'suspension', '15', 'Incumplimiento de requisitos', 'El estudiante no presentó la documentación requerida para la renovación de la beca.', '2026-08-01 10:00:00', 'Restaurada', null, 'José Ramírez'],
      ['estudiante3@becas.com', 'BEC-2026-010', 'cancelacion', 'Cancelada', 'Fraude en documentación', 'Se detectaron irregularidades en la documentación presentada. La beca es cancelada de manera definitiva.', '2026-08-15 14:30:00', 'Activa', null, 'Laura Fernández']
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
        .input('evidencia', sus[8])
        .input('nombre_estudiante', sus[9])
        .query(`
          INSERT INTO suspensiones (email, expediente, tipo, dias, motivo, observaciones, fecha, estado, evidencia, nombre_estudiante)
          VALUES (@email, @expediente, @tipo, @dias, @motivo, @observaciones, @fecha, @estado, @evidencia, @nombre_estudiante)
        `);
    }
    console.log('✅ Suspensiones insertadas (' + suspensiones.length + ' registros)');

    // ---- 12. BITACORA ----
    console.log('📌 Insertando bitácora...');
    const ahora = new Date();
    const hace = (mins) => new Date(ahora.getTime() - mins * 60000).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
    
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

    // ---- 13. ALERTAS_SEGURIDAD ----
    console.log('📌 Insertando alertas de seguridad...');
    const alertas = [
      [hace(24), 'Alta', 'Múltiples intentos fallidos de inicio de sesión (5) para estudiante@becas.com', 'Pendiente'],
      [hace(48), 'Media', 'Acceso desde ubicación no reconocida para usuario social@becas.com (IP: 45.33.22.11)', 'Pendiente'],
      [hace(72), 'Baja', 'Cambio de contraseña solicitado para usuario estudiante2@becas.com', 'Revisada'],
      [hace(96), 'Crítica', 'Intento de acceso no autorizado detectado en el módulo de administración', 'Pendiente']
    ];

    for (const al of alertas) {
      await pool.request()
        .input('fecha', al[0])
        .input('tipo', al[1])
        .input('descripcion', al[2])
        .input('estado', al[3])
        .query(`
          INSERT INTO alertas_seguridad (fecha, tipo, descripcion, estado)
          VALUES (@fecha, @tipo, @descripcion, @estado)
        `);
    }
    console.log('✅ Alertas de seguridad insertadas (' + alertas.length + ' registros)');

    // ---- 14. BORRADOR_SOLICITUD ----
    console.log('📌 Insertando borradores de solicitud...');
    const borradores = [
      ['estudiante@becas.com', '{"f-nombres":"María","f-apellidos":"Gómez","f-carrera":"Medicina","f-sede":"Central","f-tipo-beca":"Excelencia Académica","f-promedio":"92"}', new Date(ahora.getTime() - 3600000).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })],
      ['estudiante5@becas.com', '{"f-nombres":"Laura","f-apellidos":"Fernández","f-carrera":"Arquitectura","f-sede":"Atlántica","f-tipo-beca":"Cultural","f-promedio":"89"}', new Date(ahora.getTime() - 10800000).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })]
    ];
      for (const br of borradores) {
        await pool.request()
          .input('session_email', br[0])
          .input('datos', br[1])
          .query(`
            INSERT INTO borrador_solicitud (session_email, datos)
            VALUES (@session_email, @datos)
          `);
      }
    console.log('✅ Borradores insertados (' + borradores.length + ' registros)');

    // =====================================================
    // RESUMEN FINAL
    // =====================================================
    console.log('');
    console.log('🎉 ============================================');
    console.log('🎉 BASE DE DATOS INICIALIZADA CORRECTAMENTE');
    console.log('🎉 ============================================');
    console.log('');
    console.log('📊 RESUMEN DE DATOS INSERTADOS:');
    console.log('   👤 Usuarios: ' + usuarios.length);
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
    console.log('   🚨 Alertas: ' + alertas.length);
    console.log('   💾 Borradores: ' + borradores.length);
    console.log('');
    console.log('🔑 CREDENCIALES DE ACCESO:');
    console.log('   📧 estudiante@becas.com / 123456');
    console.log('   📧 estudiante2@becas.com / 123456');
    console.log('   📧 estudiante3@becas.com / 123456');
    console.log('   📧 social@becas.com / 123456 (Trabajador Social)');
    console.log('   📧 comite@becas.com / 123456 (Comité)');
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