// routes/informes.js — Módulo Agustín: Generación de informes del comité
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET — generar informe por tipo
router.get('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const { generado_por } = req.query;

    let datos = [];
    if (tipo === 'aprobadas') {
      datos = await db.queryAll(`SELECT * FROM solicitudes WHERE estado = 'aprobada'`);
    } else if (tipo === 'rechazadas') {
      datos = await db.queryAll(`SELECT * FROM solicitudes WHERE estado = 'rechazada'`);
    } else if (tipo === 'suspendidas') {
      datos = await db.queryAll(`SELECT * FROM suspensiones`);
    } else {
      datos = await db.queryAll(`SELECT * FROM solicitudes ORDER BY created_at DESC`);
    }

    // Registrar el informe generado
    if (generado_por) {
      await db.queryRun(
        `INSERT INTO informes_generados (tipo_informe, formato, generado_por) VALUES (?, 'json', ?)`,
        [tipo, generado_por]
      );
    }

    res.json({ tipo, total: datos.length, datos });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar informe' });
  }
});

// GET — historial de informes generados
router.get('/', async (req, res) => {
  try {
    const informes = await db.queryAll(
      `SELECT i.*, u.nombre AS generado_por_nombre
       FROM informes_generados i
       INNER JOIN usuarios u ON u.id = i.generado_por
       ORDER BY i.fecha_generacion DESC`
    );
    res.json(informes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de informes' });
  }
});

module.exports = router;
