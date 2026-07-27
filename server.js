require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Hacer db disponible para las rutas
app.locals.db = db;

// Routes originales (Melany + Ziu)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/tipos-beca', require('./routes/tiposBeca'));
app.use('/api/convocatorias', require('./routes/convocatorias'));
app.use('/api/noticias', require('./routes/noticias'));
app.use('/api/justificaciones', require('./routes/justificaciones'));
app.use('/api/apelaciones', require('./routes/apelaciones'));
app.use('/api/visitas', require('./routes/visitas')); // Ruta de visitas
app.use('/api/suspensiones', require('./routes/suspensiones'));
app.use('/api/empleados', require('./routes/empleados'));
app.use('/api/config', require('./routes/config'));
app.use('/api/bitacora', require('./routes/bitacora'));
app.use('/api/estadisticas', require('./routes/estadisticas'));
app.use('/api/alertas', require('./routes/alertas'));
app.use('/api/documentos', require('./routes/documentos'));

// =====================================================
// Rutas del módulo Agustín (Avance 2 — Alumno 3)
// =====================================================
app.use('/api/chatbot', require('./routes/chatbot'));         // Alimentar el chatbot
app.use('/api/sesiones', require('./routes/sesiones'));       // Manejo de sesiones activas
app.use('/api/votaciones', require('./routes/votaciones'));   // Herramientas del comité
app.use('/api/informes', require('./routes/informes'));       // Generación de informes

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor', message: err.message });
});

app.listen(PORT, async () => {
  console.log(`\n🎓 Sistema de Becas Universitarias v3.0`);
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🗄️ Base de datos: SQL Server`);
  try {
    await db.getConnection();
    console.log(`✅ Conexión a SQL Server establecida\n`);
  } catch (error) {
    console.error(`❌ Error de conexión a SQL Server: ${error.message}`);
    console.log(`⚠️ Verifica que SQL Server esté corriendo y las credenciales sean correctas.\n`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
