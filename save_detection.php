<?php
require_once __DIR__ . '/db.php';

$in = body_json();
$user_id     = (int)($in['user_id']     ?? 1);
$description = $in['description']       ?? '';
$objects     = $in['objects']           ?? [];

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("
        INSERT INTO DetectionResult (user_id, object_count, description)
        VALUES (:uid, :cnt, :desc)
    ");
    $stmt->execute([
        ':uid'  => $user_id,
        ':cnt'  => count($objects),
        ':desc' => $description
    ]);
    $detection_id = (int)$pdo->lastInsertId();

    $ins = $pdo->prepare("
        INSERT INTO DetectedObject (detection_id, class_name, confidence, bbox_x, bbox_y, bbox_w, bbox_h)
        VALUES (:d, :c, :s, :x, :y, :w, :h)
    ");
    foreach ($objects as $o) {
        $ins->execute([
            ':d' => $detection_id,
            ':c' => $o['class']      ?? 'unknown',
            ':s' => (float)($o['score'] ?? 0),
            ':x' => (int)($o['bbox'][0] ?? 0),
            ':y' => (int)($o['bbox'][1] ?? 0),
            ':w' => (int)($o['bbox'][2] ?? 0),
            ':h' => (int)($o['bbox'][3] ?? 0),
        ]);
    }
    $pdo->commit();
    respond(['ok' => true, 'detection_id' => $detection_id]);
} catch (Exception $e) {
    $pdo->rollBack();
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
