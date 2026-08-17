<?php
// api/helpers/ingresoPercapita.php
// Compartido por solicitudes.php (al crear, si mandan nucleo familiar) y
// integrantesFamilia.php (al editar el nucleo familiar despues).

function calcularYGuardarIngresoPercapita(PDO $pdo, string $expediente): float {
    $stmt = $pdo->prepare('SELECT * FROM integrantes_familia WHERE expediente = ?');
    $stmt->execute([$expediente]);
    $integrantes = $stmt->fetchAll();

    $totalSalarios = 0;
    foreach ($integrantes as $p) {
        if ($p['trabaja']) $totalSalarios += (float)$p['salario_mensual'];
    }
    $totalPersonas = count($integrantes) + 1; // +1 = el propio estudiante/aspirante
    $ingresoPercapita = $totalPersonas > 0 ? $totalSalarios / $totalPersonas : 0;

    $pdo->prepare('UPDATE solicitudes SET ingreso_percapita = ? WHERE expediente = ?')
        ->execute([$ingresoPercapita, $expediente]);

    return $ingresoPercapita;
}
