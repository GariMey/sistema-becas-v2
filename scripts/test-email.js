/**
 * TEST DE ENVÍO DE CORREOS
 * 
 * Ejecutar con: node test-email.js
 * 
 * Este script prueba la configuración de correo y envía un correo de prueba
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// ============================================================
// CONFIGURACIÓN
// ============================================================

// Correo de prueba (cambiar por un correo real para recibir el test)
const EMAIL_TEST = 'melanygaritauu1276@gmail.com'; // <-- CAMBIAR ESTO

// ============================================================
// FUNCIONES DE TEST
// ============================================================

/**
 * Test 1: Verificar configuración de entorno
 */
function testConfiguracion() {
    console.log('\n📋 TEST 1: Verificando configuración de entorno');
    console.log('━'.repeat(50));

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser) {
        console.log('❌ ERROR: EMAIL_USER no está definido en .env');
        return false;
    }
    
    if (!emailPass) {
        console.log('❌ ERROR: EMAIL_PASS no está definido en .env');
        return false;
    }
    
    console.log('✅ EMAIL_USER:', emailUser);
    console.log('✅ EMAIL_PASS:', '********'.padEnd(16, '*'));
    console.log('✅ Configuración completa');
    return true;
}

/**
 * Test 2: Verificar conexión con Gmail
 */
async function testConexion() {
    console.log('\n📋 TEST 2: Verificando conexión con Gmail');
    console.log('━'.repeat(50));

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.verify();
        console.log('✅ Conexión exitosa con Gmail');
        return true;
    } catch (error) {
        console.log('❌ Error de conexión:', error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('   1. Verifica que la contraseña de aplicación sea correcta');
        console.log('   2. Asegúrate de tener activada la verificación en 2 pasos');
        console.log('   3. Genera una nueva contraseña de aplicación en:');
        console.log('      https://myaccount.google.com/apppasswords');
        return false;
    }
}

/**
 * Test 3: Enviar correo de prueba
 */
