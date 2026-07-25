// routes/suspensiones.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { enviarNotificacionEmail } = require('./emailService');

// GET - Obtener todas las suspensiones
router.get('/', authMiddleware, async (req, res) => {
  try {
    const suspensiones = await db.queryAll('SELECT * FROM suspensiones ORDER BY id DESC');
    res.json(suspensiones);
  } catch (error) {
    console.error('Error obteniendo suspensiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener una suspensión por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const suspension = await db.queryOne('SELECT * FROM suspensiones WHERE id = ?', [req.params.id]);
    if (!suspension) {
      return res.status(404).json({ error: 'Suspensión no encontrada' });
    }
    res.json(suspension);
  } catch (error) {
    console.error('Error obteniendo suspensión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener suspensiones por email de estudiante
router.get('/estudiante/:email', authMiddleware, async (req, res) => {
  try {
    const suspensiones = await db.queryAll(
      'SELECT * FROM suspensiones WHERE email = ? ORDER BY id DESC',
      [req.params.email]
    );
    res.json(suspensiones);
  } catch (error) {
    console.error('Error obteniendo suspensiones del estudiante:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear suspensión o cancelación
router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { email, expediente, tipo, dias, motivo, observaciones, evidencia, nombreEstudiante } = req.body;

    if (!email || !motivo || !observaciones || observaciones.length < 20) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltantes o descripción insuficiente (mínimo 20 caracteres)' 
      });
    }

    const fecha = new Date().toLocaleString();
    const esSuspension = tipo === 'suspension';
    const estadoBeca = esSuspension ? 'Suspendida' : 'Cancelada';
    const diasTexto = esSuspension ? (dias || '30') : 'Cancelada';

    // Insertar en tabla suspensiones
    const result = await db.queryRun(
      `INSERT INTO suspensiones (email, expediente, tipo, dias, motivo, observaciones, fecha, estado, evidencia, nombre_estudiante) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Activa', ?, ?)`,
      [email, expediente, tipo, diasTexto, motivo, observaciones, fecha, evidencia || null, nombreEstudiante || email]
    );

    // Actualizar estado de la solicitud
    if (expediente) {
      await db.queryRun(
        'UPDATE solicitudes SET estado=?, suspension_motivo=?, suspension_observaciones=?, suspension_fecha=? WHERE expediente=?',
        [estadoBeca, motivo, observaciones, fecha, expediente]
      );
    }

    // Registrar en bitácora
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Beca ${esSuspension ? 'suspendida' : 'cancelada'}: ${motivo}`, expediente || '—']
    );

    // ✅ ENVIAR NOTIFICACIÓN POR CORREO AL ESTUDIANTE
    try {
      const resultadoEmail = await enviarNotificacionEmail('beca_suspendida', {
        email: email,
        nombre: nombreEstudiante || email,
        expediente: expediente || '—',
        motivo: motivo,
        dias: esSuspension ? (dias || '30') : 'Indefinida (Cancelación definitiva)',
        observaciones: observaciones,
        tipo: esSuspension ? 'Suspensión temporal' : 'Cancelación definitiva'
      });

      if (resultadoEmail.success) {
        console.log(`📧 Notificación de ${esSuspension ? 'suspensión' : 'cancelación'} enviada a ${email}`);
        
        // Registrar en bitácora el envío del email
        await db.queryRun(
          'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
          [fecha, req.user.email, req.user.rol, `Email de ${esSuspension ? 'suspensión' : 'cancelación'} enviado a ${email}`, expediente || '—']
        );
      } else {
        console.warn(`⚠️ No se pudo enviar notificación de ${esSuspension ? 'suspensión' : 'cancelación'} a ${email}:`, resultadoEmail.error);
      }
    } catch (error) {
      console.error('⚠️ Error enviando notificación email:', error);
      // No fallamos la operación principal
    }

    res.json({ 
      id: result.lastInsertRowid, 
      message: `Beca ${esSuspension ? 'suspendida' : 'cancelada'} correctamente`,
      notificacionEnviada: true
    });
  } catch (error) {
    console.error('Error creando suspensión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Restaurar beca
router.put('/:id/restaurar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos de la suspensión antes de restaurar
    const susp = await db.queryOne('SELECT * FROM suspensiones WHERE id = ?', [id]);
    if (!susp) {
      return res.status(404).json({ error: 'Suspensión no encontrada' });
    }

    // Verificar que esté activa
    if (susp.estado !== 'Activa') {
      return res.status(400).json({ error: 'Esta suspensión ya ha sido resuelta' });
    }

    // Actualizar estado de la suspensión
    await db.queryRun('UPDATE suspensiones SET estado = ? WHERE id = ?', ['Restaurada', id]);

    // Actualizar estado de la solicitud
    if (susp.expediente) {
      await db.queryRun(
        'UPDATE solicitudes SET estado = ?, restaurado_fecha = ? WHERE expediente = ?',
        ['Beneficio Activo', new Date().toLocaleString(), susp.expediente]
      );
    }

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Beca restaurada', susp.expediente || '—']
    );

    // ✅ ENVIAR NOTIFICACIÓN POR CORREO AL ESTUDIANTE
    try {
      const resultadoEmail = await enviarNotificacionEmail('beca_restaurada', {
        email: susp.email,
        nombre: susp.nombre_estudiante || susp.email,
        expediente: susp.expediente || '—',
        fechaRestauracion: fecha
      });

      if (resultadoEmail.success) {
        console.log(`📧 Notificación de restauración enviada a ${susp.email}`);
        
        // Registrar en bitácora el envío del email
        await db.queryRun(
          'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
          [fecha, req.user.email, req.user.rol, `Email de restauración enviado a ${susp.email}`, susp.expediente || '—']
        );
      } else {
        console.warn(`⚠️ No se pudo enviar notificación de restauración a ${susp.email}:`, resultadoEmail.error);
      }
    } catch (error) {
      console.error('⚠️ Error enviando notificación email de restauración:', error);
      // No fallamos la operación principal
    }

    res.json({ 
      message: 'Beca restaurada correctamente',
      notificacionEnviada: true
    });
  } catch (error) {
    console.error('Error restaurando beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE - Eliminar registro de suspensión (solo si está restaurada)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const susp = await db.queryOne('SELECT * FROM suspensiones WHERE id = ?', [id]);
    if (!susp) {
      return res.status(404).json({ error: 'Suspensión no encontrada' });
    }

    // Solo permitir eliminar si está restaurada
    if (susp.estado !== 'Restaurada') {
      return res.status(400).json({ error: 'Solo se pueden eliminar suspensiones resueltas' });
    }

    await db.queryRun('DELETE FROM suspensiones WHERE id = ?', [id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Registro de suspensión eliminado (ID: ${id})`, susp.expediente || '—']
    );

    res.json({ message: 'Registro de suspensión eliminado' });
  } catch (error) {
    console.error('Error eliminando suspensión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;