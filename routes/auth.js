// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    console.log('📧 Email recibido:', email);
    console.log('🔑 Password recibida:', password ? '***' : 'vacía');

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    // Buscar usuario (case insensitive)
    const usuario = await db.queryOne(
      'SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    console.log('👤 Usuario encontrado:', usuario ? usuario.email : 'NO ENCONTRADO');

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (usuario.bloqueado) {
      return res.status(403).json({ error: 'Usuario bloqueado. Contacte al administrador.' });
    }

    // ✅ VERIFICAR CONTRASEÑA CON BCRYPT
    const passwordValido = bcrypt.compareSync(password, usuario.password);
    console.log('🔐 ¿Contraseña válida?', passwordValido);
    console.log('📝 Hash almacenado:', usuario.password);

    if (!passwordValido) {
      const intentos = (usuario.intentos || 0) + 1;
      const bloqueado = intentos >= 3 ? 1 : 0;
      
      await db.queryRun(
        'UPDATE usuarios SET intentos = ?, bloqueado = ? WHERE id = ?',
        [intentos, bloqueado, usuario.id]
      );
      
      return res.status(401).json({ 
        error: `Contraseña incorrecta. Intentos: ${intentos}/3` 
      });
    }

    // ✅ VERIFICAR 2FA
    if (usuario.two_factor_enabled && !twoFactorCode) {
      return res.status(200).json({ 
        require2FA: true, 
        message: 'Ingresa código 2FA: 123456' 
      });
    }

    if (usuario.two_factor_enabled && twoFactorCode !== '123456') {
      return res.status(401).json({ error: 'Código 2FA incorrecto' });
    }

    // Resetear intentos después de login exitoso
    await db.queryRun('UPDATE usuarios SET intentos = 0 WHERE id = ?', [usuario.id]);

    // Registrar en bitácora
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, usuario.nombre, usuario.rol, 'Inicio de sesión', '—']
    );

    res.json({
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/recuperacion', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo es requerido' });
    }

    const usuario = await db.queryOne(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );
    
    if (!usuario) {
      return res.status(404).json({ error: 'No existe una cuenta asociada a este correo' });
    }

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, email, 'visitante', 'Solicitud de recuperación de contraseña', '—']
    );

    res.json({ message: 'Enlace de recuperación enviado (simulado)' });

  } catch (error) {
    console.error('❌ Error en recuperación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;