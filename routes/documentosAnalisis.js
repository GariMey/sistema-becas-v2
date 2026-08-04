const express = require('express');
const router = express.Router();
const documentAnalysisService = require('../services/documentAnalysisService');
/**
 * Analiza un documento subido por el estudiante
 */
router.post('/analizar', async (req, res) => {
    try {
        const { documento, nombre, tipoMime, expediente, tipoEsperado, cedulaEstudiante } = req.body;
        if (!documento || !nombre) {
            return res.status(400).json({
                success: false,
                error: 'El documento y su nombre son requeridos'
            });
        }
        console.log(`📄 Analizando documento: ${nombre} (${expediente || 'sin expediente'})`);
        const resultado = await documentAnalysisService.analizarDocumento(
            documento,
            nombre,
            tipoMime || 'application/octet-stream',
            { expediente, tipoEsperado, cedulaEstudiante }
        );
        if (resultado.success) {
            res.json({
                success: true,
                data: resultado.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: resultado.error || 'Error al analizar el documento'
            });
        }
    } catch (error) {
        console.error('❌ Error en /api/documentos-analisis/analizar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Analiza todos los documentos de un expediente
 */
router.post('/analizar-expediente', async (req, res) => {
    try {
        const { expediente, documentos } = req.body;
        if (!expediente) {
            return res.status(400).json({
                success: false,
                error: 'El expediente es requerido'
            });
        }
        if (!documentos || typeof documentos !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Se requiere la lista de documentos'
            });
        }
        const resultados = {};
        const analisisGeneral = {
            total: 0,
            aprobados: 0,
            rechazados: 0,
            revision: 0,
            errores: []
        };
        for (const [key, doc] of Object.entries(documentos)) {
            if (doc.datos) {
                const resultado = await documentAnalysisService.analizarDocumento(
                    doc.datos,
                    doc.nombre || key,
                    doc.tipo || 'application/octet-stream',
                    { expediente, tipoEsperado: doc.label }
                );
                if (resultado.success) {
                    resultados[key] = resultado.data;
                    analisisGeneral.total++;
                    if (resultado.data.estado === 'Aprobado') analisisGeneral.aprobados++;
                    else if (resultado.data.estado === 'Rechazado') analisisGeneral.rechazados++;
                    else analisisGeneral.revision++;
                } else {
                    analisisGeneral.errores.push({
                        documento: key,
                        error: resultado.error
                    });
                }
            }
        }
        res.json({
            success: true,
            data: {
                expediente,
                documentos: resultados,
                general: analisisGeneral,
                fecha: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error en /api/documentos-analisis/analizar-expediente:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
module.exports = router;