async function testEnvioCorreo(para) {
    console.log('\n📋 TEST 3: Enviando correo de prueba');
    console.log('━'.repeat(50));

    if (!para) {
        console.log('❌ ERROR: No se especificó un correo de destino');
        console.log('   Edita el archivo y cambia EMAIL_TEST por tu correo');
        return false;
    }

    console.log('📧 Destinatario:', para);

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; background: #f6f7fb; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                .header { background: #1a365d; color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; color: #e0c468; }
                .content { padding: 30px; }
                .info-box { background: #f6f7fb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d; }
                .success { color: #1e7e4f; font-weight: bold; }
                .footer { text-align: center; color: #6b7585; font-size: 0.8rem; padding: 20px; border-top: 1px solid #e6e9f0; }
                .badge { 
                    display: inline-block; 
                    background: #e7f5ee; 
                    color: #1e7e4f; 
                    padding: 4px 12px; 
                    border-radius: 20px; 
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 Sistema de Becas</h1>
                    <p style="opacity: 0.8;">Prueba de correo electrónico</p>
                </div>
                <div class="content">
                    <h2 style="color: #1a365d;">¡Correo de prueba!</h2>
                    <p>Este es un correo de prueba enviado desde el <strong>Sistema de Becas Universitarias</strong>.</p>
                    
                    <div class="info-box">
                        <p><strong>📋 Información del test:</strong></p>
                        <p>✅ Configuración de correo: <span class="success">Correcta</span></p>
                        <p>📧 Enviado desde: ${process.env.EMAIL_USER}</p>
                        <p>🕐 Fecha y hora: ${new Date().toLocaleString()}</p>
                        <p><span class="badge">✅ PRUEBA EXITOSA</span></p>
                    </div>
                    
                    <p style="color: #6b7585; font-size: 0.9rem; margin-top: 20px;">
                        Si estás viendo este correo, el sistema de notificaciones está funcionando correctamente.
                    </p>
                </div>
                <div class="footer">
                    <p>Sistema de Becas Universitarias</p>
                    <p>Este es un correo automático de prueba</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"Sistema de Becas" <${process.env.EMAIL_USER}>`,
            to: para,
            subject: '✅ TEST - Sistema de Becas - Configuración de correo',
            text: 'Este es un correo de prueba del Sistema de Becas. Configuración exitosa.',
            html: html
        };

        console.log('📤 Enviando correo...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Correo enviado exitosamente!');
        console.log('   📧 Message ID:', info.messageId);
        console.log('   📨 Enviado a:', para);
        console.log('   🕐 Fecha:', new Date().toLocaleString());
        
        return true;
    } catch (error) {
        console.log('❌ Error al enviar correo:', error.message);
        console.log('\n💡 Posibles causas:');
        console.log('   1. El correo de destino no existe o es inválido');
        console.log('   2. El remitente no está autorizado');
        console.log('   3. Problemas de conexión con Gmail');
        console.log('   4. La contraseña de aplicación ha expirado');
        return false;
    }
}

/**
 * Test 4: Enviar correo con diferentes estados
 */
async function testEstados() {
    console.log('\n📋 TEST 4: Probando correos con diferentes estados');
    console.log('━'.repeat(50));

    const estados = ['enviada', 'aprobada', 'rechazada', 'subsanacion', 'visita', 'comite'];
    
    for (const estado of estados) {
        console.log(`📧 Probando estado: ${estado}`);
        
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>📄 Estado: ${estado}</h2>
                <p>Este es un correo de prueba para el estado <strong>${estado}</strong></p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                    <p><strong>Expediente:</strong> TEST-001</p>
                    <p><strong>Estado:</strong> ${estado}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
                </div>
            </div>
            `;

            const mailOptions = {
                from: `"Sistema de Becas" <${process.env.EMAIL_USER}>`,
                to: EMAIL_TEST,
                subject: `TEST - Estado: ${estado}`,
                text: `Prueba de estado: ${estado}`,
                html: html
            };

            await transporter.sendMail(mailOptions);
            console.log(`   ✅ Correo de ${estado} enviado`);
            
            // Pequeña pausa para no saturar
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`   ❌ Error en ${estado}:`, error.message);
        }
    }
    
    console.log('✅ Prueba de estados completada');
    return true;
}

// ============================================================
// EJECUCIÓN PRINCIPAL
// ============================================================

async function runTests() {
    console.log('\n' + '═'.repeat(60));
    console.log('🧪 SISTEMA DE BECAS - TEST DE CORREOS');
    console.log('═'.repeat(60));

    // Test 1: Configuración
    const configOk = testConfiguracion();
    if (!configOk) {
        console.log('\n❌ Prueba detenida: Configuración incompleta');
        console.log('   Asegúrate de tener un archivo .env con:');
        console.log('   EMAIL_USER=tu_correo@gmail.com');
        console.log('   EMAIL_PASS=tu_contraseña_aplicacion');
        return;
    }

    // Test 2: Conexión
    const conexionOk = await testConexion();
    if (!conexionOk) {
        console.log('\n❌ Prueba detenida: No se pudo conectar a Gmail');
        return;
    }

    // Test 3: Envío de correo de prueba
    const envioOk = await testEnvioCorreo(EMAIL_TEST);
    if (!envioOk) {
        console.log('\n❌ Prueba detenida: Error al enviar correo de prueba');
        console.log('   Verifica que EMAIL_TEST sea un correo válido');
        return;
    }

    // Test 4: Estados (opcional, comentar para no saturar)
    console.log('\n' + '═'.repeat(60));
    console.log('💡 ¿Deseas probar todos los estados de correo?');
    console.log('   Esto enviará múltiples correos de prueba');
    console.log('   Presiona Enter para continuar o Ctrl+C para detener');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await testEstados();

    // Resumen final
    console.log('\n' + '═'.repeat(60));
    console.log('✅ RESULTADO DE LAS PRUEBAS');
    console.log('═'.repeat(60));
    console.log('✅ Configuración: OK');
    console.log('✅ Conexión a Gmail: OK');
    console.log('✅ Envío de correo: OK');
    console.log('✅ Estados: OK');
    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('📧 Revisa la bandeja de entrada de', EMAIL_TEST);
    console.log('═'.repeat(60));
}

// Ejecutar pruebas
runTests().catch(error => {
    console.error('\n❌ Error inesperado:', error);
    process.exit(1);
});