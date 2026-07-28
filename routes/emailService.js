// routes/emailService.js
const sgMail = require('@sendgrid/mail');

// Obtener variables de entorno correctamente
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@tudominio.com';

// Configurar SendGrid solo si hay API Key
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid configurado correctamente');
} else {
    console.warn('⚠️ SENDGRID_API_KEY no configurada. Los emails se simularán.');
}

/**
 * Envía un correo electrónico usando SendGrid
 * @param {string} to - Correo del destinatario
 * @param {string} subject - Asunto del correo
 * @param {string} html - Contenido HTML del correo
 * @param {string} text - Versión texto plano (opcional)
 * @returns {Promise<Object>} - Resultado del envío
 */
async function sendEmail(to, subject, html, text = null) {
    // Si no hay API Key, simular el envío
    if (!SENDGRID_API_KEY) {
        console.warn(`⚠️ [SIMULADO] Email a ${to}: "${subject}" - API Key no configurada`);
        return { success: false, error: 'API Key no configurada', simulated: true };
    }

    try {
        if (!to || !subject || !html) {
            throw new Error('Faltan parámetros requeridos: to, subject, html');
        }

        const msg = {
            to: to,
            from: FROM_EMAIL,
            subject: subject,
            text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
            html: html,
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true }
            }
        };

        const [response] = await sgMail.send(msg);
        console.log(`📧 Email enviado a ${to}. Status: ${response.statusCode}`);
        return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
        console.error('❌ Error enviando email:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.body, null, 2));
            
            // Errores comunes de SendGrid
            if (error.response.statusCode === 401) {
                console.error('🔑 ERROR DE AUTENTICACIÓN: Tu SENDGRID_API_KEY no es válida.');
                console.error('📌 Solución: Ve a https://app.sendgrid.com/settings/api_keys y genera una nueva API Key.');
            } else if (error.response.statusCode === 403) {
                console.error('🚫 ERROR DE PERMISOS: El email remitente no está verificado en SendGrid.');
                console.error('📌 Solución: Verifica el email en https://app.sendgrid.com/settings/sender_auth');
            }
        }
        return { success: false, error: error.message };
    }
}

/**
 * Genera la plantilla HTML para cada tipo de notificación
 * @param {string} tipo - Tipo de notificación
 * @param {Object} datos - Datos para la plantilla
 * @returns {Object} - { titulo, html }
 */
