<?php
// api/routes/convocatorias.php
// GET /api/convocatorias, GET /:id, POST, PUT /:id/publicar, PUT /:id/cerrar
// NOTA: el envio de correos (SendGrid) del original NO esta portado todavia.
// Las convocatorias se crean/publican/cierran igual, solo no se manda email.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleConvocatorias(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();

    // GET /api/convocatorias (lista)
    if ($metodo === 'GET' && $primero === '') {
        $filas = $pdo->query('SELECT * FROM convocatorias ORDER BY id DESC')->fetchAll();
        jsonResponse(array_map('calcularDisponibilidad', $filas));
    }

    // GET /api/convocatorias/:id
    if ($metodo === 'GET' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT * FROM convocatorias WHERE id = ?');
        $stmt->execute([$primero]);
        $c = $stmt->fetch();
        if (!$c) jsonError('Convocatoria no encontrada', 404);
        jsonResponse(calcularDisponibilidad($c));
    }

    // POST /api/convocatorias (crea en Borrador)
    if ($metodo === 'POST' && $primero === '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $body = getJsonBody();
        $nombre = $body['nombre'] ?? null;
        $tipo = $body['tipo'] ?? null;
        $cupos = $body['cupos'] ?? null;
        $fechaApertura = $body['fechaApertura'] ?? null;
        $fechaCierre = $body['fechaCierre'] ?? null;

        if (!$nombre || !$tipo || !$cupos || !$fechaApertura || !$fechaCierre) {
            jsonError('Todos los campos son requeridos', 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO convocatorias (nombre, tipo, cupos, fecha_apertura, fecha_cierre, hora_apertura, hora_cierre, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $nombre, $tipo, $cupos, $fechaApertura, $fechaCierre,
            $body['horaApertura'] ?? '00:00', $body['horaCierre'] ?? '23:59', 'Borrador'
        ]);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, 'Convocatoria creada (Borrador)');
        jsonResponse(['id' => (int)$id, 'message' => 'Convocatoria registrada como Borrador']);
    }

    // POST /api/convocatorias/:id/notificar -- reenvío manual
    if ($metodo === 'POST' && ($partes[1] ?? '') === 'notificar') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT * FROM convocatorias WHERE id = ?');
        $stmt->execute([$primero]);
        $convocatoria = $stmt->fetch();
        if (!$convocatoria) jsonError('Convocatoria no encontrada', 404);

        $estudiantes = $pdo->query("SELECT email, nombre FROM usuarios WHERE rol = 'estudiante' AND email IS NOT NULL")->fetchAll();
        if (count($estudiantes) === 0) {
            jsonResponse(['message' => 'No hay estudiantes registrados para notificar', 'total' => 0, 'exitos' => 0, 'fallos' => 0]);
        }

        $exitos = 0;
        $fallos = 0;
        foreach ($estudiantes as $est) {
            $resultado = enviarNotificacionEmail('nueva_convocatoria', [
                'email' => $est['email'], 'nombre' => $est['nombre'] ?: 'Estudiante',
                'convocatoria' => $convocatoria['nombre'], 'tipo' => $convocatoria['tipo'],
                'fechaApertura' => $convocatoria['fecha_apertura'], 'fechaCierre' => $convocatoria['fecha_cierre'],
                'cupos' => $convocatoria['cupos']
            ]);
            $resultado['success'] ? $exitos++ : $fallos++;
        }
        registrarBitacora($pdo, $user, "Convocatoria renotificada por email a $exitos estudiantes" . ($fallos ? " ($fallos fallos)" : ''));

        jsonResponse(['message' => 'Notificaciones enviadas', 'total' => count($estudiantes), 'exitos' => $exitos, 'fallos' => $fallos]);
    }

    // PUT /api/convocatorias/:id/publicar
    if ($metodo === 'PUT' && ($partes[1] ?? '') === 'publicar') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT * FROM convocatorias WHERE id = ?');
        $stmt->execute([$primero]);
        $convocatoria = $stmt->fetch();
        if (!$convocatoria) jsonError('Convocatoria no encontrada', 404);

        $pdo->prepare('UPDATE convocatorias SET estado = ? WHERE id = ?')->execute(['Activa', $primero]);
        registrarBitacora($pdo, $user, 'Convocatoria publicada');

        $estudiantes = $pdo->query("SELECT email, nombre FROM usuarios WHERE rol = 'estudiante' AND email IS NOT NULL")->fetchAll();
        $exitos = 0;
        $fallos = 0;
        foreach ($estudiantes as $est) {
            $resultado = enviarNotificacionEmail('nueva_convocatoria', [
                'email' => $est['email'], 'nombre' => $est['nombre'] ?: 'Estudiante',
                'convocatoria' => $convocatoria['nombre'], 'tipo' => $convocatoria['tipo'],
                'fechaApertura' => $convocatoria['fecha_apertura'], 'fechaCierre' => $convocatoria['fecha_cierre'],
                'cupos' => $convocatoria['cupos']
            ]);
            $resultado['success'] ? $exitos++ : $fallos++;
        }
        if (count($estudiantes) > 0) {
            registrarBitacora($pdo, $user, "Convocatoria notificada por email a $exitos estudiantes" . ($fallos ? " ($fallos fallos)" : ''));
        }

        jsonResponse([
            'message' => 'Convocatoria publicada' . (count($estudiantes) > 0 ? " y notificada a $exitos estudiantes" : ''),
            'notificaciones' => ['total' => count($estudiantes), 'exitos' => $exitos, 'fallos' => $fallos, 'errores' => []]
        ]);
    }

    // PUT /api/convocatorias/:id/cerrar
    if ($metodo === 'PUT' && ($partes[1] ?? '') === 'cerrar') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT * FROM convocatorias WHERE id = ?');
        $stmt->execute([$primero]);
        $convocatoria = $stmt->fetch();
        if (!$convocatoria) jsonError('Convocatoria no encontrada', 404);

        $pdo->prepare('UPDATE convocatorias SET estado = ? WHERE id = ?')->execute(['Cerrada', $primero]);
        registrarBitacora($pdo, $user, 'Convocatoria cerrada');

        // Solo se notifica a quienes tuvieran una solicitud de este tipo de beca
        $stmt = $pdo->prepare(
            "SELECT DISTINCT u.email, u.nombre FROM solicitudes s
             JOIN usuarios u ON s.estudiante_email = u.email
             WHERE s.tipo_beca = ? AND u.rol = 'estudiante'"
        );
        $stmt->execute([$convocatoria['tipo']]);
        $estudiantes = $stmt->fetchAll();
        foreach ($estudiantes as $est) {
            enviarNotificacionEmail('convocatoria_cerrada', [
                'email' => $est['email'], 'nombre' => $est['nombre'] ?: 'Estudiante',
                'convocatoria' => $convocatoria['nombre'], 'tipo' => $convocatoria['tipo']
            ]);
        }

        jsonResponse(['message' => 'Convocatoria cerrada']);
    }

    jsonError('Ruta no encontrada', 404);
}

// Una convocatoria esta "abierta ahora" si esta Activa Y el instante actual
// cae dentro de [fecha_apertura hora_apertura, fecha_cierre hora_cierre].
function calcularDisponibilidad(array $c): array {
    $horaApertura = $c['hora_apertura'] ?: '00:00';
    $horaCierre = $c['hora_cierre'] ?: '23:59';
    $inicio = strtotime($c['fecha_apertura'] . ' ' . $horaApertura . ':00');
    $fin = strtotime($c['fecha_cierre'] . ' ' . $horaCierre . ':59');
    $ahora = time();
    $dentroDeHorario = $ahora >= $inicio && $ahora <= $fin;
    $c['abierta_ahora'] = ($c['estado'] === 'Activa' && $dentroDeHorario);
    return $c;
}
