"""
Lumina - simple Python backend.

Run:
    python server.py

Then open http://localhost:8000/ in your browser.

This single file replaces the PHP + SQL Server + XAMPP stack.
It uses only Python's standard library (no pip install needed) and
stores everything in lumina.db (SQLite, auto-created on first run).
"""

import http.server
import json
import os
import sqlite3
import sys
import urllib.parse
from http import HTTPStatus

HOST = "127.0.0.1"
PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "lumina.db")


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS "User" (
    user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    user_type      TEXT NOT NULL DEFAULT 'guest'
        CHECK (user_type IN ('blind','deaf','elderly','reading_difficulty','caregiver','admin','guest')),
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UserPreference (
    pref_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL UNIQUE,
    high_contrast   INTEGER NOT NULL DEFAULT 0,
    text_size       INTEGER NOT NULL DEFAULT 100,
    preferred_voice TEXT,
    speech_rate     REAL NOT NULL DEFAULT 1.0,
    pitch           REAL NOT NULL DEFAULT 1.0,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Feature (
    feature_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS AIModel (
    model_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    version    TEXT NOT NULL,
    url        TEXT NOT NULL,
    loaded_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UsageLog (
    log_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    feature_id    INTEGER NOT NULL,
    timestamp     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_sec  INTEGER,
    FOREIGN KEY (user_id)    REFERENCES "User"(user_id)   ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES Feature(feature_id)
);

CREATE TABLE IF NOT EXISTS DetectionResult (
    detection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    timestamp    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_path   TEXT,
    object_count INTEGER NOT NULL DEFAULT 0,
    description  TEXT,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DetectedObject (
    object_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL,
    class_name   TEXT NOT NULL,
    confidence   REAL NOT NULL,
    bbox_x       INTEGER,
    bbox_y       INTEGER,
    bbox_w       INTEGER,
    bbox_h       INTEGER,
    FOREIGN KEY (detection_id) REFERENCES DetectionResult(detection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS GestureHistory (
    gesture_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    gesture_label TEXT NOT NULL,
    confidence    REAL NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TTSHistory (
    tts_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    text_preview TEXT,
    voice        TEXT,
    speech_rate  REAL NOT NULL DEFAULT 1.0,
    pitch        REAL NOT NULL DEFAULT 1.0,
    played_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);
"""

SEED_USERS = [
    ("Guest User",         "guest@lumina.local", "guest_no_password",       "guest"),
    ("Esraa Mohsen",       "esraa@lumina.local", "hash_placeholder_esraa",  "admin"),
    ("Jana Ahmed",         "jana@lumina.local",  "hash_placeholder_jana",   "admin"),
    ("Ahmed (Blind User)", "ahmed@demo.local",   "hash_placeholder_ahmed",  "blind"),
    ("Sara (Deaf User)",   "sara@demo.local",    "hash_placeholder_sara",   "deaf"),
]

SEED_PREFS = [
    (1, 0, 100, None,                 1.0, 1.0),
    (2, 0, 110, "Google US English",  1.0, 1.0),
    (3, 1, 120, "Google US English",  0.9, 1.0),
    (4, 1, 130, "Google US English",  0.8, 1.0),
    (5, 0, 100, None,                 1.0, 1.0),
]

SEED_FEATURES = [
    ("image_description", "Detect objects in an image and describe them with speech."),
    ("sign_translation",  "Translate sign-language hand gestures into text."),
    ("text_to_speech",    "Read any typed text or file aloud."),
    ("accessibility",     "High contrast and text-size preferences."),
]

SEED_AI_MODELS = [
    ("COCO-SSD", "2.2.2", "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"),
    ("Handpose", "0.0.7", "https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose"),
    ("jsQR",     "1.4.0", "https://cdn.jsdelivr.net/npm/jsqr"),
]

SEED_USAGE = [
    (4, 1, 12),
    (4, 4, 45),
    (5, 3, 30),
]

SEED_GESTURES = [
    (5, "open_hand", 0.94),
    (5, "thumbs_up", 0.89),
    (5, "peace",     0.91),
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    fresh = not os.path.exists(DB_PATH)
    conn = get_db()
    try:
        conn.executescript(SCHEMA_SQL)
        if fresh:
            conn.executemany(
                'INSERT INTO "User" (name, email, password_hash, user_type) VALUES (?,?,?,?)',
                SEED_USERS,
            )
            conn.executemany(
                "INSERT INTO UserPreference (user_id, high_contrast, text_size, preferred_voice, speech_rate, pitch) VALUES (?,?,?,?,?,?)",
                SEED_PREFS,
            )
            conn.executemany(
                "INSERT INTO Feature (name, description) VALUES (?,?)",
                SEED_FEATURES,
            )
            conn.executemany(
                "INSERT INTO AIModel (name, version, url) VALUES (?,?,?)",
                SEED_AI_MODELS,
            )
            conn.executemany(
                "INSERT INTO UsageLog (user_id, feature_id, duration_sec) VALUES (?,?,?)",
                SEED_USAGE,
            )
            conn.executemany(
                "INSERT INTO GestureHistory (user_id, gesture_label, confidence) VALUES (?,?,?)",
                SEED_GESTURES,
            )
            conn.commit()
            print(f"Created fresh database at {DB_PATH}")
        else:
            print(f"Using existing database at {DB_PATH}")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------

class LuminaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # --- helpers --------------------------------------------------------

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def _query(self):
        return urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)

    def _qs_int(self, key, default):
        try:
            return int(self._query().get(key, [default])[0])
        except (TypeError, ValueError):
            return default

    def end_headers(self):
        # default CORS for static responses too (helps when running headless tests)
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    # --- routing --------------------------------------------------------

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.OK)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        api = self._api_get_route(path)
        if api:
            try:
                api()
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        api = self._api_post_route(path)
        if api:
            try:
                api()
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        self._send_json({"ok": False, "error": "Not found"}, HTTPStatus.NOT_FOUND)

    def _api_get_route(self, path):
        return {
            "/api/get_features.php":    self.api_get_features,
            "/api/get_preferences.php": self.api_get_preferences,
            "/api/get_history.php":     self.api_get_history,
        }.get(path)

    def _api_post_route(self, path):
        return {
            "/api/save_preferences.php": self.api_save_preferences,
            "/api/save_detection.php":   self.api_save_detection,
            "/api/save_gesture.php":     self.api_save_gesture,
            "/api/save_tts.php":         self.api_save_tts,
            "/api/log_usage.php":        self.api_log_usage,
        }.get(path)

    # --- API endpoints --------------------------------------------------

    def api_get_features(self):
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT feature_id, name, description FROM Feature ORDER BY feature_id"
            ).fetchall()
        finally:
            conn.close()
        self._send_json({"ok": True, "features": [dict(r) for r in rows]})

    def api_get_preferences(self):
        user_id = self._qs_int("user_id", 1)
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT * FROM UserPreference WHERE user_id = ? LIMIT 1",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
        self._send_json({"ok": True, "preferences": dict(row) if row else None})

    def api_get_history(self):
        user_id = self._qs_int("user_id", 1)
        limit = max(1, min(100, self._qs_int("limit", 20)))
        conn = get_db()
        try:
            usage = conn.execute(
                """
                SELECT l.log_id, l.timestamp, l.duration_sec, f.name AS feature
                FROM UsageLog l
                JOIN Feature f ON f.feature_id = l.feature_id
                WHERE l.user_id = ?
                ORDER BY l.timestamp DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
            detections = conn.execute(
                """
                SELECT detection_id, timestamp, object_count, description
                FROM DetectionResult
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
            gestures = conn.execute(
                """
                SELECT gesture_id, gesture_label, confidence, created_at
                FROM GestureHistory
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
            tts = conn.execute(
                """
                SELECT tts_id, text_preview, voice, played_at
                FROM TTSHistory
                WHERE user_id = ?
                ORDER BY played_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        finally:
            conn.close()
        self._send_json({
            "ok":         True,
            "user_id":    user_id,
            "usage":      [dict(r) for r in usage],
            "detections": [dict(r) for r in detections],
            "gestures":   [dict(r) for r in gestures],
            "tts":        [dict(r) for r in tts],
        })

    def api_save_preferences(self):
        d = self._read_json()
        user_id       = int(d.get("user_id") or 1)
        high_contrast = 1 if d.get("high_contrast") else 0
        text_size     = int(d.get("text_size") or 100)
        voice         = d.get("preferred_voice")
        rate          = float(d.get("speech_rate") or 1.0)
        pitch         = float(d.get("pitch") or 1.0)

        conn = get_db()
        try:
            conn.execute(
                """
                INSERT INTO UserPreference
                    (user_id, high_contrast, text_size, preferred_voice, speech_rate, pitch)
                VALUES (?,?,?,?,?,?)
                ON CONFLICT(user_id) DO UPDATE SET
                    high_contrast   = excluded.high_contrast,
                    text_size       = excluded.text_size,
                    preferred_voice = excluded.preferred_voice,
                    speech_rate     = excluded.speech_rate,
                    pitch           = excluded.pitch,
                    updated_at      = CURRENT_TIMESTAMP
                """,
                (user_id, high_contrast, text_size, voice, rate, pitch),
            )
            conn.commit()
        finally:
            conn.close()
        self._send_json({"ok": True, "message": "Preferences saved."})

    def api_save_detection(self):
        d = self._read_json()
        user_id     = int(d.get("user_id") or 1)
        description = d.get("description") or ""
        objects     = d.get("objects") or []

        conn = get_db()
        try:
            cur = conn.execute(
                "INSERT INTO DetectionResult (user_id, object_count, description) VALUES (?,?,?)",
                (user_id, len(objects), description),
            )
            detection_id = cur.lastrowid
            for o in objects:
                bbox = o.get("bbox") or [0, 0, 0, 0]
                conn.execute(
                    """
                    INSERT INTO DetectedObject
                        (detection_id, class_name, confidence, bbox_x, bbox_y, bbox_w, bbox_h)
                    VALUES (?,?,?,?,?,?,?)
                    """,
                    (
                        detection_id,
                        o.get("class") or "unknown",
                        float(o.get("score") or 0),
                        int(bbox[0] if len(bbox) > 0 else 0),
                        int(bbox[1] if len(bbox) > 1 else 0),
                        int(bbox[2] if len(bbox) > 2 else 0),
                        int(bbox[3] if len(bbox) > 3 else 0),
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        self._send_json({"ok": True, "detection_id": detection_id})

    def api_save_gesture(self):
        d = self._read_json()
        user_id    = int(d.get("user_id") or 1)
        label      = d.get("gesture_label") or "unknown"
        confidence = float(d.get("confidence") or 0)

        conn = get_db()
        try:
            cur = conn.execute(
                "INSERT INTO GestureHistory (user_id, gesture_label, confidence) VALUES (?,?,?)",
                (user_id, label, confidence),
            )
            conn.commit()
            gesture_id = cur.lastrowid
        finally:
            conn.close()
        self._send_json({"ok": True, "gesture_id": gesture_id})

    def api_save_tts(self):
        d = self._read_json()
        user_id = int(d.get("user_id") or 1)
        text    = str(d.get("text") or "")
        voice   = d.get("voice")
        rate    = float(d.get("speech_rate") or 1.0)
        pitch   = float(d.get("pitch") or 1.0)
        preview = text[:200]

        conn = get_db()
        try:
            cur = conn.execute(
                """
                INSERT INTO TTSHistory (user_id, text_preview, voice, speech_rate, pitch)
                VALUES (?,?,?,?,?)
                """,
                (user_id, preview, voice, rate, pitch),
            )
            conn.commit()
            tts_id = cur.lastrowid
        finally:
            conn.close()
        self._send_json({"ok": True, "tts_id": tts_id})

    def api_log_usage(self):
        d = self._read_json()
        user_id  = int(d.get("user_id") or 1)
        feature  = d.get("feature") or "unknown"
        duration = int(d.get("duration_sec") or 0)

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT feature_id FROM Feature WHERE name = ? LIMIT 1",
                (feature,),
            ).fetchone()
            if not row:
                self._send_json(
                    {"ok": False, "error": f"Feature '{feature}' not found"},
                    HTTPStatus.NOT_FOUND,
                )
                return
            cur = conn.execute(
                "INSERT INTO UsageLog (user_id, feature_id, duration_sec) VALUES (?,?,?)",
                (user_id, row["feature_id"], duration),
            )
            conn.commit()
            log_id = cur.lastrowid
        finally:
            conn.close()
        self._send_json({"ok": True, "log_id": log_id})


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    init_db()
    with http.server.ThreadingHTTPServer((HOST, PORT), LuminaHandler) as httpd:
        url = f"http://{HOST}:{PORT}/"
        print(f"Lumina is running. Open {url} in your browser. Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")
            sys.exit(0)


if __name__ == "__main__":
    main()