<?php
// api/routes/apelaciones.php
// GET / (todas), POST / (crear), PUT /:expediente/resolver

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleApelaciones(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === '') {
        // Un estudiante/aspirante solo debe ver SUS PROPIAS apelaciones.
        // (trabajador_social, comite y admin sí ven todas, para poder resolverlas)
        if (in_array($user['rol'], ['estudiante', 'aspirante'], true)) {
            $stmt = $pdo->prepare('SELECT * FROM apelaciones WHERE email = ? ORDER BY id DESC');
            $stmt->execute([$user['email']]);
            jsonResponse($stmt->fetchAll());
        }
        jsonResponse($pdo->query('SELECT * FROM apelaciones ORDER BY id DESC')->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        $body = getJsonBody();
        $expediente = $body['expediente'] ?? null;
        $email = $body['email'] ?? null;
        $motivo = $body['motivo'] ?? '';

        if (!$expediente || !$email || strlen(trim($motivo)) < 50) {
            jsonError('Expediente, correo y motivo (mínimo 50 caracteres) son requeridos', 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM apelaciones WHERE expediente = ?');
        $stmt->execute([$expediente]);
        if (count($stmt->fetchAll()) >= 3) {
            jsonError('Ya se alcanzó el límite de 3 apelaciones para este expediente', 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
        $stmt->execute([$expediente]);
        $solicitud = $stmt->fetch();
        if (!$solicitud) jsonError('La solicitud del expediente no existe', 404);
        if (!in_array($solicitud['estado'], ['Rechazada', 'Rechazado Definitivo'], true)) {
            jsonError('Solo se puede apelar una solicitud rechazada', 400);
        }

        $fecha = date('n/j/Y, g:i:s A');
        $stmt = $pdo->prepare(
            "INSERT INTO apelaciones (expediente, email, nombre_estudiante, motivo, estado, fecha, decision, archivo, tipo_beca)
             VALUES (?, ?, ?, ?, 'Pendiente', ?, NULL, ?, ?)"
        );
        $stmt->execute([
            $expediente, $email, $body['nombreEstudiante'] ?? $email, $motivo, $fecha,
            $body['archivo'] ?? null, $body['tipoBeca'] ?? $solicitud['tipo_beca']
        ]);
        $id = $pdo->lastInsertId();

        // La apelación pone la solicitud en revisión mientras se resuelve
        $pdo->prepare('UPDATE solicitudes SET estado = ? WHERE expediente = ?')->execute(['En Apelación', $expediente]);
        registrarBitacora($pdo, $user, 'Apelación enviada', $expediente);

        enviarNotificacionEmail('apelacion_recibida', [
            'email' => $email, 'nombre' => $body['nombreEstudiante'] ?? $email, 'expediente' => $expediente
        ]);

        jsonResponse(['id' => (int)$id, 'message' => 'Apelación registrada correctamente'], 201);
    }

    if ($metodo === 'PUT' && $primero !== '' && ($partes[1] ?? '') === 'resolver') {
        requireRole($user, ['trabajador_social', 'admin']);
        $body = getJsonBody();
        $decision = $body['decision'] ?? '';

        if (!in_array($decision, ['Revocar Rechazo', 'Confirmar Rechazo'], true)) {
            jsonError('Decisión inválida. Use "Revocar Rechazo" o "Confirmar Rechazo"', 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM apelaciones WHERE expediente = ? AND estado = 'Pendiente' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$primero]);
        $apelacion = $stmt->fetch();
        if (!$apelacion) jsonError('No hay una apelación pendiente para este expediente', 404);

        $pdo->prepare('UPDATE apelaciones SET estado = ?, decision = ? WHERE id = ?')
            ->execute(['Revisada', $decision, $apelacion['id']]);

        $nuevoEstado = $decision === 'Revocar Rechazo' ? 'En Revisión por Apelación' : 'Rechazado Definitivo';
        $nuevoProgreso = $decision === 'Revocar Rechazo' ? 60 : 100;
        $pdo->prepare('UPDATE solicitudes SET estado = ?, progreso = ? WHERE expediente = ?')
            ->execute([$nuevoEstado, $nuevoProgreso, $primero]);

        registrarBitacora($pdo, $user, "Apelación resuelta: $decision", $primero);

        enviarNotificacionEmail('apelacion_resuelta', [
            'email' => $apelacion['email'], 'nombre' => $apelacion['nombre_estudiante'] ?: $apelacion['email'],
            'expediente' => $primero, 'decision' => $decision
        ]);

        jsonResponse(['message' => 'Apelación resuelta correctamente', 'estado' => $nuevoEstado]);
    }

    jsonError('Ruta no encontrada', 404);
}