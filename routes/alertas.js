const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, requireRole('admin', 'auditor'), async (req, res) => {
  try {
    const alertas = await db.queryAll('SELECT * FROM alertas_seguridad ORDER BY id DESC');
    res.json(alertas);
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/revisar', authMiddleware, requireRole('admin', 'auditor'), async (req, res) => {
  try {
    await db.queryRun('UPDATE alertas_seguridad SET estado = ? WHERE id = ?', ['Revisada', req.params.id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Alerta ${req.params.id} marcada como revisada`, '—']
    );

    res.json({ message: 'Alerta revisada' });
  } catch (error) {
    console.error('Error revisando alerta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;