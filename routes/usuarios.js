const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const usuarios = await db.queryAll(
      'SELECT id, email, nombre, rol, intentos, bloqueado, two_factor_enabled, created_at FROM usuarios ORDER BY id'
    );
    res.json(usuarios);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, rol, nombre } = req.body;

    if (!email || !nombre || !rol) {
      return res.status(400).json({ error: 'Email, nombre y rol son requeridos' });
    }

    const exists = await db.queryOne('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (exists) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const pwd = bcrypt.hashSync(password || '123456', 10);
    const result = await db.queryRun(
      'INSERT INTO usuarios (email, password, rol, nombre) VALUES (?, ?, ?, ?)',
      [email, pwd, rol, nombre]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario creado: ' + nombre, '—']
    );

    res.json({ id: result.lastInsertRowid, message: 'Usuario creado correctamente' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol } = req.body;

    const usuario = await db.queryOne('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.queryRun(
      'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, updated_at = GETDATE() WHERE id = ?',
      [nombre || usuario.nombre, email || usuario.email, rol || usuario.rol, id]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario editado: ' + (nombre || usuario.nombre), '—']
    );

    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.queryOne('SELECT nombre FROM usuarios WHERE id = ?', [id]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.queryRun('DELETE FROM usuarios WHERE id = ?', [id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario eliminado: ' + usuario.nombre, '—']
    );

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/toggle-2fa', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.queryOne('SELECT two_factor_enabled FROM usuarios WHERE id = ?', [id]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newValue = usuario.two_factor_enabled ? 0 : 1;
    await db.queryRun('UPDATE usuarios SET two_factor_enabled = ? WHERE id = ?', [newValue, id]);

    res.json({ twoFactorEnabled: !!newValue });
  } catch (error) {
    console.error('Error toggling 2FA:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;