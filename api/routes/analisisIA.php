<?php
// api/routes/analisisIA.php
// POST /api/analisis-ia/:docId -- envía un documento al microservicio real
// de IA (Python/FastAPI en Render) para que lo analice: OCR, clasificación
// del tipo de documento, y si coincide con lo que se esperaba (tipo Y
// cédula del estudiante). El navegador nunca habla directo con el
// microservicio ni conoce su API key -- siempre pasa por acá.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/ia.php';

const MIME_A_EXTENSION = [
    'application/pdf' => 'pdf', 'image/png' => 'png',
    'image/jpeg' => 'jpg', 'image/jpg' => 'jpg',
];

// Mapea el campo del formulario (doc_key) al tipo de documento que se
// espera recibir ahí, para que la IA avise si no coincide
// (TIPO_DOCUMENTO_NO_COINCIDE). Los valores son EXACTAMENTE los del enum
// DocumentType del microservicio (app/models/enums.py en becas-ia-service),
// confirmados directo del código fuente -- no son adivinados.
//
// "Constancia de ingresos" y "Recibo de servicios" quedan sin mapear a
// propósito: pueden aceptar más de un tipo de documento válido (Carta
// salarial / Orden patronal / Constancia laboral para ingresos; Factura de
// agua / eléctrica / Internet para servicios), y forzar un único tipo
// generaría alertas falsas.
const DOC_KEY_A_TIPO_ESPERADO = [
    'f-cedula-f' => 'Cédula de identidad',
    'f-cedula-p' => 'Cédula de identidad',
    'f-historial' => 'Historial académico',
    'f-doc-escritura' => 'Escritura', // ahora también cubre "o título de propiedad" (se fusionaron en un solo campo)
];

function handleAnalisisIA(string $docId, string $metodo): void {
    if ($metodo !== 'POST' || $docId === '') jsonError('Ruta no encontrada', 404);

    $user = requireAuth();
    requireRole($user, ['trabajador_social', 'admin']);

    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT * FROM documentos WHERE id = ?');
    $stmt->execute([$docId]);
    $documento = $stmt->fetch();
    if (!$documento) jsonError('Documento no encontrado', 404);
    if (empty($documento['datos'])) jsonError('El documento no tiene contenido almacenado para analizar', 400);

    $stmt = $pdo->prepare('SELECT cedula, tipo_beca FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$documento['expediente']]);
    $solicitud = $stmt->fetch();

    // documento.datos puede venir como "data:<mime>;base64,<contenido>" o
    // como base64 puro -- se manejan los dos casos.
    $base64 = $documento['datos'];
    if (strpos($base64, 'base64,') !== false) {
        $base64 = explode('base64,', $base64, 2)[1];
    }
    $binario = base64_decode($base64, true);
    if ($binario === false) jsonError('El documento guardado está dañado o corrupto', 500);

    $extension = MIME_A_EXTENSION[$documento['tipo']] ?? 'pdf';
    $nombreArchivo = $documento['nombre'] ?: (($documento['doc_key'] ?: 'documento') . '.' . $extension);

    // CURLFile necesita un archivo real en disco (PHP 8.0 no tiene
    // CURLStringFile, que recién llega en 8.1) -- se escribe temporal y se
    // borra apenas termina la petición.
    $tmpPath = tempnam(sys_get_temp_dir(), 'ia_doc_');
    file_put_contents($tmpPath, $binario);

    try {
        $campos = [
            'file' => new CURLFile($tmpPath, $documento['tipo'] ?: 'application/pdf', $nombreArchivo),
        ];
        if ($documento['expediente']) $campos['expediente'] = $documento['expediente'];
        if ($solicitud && !empty($solicitud['cedula'])) $campos['cedula_estudiante'] = $solicitud['cedula'];
        $tipoEsperado = DOC_KEY_A_TIPO_ESPERADO[$documento['doc_key']] ?? null;
        if ($tipoEsperado) $campos['tipo_documento_esperado'] = $tipoEsperado;

        $ch = curl_init(rtrim(IA_SERVICE_URL, '/') . '/api/v1/documents/analyze');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $campos,
            CURLOPT_HTTPHEADER => ['X-API-Key: ' . IA_SERVICE_API_KEY],
            CURLOPT_TIMEOUT => 90, // imagen grande + OCR + posible "despertar" de Render
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $respuesta = curl_exec($ch);
        $codigoHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errorCurl = curl_error($ch);
        $errnoCurl = curl_errno($ch);
        curl_close($ch);
    } finally {
        unlink($tmpPath);
    }

    if ($respuesta === false || $errorCurl) {
        $esTimeout = $errnoCurl === CURLE_OPERATION_TIMEDOUT;
        error_log("analisisIA: fallo de conexión [$errnoCurl] $errorCurl");
        jsonError($esTimeout
            ? 'El análisis está tardando demasiado. Puede ser un documento muy grande o que el servicio esté "despertando" — probá de nuevo en un minuto.'
            : 'No se pudo conectar con el servicio de análisis de IA. Probá de nuevo en unos minutos.', 502);
    }

    $resultado = json_decode($respuesta, true);
    if ($codigoHttp < 200 || $codigoHttp >= 300) {
        // FastAPI normalmente devuelve el error en "detail", no en "error.message".
        $detalle = $resultado['detail'] ?? $resultado['error']['message'] ?? null;
        $detalleTexto = is_array($detalle) ? json_encode($detalle, JSON_UNESCAPED_UNICODE) : $detalle;
        error_log("analisisIA: HTTP $codigoHttp - " . ($detalleTexto ?: substr($respuesta, 0, 300)));
        jsonError($codigoHttp === 413
            ? 'El documento es demasiado grande para analizar. Probá con una versión más liviana.'
            : 'El servicio de análisis no pudo procesar este documento. Probá de nuevo, o continuá revisándolo manualmente.', 502);
    }
    if (!is_array($resultado)) jsonError('El servicio de análisis devolvió una respuesta inesperada. Probá de nuevo.', 502);

    registrarBitacora(
        $pdo, $user,
        'Análisis IA de "' . ($documento['label'] ?: $documento['doc_key']) . '": ' .
        ($resultado['estado'] ?? '?') . ' (' . ($resultado['puntaje'] ?? '?') . ' pts, tipo detectado: ' . ($resultado['tipo_documento'] ?? '?') . ')',
        $documento['expediente']
    );

    jsonResponse($resultado);
}
