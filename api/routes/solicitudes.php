<?php
// api/routes/solicitudes.php
// GET / (listar), GET /:expediente (ver), POST / (crear),
// PUT /:expediente (editar), DELETE /:expediente (eliminar).
//
// PENDIENTE para mas adelante: GET /:expediente/analisis (deteccion de
// inconsistencias con IA -- necesita la API de IA conectada primero).

require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/bitacora.php';
require_once __DIR__ . '/../helpers/ingresoPercapita.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../helpers/emailTemplates.php';
require_once __DIR__ . '/../config/db.php';

const ESTADOS_VALIDOS = [
    'Enviada', 'En revisión TS', 'Pendiente subsanación',
    'Elegible', 'Visita TS', 'En comité', 'Aprobada', 'Rechazada',
    'En Apelación', 'En Revisión por Apelación', 'Rechazado Definitivo', 'Beneficio Activo', 'Suspendida',
    'Cancelada', 'Restaurada', 'No elegible', 'Bloqueada (beneficio activo)'
];
const ESTADOS_FINALES = ['Aprobada', 'Rechazada', 'Rechazado Definitivo', 'Beneficio Activo', 'Cancelada', 'No elegible'];
const TAMANO_MAX_ARCHIVO = 10 * 1024 * 1024; // 10MB
const TIPOS_ARCHIVO_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const CAMPOS_OBLIGATORIOS_BASE = ['f-nombres', 'f-apellidos', 'f-cedula', 'f-correo', 'f-carrera', 'f-sede', 'f-promedio', 'f-merito'];
const DOCUMENTOS_OBLIGATORIOS_BASE = ['f-cedula-f', 'f-cedula-p', 'f-constancia', 'f-recibo'];

function handleSolicitudes(string $primero, string $metodo, array $partes): void {
    $pdo = getPDO();
    $user = requireAuth();

    if ($metodo === 'GET' && $primero === '') listarSolicitudes($pdo, $user);
    if ($metodo === 'GET' && $primero !== '' && ($partes[1] ?? '') === 'analisis') verAnalisisExpediente($pdo, $primero);
    if ($metodo === 'GET' && $primero !== '' && empty($partes[1])) verSolicitud($pdo, $user, $primero);
    if ($metodo === 'POST' && $primero === '') crearSolicitud($pdo, $user);
    if ($metodo === 'PUT' && $primero !== '') actualizarSolicitud($pdo, $user, $primero);
    if ($metodo === 'DELETE' && $primero !== '') eliminarSolicitud($pdo, $user, $primero);

    jsonError('Ruta no encontrada o aún no portada a PHP', 404);
}

function listarSolicitudes(PDO $pdo, array $user): void {
    $condiciones = [];
    $params = [];

    if (in_array($user['rol'], ['estudiante', 'aspirante'], true)) {
        $condiciones[] = 'estudiante_email = ?';
        $params[] = $user['email'];
    }

    $estado = $_GET['estado'] ?? null;
    if ($estado) {
        if (!in_array($estado, ESTADOS_VALIDOS, true)) jsonError('Estado inválido', 400);
        $condiciones[] = 'estado = ?';
        $params[] = $estado;
    }

    $tipoBeca = $_GET['tipoBeca'] ?? null;
    if ($tipoBeca) { $condiciones[] = 'tipo_beca = ?'; $params[] = $tipoBeca; }

    $search = $_GET['search'] ?? null;
    if ($search) {
        $condiciones[] = '(nombres LIKE ? OR apellidos LIKE ? OR cedula LIKE ? OR expediente LIKE ?)';
        $s = '%' . $search . '%';
        array_push($params, $s, $s, $s, $s);
    }

    $sql = 'SELECT * FROM solicitudes';
    if ($condiciones) $sql .= ' WHERE ' . implode(' AND ', $condiciones);
    $sql .= ' ORDER BY id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse(array_map(fn($s) => adjuntarDocumentos($pdo, $s), $stmt->fetchAll()));
}

