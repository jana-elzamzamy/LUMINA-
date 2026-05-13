-- =====================================================================
-- Lumina - Database Schema for Microsoft SQL Server
-- Target: SQL Server 2019+ (also works on SQL Server Express / Developer)
-- Usage:
--   1. Open SQL Server Management Studio (SSMS)
--   2. Connect to your SQL Server (usually "localhost" or ".\SQLEXPRESS")
--   3. File -> Open -> this file
--   4. Click Execute (or press F5)
-- =====================================================================

-- Create the database if it doesn't exist
IF DB_ID('lumina_db') IS NOT NULL
BEGIN
    ALTER DATABASE lumina_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE lumina_db;
END
GO

CREATE DATABASE lumina_db;
GO

USE lumina_db;
GO

-- ---------------------------------------------------------------------
-- 1. USER  ( [User] is a reserved-ish word, so we bracket it )
-- ---------------------------------------------------------------------
CREATE TABLE [User] (
    user_id         INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(80)  NOT NULL,
    email           NVARCHAR(120) NOT NULL UNIQUE,
    password_hash   NVARCHAR(255) NOT NULL,
    user_type       NVARCHAR(30)  NOT NULL DEFAULT 'guest'
        CHECK (user_type IN ('blind','deaf','elderly','reading_difficulty','caregiver','admin','guest')),
    created_at      DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ---------------------------------------------------------------------
-- 2. USER PREFERENCE
-- ---------------------------------------------------------------------
CREATE TABLE UserPreference (
    pref_id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE,
    high_contrast   BIT           NOT NULL DEFAULT 0,
    text_size       TINYINT       NOT NULL DEFAULT 100,
    preferred_voice NVARCHAR(80)  NULL,
    speech_rate     FLOAT         NOT NULL DEFAULT 1.0,
    pitch           FLOAT         NOT NULL DEFAULT 1.0,
    updated_at      DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_UserPreference_User FOREIGN KEY (user_id)
        REFERENCES [User](user_id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- 3. FEATURE
-- ---------------------------------------------------------------------
CREATE TABLE Feature (
    feature_id      INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(50)  NOT NULL UNIQUE,
    description     NVARCHAR(MAX) NULL
);
GO

-- ---------------------------------------------------------------------
-- 4. AI MODEL
-- ---------------------------------------------------------------------
CREATE TABLE AIModel (
    model_id        INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(50)  NOT NULL,
    version         NVARCHAR(20)  NOT NULL,
    url             NVARCHAR(255) NOT NULL,
    loaded_at       DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ---------------------------------------------------------------------
-- 5. USAGE LOG
-- ---------------------------------------------------------------------
CREATE TABLE UsageLog (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    feature_id      INT NOT NULL,
    timestamp       DATETIME NOT NULL DEFAULT GETDATE(),
    duration_sec    INT NULL,
    CONSTRAINT FK_UsageLog_User    FOREIGN KEY (user_id)    REFERENCES [User](user_id)   ON DELETE CASCADE,
    CONSTRAINT FK_UsageLog_Feature FOREIGN KEY (feature_id) REFERENCES Feature(feature_id)
);
GO

-- ---------------------------------------------------------------------
-- 6. DETECTION + DETECTED OBJECTS
-- ---------------------------------------------------------------------
CREATE TABLE DetectionResult (
    detection_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    timestamp       DATETIME      NOT NULL DEFAULT GETDATE(),
    image_path      NVARCHAR(255) NULL,
    object_count    INT NOT NULL DEFAULT 0,
    description     NVARCHAR(MAX) NULL,
    CONSTRAINT FK_DetectionResult_User FOREIGN KEY (user_id)
        REFERENCES [User](user_id) ON DELETE CASCADE
);
GO

CREATE TABLE DetectedObject (
    object_id       INT IDENTITY(1,1) PRIMARY KEY,
    detection_id    INT NOT NULL,
    class_name      NVARCHAR(50)  NOT NULL,
    confidence      FLOAT         NOT NULL,
    bbox_x          INT NULL,
    bbox_y          INT NULL,
    bbox_w          INT NULL,
    bbox_h          INT NULL,
    CONSTRAINT FK_DetectedObject_Detection FOREIGN KEY (detection_id)
        REFERENCES DetectionResult(detection_id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- 7. GESTURE HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE GestureHistory (
    gesture_id      INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    gesture_label   NVARCHAR(50)  NOT NULL,
    confidence      FLOAT         NOT NULL,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_GestureHistory_User FOREIGN KEY (user_id)
        REFERENCES [User](user_id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- 8. TTS HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE TTSHistory (
    tts_id          INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    text_preview    NVARCHAR(200) NULL,
    voice           NVARCHAR(80)  NULL,
    speech_rate     FLOAT         NOT NULL DEFAULT 1.0,
    pitch           FLOAT         NOT NULL DEFAULT 1.0,
    played_at       DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_TTSHistory_User FOREIGN KEY (user_id)
        REFERENCES [User](user_id) ON DELETE CASCADE
);
GO

-- (Navigation tables removed — Building, Room, RoomConnection, QRCode, NavigationSession)

-- =====================================================================
-- SAMPLE DATA
-- =====================================================================

INSERT INTO [User] (name, email, password_hash, user_type) VALUES
 ('Guest User',         'guest@lumina.local', 'guest_no_password', 'guest'),
 ('Esraa Mohsen',       'esraa@lumina.local', 'hash_placeholder_esraa', 'admin'),
 ('Jana Ahmed',         'jana@lumina.local',  'hash_placeholder_jana',  'admin'),
 ('Ahmed (Blind User)', 'ahmed@demo.local',   'hash_placeholder_ahmed', 'blind'),
 ('Sara (Deaf User)',   'sara@demo.local',    'hash_placeholder_sara',  'deaf');
GO

INSERT INTO UserPreference (user_id, high_contrast, text_size, preferred_voice, speech_rate, pitch) VALUES
 (1, 0, 100, NULL,               1.0, 1.0),
 (2, 0, 110, 'Google US English',1.0, 1.0),
 (3, 1, 120, 'Google US English',0.9, 1.0),
 (4, 1, 130, 'Google US English',0.8, 1.0),
 (5, 0, 100, NULL,               1.0, 1.0);
GO

INSERT INTO Feature (name, description) VALUES
 ('image_description', 'Detect objects in an image and describe them with speech.'),

 ('sign_translation',  'Translate sign-language hand gestures into text.'),
 ('text_to_speech',    'Read any typed text or file aloud.'),
 ('accessibility',     'High contrast and text-size preferences.');
GO

INSERT INTO AIModel (name, version, url) VALUES
 ('COCO-SSD',  '2.2.2', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd'),
 ('Handpose',  '0.0.7', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose'),
 ('jsQR',      '1.4.0', 'https://cdn.jsdelivr.net/npm/jsqr');
GO

INSERT INTO UsageLog (user_id, feature_id, duration_sec) VALUES
 (4,1,12), (4,4,45), (5,3,30), (3,5,2);
GO

INSERT INTO GestureHistory (user_id, gesture_label, confidence) VALUES
 (5,'open_hand',0.94),
 (5,'thumbs_up',0.89),
 (5,'peace',0.91);
GO

PRINT 'Lumina database created successfully.';
GO

-- Quick test:
SELECT COUNT(*) AS total_users     FROM [User];
SELECT COUNT(*) AS total_features  FROM Feature;
GO
