// routes/usuarios.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET - Obtener todos los usuarios (solo admin)
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const usuarios = await db.queryAll(
      'SELECT id, email, nombre, rol, intentos, bloqueado, two_factor_enabled, created_at FROM usuarios ORDER BY id'
    );
    res.json(usuarios);
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear usuario (solo admin)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, rol, nombre } = req.body;

    console.log('📝 Creando usuario:', { email, rol, nombre });

    if (!email || !nombre || !rol) {
      return res.status(400).json({ error: 'Email, nombre y rol son requeridos' });
    }

    // Verificar si el email ya existe
    const exists = await db.queryOne(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );
    
    if (exists) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    // ✅ HASH DE CONTRASEÑA CON BCRYPT
    const hashedPassword = bcrypt.hashSync(password || '123456', 10);
    console.log('🔐 Hash generado:', hashedPassword);

    const result = await db.queryRun(
      'INSERT INTO usuarios (email, password, rol, nombre) VALUES (?, ?, ?, ?)',
      [email.trim(), hashedPassword, rol, nombre]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario creado: ' + nombre, '—']
    );

    res.json({ 
      id: result.lastInsertRowid, 
      message: 'Usuario creado correctamente' 
    });
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Editar usuario (solo admin)
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol } = req.body;

    const usuario = await db.queryOne('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await db.queryRun(
      'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nombre || usuario.nombre, email || usuario.email, rol || usuario.rol, id]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario editado: ' + (nombre || usuario.nombre), '—']
    );

    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE - Eliminar usuario (solo admin)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.queryOne('SELECT nombre FROM usuarios WHERE id = ?', [id]);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await db.queryRun('DELETE FROM usuarios WHERE id = ?', [id]);

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Usuario eliminado: ' + usuario.nombre, '—']
    );

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('❌ Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Toggle 2FA (solo admin)
router.put('/:id/toggle-2fa', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.queryOne('SELECT two_factor_enabled FROM usuarios WHERE id = ?', [id]);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const newValue = usuario.two_factor_enabled ? 0 : 1;
    await db.queryRun('UPDATE usuarios SET two_factor_enabled = ? WHERE id = ?', [newValue, id]);

    res.json({ twoFactorEnabled: !!newValue });
  } catch (error) {
    console.error('❌ Error toggling 2FA:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;