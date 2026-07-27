// routes/documentos.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ============================================================
// 1. GET - Obtener documento por ID (para descarga directa)
// ============================================================
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const documento = await db.queryOne(
            'SELECT * FROM documentos WHERE id = ?',
            [id]
        );
        
        if (!documento) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }
        
        // Verificar permisos
        const solicitud = await db.queryOne(
            'SELECT estudiante_email FROM solicitudes WHERE id = ?',
            [documento.solicitud_id]
        );
        
        const { email, rol } = req.user;
        const esDueño = solicitud && solicitud.estudiante_email === email;
        const tienePermiso = esDueño || ['trabajador_social', 'comite', 'admin'].includes(rol);
        
        if (!tienePermiso) {
            return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
        }
        
        // Configurar cabeceras para la descarga
        res.setHeader('Content-Type', documento.tipo || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(documento.nombre)}"`);
        res.setHeader('Content-Length', documento.datos ? documento.datos.length : 0);
        
        // Enviar el archivo binario
        res.send(documento.datos);
    } catch (error) {
        console.error('❌ Error descargando documento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// 2. GET - Obtener documento en base64 (para preview en HTML)
// ============================================================
router.get('/base64/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const documento = await db.queryOne(
            'SELECT * FROM documentos WHERE id = ?',
            [id]
        );
        
        if (!documento) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }
        
        if (!documento.datos) {
            return res.status(404).json({ error: 'El documento no tiene contenido' });
        }
        
        // Verificar permisos
        const solicitud = await db.queryOne(
            'SELECT estudiante_email FROM solicitudes WHERE id = ?',
            [documento.solicitud_id]
        );
        
        const { email, rol } = req.user;
        const esDueño = solicitud && solicitud.estudiante_email === email;
        const tienePermiso = esDueño || ['trabajador_social', 'comite', 'admin'].includes(rol);
        
        if (!tienePermiso) {
            return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
        }
        
        const base64 = documento.datos.toString('base64');
        const dataUrl = `data:${documento.tipo || 'application/octet-stream'};base64,${base64}`;
        
        res.json({
            id: documento.id,
            nombre: documento.nombre,
            tipo: documento.tipo,
            dataUrl: dataUrl,
            tamano: documento.datos.length
        });
    } catch (error) {
        console.error('❌ Error obteniendo documento base64:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// 3. POST - Subir documento (con multer)
// ============================================================
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Use PDF, JPG o PNG.'));
        }
    }
});

