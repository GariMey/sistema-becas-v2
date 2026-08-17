<?php
// api/helpers/emailTemplates.php
// Genera asunto + HTML para cada tipo de notificación del sistema.
// Devuelve ['titulo' => string, 'html' => string].

function generarPlantillaCorreo(string $tipo, array $datos): array {
    $nombre = htmlspecialchars($datos['nombre'] ?? 'Estudiante');
    $appUrl = APP_URL;

    switch ($tipo) {
        case 'solicitud_recibida':
            return [
                'titulo' => 'Solicitud de beca recibida',
                'html' => plantillaEmail('Solicitud Recibida', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu solicitud de beca ha sido recibida correctamente.</p>
                    <div style='background:#e6effa;border:1px solid #b8d0e8;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Expediente:</strong> " . htmlspecialchars($datos['expediente'] ?? '') . "</p>
                        <p><strong>Tipo de beca:</strong> " . htmlspecialchars($datos['tipoBeca'] ?? '') . "</p>
                        <p><strong>Fecha:</strong> " . htmlspecialchars($datos['fecha'] ?? date('d/m/Y')) . "</p>
                    </div>
                    <p>El trabajador social revisará tu solicitud en los próximos días.</p>
                    <p>Puedes dar seguimiento en tu <a href='$appUrl'>panel de estudiante</a>.</p>
                ")
            ];

        case 'subsanacion_requerida':
            $items = '';
            foreach (($datos['documentosPendientes'] ?? []) as $d) {
                $items .= '<li><strong>' . htmlspecialchars($d['label'] ?? '') . ':</strong> ' . htmlspecialchars($d['observacion'] ?? 'Requiere corrección') . '</li>';
            }
            return [
                'titulo' => 'Se requiere subsanación de documentos',
                'html' => plantillaEmail('Subsanación Requerida', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu solicitud de beca <strong>" . htmlspecialchars($datos['expediente'] ?? '') . "</strong> requiere correcciones en la documentación.</p>
                    <div style='background:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Documentos o campos a corregir:</strong></p>
                        <ul>$items</ul>
                    </div>
                    <p>Ingresa a tu <a href='$appUrl'>panel de estudiante</a> y sube las correcciones antes de la fecha límite.</p>
                    <p style='color:#b07d12;font-weight:bold;'>Si no realizas las correcciones, tu solicitud podría ser rechazada.</p>
                ")
            ];

        case 'solicitud_aprobada':
            $obs = !empty($datos['observaciones']) ? '<p><strong>Observaciones:</strong> ' . htmlspecialchars($datos['observaciones']) . '</p>' : '';
            return [
                'titulo' => '¡Tu beca ha sido aprobada!',
                'html' => plantillaEmail('¡Felicidades!', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu solicitud de beca ha sido <strong>APROBADA</strong>.</p>
                    <div style='background:#e7f5ee;border:1px solid #b9e3cb;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Expediente:</strong> " . htmlspecialchars($datos['expediente'] ?? '') . "</p>
                        <p><strong>Tipo de beca:</strong> " . htmlspecialchars($datos['tipoBeca'] ?? '') . "</p>
                        <p><strong>Porcentaje de cobertura:</strong> " . htmlspecialchars($datos['porcentajeCobertura'] ?? '—') . "</p>
                        $obs
                    </div>
                    <p>Para activar el beneficio, ingresa a tu <a href='$appUrl'>panel de estudiante</a> y acepta la carta compromiso.</p>
                    <p style='color:#1e7e4f;font-weight:bold;'>Recuerda mantener un promedio mínimo de 80 para conservar el beneficio.</p>
                ")
            ];

        case 'solicitud_rechazada':
            return [
                'titulo' => 'Actualización de tu solicitud de beca',
                'html' => plantillaEmail('Solicitud Rechazada', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Lamentamos informarte que tu solicitud de beca <strong>" . htmlspecialchars($datos['expediente'] ?? '') . "</strong> ha sido <strong>RECHAZADA</strong>.</p>
                    <div style='background:#fdecea;border:1px solid #f6c6c0;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Motivo del rechazo:</strong></p>
                        <p>" . htmlspecialchars($datos['motivoRechazo'] ?? 'No cumple con los requisitos establecidos para este tipo de beca.') . "</p>
                    </div>
                    <p>Si consideras que esta decisión debe ser revisada, puedes presentar una <strong>apelación</strong> desde tu <a href='$appUrl'>panel de estudiante</a>.</p>
                    <p>El plazo para apelar es de 10 días hábiles.</p>
                ")
            ];

        case 'apelacion_recibida':
            return [
                'titulo' => 'Apelación recibida',
                'html' => plantillaEmail('Apelación Recibida', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Hemos recibido tu apelación para el expediente <strong>" . htmlspecialchars($datos['expediente'] ?? '') . "</strong>.</p>
                    <p>Un trabajador social revisará tu caso y te notificaremos la resolución. El proceso puede tomar hasta 5 días hábiles.</p>
                ")
            ];

        case 'apelacion_resuelta':
            $aceptada = ($datos['decision'] ?? '') === 'Revocar Rechazo';
            $color = $aceptada ? '#e7f5ee' : '#fdecea';
            $borde = $aceptada ? '#b9e3cb' : '#f6c6c0';
            $mensaje = $aceptada
                ? 'Tu solicitud será reevaluada por el comité. Recibirás una nueva notificación cuando haya un resultado.'
                : 'La decisión de rechazo se mantiene firme. Puedes contactar a la oficina de becas si necesitas más información.';
            return [
                'titulo' => 'Resolución de apelación',
                'html' => plantillaEmail('Apelación Resuelta', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu apelación para el expediente <strong>" . htmlspecialchars($datos['expediente'] ?? '') . "</strong> ha sido resuelta.</p>
                    <div style='background:$color;border:1px solid $borde;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Decisión:</strong> " . ($aceptada ? 'Apelación aceptada' : 'Apelación rechazada') . "</p>
                    </div>
                    <p>$mensaje</p>
                ")
            ];

        case 'beca_suspendida':
            $esCancelacion = ($datos['tipo'] ?? '') === 'Cancelación definitiva';
            return [
                'titulo' => ($datos['tipo'] ?? 'Suspensión') . ' de beca',
                'html' => plantillaEmail($datos['tipo'] ?? 'Suspensión de Beca', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Te informamos que tu beca ha sido <strong>" . ($esCancelacion ? 'CANCELADA' : 'SUSPENDIDA') . "</strong>.</p>
                    <div style='background:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Expediente:</strong> " . htmlspecialchars($datos['expediente'] ?? '') . "</p>
                        <p><strong>Motivo:</strong> " . htmlspecialchars($datos['motivo'] ?? '') . "</p>
                        <p><strong>Duración:</strong> " . htmlspecialchars($datos['dias'] ?? '') . "</p>
                        <p><strong>Observaciones:</strong> " . htmlspecialchars($datos['observaciones'] ?? 'Sin observaciones adicionales.') . "</p>
                    </div>
                    <p>" . ($esCancelacion
                        ? 'El beneficio ha sido cancelado permanentemente. Puedes presentar una apelación si consideras que la decisión debe ser revisada.'
                        : 'El beneficio queda suspendido por el período indicado. Al finalizar, la beca se restaurará automáticamente.') . "</p>
                    <p>Para más información, contacta a la oficina de becas.</p>
                ")
            ];

        case 'beca_restaurada':
            return [
                'titulo' => 'Beca restaurada',
                'html' => plantillaEmail('Beca Restaurada', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu beca ha sido <strong>RESTAURADA</strong>. El beneficio vuelve a estar activo.</p>
                    <div style='background:#e7f5ee;border:1px solid #b9e3cb;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Expediente:</strong> " . htmlspecialchars($datos['expediente'] ?? '—') . "</p>
                        <p><strong>Fecha de restauración:</strong> " . htmlspecialchars($datos['fechaRestauracion'] ?? date('d/m/Y H:i')) . "</p>
                    </div>
                    <p>Puedes verificar el estado en tu <a href='$appUrl'>panel de estudiante</a>.</p>
                ")
            ];

        case 'justificacion_revisada':
            $aprobada = ($datos['estado'] ?? '') === 'Aprobada';
            $obs = !empty($datos['observacion']) ? '<p><strong>Observación:</strong> ' . htmlspecialchars($datos['observacion']) . '</p>' : '';
            return [
                'titulo' => 'Justificación de pérdida de curso revisada',
                'html' => plantillaEmail('Justificación Revisada', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Tu justificación de pérdida de curso para <strong>" . htmlspecialchars($datos['curso'] ?? '') . "</strong> ha sido revisada.</p>
                    <div style='background:" . ($aprobada ? '#e7f5ee' : '#fdecea') . ";border:1px solid " . ($aprobada ? '#b9e3cb' : '#f6c6c0') . ";padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Estado:</strong> " . htmlspecialchars($datos['estado'] ?? '') . "</p>
                        $obs
                    </div>
                    <p>Puedes ver los detalles en tu <a href='$appUrl'>panel de estudiante</a>.</p>
                ")
            ];

        case 'nueva_convocatoria':
            return [
                'titulo' => 'Nueva convocatoria de becas disponible',
                'html' => plantillaEmail('Nueva Convocatoria', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Se ha publicado una nueva convocatoria de becas.</p>
                    <div style='background:#e6effa;border:1px solid #b8d0e8;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Convocatoria:</strong> " . htmlspecialchars($datos['convocatoria'] ?? '') . "</p>
                        <p><strong>Tipo:</strong> " . htmlspecialchars($datos['tipo'] ?? '') . "</p>
                        <p><strong>Apertura:</strong> " . htmlspecialchars($datos['fechaApertura'] ?? '') . "</p>
                        <p><strong>Cierre:</strong> " . htmlspecialchars($datos['fechaCierre'] ?? '') . "</p>
                        <p><strong>Cupos disponibles:</strong> " . htmlspecialchars((string)($datos['cupos'] ?? '')) . "</p>
                    </div>
                    <p>Ingresa al <a href='$appUrl'>Sistema de Becas</a> para solicitar tu beca. Las convocatorias tienen cupos limitados.</p>
                ")
            ];

        case 'convocatoria_cerrada':
            return [
                'titulo' => 'Convocatoria cerrada',
                'html' => plantillaEmail('Convocatoria Cerrada', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Te informamos que la convocatoria <strong>" . htmlspecialchars($datos['convocatoria'] ?? '') . "</strong> ha sido cerrada.</p>
                    <p>Si ya realizaste tu solicitud, está siendo procesada y recibirás notificaciones sobre su estado. Si no aplicaste, te invitamos a estar atento a las próximas convocatorias.</p>
                    <p>Ingresa al <a href='$appUrl'>Sistema de Becas</a> para más información.</p>
                ")
            ];

        case 'nueva_noticia':
            $titulo = htmlspecialchars($datos['titulo'] ?? '');
            $contenido = nl2br(htmlspecialchars($datos['contenido'] ?? ''));
            return [
                'titulo' => $titulo,
                'html' => plantillaEmail('Nueva Noticia', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <div style='background:#fff8e6;border:1px solid #f0dba3;padding:15px;border-radius:8px;margin:15px 0;'>
                        <h2 style='margin:0 0 8px 0;color:#1a365d;font-size:18px;'>$titulo</h2>
                        <p style='margin:0;color:#6b7585;font-size:14px;'>" . htmlspecialchars($datos['fecha'] ?? date('d/m/Y')) . "</p>
                    </div>
                    <div style='background:#fff;padding:15px;border-radius:8px;margin:15px 0;border:1px solid #e6e9f0;'>
                        <p style='margin:0;line-height:1.6;'>$contenido</p>
                    </div>
                    <p>Ingresa al <a href='$appUrl'>Sistema de Becas</a> para más información.</p>
                ")
            ];

        case 'visita_programada':
            $obs = !empty($datos['observaciones']) ? '<p><strong>Observaciones:</strong> ' . htmlspecialchars($datos['observaciones']) . '</p>' : '';
            return [
                'titulo' => 'Visita domiciliaria programada',
                'html' => plantillaEmail('Visita Domiciliaria', "
                    <p>Hola <strong>$nombre</strong>,</p>
                    <p>Se ha programado una visita domiciliaria para tu solicitud.</p>
                    <div style='background:#e6effa;border:1px solid #b8d0e8;padding:15px;border-radius:8px;margin:15px 0;'>
                        <p><strong>Fecha:</strong> " . htmlspecialchars($datos['fecha'] ?? '') . "</p>
                        <p><strong>Expediente:</strong> " . htmlspecialchars($datos['expediente'] ?? '') . "</p>
                        $obs
                    </div>
                    <p>Por favor confirma tu disponibilidad en la fecha indicada. Si tienes algún inconveniente, contacta a la oficina de becas.</p>
                ")
            ];

        default:
            return ['titulo' => 'Notificación', 'html' => plantillaEmail('Notificación', "<p>Hola <strong>$nombre</strong>,</p><p>Tienes una actualización en el Sistema de Becas.</p>")];
    }
}

// Envía la notificación a un estudiante puntual. Devuelve el mismo formato
// que enviarEmail() para que quien la llame pueda contar éxitos/fallos.
function enviarNotificacionEmail(string $tipo, array $datos): array {
    if (empty($datos['email'])) {
        return ['success' => false, 'error' => 'Falta el correo del destinatario'];
    }
    $plantilla = generarPlantillaCorreo($tipo, $datos);
    return enviarEmail($datos['email'], $plantilla['titulo'] . ' — Sistema de Becas', $plantilla['html']);
}
