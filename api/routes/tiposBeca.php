<?php
// api/routes/tiposBeca.php
// GET /api/tipos-beca, GET /api/tipos-beca/:id, POST, PUT /:id, PUT /:id/toggle, DELETE /:id

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';

function handleTiposBeca(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();

    // GET /api/tipos-beca  (lista)
    if ($metodo === 'GET' && $primero === '') {
        $activos = $_GET['activos'] ?? null;
        $sql = 'SELECT * FROM tipos_beca';
        if ($activos === 'true') $sql .= ' WHERE activo = 1';
        $sql .= ' ORDER BY id';
        $tipos = $pdo->query($sql)->fetchAll();
        jsonResponse(array_map('formatearTipoBeca', $tipos));
    }

    // GET /api/tipos-beca/:id
    if ($metodo === 'GET' && $primero !== '') {
        $stmt = $pdo->prepare('SELECT * FROM tipos_beca WHERE id = ?');
        $stmt->execute([$primero]);
        $tipo = $stmt->fetch();
        if (!$tipo) jsonError('Tipo de beca no encontrado', 404);
        jsonResponse(formatearTipoBeca($tipo));
    }

    // POST /api/tipos-beca
    if ($metodo === 'POST') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $body = getJsonBody();
        $nombre = trim($body['nombre'] ?? '');
        if (!$nombre) jsonError('El nombre es requerido', 400);

        $stmt = $pdo->prepare(
            'INSERT INTO tipos_beca (nombre, icon, description, min_pct, max_pct, rubros, requisitos, activo, campos_personalizados)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $nombre,
            $body['icon'] ?? 'graduation-cap',
            $body['description'] ?? '',
            $body['min'] ?? 25,
            $body['max'] ?? 100,
            json_encode($body['rubros'] ?? [], JSON_UNESCAPED_UNICODE),
            json_encode($body['requisitos'] ?? [], JSON_UNESCAPED_UNICODE),
            ($body['activo'] ?? true) ? 1 : 0,
            json_encode($body['camposPersonalizados'] ?? [], JSON_UNESCAPED_UNICODE)
        ]);
        $id = $pdo->lastInsertId();

        registrarBitacora($pdo, $user, 'Tipo de beca creado: ' . $nombre);
        jsonResponse(['id' => (int)$id, 'message' => 'Tipo de beca creado']);
    }

    // PUT /api/tipos-beca/:id  y  PUT /api/tipos-beca/:id/toggle
    if ($metodo === 'PUT') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);
        $id = $primero;
        $accionExtra = $partes[1] ?? null;

        if ($accionExtra === 'toggle') {
            $stmt = $pdo->prepare('SELECT activo FROM tipos_beca WHERE id = ?');
            $stmt->execute([$id]);
            $tipo = $stmt->fetch();
            if (!$tipo) jsonError('No encontrado', 404);

            $nuevoActivo = $tipo['activo'] ? 0 : 1;
            $pdo->prepare('UPDATE tipos_beca SET activo = ? WHERE id = ?')->execute([$nuevoActivo, $id]);
            jsonResponse(['activo' => (bool)$nuevoActivo]);
        }

        $body = getJsonBody();
        $stmt = $pdo->prepare(
            'UPDATE tipos_beca SET nombre=?, icon=?, description=?, min_pct=?, max_pct=?, rubros=?, requisitos=?, activo=?, campos_personalizados=?, updated_at=NOW() WHERE id=?'
        );
        $stmt->execute([
            $body['nombre'] ?? null,
            $body['icon'] ?? null,
            $body['description'] ?? null,
            $body['min'] ?? null,
            $body['max'] ?? null,
            json_encode($body['rubros'] ?? [], JSON_UNESCAPED_UNICODE),
            json_encode($body['requisitos'] ?? [], JSON_UNESCAPED_UNICODE),
            !empty($body['activo']) ? 1 : 0,
            json_encode($body['camposPersonalizados'] ?? [], JSON_UNESCAPED_UNICODE),
            $id
        ]);

        registrarBitacora($pdo, $user, 'Tipo de beca actualizado');
        jsonResponse(['message' => 'Tipo de beca actualizado']);
    }

    // DELETE /api/tipos-beca/:id
    if ($metodo === 'DELETE') {
        $user = requireAuth();
        requireRole($user, ['trabajador_social']);

        $pdo->prepare('DELETE FROM tipos_beca WHERE id = ?')->execute([$primero]);
        registrarBitacora($pdo, $user, 'Tipo de beca eliminado');
        jsonResponse(['message' => 'Tipo de beca eliminado']);
    }

    jsonError('Ruta no encontrada', 404);
}

function formatearTipoBeca(array $t): array {
    $t['rubros'] = json_decode($t['rubros'] ?? '[]', true);
    $t['requisitos'] = json_decode($t['requisitos'] ?? '[]', true);
    $t['camposPersonalizados'] = json_decode($t['campos_personalizados'] ?? '[]', true);
    unset($t['campos_personalizados']);
    return $t;
}
