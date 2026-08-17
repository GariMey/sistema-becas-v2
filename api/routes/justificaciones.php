<?php
// api/routes/justificaciones.php
// GET / (lista, filtrable), POST / (crear), PUT /:id/revisar

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleJustificaciones(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === '') {
        $condiciones = [];
        $params = [];

        if (in_array($user['rol'], ['estudiante', 'aspirante'], true)) {
            $condiciones[] = 'estudiante_email = ?';
            $params[] = $user['email'];
        }
        $estado = $_GET['estado'] ?? null;
        if ($estado && $estado !== 'todas') {
            $condiciones[] = 'estado = ?';
            $params[] = $estado;
        }

        $sql = 'SELECT * FROM justificaciones';
        if ($condiciones) $sql .= ' WHERE ' . implode(' AND ', $condiciones);
        $sql .= ' ORDER BY id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        $body = getJsonBody();
        $curso = $body['curso'] ?? null;
        $codigo = $body['codigo'] ?? null;
        $periodo = $body['periodo'] ?? null;
        $motivo = $body['motivo'] ?? null;
        $email = $body['email'] ?? $user['email'];

        if (!$curso || !$codigo || !$periodo || !$motivo) {
            jsonError('Campos requeridos faltantes', 400);
        }

        $fecha = date('n/j/Y, g:i:s A');
        $stmt = $pdo->prepare(
            "INSERT INTO justificaciones (estudiante_email, nombre_estudiante, curso, codigo, periodo, nota, motivo, estado, fecha, archivo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?)"
        );
        $stmt->execute([
            $email, $body['nombreEstudiante'] ?? $email, $curso, $codigo, $periodo,
            $body['nota'] ?? null, $motivo, $fecha, $body['archivo'] ?? null
        ]);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, "Justificación enviada: $curso ($codigo)");
        jsonResponse(['id' => (int)$id, 'message' => 'Justificación enviada correctamente'], 201);
    }

    if ($metodo === 'PUT' && $primero !== '' && ($partes[1] ?? '') === 'revisar') {
        requireRole($user, ['trabajador_social']);
        $body = getJsonBody();
        $estado = $body['estado'] ?? null;
        $observacion = $body['observacion'] ?? '';

        $stmt = $pdo->prepare('SELECT * FROM justificaciones WHERE id = ?');
        $stmt->execute([$primero]);
        $justificacion = $stmt->fetch();
        if (!$justificacion) jsonError('Justificación no encontrada', 404);

        $pdo->prepare('UPDATE justificaciones SET estado=?, observacion=? WHERE id=?')
            ->execute([$estado, $observacion, $primero]);

        registrarBitacora($pdo, $user, "Justificación $estado");

        enviarNotificacionEmail('justificacion_revisada', [
            'email' => $justificacion['estudiante_email'],
            'nombre' => $justificacion['nombre_estudiante'] ?: $justificacion['estudiante_email'],
            'curso' => $justificacion['curso'], 'estado' => $estado, 'observacion' => $observacion
        ]);

        jsonResponse(['message' => "Justificación $estado"]);
    }

    jsonError('Ruta no encontrada', 404);
}
