<?php
// api/routes/suspensiones.php
// GET / (todas), GET /:id, GET /estudiante/:email, POST / (crear), PUT /:id/restaurar, DELETE /:id

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleSuspensiones(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('SELECT * FROM suspensiones ORDER BY id DESC')->fetchAll());
    }

    if ($metodo === 'GET' && $primero === 'estudiante' && !empty($partes[1])) {
        $stmt = $pdo->prepare('SELECT * FROM suspensiones WHERE email = ? ORDER BY id DESC');
        $stmt->execute([$partes[1]]);
        jsonResponse($stmt->fetchAll());
    }

    if ($metodo === 'GET' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT * FROM suspensiones WHERE id = ?');
        $stmt->execute([$primero]);
        $susp = $stmt->fetch();
        if (!$susp) jsonError('Suspensión no encontrada', 404);
        jsonResponse($susp);
    }

    if ($metodo === 'POST' && $primero === '') {
        requireRole($user, ['trabajador_social']);
        $body = getJsonBody();
        $email = $body['email'] ?? null;
        $motivo = $body['motivo'] ?? null;
        $observaciones = $body['observaciones'] ?? '';
        $expediente = $body['expediente'] ?? null;

        if (!$email || !$motivo || strlen($observaciones) < 20) {
            jsonError('Campos requeridos faltantes o descripción insuficiente (mínimo 20 caracteres)', 400);
        }

        $fecha = date('n/j/Y, g:i:s A');
        $esSuspension = ($body['tipo'] ?? '') === 'suspension';
        $estadoBeca = $esSuspension ? 'Suspendida' : 'Cancelada';
        $diasTexto = $esSuspension ? ($body['dias'] ?? '30') : 'Cancelada';
        $nombreEstudiante = $body['nombreEstudiante'] ?? $email;

        $stmt = $pdo->prepare(
            "INSERT INTO suspensiones (email, expediente, tipo, dias, motivo, observaciones, fecha, estado, evidencia, nombre_estudiante)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Activa', ?, ?)"
        );
        $stmt->execute([
            $email, $expediente, $body['tipo'] ?? null, $diasTexto, $motivo, $observaciones,
            $fecha, $body['evidencia'] ?? null, $nombreEstudiante
        ]);
        $id = $pdo->lastInsertId();

        if ($expediente) {
            $pdo->prepare('UPDATE solicitudes SET estado=?, suspension_motivo=?, suspension_observaciones=?, suspension_fecha=? WHERE expediente=?')
                ->execute([$estadoBeca, $motivo, $observaciones, $fecha, $expediente]);
        }

        registrarBitacora($pdo, $user, 'Beca ' . ($esSuspension ? 'suspendida' : 'cancelada') . ": $motivo", $expediente ?: '—');

        enviarNotificacionEmail('beca_suspendida', [
            'email' => $email, 'nombre' => $nombreEstudiante, 'expediente' => $expediente ?: '—',
            'motivo' => $motivo, 'dias' => $esSuspension ? ($body['dias'] ?? '30') : 'Indefinida (Cancelación definitiva)',
            'observaciones' => $observaciones, 'tipo' => $esSuspension ? 'Suspensión temporal' : 'Cancelación definitiva'
        ]);

        jsonResponse([
            'id' => (int)$id, 'message' => 'Beca ' . ($esSuspension ? 'suspendida' : 'cancelada') . ' correctamente',
            'notificacionEnviada' => true
        ]);
    }

    if ($metodo === 'PUT' && $primero !== '' && ($partes[1] ?? '') === 'restaurar') {
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT * FROM suspensiones WHERE id = ?');
        $stmt->execute([$primero]);
        $susp = $stmt->fetch();
        if (!$susp) jsonError('Suspensión no encontrada', 404);
        if ($susp['estado'] !== 'Activa') jsonError('Esta suspensión ya ha sido resuelta', 400);

        $pdo->prepare('UPDATE suspensiones SET estado = ? WHERE id = ?')->execute(['Restaurada', $primero]);

        $fecha = date('n/j/Y, g:i:s A');
        if ($susp['expediente']) {
            $pdo->prepare('UPDATE solicitudes SET estado = ?, restaurado_fecha = ? WHERE expediente = ?')
                ->execute(['Beneficio Activo', $fecha, $susp['expediente']]);
        }

        registrarBitacora($pdo, $user, 'Beca restaurada', $susp['expediente'] ?: '—');

        enviarNotificacionEmail('beca_restaurada', [
            'email' => $susp['email'], 'nombre' => $susp['nombre_estudiante'] ?: $susp['email'],
            'expediente' => $susp['expediente'] ?: '—', 'fechaRestauracion' => $fecha
        ]);

        jsonResponse(['message' => 'Beca restaurada correctamente', 'notificacionEnviada' => true]);
    }

    if ($metodo === 'DELETE' && $primero !== '') {
        requireRole($user, ['admin']);

        $stmt = $pdo->prepare('SELECT * FROM suspensiones WHERE id = ?');
        $stmt->execute([$primero]);
        $susp = $stmt->fetch();
        if (!$susp) jsonError('Suspensión no encontrada', 404);
        if ($susp['estado'] !== 'Restaurada') jsonError('Solo se pueden eliminar suspensiones resueltas', 400);

        $pdo->prepare('DELETE FROM suspensiones WHERE id = ?')->execute([$primero]);
        registrarBitacora($pdo, $user, "Registro de suspensión eliminado (ID: $primero)", $susp['expediente'] ?: '—');

        jsonResponse(['message' => 'Registro de suspensión eliminado']);
    }

    jsonError('Ruta no encontrada', 404);
}
