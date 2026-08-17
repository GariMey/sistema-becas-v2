<?php
// api/config/email.php
// Reemplaza estos valores con los reales de tu cuenta de SendGrid.
// SENDGRID_API_KEY: Settings -> API Keys en app.sendgrid.com
// EMAIL_FROM: debe ser el correo que verificaste en Settings -> Sender Authentication

define('SENDGRID_API_KEY', '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');
define('EMAIL_FROM', 'ziu191919@gmail.com');
define('EMAIL_FROM_NAME', 'Sistema de Becas Universitarias');

// Se usa para armar los links dentro de los correos (ej. el link de
// restablecer contraseña). Se arma solo a partir del dominio real, así no
// hay que tocarlo si cambia el subdominio.
define('APP_URL', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
