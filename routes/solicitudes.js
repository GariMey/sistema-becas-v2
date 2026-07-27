// routes/solicitudes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// ===================================================================
// CONSTANTES
// ===================================================================
const VALID_STATES = [
  'Enviada', 'En revisión TS', 'Pendiente subsanación', 
  'Elegible', 'En comité', 'Aprobada', 'Rechazada', 
  'Rechazado Definitivo', 'Beneficio Activo', 'Suspendida', 
  'Cancelada', 'Restaurada', 'No elegible'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

// ===================================================================
// FUNCIONES AUXILIARES
// ===================================================================
async function generarExpediente() {
  const year = new Date().getFullYear();
  const lastSolicitud = await db.queryOne(
    'SELECT expediente FROM solicitudes ORDER BY id DESC LIMIT 1'
  );
  let num = 1;
  if (lastSolicitud && lastSolicitud.expediente) {
    const lastNum = parseInt(lastSolicitud.expediente.split('-').pop());
    if (!isNaN(lastNum)) num = lastNum + 1;
  }
  return `BC-${year}-${String(num).padStart(3, '0')}`;
}

function validarDocumento(doc) {
  if (doc.tamano && doc.tamano > MAX_FILE_SIZE) {
    throw new Error(`El archivo excede el tamaño máximo de 10MB`);
  }
  if (doc.tipo && !ALLOWED_FILE_TYPES.includes(doc.tipo)) {
    throw new Error(`Formato no permitido. Use PDF, JPG o PNG`);
  }
}

// ===================================================================
// RUTAS
// ===================================================================

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
      if (!VALID_STATES.includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
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

    // Verificar permisos
    if (req.user.rol === 'estudiante' && solicitud.estudiante_email !== req.user.email) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta solicitud' });
    }

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
      fecha, estudianteEmail, nombres, apellidos, cedula, correo, telefono,
      tipoBeca, estado, progreso, puntaje, promedio, ingresoFamiliar,
      datosCompletos, documentos, aceptado, porcentajeCobertura, observacionTS
    } = req.body;

    // ===== VALIDACIONES =====
    if (!estudianteEmail) {
      return res.status(400).json({ error: 'El correo del estudiante es requerido' });
    }

    // Verificar que el estudiante exista
    const estudiante = await db.queryOne(
      'SELECT email, nombre FROM usuarios WHERE email = ? AND rol = "estudiante"',
      [estudianteEmail]
    );
    
    if (!estudiante) {
      return res.status(400).json({ 
        error: 'El correo no corresponde a un estudiante registrado' 
      });
    }

    // Verificar que el tipo de beca existe
    if (tipoBeca) {
      const tipoBecaExists = await db.queryOne(
        'SELECT id FROM tipos_beca WHERE nombre = ? AND activo = 1',
        [tipoBeca]
      );
      
      if (!tipoBecaExists) {
        return res.status(400).json({ 
          error: 'El tipo de beca seleccionado no existe o está inactivo' 
        });
      }
    }

    // Validar estado si viene
    if (estado && !VALID_STATES.includes(estado)) {
      return res.status(400).json({ 
        error: `Estado inválido. Estados permitidos: ${VALID_STATES.join(', ')}` 
      });
    }

    // Validar documentos
    if (documentos && typeof documentos === 'object') {
      for (const [key, doc] of Object.entries(documentos)) {
        try {
          validarDocumento(doc);
        } catch (err) {
          return res.status(400).json({ 
            error: `Documento "${key}": ${err.message}` 
          });
        }
      }
    }

    // ===== GENERAR EXPEDIENTE =====
    let expediente = req.body.expediente;
    if (!expediente) {
      expediente = await generarExpediente();
    }

    // Verificar que el expediente no exista
    const existing = await db.queryOne(
      'SELECT expediente FROM solicitudes WHERE expediente = ?',
      [expediente]
    );
    if (existing) {
      return res.status(400).json({ 
        error: `El expediente ${expediente} ya existe` 
      });
    }

    // ===== INICIAR TRANSACCIÓN =====
    await db.queryRun('BEGIN TRANSACTION');

    try {
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
        nombres || estudiante.nombre || 'Estudiante', 
        apellidos || '', 
        cedula || '', 
        correo || estudianteEmail, 
        telefono || '',
        tipoBeca || 'Socioeconómica', 
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

      // Insertar documentos
      if (documentos && typeof documentos === 'object' && Object.keys(documentos).length > 0) {
        for (const [key, doc] of Object.entries(documentos)) {
          try {
            if (!doc.datos && !doc.nombre) {
              console.warn(`⚠️ Documento "${key}" sin datos, omitiendo...`);
              continue;
            }

            await db.queryRun(`
              INSERT INTO documentos (
                expediente, doc_key, label, nombre, tipo, tamano, fecha, datos, estado, observacion
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              expediente,
              key, 
              doc.label || key, 
              doc.nombre || 'documento',
              doc.tipo || 'application/octet-stream',
              doc.tamano || 0,
              doc.fecha || new Date().toISOString(),
              doc.datos || null,
              doc.estado || 'Pendiente',
              doc.observacion || ''
            ]);
          } catch (docError) {
            console.error(`❌ Error insertando documento "${key}":`, docError.message);
            throw new Error(`Error al insertar documento "${key}": ${docError.message}`);
          }
        }
      }

      // Registrar en bitácora
      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [new Date().toLocaleString(), req.user.email, req.user.rol, 'Solicitud creada', expediente]
      );

      await db.queryRun('COMMIT');

      res.status(201).json({ 
        id: result.lastInsertRowid, 
        expediente, 
        message: 'Solicitud creada correctamente'
      });
    } catch (error) {
      await db.queryRun('ROLLBACK');
      throw error;
    }
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

    // Verificar permisos
    if (req.user.rol === 'estudiante' && solicitudActual.estudiante_email !== req.user.email) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta solicitud' });
    }

    // Validar estado
    if (updates.estado) {
      if (!VALID_STATES.includes(updates.estado)) {
        return res.status(400).json({ 
          error: `Estado inválido. Estados permitidos: ${VALID_STATES.join(', ')}` 
        });
      }
    }

    // Validar documentos
    if (updates.documentos && typeof updates.documentos === 'object') {
      for (const [key, doc] of Object.entries(updates.documentos)) {
        try {
          validarDocumento(doc);
        } catch (err) {
          return res.status(400).json({ 
            error: `Documento "${key}": ${err.message}` 
          });
        }
      }
    }

    // ===== INICIAR TRANSACCIÓN =====
    await db.queryRun('BEGIN TRANSACTION');

    try {
      const fields = [];
      const values = [];

      // Mapeo de campos permitidos
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

      // Registrar cambio de estado
      let estadoAnterior = solicitudActual.estado;
      let estadoNuevo = updates.estado;

      // Ejecutar actualización si hay campos
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(expediente);
        await db.queryRun(`UPDATE solicitudes SET ${fields.join(', ')} WHERE expediente = ?`, values);
      }

      // Actualizar documentos
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
                  expediente,
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
            throw new Error(`Error al actualizar documento "${key}": ${docError.message}`);
          }
        }
      }

      // Registrar cambio de estado en bitácora
      if (estadoNuevo && estadoNuevo !== estadoAnterior) {
        await db.queryRun(
          `INSERT INTO bitacora (fecha, usuario, rol, accion, expediente, detalle) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            new Date().toLocaleString(), 
            req.user.email, 
            req.user.rol, 
            `Estado cambiado: ${estadoAnterior} → ${estadoNuevo}`, 
            expediente,
            `Cambio de estado por ${req.user.rol}`
          ]
        );
      }

      await db.queryRun('COMMIT');

      res.json({ 
        message: 'Solicitud actualizada correctamente',
        expediente: expediente
      });
    } catch (error) {
      await db.queryRun('ROLLBACK');
      throw error;
    }
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

    // Solo admin o el propio estudiante pueden eliminar
    if (req.user.rol !== 'admin' && req.user.rol !== 'estudiante') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta solicitud' });
    }

    if (req.user.rol === 'estudiante' && solicitud.estudiante_email !== req.user.email) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta solicitud' });
    }

    // No permitir eliminar solicitudes en estados avanzados
    const estadosBloqueados = ['En comité', 'Aprobada', 'Beneficio Activo', 'Rechazada', 'Rechazado Definitivo'];
    if (estadosBloqueados.includes(solicitud.estado)) {
      return res.status(400).json({ 
        error: `No se puede eliminar una solicitud en estado "${solicitud.estado}"` 
      });
    }

    // ===== INICIAR TRANSACCIÓN =====
    await db.queryRun('BEGIN TRANSACTION');

    try {
      await db.queryRun('DELETE FROM documentos WHERE expediente = ?', [expediente]);
      await db.queryRun('DELETE FROM solicitudes WHERE expediente = ?', [expediente]);

      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [new Date().toLocaleString(), req.user.email, req.user.rol, 'Solicitud eliminada', expediente]
      );

      await db.queryRun('COMMIT');

      res.json({ 
        message: 'Solicitud eliminada correctamente',
        expediente: expediente
      });
    } catch (error) {
      await db.queryRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Error eliminando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;