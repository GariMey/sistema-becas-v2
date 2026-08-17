<?php
// api/routes/chatbot.php
// GET / (todas), GET /buscar?q=... (búsqueda pública, sin login),
// POST / (crear), PUT /:id (editar), DELETE /:id
// Crear/editar/eliminar es exclusivo de trabajador_social/admin; ver y
// buscar es público (el chatbot lo usa cualquier visitante, sin sesión).

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';

function handleChatbot(string $primero, string $metodo): void {
    $pdo = getPDO();

    if ($metodo === 'GET' && $primero === 'buscar') {
        $q = $_GET['q'] ?? '';
        if (!$q) jsonError('Parámetro q requerido', 400);

        $stmt = $pdo->prepare(
            'SELECT * FROM chatbot_preguntas WHERE activa = 1 AND (pregunta LIKE ? OR respuesta LIKE ?) LIMIT 3'
        );
        $like = '%' . $q . '%';
        $stmt->execute([$like, $like]);
        jsonResponse($stmt->fetchAll());
    }

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('SELECT * FROM chatbot_preguntas ORDER BY categoria, pregunta')->fetchAll());
    }

    if ($metodo === 'POST' && $primero === '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social', 'admin']);

        $body = getJsonBody();
        $pregunta = trim($body['pregunta'] ?? '');
        $respuesta = trim($body['respuesta'] ?? '');
        if (!$pregunta || !$respuesta) jsonError('Pregunta y respuesta son requeridos', 400);

        $stmt = $pdo->prepare('INSERT INTO chatbot_preguntas (pregunta, respuesta, categoria, activa) VALUES (?, ?, ?, 1)');
        $stmt->execute([$pregunta, $respuesta, $body['categoria'] ?? null]);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, 'Pregunta de chatbot agregada: ' . $pregunta);
        jsonResponse(['id_pregunta' => (int)$id, 'mensaje' => 'Pregunta agregada correctamente'], 201);
    }

    if ($metodo === 'PUT' && $primero !== '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social', 'admin']);

        $body = getJsonBody();
        $stmt = $pdo->prepare('UPDATE chatbot_preguntas SET pregunta=?, respuesta=?, categoria=?, activa=? WHERE id_pregunta=?');
        $stmt->execute([
            $body['pregunta'] ?? null, $body['respuesta'] ?? null, $body['categoria'] ?? null,
            array_key_exists('activa', $body) ? (int)(bool)$body['activa'] : 1, $primero
        ]);
        if ($stmt->rowCount() === 0) jsonError('Pregunta no encontrada', 404);

        registrarBitacora($pdo, $user, 'Pregunta de chatbot editada (ID ' . $primero . ')');
        jsonResponse(['mensaje' => 'Pregunta actualizada correctamente']);
    }

    if ($metodo === 'DELETE' && $primero !== '') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social', 'admin']);

        $stmt = $pdo->prepare('DELETE FROM chatbot_preguntas WHERE id_pregunta = ?');
        $stmt->execute([$primero]);
        if ($stmt->rowCount() === 0) jsonError('Pregunta no encontrada', 404);

        registrarBitacora($pdo, $user, 'Pregunta de chatbot eliminada (ID ' . $primero . ')');
        jsonResponse(['mensaje' => 'Pregunta eliminada correctamente']);
    }

    jsonError('Ruta no encontrada', 404);
}
