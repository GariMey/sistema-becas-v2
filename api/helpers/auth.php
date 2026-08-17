<?php
// api/helpers/auth.php
// Mismo esquema que el proyecto Node original: el frontend guarda la sesion
// en localStorage tras el login y manda el email/rol en headers en cada
// request (x-user-email, x-user-rol). No hay sesiones de servidor ni JWT.
// Esto significa que common.js / api.js del frontend NO necesitan cambiar.

require_once __DIR__ . '/response.php';

function getHeaderValue(string $nombre): ?string {
    // $_SERVER normaliza headers como HTTP_X_USER_EMAIL de forma consistente
    // entre mod_php y php-fpm (a diferencia de getallheaders(), que no
    // siempre esta disponible segun el SAPI).
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $nombre));
    return $_SERVER[$key] ?? null;
}

// Equivalente a authMiddleware de Express. Si no hay email/rol, corta la
// ejecucion con 401 (igual que el original).
function requireAuth(): array {
    $email = getHeaderValue('x-user-email');
    $rol = getHeaderValue('x-user-rol');

    if (!$email || !$rol) {
        jsonError('No autenticado', 401);
    }

    return ['email' => $email, 'rol' => $rol];
}

// Equivalente a requireRole(...roles) de Express.
function requireRole(array $user, array $rolesPermitidos): void {
    if (!in_array($user['rol'], $rolesPermitidos, true)) {
        jsonError('No tiene permisos para esta accion', 403);
    }
}

function cifrarPassword(string $pwd): string {
    return password_hash($pwd, PASSWORD_BCRYPT, ['cost' => 10]);
}

function verificarPassword(string $pwd, string $hash): bool {
    // password_verify() es compatible con hashes bcrypt generados por
    // bcryptjs (Node) -- mismo algoritmo, mismo formato $2a$/$2b$/$2y$.
    // Los usuarios sembrados en Node (admin@becas.com, etc.) van a poder
    // loguearse sin volver a crear su password.
    return password_verify($pwd, $hash);
}
