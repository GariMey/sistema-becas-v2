const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const empleados = await db.queryAll('SELECT * FROM empleados ORDER BY id');
    res.json(empleados);
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { nombre, departamento, cargo, correo, telefono } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const result = await db.queryRun(
      'INSERT INTO empleados (nombre, departamento, cargo, correo, telefono) VALUES (?, ?, ?, ?, ?)',
      [nombre, departamento || '', cargo || '', correo || '', telefono || '']
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Empleado agregado: ${nombre}`, '—']
    );

    res.json({ id: result.lastInsertRowid, message: 'Empleado agregado' });
  } catch (error) {
    console.error('Error creando empleado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, departamento, cargo, correo, telefono } = req.body;

    await db.queryRun(
      'UPDATE empleados SET nombre=?, departamento=?, cargo=?, correo=?, telefono=? WHERE id=?',
      [nombre, departamento, cargo, correo, telefono, id]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Empleado editado: ${nombre}`, '—']
    );

    res.json({ message: 'Empleado actualizado' });
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const emp = await db.queryOne('SELECT nombre FROM empleados WHERE id = ?', [req.params.id]);
    await db.queryRun('DELETE FROM empleados WHERE id = ?', [req.params.id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Empleado eliminado: ${emp?.nombre || 'ID:' + req.params.id}`, '—']
    );

    res.json({ message: 'Empleado eliminado' });
  } catch (error) {
    console.error('Error eliminando empleado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;