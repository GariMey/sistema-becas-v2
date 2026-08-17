<?php
// api/helpers/email.php
// Envía correos usando la API HTTP de SendGrid directamente (v3/mail/send),
// sin necesidad de instalar el SDK de PHP vía Composer.

require_once __DIR__ . '/../config/email.php';

// Devuelve ['success' => bool, 'error' => string|null]
function enviarEmail(string $to, string $subject, string $html, ?string $text = null): array {
    if (!SENDGRID_API_KEY || SENDGRID_API_KEY === 'PON_AQUI_TU_API_KEY_DE_SENDGRID') {
        error_log("[EMAIL SIMULADO] Para: $to | Asunto: $subject (SENDGRID_API_KEY no configurada)");
        return ['success' => false, 'error' => 'SendGrid no está configurado (falta la API Key)'];
    }

    $textoPlano = $text ?? trim(preg_replace('/\s+/', ' ', strip_tags($html)));

    $payload = [
        'personalizations' => [['to' => [['email' => $to]]]],
        'from' => ['email' => EMAIL_FROM, 'name' => EMAIL_FROM_NAME],
        'subject' => $subject,
        'content' => [
            ['type' => 'text/plain', 'value' => $textoPlano],
            ['type' => 'text/html', 'value' => $html],
        ],
    ];

    $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . SENDGRID_API_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $respuesta = curl_exec($ch);
    $codigoHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errorCurl = curl_error($ch);
    curl_close($ch);

    // SendGrid responde 202 (Accepted) cuando todo sale bien -- no hay body.
    if ($codigoHttp === 202) {
        return ['success' => true, 'error' => null];
    }

    $detalle = $errorCurl ?: $respuesta;
    error_log("Error enviando email a $to (HTTP $codigoHttp): $detalle");
    return ['success' => false, 'error' => "SendGrid respondió HTTP $codigoHttp: $detalle"];
}

// Envuelve el contenido en la misma plantilla visual simple para todos los correos.
function plantillaEmail(string $tituloInterno, string $cuerpoHtml): string {
    return '
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1a365d;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">' . htmlspecialchars($tituloInterno) . '</h1>
        <div style="font-size:13px;opacity:0.8;margin-top:4px;">Sistema de Becas Universitarias</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e6e9f0;border-radius:0 0 8px 8px;">
        ' . $cuerpoHtml . '
        <div style="text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #e6e9f0;font-size:12px;color:#6b7585;">
          Este es un mensaje automático, por favor no respondas a este correo.
        </div>
      </div>
    </div>';
}
