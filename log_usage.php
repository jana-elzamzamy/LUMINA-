<?php
require_once __DIR__ . '/db.php';

$in = body_json();
$user_id    = (int)($in['user_id']    ?? 1);
$feature    = $in['feature']          ?? 'unknown';
$duration   = (int)($in['duration_sec'] ?? 0);

$f = $pdo->prepare("SELECT TOP 1 feature_id FROM Feature WHERE name = :n");
$f->execute([':n' => $feature]);
$row = $f->fetch();
if (!$row) { respond(['ok' => false, 'error' => "Feature '$feature' not found"], 404); }

$stmt = $pdo->prepare("
    INSERT INTO UsageLog (user_id, feature_id, duration_sec)
    VALUES (:u, :f, :d)
");
$stmt->execute([':u' => $user_id, ':f' => $row['feature_id'], ':d' => $duration]);

respond(['ok' => true, 'log_id' => (int)$pdo->lastInsertId()]);
