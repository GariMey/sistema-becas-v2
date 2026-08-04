// routes/convocatorias.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { enviarNotificacionEmail } = require('../services/emailService');

// GET - Obtener todas las convocatorias
router.get('/', async (req, res) => {
  try {
    const convocatorias = await db.queryAll('SELECT * FROM convocatorias ORDER BY id DESC');
    res.json(convocatorias);
  } catch (error) {
    console.error('Error obteniendo convocatorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener una convocatoria por ID
router.get('/:id', async (req, res) => {
  try {
    const convocatoria = await db.queryOne('SELECT * FROM convocatorias WHERE id = ?', [req.params.id]);
    if (!convocatoria) {
      return res.status(404).json({ error: 'Convocatoria no encontrada' });
    }
    res.json(convocatoria);
  } catch (error) {
    console.error('Error obteniendo convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear convocatoria (Borrador)
router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { nombre, tipo, cupos, fechaApertura, fechaCierre } = req.body;
    
    if (!nombre || !tipo || !cupos || !fechaApertura || !fechaCierre) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const result = await db.queryRun(
      'INSERT INTO convocatorias (nombre, tipo, cupos, fecha_apertura, fecha_cierre, estado) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, tipo, cupos, fechaApertura, fechaCierre, 'Borrador']
    );
    
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria creada (Borrador)', '—']
    );
    
    res.json({ 
      id: result.lastInsertRowid, 
      message: 'Convocatoria registrada como Borrador' 
    });
  } catch (error) {
    console.error('Error creando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Publicar convocatoria (y notificar a estudiantes)
router.put('/:id/publicar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    // Obtener datos de la convocatoria antes de publicar
    const convocatoria = await db.queryOne('SELECT * FROM convocatorias WHERE id = ?', [req.params.id]);
    if (!convocatoria) {
      return res.status(404).json({ error: 'Convocatoria no encontrada' });
    }

    // Actualizar estado a Activa
    await db.queryRun('UPDATE convocatorias SET estado = ? WHERE id = ?', ['Activa', req.params.id]);
    
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria publicada', '—']
    );

    // ✅ ENVIAR NOTIFICACIÓN POR CORREO A TODOS LOS ESTUDIANTES
    let exitos = 0;
    let fallos = 0;
    const errores = [];

    try {
      // Obtener todos los estudiantes
      const estudiantes = await db.queryAll(
        'SELECT email, nombre FROM usuarios WHERE rol = ? AND email IS NOT NULL',
        ['estudiante']
      );

      if (estudiantes.length > 0) {
        console.log(`📧 Enviando notificación de convocatoria a ${estudiantes.length} estudiantes...`);

        for (const est of estudiantes) {
          try {
            const result = await enviarNotificacionEmail('nueva_convocatoria', {
              email: est.email,
              nombre: est.nombre || 'Estudiante',
              convocatoria: convocatoria.nombre,
              tipo: convocatoria.tipo,
              fechaApertura: convocatoria.fecha_apertura,
              fechaCierre: convocatoria.fecha_cierre,
              cupos: convocatoria.cupos
            });
            
            if (result.success) {
              exitos++;
            } else {
              fallos++;
              errores.push({ email: est.email, error: result.error });
            }
          } catch (error) {
            console.error(`❌ Error enviando a ${est.email}:`, error);
            fallos++;
            errores.push({ email: est.email, error: error.message });
          }
        }

        console.log(`📧 Notificación de convocatoria enviada a ${exitos} estudiantes (${fallos} fallos)`);

        // Registrar en bitácora el envío masivo
        await db.queryRun(
          'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
          [fecha, req.user.email, req.user.rol, `Convocatoria notificada por email a ${exitos} estudiantes`, '—']
        );
      } else {
        console.log('ℹ️ No hay estudiantes registrados para notificar');
      }
    } catch (error) {
      console.error('⚠️ Error enviando notificaciones de convocatoria:', error);
      // No fallamos la operación principal, solo registramos el error
    }

    res.json({ 
      message: 'Convocatoria publicada y notificada a los estudiantes',
      notificaciones: {
        total: exitos + fallos,
        exitos: exitos,
        fallos: fallos,
        errores: errores.slice(0, 5) // Solo los primeros 5 errores
      }
    });
  } catch (error) {
    console.error('Error publicando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Cerrar convocatoria
router.put('/:id/cerrar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const convocatoria = await db.queryOne('SELECT * FROM convocatorias WHERE id = ?', [req.params.id]);
    if (!convocatoria) {
      return res.status(404).json({ error: 'Convocatoria no encontrada' });
    }

    await db.queryRun('UPDATE convocatorias SET estado = ? WHERE id = ?', ['Cerrada', req.params.id]);
    
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria cerrada', '—']
    );

    // ✅ ENVIAR NOTIFICACIÓN DE CIERRE A LOS ESTUDIANTES QUE TENÍAN SOLICITUDES EN ESTA CONVOCATORIA
    try {
      // Obtener estudiantes que solicitaron en esta convocatoria
      const estudiantes = await db.queryAll(
        `SELECT DISTINCT u.email, u.nombre 
         FROM solicitudes s 
         JOIN usuarios u ON s.estudiante_email = u.email 
         WHERE s.tipo_beca = ? AND u.rol = ?`,
        [convocatoria.tipo, 'estudiante']
      );

      if (estudiantes.length > 0) {
        console.log(`📧 Enviando notificación de cierre a ${estudiantes.length} estudiantes...`);
        let exitos = 0;
        let fallos = 0;

        for (const est of estudiantes) {
          try {
            const result = await enviarNotificacionEmail('convocatoria_cerrada', {
              email: est.email,
              nombre: est.nombre || 'Estudiante',
              convocatoria: convocatoria.nombre,
              tipo: convocatoria.tipo
            });
            
            if (result.success) {
              exitos++;
            } else {
              fallos++;
            }
          } catch (error) {
            console.error(`❌ Error enviando a ${est.email}:`, error);
            fallos++;
          }
        }

        console.log(`📧 Notificación de cierre enviada a ${exitos} estudiantes (${fallos} fallos)`);

        await db.queryRun(
          'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
          [fecha, req.user.email, req.user.rol, `Cierre de convocatoria notificado a ${exitos} estudiantes`, '—']
        );
      }
    } catch (error) {
      console.error('⚠️ Error enviando notificaciones de cierre:', error);
    }

    res.json({ message: 'Convocatoria cerrada' });
  } catch (error) {
    console.error('Error cerrando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVO: Notificar a todos los estudiantes sobre una convocatoria (sin cambiar estado)
router.post('/:id/notificar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const convocatoria = await db.queryOne('SELECT * FROM convocatorias WHERE id = ?', [req.params.id]);
    if (!convocatoria) {
      return res.status(404).json({ error: 'Convocatoria no encontrada' });
    }

    // Obtener todos los estudiantes
    const estudiantes = await db.queryAll(
      'SELECT email, nombre FROM usuarios WHERE rol = ? AND email IS NOT NULL',
      ['estudiante']
    );

    if (estudiantes.length === 0) {
      return res.json({ 
        message: 'No hay estudiantes registrados para notificar',
        total: 0,
        exitos: 0,
        fallos: 0
      });
    }

    console.log(`📧 Enviando notificación de convocatoria a ${estudiantes.length} estudiantes...`);

    let exitos = 0;
    let fallos = 0;
    const errores = [];

    for (const est of estudiantes) {
      try {
        const result = await enviarNotificacionEmail('nueva_convocatoria', {
          email: est.email,
          nombre: est.nombre || 'Estudiante',
          convocatoria: convocatoria.nombre,
          tipo: convocatoria.tipo,
          fechaApertura: convocatoria.fecha_apertura,
          fechaCierre: convocatoria.fecha_cierre,
          cupos: convocatoria.cupos
        });
        
        if (result.success) {
          exitos++;
        } else {
          fallos++;
          errores.push({ email: est.email, error: result.error });
        }
      } catch (error) {
        console.error(`❌ Error enviando a ${est.email}:`, error);
        fallos++;
        errores.push({ email: est.email, error: error.message });
      }
    }

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Notificación masiva de convocatoria: ${convocatoria.nombre}`, '—']
    );

    console.log(`📧 Notificación de convocatoria enviada a ${exitos} estudiantes (${fallos} fallos)`);

    res.json({
      message: 'Notificaciones procesadas',
      total: estudiantes.length,
      exitos: exitos,
      fallos: fallos,
      errores: errores.slice(0, 10) // Solo los primeros 10 errores
    });
  } catch (error) {
    console.error('Error enviando notificaciones masivas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;