const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/padron/:cedula
// Consulta UNA cédula a la vez contra el padrón electoral (no expone listados masivos).
router.get('/:cedula', async (req, res) => {
  try {
    const cedula = req.params.cedula.replace(/\D/g, '');
    if (!cedula || cedula.length < 9) {
      return res.status(400).json({ error: 'Cédula inválida' });
    }

    const persona = await db.queryOne(
      `SELECT p.cedula, p.nombre, p.apellido1, p.apellido2, d.provincia, d.canton, d.distrito
       FROM padron_electoral p
       LEFT JOIN distelec d ON p.codelec = d.codelec
       WHERE p.cedula = ?`,
      [cedula]
    );

    if (!persona) {
      return res.status(404).json({ error: 'Cédula no encontrada en el padrón' });
    }

    res.json(persona);
  } catch (error) {
    console.error('Error consultando padrón:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;