<?php
require_once __DIR__ . '/db.php';

$in = body_json();
$user_id = (int)($in['user_id'] ?? 1);
$text    = (string)($in['text'] ?? '');
$voice   = $in['voice']         ?? null;
$rate    = (float)($in['speech_rate'] ?? 1.0);
$pitch   = (float)($in['pitch']       ?? 1.0);

$preview = mb_substr($text, 0, 200);

$stmt = $pdo->prepare("
    INSERT INTO TTSHistory (user_id, text_preview, voice, speech_rate, pitch)
    VALUES (:u, :t, :v, :r, :p)
");
$stmt->execute([
    ':u' => $user_id,
    ':t' => $preview,
    ':v' => $voice,
    ':r' => $rate,
    ':p' => $pitch,
]);

respond(['ok' => true, 'tts_id' => (int)$pdo->lastInsertId()]);
