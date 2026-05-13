<?php
require_once __DIR__ . '/db.php';

$user_id = (int)($_GET['user_id'] ?? 1);

$stmt = $pdo->prepare("SELECT TOP 1 * FROM UserPreference WHERE user_id = :uid");
$stmt->execute([':uid' => $user_id]);
$row = $stmt->fetch();

if (!$row) {
    respond(['ok' => true, 'preferences' => null]);
}
respond(['ok' => true, 'preferences' => $row]);
