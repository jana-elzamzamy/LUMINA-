<?php
/**
 * Lumina - Database Connection (Microsoft SQL Server)
 *
 * Requires PHP extensions:  pdo_sqlsrv  and  sqlsrv
 * Download from: https://learn.microsoft.com/sql/connect/php/download-drivers-for-php-for-sql-server
 *
 * Default assumes local SQL Server with Windows Authentication.
 * If you use SQL Authentication, fill in $DB_USER and $DB_PASS
 * and change USE_WINDOWS_AUTH to false.
 */

$DB_SERVER = 'localhost';        // or '.\\SQLEXPRESS' for SQL Express
$DB_NAME   = 'lumina_db';
$USE_WINDOWS_AUTH = true;        // true = Trusted_Connection, false = user/password
$DB_USER   = 'sa';
$DB_PASS   = 'YourPassword123';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    if ($USE_WINDOWS_AUTH) {
        $dsn = "sqlsrv:Server=$DB_SERVER;Database=$DB_NAME;TrustServerCertificate=1";
        $pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } else {
        $dsn = "sqlsrv:Server=$DB_SERVER;Database=$DB_NAME;TrustServerCertificate=1";
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function body_json() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}