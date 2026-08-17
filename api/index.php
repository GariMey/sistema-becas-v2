<?php
// api/index.php
// Front controller. Con el .htaccess de esta misma carpeta, toda peticion a
// /api/lo-que-sea llega aca. Se parte la URL en "recurso" + "resto" y se
// delega al archivo routes/<recurso>.php correspondiente -- el mismo patron
// que server.js con app.use('/api/tipos-beca', require('./routes/tiposBeca')).

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, x-user-email, x-user-rol');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/helpers/response.php';

// Red de seguridad general: cualquier error o excepción de PHP no prevista
// en ninguna ruta (una consulta SQL que falla, un tipo de dato inesperado,
// etc.) se convierte en un JSON de error limpio, en vez de romper la
// respuesta a medias -- eso es lo que causaba el críptico "Error de red"
// del lado del navegador cuando en realidad el problema era otro.
set_exception_handler(function (Throwable $e) {
    error_log('Excepción no capturada: ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Error interno del servidor. Ya quedó registrado para revisar.']);
    exit;
});
// Solo errores FATALES de verdad (no advertencias/notices menores, que
// antes se ignoraban sin romper nada -- convertir ESOS en fatales fue
// demasiado estricto y rompía cosas que funcionaban bien).
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        error_log('Error fatal: ' . $error['message'] . ' en ' . $error['file'] . ':' . $error['line']);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Error interno del servidor. Ya quedó registrado para revisar.']);
        }
    }
});

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = trim($uri, '/');                    // "api/auth/login"
$uri = preg_replace('#^api/?#', '', $uri); // "auth/login"
$partes = $uri === '' ? [] : explode('/', $uri);

$recurso = $partes[0] ?? '';
$resto = array_slice($partes, 1);           // ej. ["login"] o ["5", "toggle"]
$metodo = $_SERVER['REQUEST_METHOD'];

$mapaRecursos = [
    'auth' => ['archivo' => 'auth.php', 'handler' => 'handleAuth'],
    'tse' => ['archivo' => 'tse.php', 'handler' => 'handleTse'],
    'tipos-beca' => ['archivo' => 'tiposBeca.php', 'handler' => 'handleTiposBeca'],
    'convocatorias' => ['archivo' => 'convocatorias.php', 'handler' => 'handleConvocatorias'],
    'solicitudes' => ['archivo' => 'solicitudes.php', 'handler' => 'handleSolicitudes'],
    'integrantes-familia' => ['archivo' => 'integrantesFamilia.php', 'handler' => 'handleIntegrantesFamilia'],
    'documentos' => ['archivo' => 'documentos.php', 'handler' => 'handleDocumentos'],
    'noticias' => ['archivo' => 'noticias.php', 'handler' => 'handleNoticias'],
    'analisis-ia' => ['archivo' => 'analisisIA.php', 'handler' => 'handleAnalisisIA'],
    'visitas' => ['archivo' => 'visitas.php', 'handler' => 'handleVisitas'],
    'apelaciones' => ['archivo' => 'apelaciones.php', 'handler' => 'handleApelaciones'],
    'justificaciones' => ['archivo' => 'justificaciones.php', 'handler' => 'handleJustificaciones'],
    'suspensiones' => ['archivo' => 'suspensiones.php', 'handler' => 'handleSuspensiones'],
    'votaciones' => ['archivo' => 'votaciones.php', 'handler' => 'handleVotaciones'],
    'usuarios' => ['archivo' => 'usuarios.php', 'handler' => 'handleUsuarios'],
    'config' => ['archivo' => 'config.php', 'handler' => 'handleConfig'],
    'bitacora' => ['archivo' => 'bitacora.php', 'handler' => 'handleBitacora'],
    'empleados' => ['archivo' => 'empleados.php', 'handler' => 'handleEmpleados'],
    'estadisticas' => ['archivo' => 'estadisticas.php', 'handler' => 'handleEstadisticas'],
    'alertas' => ['archivo' => 'alertas.php', 'handler' => 'handleAlertas'],
    'chatbot' => ['archivo' => 'chatbot.php', 'handler' => 'handleChatbot'],
    // Los siguientes recursos se van agregando a medida que se portan:
    // ...
];

if (!isset($mapaRecursos[$recurso])) {
    jsonError("Recurso '/$recurso' aún no está portado a PHP o no existe", 404);
}

$config = $mapaRecursos[$recurso];
require_once __DIR__ . '/routes/' . $config['archivo'];

// auth.php espera (accion, metodo) -- ej. handleAuth('login', 'POST')
$config['handler']($resto[0] ?? '', $metodo, $resto);
