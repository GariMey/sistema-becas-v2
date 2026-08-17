<?php
// api/routes/alertas.php
// GET / (todas), PUT /:id/revisar -- exclusivo admin/auditor

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';

function handleAlertas(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();
    requireRole($user, ['admin', 'auditor']);

    if ($metodo === 'GET' && $primero === '') {
        jsonResponse($pdo->query('SELECT * FROM alertas_seguridad ORDER BY id DESC')->fetchAll());
    }

    if ($metodo === 'PUT' && $primero !== '' && ($partes[1] ?? '') === 'revisar') {
        $stmt = $pdo->prepare("UPDATE alertas_seguridad SET estado = 'Revisada' WHERE id = ?");
        $stmt->execute([$primero]);
        if ($stmt->rowCount() === 0) jsonError('Alerta no encontrada', 404);

        registrarBitacora($pdo, $user, "Alerta $primero marcada como revisada");
        jsonResponse(['message' => 'Alerta revisada']);
    }

    jsonError('Ruta no encontrada', 404);
}
