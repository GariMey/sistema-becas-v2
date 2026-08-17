<?php
// api/config/db.php
// Conexion PDO a MySQL. Reemplaza estos 4 valores con los reales de tu cPanel
// (los que ya creaste: MySQL Databases -> nombre de BD, usuario, password).

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'tiusr11cp_becasdb');      // <-- confirmar nombre exacto
define('DB_USER', 'tiusr11cp_ziubecas');
define('DB_PASS', 'Becas2026');

function getPDO(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo conectar a la base de datos: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}
