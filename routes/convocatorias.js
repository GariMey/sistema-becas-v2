const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const convocatorias = await db.queryAll('SELECT * FROM convocatorias ORDER BY id DESC');
    res.json(convocatorias);
  } catch (error) {
    console.error('Error obteniendo convocatorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { nombre, tipo, cupos, fechaApertura, fechaCierre } = req.body;
    if (!nombre || !tipo || !cupos || !fechaApertura || !fechaCierre) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const result = await db.queryRun(
      'INSERT INTO convocatorias (nombre, tipo, cupos, fecha_apertura, fecha_cierre, estado) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, tipo, cupos, fechaApertura, fechaCierre, 'Borrador']
    );
    
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria creada (Borrador)', '—']
    );
    
    res.json({ id: result.lastInsertRowid, message: 'Convocatoria registrada como Borrador' });
  } catch (error) {
    console.error('Error creando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/publicar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    await db.queryRun('UPDATE convocatorias SET estado = ? WHERE id = ?', ['Activa', req.params.id]);
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria publicada', '—']
    );
    res.json({ message: 'Convocatoria publicada' });
  } catch (error) {
    console.error('Error publicando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/cerrar', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    await db.queryRun('UPDATE convocatorias SET estado = ? WHERE id = ?', ['Cerrada', req.params.id]);
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Convocatoria cerrada', '—']
    );
    res.json({ message: 'Convocatoria cerrada' });
  } catch (error) {
    console.error('Error cerrando convocatoria:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;