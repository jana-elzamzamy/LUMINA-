<?php
require_once __DIR__ . '/db.php';

$in = body_json();
$user_id       = (int)($in['user_id']       ?? 1);
$high_contrast = !empty($in['high_contrast']) ? 1 : 0;
$text_size     = (int)($in['text_size']     ?? 100);
$voice         = $in['preferred_voice']     ?? null;
$rate          = (float)($in['speech_rate'] ?? 1.0);
$pitch         = (float)($in['pitch']       ?? 1.0);

// SQL Server UPSERT uses MERGE
$sql = "
    MERGE UserPreference AS target
    USING (SELECT :uid AS user_id) AS source
    ON target.user_id = source.user_id
    WHEN MATCHED THEN UPDATE SET
        high_contrast   = :hc,
        text_size       = :ts,
        preferred_voice = :v,
        speech_rate     = :r,
        pitch           = :p,
        updated_at      = GETDATE()
    WHEN NOT MATCHED THEN INSERT
        (user_id, high_contrast, text_size, preferred_voice, speech_rate, pitch)
        VALUES (:uid2, :hc2, :ts2, :v2, :r2, :p2);
";
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':uid' => $user_id, ':hc' => $high_contrast, ':ts' => $text_size,
    ':v' => $voice, ':r' => $rate, ':p' => $pitch,
    ':uid2' => $user_id, ':hc2' => $high_contrast, ':ts2' => $text_size,
    ':v2' => $voice, ':r2' => $rate, ':p2' => $pitch,
]);

respond(['ok' => true, 'message' => 'Preferences saved.']);
