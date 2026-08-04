/**
 * Servicio de Análisis de Documentos con IA
 * Sistema de Becas - IA Service
 */

const axios = require('axios');

const IA_API_URL = process.env.IA_API_URL || 'https://becas-ia-service.onrender.com';

class DocumentAnalysisService {
    constructor() {
        this.baseURL = IA_API_URL;
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    detectarTipoDocumento(nombre) {
        const nombreLower = nombre.toLowerCase();
        
        const tipos = {
            'cedula': 'Cédula de Identidad',
            'cedula frontal': 'Cédula de Identidad (Frontal)',
            'cedula posterior': 'Cédula de Identidad (Posterior)',
            'certificado notas': 'Certificado de Notas',
            'certificado': 'Certificado',
            'comprobante ingresos': 'Comprobante de Ingresos',
            'ingresos': 'Comprobante de Ingresos',
            'carta motivacion': 'Carta de Motivación',
            'motivacion': 'Carta de Motivación',
            'matricula': 'Comprobante de Matrícula',
            'discapacidad': 'Certificado de Discapacidad',
            'foto': 'Fotografía',
            'constancia': 'Constancia',
            'carnet': 'Carnet Estudiantil',
            'historial': 'Historial Académico',
            'academico': 'Historial Académico'
        };

        for (const [key, value] of Object.entries(tipos)) {
            if (nombreLower.includes(key)) {
                return value;
            }
        }
        
        return 'Otro';
    }

    async analizarDocumento(base64Data, nombreArchivo, tipoMime) {
        try {
            const tipoDetectado = this.detectarTipoDocumento(nombreArchivo);
            
            // Simular análisis (versión rápida sin depender de IA externa)
            const tamañoBase64 = base64Data.length;
            const tamañoKB = Math.round(tamañoBase64 * 0.75 / 1024);
            
            let puntaje = 50;
            let advertencias = [];
            let errores = [];
            let observaciones = [];

            // Análisis basado en tamaño
            if (tamañoKB > 150) {
                puntaje = 75;
            } else if (tamañoKB > 80) {
                puntaje = 65;
            } else if (tamañoKB > 40) {
                puntaje = 55;
            } else {
                puntaje = 35;
                errores.push(`El archivo es muy pequeño (${tamañoKB} KB). La calidad puede ser insuficiente.`);
            }

            // Verificar tipo de archivo
            if (tipoMime && !tipoMime.includes('image') && !tipoMime.includes('pdf')) {
                advertencias.push(`El formato ${tipoMime} no es el recomendado. Use imágenes (JPG, PNG) o PDF.`);
            }

            // Verificar si el nombre del archivo coincide con el tipo esperado
            if (tipoDetectado === 'Otro') {
                observaciones.push('No se pudo reconocer automáticamente el tipo de documento.');
            }

            // Determinar estado
            let estado = 'Revisión requerida';
            if (puntaje >= 70) estado = 'Aprobado';
            else if (puntaje < 45) estado = 'Rechazado';

            const resultado = {
                tipoDetectado: tipoDetectado,
                puntaje: puntaje,
                estado: estado,
                textoExtraido: '',
                errores: errores,
                advertencias: advertencias,
                observaciones: observaciones,
                metadatos: {
                    tamaño: `${tamañoKB} KB`,
                    tipo: tipoMime || 'Desconocido'
                },
                confianza: 0.5
            };

            // Si el archivo es muy pequeño, agregar advertencia adicional
            if (tamañoKB < 30) {
                advertencias.push('El archivo es muy pequeño. Se recomienda subir una imagen con mejor resolución.');
            }

            return {
                success: true,
                data: resultado
            };
        } catch (error) {
            console.error('❌ Error en análisis de documento:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new DocumentAnalysisService();