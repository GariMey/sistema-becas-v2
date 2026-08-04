/**
 * Servicio de Análisis de Documentos con IA
 * Sistema de Becas - IA Service
 *
 * IMPORTANTE: este archivo antes NO llamaba al microservicio de IA — solo
 * simulaba un puntaje local a partir del tamaño del archivo en KB. Se
 * reescribió para llamar de verdad a la API real (FastAPI, desplegada en
 * Render), usando multipart/form-data tal como esa API lo espera, y
 * traduce su respuesta al mismo formato que ya usaba el resto del código
 * (puntaje, estado, tipoDetectado, errores, advertencias, observaciones,
 * confianza) para no tener que tocar el frontend.
 */

const IA_API_URL = (process.env.IA_API_URL || 'https://becas-ia-service.onrender.com')
    .replace(/\/api\/v1\/documents\/analyze\/?$/, '')
    .replace(/\/+$/, '');

const IA_API_KEY = process.env.IA_API_KEY || process.env.IA_SERVICE_API_KEY || '';

const MIME_A_EXTENSION = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// Los 22 tipos de documento que la IA reconoce de verdad (ver DocumentType
// en el microservicio). Si se le manda cualquier otro texto como tipo
// esperado, la IA lo rechaza con un error de validación — por eso hace
// falta normalizar antes de mandarlo, no vale mandar la etiqueta tal cual
// viene del formulario.
const TIPOS_VALIDOS_IA = [
    'Cédula de identidad', 'Pasaporte', 'DIMEX', 'Carta salarial', 'Orden patronal',
    'Constancia laboral', 'Factura de agua', 'Factura eléctrica', 'Factura de Internet',
    'Estado de cuenta bancario', 'Certificación bancaria', 'Historial académico',
    'Constancia de matrícula', 'Título universitario', 'Plan de estudios', 'Carta de beca',
    'Declaración jurada', 'Recibo', 'Factura', 'Contrato de alquiler', 'Escritura', 'Otro'
];

// Traduce una etiqueta de documento en español (tal como la define cada
// formulario del sistema, que puede variar) a uno de los 22 tipos válidos.
// Si no hay una coincidencia confiable, devuelve null a propósito: es
// preferible no mandar tipo_documento_esperado a mandar uno inventado que
// tumbe la petición completa con un error de validación.
function normalizarTipoEsperado(etiqueta) {
    if (!etiqueta) return null;
    const limpio = etiqueta.trim();
    if (TIPOS_VALIDOS_IA.includes(limpio)) return limpio;

    const low = limpio.toLowerCase();
    if (low.includes('cedula') || low.includes('cédula')) return 'Cédula de identidad';
    if (low.includes('pasaporte')) return 'Pasaporte';
    if (low.includes('dimex')) return 'DIMEX';
    if (low.includes('constancia laboral') || (low.includes('constancia') && low.includes('trabajo'))) return 'Constancia laboral';
    if (low.includes('orden patronal')) return 'Orden patronal';
    if (low.includes('matricula') || low.includes('matrícula')) return 'Constancia de matrícula';
    if (low.includes('historial') || low.includes('académic') || low.includes('academic')) return 'Historial académico';
    if (low.includes('titulo') || low.includes('título')) return 'Título universitario';
    if (low.includes('plan de estudio')) return 'Plan de estudios';
    if (low.includes('beca')) return 'Carta de beca';
    if (low.includes('jurada')) return 'Declaración jurada';
    if (low.includes('agua')) return 'Factura de agua';
    if (low.includes('electric') || low.includes('eléctric')) return 'Factura eléctrica';
    if (low.includes('internet')) return 'Factura de Internet';
    if (low.includes('estado de cuenta')) return 'Estado de cuenta bancario';
    if (low.includes('certificacion bancaria') || low.includes('certificación bancaria')) return 'Certificación bancaria';
    if (low.includes('alquiler') || low.includes('arrendamiento')) return 'Contrato de alquiler';
    if (low.includes('escritura')) return 'Escritura';

    // "Constancia de ingresos", "comprobante de ingresos", etc. quedan sin
    // mapear a propósito: pueden ser válidamente una Carta salarial O una
    // Constancia laboral, y forzar una sola opción generaría advertencias
    // falsas de "tipo no coincide" sobre documentos que sí son válidos.
    return null;
}

