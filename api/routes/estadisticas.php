<?php
// api/routes/estadisticas.php
// GET / -- conteos simples. NOTA: el panel real de trabajador social ya
// calcula estas mismas cifras del lado del navegador a partir de
// /api/solicitudes, así que esta ruta existe por completitud/compatibilidad,
// no porque el frontend actual dependa de ella.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../config/db.php';

function handleEstadisticas(string $primero, string $metodo): void {
    if ($metodo !== 'GET' || $primero !== '') jsonError('Ruta no encontrada', 404);

    requireAuth();
    $pdo = getPDO();

    $solicitudes = $pdo->query('SELECT estado FROM solicitudes')->fetchAll();

    $aprobadas = count(array_filter($solicitudes, fn($s) => in_array($s['estado'], ['Aprobada', 'Beneficio Activo', 'Restaurada'], true)));
    $rechazadas = count(array_filter($solicitudes, fn($s) => in_array($s['estado'], ['Rechazada', 'Rechazado Definitivo', 'No elegible', 'Cancelada'], true)));
    $estadosFinales = ['Aprobada', 'Beneficio Activo', 'Restaurada', 'Rechazada', 'Rechazado Definitivo', 'No elegible', 'Cerrada', 'Cancelada', 'Suspendida'];
    $enProceso = count(array_filter($solicitudes, fn($s) => !in_array($s['estado'], $estadosFinales, true)));

    jsonResponse([
        'aprobadas' => $aprobadas, 'rechazadas' => $rechazadas,
        'enProceso' => $enProceso, 'total' => count($solicitudes)
    ]);
}
