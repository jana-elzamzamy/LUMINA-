<?php
require_once __DIR__ . '/db.php';

$in = body_json();
$user_id    = (int)($in['user_id']    ?? 1);
$label      = $in['gesture_label']    ?? 'unknown';
$confidence = (float)($in['confidence'] ?? 0);

$stmt = $pdo->prepare("
    INSERT INTO GestureHistory (user_id, gesture_label, confidence)
    VALUES (:u, :l, :c)
");
$stmt->execute([':u' => $user_id, ':l' => $label, ':c' => $confidence]);

respond(['ok' => true, 'gesture_id' => (int)$pdo->lastInsertId()]);
