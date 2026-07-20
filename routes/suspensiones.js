const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const suspensiones = await db.queryAll('SELECT * FROM suspensiones ORDER BY id DESC');
    res.json(suspensiones);
  } catch (error) {
    console.error('Error obteniendo suspensiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { email, expediente, tipo, dias, motivo, observaciones, evidencia, nombreEstudiante } = req.body;

    if (!email || !motivo || !observaciones || observaciones.length < 20) {
      return res.status(400).json({ error: 'Campos requeridos faltantes o descripción insuficiente' });
    }

    const fecha = new Date().toLocaleString();
    const result = await db.queryRun(
      `INSERT INTO suspensiones (email, expediente, tipo, dias, motivo, observaciones, fecha, estado, evidencia, nombre_estudiante) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Activa', ?, ?)`,
      [email, expediente, tipo, tipo === 'suspension' ? (dias || '30') : 'Cancelada',
       motivo, observaciones, fecha, evidencia || null, nombreEstudiante || email]
    );

    // Update solicitud state
    if (expediente) {
      const estado = tipo === 'suspension' ? 'Suspendida' : 'Cancelada';
      await db.queryRun(
        'UPDATE solicitudes SET estado=?, suspension_motivo=?, suspension_observaciones=?, suspension_fecha=? WHERE expediente=?',
        [estado, motivo, observaciones, fecha, expediente]
      );
    }

    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Beca ${tipo === 'suspension' ? 'suspendida' : 'cancelada'}: ${motivo}`, expediente || '—']
    );

    res.json({ id: result.lastInsertRowid, message: `Beca ${tipo === 'suspension' ? 'suspendida' : 'cancelada'} correctamente` });
  } catch (error) {
    console.error('Error creando suspensión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/restaurar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { id } = req.params;

    const susp = await db.queryOne('SELECT * FROM suspensiones WHERE id = ?', [id]);
    if (!susp) return res.status(404).json({ error: 'Suspensión no encontrada' });

    await db.queryRun('UPDATE suspensiones SET estado = ? WHERE id = ?', ['Restaurada', id]);

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

    res.json({ message: 'Beca restaurada correctamente' });
  } catch (error) {
    console.error('Error restaurando beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;