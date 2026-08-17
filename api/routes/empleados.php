<?php
// api/routes/empleados.php
// GET / (todos), POST / (crear), PUT /:id, DELETE /:id -- exclusivo admin

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';

function handleEmpleados(string $primero, string $metodo): void {
    $pdo = getPDO();
    $user = requireAuth();
    requireRole($user, ['admin']);

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('SELECT * FROM empleados ORDER BY id')->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        $body = getJsonBody();
        $nombre = trim($body['nombre'] ?? '');
        if (!$nombre) jsonError('El nombre es requerido', 400);

        $stmt = $pdo->prepare('INSERT INTO empleados (nombre, departamento, cargo, correo, telefono) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$nombre, $body['departamento'] ?? '', $body['cargo'] ?? '', $body['correo'] ?? '', $body['telefono'] ?? '']);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, "Empleado agregado: $nombre");
        jsonResponse(['id' => (int)$id, 'message' => 'Empleado agregado'], 201);
    }

    if ($metodo === 'PUT' && $primero !== '') {
        $body = getJsonBody();
        $nombre = $body['nombre'] ?? null;

        $stmt = $pdo->prepare('UPDATE empleados SET nombre=?, departamento=?, cargo=?, correo=?, telefono=? WHERE id=?');
        $stmt->execute([$nombre, $body['departamento'] ?? null, $body['cargo'] ?? null, $body['correo'] ?? null, $body['telefono'] ?? null, $primero]);
        if ($stmt->rowCount() === 0) jsonError('Empleado no encontrado', 404);

        registrarBitacora($pdo, $user, "Empleado editado: $nombre");
        jsonResponse(['message' => 'Empleado actualizado']);
    }

    if ($metodo === 'DELETE' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT nombre FROM empleados WHERE id = ?');
        $stmt->execute([$primero]);
        $emp = $stmt->fetch();

        $pdo->prepare('DELETE FROM empleados WHERE id = ?')->execute([$primero]);
        if (!$emp) jsonError('Empleado no encontrado', 404);

        registrarBitacora($pdo, $user, 'Empleado eliminado: ' . $emp['nombre']);
        jsonResponse(['message' => 'Empleado eliminado']);
    }

    jsonError('Ruta no encontrada', 404);
}
