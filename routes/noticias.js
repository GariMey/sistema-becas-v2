const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const noticias = await db.queryAll('SELECT * FROM noticias ORDER BY id DESC');
    res.json(noticias);
  } catch (error) {
    console.error('Error obteniendo noticias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { titulo, contenido, idEdicion } = req.body;
    if (!titulo || !contenido) return res.status(400).json({ error: 'Título y contenido son requeridos' });

    const fecha = new Date().toLocaleDateString();
    if (idEdicion) {
      await db.queryRun('UPDATE noticias SET titulo=?, contenido=?, fecha_edicion=? WHERE id=?', [titulo, contenido, fecha, idEdicion]);
      const fechaNow = new Date().toLocaleString();
      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [fechaNow, req.user.email, req.user.rol, 'Noticia editada', '—']
      );
      res.json({ message: 'Noticia actualizada' });
    } else {
      const result = await db.queryRun('INSERT INTO noticias (titulo, contenido, fecha) VALUES (?, ?, ?)', [titulo, contenido, fecha]);
      const fechaNow = new Date().toLocaleString();
      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [fechaNow, req.user.email, req.user.rol, 'Noticia publicada', '—']
      );
      res.json({ id: result.lastInsertRowid, message: 'Noticia publicada' });
    }
  } catch (error) {
    console.error('Error creando noticia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    await db.queryRun('DELETE FROM noticias WHERE id = ?', [req.params.id]);
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Noticia eliminada', '—']
    );
    res.json({ message: 'Noticia eliminada' });
  } catch (error) {
    console.error('Error eliminando noticia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;