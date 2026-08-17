<?php
// api/helpers/tse.php
// Conecta con la API real del TSE (distribuidora-sm-1 en Render).
// IMPORTANTE: esta consulta se hace SIEMPRE desde el servidor (PHP), nunca
// desde el navegador -- así la API key del TSE nunca queda expuesta en el
// código del frontend.

define('TSE_API_URL', 'https://distribuidora-sm-1.onrender.com');
define('TSE_API_KEY', 'tse-2026-secret');

// Devuelve: ['encontrada' => bool, 'persona' => array|null, 'mensaje' => string, 'error' => string|null]
function consultarTSE(string $cedula): array {
    $cedulaLimpia = preg_replace('/\D/', '', $cedula);
    if (strlen($cedulaLimpia) < 9) {
        return ['encontrada' => false, 'persona' => null, 'mensaje' => 'Cédula inválida', 'error' => null];
    }

    $url = TSE_API_URL . '/consulta-cedula/' . urlencode($cedulaLimpia);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-API-Key: ' . TSE_API_KEY],
        CURLOPT_TIMEOUT => 55, // en el plan gratuito de Render, el servicio "duerme" y puede
                                // tardar hasta ~50s en despertar en la primera consulta luego
                                // de un rato sin uso -- por eso el margen amplio.
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $respuesta = curl_exec($ch);
    $codigoHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errorCurl = curl_error($ch);
    curl_close($ch);

    if ($respuesta === false || $errorCurl) {
        return ['encontrada' => false, 'persona' => null, 'mensaje' => 'No se pudo contactar al servicio del TSE', 'error' => $errorCurl];
    }
    if ($codigoHttp !== 200) {
        return ['encontrada' => false, 'persona' => null, 'mensaje' => 'El servicio del TSE respondió con un error', 'error' => "HTTP $codigoHttp"];
    }

    $datos = json_decode($respuesta, true);
    if (!is_array($datos)) {
        return ['encontrada' => false, 'persona' => null, 'mensaje' => 'Respuesta inválida del servicio del TSE', 'error' => 'JSON inválido'];
    }

    return [
        'encontrada' => $datos['encontrada'] ?? false,
        'persona' => $datos['persona'] ?? null,
        'mensaje' => $datos['mensaje'] ?? '',
        'error' => null
    ];
}
