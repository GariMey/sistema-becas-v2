// routes/chatbot.js — Módulo Agustín: Alimentar el chatbot
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET — listar todas las preguntas (admin/TS)
router.get('/', async (req, res) => {
  try {
    const preguntas = await db.queryAll('SELECT * FROM chatbot_preguntas ORDER BY categoria, pregunta');
    res.json(preguntas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener preguntas del chatbot' });
  }
});

// GET — buscar por palabra clave (estudiante pregunta al bot)
router.get('/buscar', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });
    const resultados = await db.queryAll(
      'SELECT TOP 3 * FROM chatbot_preguntas WHERE activa = 1 AND (pregunta LIKE ? OR respuesta LIKE ?)',
      [`%${q}%`, `%${q}%`]
    );
    res.json(resultados);
  } catch (error) {
    res.status(500).json({ error: 'Error en búsqueda del chatbot' });
  }
});

// POST — crear nueva pregunta
router.post('/', async (req, res) => {
  try {
    const { pregunta, respuesta, categoria } = req.body;
    if (!pregunta || !respuesta) return res.status(400).json({ error: 'Pregunta y respuesta son requeridos' });
    await db.queryRun(
      'INSERT INTO chatbot_preguntas (pregunta, respuesta, categoria, activa) VALUES (?, ?, ?, 1)',
      [pregunta, respuesta, categoria || null]
    );
    res.json({ mensaje: 'Pregunta agregada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear pregunta' });
  }
});

// PUT — actualizar pregunta
router.put('/:id', async (req, res) => {
  try {
    const { pregunta, respuesta, categoria, activa } = req.body;
    await db.queryRun(
      'UPDATE chatbot_preguntas SET pregunta = ?, respuesta = ?, categoria = ?, activa = ? WHERE id_pregunta = ?',
      [pregunta, respuesta, categoria || null, activa !== undefined ? activa : 1, req.params.id]
    );
    res.json({ mensaje: 'Pregunta actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar pregunta' });
  }
});

// DELETE — eliminar pregunta
router.delete('/:id', async (req, res) => {
  try {
    await db.queryRun('DELETE FROM chatbot_preguntas WHERE id_pregunta = ?', [req.params.id]);
    res.json({ mensaje: 'Pregunta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar pregunta' });
  }
});

module.exports = router;
