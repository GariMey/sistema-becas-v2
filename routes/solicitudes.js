// routes/solicitudes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// GET - Obtener todas las solicitudes (con filtros)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email, rol } = req.user;
    const { estado, search, tipoBeca } = req.query;

    let query = 'SELECT * FROM solicitudes';
    const params = [];
    const conditions = [];

    if (rol === 'estudiante') {
      conditions.push('estudiante_email = ?');
      params.push(email);
    }

    if (estado) {
      conditions.push('estado = ?');
      params.push(estado);
    }

    if (tipoBeca) {
      conditions.push('tipo_beca = ?');
      params.push(tipoBeca);
    }

    if (search) {
      conditions.push('(nombres LIKE ? OR apellidos LIKE ? OR cedula LIKE ? OR expediente LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';
    
    const solicitudes = await db.queryAll(query, params);

    const result = [];
    for (const s of solicitudes) {
      // ✅ CORREGIDO: Usar expediente en lugar de solicitud_id
      const documentos = await db.queryAll(
        'SELECT * FROM documentos WHERE expediente = ?',
        [s.expediente]
      );
      
      const docsMap = {};
      documentos.forEach(d => {
        docsMap[d.doc_key] = {
          id: d.id,
          label: d.label,
          nombre: d.nombre,
          tipo: d.tipo,
          tamano: d.tamano,
          fecha: d.fecha,
          datos: d.datos,
          estado: d.estado,
          observacion: d.observacion || '',
          url: `/api/documentos/${d.id}`
        };
      });
      
      result.push({ 
        ...s, 
        documentos: docsMap, 
        datos_completos: JSON.parse(s.datos_completos || '{}') 
      });
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo solicitudes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener una solicitud por expediente
router.get('/:expediente', authMiddleware, async (req, res) => {
  try {
    const solicitud = await db.queryOne(
      'SELECT * FROM solicitudes WHERE expediente = ?',
      [req.params.expediente]
    );
    
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // ✅ CORREGIDO: Usar expediente en lugar de solicitud_id
    const documentos = await db.queryAll(
      'SELECT * FROM documentos WHERE expediente = ?',
      [solicitud.expediente]
    );
    
    const docsMap = {};
    documentos.forEach(d => {
      docsMap[d.doc_key] = {
        id: d.id,
        label: d.label,
        nombre: d.nombre,
        tipo: d.tipo,
        tamano: d.tamano,
        fecha: d.fecha,
        datos: d.datos,
        estado: d.estado,
        observacion: d.observacion || '',
        url: `/api/documentos/${d.id}`
      };
    });

    res.json({ 
      ...solicitud, 
      documentos: docsMap, 
      datos_completos: JSON.parse(solicitud.datos_completos || '{}') 
    });
  } catch (error) {
    console.error('❌ Error obteniendo solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear una nueva solicitud
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      expediente, fecha, estudianteEmail, nombres, apellidos, cedula, correo, telefono,
      tipoBeca, estado, progreso, puntaje, promedio, ingresoFamiliar,
      datosCompletos, documentos, aceptado, porcentajeCobertura, observacionTS
    } = req.body;

    if (!expediente) {
      return res.status(400).json({ error: 'El expediente es requerido' });
    }
    
    if (!estudianteEmail) {
      return res.status(400).json({ error: 'El correo del estudiante es requerido' });
    }

    // Insertar solicitud
    const result = await db.queryRun(`
      INSERT INTO solicitudes (
        expediente, fecha, estudiante_email, nombres, apellidos, cedula, 
        correo, telefono, tipo_beca, estado, progreso, puntaje, promedio, 
        ingreso_familiar, datos_completos, aceptado, porcentaje_cobertura, observacion_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expediente, 
      fecha || new Date().toISOString().slice(0, 10), 
      estudianteEmail, 
      nombres, 
      apellidos, 
      cedula || '', 
      correo || estudianteEmail, 
      telefono || '',
      tipoBeca, 
      estado || 'Enviada', 
      progreso || 10, 
      puntaje || 0, 
      promedio || 0, 
      ingresoFamiliar || 0,
      JSON.stringify(datosCompletos || {}), 
      aceptado ? 1 : 0, 
      porcentajeCobertura || null, 
      observacionTS || 'Pendiente de revisión por trabajador social.'
    ]);

    // ✅ CORREGIDO: Insertar documentos usando expediente
    if (documentos && typeof documentos === 'object' && Object.keys(documentos).length > 0) {
      for (const [key, doc] of Object.entries(documentos)) {
        try {
          if (!doc.datos && !doc.nombre) {
            console.warn(`⚠️ Documento "${key}" sin datos, omitiendo...`);
            continue;
          }

          await db.queryRun(`
            INSERT INTO documentos (
              expediente, doc_key, label, nombre, tipo, tamano, fecha, datos, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            expediente,  // ✅ Usar expediente en lugar de solicitud_id
            key, 
            doc.label || key, 
            doc.nombre || 'documento',
            doc.tipo || 'application/octet-stream',
            doc.tamano || 0,
            doc.fecha || new Date().toISOString(),
            doc.datos || null,
            doc.estado || 'Pendiente'
          ]);
        } catch (docError) {
          console.error(`❌ Error insertando documento "${key}":`, docError.message);
        }
      }
    }

    // Registrar en bitácora
    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, 'Solicitud creada', expediente]
    );

    res.json({ 
      id: result.lastInsertRowid, 
      expediente, 
      message: 'Solicitud enviada correctamente'
    });
  } catch (error) {
    console.error('❌ Error creando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Actualizar una solicitud existente
router.put('/:expediente', authMiddleware, async (req, res) => {
  try {
    const { expediente } = req.params;
    const updates = req.body;

    const solicitudActual = await db.queryOne(
      'SELECT * FROM solicitudes WHERE expediente = ?',
      [expediente]
    );
    
    if (!solicitudActual) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const fields = [];
    const values = [];

    const allowedFields = {
      estado: 'estado',
      progreso: 'progreso',
      puntaje: 'puntaje',
      promedio: 'promedio',
      ingresoFamiliar: 'ingreso_familiar',
      aceptado: 'aceptado',
      porcentajeCobertura: 'porcentaje_cobertura',
      observacionTS: 'observacion_ts',
      observacionesComite: 'observaciones_comite',
      motivoRechazo: 'motivo_rechazo'
    };

    for (const [jsField, dbField] of Object.entries(allowedFields)) {
      if (updates[jsField] !== undefined) {
        fields.push(`${dbField} = ?`);
        values.push(jsField === 'aceptado' ? (updates[jsField] ? 1 : 0) : updates[jsField]);
      }
    }

    if (updates.datosCompletos) {
      fields.push('datos_completos = ?');
      values.push(JSON.stringify(updates.datosCompletos));
    }

    if (fields.length > 0) {
      fields.push('updated_at = GETDATE()');
      values.push(expediente);
      await db.queryRun(`UPDATE solicitudes SET ${fields.join(', ')} WHERE expediente = ?`, values);
    }

    // ✅ CORREGIDO: Actualizar documentos usando expediente
    if (updates.documentos && typeof updates.documentos === 'object') {
      for (const [key, doc] of Object.entries(updates.documentos)) {
        try {
          const existing = await db.queryOne(
            'SELECT id FROM documentos WHERE expediente = ? AND doc_key = ?',
            [expediente, key]
          );
          
          if (existing) {
            await db.queryRun(
              `UPDATE documentos SET 
                label = ?, nombre = ?, tipo = ?, tamano = ?, 
                fecha = ?, datos = ?, estado = ?, observacion = ? 
              WHERE id = ?`,
              [
                doc.label || key, 
                doc.nombre || 'documento',
                doc.tipo || 'application/octet-stream',
                doc.tamano || 0,
                doc.fecha || new Date().toISOString(),
                doc.datos || null,
                doc.estado || 'Pendiente',
                doc.observacion || '',
                existing.id
              ]
            );
          } else {
            await db.queryRun(
              `INSERT INTO documentos (
                expediente, doc_key, label, nombre, tipo, tamano, fecha, datos, estado, observacion
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                expediente,  // ✅ Usar expediente
                key, 
                doc.label || key,
                doc.nombre || 'documento',
                doc.tipo || 'application/octet-stream',
                doc.tamano || 0,
                doc.fecha || new Date().toISOString(),
                doc.datos || null,
                doc.estado || 'Pendiente',
                doc.observacion || ''
              ]
            );
          }
        } catch (docError) {
          console.error(`❌ Error actualizando documento "${key}":`, docError.message);
        }
      }
    }

    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, 'Solicitud actualizada', expediente]
    );

    res.json({ 
      message: 'Solicitud actualizada',
      expediente: expediente
    });
  } catch (error) {
    console.error('❌ Error actualizando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE - Eliminar una solicitud
router.delete('/:expediente', authMiddleware, async (req, res) => {
  try {
    const { expediente } = req.params;

    const solicitud = await db.queryOne(
      'SELECT * FROM solicitudes WHERE expediente = ?',
      [expediente]
    );
    
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // ✅ CORREGIDO: Usar expediente en lugar de solicitud_id
    await db.queryRun('DELETE FROM documentos WHERE expediente = ?', [expediente]);
    await db.queryRun('DELETE FROM solicitudes WHERE expediente = ?', [expediente]);

    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, 'Solicitud eliminada', expediente]
    );

    res.json({ 
      message: 'Solicitud eliminada correctamente',
      expediente: expediente
    });
  } catch (error) {
    console.error('❌ Error eliminando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;