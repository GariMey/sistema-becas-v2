const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const visitas = await db.queryAll('SELECT * FROM visitas ORDER BY id DESC');
    res.json(visitas);
  } catch (error) {
    console.error('Error obteniendo visitas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { expediente, fecha, condiciones, coincide, archivo } = req.body;
    if (!expediente || !fecha || !condiciones) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const fechaRegistro = new Date().toLocaleString();
    const result = await db.queryRun(
      'INSERT INTO visitas (expediente, fecha, condiciones, coincide, archivo, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)',
      [expediente, fecha, condiciones, coincide, archivo || null, fechaRegistro]
    );

    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaRegistro, req.user.email, req.user.rol, 'Visita domiciliaria registrada', expediente]
    );

    res.json({ id: result.lastInsertRowid, message: 'Visita registrada' });
  } catch (error) {
    console.error('Error creando visita:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;