// Traduce el estado de la IA (en mayúsculas, con guion bajo) al formato que
// ya usa este proyecto ('Aprobado' / 'Rechazado' / 'Revisión requerida').
function traducirEstado(estadoIA) {
    if (estadoIA === 'APROBADO' || estadoIA === 'APROBADO_CON_OBSERVACIONES') return 'Aprobado';
    if (estadoIA === 'RECHAZADO') return 'Rechazado';
    return 'Revisión requerida';
}

class DocumentAnalysisService {
    constructor() {
        this.baseURL = IA_API_URL;
    }

    /**
     * @param {string} base64Data - El documento, como data URL o base64 puro.
     * @param {string} nombreArchivo
     * @param {string} tipoMime
     * @param {object} contexto - Opcional: { expediente, tipoEsperado, cedulaEstudiante }.
     *   Sin esto, el análisis sigue funcionando igual (clasificación, puntaje,
     *   extracción de campos) — solo se pierde la detección de duplicados,
     *   la validación de tipo esperado y el cruce de cédula.
     */
    async analizarDocumento(base64Data, nombreArchivo, tipoMime, contexto) {
        contexto = contexto || {};
        try {
            if (!base64Data) {
                return { success: false, error: 'El documento no tiene datos para analizar' };
            }

            // base64Data llega como "data:<mime>;base64,<contenido>" (así lo
            // guardan los formularios del sistema) o, en algunos casos, como
            // base64 puro sin el prefijo — se aceptan los dos.
            const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            const buffer = Buffer.from(base64, 'base64');

            const extension = MIME_A_EXTENSION[tipoMime] || 'pdf';
            const nombre = nombreArchivo || `documento.${extension}`;

            const form = new FormData();
            form.append('file', new Blob([buffer], { type: tipoMime || 'application/pdf' }), nombre);
            if (contexto.expediente) form.append('expediente', contexto.expediente);
            if (contexto.cedulaEstudiante) form.append('cedula_estudiante', contexto.cedulaEstudiante);
            const tipoEsperadoNormalizado = normalizarTipoEsperado(contexto.tipoEsperado);
            if (tipoEsperadoNormalizado) form.append('tipo_documento_esperado', tipoEsperadoNormalizado);

            const headers = {};
            if (IA_API_KEY) headers['X-API-Key'] = IA_API_KEY;

            const respuestaIA = await fetch(`${this.baseURL}/api/v1/documents/analyze`, {
                method: 'POST',
                headers,
                body: form
            });

            const cuerpo = await respuestaIA.json();

            if (!respuestaIA.ok) {
                console.error('❌ El servicio de IA respondió con error:', cuerpo);
                return {
                    success: false,
                    error: cuerpo?.error?.message || 'El servicio de IA devolvió un error al analizar el documento'
                };
            }

            // Traducción del formato nativo de la IA al formato que ya
            // esperaba este proyecto, para no tener que tocar el resto del
            // código (routes/documentosAnalisis.js, el frontend, etc.)
            const advertencias = (cuerpo.advertencias || []).map(a => a.message);
            const resultado = {
                tipoDetectado: cuerpo.tipo_documento,
                puntaje: cuerpo.puntaje,
                estado: traducirEstado(cuerpo.estado),
                textoExtraido: '',
                errores: (cuerpo.errores || []).map(e => e.message),
                advertencias: advertencias,
                observaciones: (cuerpo.observaciones || []).map(o => o.message),
                metadatos: {
                    tamaño: `${Math.round(buffer.length / 1024)} KB`,
                    tipo: tipoMime || 'Desconocido',
                    metodoExtraccion: cuerpo.metodo_extraccion,
                    paginas: cuerpo.cantidad_paginas
                },
                confianza: cuerpo.confianza_clasificacion,
                camposExtraidos: cuerpo.campos_extraidos || {},
                cedulaDetectada: cuerpo.cedula_detectada || null,
                cedulaCoincide: cuerpo.cedula_coincide,
                tipoDocumentoCoincide: tipoEsperadoNormalizado
                    ? !advertencias.some(m => m.toLowerCase().includes('se esperaba un documento'))
                    : null
            };

            return { success: true, data: resultado };
        } catch (error) {
            console.error('❌ Error en análisis de documento:', error.message);
            return {
                success: false,
                error: 'No se pudo contactar al servicio de IA. Verificar que esté activo. (' + error.message + ')'
            };
        }
    }
}

module.exports = new DocumentAnalysisService();
