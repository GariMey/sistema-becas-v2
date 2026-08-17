<?php
// api/routes/tse.php
// GET /api/tse/:cedula -- consulta publica (sin login, se usa ANTES de crear
// la cuenta). No expone la API key del TSE al navegador: la consulta real la
// hace el helper consultarTSE(), este archivo solo la envuelve en JSON.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/tse.php';

function handleTse(string $cedula, string $metodo): void {
    if ($metodo !== 'GET' || $cedula === '') {
        jsonError('Ruta no encontrada', 404);
    }
    jsonResponse(consultarTSE($cedula));
}
