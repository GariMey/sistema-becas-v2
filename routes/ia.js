const express = require('express');
const router = express.Router();
const axios = require('axios');

const IA_API_URL = process.env.IA_API_URL || 'https://becas-ia-service.onrender.com';

// Cliente HTTP para la API de IA
const iaClient = axios.create({
    baseURL: IA_API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

/**
 * Health Check - Verifica el estado de la API de IA
 */
router.get('/health', async (req, res) => {
    try {
        const response = await iaClient.get('/health');
        res.json({
            success: true,
            data: response.data,
            status: response.status
        });
    } catch (error) {
        console.error('❌ Error en health check de IA:', error.message);
        res.status(503).json({
            success: false,
            error: 'Servicio de IA no disponible',
            details: error.message
        });
    }
});

/**
 * Obtener información de la API
 */
router.get('/info', async (req, res) => {
    try {
        const response = await iaClient.get('/');
        res.json({
            success: true,
            data: response.data,
            status: response.status
        });
    } catch (error) {
        console.error('❌ Error obteniendo info de IA:', error.message);
        res.status(503).json({
            success: false,
            error: 'No se pudo obtener información de la API de IA',
            details: error.message
        });
    }
});

/**
 * Chatbot - Enviar mensaje al asistente de IA
 */
router.post('/chat', async (req, res) => {
    try {
        const { mensaje, contexto } = req.body;
        
        if (!mensaje) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es requerido'
            });
        }

        console.log('🤖 Enviando mensaje a IA:', mensaje.substring(0, 50) + '...');

        const response = await iaClient.post('/api/chat', {
            mensaje,
            contexto: contexto || {}
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error en chat de IA:', error.message);
        
        // Si la IA no está disponible, usar respuestas predefinidas
        const fallbackResponse = getFallbackResponse(req.body.mensaje);
        
        res.status(200).json({
            success: true,
            data: {
                respuesta: fallbackResponse,
                origen: 'fallback'
            },
            warning: 'El servicio de IA no está disponible, se usó respuesta predefinida'
        });
    }
});

/**
 * Recomendar beca según perfil del estudiante
 */
router.post('/recomendar', async (req, res) => {
    try {
        const perfil = req.body;
        
        if (!perfil || Object.keys(perfil).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El perfil del estudiante es requerido'
            });
        }

        console.log('📊 Solicitando recomendación de beca para:', perfil.carrera || 'perfil no especificado');

        const response = await iaClient.post('/api/recomendar-beca', perfil);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error en recomendación de beca:', error.message);
        
        // Fallback: recomendación basada en reglas simples
        const fallbackRecomendacion = getFallbackRecomendacion(req.body);
        
        res.status(200).json({
            success: true,
            data: fallbackRecomendacion,
            warning: 'El servicio de IA no está disponible, se usó recomendación basada en reglas'
        });
    }
});

/**
 * Analizar expediente completo
 */
