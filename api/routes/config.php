<?php
// api/routes/config.php
// GET / (todos los valores), PUT / (actualiza uno o varios de una)

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';

function handleConfig(string $primero, string $metodo): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === '') {
        $filas = $pdo->query('SELECT `key`, value FROM config')->fetchAll();
        $config = [];
        foreach ($filas as $f) {
            // Igual que en Node: si el valor guardado es numérico, se
            // devuelve como número; si no, como texto tal cual.
            $config[$f['key']] = is_numeric($f['value']) ? $f['value'] + 0 : $f['value'];
        }
        jsonResponse($config);
    }

    if ($metodo === 'PUT' && $primero === '') {
        requireRole($user, ['trabajador_social']);
        $updates = getJsonBody();

        foreach ($updates as $key => $value) {
            $stmt = $pdo->prepare('SELECT 1 FROM config WHERE `key` = ?');
            $stmt->execute([$key]);
            if ($stmt->fetch()) {
                $pdo->prepare('UPDATE config SET value = ? WHERE `key` = ?')->execute([(string)$value, $key]);
            } else {
                $pdo->prepare('INSERT INTO config (`key`, value) VALUES (?, ?)')->execute([$key, (string)$value]);
            }
        }

        registrarBitacora($pdo, $user, 'Configuración guardada');
        jsonResponse(['message' => 'Configuración guardada']);
    }

    jsonError('Ruta no encontrada', 404);
}
