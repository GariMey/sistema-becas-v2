const nodemailer = require('nodemailer');

// Configurar transporte de correo
let transporter = null;

const initTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verificar conexión
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Error al conectar con Gmail:', error);
            } else {
                console.log('✅ Conectado a Gmail correctamente');
            }
        });
    }
    return transporter;
};

/**
 * Envía un correo electrónico
 * @param {string} para - Correo del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} mensaje - Mensaje en texto plano
 * @param {string} html - Mensaje en HTML (opcional)
 * @returns {Promise<object>}
 */
const enviarCorreo = async (para, asunto, mensaje, html = null) => {
    try {
        const transporter = initTransporter();
        
        const mailOptions = {
            from: `"Sistema de Becas" <${process.env.EMAIL_USER}>`,
            to: para,
            subject: asunto,
            text: mensaje,
            html: html || mensaje.replace(/\n/g, '<br>')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Correo enviado a ${para}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error al enviar correo:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Genera el HTML para correos de notificación
 */
const generarHTMLNotificacion = (nombre, expediente, tipo, estado, mensaje, observaciones = '') => {
    const colores = {
        'aprobada': { bg: '#e7f5ee', color: '#1e7e4f', icon: '🎉' },
        'rechazada': { bg: '#fdecea', color: '#c0392b', icon: '❌' },
        'enviada': { bg: '#e6effa', color: '#2471a3', icon: '📄' },
        'subsanacion': { bg: '#fff3cd', color: '#b07d12', icon: '📝' },
        'visita': { bg: '#fff3cd', color: '#b07d12', icon: '🏠' },
        'comite': { bg: '#e6effa', color: '#2471a3', icon: '📋' },
        'apelacion': { bg: '#e6effa', color: '#2471a3', icon: '⚖️' },
        'suspension': { bg: '#fdecea', color: '#c0392b', icon: '⛔' },
        'restauracion': { bg: '#e7f5ee', color: '#1e7e4f', icon: '🔄' }
    };

    const estilo = colores[estado] || colores.enviada;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f6f7fb; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0; color: #e0c468; font-size: 24px; }
            .header p { margin: 5px 0 0; opacity: 0.8; }
            .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
            .icono { font-size: 48px; text-align: center; margin-bottom: 15px; }
            .estado-badge { 
                display: inline-block; 
                background: ${estilo.bg}; 
                color: ${estilo.color}; 
                padding: 8px 16px; 
                border-radius: 20px; 
                font-weight: bold;
                text-transform: uppercase;
                font-size: 14px;
            }
            .info-box { 
                background: #f6f7fb; 
                padding: 15px 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
                border-left: 4px solid ${estilo.color};
            }
            .info-box p { margin: 8px 0; }
            .footer { 
                margin-top: 20px; 
                padding-top: 20px; 
                border-top: 1px solid #e6e9f0; 
                color: #6b7585; 
                font-size: 0.8rem; 
                text-align: center; 
            }
            .btn {
                display: inline-block;
                background: #1a365d;
                color: white;
                padding: 12px 30px;
                border-radius: 8px;
                text-decoration: none;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 Sistema de Becas</h1>
                <p>Universitarias</p>
            </div>
            <div class="content">
                <div class="icono">${estilo.icon}</div>
                <h2 style="color: #1a365d; text-align: center;">Hola ${nombre},</h2>
                <p style="font-size: 16px; line-height: 1.6;">${mensaje}</p>
                
                <div class="info-box">
                    <p><strong>📋 Expediente:</strong> ${expediente}</p>
                    <p><strong>🏷️ Tipo de beca:</strong> ${tipo || 'No especificado'}</p>
                    <p><strong>📌 Estado:</strong> <span class="estado-badge">${estado}</span></p>
                    ${observaciones ? `<p><strong>📝 Observaciones:</strong> ${observaciones}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.URL_SISTEMA || '#'}" class="btn">📱 Ir al Sistema</a>
                </div>
                
                <p style="color: #6b7585; font-size: 0.9rem;">
                    Este es un mensaje automático generado por el Sistema de Becas. 
                    Por favor no responder a este correo.
                </p>
                <div class="footer">
                    <p>Sistema de Becas Universitarias</p>
                    <p style="margin-top: 5px;">
                        <a href="${process.env.URL_SISTEMA || '#'}" style="color: #1a365d; text-decoration: none;">
                            ${process.env.URL_SISTEMA || 'https://tusistema.com'}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = {
    enviarCorreo,
    generarHTMLNotificacion,
    initTransporter
};