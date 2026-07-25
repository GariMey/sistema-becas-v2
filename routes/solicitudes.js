// routes/solicitudes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { enviarNotificacionEmail } = require('./emailService');

// GET - Obtener solicitudes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email, rol } = req.user;
    const { estado, search } = req.query;

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

    // Adjuntar documentos
    const result = [];
    for (const s of solicitudes) {
      const documentos = await db.queryAll('SELECT * FROM documentos WHERE solicitud_id = ?', [s.id]);
      const docsMap = {};
      documentos.forEach(d => {
        docsMap[d.doc_key] = {
          label: d.label,
          nombre: d.nombre,
          tipo: d.tipo,
          tamano: d.tamano,
          fecha: d.fecha,
          datos: d.datos,
          estado: d.estado,
          observacion: d.observacion || ''
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
    console.error('Error obteniendo solicitudes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener una solicitud por expediente
router.get('/:expediente', authMiddleware, async (req, res) => {
  try {
    const solicitud = await db.queryOne('SELECT * FROM solicitudes WHERE expediente = ?', [req.params.expediente]);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const documentos = await db.queryAll('SELECT * FROM documentos WHERE solicitud_id = ?', [solicitud.id]);
    const docsMap = {};
    documentos.forEach(d => {
      docsMap[d.doc_key] = {
        label: d.label,
        nombre: d.nombre,
        tipo: d.tipo,
        tamano: d.tamano,
        fecha: d.fecha,
        datos: d.datos,
        estado: d.estado,
        observacion: d.observacion || ''
      };
    });

    res.json({ ...solicitud, documentos: docsMap, datos_completos: JSON.parse(solicitud.datos_completos || '{}') });
  } catch (error) {
    console.error('Error obteniendo solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear solicitud
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      expediente, fecha, estudianteEmail, nombres, apellidos, cedula, correo, telefono,
      tipoBeca, estado, progreso, puntaje, promedio, ingresoFamiliar,
      datosCompletos, documentos, aceptado, porcentajeCobertura, observacionTS
    } = req.body;

    const result = await db.queryRun(`
      INSERT INTO solicitudes (expediente, fecha, estudiante_email, nombres, apellidos, cedula, correo, telefono, tipo_beca, estado, progreso, puntaje, promedio, ingreso_familiar, datos_completos, aceptado, porcentaje_cobertura, observacion_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expediente, fecha, estudianteEmail, nombres, apellidos, cedula, correo, telefono || '',
      tipoBeca, estado || 'Enviada', progreso || 10, puntaje || 0, promedio || 0, ingresoFamiliar || 0,
      JSON.stringify(datosCompletos || {}), aceptado ? 1 : 0, porcentajeCobertura || null, observacionTS || 'Pendiente de revisión por trabajador social.'
    ]);

    // Insertar documentos
    if (documentos && typeof documentos === 'object') {
      for (const [key, doc] of Object.entries(documentos)) {
        await db.queryRun(`
          INSERT INTO documentos (solicitud_id, doc_key, label, nombre, tipo, tamano, fecha, datos, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [result.lastInsertRowid, key, doc.label || key, doc.nombre, doc.tipo, doc.tamano, doc.fecha || new Date().toISOString(), doc.datos, doc.estado || 'Pendiente']);
      }
    }

    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, 'Solicitud creada', expediente]
    );

    // ✅ ENVIAR NOTIFICACIÓN DE SOLICITUD RECIBIDA
    try {
      await enviarNotificacionEmail('solicitud_recibida', {
        email: estudianteEmail,
        nombre: nombres,
        expediente: expediente,
        tipoBeca: tipoBeca,
        fecha: fecha || new Date().toLocaleDateString()
      });
    } catch (error) {
      console.warn('⚠️ No se pudo enviar notificación email:', error);
    }

    res.json({ id: result.lastInsertRowid, expediente, message: 'Solicitud enviada correctamente' });
  } catch (error) {
    console.error('Error creando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT - Actualizar solicitud
router.put('/:expediente', authMiddleware, async (req, res) => {
  try {
    const { expediente } = req.params;
    const updates = req.body;

    // Obtener la solicitud actual antes de actualizar
    const solicitudActual = await db.queryOne('SELECT * FROM solicitudes WHERE expediente = ?', [expediente]);
    if (!solicitudActual) return res.status(404).json({ error: 'Solicitud no encontrada' });

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
      motivoRechazo: 'motivo_rechazo',
      suspensionMotivo: 'suspension_motivo',
      suspensionObservaciones: 'suspension_observaciones',
      suspensionFecha: 'suspension_fecha',
      restauradoFecha: 'restaurado_fecha',
      fechaCierre: 'fecha_cierre'
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

    // Actualizar documentos si se proporcionan
    if (updates.documentos && typeof updates.documentos === 'object') {
      for (const [key, doc] of Object.entries(updates.documentos)) {
        const existing = await db.queryOne('SELECT id FROM documentos WHERE solicitud_id = ? AND doc_key = ?', [solicitudActual.id, key]);
        if (existing) {
          await db.queryRun(
            `UPDATE documentos SET label=?, nombre=?, tipo=?, tamano=?, fecha=?, datos=?, estado=?, observacion=? WHERE id=?`,
            [doc.label || key, doc.nombre, doc.tipo, doc.tamano, doc.fecha, doc.datos, doc.estado || 'Pendiente', doc.observacion || '', existing.id]
          );
        } else {
          await db.queryRun(
            `INSERT INTO documentos (solicitud_id, doc_key, label, nombre, tipo, tamano, fecha, datos, estado, observacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [solicitudActual.id, key, doc.label || key, doc.nombre, doc.tipo, doc.tamano, doc.fecha, doc.datos, doc.estado || 'Pendiente', doc.observacion || '']
          );
        }
      }
    }

    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, 'Solicitud actualizada', expediente]
    );

    // ✅ DETECTAR CAMBIOS DE ESTADO Y ENVIAR NOTIFICACIONES
    if (updates.estado && updates.estado !== solicitudActual.estado) {
      const nuevoEstado = updates.estado;
      
      if (nuevoEstado === 'Pendiente subsanación') {
        // Obtener documentos pendientes
        const documentos = await db.queryAll('SELECT * FROM documentos WHERE solicitud_id = ?', [solicitudActual.id]);
        const docsPendientes = documentos
          .filter(d => d.estado === 'Corrección solicitada' || d.estado === 'Rechazado')
          .map(d => ({ label: d.label || d.doc_key, observacion: d.observacion || 'Requiere corrección' }));
        
        try {
          await enviarNotificacionEmail('subsanacion_requerida', {
            email: solicitudActual.estudiante_email,
            nombre: solicitudActual.nombres,
            expediente: expediente,
            documentosPendientes: docsPendientes
          });
        } catch (error) {
          console.warn('⚠️ No se pudo enviar notificación de subsanación:', error);
        }
      }
      
      if (nuevoEstado === 'Aprobada' || nuevoEstado === 'Beneficio Activo') {
        try {
          await enviarNotificacionEmail('solicitud_aprobada', {
            email: solicitudActual.estudiante_email,
            nombre: solicitudActual.nombres,
            expediente: expediente,
            tipoBeca: solicitudActual.tipo_beca,
            porcentajeCobertura: updates.porcentajeCobertura || solicitudActual.porcentaje_cobertura || '—',
            observaciones: updates.observacionesComite || solicitudActual.observaciones_comite
          });
        } catch (error) {
          console.warn('⚠️ No se pudo enviar notificación de aprobación:', error);
        }
      }
      
      if (nuevoEstado === 'Rechazada' || nuevoEstado === 'Rechazado Definitivo' || nuevoEstado === 'No elegible') {
        try {
          await enviarNotificacionEmail('solicitud_rechazada', {
            email: solicitudActual.estudiante_email,
            nombre: solicitudActual.nombres,
            expediente: expediente,
            motivoRechazo: updates.motivoRechazo || solicitudActual.motivo_rechazo || 'No cumple con los requisitos establecidos para este tipo de beca.'
          });
        } catch (error) {
          console.warn('⚠️ No se pudo enviar notificación de rechazo:', error);
        }
      }
    }

    res.json({ message: 'Solicitud actualizada' });
  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;