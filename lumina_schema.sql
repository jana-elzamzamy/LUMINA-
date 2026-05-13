-- =====================================================================
-- Lumina - Database Schema
-- Target: MySQL 5.7+ / MariaDB 10+
-- Usage:
--   1. Open XAMPP -> Start Apache + MySQL
--   2. Open phpMyAdmin (http://localhost/phpmyadmin)
--   3. Import this file OR paste it into the SQL tab
-- =====================================================================

DROP DATABASE IF EXISTS lumina_db;
CREATE DATABASE lumina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lumina_db;

-- ---------------------------------------------------------------------
-- 1. USER
-- ---------------------------------------------------------------------
CREATE TABLE User (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(80)  NOT NULL,
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    user_type       ENUM('blind','deaf','elderly','reading_difficulty','caregiver','admin','guest')
                    NOT NULL DEFAULT 'guest',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. USER PREFERENCE (1-to-1 with User)
-- ---------------------------------------------------------------------
CREATE TABLE UserPreference (
    pref_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE,
    high_contrast   BOOLEAN      NOT NULL DEFAULT FALSE,
    text_size       TINYINT      NOT NULL DEFAULT 100,
    preferred_voice VARCHAR(80),
    speech_rate     FLOAT        NOT NULL DEFAULT 1.0,
    pitch           FLOAT        NOT NULL DEFAULT 1.0,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. FEATURE (lookup)
-- ---------------------------------------------------------------------
CREATE TABLE Feature (
    feature_id      INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL UNIQUE,
    description     TEXT
);

-- ---------------------------------------------------------------------
-- 4. AI MODEL
-- ---------------------------------------------------------------------
CREATE TABLE AIModel (
    model_id        INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    version         VARCHAR(20)  NOT NULL,
    url             VARCHAR(255) NOT NULL,
    loaded_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. USAGE LOG
-- ---------------------------------------------------------------------
CREATE TABLE UsageLog (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    feature_id      INT NOT NULL,
    timestamp       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_sec    INT,
    FOREIGN KEY (user_id)    REFERENCES User(user_id)    ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES Feature(feature_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------
-- 6. DETECTION RESULT (1 image -> N objects)
-- ---------------------------------------------------------------------
CREATE TABLE DetectionResult (
    detection_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    timestamp       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_path      VARCHAR(255),
    object_count    INT NOT NULL DEFAULT 0,
    description     TEXT,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

CREATE TABLE DetectedObject (
    object_id       INT AUTO_INCREMENT PRIMARY KEY,
    detection_id    INT NOT NULL,
    class_name      VARCHAR(50)  NOT NULL,
    confidence      FLOAT        NOT NULL,
    bbox_x          INT,
    bbox_y          INT,
    bbox_w          INT,
    bbox_h          INT,
    FOREIGN KEY (detection_id) REFERENCES DetectionResult(detection_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 7. GESTURE HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE GestureHistory (
    gesture_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    gesture_label   VARCHAR(50)  NOT NULL,
    confidence      FLOAT        NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 8. TTS HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE TTSHistory (
    tts_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    text_preview    VARCHAR(200),
    voice           VARCHAR(80),
    speech_rate     FLOAT        NOT NULL DEFAULT 1.0,
    pitch           FLOAT        NOT NULL DEFAULT 1.0,
    played_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 9. BUILDING / ROOM / CONNECTION / QR
-- ---------------------------------------------------------------------
CREATE TABLE Building (
    building_id     INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    address         VARCHAR(200),
    floors          INT NOT NULL DEFAULT 1
);

CREATE TABLE Room (
    room_id         INT AUTO_INCREMENT PRIMARY KEY,
    building_id     INT NOT NULL,
    name            VARCHAR(50)  NOT NULL,
    x_coord         INT,
    y_coord         INT,
    room_type       VARCHAR(30),
    FOREIGN KEY (building_id) REFERENCES Building(building_id) ON DELETE CASCADE
);

CREATE TABLE RoomConnection (
    connection_id   INT AUTO_INCREMENT PRIMARY KEY,
    room_from       INT NOT NULL,
    room_to         INT NOT NULL,
    distance_m      FLOAT        NOT NULL DEFAULT 1.0,
    direction       VARCHAR(20),
    FOREIGN KEY (room_from) REFERENCES Room(room_id) ON DELETE CASCADE,
    FOREIGN KEY (room_to)   REFERENCES Room(room_id) ON DELETE CASCADE
);

CREATE TABLE QRCode (
    qr_id           INT AUTO_INCREMENT PRIMARY KEY,
    room_id         INT NOT NULL,
    qr_value        VARCHAR(100) NOT NULL UNIQUE,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES Room(room_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 10. NAVIGATION SESSION
-- ---------------------------------------------------------------------
CREATE TABLE NavigationSession (
    session_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    start_room      INT NOT NULL,
    end_room        INT NOT NULL,
    started_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME,
    FOREIGN KEY (user_id)    REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (start_room) REFERENCES Room(room_id) ON DELETE RESTRICT,
    FOREIGN KEY (end_room)   REFERENCES Room(room_id) ON DELETE RESTRICT
);

-- =====================================================================
-- SAMPLE DATA
-- =====================================================================

-- Users (password is plain 'demo123' hashed with PHP password_hash - you can use any hash)
INSERT INTO User (name, email, password_hash, user_type) VALUES
 ('Guest User',          'guest@lumina.local', 'guest_no_password', 'guest'),
 ('Esraa Mohsen',        'esraa@lumina.local', '$2y$10$demo.hash.placeholder.value.here.00000', 'admin'),
 ('Jana Ahmed',          'jana@lumina.local',  '$2y$10$demo.hash.placeholder.value.here.11111', 'admin'),
 ('Ahmed (Blind User)',  'ahmed@demo.local',   '$2y$10$demo.hash.placeholder.value.here.22222', 'blind'),
 ('Sara (Deaf User)',    'sara@demo.local',    '$2y$10$demo.hash.placeholder.value.here.33333', 'deaf');

-- Default preferences for each user
INSERT INTO UserPreference (user_id, high_contrast, text_size, preferred_voice, speech_rate, pitch) VALUES
 (1, FALSE, 100, NULL, 1.0, 1.0),
 (2, FALSE, 110, 'Google US English', 1.0, 1.0),
 (3, TRUE,  120, 'Google US English', 0.9, 1.0),
 (4, TRUE,  130, 'Google US English', 0.8, 1.0),
 (5, FALSE, 100, NULL, 1.0, 1.0);

-- Features
INSERT INTO Feature (name, description) VALUES
 ('image_description', 'Detect objects in an image and describe them with speech.'),
 ('indoor_navigation', 'QR-based indoor navigation with voice directions.'),
 ('sign_translation',  'Translate sign-language hand gestures into text.'),
 ('text_to_speech',    'Read any typed text or file aloud.'),
 ('accessibility',     'High contrast and text-size preferences.');

-- AI Models currently in use
INSERT INTO AIModel (name, version, url) VALUES
 ('COCO-SSD',  '2.2.2', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd'),
 ('Handpose',  '0.0.7', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose'),
 ('jsQR',      '1.4.0', 'https://cdn.jsdelivr.net/npm/jsqr');

-- Building + Rooms (matches navigation.js in-memory graph)
INSERT INTO Building (name, address, floors) VALUES
 ('Lumina Demo Building', '123 Main Street', 1);

INSERT INTO Room (building_id, name, x_coord, y_coord, room_type) VALUES
 (1, 'Entrance',   100, 500, 'entrance'),
 (1, 'Lobby',      300, 500, 'lobby'),
 (1, 'Room A',     500, 300, 'office'),
 (1, 'Room B',     500, 500, 'office'),
 (1, 'Room C',     500, 700, 'office'),
 (1, 'Elevator',   700, 500, 'elevator');

INSERT INTO RoomConnection (room_from, room_to, distance_m, direction) VALUES
 (1,2,5.0,'forward'), (2,1,5.0,'backward'),
 (2,3,4.0,'right'),   (3,2,4.0,'left'),
 (2,4,4.0,'forward'), (4,2,4.0,'backward'),
 (2,5,4.0,'left'),    (5,2,4.0,'right'),
 (2,6,6.0,'forward'), (6,2,6.0,'backward');

INSERT INTO QRCode (room_id, qr_value) VALUES
 (1,'QR-ENTRANCE'),
 (2,'QR-LOBBY'),
 (3,'QR-ROOM-A'),
 (4,'QR-ROOM-B'),
 (5,'QR-ROOM-C'),
 (6,'QR-ELEVATOR');

-- Sample activity
INSERT INTO UsageLog (user_id, feature_id, duration_sec) VALUES
 (4,1,12), (4,4,45), (5,3,30), (3,5,2);

INSERT INTO GestureHistory (user_id, gesture_label, confidence) VALUES
 (5,'open_hand',0.94),
 (5,'thumbs_up',0.89),
 (5,'peace',0.91);

-- Done.
SELECT 'Lumina database created successfully.' AS status;
