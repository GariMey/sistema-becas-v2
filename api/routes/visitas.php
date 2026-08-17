<?php
// api/routes/visitas.php
// GET / (todas), GET /expediente/:expediente, POST / (crear), PUT /:id, DELETE /:id

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleVisitas(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    // GET /api/visitas (todas)
    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('
            SELECT id, expediente, fecha, condiciones, coincide, archivo, nombreEstudiante,
                   evidencia_fecha, evidencia_hora, evidencia_cedula, fecha_registro
            FROM visitas ORDER BY id DESC
        ')->fetchAll());
    }

    // GET /api/visitas/expediente/:expediente
    if ($metodo === 'GET' && $primero === 'expediente' && !empty($partes[1])) {
        $stmt = $pdo->prepare('
            SELECT id, expediente, fecha, condiciones, coincide, archivo, nombreEstudiante,
                   evidencia_fecha, evidencia_hora, evidencia_cedula, fecha_registro
            FROM visitas WHERE expediente = ? ORDER BY fecha DESC
        ');
        $stmt->execute([$partes[1]]);
        jsonResponse($stmt->fetchAll());
    }

    // GET /api/visitas/estadisticas
    if ($metodo === 'GET' && $primero === 'estadisticas') {
        requireRole($user, ['trabajador_social']);
        $stats = $pdo->query("
            SELECT COUNT(*) AS total, COUNT(DISTINCT expediente) AS expedientes_visitados,
                   SUM(CASE WHEN coincide = 'Sí' THEN 1 ELSE 0 END) AS coinciden_si,
                   SUM(CASE WHEN coincide = 'No' THEN 1 ELSE 0 END) AS coinciden_no,
                   SUM(CASE WHEN coincide = 'Parcialmente' THEN 1 ELSE 0 END) AS coinciden_parcial
            FROM visitas
        ")->fetch();
        jsonResponse($stats);
    }

    // POST /api/visitas (crear)
    if ($metodo === 'POST' && $primero === '') {
        requireRole($user, ['trabajador_social']);
        $body = getJsonBody();
        $expediente = $body['expediente'] ?? null;
        $fecha = $body['fecha'] ?? null;
        $condiciones = $body['condiciones'] ?? null;

        if (!$expediente || !$fecha || !$condiciones) {
            jsonError('Expediente, fecha y condiciones son obligatorios', 400);
        }

        $fechaRegistro = date('n/j/Y, g:i:s A');

        // Evidencia fotográfica: fecha, hora y cédula se capturan
        // automáticamente en el servidor (no las escribe el trabajador
        // social a mano) -- ítem 26 del proyecto original.
        $evidenciaFecha = null; $evidenciaHora = null; $evidenciaCedula = null;
        if (!empty($body['archivo'])) {
            $evidenciaFecha = date('d/m/Y');
            $evidenciaHora = date('H:i:s');
            $stmt = $pdo->prepare('SELECT cedula, estudiante_email, nombres, apellidos FROM solicitudes WHERE expediente = ?');
            $stmt->execute([$expediente]);
            $solicitud = $stmt->fetch();
            $evidenciaCedula = $solicitud['cedula'] ?? null;
        } else {
            $stmt = $pdo->prepare('SELECT cedula, estudiante_email, nombres, apellidos FROM solicitudes WHERE expediente = ?');
            $stmt->execute([$expediente]);
            $solicitud = $stmt->fetch();
        }

        $stmt = $pdo->prepare('
            INSERT INTO visitas (expediente, fecha, condiciones, coincide, archivo, nombreEstudiante, evidencia_fecha, evidencia_hora, evidencia_cedula, fecha_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        try {
            $stmt->execute([
                $expediente, $fecha, $condiciones, $body['coincide'] ?? 'Sí', $body['archivo'] ?? null,
                $body['nombreEstudiante'] ?? null, $evidenciaFecha, $evidenciaHora, $evidenciaCedula, $fechaRegistro
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') { // clave única duplicada
                jsonError("Ya existe una visita registrada para el expediente $expediente en la fecha $fecha. Usa una fecha distinta, o editá la visita existente.", 400);
            }
            throw $e;
        }
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, 'Visita domiciliaria registrada', $expediente);

        if ($solicitud) {
            enviarNotificacionEmail('visita_programada', [
                'email' => $solicitud['estudiante_email'], 'nombre' => trim($solicitud['nombres'] . ' ' . $solicitud['apellidos']),
                'fecha' => $fecha, 'expediente' => $expediente, 'observaciones' => $condiciones
            ]);
        }

        jsonResponse(['id' => (int)$id, 'message' => 'Visita registrada correctamente'], 201);
    }

    // PUT /api/visitas/:id
    if ($metodo === 'PUT' && $primero !== '') {
        requireRole($user, ['trabajador_social']);
        $body = getJsonBody();

        $stmt = $pdo->prepare('
            UPDATE visitas SET expediente=?, fecha=?, condiciones=?, coincide=?, archivo=?, nombreEstudiante=?
            WHERE id=?
        ');
        $stmt->execute([
            $body['expediente'] ?? null, $body['fecha'] ?? null, $body['condiciones'] ?? null,
            $body['coincide'] ?? null, $body['archivo'] ?? null, $body['nombreEstudiante'] ?? null, $primero
        ]);
        if ($stmt->rowCount() === 0) jsonError('Visita no encontrada', 404);

        registrarBitacora($pdo, $user, 'Visita actualizada', $body['expediente'] ?? '—');
        jsonResponse(['message' => 'Visita actualizada correctamente']);
    }

    // DELETE /api/visitas/:id
    if ($metodo === 'DELETE' && $primero !== '') {
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT expediente FROM visitas WHERE id = ?');
        $stmt->execute([$primero]);
        $visita = $stmt->fetch();

        $stmt = $pdo->prepare('DELETE FROM visitas WHERE id = ?');
        $stmt->execute([$primero]);
        if ($stmt->rowCount() === 0) jsonError('Visita no encontrada', 404);

        if ($visita) registrarBitacora($pdo, $user, 'Visita eliminada', $visita['expediente']);
        jsonResponse(['message' => 'Visita eliminada correctamente']);
    }

    jsonError('Ruta no encontrada', 404);
}
