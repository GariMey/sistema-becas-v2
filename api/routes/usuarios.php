<?php
// api/routes/usuarios.php
// GET / (todos), POST / (crear), PUT /:id (editar), DELETE /:id, PUT /:id/toggle-2fa
// Todo el módulo es exclusivo de admin.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/tse.php';
require_once __DIR__ . '/../config/db.php';

function handleUsuarios(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    // GET /api/usuarios/me: cualquier usuario autenticado puede ver SU
    // PROPIA información de registro (la que se guardó en la tabla al
    // crear la cuenta), sin necesitar el rol admin que exige el resto
    // de este módulo.
    if ($metodo === 'GET' && $primero === 'me') {
        $stmt = $pdo->prepare('
            SELECT id, email, nombre, apellidos, rol, cedula, fecha_nacimiento,
                   direccion, two_factor_enabled, created_at
            FROM usuarios WHERE LOWER(email) = LOWER(?)
        ');
        $stmt->execute([$user['email']]);
        $datos = $stmt->fetch();
        if (!$datos) jsonError('Usuario no encontrado', 404);
        jsonResponse($datos);
    }

    requireRole($user, ['admin']);

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('
            SELECT id, email, nombre, apellidos, rol, intentos, bloqueado, two_factor_enabled,
                   cedula, fecha_nacimiento, direccion, info_padron, created_at
            FROM usuarios ORDER BY id
        ')->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        $body = getJsonBody();
        $email = trim($body['email'] ?? '');
        $nombre = trim($body['nombre'] ?? '');
        $rol = $body['rol'] ?? '';
        $cedula = trim($body['cedula'] ?? '');

        if (!$email || !$nombre || !$rol) jsonError('Email, nombre y rol son requeridos', 400);

        $rolesValidos = ['estudiante', 'aspirante', 'trabajador_social', 'comite', 'admin', 'auditor'];
        if (!in_array($rol, $rolesValidos, true)) jsonError('Rol inválido', 400);

        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)');
        $stmt->execute([$email]);
        if ($stmt->fetch()) jsonError('Ya existe un usuario con ese correo', 409);

        $apellidos = trim($body['apellidos'] ?? '');
        $infoTSE = null;

        // Si se dio cédula, se consulta el TSE real para verificar la
        // identidad (reemplaza al viejo padrón local que nunca existió).
        // Si el TSE encuentra la cédula, su nombre/apellidos son los que
        // se guardan -- no lo que haya escrito el admin -- igual que en el
        // auto-registro de estudiantes.
        if ($cedula) {
            $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE cedula = ?');
            $stmt->execute([$cedula]);
            if ($stmt->fetch()) jsonError('Ya existe una cuenta registrada con esta cédula', 409);

            $tse = consultarTSE($cedula);
            if ($tse['encontrada'] && $tse['persona']) {
                $nombre = $tse['persona']['nombre'];
                $apellidos = trim($tse['persona']['primer_apellido'] . ' ' . $tse['persona']['segundo_apellido']);
                $infoTSE = json_encode($tse['persona'], JSON_UNESCAPED_UNICODE);
            }
            // Si no se encuentra, se sigue igual con lo que escribió el admin
            // (la propia API del TSE permite este caso).
        }

        $nombreCompleto = trim($nombre . ' ' . $apellidos);
        $hash = cifrarPassword($body['password'] ?? '123456');

        $stmt = $pdo->prepare(
            'INSERT INTO usuarios (email, password, rol, nombre, apellidos, cedula, fecha_nacimiento, direccion, info_padron)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $email, $hash, $rol, $nombreCompleto, $apellidos ?: null, $cedula ?: null,
            $body['fechaNacimiento'] ?? null, $body['direccion'] ?? null, $infoTSE
        ]);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, 'Usuario creado: ' . $nombreCompleto . " (rol: $rol)" . ($cedula ? ($infoTSE ? ' - cédula verificada con TSE' : ' - cédula no encontrada en TSE') : ''));

        jsonResponse(['id' => (int)$id, 'message' => 'Usuario creado correctamente', 'cedulaVerificadaTSE' => (bool)$infoTSE], 201);
    }

    if ($metodo === 'PUT' && $primero !== '' && ($partes[1] ?? '') === 'toggle-2fa') {
        $stmt = $pdo->prepare('SELECT two_factor_enabled, nombre FROM usuarios WHERE id = ?');
        $stmt->execute([$primero]);
        $usuario = $stmt->fetch();
        if (!$usuario) jsonError('Usuario no encontrado', 404);

        $nuevoValor = $usuario['two_factor_enabled'] ? 0 : 1;
        $pdo->prepare('UPDATE usuarios SET two_factor_enabled = ? WHERE id = ?')->execute([$nuevoValor, $primero]);

        registrarBitacora($pdo, $user, '2FA ' . ($nuevoValor ? 'activado' : 'desactivado') . ' para: ' . $usuario['nombre']);
        jsonResponse(['twoFactorEnabled' => (bool)$nuevoValor]);
    }

    if ($metodo === 'PUT' && $primero !== '') {
        $body = getJsonBody();

        $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE id = ?');
        $stmt->execute([$primero]);
        $usuario = $stmt->fetch();
        if (!$usuario) jsonError('Usuario no encontrado', 404);

        if (!empty($body['rol'])) {
            $rolesValidos = ['estudiante', 'aspirante', 'trabajador_social', 'comite', 'admin', 'auditor'];
            if (!in_array($body['rol'], $rolesValidos, true)) jsonError('Rol inválido', 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE usuarios SET nombre=?, apellidos=?, email=?, rol=?, cedula=?, fecha_nacimiento=?, direccion=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
        );
        $stmt->execute([
            $body['nombre'] ?? $usuario['nombre'], $body['apellidos'] ?? $usuario['apellidos'],
            $body['email'] ?? $usuario['email'], $body['rol'] ?? $usuario['rol'],
            $body['cedula'] ?? $usuario['cedula'], $body['fechaNacimiento'] ?? $usuario['fecha_nacimiento'],
            $body['direccion'] ?? $usuario['direccion'], $primero
        ]);

        registrarBitacora($pdo, $user, 'Usuario editado: ' . ($body['nombre'] ?? $usuario['nombre']));
        jsonResponse(['message' => 'Usuario actualizado']);
    }

    if ($metodo === 'DELETE' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT nombre, email FROM usuarios WHERE id = ?');
        $stmt->execute([$primero]);
        $usuario = $stmt->fetch();
        if (!$usuario) jsonError('Usuario no encontrado', 404);

        if (strtolower($usuario['email']) === strtolower($user['email'])) {
            jsonError('No puedes eliminar tu propia cuenta', 400);
        }

        $pdo->prepare('DELETE FROM usuarios WHERE id = ?')->execute([$primero]);
        registrarBitacora($pdo, $user, 'Usuario eliminado: ' . $usuario['nombre']);
        jsonResponse(['message' => 'Usuario eliminado']);
    }

    jsonError('Ruta no encontrada', 404);
}