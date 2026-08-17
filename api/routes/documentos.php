<?php
// api/routes/documentos.php
// GET /api/documentos/:id -- devuelve el archivo real (PDF/imagen) para
// verlo en el navegador. El archivo vive como base64 en MySQL (columna
// documentos.datos); esta ruta lo decodifica y lo sirve con el tipo
// correcto, para que el navegador lo muestre en vez de descargar texto.

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../config/db.php';

function handleDocumentos(string $id, string $metodo): void {
    if ($metodo !== 'GET' || $id === '') jsonError('Ruta no encontrada', 404);

    $user = requireAuth();
    $pdo = getPDO();

    $stmt = $pdo->prepare('SELECT * FROM documentos WHERE id = ?');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) jsonError('Documento no encontrado', 404);

    // Mismo permiso que ver la solicitud: el dueño del expediente, o
    // trabajador_social/comite/admin/auditor (staff).
    if (in_array($user['rol'], ['estudiante', 'aspirante'], true)) {
        $stmt = $pdo->prepare('SELECT estudiante_email FROM solicitudes WHERE expediente = ?');
        $stmt->execute([$doc['expediente']]);
        $solicitud = $stmt->fetch();
        if (!$solicitud || $solicitud['estudiante_email'] !== $user['email']) {
            jsonError('No tienes permiso para ver este documento', 403);
        }
    }

    if (empty($doc['datos'])) jsonError('Este documento no tiene contenido guardado', 404);

    // El campo "datos" puede venir como base64 puro, o como Data URL
    // (data:application/pdf;base64,XXXXX) segun como lo haya mandado el
    // frontend -- se manejan los dos casos.
    $base64 = $doc['datos'];
    if (strpos($base64, 'base64,') !== false) {
        $base64 = explode('base64,', $base64, 2)[1];
    }
    $binario = base64_decode($base64, true);
    if ($binario === false) jsonError('El documento guardado está dañado o corrupto', 500);

    header('Content-Type: ' . ($doc['tipo'] ?: 'application/octet-stream'));
    header('Content-Disposition: inline; filename="' . basename($doc['nombre'] ?: 'documento') . '"');
    header('Content-Length: ' . strlen($binario));
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo $binario;
    exit;
}
