<?php
require_once __DIR__ . '/db.php';

$stmt = $pdo->query("SELECT feature_id, name, description FROM Feature ORDER BY feature_id");
$rows = $stmt->fetchAll();

respond(['ok' => true, 'features' => $rows]);
