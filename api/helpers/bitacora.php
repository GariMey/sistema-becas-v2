<?php
// api/helpers/bitacora.php
// Compartido por todas las rutas que necesiten registrar una accion.

function registrarBitacora(PDO $pdo, array $user, string $accion, string $expediente = '—'): void {
    $fecha = date('n/j/Y, g:i:s A');
    $pdo->prepare('INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)')
        ->execute([$fecha, $user['email'], $user['rol'], $accion, $expediente]);
}
