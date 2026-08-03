const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { activos } = req.query;
    let query = 'SELECT * FROM tipos_beca';
    if (activos === 'true') query += ' WHERE activo = 1';
    query += ' ORDER BY id';
    
    const tipos = await db.queryAll(query);
    res.json(tipos.map(t => ({
      ...t,
      rubros: JSON.parse(t.rubros || '[]'),
      requisitos: JSON.parse(t.requisitos || '[]')
      // ✅ ELIMINADO: camposPersonalizados: JSON.parse(t.campos_personalizados || '[]')
    })));
  } catch (error) {
    console.error('Error obteniendo tipos de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tipo = await db.queryOne('SELECT * FROM tipos_beca WHERE id = ?', [req.params.id]);
    if (!tipo) return res.status(404).json({ error: 'Tipo de beca no encontrado' });
    
    res.json({
      ...tipo,
      rubros: JSON.parse(tipo.rubros || '[]'),
      requisitos: JSON.parse(tipo.requisitos || '[]')
      // ✅ ELIMINADO: camposPersonalizados: JSON.parse(tipo.campos_personalizados || '[]')
    });
  } catch (error) {
    console.error('Error obteniendo tipo de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { nombre, icon, description, min, max, rubros, requisitos, activo } = req.body;
    // ✅ ELIMINADO: camposPersonalizados del destructuring
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const result = await db.queryRun(
      `INSERT INTO tipos_beca (nombre, icon, description, min_pct, max_pct, rubros, requisitos, activo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      // ✅ ELIMINADO: campos_personalizados de VALUES y del array de parámetros
      [nombre, icon || '🎓', description || '', min || 25, max || 100,
       JSON.stringify(rubros || []), JSON.stringify(requisitos || []),
       activo !== false ? 1 : 0]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Tipo de beca creado: ' + nombre, '—']
    );

    res.json({ id: result.lastInsertRowid, message: 'Tipo de beca creado' });
  } catch (error) {
    console.error('Error creando tipo de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, icon, description, min, max, rubros, requisitos, activo } = req.body;
    // ✅ ELIMINADO: camposPersonalizados del destructuring

    await db.queryRun(
      `UPDATE tipos_beca SET nombre=?, icon=?, description=?, min_pct=?, max_pct=?, rubros=?, requisitos=?, activo=?, updated_at=GETDATE() WHERE id=?`,
      // ✅ ELIMINADO: campos_personalizados de la consulta y del array de parámetros
      [nombre, icon, description, min, max,
       JSON.stringify(rubros || []), JSON.stringify(requisitos || []),
       activo ? 1 : 0, id]
    );

    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Tipo de beca actualizado', '—']
    );

    res.json({ message: 'Tipo de beca actualizado' });
  } catch (error) {
    console.error('Error actualizando tipo de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id/toggle', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const tipo = await db.queryOne('SELECT activo FROM tipos_beca WHERE id = ?', [req.params.id]);
    if (!tipo) return res.status(404).json({ error: 'No encontrado' });

    await db.queryRun('UPDATE tipos_beca SET activo = ? WHERE id = ?', [tipo.activo ? 0 : 1, req.params.id]);
    res.json({ activo: !tipo.activo });
  } catch (error) {
    console.error('Error toggling tipo de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.queryRun('DELETE FROM tipos_beca WHERE id = ?', [req.params.id]);
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, 'Tipo de beca eliminado', '—']
    );
    res.json({ message: 'Tipo de beca eliminado' });
  } catch (error) {
    console.error('Error eliminando tipo de beca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;