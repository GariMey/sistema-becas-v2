const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    const bitacora = await db.queryAll(
      'SELECT TOP ? * FROM bitacora ORDER BY id DESC',
      [parseInt(limit) || 100]
    );
    res.json(bitacora);
  } catch (error) {
    console.error('Error obteniendo bitácora:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;