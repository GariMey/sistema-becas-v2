<?php
// api/routes/bitacora.php
// GET / -- con filtros opcionales: usuario, rol, accion, fechaDesde, fechaHasta, limit

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../config/db.php';

function handleBitacora(string $primero, string $metodo): void {
    if ($metodo !== 'GET' || $primero !== '') jsonError('Ruta no encontrada', 404);

    requireAuth();
    $pdo = getPDO();

    $condiciones = [];
    $params = [];

    if (!empty($_GET['usuario'])) { $condiciones[] = 'usuario LIKE ?'; $params[] = '%' . $_GET['usuario'] . '%'; }
    if (!empty($_GET['rol'])) { $condiciones[] = 'rol = ?'; $params[] = $_GET['rol']; }
    if (!empty($_GET['accion'])) { $condiciones[] = 'accion LIKE ?'; $params[] = '%' . $_GET['accion'] . '%'; }
    if (!empty($_GET['fechaDesde'])) { $condiciones[] = 'created_at >= ?'; $params[] = $_GET['fechaDesde']; }
    if (!empty($_GET['fechaHasta'])) { $condiciones[] = 'created_at <= ?'; $params[] = $_GET['fechaHasta'] . ' 23:59:59'; }

    $limite = (int)($_GET['limit'] ?? 200);
    if ($limite <= 0 || $limite > 2000) $limite = 200; // tope razonable

    $sql = 'SELECT * FROM bitacora';
    if ($condiciones) $sql .= ' WHERE ' . implode(' AND ', $condiciones);
    $sql .= ' ORDER BY id DESC LIMIT ' . $limite;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}
