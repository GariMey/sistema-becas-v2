<?php
// api/routes/noticias.php
// GET / (lista, publica), GET /:id (publica), POST / (crear/editar, trabajador_social), DELETE /:id
// NOTA: el envio de correo a estudiantes (SendGrid) del original NO esta
// portado todavia -- misma decision que en convocatorias.php.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

function handleNoticias(string $primero, string $metodo): void {
    $pdo = getPDO();

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('SELECT * FROM noticias ORDER BY id DESC')->fetchAll());
    }

    if ($metodo === 'GET' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT * FROM noticias WHERE id = ?');
        $stmt->execute([$primero]);
        $noticia = $stmt->fetch();
        if (!$noticia) jsonError('Noticia no encontrada', 404);
        jsonResponse($noticia);
    }

    if ($metodo === 'POST' && $primero === '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $body = getJsonBody();
        $titulo = trim($body['titulo'] ?? '');
        $contenido = trim($body['contenido'] ?? '');
        $idEdicion = $body['idEdicion'] ?? null;
        $fechaExpiracion = $body['fechaExpiracion'] ?? null;
        $importancia = $body['importancia'] ?? 'media';
        if (!in_array($importancia, ['alta', 'media', 'baja'], true)) $importancia = 'media';

        if (!$titulo || !$contenido) jsonError('Título y contenido son requeridos', 400);

        $fecha = date('n/j/Y');

        if ($idEdicion) {
            $pdo->prepare('UPDATE noticias SET titulo=?, contenido=?, fecha_edicion=?, fecha_expiracion=?, importancia=? WHERE id=?')
                ->execute([$titulo, $contenido, $fecha, $fechaExpiracion, $importancia, $idEdicion]);
            registrarBitacora($pdo, $user, 'Noticia editada');
            jsonResponse(['message' => 'Noticia actualizada']);
        } else {
            $pdo->prepare('INSERT INTO noticias (titulo, contenido, fecha, fecha_expiracion, importancia) VALUES (?, ?, ?, ?, ?)')
                ->execute([$titulo, $contenido, $fecha, $fechaExpiracion, $importancia]);
            $id = $pdo->lastInsertId();
            registrarBitacora($pdo, $user, 'Noticia publicada');

            $estudiantes = $pdo->query("SELECT email, nombre FROM usuarios WHERE rol = 'estudiante' AND email IS NOT NULL")->fetchAll();
            $exitos = 0;
            $fallos = 0;
            foreach ($estudiantes as $est) {
                $resultado = enviarNotificacionEmail('nueva_noticia', [
                    'email' => $est['email'], 'nombre' => $est['nombre'] ?: 'Estudiante',
                    'titulo' => $titulo, 'contenido' => $contenido, 'fecha' => $fecha
                ]);
                $resultado['success'] ? $exitos++ : $fallos++;
            }
            if (count($estudiantes) > 0) {
                registrarBitacora($pdo, $user, "Noticia enviada por email a $exitos estudiantes" . ($fallos ? " ($fallos fallos)" : ''));
            }

            jsonResponse([
                'id' => (int)$id,
                'message' => 'Noticia publicada' . (count($estudiantes) > 0 ? " y notificada a $exitos estudiantes" : ''),
                'notificaciones' => ['total' => count($estudiantes), 'exitos' => $exitos, 'fallos' => $fallos]
            ]);
        }
    }

    if ($metodo === 'DELETE' && $primero !== '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $stmt = $pdo->prepare('SELECT titulo FROM noticias WHERE id = ?');
        $stmt->execute([$primero]);
        $noticia = $stmt->fetch();

        $pdo->prepare('DELETE FROM noticias WHERE id = ?')->execute([$primero]);
        registrarBitacora($pdo, $user, 'Noticia eliminada: ' . ($noticia['titulo'] ?? 'ID:' . $primero));
        jsonResponse(['message' => 'Noticia eliminada']);
    }

    jsonError('Ruta no encontrada', 404);
}
