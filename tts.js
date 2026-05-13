/* ============================================
   LUMINA — Read Aloud (Text to Speech)
   Uses the Web Speech API (SpeechSynthesis).
   ============================================ */

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const textInput  = $("#text-input");
  const fileDrop   = $("#file-drop");
  const fileInput  = $("#file-input");
  const voiceSel   = $("#voice-select");
  const rate       = $("#rate");
  const pitch      = $("#pitch");
  const rateVal    = $("#rate-val");
  const pitchVal   = $("#pitch-val");
  const playBtn    = $("#play-btn");
  const pauseBtn   = $("#pause-btn");
  const resumeBtn  = $("#resume-btn");
  const stopBtn    = $("#stop-btn");
  const statusEl   = $("#status");
  const statusText = $("#status-text");

  const synth = window.speechSynthesis;

  function setStatus(state, msg) {
    statusEl.classList.remove("is-loading", "is-ready", "is-error");
    if (state) statusEl.classList.add(`is-${state}`);
    statusText.textContent = msg;
  }

  if (!synth) {
    setStatus("error", "Your browser does not support speech synthesis.");
    [playBtn, pauseBtn, resumeBtn, stopBtn].forEach((b) => (b.disabled = true));
    return;
  }

  /* ---------- Populate voices ---------- */
  function populateVoices() {
    const voices = synth.getVoices();
    voiceSel.innerHTML = "";
    if (!voices.length) {
      const opt = document.createElement("option");
      opt.textContent = "Default voice";
      voiceSel.appendChild(opt);
      return;
    }
    // Prefer English voices at the top
    voices
      .slice()
      .sort((a, b) => {
        const ae = a.lang?.startsWith("en") ? 0 : 1;
        const be = b.lang?.startsWith("en") ? 0 : 1;
        if (ae !== be) return ae - be;
        return a.name.localeCompare(b.name);
      })
      .forEach((v, i) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})${v.default ? " — default" : ""}`;
        voiceSel.appendChild(opt);
      });
  }
  populateVoices();
  if (typeof synth.onvoiceschanged !== "undefined") {
    synth.onvoiceschanged = populateVoices;
  }

  /* ---------- Sliders ---------- */
  const syncVals = () => {
    rateVal.textContent = Number(rate.value).toFixed(2);
    pitchVal.textContent = Number(pitch.value).toFixed(2);
  };
  rate.addEventListener("input", syncVals);
  pitch.addEventListener("input", syncVals);
  syncVals();

  /* ---------- File upload ---------- */
  fileDrop.addEventListener("click", () => fileInput.click());
  fileDrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileDrop.addEventListener("dragover", (e) => { e.preventDefault(); fileDrop.classList.add("is-drag"); });
  fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("is-drag"));
  fileDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    fileDrop.classList.remove("is-drag");
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  });
  fileInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) readFile(f);
  });

  function readFile(f) {
    const reader = new FileReader();
    reader.onload = () => {
      textInput.value = reader.result || "";
      setStatus("ready", `Loaded "${f.name}"`);
    };
    reader.onerror = () => setStatus("error", "Could not read file.");
    reader.readAsText(f);
  }

  /* ---------- Play controls ---------- */
  playBtn.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (!text) {
      setStatus("error", "Please enter some text first.");
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const selName = voiceSel.value;
    const v = synth.getVoices().find((x) => x.name === selName);
    if (v) u.voice = v;
    u.rate = Number(rate.value);
    u.pitch = Number(pitch.value);
    u.onstart = () => setStatus("loading", "Speaking…");
    u.onend   = () => setStatus("ready", "Finished");
    u.onerror = () => setStatus("error", "Speech error");
    synth.speak(u);

    if (window.LuminaAPI) {
      window.LuminaAPI.saveTTS(text, selName || null, u.rate, u.pitch);
      window.LuminaAPI.logUsage("text_to_speech", 0);
    }
  });

  pauseBtn.addEventListener("click", () => {
    synth.pause();
    setStatus("", "Paused");
  });
  resumeBtn.addEventListener("click", () => {
    synth.resume();
    setStatus("loading", "Speaking…");
  });
  stopBtn.addEventListener("click", () => {
    synth.cancel();
    setStatus("ready", "Stopped");
  });

  setStatus("ready", "Ready");
})();
