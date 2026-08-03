// server.js - Versión con logs mejorados
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 INICIANDO SERVIDOR...');
console.log(`📡 Puerto: ${PORT}`);
console.log(`📂 Directorio: ${__dirname}`);

// ============================================================
// MIDDLEWARE
// ============================================================
console.log('📦 Cargando middleware...');
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
console.log('✅ Middleware cargado');

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================
// RUTAS - Con manejo de errores
// ============================================================
console.log('📡 Cargando rutas...');

const routes = [
  { path: '/api/auth', file: './routes/auth' },
  { path: '/api/usuarios', file: './routes/usuarios' },
  { path: '/api/solicitudes', file: './routes/solicitudes' },
  { path: '/api/tipos-beca', file: './routes/tiposBeca' },
  { path: '/api/convocatorias', file: './routes/convocatorias' },
  { path: '/api/noticias', file: './routes/noticias' },
  { path: '/api/justificaciones', file: './routes/justificaciones' },
  { path: '/api/apelaciones', file: './routes/apelaciones' },
  { path: '/api/visitas', file: './routes/visitas' },
  { path: '/api/suspensiones', file: './routes/suspensiones' },
  { path: '/api/empleados', file: './routes/empleados' },
  { path: '/api/config', file: './routes/config' },
  { path: '/api/bitacora', file: './routes/bitacora' },
  { path: '/api/estadisticas', file: './routes/estadisticas' },
  { path: '/api/alertas', file: './routes/alertas' },
  { path: '/api/documentos', file: './routes/documentos' },
  { path: '/api/chatbot', file: './routes/chatbot' },
  { path: '/api/sesiones', file: './routes/sesiones' },
  { path: '/api/votaciones', file: './routes/votaciones' },
  { path: '/api/informes', file: './routes/informes' }
];

routes.forEach(route => {
  try {
    const router = require(route.file);
    app.use(route.path, router);
    console.log(`   ✅ Ruta cargada: ${route.path}`);
  } catch (error) {
    console.error(`   ❌ Error cargando ruta ${route.path}:`, error.message);
  }
});

console.log('✅ Todas las rutas procesadas');

// ============================================================
// FALLBACK - SPA (DEBE IR AL FINAL)
// ============================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// MANEJO DE ERRORES (DEBE IR AL FINAL)
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Error en servidor:', err.message);
  console.error('📋 Stack:', err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error'
  });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
console.log('🚀 Iniciando servidor en el puerto', PORT);

const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🎓 Sistema de Becas Universitarias v3.0');
  console.log('='.repeat(60));
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
  console.log('✅ Servidor listo para recibir peticiones');
});

// Manejar errores del servidor
server.on('error', (error) => {
  console.error('❌ Error en el servidor:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`⚠️ El puerto ${PORT} ya está en uso.`);
    console.error('💡 Intenta:');
    console.error(`   - Cambiar el puerto en .env o usar: PORT=3001 node server.js`);
    console.error(`   - O matar el proceso que usa el puerto ${PORT}`);
  }
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT, cerrando servidor...');
  server.close(() => {
    console.log('👋 Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('👋 Servidor cerrado correctamente');
    process.exit(0);
  });
});

console.log('📋 Servidor configurado. Esperando conexiones...');