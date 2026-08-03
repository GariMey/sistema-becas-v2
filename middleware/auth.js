// middleware/auth.js - Autenticación y autorización
const db = require('../database/db');

/**
 * Middleware de autenticación - Verifica que el usuario esté autenticado
 */
async function authMiddleware(req, res, next) {
  try {
    // Obtener credenciales de los headers
    const email = req.headers['x-user-email'];
    const rol = req.headers['x-user-rol'];

    // ============================================================
    // LOGS DE DEPURACIÓN - VER QUÉ ESTÁ LLEGANDO
    // ============================================================
    console.log('🔐 [AUTH] ===== INICIO =====');
    console.log('🔐 [AUTH] Headers recibidos:', {
      'x-user-email': email,
      'x-user-rol': rol,
      'path': req.path,
      'method': req.method,
      'ip': req.ip,
      'user-agent': req.headers['user-agent']
    });
    console.log('🔐 [AUTH] Headers completos:', req.headers);

    if (!email) {
      console.warn('⚠️ [AUTH] No email en headers');
      return res.status(401).json({ 
        error: 'No autenticado', 
        message: 'Se requiere iniciar sesión para acceder a este recurso' 
      });
    }

    // Verificar que el usuario existe en la BD
    console.log(`🔐 [AUTH] Buscando usuario: ${email}`);
    const usuario = await db.queryOne(
      'SELECT * FROM usuarios WHERE email = ? AND bloqueado = 0',
      [email]
    );

    if (!usuario) {
      console.warn(`⚠️ [AUTH] Usuario no encontrado o bloqueado: ${email}`);
      return res.status(401).json({ 
        error: 'No autenticado', 
        message: 'Usuario no encontrado o bloqueado' 
      });
    }

    console.log(`✅ [AUTH] Usuario encontrado:`, {
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      id: usuario.id
    });

    // Agregar usuario a la request
    req.user = {
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      id: usuario.id
    };

    console.log('✅ [AUTH] Autenticación exitosa para:', req.user.email);
    console.log('🔐 [AUTH] ===== FIN =====');
    next();
  } catch (error) {
    console.error('❌ Error en authMiddleware:', error);
    console.error('📋 Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error interno del servidor', 
      message: error.message 
    });
  }
}

/**
 * Middleware de autorización - Verifica que el usuario tenga el rol requerido
 * @param {...string} roles - Roles permitidos
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      console.log('🔐 [ROLE] Verificando rol...');
      console.log('🔐 [ROLE] Usuario:', req.user);
      console.log('🔐 [ROLE] Roles requeridos:', roles);

      if (!req.user) {
        console.warn('⚠️ [ROLE] No hay usuario autenticado');
        return res.status(401).json({ 
          error: 'No autenticado', 
          message: 'Se requiere iniciar sesión' 
        });
      }

      console.log(`🔐 [ROLE] Rol del usuario: ${req.user.rol}`);

      if (!roles.includes(req.user.rol)) {
        console.warn(`⚠️ [ROLE] Acceso denegado. Rol ${req.user.rol} no permitido. Requeridos: ${roles.join(', ')}`);
        return res.status(403).json({ 
          error: 'Acceso denegado', 
          message: `Se requiere uno de los siguientes roles: ${roles.join(', ')}`,
          currentRole: req.user.rol
        });
      }

      console.log('✅ [ROLE] Autorización exitosa para:', req.user.email);
      next();
    } catch (error) {
      console.error('❌ Error en requireRole:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: error.message 
      });
    }
  };
}

/**
 * Middleware opcional - Verifica que el usuario sea el propietario del recurso
 * @param {string} emailField - Campo que contiene el email del propietario
 */
function requireOwner(emailField) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'No autenticado', 
          message: 'Se requiere iniciar sesión' 
        });
      }

      // Si es admin, permitir acceso
      if (req.user.rol === 'admin') {
        return next();
      }

      // Obtener el email del recurso
      const ownerEmail = req.body[emailField] || req.params[emailField] || req.query[emailField];
      
      if (!ownerEmail) {
        return res.status(400).json({ 
          error: 'No se pudo verificar la propiedad del recurso' 
        });
      }

      if (req.user.email !== ownerEmail) {
        return res.status(403).json({ 
          error: 'Acceso denegado', 
          message: 'No eres el propietario de este recurso' 
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error en requireOwner:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: error.message 
      });
    }
  };
}

/**
 * Middleware de rate limiting para login
 */
async function rateLimit(req, res, next) {
  const email = req.body.email;
  
  if (!email) {
    return next();
  }

  try {
    console.log(`📊 [RATE] Verificando rate limit para: ${email}`);
    
    const usuario = await db.queryOne(
      'SELECT intentos, bloqueado FROM usuarios WHERE email = ?',
      [email]
    );

    if (usuario) {
      if (usuario.bloqueado) {
        console.warn(`⚠️ [RATE] Usuario bloqueado: ${email}`);
        return res.status(423).json({ 
          error: 'Cuenta bloqueada', 
          message: 'Esta cuenta ha sido bloqueada por múltiples intentos fallidos. Contacta al administrador.' 
        });
      }

      if (usuario.intentos >= 3) {
        console.warn(`⚠️ [RATE] Demasiados intentos para: ${email}. Bloqueando...`);
        
        // Bloquear usuario automáticamente después de 3 intentos
        await db.queryRun(
          'UPDATE usuarios SET bloqueado = 1 WHERE email = ?',
          [email]
        );
        
        // Registrar en bitácora
        await db.queryRun(
          'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
          [new Date().toLocaleString(), email, 'sistema', 'Usuario bloqueado por múltiples intentos fallidos', '—']
        );

        return res.status(423).json({ 
          error: 'Cuenta bloqueada', 
          message: 'Esta cuenta ha sido bloqueada por múltiples intentos fallidos. Contacta al administrador.' 
        });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Error en rateLimit:', error);
    next();
  }
}

module.exports = {
  authMiddleware,
  requireRole,
  requireOwner,
  rateLimit
};