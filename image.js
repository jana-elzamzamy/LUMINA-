/* ============================================
   LUMINA — Image Description
   Uses TensorFlow.js + COCO-SSD (80-class
   object detector) running in the browser.
   ============================================ */

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const dropzone   = $("#dropzone");
  const fileInput  = $("#file-input");
  const video      = $("#video");
  const preview    = $("#preview");
  const overlay    = $("#overlay");
  const hint       = $("#hint");
  const statusEl   = $("#status");
  const statusText = $("#status-text");
  const descBox    = $("#description");
  const detected   = $("#detected");
  const speakBtn   = $("#speak-btn");
  const stopSpeak  = $("#stop-speak-btn");
  const camBtn     = $("#camera-btn");
  const captureBtn = $("#capture-btn");
  const stopCamBtn = $("#stop-cam-btn");

  let model = null;
  let stream = null;
  let currentDescription = "";

  /* ---------- Status helpers ---------- */
  function setStatus(state, msg) {
    statusEl.classList.remove("is-loading", "is-ready", "is-error");
    if (state) statusEl.classList.add(`is-${state}`);
    statusText.textContent = msg;
  }

  /* ---------- Load model ---------- */
  async function loadModel() {
    if (model) return model;
    setStatus("loading", "Loading AI model (first time ~5-10s)…");
    try {
      model = await cocoSsd.load({ base: "mobilenet_v2" });
      setStatus("ready", "Model ready");
      return model;
    } catch (err) {
      console.error(err);
      setStatus("error", "Failed to load model. Check your internet connection.");
      throw err;
    }
  }

  /* ---------- File upload ---------- */
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-drag"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-drag");
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  });
  fileInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      setStatus("error", "Please select an image file.");
      return;
    }
    stopCamera();
    const url = URL.createObjectURL(file);
    preview.onload = () => {
      URL.revokeObjectURL(url);
      preview.hidden = false;
      hint.hidden = true;
      runDetection(preview);
    };
    preview.src = url;
  }

  /* ---------- Camera ---------- */
  camBtn.addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = stream;
      video.hidden = false;
      preview.hidden = true;
      hint.hidden = true;
      captureBtn.hidden = false;
      stopCamBtn.hidden = false;
      camBtn.hidden = true;
    } catch (err) {
      setStatus("error", "Could not access camera. Check browser permissions.");
    }
  });

  captureBtn.addEventListener("click", () => {
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    preview.src = dataUrl;
    preview.onload = () => {
      preview.hidden = false;
      video.hidden = true;
      stopCamera();
      runDetection(preview);
    };
  });

  stopCamBtn.addEventListener("click", stopCamera);

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.hidden = true;
    captureBtn.hidden = true;
    stopCamBtn.hidden = true;
    camBtn.hidden = false;
  }

  /* ---------- Detection ---------- */
  async function runDetection(imgEl) {
    try {
      await loadModel();
      setStatus("loading", "Analyzing image…");

      const predictions = await model.detect(imgEl, 20, 0.25);
      drawBoxes(imgEl, predictions);

      const description = composeDescription(predictions);
      currentDescription = description;
      descBox.textContent = description;

      detected.innerHTML = "";
      const counts = {};
      predictions.forEach((p) => {
        counts[p.class] = (counts[p.class] || 0) + 1;
      });
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, n]) => {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = n > 1 ? `${n} × ${name}` : name;
          detected.appendChild(chip);
        });

      setStatus("ready", `Found ${predictions.length} object${predictions.length === 1 ? "" : "s"}`);
      speakBtn.disabled = false;

      // Auto-speak the result
      window.LuminaTTS?.speak(description);
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong while analyzing.");
    }
  }

  function drawBoxes(imgEl, predictions) {
    const rect = imgEl.getBoundingClientRect();
    const ratio = imgEl.naturalWidth
      ? Math.min(rect.width / imgEl.naturalWidth, rect.height / imgEl.naturalHeight)
      : 1;
    const w = (imgEl.naturalWidth || imgEl.videoWidth) * ratio;
    const h = (imgEl.naturalHeight || imgEl.videoHeight) * ratio;
    overlay.width = imgEl.parentElement.clientWidth;
    overlay.height = imgEl.parentElement.clientHeight;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const offsetX = (overlay.width - w) / 2;
    const offsetY = (overlay.height - h) / 2;

    predictions.forEach((p, i) => {
      const [x, y, bw, bh] = p.bbox;
      const px = offsetX + x * ratio;
      const py = offsetY + y * ratio;
      const pw = bw * ratio;
      const ph = bh * ratio;

      const hue = (i * 57) % 360;
      ctx.strokeStyle = `hsl(${hue}, 90%, 65%)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);

      const label = `${p.class} ${(p.score * 100).toFixed(0)}%`;
      ctx.font = "bold 14px Inter, sans-serif";
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = `hsl(${hue}, 90%, 65%)`;
      ctx.fillRect(px, py - 22, tw, 22);
      ctx.fillStyle = "#000";
      ctx.fillText(label, px + 6, py - 6);
    });
  }

  /* ---------- Describe ---------- */
  function composeDescription(preds) {
    if (!preds.length) return "I couldn't clearly recognize anything in this image. Please try a clearer photo.";

    // Count by class
    const counts = {};
    preds.forEach((p) => { counts[p.class] = (counts[p.class] || 0) + 1; });

    // Word out counts
    const parts = Object.entries(counts).map(([name, n]) => {
      if (n === 1) {
        const article = /^[aeiou]/i.test(name) ? "an" : "a";
        return `${article} ${name}`;
      }
      return `${numberWord(n)} ${pluralize(name)}`;
    });

    // Position of the largest object
    const biggest = [...preds].sort((a, b) => (b.bbox[2] * b.bbox[3]) - (a.bbox[2] * a.bbox[3]))[0];
    const pos = describePosition(biggest);

    let sentence;
    if (parts.length === 1) {
      sentence = `I can see ${parts[0]} ${pos}.`;
    } else if (parts.length === 2) {
      sentence = `I can see ${parts[0]} and ${parts[1]}. The ${biggest.class} is ${pos}.`;
    } else {
      const last = parts.pop();
      sentence = `I can see ${parts.join(", ")}, and ${last}. The ${biggest.class} is ${pos}.`;
    }
    return sentence;
  }

  function pluralize(word) {
    if (word.endsWith("s")) return word;
    if (word.endsWith("y")) return word.slice(0, -1) + "ies";
    if (/(sh|ch|x|z)$/.test(word)) return word + "es";
    return word + "s";
  }

  function numberWord(n) {
    const words = ["zero","one","two","three","four","five","six","seven","eight","nine","ten"];
    return words[n] || String(n);
  }

  function describePosition(pred) {
    const [x, y, w, h] = pred.bbox;
    const target = pred.target || null;
    const imgW = (target?.naturalWidth) || preview.naturalWidth || video.videoWidth || 640;
    const imgH = (target?.naturalHeight) || preview.naturalHeight || video.videoHeight || 480;
    const cx = (x + w / 2) / imgW;
    const cy = (y + h / 2) / imgH;

    let hPart = "in the center";
    if (cx < 0.35) hPart = "on the left";
    else if (cx > 0.65) hPart = "on the right";

    let vPart = "";
    if (cy < 0.35) vPart = "toward the top";
    else if (cy > 0.65) vPart = "toward the bottom";

    return vPart ? `${hPart} ${vPart}` : hPart;
  }

  /* ---------- Speak controls ---------- */
  speakBtn.addEventListener("click", () => {
    if (currentDescription) window.LuminaTTS?.speak(currentDescription);
  });
  stopSpeak.addEventListener("click", () => window.LuminaTTS?.stop());

  /* ---------- Warm up ---------- */
  window.addEventListener("load", () => {
    setStatus("", "Click anywhere in the upload area or use the camera.");
    // Pre-load the model in the background so it's fast when user is ready
    loadModel().catch(() => {});
  });
})();
