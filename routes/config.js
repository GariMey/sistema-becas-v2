const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT [key], value FROM config');
    const config = {};
    rows.forEach(r => { 
      config[r.key] = isNaN(r.value) ? r.value : Number(r.value); 
    });
    res.json(config);
  } catch (error) {
    console.error('Error obteniendo config:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      const exists = await db.queryOne('SELECT 1 FROM config WHERE [key] = ?', [key]);
      if (exists) {
        await db.queryRun('UPDATE config SET value = ? WHERE [key] = ?', [String(value), key]);
      } else {
        await db.queryRun('INSERT INTO config ([key], value) VALUES (?, ?)', [key, String(value)]);
      }
    }

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Configuración guardada', '—']
    );

    res.json({ message: 'Configuración guardada' });
  } catch (error) {
    console.error('Error guardando config:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;