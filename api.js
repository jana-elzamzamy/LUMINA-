/* =========================================================
   LUMINA — API client
   Wraps fetch() calls to the PHP backend in /api/*.
   Falls back silently if the backend is offline so the site
   still works as a static demo.
   ========================================================= */

(function () {
  "use strict";

  const API_BASE = "api"; // relative path; works under XAMPP htdocs/Lumina-Website/
  const DEFAULT_USER_ID = 1; // guest user (see lumina_schema.sql)

  async function safeFetch(url, options) {
    try {
      const r = await fetch(url, options);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (err) {
      console.warn("[LuminaAPI] offline fallback:", err.message);
      return { ok: false, offline: true, error: err.message };
    }
  }

  const LuminaAPI = {
    userId: DEFAULT_USER_ID,

    async savePreferences(prefs) {
      return safeFetch(API_BASE + "/save_preferences.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ user_id: this.userId }, prefs)),
      });
    },

    async getPreferences() {
      return safeFetch(API_BASE + "/get_preferences.php?user_id=" + this.userId);
    },

    async saveDetection(description, objects) {
      return safeFetch(API_BASE + "/save_detection.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: this.userId, description, objects }),
      });
    },

    async saveGesture(label, confidence) {
      return safeFetch(API_BASE + "/save_gesture.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: this.userId,
          gesture_label: label,
          confidence: confidence,
        }),
      });
    },

    async logUsage(featureName, durationSec) {
      return safeFetch(API_BASE + "/log_usage.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: this.userId,
          feature: featureName,
          duration_sec: durationSec || 0,
        }),
      });
    },

    async saveTTS(text, voice, speechRate, pitch) {
      return safeFetch(API_BASE + "/save_tts.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: this.userId,
          text: text,
          voice: voice,
          speech_rate: speechRate,
          pitch: pitch,
        }),
      });
    },

    async getFeatures() {
      return safeFetch(API_BASE + "/get_features.php");
    },

    async getHistory(limit) {
      const q = "?user_id=" + this.userId + (limit ? "&limit=" + limit : "");
      return safeFetch(API_BASE + "/get_history.php" + q);
    },
  };

  window.LuminaAPI = LuminaAPI;
})();
