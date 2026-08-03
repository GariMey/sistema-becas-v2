// middleware/errorHandler.js - Manejo centralizado de errores

/**
 * Middleware para manejar errores de validación
 */
function validationErrorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      message: err.message,
      details: err.details || null
    });
  }
  next(err);
}

/**
 * Middleware para manejar errores de base de datos
 */
function databaseErrorHandler(err, req, res, next) {
  if (err.code === 'ER_DUP_ENTRY' || err.message.includes('duplicate key')) {
    return res.status(409).json({
      error: 'Conflicto',
      message: 'El registro ya existe en la base de datos'
    });
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW' || err.message.includes('foreign key')) {
    return res.status(400).json({
      error: 'Error de integridad',
      message: 'El registro referencia a otro que no existe'
    });
  }

  if (err.message.includes('Connection') || err.message.includes('ETIMEOUT')) {
    return res.status(503).json({
      error: 'Base de datos no disponible',
      message: 'No se pudo conectar a la base de datos. Intenta más tarde.'
    });
  }

  next(err);
}

/**
 * Middleware para manejar errores de autenticación
 */
function authErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError' || err.message === 'No autenticado') {
    return res.status(401).json({
      error: 'No autenticado',
      message: 'Se requiere iniciar sesión para acceder a este recurso'
    });
  }

  if (err.name === 'ForbiddenError' || err.message === 'Acceso denegado') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'No tienes permiso para acceder a este recurso'
    });
  }

  next(err);
}

/**
 * Middleware para manejar errores de archivos
 */
function fileErrorHandler(err, req, res, next) {
  if (err.code === 'FILE_TOO_LARGE') {
    return res.status(413).json({
      error: 'Archivo demasiado grande',
      message: `El archivo excede el tamaño máximo permitido (${err.limit}MB)`
    });
  }

  if (err.message.includes('file type')) {
    return res.status(415).json({
      error: 'Tipo de archivo no soportado',
      message: 'El tipo de archivo no está permitido'
    });
  }

  next(err);
}

/**
 * Middleware de manejo de errores final
 */
function finalErrorHandler(err, req, res, next) {
  console.error('❌ Error no manejado:', err);
  console.error('📋 Stack:', err.stack);

  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: isProduction ? 'Ha ocurrido un error inesperado. Por favor, intenta más tarde.' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

module.exports = {
  validationErrorHandler,
  databaseErrorHandler,
  authErrorHandler,
  fileErrorHandler,
  finalErrorHandler
};