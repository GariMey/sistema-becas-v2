<?php
// api/routes/auth.php
// Maneja: POST /api/auth/login, POST /api/auth/registro, POST /api/auth/recuperacion
// $accion viene del router (index.php) -- es el segundo segmento de la URL.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/tse.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../config/db.php';

function handleAuth(string $accion, string $metodo): void {
    if ($metodo !== 'POST') {
        jsonError('Metodo no permitido', 405);
    }

    switch ($accion) {
        case 'login':
            authLogin();
            break;
        case 'registro':
            authRegistro();
            break;
        case 'recuperacion':
            authRecuperacion();
            break;
        case 'reset-password':
            authResetPassword();
            break;
        default:
            jsonError('Ruta no encontrada', 404);
    }
}

function authLogin(): void {
    $body = getJsonBody();
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    $twoFactorCode = $body['twoFactorCode'] ?? null;

    if (!$email || !$password) {
        jsonError('Correo y contraseña son requeridos', 400);
    }

    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)');
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();

    if (!$usuario) {
        jsonError('Usuario no encontrado', 404);
    }

    if ($usuario['bloqueado']) {
        jsonError('Usuario bloqueado. Contacte al administrador.', 403);
    }

    if (!verificarPassword($password, $usuario['password'])) {
        $intentos = ($usuario['intentos'] ?? 0) + 1;
        $bloqueado = $intentos >= 3 ? 1 : 0;

        $upd = $pdo->prepare('UPDATE usuarios SET intentos = ?, bloqueado = ? WHERE id = ?');
        $upd->execute([$intentos, $bloqueado, $usuario['id']]);

        jsonError("Contraseña incorrecta. Intentos: {$intentos}/3", 401);
    }

    // 2FA (simulado, igual que el original: codigo fijo 123456)
    if ($usuario['two_factor_enabled'] && !$twoFactorCode) {
        jsonResponse(['require2FA' => true, 'message' => 'Ingresa código 2FA: 123456'], 200);
    }
    if ($usuario['two_factor_enabled'] && $twoFactorCode !== '123456') {
        jsonError('Código 2FA incorrecto', 401);
    }

    $pdo->prepare('UPDATE usuarios SET intentos = 0 WHERE id = ?')->execute([$usuario['id']]);

    $fecha = date('n/j/Y, g:i:s A');
    $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
        ->execute([$fecha, $usuario['nombre'], $usuario['rol'], 'Inicio de sesión', '—']);

    jsonResponse([
        'email' => $usuario['email'],
        'nombre' => $usuario['nombre'],
        'apellidos' => $usuario['apellidos'] ?? '',
        'cedula' => $usuario['cedula'] ?? '',
        'direccion' => $usuario['direccion'] ?? '',
        'rol' => $usuario['rol']
    ]);
}

function authRegistro(): void {
    $body = getJsonBody();
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    $cedula = trim($body['cedula'] ?? '');
    $direccion = trim($body['direccion'] ?? '');
    // nombre/apellidos escritos a mano: solo se usan si el TSE NO encuentra la cédula.
    $nombreManual = trim($body['nombre'] ?? '');
    $apellidosManual = trim($body['apellidos'] ?? '');

    if (!$email || !$password || !$cedula) {
        jsonError('Correo, contraseña y cédula son requeridos', 400);
    }
    if (strlen($password) < 6) {
        jsonError('La contraseña debe tener al menos 6 caracteres', 400);
    }

    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('Ya existe una cuenta con este correo', 400);
    }

    // Una cedula solo puede tener UNA cuenta (evita registrar la misma
    // identidad dos veces).
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE cedula = ?');
    $stmt->execute([$cedula]);
    if ($stmt->fetch()) {
        jsonError('Ya existe una cuenta registrada con esta cédula', 400);
    }

    // Consulta al TSE -- del lado del servidor, la persona no puede falsear
    // esto porque el nombre que se guarda es el que devuelve el TSE, no el
    // que haya escrito en el formulario (si la cedula existe en el padron).
    $tse = consultarTSE($cedula);
    if ($tse['encontrada'] && $tse['persona']) {
        $nombre = $tse['persona']['nombre'];
        $apellidos = trim($tse['persona']['primer_apellido'] . ' ' . $tse['persona']['segundo_apellido']);
    } else {
        // Cedula no encontrada en el padron (puede pasar, la API lo permite):
        // se usa lo que la persona escribio a mano.
        if (!$nombreManual || !$apellidosManual) {
            jsonError('No se encontró la cédula en el padrón del TSE. Escribe tu nombre y apellidos manualmente.', 400);
        }
        $nombre = $nombreManual;
        $apellidos = $apellidosManual;
    }

    $nombreCompleto = trim($nombre . ' ' . $apellidos);
    $hash = cifrarPassword($password);
    $emailLower = strtolower($email);

    $ins = $pdo->prepare(
        'INSERT INTO usuarios (email, password, rol, nombre, apellidos, cedula, direccion, intentos, bloqueado, two_factor_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)'
    );
    $ins->execute([$emailLower, $hash, 'aspirante', $nombreCompleto, $apellidos, $cedula, $direccion ?: null]);

    $fecha = date('n/j/Y, g:i:s A');
    $accionLog = 'Registro de nueva cuenta (aspirante)' . ($tse['encontrada'] ? ' - cédula verificada con TSE' : ' - cédula no encontrada en TSE');
    $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
        ->execute([$fecha, $nombreCompleto, 'aspirante', $accionLog, '—']);

    jsonResponse([
        'email' => $emailLower,
        'nombre' => $nombreCompleto,
        'apellidos' => $apellidos,
        'cedula' => $cedula,
        'rol' => 'aspirante',
        'cedulaVerificadaTSE' => $tse['encontrada'],
        'message' => 'Cuenta creada correctamente'
    ], 201);
}