function verSolicitud(PDO $pdo, array $user, string $expediente): void {
    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $solicitud = $stmt->fetch();
    if (!$solicitud) jsonError('Solicitud no encontrada', 404);

    if (in_array($user['rol'], ['estudiante', 'aspirante'], true) && $solicitud['estudiante_email'] !== $user['email']) {
        jsonError('No tienes permiso para ver esta solicitud', 403);
    }
    jsonResponse(adjuntarDocumentos($pdo, $solicitud));
}

// Analisis por reglas (no es IA real): revisa consistencia general del
// expediente -- campos/documentos faltantes, archivos sospechosamente
// chicos, ingreso per capita inconsistente, promedio fuera de rango, etc.
// Distinto del analisis-ia.php, que sí manda el documento al microservicio
// de IA real para OCR y clasificación.
function verAnalisisExpediente(PDO $pdo, string $expediente): void {
    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $solicitud = $stmt->fetch();
    if (!$solicitud) jsonError('Solicitud no encontrada', 404);

    $datos = json_decode($solicitud['datos_completos'] ?? '{}', true) ?: [];
    $stmt = $pdo->prepare('SELECT * FROM documentos WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $documentos = $stmt->fetchAll();
    $docKeys = array_column($documentos, 'doc_key');

    $stmt = $pdo->prepare('SELECT * FROM integrantes_familia WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $integrantes = $stmt->fetchAll();

    $alertas = [];

    foreach (DOCUMENTOS_OBLIGATORIOS_BASE as $doc) {
        if (!in_array($doc, $docKeys, true)) {
            $alertas[] = ['nivel' => 'alto', 'mensaje' => "Falta el documento obligatorio \"$doc\""];
        }
    }
    foreach (CAMPOS_OBLIGATORIOS_BASE as $campo) {
        if (empty($datos[$campo]) || trim((string)$datos[$campo]) === '') {
            $alertas[] = ['nivel' => 'alto', 'mensaje' => "Falta completar el campo obligatorio \"$campo\""];
        }
    }
    foreach ($documentos as $d) {
        if ($d['tamano'] !== null && (int)$d['tamano'] < 1024) {
            $alertas[] = ['nivel' => 'medio', 'mensaje' => 'El documento "' . ($d['label'] ?: $d['doc_key']) . '" es muy pequeño (' . $d['tamano'] . ' bytes) — revisar si es legible'];
        }
    }

    if (count($integrantes) > 0) {
        $totalSalarios = 0;
        foreach ($integrantes as $p) { if ($p['trabaja']) $totalSalarios += (float)$p['salario_mensual']; }
        $calculado = $totalSalarios / (count($integrantes) + 1);
        if ($solicitud['ingreso_percapita'] !== null && abs((float)$solicitud['ingreso_percapita'] - $calculado) > 1) {
            $alertas[] = ['nivel' => 'bajo', 'mensaje' => 'El ingreso per cápita guardado no coincide con el calculado a partir del núcleo familiar actual — puede que se haya editado el núcleo familiar después de calcularlo.'];
        }
    } elseif ((float)$solicitud['ingreso_familiar'] > 0) {
        $alertas[] = ['nivel' => 'medio', 'mensaje' => 'Hay un ingreso familiar declarado pero no se registró ningún integrante del núcleo familiar.'];
    }

    if ($solicitud['promedio'] !== null && ((float)$solicitud['promedio'] < 0 || (float)$solicitud['promedio'] > 100)) {
        $alertas[] = ['nivel' => 'alto', 'mensaje' => 'El promedio registrado (' . $solicitud['promedio'] . ') está fuera del rango válido (0-100)'];
    }

    if (!empty($datos['f-merito']) && strlen(trim($datos['f-merito'])) < 30) {
        $alertas[] = ['nivel' => 'bajo', 'mensaje' => 'La justificación de mérito es muy corta, podría no ser suficiente para el comité.'];
    }

    jsonResponse(['expediente' => $solicitud['expediente'], 'totalAlertas' => count($alertas), 'alertas' => $alertas]);
}

function crearSolicitud(PDO $pdo, array $user): void {
    $body = getJsonBody();
    $estudianteEmail = $body['estudianteEmail'] ?? null;
    if (!$estudianteEmail) jsonError('El correo del estudiante es requerido', 400);

    $stmt = $pdo->prepare("SELECT email, nombre FROM usuarios WHERE email = ? AND rol IN ('estudiante', 'aspirante')");
    $stmt->execute([$estudianteEmail]);
    $estudiante = $stmt->fetch();
    if (!$estudiante) jsonError('El correo no corresponde a un estudiante o aspirante registrado', 400);

    $stmt = $pdo->prepare("SELECT id FROM solicitudes WHERE estudiante_email = ? AND estado IN ('Aprobada', 'Beneficio Activo')");
    $stmt->execute([$estudianteEmail]);
    if ($stmt->fetch()) jsonError('Este estudiante ya cuenta con una beca activa y no puede solicitar otra al mismo tiempo', 400);

    // Una sola solicitud por tipo de beca mientras esté en trámite (no se
    // puede volver a aplicar a la misma beca hasta que la anterior termine
    // en un estado final: rechazada, cancelada, o no elegible).
    $tipoBecaBody = $body['tipoBeca'] ?? null;
    if ($tipoBecaBody) {
        $stmt = $pdo->prepare(
            "SELECT expediente FROM solicitudes
             WHERE estudiante_email = ? AND tipo_beca = ?
             AND estado NOT IN ('Rechazada', 'Rechazado Definitivo', 'Cancelada', 'No elegible')"
        );
        $stmt->execute([$estudianteEmail, $tipoBecaBody]);
        $existente = $stmt->fetch();
        if ($existente) {
            jsonError("Ya tienes una solicitud en trámite para \"$tipoBecaBody\" (expediente {$existente['expediente']}). Debe resolverse antes de poder aplicar de nuevo a esta misma beca.", 400);
        }
    }

    $tipoBeca = $body['tipoBeca'] ?? null;
    if ($tipoBeca) {
        $stmt = $pdo->prepare('SELECT id FROM tipos_beca WHERE nombre = ? AND activo = 1');
        $stmt->execute([$tipoBeca]);
        if (!$stmt->fetch()) jsonError('El tipo de beca seleccionado no existe o está inactivo', 400);

        $stmt = $pdo->prepare("SELECT * FROM convocatorias WHERE tipo = ? AND estado = 'Activa'");
        $stmt->execute([$tipoBeca]);
        $hayAbierta = false;
        $ahora = time();
        foreach ($stmt->fetchAll() as $c) {
            $inicio = strtotime($c['fecha_apertura'] . ' ' . ($c['hora_apertura'] ?: '00:00') . ':00');
            $fin = strtotime($c['fecha_cierre'] . ' ' . ($c['hora_cierre'] ?: '23:59') . ':59');
            if ($ahora >= $inicio && $ahora <= $fin) { $hayAbierta = true; break; }
        }
        if (!$hayAbierta) jsonError("No hay una convocatoria activa y dentro de horario para \"$tipoBeca\" en este momento", 400);
    }

    $estado = $body['estado'] ?? null;
    if ($estado && !in_array($estado, ESTADOS_VALIDOS, true)) {
        jsonError('Estado inválido. Estados permitidos: ' . implode(', ', ESTADOS_VALIDOS), 400);
    }

    $documentos = $body['documentos'] ?? [];
    if (is_array($documentos)) {
        foreach ($documentos as $key => $doc) {
            try { validarDocumento($doc); }
            catch (Exception $e) { jsonError("Documento \"$key\": " . $e->getMessage(), 400); }
        }
    }

    $expediente = $body['expediente'] ?? generarExpediente($pdo);
    $stmt = $pdo->prepare('SELECT expediente FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    if ($stmt->fetch()) jsonError("El expediente $expediente ya existe", 400);

    $stmt = $pdo->prepare(
        'INSERT INTO solicitudes (
            expediente, fecha, estudiante_email, nombres, apellidos, cedula,
            correo, telefono, tipo_beca, estado, progreso, puntaje, promedio,
            ingreso_familiar, datos_completos, aceptado, porcentaje_cobertura, observacion_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $expediente, $body['fecha'] ?? date('Y-m-d'), $estudianteEmail,
        $body['nombres'] ?? ($estudiante['nombre'] ?? 'Estudiante'), $body['apellidos'] ?? '',
        $body['cedula'] ?? '', $body['correo'] ?? $estudianteEmail, $body['telefono'] ?? '',
        $tipoBeca ?? 'Socioeconómica', $estado ?? 'Enviada', $body['progreso'] ?? 10,
        $body['puntaje'] ?? 0, $body['promedio'] ?? 0, $body['ingresoFamiliar'] ?? 0,
        json_encode($body['datosCompletos'] ?? [], JSON_UNESCAPED_UNICODE),
        !empty($body['aceptado']) ? 1 : 0, $body['porcentajeCobertura'] ?? null,
        $body['observacionTS'] ?? 'Pendiente de revisión por trabajador social.'
    ]);
    $id = $pdo->lastInsertId();

    guardarDocumentos($pdo, $expediente, $documentos);

    $integrantesFamilia = $body['integrantesFamilia'] ?? null;
    $ingresoPercapita = $body['ingresoFamiliar'] ?? 0;
    if (is_array($integrantesFamilia)) {
        guardarIntegrantesFamilia($pdo, $expediente, $integrantesFamilia);
        $ingresoPercapita = calcularYGuardarIngresoPercapita($pdo, $expediente);
    }

    registrarBitacora($pdo, $user, 'Solicitud creada', $expediente);

    enviarNotificacionEmail('solicitud_recibida', [
        'email' => $estudianteEmail,
        'nombre' => trim(($body['nombres'] ?? $estudiante['nombre'] ?? '') . ' ' . ($body['apellidos'] ?? '')),
        'expediente' => $expediente,
        'tipoBeca' => $tipoBeca ?? 'Socioeconómica',
        'fecha' => $body['fecha'] ?? date('d/m/Y')
    ]);

    jsonResponse([
        'id' => (int)$id, 'expediente' => $expediente, 'estado' => $estado ?? 'Enviada',
        'ingresoPercapita' => $ingresoPercapita, 'message' => 'Solicitud creada correctamente'
    ], 201);
}

function actualizarSolicitud(PDO $pdo, array $user, string $expediente): void {
    $body = getJsonBody();

    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $actual = $stmt->fetch();
    if (!$actual) jsonError('Solicitud no encontrada', 404);

    if (in_array($user['rol'], ['estudiante', 'aspirante'], true) && $actual['estudiante_email'] !== $user['email']) {
        jsonError('No tienes permiso para modificar esta solicitud', 403);
    }

    $estadoNuevo = $body['estado'] ?? null;
    if ($estadoNuevo && !in_array($estadoNuevo, ESTADOS_VALIDOS, true)) {
        jsonError('Estado inválido. Estados permitidos: ' . implode(', ', ESTADOS_VALIDOS), 400);
    }

    $documentos = $body['documentos'] ?? null;
    if (is_array($documentos)) {
        foreach ($documentos as $key => $doc) {
            try { validarDocumento($doc); }
            catch (Exception $e) { jsonError("Documento \"$key\": " . $e->getMessage(), 400); }
        }
    }

    $mapaCampos = [
        'estado' => 'estado', 'progreso' => 'progreso', 'puntaje' => 'puntaje',
        'promedio' => 'promedio', 'ingresoFamiliar' => 'ingreso_familiar', 'aceptado' => 'aceptado',
        'porcentajeCobertura' => 'porcentaje_cobertura', 'observacionTS' => 'observacion_ts',
        'observacionesComite' => 'observaciones_comite', 'motivoRechazo' => 'motivo_rechazo'
    ];
    $sets = [];
    $valores = [];
    foreach ($mapaCampos as $campoBody => $campoDb) {
        if (array_key_exists($campoBody, $body)) {
            $sets[] = "$campoDb = ?";
            $valores[] = $campoBody === 'aceptado' ? (!empty($body[$campoBody]) ? 1 : 0) : $body[$campoBody];
        }
    }
    if (array_key_exists('datosCompletos', $body)) {
        $sets[] = 'datos_completos = ?';
        $valores[] = json_encode($body['datosCompletos'], JSON_UNESCAPED_UNICODE);
    }

    if ($sets) {
        $sets[] = 'updated_at = CURRENT_TIMESTAMP';
        $valores[] = $expediente;
        $pdo->prepare('UPDATE solicitudes SET ' . implode(', ', $sets) . ' WHERE expediente = ?')->execute($valores);
    }

    if (is_array($documentos)) {
        guardarDocumentos($pdo, $expediente, $documentos);
    }

    $estadoFinal = $estadoNuevo ?: $actual['estado'];
    if (is_array($documentos)) {
        $estadoFinal = evaluarSubsanacionAutomatica($pdo, $expediente);
    }

    if ($estadoNuevo && $estadoNuevo !== $actual['estado']) {
        registrarBitacora($pdo, $user, "Estado cambiado: {$actual['estado']} → $estadoNuevo", $expediente);
    }

    // Notificaciones por correo cuando el estado realmente cambió a algo
    // que el estudiante necesita saber.
    $estadoAnterior = $actual['estado'];
    $nombreCompleto = trim($actual['nombres'] . ' ' . $actual['apellidos']);
    if ($estadoFinal && $estadoFinal !== $estadoAnterior) {
        if ($estadoFinal === 'Aprobada') {
            enviarNotificacionEmail('solicitud_aprobada', [
                'email' => $actual['estudiante_email'], 'nombre' => $nombreCompleto, 'expediente' => $expediente,
                'tipoBeca' => $actual['tipo_beca'], 'porcentajeCobertura' => $body['porcentajeCobertura'] ?? $actual['porcentaje_cobertura'],
                'observaciones' => $body['observacionesComite'] ?? null
            ]);
        } elseif (in_array($estadoFinal, ['Rechazada', 'Rechazado Definitivo'], true)) {
            enviarNotificacionEmail('solicitud_rechazada', [
                'email' => $actual['estudiante_email'], 'nombre' => $nombreCompleto, 'expediente' => $expediente,
                'motivoRechazo' => $body['motivoRechazo'] ?? null
            ]);
        } elseif ($estadoFinal === 'Pendiente subsanación') {
            enviarNotificacionEmail('subsanacion_requerida', [
                'email' => $actual['estudiante_email'], 'nombre' => $nombreCompleto, 'expediente' => $expediente,
                'documentosPendientes' => listarPendientesSubsanacion($pdo, $expediente)
            ]);
        }
    }

    jsonResponse(['message' => 'Solicitud actualizada correctamente', 'expediente' => $expediente, 'estado' => $estadoFinal]);
}

function eliminarSolicitud(PDO $pdo, array $user, string $expediente): void {
    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $solicitud = $stmt->fetch();
    if (!$solicitud) jsonError('Solicitud no encontrada', 404);

    if (!in_array($user['rol'], ['admin', 'estudiante'], true)) {
        jsonError('No tienes permiso para eliminar esta solicitud', 403);
    }
    if ($user['rol'] === 'estudiante' && $solicitud['estudiante_email'] !== $user['email']) {
        jsonError('No tienes permiso para eliminar esta solicitud', 403);
    }

    $estadosBloqueados = ['En comité', 'Aprobada', 'Beneficio Activo', 'Rechazada', 'Rechazado Definitivo'];
    if (in_array($solicitud['estado'], $estadosBloqueados, true)) {
        jsonError("No se puede eliminar una solicitud en estado \"{$solicitud['estado']}\"", 400);
    }

    $pdo->prepare('DELETE FROM documentos WHERE expediente = ?')->execute([$expediente]);
    $pdo->prepare('DELETE FROM solicitudes WHERE expediente = ?')->execute([$expediente]);
    registrarBitacora($pdo, $user, 'Solicitud eliminada', $expediente);

    jsonResponse(['message' => 'Solicitud eliminada correctamente', 'expediente' => $expediente]);
}

// ===================================================================
// AUXILIARES
// ===================================================================

function validarDocumento(array $doc): void {
    if (!empty($doc['tamano']) && $doc['tamano'] > TAMANO_MAX_ARCHIVO) {
        throw new Exception('El archivo excede el tamaño máximo de 10MB');
    }
    if (!empty($doc['tipo']) && !in_array($doc['tipo'], TIPOS_ARCHIVO_PERMITIDOS, true)) {
        throw new Exception('Formato no permitido. Use PDF, JPG o PNG');
    }
}

function guardarDocumentos(PDO $pdo, string $expediente, $documentos): void {
    if (!is_array($documentos)) return;
    foreach ($documentos as $key => $doc) {
        if (empty($doc['datos']) && empty($doc['nombre'])) continue;

        $stmt = $pdo->prepare('SELECT id FROM documentos WHERE expediente = ? AND doc_key = ?');
        $stmt->execute([$expediente, $key]);
        $existente = $stmt->fetch();

        if ($existente) {
            $pdo->prepare(
                'UPDATE documentos SET label=?, nombre=?, tipo=?, tamano=?, fecha=?, datos=?, estado=?, observacion=? WHERE id=?'
            )->execute([
                $doc['label'] ?? $key, $doc['nombre'] ?? 'documento', $doc['tipo'] ?? 'application/octet-stream',
                $doc['tamano'] ?? 0, $doc['fecha'] ?? date('c'), $doc['datos'] ?? null,
                $doc['estado'] ?? 'Pendiente', $doc['observacion'] ?? '', $existente['id']
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO documentos (expediente, doc_key, label, nombre, tipo, tamano, fecha, datos, estado, observacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $expediente, $key, $doc['label'] ?? $key, $doc['nombre'] ?? 'documento',
                $doc['tipo'] ?? 'application/octet-stream', $doc['tamano'] ?? 0,
                $doc['fecha'] ?? date('c'), $doc['datos'] ?? null, $doc['estado'] ?? 'Pendiente', $doc['observacion'] ?? ''
            ]);
        }
    }
}

function guardarIntegrantesFamilia(PDO $pdo, string $expediente, array $integrantes): void {
    $pdo->prepare('DELETE FROM integrantes_familia WHERE expediente = ?')->execute([$expediente]);
    $ins = $pdo->prepare(
        'INSERT INTO integrantes_familia
            (expediente, nombre_completo, edad, estudia, trabaja, salario_mensual, tiene_transporte, casa_propia, vivienda_nombre_propio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($integrantes as $p) {
        $ins->execute([
            $expediente, $p['nombre'] ?? '', (int)($p['edad'] ?? 0),
            (($p['estudia'] ?? null) === 'Sí') ? 1 : 0, (($p['trabaja'] ?? null) === 'Sí') ? 1 : 0,
            (float)($p['salario'] ?? 0), (($p['transporte'] ?? null) === 'Sí') ? 1 : 0,
            (($p['casaPropia'] ?? null) === 'Sí') ? 1 : 0, (($p['viviendaNombrePropio'] ?? null) === 'Sí') ? 1 : 0
        ]);
    }
}

function evaluarSubsanacionAutomatica(PDO $pdo, string $expediente): ?string {
    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $solicitud = $stmt->fetch();
    if (!$solicitud || in_array($solicitud['estado'], ESTADOS_FINALES, true)) {
        return $solicitud['estado'] ?? null;
    }

    $datos = json_decode($solicitud['datos_completos'] ?? '{}', true) ?: [];
    $stmt = $pdo->prepare('SELECT doc_key FROM documentos WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $docKeys = array_column($stmt->fetchAll(), 'doc_key');

    $faltaCampo = false;
    foreach (CAMPOS_OBLIGATORIOS_BASE as $c) {
        if (empty($datos[$c]) || trim((string)$datos[$c]) === '') { $faltaCampo = true; break; }
    }
    $faltaDocumento = false;
    foreach (DOCUMENTOS_OBLIGATORIOS_BASE as $d) {
        if (!in_array($d, $docKeys, true)) { $faltaDocumento = true; break; }
    }

    if ($faltaCampo || $faltaDocumento) {
        if ($solicitud['estado'] !== 'Pendiente subsanación') {
            $pdo->prepare('UPDATE solicitudes SET estado = ? WHERE expediente = ?')->execute(['Pendiente subsanación', $expediente]);
            $fecha = date('n/j/Y, g:i:s A');
            $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
                ->execute([$fecha, 'sistema', 'sistema', 'Pasó a Subsanación automáticamente (faltan campos o documentos)', $expediente]);
        }
        return 'Pendiente subsanación';
    }
    return $solicitud['estado'];
}

// Arma la lista de campos/documentos faltantes en un formato listo para el
// correo de subsanación (label + observación de qué falta).
function listarPendientesSubsanacion(PDO $pdo, string $expediente): array {
    $stmt = $pdo->prepare('SELECT * FROM solicitudes WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $solicitud = $stmt->fetch();
    if (!$solicitud) return [];

    $datos = json_decode($solicitud['datos_completos'] ?? '{}', true) ?: [];
    $stmt = $pdo->prepare('SELECT doc_key FROM documentos WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $docKeys = array_column($stmt->fetchAll(), 'doc_key');

    $etiquetasCampo = [
        'f-nombres' => 'Nombres', 'f-apellidos' => 'Apellidos', 'f-cedula' => 'Cédula',
        'f-correo' => 'Correo', 'f-carrera' => 'Carrera', 'f-sede' => 'Sede',
        'f-promedio' => 'Promedio', 'f-merito' => 'Justificación de mérito'
    ];
    $etiquetasDoc = [
        'f-cedula-f' => 'Copia de cédula (frontal)', 'f-cedula-p' => 'Copia de cédula (posterior)',
        'f-constancia' => 'Constancia de ingresos familiares', 'f-recibo' => 'Recibo de servicios públicos'
    ];

    $pendientes = [];
    foreach (CAMPOS_OBLIGATORIOS_BASE as $c) {
        if (empty($datos[$c]) || trim((string)$datos[$c]) === '') {
            $pendientes[] = ['label' => $etiquetasCampo[$c] ?? $c, 'observacion' => 'Campo obligatorio faltante'];
        }
    }
    foreach (DOCUMENTOS_OBLIGATORIOS_BASE as $d) {
        if (!in_array($d, $docKeys, true)) {
            $pendientes[] = ['label' => $etiquetasDoc[$d] ?? $d, 'observacion' => 'Documento no adjuntado'];
        }
    }
    return $pendientes;
}

function generarExpediente(PDO $pdo): string {
    $year = date('Y');
    $stmt = $pdo->query('SELECT expediente FROM solicitudes ORDER BY id DESC LIMIT 1');
    $ultima = $stmt->fetch();
    $num = 1;
    if ($ultima && !empty($ultima['expediente'])) {
        $partes = explode('-', $ultima['expediente']);
        $ultimoNum = (int) end($partes);
        if ($ultimoNum > 0) $num = $ultimoNum + 1;
    }
    return 'BC-' . $year . '-' . str_pad((string)$num, 3, '0', STR_PAD_LEFT);
}

function adjuntarDocumentos(PDO $pdo, array $solicitud): array {
    $stmt = $pdo->prepare('SELECT * FROM documentos WHERE expediente = ?');
    $stmt->execute([$solicitud['expediente']]);

    $docsMap = [];
    foreach ($stmt->fetchAll() as $d) {
        $docsMap[$d['doc_key']] = [
            'id' => $d['id'], 'label' => $d['label'], 'nombre' => $d['nombre'], 'tipo' => $d['tipo'],
            'tamano' => $d['tamano'], 'fecha' => $d['fecha'], 'estado' => $d['estado'],
            'observacion' => $d['observacion'] ?? '', 'url' => '/api/documentos/' . $d['id']
        ];
    }

    $solicitud['documentos'] = $docsMap;
    $solicitud['datos_completos'] = json_decode($solicitud['datos_completos'] ?? '{}', true);
    return $solicitud;
}
