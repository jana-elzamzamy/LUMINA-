/* ============================================
   LUMINA — shared JS
   - Mobile nav toggle
   - Active nav link
   - Contrast / text-size toggles (persisted)
   - Global TTS helper (window.LuminaTTS)
   - Card hover glow
   ============================================ */

(function () {
  "use strict";

  /* ---------- 1. Mobile nav toggle ---------- */
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- 2. Active nav link ---------- */
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === here || (here === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  /* ---------- 3. Accessibility toggles ---------- */
  const root = document.documentElement;
  // Load persisted prefs
  try {
    const contrast = localStorage.getItem("lumina-contrast");
    const textsize = localStorage.getItem("lumina-textsize");
    if (contrast) root.setAttribute("data-contrast", contrast);
    if (textsize) root.setAttribute("data-textsize", textsize);
  } catch (e) {}

  const contrastBtn = document.querySelector("[data-toggle='contrast']");
  if (contrastBtn) {
    const sync = () =>
      contrastBtn.classList.toggle("active", root.getAttribute("data-contrast") === "high");
    sync();
    contrastBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-contrast") === "high" ? "" : "high";
      if (next) root.setAttribute("data-contrast", next);
      else root.removeAttribute("data-contrast");
      try { localStorage.setItem("lumina-contrast", next); } catch (e) {}
      if (window.LuminaAPI) {
        const size = parseInt(root.getAttribute("data-textsize") === "xlarge" ? 130
                    : root.getAttribute("data-textsize") === "large" ? 115 : 100, 10);
        window.LuminaAPI.savePreferences({ high_contrast: next === "high", text_size: size });
      }
      sync();
    });
  }

  const textBtn = document.querySelector("[data-toggle='textsize']");
  if (textBtn) {
    const order = ["", "large", "xlarge"];
    const sync = () =>
      textBtn.classList.toggle("active", !!root.getAttribute("data-textsize"));
    sync();
    textBtn.addEventListener("click", () => {
      const cur = root.getAttribute("data-textsize") || "";
      const next = order[(order.indexOf(cur) + 1) % order.length];
      if (next) root.setAttribute("data-textsize", next);
      else root.removeAttribute("data-textsize");
      try { localStorage.setItem("lumina-textsize", next); } catch (e) {}
      if (window.LuminaAPI) {
        const size = next === "xlarge" ? 130 : next === "large" ? 115 : 100;
        const hc = root.getAttribute("data-contrast") === "high";
        window.LuminaAPI.savePreferences({ high_contrast: hc, text_size: size });
      }
      sync();
    });
  }

  /* ---------- 4. Card hover glow tracking ---------- */
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- 5. Global TTS helper ---------- */
  const synth = window.speechSynthesis;
  const LuminaTTS = {
    available: !!synth,
    _voices: [],
    loadVoices() {
      if (!synth) return [];
      this._voices = synth.getVoices();
      return this._voices;
    },
    pickVoice(lang = "en") {
      if (!this._voices.length) this.loadVoices();
      const match = this._voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
      return match || this._voices[0] || null;
    },
    speak(text, opts = {}) {
      if (!synth || !text) return null;
      try { synth.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance(String(text));
      const v = opts.voice || this.pickVoice(opts.lang || "en");
      if (v) u.voice = v;
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.volume = opts.volume ?? 1;
      if (opts.onend) u.onend = opts.onend;
      if (opts.onstart) u.onstart = opts.onstart;
      if (opts.onerror) u.onerror = opts.onerror;
      synth.speak(u);
      return u;
    },
    pause() { try { synth && synth.pause(); } catch (e) {} },
    resume() { try { synth && synth.resume(); } catch (e) {} },
    stop() { try { synth && synth.cancel(); } catch (e) {} },
  };

  if (synth) {
    LuminaTTS.loadVoices();
    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = () => LuminaTTS.loadVoices();
    }
  }
  window.LuminaTTS = LuminaTTS;

  /* ---------- 6. Reveal-on-scroll ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  }
})();