function authRecuperacion(): void {
    $body = getJsonBody();
    $email = trim(strtolower($body['email'] ?? ''));

    if (!$email) jsonError('El correo es requerido', 400);

    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT id, nombre FROM usuarios WHERE LOWER(email) = LOWER(?)');
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();

    // Nota de seguridad: no revelamos si el correo existe o no en la
    // respuesta (evita que alguien use este formulario para averiguar qué
    // correos están registrados) -- pero SOLO mandamos el email si sí existe.
    if ($usuario) {
        $token = bin2hex(random_bytes(32)); // 64 caracteres
        $expira = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $pdo->prepare('INSERT INTO password_resets (email, token, expira_en) VALUES (?, ?, ?)')
            ->execute([$email, $token, $expira]);

        $link = APP_URL . '/restablecer-contrasena.html?token=' . $token;
        $html = plantillaEmail('Restablecer contraseña', '
            <p>Hola <strong>' . htmlspecialchars($usuario['nombre']) . '</strong>,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Este enlace es válido por 1 hora:</p>
            <p style="text-align:center;margin:24px 0;">
              <a href="' . htmlspecialchars($link) . '" style="background:#c5a028;color:#1a365d;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">Restablecer mi contraseña</a>
            </p>
            <p>Si no solicitaste esto, puedes ignorar este correo — tu contraseña actual sigue funcionando normalmente.</p>
        ');
        $resultadoEnvio = enviarEmail($email, 'Restablecer tu contraseña — Sistema de Becas', $html);

        $fecha = date('n/j/Y, g:i:s A');
        $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
            ->execute([$fecha, $email, 'visitante', 'Solicitud de recuperación de contraseña', '—']);
    }

    jsonResponse(['message' => 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.']);
}

function authResetPassword(): void {
    $body = getJsonBody();
    $token = trim($body['token'] ?? '');
    $passwordNueva = $body['password'] ?? '';

    if (!$token || !$passwordNueva) jsonError('Token y nueva contraseña son requeridos', 400);
    if (strlen($passwordNueva) < 6) jsonError('La contraseña debe tener al menos 6 caracteres', 400);

    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT * FROM password_resets WHERE token = ? AND usado = 0');
    $stmt->execute([$token]);
    $reset = $stmt->fetch();

    if (!$reset) jsonError('Este enlace no es válido o ya fue usado. Solicita uno nuevo.', 400);
    if (strtotime($reset['expira_en']) < time()) jsonError('Este enlace expiró. Solicita uno nuevo.', 400);

    $hash = cifrarPassword($passwordNueva);
    $pdo->prepare('UPDATE usuarios SET password = ?, intentos = 0, bloqueado = 0 WHERE LOWER(email) = LOWER(?)')
        ->execute([$hash, $reset['email']]);
    $pdo->prepare('UPDATE password_resets SET usado = 1 WHERE id = ?')->execute([$reset['id']]);

    $fecha = date('n/j/Y, g:i:s A');
    $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
        ->execute([$fecha, $reset['email'], 'visitante', 'Contraseña restablecida vía enlace de recuperación', '—']);

    jsonResponse(['message' => 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.']);
}
