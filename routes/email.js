const express = require('express');
const router = express.Router();
const { enviarCorreo, generarHTMLNotificacion } = require('../services/emailService');

// Enviar correo simple
router.post('/enviar', async (req, res) => {
    try {
        const { para, asunto, mensaje, html } = req.body;

        if (!para || !asunto || !mensaje) {
            return res.status(400).json({ error: 'Faltan datos requeridos: para, asunto, mensaje' });
        }

        const resultado = await enviarCorreo(para, asunto, mensaje, html);
        
        if (resultado.success) {
            res.json({ success: true, messageId: resultado.messageId });
        } else {
            res.status(500).json({ error: resultado.error });
        }
    } catch (error) {
        console.error('Error en /api/email/enviar:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enviar notificación de estado de solicitud
router.post('/notificar', async (req, res) => {
    try {
        const { email, nombre, expediente, tipo, estado, mensaje, observaciones } = req.body;

        if (!email || !nombre || !expediente || !estado) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const titulos = {
            'enviada': '✅ Solicitud de Beca Enviada',
            'aprobada': '🎉 Beca Aprobada',
            'rechazada': '❌ Solicitud Rechazada',
            'subsanacion': '📝 Corrección Requerida',
            'visita': '🏠 Visita Domiciliaria Programada',
            'comite': '📋 Solicitud en Comité',
            'apelacion': '⚖️ Apelación Recibida',
            'suspension': '⛔ Beca Suspendida',
            'restauracion': '🔄 Beca Restaurada'
        };

        const asunto = `${titulos[estado] || 'Actualización de Solicitud'} - Expediente ${expediente}`;
        
        const html = generarHTMLNotificacion(nombre, expediente, tipo, estado, mensaje, observaciones);
        
        const resultado = await enviarCorreo(email, asunto, mensaje, html);
        
        if (resultado.success) {
            res.json({ success: true, messageId: resultado.messageId });
        } else {
            res.status(500).json({ error: resultado.error });
        }
    } catch (error) {
        console.error('Error en /api/email/notificar:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enviar correos masivos
router.post('/masivo', async (req, res) => {
    try {
        const { emails, asunto, mensaje, html } = req.body;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'Se requiere una lista de correos' });
        }

        if (!asunto || !mensaje) {
            return res.status(400).json({ error: 'Faltan asunto o mensaje' });
        }

        const resultados = [];
        for (const email of emails) {
            const resultado = await enviarCorreo(email, asunto, mensaje, html);
            resultados.push({ 
                email, 
                success: resultado.success, 
                messageId: resultado.messageId || null,
                error: resultado.error || null
            });
            
            // Pequeña pausa para no saturar Gmail
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const exitosos = resultados.filter(r => r.success).length;
        res.json({ 
            success: true, 
            total: resultados.length, 
            exitosos,
            resultados 
        });
    } catch (error) {
        console.error('Error en /api/email/masivo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verificar configuración de correo
router.get('/verificar', async (req, res) => {
    try {
        const { initTransporter } = require('../services/emailService');
        const transporter = initTransporter();
        
        const testResult = await transporter.verify();
        res.json({ 
            success: true, 
            message: 'Configuración de correo verificada correctamente',
            email: process.env.EMAIL_USER
        });
    } catch (error) {
        console.error('Error en /api/email/verificar:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;