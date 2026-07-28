const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET - Obtener todas las visitas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const visitas = await db.queryAll(`
      SELECT 
        id, 
        expediente, 
        fecha, 
        condiciones, 
        coincide, 
        archivo, 
        nombreEstudiante,
        fecha_registro
      FROM visitas 
      ORDER BY id DESC
    `);
    res.json(visitas);
  } catch (error) {
    console.error('Error obteniendo visitas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener visitas por expediente
router.get('/expediente/:expediente', authMiddleware, async (req, res) => {
  try {
    const { expediente } = req.params;
    const visitas = await db.queryAll(
      `SELECT 
        id, 
        expediente, 
        fecha, 
        condiciones, 
        coincide, 
        archivo, 
        nombreEstudiante,
        fecha_registro
      FROM visitas 
      WHERE expediente = @expediente
      ORDER BY fecha DESC`,
      { expediente }
    );
    res.json(visitas);
  } catch (error) {
    console.error('Error obteniendo visitas por expediente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear nueva visita
router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { expediente, fecha, condiciones, coincide, archivo, nombreEstudiante } = req.body;
    
    if (!expediente || !fecha || !condiciones) {
      return res.status(400).json({ error: 'Expediente, fecha y condiciones son obligatorios' });
    }

    const fechaRegistro = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
    
    // Insertar la visita
    const result = await db.queryRun(`
      INSERT INTO visitas (expediente, fecha, condiciones, coincide, archivo, nombreEstudiante, fecha_registro) 
      OUTPUT INSERTED.id, INSERTED.expediente, INSERTED.fecha, INSERTED.condiciones, 
             INSERTED.coincide, INSERTED.archivo, INSERTED.nombreEstudiante, INSERTED.fecha_registro
      VALUES (@expediente, @fecha, @condiciones, @coincide, @archivo, @nombreEstudiante, @fechaRegistro)
    `, {
      expediente,
      fecha,
      condiciones,
      coincide: coincide || 'Sí',
      archivo: archivo || null,
      nombreEstudiante: nombreEstudiante || null,
      fechaRegistro
    });

    // Registrar en bitácora
    await db.queryRun(`
      INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) 
      VALUES (@fecha, @usuario, @rol, @accion, @expediente)
    `, {
      fecha: fechaRegistro,
      usuario: req.user.email,
      rol: req.user.rol,
      accion: 'Visita domiciliaria registrada',
      expediente
    });

    res.json({ 
      id: result.lastInsertRowid || result.id, 
      message: 'Visita registrada correctamente',
      visita: result.recordset ? result.recordset[0] : null
    });
    
  } catch (error) {
    console.error('Error creando visita:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// PUT - Actualizar una visita
router.put('/:id', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { id } = req.params;
    const { expediente, fecha, condiciones, coincide, archivo, nombreEstudiante } = req.body;

    const result = await db.queryRun(`
      UPDATE visitas 
      SET expediente = @expediente,
          fecha = @fecha,
          condiciones = @condiciones,
          coincide = @coincide,
          archivo = @archivo,
          nombreEstudiante = @nombreEstudiante
      WHERE id = @id
    `, {
      id,
      expediente,
      fecha,
      condiciones,
      coincide,
      archivo,
      nombreEstudiante
    });

    if (result.rowsAffected === 0 || result.rowsAffected === undefined) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    // Registrar en bitácora
    await db.queryRun(`
      INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) 
      VALUES (@fecha, @usuario, @rol, @accion, @expediente)
    `, {
      fecha: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
      usuario: req.user.email,
      rol: req.user.rol,
      accion: 'Visita actualizada',
      expediente
    });

    res.json({ message: 'Visita actualizada correctamente' });
    
  } catch (error) {
    console.error('Error actualizando visita:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE - Eliminar una visita
router.delete('/:id', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero obtener el expediente para la bitácora
    const visita = await db.queryOne(
      'SELECT expediente FROM visitas WHERE id = @id',
      { id }
    );

    const result = await db.queryRun(
      'DELETE FROM visitas WHERE id = @id',
      { id }
    );

    if (result.rowsAffected === 0 || result.rowsAffected === undefined) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    // Registrar en bitácora
    if (visita) {
      await db.queryRun(`
        INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) 
        VALUES (@fecha, @usuario, @rol, @accion, @expediente)
      `, {
        fecha: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
        usuario: req.user.email,
        rol: req.user.rol,
        accion: 'Visita eliminada',
        expediente: visita.expediente
      });
    }

    res.json({ message: 'Visita eliminada correctamente' });
    
  } catch (error) {
    console.error('Error eliminando visita:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener estadísticas de visitas
router.get('/estadisticas', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const stats = await db.queryOne(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT expediente) as expedientes_visitados,
        COUNT(CASE WHEN coincide = 'Sí' THEN 1 END) as coinciden_si,
        COUNT(CASE WHEN coincide = 'No' THEN 1 END) as coinciden_no,
        COUNT(CASE WHEN coincide = 'Parcialmente' THEN 1 END) as coinciden_parcial
      FROM visitas
    `);
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;