/* ============================================
   LUMINA — Sign Language Translation
   Uses TensorFlow.js Handpose to detect 21 hand
   landmarks, then classifies a small set of
   gestures based on which fingers are extended.
   ============================================ */

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const video      = $("#video");
  const canvas     = $("#canvas");
  const hint       = $("#hint");
  const statusEl   = $("#status");
  const statusText = $("#status-text");
  const currentEl  = $("#current-sign");
  const historyEl  = $("#history");
  const startBtn   = $("#start-btn");
  const stopBtn    = $("#stop-btn");
  const speakBtn   = $("#speak-btn");
  const clearBtn   = $("#clear-btn");

  let model = null;
  let stream = null;
  let running = false;
  let rafId = null;
  let history = [];
  let lastSign = null;
  let lastSignAt = 0;

  // Rolling buffer of recent classifications for smoothing
  const SMOOTH_WINDOW = 8;        // frames to consider
  const SMOOTH_MIN_VOTES = 5;     // need this many matching frames
  const HOLD_MS = 500;            // how long the smoothed sign must persist
  const REPEAT_COOLDOWN_MS = 1200;
  let smoothBuf = [];

  function setStatus(state, msg) {
    statusEl.classList.remove("is-loading", "is-ready", "is-error");
    if (state) statusEl.classList.add(`is-${state}`);
    statusText.textContent = msg;
  }

  /* ---------- Load model ---------- */
  async function loadModel() {
    if (model) return model;
    setStatus("loading", "Loading Handpose model (first time ~10s)…");
    try {
      await tf.setBackend("webgl");
      await tf.ready();
      model = await handpose.load();
      setStatus("ready", "Model ready");
      return model;
    } catch (err) {
      console.error(err);
      setStatus("error", "Failed to load model. Check your internet connection.");
      throw err;
    }
  }

  /* ---------- Camera ---------- */
  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);

  async function start() {
    try {
      await loadModel();
      setStatus("loading", "Starting camera…");

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });

      video.srcObject = stream;
      video.hidden = false;
      hint.hidden = true;
      startBtn.hidden = true;
      stopBtn.hidden = false;

      // Wait for video metadata (race-safe: check readyState first)
      if (video.readyState < 1) {
        await new Promise((resolve, reject) => {
          video.addEventListener("loadedmetadata", resolve, { once: true });
          video.addEventListener("error", reject, { once: true });
        });
      }

      await video.play();

      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;

      running = true;
      setStatus("ready", "Camera running");
      loop();
    } catch (err) {
      console.error("Camera start failed:", err);
      setStatus("error", "Could not access camera: " + (err.message || err.name || "unknown"));
      // Reset UI so user can try again
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      video.hidden = true;
      hint.hidden = false;
      startBtn.hidden = false;
      stopBtn.hidden = true;
    }
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.hidden = true;
    startBtn.hidden = false;
    stopBtn.hidden = true;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    currentEl.textContent = "—";
    setStatus("ready", "Camera stopped");
  }

  /* ---------- Main loop ---------- */
  async function loop() {
    if (!running) return;
    try {
      const predictions = await model.estimateHands(video, true);
      draw(predictions);

      if (predictions.length > 0) {
        const hand = predictions[0];
        const fingers = fingerStates(hand.landmarks);
        const raw = classify(fingers);

        // Push raw classification into rolling buffer
        smoothBuf.push(raw.key);
        if (smoothBuf.length > SMOOTH_WINDOW) smoothBuf.shift();

        // Majority vote — find the most common key in the buffer
        const counts = {};
        for (const k of smoothBuf) counts[k] = (counts[k] || 0) + 1;
        let topKey = raw.key, topVotes = 0;
        for (const k in counts) if (counts[k] > topVotes) { topKey = k; topVotes = counts[k]; }

        // Use the smoothed sign only if it has enough votes; otherwise keep showing raw
        const stable = topVotes >= SMOOTH_MIN_VOTES ? signFromKey(topKey) : raw;
        currentEl.textContent = stable.emoji + " " + stable.label;

        // Add to history only when smoothed sign is held steadily
        const now = Date.now();
        if (topVotes >= SMOOTH_MIN_VOTES && stable.label !== "Thinking…") {
          if (stable.key === lastSign) {
            if (now - lastSignAt > HOLD_MS && history[history.length - 1] !== stable.label) {
              history.push(stable.label);
              renderHistory();
              window.LuminaTTS?.speak(stable.label);
              lastSignAt = now + REPEAT_COOLDOWN_MS;
            }
          } else {
            lastSign = stable.key;
            lastSignAt = now;
          }
        }
      } else {
        currentEl.textContent = "—";
        lastSign = null;
        smoothBuf = [];
      }
    } catch (err) {
      console.error(err);
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ---------- Draw landmarks ---------- */
  function draw(predictions) {
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Mirror to match the video (which is mirrored via CSS transform below)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    predictions.forEach((p) => {
      const lm = p.landmarks;
      // Fingers — landmark connections
      const fingers = [
        [0, 1, 2, 3, 4],       // thumb
        [0, 5, 6, 7, 8],       // index
        [0, 9, 10, 11, 12],    // middle
        [0, 13, 14, 15, 16],   // ring
        [0, 17, 18, 19, 20],   // pinky
      ];
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      fingers.forEach((f) => {
        ctx.beginPath();
        for (let i = 0; i < f.length; i++) {
          const [x, y] = lm[f[i]];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      // Joints
      lm.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, i === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#f472b6" : "#a78bfa";
        ctx.fill();
      });
    });
    ctx.restore();
  }

  // Mirror video for natural selfie view
  video.style.transform = "scaleX(-1)";

  /* ---------- Classification ---------- */
  /* For each finger: is the tip farther from the wrist than the PIP joint? */
  function fingerStates(lm) {
    const wrist = lm[0];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

    // Thumb is handled differently (compare x distance relative to palm)
    const thumbTip = lm[4], thumbIp = lm[3], indexMcp = lm[5];
    // extended if tip is farther from index MCP than the IP joint is
    const thumb = dist(thumbTip, indexMcp) > dist(thumbIp, indexMcp) * 1.08;

    const ext = (tip, pip) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.06;
    return {
      thumb,
      index:  ext(8, 6),
      middle: ext(12, 10),
      ring:   ext(16, 14),
      pinky:  ext(20, 18),
    };
  }

  function classify(f) {
    const key = `${+f.thumb}${+f.index}${+f.middle}${+f.ring}${+f.pinky}`;
    return signFromKey(key);
  }

  function signFromKey(key) {
    switch (key) {
      case "11111": return { key, label: "Hello",      emoji: "✋" };
      case "01111": return { key, label: "Hello",      emoji: "✋" }; // open hand, thumb tucked
      case "00000": return { key, label: "Yes (fist)", emoji: "✊" };
      case "10000": return { key, label: "Good",       emoji: "👍" };
      case "01100": return { key, label: "Peace",      emoji: "✌️" };
      case "01000": return { key, label: "One",        emoji: "☝️" };
      case "11001": return { key, label: "I love you", emoji: "🤟" };
      case "01001": return { key, label: "Rock on",    emoji: "🤘" };
      case "11100": return { key, label: "Three",      emoji: "3" };
      default:      return { key, label: "Thinking…",  emoji: "🤔" };
    }
  }

  /* ---------- History ---------- */
  function renderHistory() {
    historyEl.textContent = history.length ? history.join(" · ") : "Your recognized signs will appear here.";
  }

  speakBtn.addEventListener("click", () => {
    if (history.length) window.LuminaTTS?.speak(history.join(". "));
  });
  clearBtn.addEventListener("click", () => {
    history = [];
    renderHistory();
  });

  /* ---------- Init ---------- */
  setStatus("", "Ready to start camera");
  // warm up model in background
  loadModel().catch(() => {});
})();
