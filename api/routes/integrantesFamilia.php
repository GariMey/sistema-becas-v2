<?php
// api/routes/integrantesFamilia.php
// GET /api/integrantes-familia/:expediente, PUT /api/integrantes-familia/:expediente

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/ingresoPercapita.php';
require_once __DIR__ . '/../config/db.php';

function handleIntegrantesFamilia(string $expediente, string $metodo): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM integrantes_familia WHERE expediente = ? ORDER BY id');
        $stmt->execute([$expediente]);
        jsonResponse($stmt->fetchAll());
    }

    if ($metodo === 'PUT') {
        $body = getJsonBody();
        $integrantes = is_array($body['integrantes'] ?? null) ? $body['integrantes'] : [];

        $stmt = $pdo->prepare('SELECT estudiante_email FROM solicitudes WHERE expediente = ?');
        $stmt->execute([$expediente]);
        $solicitud = $stmt->fetch();
        if (!$solicitud) jsonError('Solicitud no encontrada', 404);

        if (in_array($user['rol'], ['estudiante', 'aspirante'], true) && $solicitud['estudiante_email'] !== $user['email']) {
            jsonError('No tienes permiso para modificar este expediente', 403);
        }

        $pdo->prepare('DELETE FROM integrantes_familia WHERE expediente = ?')->execute([$expediente]);

        $ins = $pdo->prepare(
            'INSERT INTO integrantes_familia
                (expediente, nombre_completo, edad, estudia, trabaja, salario_mensual, tiene_transporte, casa_propia, vivienda_nombre_propio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($integrantes as $p) {
            $ins->execute([
                $expediente,
                $p['nombre'] ?? '',
                (int)($p['edad'] ?? 0),
                (($p['estudia'] ?? null) === 'Sí' || ($p['estudia'] ?? false) === true) ? 1 : 0,
                (($p['trabaja'] ?? null) === 'Sí' || ($p['trabaja'] ?? false) === true) ? 1 : 0,
                (float)($p['salario'] ?? 0),
                (($p['transporte'] ?? null) === 'Sí' || ($p['transporte'] ?? false) === true) ? 1 : 0,
                (($p['casaPropia'] ?? null) === 'Sí' || ($p['casaPropia'] ?? false) === true) ? 1 : 0,
                (($p['viviendaNombrePropio'] ?? null) === 'Sí' || ($p['viviendaNombrePropio'] ?? false) === true) ? 1 : 0,
            ]);
        }

        $ingresoPercapita = calcularYGuardarIngresoPercapita($pdo, $expediente);
        registrarBitacora($pdo, $user, 'Núcleo familiar actualizado', $expediente);

        jsonResponse(['message' => 'Núcleo familiar actualizado', 'ingresoPercapita' => $ingresoPercapita]);
    }

    jsonError('Ruta no encontrada', 404);
}
