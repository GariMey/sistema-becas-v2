const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email, rol } = req.user;
    const { estado } = req.query;

    let query = 'SELECT * FROM justificaciones';
    const params = [];
    const conditions = [];

    if (rol === 'estudiante') {
      conditions.push('estudiante_email = ?');
      params.push(email);
    }
    if (estado && estado !== 'todas') {
      conditions.push('estado = ?');
      params.push(estado);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY id DESC';

    const justificaciones = await db.queryAll(query, params);
    res.json(justificaciones);
  } catch (error) {
    console.error('Error obteniendo justificaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { curso, codigo, periodo, nota, motivo, archivo, email, nombreEstudiante } = req.body;

    if (!curso || !codigo || !periodo || !motivo) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const fecha = new Date().toLocaleString();
    const result = await db.queryRun(
      `INSERT INTO justificaciones (estudiante_email, nombre_estudiante, curso, codigo, periodo, nota, motivo, estado, fecha, archivo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?)`,
      [email, nombreEstudiante || email, curso, codigo, periodo, nota || null, motivo, fecha, archivo || null]
    );

    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Justificación enviada: ${curso} (${codigo})`, '—']
    );

    res.json({ id: result.lastInsertRowid, message: 'Justificación enviada correctamente' });
  } catch (error) {
    console.error('Error creando justificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/revisar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observacion } = req.body;

    await db.queryRun('UPDATE justificaciones SET estado=?, observacion=? WHERE id=?', [estado, observacion || '', id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Justificación ${estado}`, '—']
    );

    res.json({ message: `Justificación ${estado}` });
  } catch (error) {
    console.error('Error revisando justificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;