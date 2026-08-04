/**
 * Servicio de Integración con API de IA
 * Sistema de Becas - IA Service
 * 
 * URL Base: https://becas-ia-service.onrender.com
 */

const axios = require('axios');

const IA_API_URL = process.env.IA_API_URL || 'https://becas-ia-service.onrender.com';

/**
 * Cliente para la API de IA
 */
class IAService {
    constructor() {
        this.baseURL = IA_API_URL;
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Health Check
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: 'Servicio de IA no disponible',
                details: error.message
            };
        }
    }

    /**
     * Chat con IA
     */
    async chat(mensaje, contexto = {}) {
        try {
            const response = await this.client.post('/api/chat', {
                mensaje,
                contexto
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: 'Error en chat de IA',
                details: error.message
            };
        }
    }

    /**
     * Recomendar beca
     */
    async recomendarBeca(perfil) {
        try {
            const response = await this.client.post('/api/recomendar-beca', perfil);
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: 'Error en recomendación',
                details: error.message
            };
        }
    }

    /**
     * Analizar expediente
     */
    async analizarExpediente(expediente) {
        try {
            const response = await this.client.post('/api/analizar-expediente', { expediente });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: 'Error analizando expediente',
                details: error.message
            };
        }
    }

    /**
     * Detectar fraude
     */
    async detectarFraude(solicitud) {
        try {
            const response = await this.client.post('/api/detectar-fraude', { solicitud });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: 'Error en detección de fraude',
                details: error.message
            };
        }
    }
}

module.exports = new IAService();