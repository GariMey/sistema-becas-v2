// scripts/test-email.js
require('dotenv').config();
const { sendEmail } = require('../routes/emailService');

async function testEmail() {
  console.log('🧪 Probando envío de email con SendGrid...');
  console.log('📧 Usando email de origen:', process.env.EMAIL_FROM);
  console.log('📧 Email de prueba:', process.env.EMAIL_TEST);
  
  try {
    const result = await sendEmail(
      process.env.EMAIL_TEST || 'cuaderno.melanygr@gmail.com',
      '🧪 Prueba de Sistema de Becas',
      `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Prueba de Correo</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">✅ ¡Funciona!</h1>
            <div style="font-size: 14px; opacity: 0.8; margin-top: 5px;">Sistema de Becas Universitarias</div>
          </div>
          <div style="background: #ffffff; padding: 25px; border: 1px solid #e6e9f0; border-radius: 0 0 8px 8px;">
            <p>Este es un correo de prueba desde el <strong>Sistema de Becas</strong>.</p>
            <p>SendGrid está configurado correctamente.</p>
            <div style="background: #e7f5ee; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #b9e3cb;">
              <p style="margin: 0; color: #1e7e4f;">✅ <strong>Configuración exitosa</strong></p>
              <p style="margin: 5px 0 0 0; color: #1e7e4f; font-size: 14px;">Las notificaciones se enviarán automáticamente</p>
            </div>
            <hr style="border: 1px solid #e6e9f0; margin: 20px 0;">
            <p style="color: #6b7585; font-size: 12px; text-align: center;">
              Sistema de Becas Universitarias<br>
              Este es un mensaje automático. Por favor no responder a este correo.
            </p>
          </div>
        </body>
        </html>
      `
    );
    
    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log('📋 Message ID:', result.messageId);
      console.log('📋 Status Code:', result.statusCode);
      console.log('📧 Revisa tu bandeja de entrada:', process.env.EMAIL_TEST);
    } else {
      console.log('❌ Error al enviar email:', result.error);
    }
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

testEmail();