router.post('/subir', authMiddleware, upload.single('archivo'), async (req, res) => {
    try {
        const { expediente, documentoKey, label } = req.body;
        
        if (!expediente || !documentoKey || !req.file) {
            return res.status(400).json({ error: 'Faltan datos: expediente, documentoKey o archivo' });
        }

        // Verificar que la solicitud existe
        const solicitud = await db.queryOne(
            'SELECT * FROM solicitudes WHERE expediente = ?',
            [expediente]
        );
        
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // Verificar si el documento ya existe
        const docExistente = await db.queryOne(
            'SELECT * FROM documentos WHERE solicitud_id = ? AND doc_key = ?',
            [solicitud.id, documentoKey]
        );

        if (docExistente) {
            // Actualizar documento existente
            await db.queryRun(
                `UPDATE documentos SET 
                    nombre = ?, 
                    tipo = ?, 
                    tamano = ?,
                    datos = ?, 
                    estado = 'Pendiente',
                    fecha = ?
                WHERE id = ?`,
                [
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    req.file.buffer,
                    new Date().toISOString(),
                    docExistente.id
                ]
            );
        } else {
            // Insertar nuevo documento
            await db.queryRun(
                `INSERT INTO documentos 
                    (solicitud_id, doc_key, label, nombre, tipo, tamano, fecha, datos, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    solicitud.id,
                    documentoKey,
                    label || documentoKey.replace('f-', '').replace('-', ' ').toUpperCase(),
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    new Date().toISOString(),
                    req.file.buffer,
                    'Pendiente'
                ]
            );
        }

        // Actualizar los metadatos en solicitudes.documentos
        await actualizarMetadatosDocumentos(solicitud.id, expediente, documentoKey, req.file.originalname, req.file.mimetype);

        res.json({ 
            mensaje: 'Documento subido correctamente',
            expediente,
            documentoKey,
            nombre: req.file.originalname,
            tamano: req.file.size
        });

    } catch (error) {
        console.error('❌ Error al subir documento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 4. PUT - Revisar documento (Aprobar/Rechazar/Solicitar corrección)
// ============================================================
router.put('/revisar/:expediente/:docKey', authMiddleware, requireRole('trabajador_social', 'admin'), async (req, res) => {
    try {
        const { expediente, docKey } = req.params;
        const { estado, observacion } = req.body;

        if (!estado || !['Aprobado', 'Rechazado', 'Corrección solicitada'].includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        // Verificar que la solicitud existe
        const solicitud = await db.queryOne(
            'SELECT * FROM solicitudes WHERE expediente = ?',
            [expediente]
        );
        
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // Actualizar el documento
        await db.queryRun(
            `UPDATE documentos 
             SET estado = ?, observacion = ? 
             WHERE solicitud_id = ? AND doc_key = ?`,
            [estado, observacion || '', solicitud.id, docKey]
        );

        // Actualizar metadatos en solicitudes.documentos
        await actualizarMetadatosDocumentosEstado(solicitud.id, expediente, docKey, estado, observacion);

        // Verificar si todos los documentos están aprobados
        await verificarYActualizarEstadoSolicitud(solicitud.id, expediente);

        res.json({ 
            mensaje: 'Documento revisado correctamente',
            estado,
            expediente,
            docKey
        });

    } catch (error) {
        console.error('❌ Error al revisar documento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

async function actualizarMetadatosDocumentos(solicitudId, expediente, key, nombre, mimeType) {
    // Obtener metadatos actuales
    const result = await db.queryOne(
        'SELECT documentos FROM solicitudes WHERE id = ?',
        [solicitudId]
    );
    
    let documentos = {};
    if (result && result.documentos) {
        try {
            documentos = JSON.parse(result.documentos);
        } catch(e) {
            documentos = {};
        }
    }

    // Actualizar metadatos
    documentos[key] = {
        label: key.replace('f-', '').replace('-', ' ').toUpperCase(),
        nombre: nombre,
        tipo: mimeType,
        fecha: new Date().toISOString(),
        estado: 'Pendiente'
    };

    // Guardar en la base de datos
    await db.queryRun(
        'UPDATE solicitudes SET documentos = ? WHERE id = ?',
        [JSON.stringify(documentos), solicitudId]
    );
}

async function actualizarMetadatosDocumentosEstado(solicitudId, expediente, key, estado, observacion) {
    // Obtener metadatos actuales
    const result = await db.queryOne(
        'SELECT documentos FROM solicitudes WHERE id = ?',
        [solicitudId]
    );
    
    let documentos = {};
    if (result && result.documentos) {
        try {
            documentos = JSON.parse(result.documentos);
        } catch(e) {
            documentos = {};
        }
    }

    // Actualizar estado
    if (documentos[key]) {
        documentos[key].estado = estado;
        if (observacion) {
            documentos[key].observacion = observacion;
        }
    }

    // Guardar en la base de datos
    await db.queryRun(
        'UPDATE solicitudes SET documentos = ? WHERE id = ?',
        [JSON.stringify(documentos), solicitudId]
    );
}

async function verificarYActualizarEstadoSolicitud(solicitudId, expediente) {
    // Verificar si todos los documentos están aprobados
    const result = await db.queryOne(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado = 'Aprobado' THEN 1 ELSE 0 END) as aprobados
         FROM documentos 
         WHERE solicitud_id = ?`,
        [solicitudId]
    );

    if (result) {
        const { total, aprobados } = result;
        
        if (total > 0 && total === aprobados) {
            // Todos los documentos están aprobados
            await db.queryRun(
                `UPDATE solicitudes 
                 SET estado = 'Elegible' 
                 WHERE id = ? AND estado = 'En revisión TS'`,
                [solicitudId]
            );
        }
    }
}

module.exports = router;