// routes/votaciones.js — Módulo Agustín: Herramientas del comité
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET — listar solicitudes para votar
router.get('/pendientes', async (req, res) => {
  try {
    const solicitudes = await db.queryAll(
      `SELECT * FROM solicitudes WHERE estado IN ('en_comite', 'enviada') ORDER BY created_at ASC`
    );
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes para comité' });
  }
});

// GET — votos por expediente
router.get('/:expediente', async (req, res) => {
  try {
    const votos = await db.queryAll(
      `SELECT v.*, u.nombre FROM votaciones_comite v
       INNER JOIN usuarios u ON u.id = v.id_miembro_comite
       WHERE v.expediente = ? ORDER BY v.fecha_voto ASC`,
      [req.params.expediente]
    );
    res.json(votos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener votos' });
  }
});

// POST — registrar voto del comité
router.post('/', async (req, res) => {
  try {
    const { expediente, id_miembro_comite, decision, observaciones, porcentaje_cobertura } = req.body;
    if (!expediente || !decision) return res.status(400).json({ error: 'Expediente y decisión son requeridos' });

    await db.queryRun(
      `INSERT INTO votaciones_comite (expediente, id_miembro_comite, decision, observaciones, porcentaje_cobertura)
       VALUES (?, ?, ?, ?, ?)`,
      [expediente, id_miembro_comite, decision, observaciones || null, porcentaje_cobertura || null]
    );

    // Actualizar estado de la solicitud
    const nuevoEstado = decision === 'aprobada' ? 'aprobada' : 'rechazada';
    await db.queryRun(
      `UPDATE solicitudes SET estado = ?, porcentaje_otorgado = ?, observaciones_comite = ? WHERE expediente = ?`,
      [nuevoEstado, porcentaje_cobertura || null, observaciones || null, expediente]
    );

    res.json({ mensaje: `Solicitud ${nuevoEstado} correctamente` });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

module.exports = router;
