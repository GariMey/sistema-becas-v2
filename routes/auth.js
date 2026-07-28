// routes/auth.js
const express = require('express');
const router = express.Router();
const { enviarNotificacionEmail } = require('./emailService');
const crypto = require('crypto');

// ===== USUARIOS SIMULADOS (para desarrollo) =====
// En producción, esto vendría de la base de datos
function getUsuariosSimulados() {
    return [
        { email: 'estudiante@becas.com', password: '123456', nombre: 'María Gómez', rol: 'estudiante', activo: 1, twoFactorEnabled: false },
        { email: 'estudiante2@becas.com', password: '123456', nombre: 'José Ramírez', rol: 'estudiante', activo: 1, twoFactorEnabled: false },
        { email: 'estudiante3@becas.com', password: '123456', nombre: 'Ana López', rol: 'estudiante', activo: 1, twoFactorEnabled: false },
        { email: 'social@becas.com', password: '123456', nombre: 'Carlos Rodríguez', rol: 'trabajador_social', activo: 1, twoFactorEnabled: false },
        { email: 'comite@becas.com', password: '123456', nombre: 'Dra. Ana Méndez', rol: 'comite', activo: 1, twoFactorEnabled: false },
        { email: 'admin@becas.com', password: '123456', nombre: 'Admin Sistema', rol: 'admin', activo: 1, twoFactorEnabled: false },
        { email: 'auditor@becas.com', password: '123456', nombre: 'Luis Fernández', rol: 'auditor', activo: 1, twoFactorEnabled: false }
    ];
}

// ===== FUNCIÓN PARA REGISTRAR EN BITÁCORA =====
function registrarBitacora(accion, email) {
    console.log(`📋 [BITÁCORA] ${accion} - ${email || 'sin email'} - ${new Date().toISOString()}`);
}

// =====================================================
// RUTAS - CORREGIDAS (sin /auth en cada ruta)
// =====================================================

