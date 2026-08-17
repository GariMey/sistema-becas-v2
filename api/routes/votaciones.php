<?php
// api/routes/votaciones.php
// GET /pendientes, GET /:expediente (votos), POST / (votar)

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

// Cuántos votos "Sí" se necesitan para aprobar automáticamente. Si hay al
// menos este número de comité activos, se exige mayoría simple entre
// ellos; si hay menos, basta con que todos los presentes voten igual.
function quorumRequerido(PDO $pdo): int {
    $total = $pdo->query("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'comite' AND bloqueado = 0")->fetch();
    return max(2, (int)ceil(((int)$total['n']) / 2));
}

function handleVotaciones(string $primero, string $metodo): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === 'pendientes') {
        requireRole($user, ['comite', 'trabajador_social', 'admin']);
        jsonResponse($pdo->query("SELECT * FROM solicitudes WHERE estado = 'En comité' ORDER BY created_at ASC")->fetchAll());
    }

    if ($metodo === 'GET' && $primero !== '') {
        $stmt = $pdo->prepare('
            SELECT v.*, u.nombre, u.email FROM votaciones_comite v
            INNER JOIN usuarios u ON u.id = v.id_miembro_comite
            WHERE v.expediente = ? ORDER BY v.fecha_voto ASC
        ');
        $stmt->execute([$primero]);
        jsonResponse($stmt->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        requireRole($user, ['comite']);
        $body = getJsonBody();
        $expediente = $body['expediente'] ?? null;
        $decision = $body['decision'] ?? null;
        $observaciones = $body['observaciones'] ?? null;

        if (!$expediente || !$decision) jsonError('Expediente y decisión son requeridos', 400);
        if (!in_array($decision, ['Sí', 'No', 'Devolver a TS'], true)) {
            jsonError('Decisión inválida. Use "Sí", "No" o "Devolver a TS"', 400);
        }

        $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND rol = 'comite'");
        $stmt->execute([$user['email']]);
        $miembro = $stmt->fetch();
        if (!$miembro) jsonError('No tiene permisos para votar', 403);

        $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
        $stmt->execute([$expediente]);
        $solicitud = $stmt->fetch();
        if (!$solicitud) jsonError('Solicitud no encontrada', 404);
        if ($solicitud['estado'] !== 'En comité') {
            jsonError("El expediente no está en votación (estado actual: {$solicitud['estado']})", 400);
        }

        // El porcentaje de cobertura lo define el Trabajador Social al enviar
        // el expediente a comité (queda guardado en la solicitud); el comité
        // solo vota Sí/No/Devolver a TS y no puede cambiarlo.
        $porcentajeCobertura = $solicitud['porcentaje_cobertura'] ?: '100%';

        // Un mismo miembro no puede votar dos veces el mismo expediente.
        $stmt = $pdo->prepare('SELECT id FROM votaciones_comite WHERE expediente = ? AND id_miembro_comite = ?');
        $stmt->execute([$expediente, $miembro['id']]);
        $votoExistente = $stmt->fetch();

        if ($votoExistente) {
            jsonError('Ya emitiste tu voto para este expediente. No se puede votar más de una vez.', 409);
        }

        $pdo->prepare('INSERT INTO votaciones_comite (expediente, id_miembro_comite, decision, observaciones, porcentaje_cobertura) VALUES (?, ?, ?, ?, ?)')
            ->execute([$expediente, $miembro['id'], $decision, $observaciones, $porcentajeCobertura]);

        registrarBitacora($pdo, $user, "Voto registrado: $decision", $expediente);

        $nombreCompleto = trim($solicitud['nombres'] . ' ' . $solicitud['apellidos']);

        // "Devolver a TS": basta con que un solo miembro lo pida, ya que
        // normalmente implica un error o falta de información evidente.
        if ($decision === 'Devolver a TS') {
            $pdo->prepare('UPDATE solicitudes SET estado = ?, observaciones_comite = ? WHERE expediente = ?')
                ->execute(['En revisión TS', $observaciones ?: 'Devuelto por el comité para revisión adicional', $expediente]);
            $pdo->prepare('DELETE FROM votaciones_comite WHERE expediente = ?')->execute([$expediente]);
            jsonResponse(['mensaje' => 'Expediente devuelto al Trabajador Social', 'estado' => 'En revisión TS']);
        }

        // Verificar si ya hay quórum para resolver automáticamente
        $stmt = $pdo->prepare('SELECT decision FROM votaciones_comite WHERE expediente = ?');
        $stmt->execute([$expediente]);
        $votos = $stmt->fetchAll();
        $votosSi = count(array_filter($votos, fn($v) => $v['decision'] === 'Sí'));
        $votosNo = count(array_filter($votos, fn($v) => $v['decision'] === 'No'));
        $necesarios = quorumRequerido($pdo);

        $estadoFinal = 'En comité';
        if ($votosSi >= $necesarios) {
            $estadoFinal = 'Aprobada';
            $pdo->prepare('UPDATE solicitudes SET estado=?, porcentaje_cobertura=?, observaciones_comite=?, progreso=100 WHERE expediente=?')
                ->execute([$estadoFinal, $porcentajeCobertura ?: ($solicitud['porcentaje_cobertura'] ?: '100%'), $observaciones ?: 'Aprobada por el comité', $expediente]);
        } elseif ($votosNo >= $necesarios) {
            $estadoFinal = 'Rechazada';
            $pdo->prepare('UPDATE solicitudes SET estado=?, observaciones_comite=?, motivo_rechazo=? WHERE expediente=?')
                ->execute([$estadoFinal, $observaciones ?: 'Rechazada por el comité', $observaciones ?: 'No cumple los criterios evaluados por el comité', $expediente]);
        }

        if ($estadoFinal !== 'En comité') {
            $fecha = date('n/j/Y, g:i:s A');
            $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
                ->execute([$fecha, 'sistema', 'comite', "Votación resuelta: $estadoFinal ($votosSi Sí / $votosNo No)", $expediente]);

            // La votación actualiza el estado directo en la tabla (no pasa
            // por PUT /solicitudes/:expediente), así que el correo de
            // aprobado/rechazado se dispara acá explícitamente.
            if ($estadoFinal === 'Aprobada') {
                enviarNotificacionEmail('solicitud_aprobada', [
                    'email' => $solicitud['estudiante_email'], 'nombre' => $nombreCompleto, 'expediente' => $expediente,
                    'tipoBeca' => $solicitud['tipo_beca'], 'porcentajeCobertura' => $porcentajeCobertura ?: ($solicitud['porcentaje_cobertura'] ?: '100%'),
                    'observaciones' => $observaciones
                ]);
            } else {
                enviarNotificacionEmail('solicitud_rechazada', [
                    'email' => $solicitud['estudiante_email'], 'nombre' => $nombreCompleto, 'expediente' => $expediente,
                    'motivoRechazo' => $observaciones ?: 'No cumple los criterios evaluados por el comité'
                ]);
            }
        }

        jsonResponse([
            'mensaje' => "Voto \"$decision\" registrado correctamente",
            'votosSi' => $votosSi, 'votosNo' => $votosNo, 'necesarios' => $necesarios, 'estado' => $estadoFinal
        ]);
    }

    jsonError('Ruta no encontrada', 404);
}