router.post('/analizar-expediente', async (req, res) => {
    try {
        const { expediente } = req.body;
        
        if (!expediente) {
            return res.status(400).json({
                success: false,
                error: 'El expediente es requerido'
            });
        }

        console.log('📋 Analizando expediente:', expediente.expediente || 'N/A');

        const response = await iaClient.post('/api/analizar-expediente', {
            expediente
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error analizando expediente:', error.message);
        res.status(503).json({
            success: false,
            error: 'El servicio de IA no está disponible',
            details: error.message
        });
    }
});

/**
 * Detectar fraude o inconsistencias
 */
router.post('/detectar-fraude', async (req, res) => {
    try {
        const { solicitud } = req.body;
        
        if (!solicitud) {
            return res.status(400).json({
                success: false,
                error: 'La solicitud es requerida'
            });
        }

        console.log('🔍 Analizando posibles fraudes en:', solicitud.expediente || 'N/A');

        const response = await iaClient.post('/api/detectar-fraude', {
            solicitud
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error en detección de fraude:', error.message);
        res.status(503).json({
            success: false,
            error: 'El servicio de IA no está disponible',
            details: error.message
        });
    }
});

/**
 * Generar informe automático
 */
router.post('/generar-informe', async (req, res) => {
    try {
        const { solicitud } = req.body;
        
        if (!solicitud) {
            return res.status(400).json({
                success: false,
                error: 'La solicitud es requerida'
            });
        }

        console.log('📄 Generando informe para:', solicitud.expediente || 'N/A');

        const response = await iaClient.post('/api/generar-informe', {
            solicitud
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error generando informe:', error.message);
        res.status(503).json({
            success: false,
            error: 'El servicio de IA no está disponible',
            details: error.message
        });
    }
});

/**
 * Sugerir acciones para una solicitud
 */
router.post('/sugerir-acciones', async (req, res) => {
    try {
        const { solicitud } = req.body;
        
        if (!solicitud) {
            return res.status(400).json({
                success: false,
                error: 'La solicitud es requerida'
            });
        }

        console.log('💡 Generando sugerencias para:', solicitud.expediente || 'N/A');

        const response = await iaClient.post('/api/sugerir-acciones', {
            solicitud
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Error generando sugerencias:', error.message);
        
        // Fallback con sugerencias básicas
        const fallbackSugerencias = getFallbackSugerencias(req.body.solicitud);
        
        res.status(200).json({
            success: true,
            data: fallbackSugerencias,
            warning: 'El servicio de IA no está disponible, se usaron sugerencias básicas'
        });
    }
});

// ============================================================
// FUNCIONES DE FALLBACK (cuando la IA no está disponible)
// ============================================================

/**
 * Respuestas predefinidas para el chatbot
 */
function getFallbackResponse(mensaje) {
    const msg = (mensaje || '').toLowerCase();
    
    if (msg.includes('requisito') || msg.includes('necesito') || msg.includes('qué necesito')) {
        return '📋 Los requisitos generales para solicitar una beca son:\n\n• Promedio mínimo de 8.0\n• Ingreso familiar menor a ₡1,000,000\n• Estar matriculado en una carrera de grado\n• No tener beca simultánea con otra institución\n• Presentar toda la documentación requerida';
    }
    
    if (msg.includes('documento') || msg.includes('papel') || msg.includes('adjuntar')) {
        return '📎 Los documentos requeridos son:\n\n• Cédula de identidad\n• Certificado de notas oficial\n• Comprobante de ingresos (declaración jurada)\n• Carta de motivación\n• Comprobante de matrícula\n• Si aplica: certificado de discapacidad';
    }
    
    if (msg.includes('plazo') || msg.includes('fecha') || msg.includes('cuándo')) {
        return '⏰ Las convocatorias de becas suelen abrir en enero y julio. Revisa el panel de "Convocatorias" para fechas específicas.';
    }
    
    if (msg.includes('monto') || msg.includes('cuánto') || msg.includes('dinero')) {
        return '💰 Los montos de beca varían según el tipo:\n\n• Beca Socioeconómica: 25% - 100% del costo\n• Beca Académica: 50% - 100% del costo\n• Beca de Investigación: Monto fijo según proyecto';
    }
    
    if (msg.includes('apelar') || msg.includes('recurso') || msg.includes('inconforme')) {
        return '⚖️ Si no estás de acuerdo con la resolución, puedes presentar una apelación dentro de los 5 días hábiles posteriores a la notificación.';
    }
    
    return '🤖 Puedo ayudarte con información sobre:\n\n• Requisitos de becas\n• Documentos necesarios\n• Plazos y fechas importantes\n• Montos y coberturas\n• Proceso de apelación\n\n¿Qué te gustaría saber?';
}

/**
 * Recomendación de beca basada en reglas
 */
function getFallbackRecomendacion(perfil) {
    const promedio = perfil.promedio || 0;
    const ingreso = perfil.ingresoFamiliar || 0;
    const dependientes = perfil.dependientes || 0;
    
    let tipoBeca = 'Beca Socioeconómica';
    let confianza = 0.6;
    let justificacion = '';
    
    if (promedio >= 9.0 && ingreso < 500000) {
        tipoBeca = 'Beca de Excelencia Académica';
        confianza = 0.8;
        justificacion = 'Excelente promedio académico y bajo ingreso familiar.';
    } else if (promedio >= 8.5 && ingreso < 800000) {
        tipoBeca = 'Beca Socioeconómica con Componente Académico';
        confianza = 0.7;
        justificacion = 'Buen promedio académico y situación económica que requiere apoyo.';
    } else if (promedio >= 8.0 && ingreso < 1000000) {
        tipoBeca = 'Beca Socioeconómica Estándar';
        confianza = 0.65;
        justificacion = 'Cumple con los requisitos mínimos de promedio e ingresos.';
    } else if (promedio >= 9.5) {
        tipoBeca = 'Beca de Investigación o Mérito';
        confianza = 0.75;
        justificacion = 'Promedio excepcional, recomendado para becas de investigación.';
    } else {
        tipoBeca = 'Beca Socioeconómica (Evaluación Adicional)';
        confianza = 0.55;
        justificacion = 'Requiere evaluación adicional para determinar elegibilidad.';
    }
    
    return {
        tipoBeca,
        confianza,
        justificacion,
        recomendacion: `Se recomienda la "${tipoBeca}" para este perfil.`,
        detalles: {
            promedio,
            ingreso,
            dependientes
        }
    };
}

/**
 * Sugerencias básicas para el trabajador social
 */
function getFallbackSugerencias(solicitud) {
    const acciones = [];
    const prioridad = 'media';
    
    if (!solicitud.documentos || Object.keys(solicitud.documentos || {}).length < 3) {
        acciones.push('⚠️ Verificar documentación: El estudiante ha adjuntado pocos documentos.');
    }
    
    if (solicitud.ingresoFamiliar > 1000000) {
        acciones.push('📊 Revisar ingresos: El ingreso familiar supera el límite establecido.');
    }
    
    if (solicitud.promedio < 8.0) {
        acciones.push('📚 Evaluar académico: El promedio está por debajo del mínimo requerido.');
    }
    
    if (acciones.length === 0) {
        acciones.push('✅ La solicitud cumple con los requisitos básicos.');
        acciones.push('📋 Recomendación: Avanzar a revisión de documentos y visita.');
    }
    
    return {
        acciones,
        prioridad,
        resumen: acciones.join('\n'),
        puntajeIA: 0
    };
}

module.exports = router;