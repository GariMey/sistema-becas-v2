// routes/sesiones.js — Módulo Agustín: Manejo de sesiones activas
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET — listar sesiones activas (solo admin/auditor)
router.get('/', async (req, res) => {
  try {
    const sesiones = await db.queryAll(
      `SELECT s.id_sesion, s.id_usuario, u.nombre, u.rol, s.ip_usuario, s.fecha_creacion, s.fecha_expiracion, s.activa
       FROM sesiones_activas s INNER JOIN usuarios u ON u.id = s.id_usuario
       WHERE s.activa = 1 ORDER BY s.fecha_creacion DESC`
    );
    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// DELETE — cerrar sesión específica
router.delete('/:id', async (req, res) => {
  try {
    await db.queryRun('UPDATE sesiones_activas SET activa = 0 WHERE id_sesion = ?', [req.params.id]);
    res.json({ mensaje: 'Sesión cerrada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

module.exports = router;