function generarPlantillaNotificacion(tipo, datos) {
    // Estilos base para todas las plantillas
    const baseStyles = `
        <style>
            .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .header .sub { font-size: 14px; opacity: 0.8; margin-top: 5px; }
            .content { background: #ffffff; padding: 25px; border: 1px solid #e6e9f0; border-radius: 0 0 8px 8px; }
            .box { padding: 15px; border-radius: 8px; margin: 15px 0; }
            .box-success { background: #e7f5ee; border: 1px solid #b9e3cb; }
            .box-warning { background: #fff3cd; border: 1px solid #ffeaa7; }
            .box-danger { background: #fdecea; border: 1px solid #f6c6c0; }
            .box-info { background: #e6effa; border: 1px solid #b8d0e8; }
            .box-gold { background: #fff8e6; border: 1px solid #f0dba3; }
            .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e6e9f0; font-size: 12px; color: #6b7585; }
            .btn { display: inline-block; background: #c5a028; color: #1a365d; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold; }
            ul { margin: 10px 0; padding-left: 20px; }
            ul li { margin-bottom: 8px; }
            .codigo-2fa { font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 10px 0; color: #1a365d; text-align: center; }
        </style>
    `;

    // Definir todas las plantillas en un objeto
    const templates = {
        // ===== AUTENTICACIÓN =====
        'codigo_2fa': {
            titulo: '🔐 Código de verificación 2FA',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#2c4a7c;">
                        <h1>🔐 Verificación en Dos Pasos</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Usuario'}</strong>,</p>
                        <p>Has solicitado un código de verificación para iniciar sesión en el Sistema de Becas.</p>
                        <div class="box box-info" style="text-align: center;">
                            <p style="font-size: 14px; color: #6b7585; margin-bottom: 5px;">Tu código de verificación es:</p>
                            <p class="codigo-2fa">${datos.codigo || '123456'}</p>
                            <p style="color: #6b7585; font-size: 14px;">Este código expira en ${datos.expiracion || '10 minutos'}</p>
                        </div>
                        <p>Si no solicitaste este código, por favor ignora este mensaje.</p>
                        <p style="color: #b07d12; font-weight: bold;">⚠️ No compartas este código con nadie.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'nuevo_inicio_sesion': {
            titulo: '🔐 Nuevo inicio de sesión detectado',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1a365d;">
                        <h1>🔐 Nuevo Inicio de Sesión</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Usuario'}</strong>,</p>
                        <p>Hemos detectado un nuevo inicio de sesión en tu cuenta.</p>
                        <div class="box box-info">
                            <p><strong>📅 Fecha y hora:</strong> ${datos.fecha || new Date().toLocaleString()}</p>
                            <p><strong>🌐 Dirección IP:</strong> ${datos.ip || 'No disponible'}</p>
                            <p><strong>💻 Dispositivo:</strong> ${datos.dispositivo || 'No disponible'}</p>
                        </div>
                        <p>Si eres tú, no necesitas hacer nada.</p>
                        <p style="color: #c0392b; font-weight: bold;">⚠️ Si no reconoces este inicio de sesión, <strong>cambia tu contraseña inmediatamente</strong>.</p>
                        <p>Puedes cambiar tu contraseña desde el <a href="${process.env.APP_URL || 'http://localhost:3000'}">Sistema de Becas</a>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'recuperacion_password': {
            titulo: '🔐 Recuperación de contraseña',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#2c4a7c;">
                        <h1>🔐 Recuperación de Contraseña</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Usuario'}</strong>,</p>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                        <div class="box box-info" style="text-align: center;">
                            <p>Haz clic en el botón para crear una nueva contraseña:</p>
                            <p style="margin: 20px 0;">
                                <a href="${datos.resetLink}" class="btn" style="background: #c5a028; color: #1a365d; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">
                                    🔑 Restablecer contraseña
                                </a>
                            </p>
                            <p style="color: #6b7585; font-size: 14px;">El enlace expirará en 1 hora.</p>
                            <p style="color: #6b7585; font-size: 12px; word-break: break-all;">URL: ${datos.resetLink}</p>
                        </div>
                        <p>Si no solicitaste esta recuperación, por favor ignora este correo.</p>
                        <p style="color: #b07d12; font-weight: bold;">⚠️ No compartas este enlace con nadie.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'password_cambiada': {
            titulo: '🔐 Contraseña actualizada',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1e7e4f;">
                        <h1>🔐 Contraseña Actualizada</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Usuario'}</strong>,</p>
                        <p>Te confirmamos que tu contraseña ha sido <strong>actualizada correctamente</strong>.</p>
                        <div class="box box-success">
                            <p>✅ Tu cuenta está ahora protegida con tu nueva contraseña.</p>
                            <p>📅 Fecha del cambio: ${new Date().toLocaleString()}</p>
                        </div>
                        <p>Si no realizaste este cambio, contacta inmediatamente a la <strong>oficina de becas</strong>.</p>
                        <p>Puedes iniciar sesión desde el <a href="${process.env.APP_URL || 'http://localhost:3000'}">Sistema de Becas</a>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== SOLICITUDES =====
        'solicitud_recibida': {
            titulo: '✅ Solicitud de beca recibida',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header">
                        <h1>📋 Solicitud Recibida</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Tu solicitud de beca ha sido recibida correctamente.</p>
                        <div class="box box-info">
                            <p><strong>📋 Expediente:</strong> ${datos.expediente}</p>
                            <p><strong>🎓 Tipo de beca:</strong> ${datos.tipoBeca}</p>
                            <p><strong>📅 Fecha:</strong> ${datos.fecha || new Date().toLocaleDateString()}</p>
                        </div>
                        <p>El trabajador social revisará tu solicitud en los próximos días.</p>
                        <p>Puedes dar seguimiento en tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'subsanacion_requerida': {
            titulo: '⚠️ Se requiere subsanación de documentos',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#b07d12;">
                        <h1>📝 Subsanación Requerida</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Tu solicitud de beca <strong>${datos.expediente}</strong> requiere correcciones en la documentación.</p>
                        <div class="box box-warning">
                            <p><strong>📝 Documentos a corregir:</strong></p>
                            <ul>
                                ${(datos.documentosPendientes || []).map(d => 
                                    `<li><strong>${d.label}:</strong> ${d.observacion || 'Requiere corrección'}</li>`
                                ).join('')}
                            </ul>
                        </div>
                        <p>Por favor, ingresa a tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a> y sube las correcciones antes de la fecha límite.</p>
                        <p style="color:#b07d12; font-weight:bold;">⚠️ Si no realizas las correcciones, tu solicitud podría ser rechazada.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'solicitud_aprobada': {
            titulo: '🎉 ¡Tu beca ha sido APROBADA!',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1e7e4f;">
                        <h1>🎉 ¡Felicidades!</h1>
                        <div class="sub">Tu beca ha sido aprobada</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>¡Felicidades! Tu solicitud de beca ha sido <strong>APROBADA</strong>.</p>
                        <div class="box box-success">
                            <p><strong>📋 Expediente:</strong> ${datos.expediente}</p>
                            <p><strong>🎓 Tipo de beca:</strong> ${datos.tipoBeca}</p>
                            <p><strong>📊 Porcentaje de cobertura:</strong> ${datos.porcentajeCobertura || '—'}</p>
                            ${datos.observaciones ? `<p><strong>📝 Observaciones:</strong> ${datos.observaciones}</p>` : ''}
                        </div>
                        <p>Para activar el beneficio, ingresa a tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a> y acepta la carta compromiso.</p>
                        <p style="color:#1e7e4f; font-weight:bold;">✅ Recuerda mantener un promedio mínimo de 80 para conservar el beneficio.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'solicitud_rechazada': {
            titulo: '❌ Actualización de tu solicitud de beca',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#c0392b;">
                        <h1>❌ Solicitud Rechazada</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Lamentamos informarte que tu solicitud de beca <strong>${datos.expediente}</strong> ha sido <strong>RECHAZADA</strong>.</p>
                        <div class="box box-danger">
                            <p><strong>📝 Motivo del rechazo:</strong></p>
                            <p>${datos.motivoRechazo || 'No cumple con los requisitos establecidos para este tipo de beca.'}</p>
                        </div>
                        <p>Si consideras que esta decisión debe ser revisada, puedes presentar una <strong>apelación</strong> desde tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a>.</p>
                        <p>El plazo para apelar es de 10 días hábiles.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== APELACIONES =====
        'apelacion_recibida': {
            titulo: '📋 Apelación recibida',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#2c4a7c;">
                        <h1>📋 Apelación Recibida</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Hemos recibido tu apelación para el expediente <strong>${datos.expediente}</strong>.</p>
                        <div class="box box-info">
                            <p><strong>📋 Expediente:</strong> ${datos.expediente}</p>
                            <p><strong>📅 Fecha de recepción:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <p>Un trabajador social revisará tu caso y te notificaremos la resolución.</p>
                        <p>El proceso de revisión puede tomar hasta 5 días hábiles.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'apelacion_resuelta': {
            titulo: '📋 Resolución de apelación',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:${datos.decision === 'Revocar Rechazo' ? '#1e7e4f' : '#c0392b'};">
                        <h1>📋 Apelación Resuelta</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Tu apelación para el expediente <strong>${datos.expediente}</strong> ha sido resuelta.</p>
                        <div class="box ${datos.decision === 'Revocar Rechazo' ? 'box-success' : 'box-danger'}">
                            <p><strong>✅ Decisión:</strong> ${datos.decision === 'Revocar Rechazo' ? 'Apelación ACEPTADA' : 'Apelación RECHAZADA'}</p>
                        </div>
                        ${datos.decision === 'Revocar Rechazo' 
                            ? '<p>Tu solicitud será reevaluada por el comité. Recibirás una nueva notificación cuando haya un resultado.</p>' 
                            : '<p>La decisión de rechazo se mantiene firme. Puedes contactar a la oficina de becas si necesitas más información.</p>'}
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== SUSPENSIONES =====
        'beca_suspendida': {
            titulo: `⛔ ${datos.tipo || 'Suspensión'} de beca`,
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#b07d12;">
                        <h1>⛔ ${datos.tipo || 'Suspensión de Beca'}</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Te informamos que tu beca ha sido <strong>${datos.tipo === 'Cancelación definitiva' ? 'CANCELADA' : 'SUSPENDIDA'}</strong>.</p>
                        <div class="box box-warning">
                            <p><strong>📋 Expediente:</strong> ${datos.expediente}</p>
                            <p><strong>📝 Motivo:</strong> ${datos.motivo}</p>
                            <p><strong>⏳ Duración:</strong> ${datos.dias}</p>
                            <p><strong>📋 Observaciones:</strong> ${datos.observaciones || 'Sin observaciones adicionales.'}</p>
                        </div>
                        <p><strong>¿Qué significa esto para ti?</strong></p>
                        <ul>
                            <li>${datos.tipo === 'Cancelación definitiva' 
                                ? '❌ El beneficio ha sido cancelado permanentemente.' 
                                : '⏸️ El beneficio queda suspendido por el período indicado.'}</li>
                            <li>📄 Puedes consultar los detalles en tu panel de estudiante.</li>
                            ${datos.tipo !== 'Cancelación definitiva' 
                                ? '<li>🔄 Al finalizar el período de suspensión, la beca se restaurará automáticamente.</li>' 
                                : '<li>📝 Puedes presentar una apelación si consideras que la decisión debe ser revisada.</li>'}
                        </ul>
                        <p>Para más información, contacta a la <strong>oficina de becas</strong>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'beca_restaurada': {
            titulo: '🔄 Beca restaurada',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1e7e4f;">
                        <h1>🔄 Beca Restaurada</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>¡Tu beca ha sido <strong>RESTAURADA</strong>!</p>
                        <div class="box box-success">
                            <p>El beneficio vuelve a estar activo a partir de hoy.</p>
                            <p><strong>📋 Expediente:</strong> ${datos.expediente || '—'}</p>
                            <p><strong>📅 Fecha de restauración:</strong> ${datos.fechaRestauracion || new Date().toLocaleString()}</p>
                        </div>
                        <p><strong>✅ Tu beca está nuevamente activa.</strong> Puedes seguir disfrutando de los beneficios.</p>
                        <p>Puedes verificar el estado en tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== JUSTIFICACIONES =====
        'justificacion_revisada': {
            titulo: '📝 Justificación de pérdida de cursos revisada',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:${datos.estado === 'Aprobada' ? '#1e7e4f' : '#c0392b'};">
                        <h1>📝 Justificación Revisada</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Tu justificación de pérdida de cursos para <strong>${datos.curso}</strong> ha sido revisada.</p>
                        <div class="box ${datos.estado === 'Aprobada' ? 'box-success' : 'box-danger'}">
                            <p><strong>✅ Estado:</strong> ${datos.estado}</p>
                            ${datos.observacion ? `<p><strong>📝 Observación:</strong> ${datos.observacion}</p>` : ''}
                        </div>
                        <p>Puedes ver los detalles en tu <a href="${process.env.APP_URL || 'http://localhost:3000'}">panel de estudiante</a>.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== CONVOCATORIAS =====
        'nueva_convocatoria': {
            titulo: '📢 Nueva convocatoria de becas disponible',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1a365d;">
                        <h1>📢 Nueva Convocatoria</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Se ha publicado una nueva convocatoria de becas.</p>
                        <div class="box box-info">
                            <p><strong>📋 Convocatoria:</strong> ${datos.convocatoria}</p>
                            <p><strong>🎓 Tipo:</strong> ${datos.tipo}</p>
                            <p><strong>📅 Apertura:</strong> ${datos.fechaApertura}</p>
                            <p><strong>📅 Cierre:</strong> ${datos.fechaCierre}</p>
                            <p><strong>📊 Cupos disponibles:</strong> ${datos.cupos}</p>
                        </div>
                        <p>Ingresa al <a href="${process.env.APP_URL || 'http://localhost:3000'}">Sistema de Becas</a> para solicitar tu beca.</p>
                        <p style="color:#c5a028; font-weight:bold;">⏳ ¡No esperes! Las convocatorias tienen cupos limitados.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },
        
        'convocatoria_cerrada': {
            titulo: '📢 Convocatoria cerrada',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#b07d12;">
                        <h1>📢 Convocatoria Cerrada</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Te informamos que la convocatoria <strong>${datos.convocatoria}</strong> ha sido <strong>CERRADA</strong>.</p>
                        <div class="box box-warning">
                            <p><strong>📋 Convocatoria:</strong> ${datos.convocatoria}</p>
                            <p><strong>🎓 Tipo:</strong> ${datos.tipo}</p>
                            <p><strong>📅 Fecha de cierre:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <p>Si ya realizaste tu solicitud, está siendo procesada. Recibirás notificaciones sobre el estado de tu solicitud.</p>
                        <p>Si no aplicaste, te invitamos a estar atento a las próximas convocatorias.</p>
                        <p>Ingresa al <a href="${process.env.APP_URL || 'http://localhost:3000'}">Sistema de Becas</a> para más información.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== NOTICIAS =====
        'nueva_noticia': {
            titulo: `📢 ${datos.titulo || 'Nueva noticia'}`,
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#1a365d;">
                        <h1>📢 Nueva Noticia</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <div class="box box-gold">
                            <h2 style="margin: 0 0 8px 0; color: #1a365d; font-size: 18px;">${datos.titulo}</h2>
                            <p style="margin: 0; color: #6b7585; font-size: 14px;">📅 ${datos.fecha || new Date().toLocaleDateString()}</p>
                        </div>
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e6e9f0;">
                            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${datos.contenido}</p>
                        </div>
                        <p>Ingresa al <a href="${process.env.APP_URL || 'http://localhost:3000'}">Sistema de Becas</a> para más información.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        },

        // ===== VISITAS =====
        'visita_programada': {
            titulo: '🏠 Visita domiciliaria programada',
            html: `
                <div class="container">
                    ${baseStyles}
                    <div class="header" style="background:#2c4a7c;">
                        <h1>🏠 Visita Domiciliaria</h1>
                        <div class="sub">Sistema de Becas Universitarias</div>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${datos.nombre || 'Estudiante'}</strong>,</p>
                        <p>Se ha programado una visita domiciliaria para tu solicitud.</p>
                        <div class="box box-info">
                            <p><strong>📅 Fecha:</strong> ${datos.fecha}</p>
                            <p><strong>📋 Expediente:</strong> ${datos.expediente}</p>
                            ${datos.observaciones ? `<p><strong>📝 Observaciones:</strong> ${datos.observaciones}</p>` : ''}
                        </div>
                        <p>Por favor, confirma tu disponibilidad en la fecha indicada.</p>
                        <p>Si tienes algún inconveniente, contacta a la oficina de becas.</p>
                        <div class="footer">
                            <p>Este es un mensaje automático. Por favor no responder a este correo.</p>
                            <p>Sistema de Becas Universitarias</p>
                        </div>
                    </div>
                </div>
            `
        }
    };

    // Devolver la plantilla correspondiente o una por defecto
    return templates[tipo] || templates['solicitud_recibida'];
}

/**
 * Función principal para enviar notificaciones por email
 * @param {string} tipo - Tipo de notificación
 * @param {Object} datos - Datos para la plantilla
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarNotificacionEmail(tipo, datos) {
    const template = generarPlantillaNotificacion(tipo, datos);

    if (!datos.email) {
        console.warn('⚠️ No se pudo enviar email: falta correo del destinatario');
        return { success: false, error: 'Falta correo del destinatario' };
    }

    // En desarrollo, usar email de pruebas
    let emailDestino = datos.email;
    if (process.env.NODE_ENV === 'development' && process.env.EMAIL_TEST) {
        emailDestino = process.env.EMAIL_TEST;
        console.log(`🧪 [DEV] Email redirigido a ${emailDestino} (original: ${datos.email})`);
    }

    try {
        const result = await sendEmail(
            emailDestino,
            template.titulo,
            template.html
        );

        if (result.success) {
            console.log(`📧 Notificación "${tipo}" enviada a ${datos.email}`);
        } else {
            console.warn(`⚠️ No se pudo enviar notificación "${tipo}" a ${datos.email}: ${result.error}`);
        }
        return result;
    } catch (error) {
        console.error('❌ Error enviando notificación email:', error);
        return { success: false, error: error.message };
    }
}

// Exportar funciones
module.exports = {
    sendEmail,
    enviarNotificacionEmail
};