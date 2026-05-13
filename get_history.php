<?php
require_once __DIR__ . '/db.php';

$user_id = (int)($_GET['user_id'] ?? 1);
$limit   = max(1, min(100, (int)($_GET['limit'] ?? 20)));

$usage = $pdo->prepare("
    SELECT TOP ($limit) l.log_id, l.timestamp, l.duration_sec, f.name AS feature
    FROM UsageLog l
    JOIN Feature f ON f.feature_id = l.feature_id
    WHERE l.user_id = :u
    ORDER BY l.timestamp DESC
");
$usage->execute([':u' => $user_id]);

$detections = $pdo->prepare("
    SELECT TOP ($limit) detection_id, timestamp, object_count, description
    FROM DetectionResult
    WHERE user_id = :u
    ORDER BY timestamp DESC
");
$detections->execute([':u' => $user_id]);

$gestures = $pdo->prepare("
    SELECT TOP ($limit) gesture_id, gesture_label, confidence, created_at
    FROM GestureHistory
    WHERE user_id = :u
    ORDER BY created_at DESC
");
$gestures->execute([':u' => $user_id]);

$tts = $pdo->prepare("
    SELECT TOP ($limit) tts_id, text_preview, voice, played_at
    FROM TTSHistory
    WHERE user_id = :u
    ORDER BY played_at DESC
");
$tts->execute([':u' => $user_id]);

respond([
    'ok'         => true,
    'user_id'    => $user_id,
    'usage'      => $usage->fetchAll(),
    'detections' => $detections->fetchAll(),
    'gestures'   => $gestures->fetchAll(),
    'tts'        => $tts->fetchAll(),
]);