// ===== RECUPERACIÓN DE CONTRASEÑA =====
router.post('/recuperacion', async (req, res) => {
    console.log('📨 [recuperacion] Solicitud recibida:', req.body);
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }

    try {
        // Buscar usuario (simulado)
        const usuarios = getUsuariosSimulados();
        const usuario = usuarios.find(u => u.email === email && u.activo === 1);

        if (!usuario) {
            console.log('❌ Usuario no encontrado:', email);
            return res.status(404).json({ 
                error: 'No existe una cuenta asociada a este correo electrónico',
                simulated: true 
            });
        }

        console.log('✅ Usuario encontrado:', usuario.email);

        // Generar token de recuperación
        const tokenRecuperacion = crypto.randomBytes(32).toString('hex');
        
        // Enviar correo de recuperación
        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}?token=${tokenRecuperacion}`;
        
        console.log(`📧 Enviando email de recuperación a: ${email}`);
        console.log(`🔗 Enlace: ${resetLink}`);
        
        const result = await enviarNotificacionEmail('recuperacion_password', {
            email: email,
            nombre: usuario.nombre || 'Usuario',
            resetLink: resetLink
        });

        console.log(`📧 Resultado del envío:`, result);

        registrarBitacora('Solicitud de recuperación de contraseña', email);

        res.json({ 
            success: true, 
            message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.',
            simulated: result.simulated || false,
            debug: {
                email: email,
                resetLink: resetLink
            }
        });

    } catch (error) {
        console.error('❌ Error en recuperación de contraseña:', error);
        res.status(500).json({ 
            error: 'Error al procesar la solicitud',
            details: error.message 
        });
    }
});

// ===== REINICIAR CONTRASEÑA =====
router.post('/reset-password', async (req, res) => {
    console.log('📨 [reset-password] Solicitud recibida:', req.body);
    const { token, nuevaPassword } = req.body;

    if (!token || !nuevaPassword) {
        return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
    }

    if (nuevaPassword.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        // En producción, validarías el token en la DB
        // Por ahora, simulamos éxito
        const email = 'usuario@ejemplo.com';
        
        console.log(`✅ Token válido para usuario: ${email}`);

        // Enviar notificación de cambio de contraseña
        await enviarNotificacionEmail('password_cambiada', {
            email: email,
            nombre: 'Usuario'
        });

        registrarBitacora('Contraseña actualizada', email);

        res.json({ 
            success: true, 
            message: 'Contraseña actualizada correctamente' 
        });

    } catch (error) {
        console.error('❌ Error al reiniciar contraseña:', error);
        res.status(500).json({ 
            error: 'Error al procesar la solicitud',
            details: error.message 
        });
    }
});

// ===== INICIO DE SESIÓN =====
router.post('/login', async (req, res) => {
    console.log('📨 [login] Solicitud recibida:', req.body);
    const { email, password, twoFactorCode } = req.body;

    try {
        // Buscar usuario (simulado)
        const usuarios = getUsuariosSimulados();
        const usuario = usuarios.find(u => u.email === email && u.activo === 1);

        if (!usuario) {
            console.log('❌ Usuario no encontrado:', email);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        console.log('✅ Usuario encontrado:', usuario.email);

        // Verificar contraseña
        const passwordValida = password === '123456' || password === usuario.password;
        
        if (!passwordValida) {
            console.log('❌ Contraseña incorrecta para:', email);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar 2FA
        if (usuario.twoFactorEnabled) {
            if (!twoFactorCode) {
                console.log('🔐 2FA requerido para:', email);
                return res.status(401).json({ 
                    require2FA: true,
                    message: 'Se requiere código de autenticación de dos factores'
                });
            }

            const esValido = twoFactorCode === '123456';
            if (!esValido) {
                console.log('❌ Código 2FA inválido para:', email);
                return res.status(401).json({ error: 'Código 2FA inválido' });
            }
            console.log('✅ Código 2FA verificado para:', email);
        }

        console.log('✅ Login exitoso para:', email);

        // Notificar inicio de sesión
        try {
            const ip = req.ip || req.connection?.remoteAddress || 'No disponible';
            const userAgent = req.headers['user-agent'] || 'Dispositivo desconocido';
            
            await enviarNotificacionEmail('nuevo_inicio_sesion', {
                email: email,
                nombre: usuario.nombre || 'Usuario',
                ip: ip,
                dispositivo: userAgent,
                fecha: new Date().toLocaleString()
            });
            console.log('📧 Notificación de inicio de sesión enviada');
        } catch (e) {
            console.warn('⚠️ No se pudo enviar notificación de inicio de sesión:', e.message);
        }

        registrarBitacora('Inicio de sesión', email);

        res.json({
            success: true,
            email: usuario.email,
            nombre: usuario.nombre,
            rol: usuario.rol
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ 
            error: 'Error al iniciar sesión',
            details: error.message 
        });
    }
});

// ===== GENERAR CÓDIGO 2FA (para enviar por email) =====
router.post('/generar-2fa', async (req, res) => {
    console.log('📨 [generar-2fa] Solicitud recibida:', req.body);
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }

    try {
        // Generar código 2FA de 6 dígitos
        const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`🔐 Código 2FA generado para ${email}: ${codigo2FA}`);

        // Enviar correo con código 2FA
        const result = await enviarNotificacionEmail('codigo_2fa', {
            email: email,
            nombre: 'Usuario',
            codigo: codigo2FA,
            expiracion: '10 minutos'
        });

        console.log(`📧 Resultado envío 2FA:`, result);

        res.json({ 
            success: true, 
            message: 'Código 2FA enviado a tu correo electrónico.',
            simulated: result.simulated || false
        });

    } catch (error) {
        console.error('❌ Error al generar 2FA:', error);
        res.status(500).json({ 
            error: 'Error al generar código 2FA',
            details: error.message 
        });
    }
});

// ===== NOTIFICAR NUEVO INICIO DE SESIÓN =====
router.post('/notificar-inicio-sesion', async (req, res) => {
    console.log('📨 [notificar-inicio-sesion] Solicitud recibida:', req.body);
    const { email, nombre, userAgent } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }

    try {
        const ip = req.ip || req.connection?.remoteAddress || 'No disponible';
        const dispositivo = userAgent || 'Dispositivo desconocido';
        
        const result = await enviarNotificacionEmail('nuevo_inicio_sesion', {
            email: email,
            nombre: nombre || 'Usuario',
            ip: ip,
            dispositivo: dispositivo,
            fecha: new Date().toLocaleString()
        });

        console.log(`📧 Notificación de inicio de sesión enviada a ${email}`);

        res.json({ 
            success: true,
            simulated: result.simulated || false
        });

    } catch (error) {
        console.error('❌ Error al notificar inicio de sesión:', error);
        res.json({ success: true, error: 'Notificación no enviada' });
    }
});

module.exports = router;

