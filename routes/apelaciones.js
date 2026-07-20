const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email, rol } = req.user;
    let query = 'SELECT * FROM apelaciones';
    const params = [];
    
    if (rol === 'estudiante') {
      query += ' WHERE email = ?';
      params.push(email);
    }
    query += ' ORDER BY id DESC';
    
    const apelaciones = await db.queryAll(query, params);
    res.json(apelaciones);
  } catch (error) {
    console.error('Error obteniendo apelaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { expediente, email, nombreEstudiante, motivo, archivo, tipoBeca } = req.body;

    if (!expediente || !motivo || motivo.length < 50) {
      return res.status(400).json({ error: 'El motivo debe tener al menos 50 caracteres' });
    }

    const fecha = new Date().toLocaleString();
    const result = await db.queryRun(
      `INSERT INTO apelaciones (expediente, email, nombre_estudiante, motivo, estado, fecha, archivo, tipo_beca) 
       VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?)`,
      [expediente, email, nombreEstudiante, motivo, fecha, archivo || null, tipoBeca || null]
    );

    await db.queryRun('UPDATE solicitudes SET estado = ? WHERE expediente = ?', ['En Apelación', expediente]);

    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Apelación enviada', expediente]
    );

    res.json({ id: result.lastInsertRowid, message: 'Apelación enviada correctamente' });
  } catch (error) {
    console.error('Error creando apelación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:expediente/resolver', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { expediente } = req.params;
    const { decision } = req.body;

    await db.queryRun(
      'UPDATE apelaciones SET estado = ?, decision = ? WHERE expediente = ? AND estado = ?',
      ['Revisada', decision, expediente, 'Pendiente']
    );

    if (decision === 'Revocar Rechazo') {
      await db.queryRun(
        'UPDATE solicitudes SET estado = ?, progreso = 60 WHERE expediente = ?',
        ['En Revisión por Apelación', expediente]
      );
    } else {
      await db.queryRun(
        'UPDATE solicitudes SET estado = ?, progreso = 100 WHERE expediente = ?',
        ['Rechazado Definitivo', expediente]
      );
    }

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Apelación resuelta: ${decision}`, expediente]
    );

    res.json({ message: 'Apelación resuelta' });
  } catch (error) {
    console.error('Error resolviendo apelación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;