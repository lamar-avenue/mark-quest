(() => {
  "use strict";

  const DATA = window.QUIZ_DATA;
  const $ = (sel) => document.querySelector(sel);

  if (!DATA) {
    document.body.innerHTML = `<div style="padding:18px;color:#fff;font-family:Inter,sans-serif">
      Ошибка: не найден window.QUIZ_DATA. Проверь game/data.js
    </div>`;
    return;
  }

  const LS_KEY = "markquest_state_v4";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const safeJSON = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

  const defaultState = () => ({
    started: false,
    levelIndex: 0,
    key: [],
    completed: false,
    audio: { volume: 0.30, muted: false, trackIndex: 0 }
  });

  let state = safeJSON(localStorage.getItem(LS_KEY), null) || defaultState();

  // ---------- Background follows cursor (smooth) ----------
  let tx = window.innerWidth * 0.5, ty = window.innerHeight * 0.3;
  let cx = tx, cy = ty;

  window.addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
  }, { passive: true });

  function bgRaf() {
    cx += (tx - cx) * 0.10;
    cy += (ty - cy) * 0.10;
    document.documentElement.style.setProperty("--mx", cx + "px");
    document.documentElement.style.setProperty("--my", cy + "px");
    requestAnimationFrame(bgRaf);
  }
  bgRaf();

  // ---------- Audio ----------
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = true;

  function applyAudio() {
    audio.volume = clamp(state.audio.muted ? 0 : state.audio.volume, 0, 1);
  }

  function pickTrack() {
    const list = DATA.musicTracks || [];
    if (!list.length) return null;
    state.audio.trackIndex = clamp(state.audio.trackIndex, 0, list.length - 1);
    return list[state.audio.trackIndex];
  }

  async function ensurePlay() {
    const src = pickTrack();
    if (!src) return;
    if (!audio.src.includes(src)) audio.src = src;
    applyAudio();
    try { await audio.play(); } catch { /* blocked until gesture */ }
  }

  function pauseAudio() { try { audio.pause(); } catch {} }

  // arm gesture
  let armed = false;
  function armGesture() {
    if (armed) return;
    armed = true;
    window.addEventListener("pointerdown", () => ensurePlay(), { once: true });
    window.addEventListener("keydown", () => ensurePlay(), { once: true });
  }
  armGesture();

  // ---------- Render helpers ----------
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function resetAll() {
    state = defaultState();
    save();
    render(true);
  }

  function currentKeyString() {
    const len = DATA.keyLength || (DATA.levels?.length ?? 12);
    const arr = Array.from({ length: len }, (_, i) => state.key[i] ?? "_");
    return arr.join("");
  }

  function progressRatio() {
    const total = DATA.levels.length;
    const done = clamp(state.levelIndex, 0, total);
    return total ? (done / total) : 0;
  }

  function headerHTML() {
    const volPct = Math.round((state.audio.muted ? 0 : state.audio.volume) * 100);
    return `
      <div class="topbar">
        <div>
          <h1 class="h1">${DATA.title}</h1>
          <p class="sub">${DATA.subtitle}</p>
          <div class="pills">
            <span class="pill">🧩 ${DATA.levels.length} уровней</span>
            <span class="pill">🔑 <span class="keyLine">${currentKeyString()}</span></span>
          </div>
        </div>

        <div class="audio" title="Громкость">
          <button id="btnMute" aria-label="mute">${state.audio.muted ? "🔇" : "🔊"}</button>
          <input id="vol" type="range" min="0" max="1" step="0.01" value="${state.audio.muted ? 0 : state.audio.volume}">
          <div class="pct">${volPct}%</div>
        </div>
      </div>
    `;
  }

  function startScreen() {
    return `
      <div class="card pad-lg tilt">
        ${headerHTML()}
        <hr class="sep">
        <div class="row" style="gap:12px">
          <div class="small">Прогресс сохраняется. Лучше всего открывать в Chrome/Opera.</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn primary" id="btnStart">Начать</button>
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
      </div>
    `;
  }

  function quizScreen() {
    const i = clamp(state.levelIndex, 0, DATA.levels.length - 1);
    const level = DATA.levels[i];

    const pct = Math.round(progressRatio() * 100);

    return `
      <div class="grid2">
        <div class="card pad-lg tilt">
          <div class="progressBar" aria-label="progress">
            <div class="progressFill" style="width:${pct}%"></div>
          </div>

          <div style="margin-top:14px">
            ${headerHTML()}
          </div>

          <hr class="sep">

          <div style="margin-top:8px;font-weight:850;font-size:18px">${level.title}</div>
          <div style="margin-top:6px;color:var(--muted);line-height:1.55">${level.question}</div>

          <div class="options" id="options">
            ${level.options.map((t, idx) => `
              <button class="btn option glowBtn" data-idx="${idx}">${t}</button>
            `).join("")}
          </div>

          <div style="margin-top:14px;display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>

        <div class="card pad-lg tilt">
          <div style="font-weight:850;font-size:16px;margin-bottom:10px">🔑 Ключ</div>
          <div class="small" style="margin-bottom:10px">Собери ${DATA.keyLength} символов:</div>
          <div class="keyLine">${currentKeyString()}</div>

          <hr class="sep">
          <div class="small">Прогресс: ${i + 1}/${DATA.levels.length}</div>
        </div>
      </div>
    `;
  }

  function finalScreen() {
    const f = DATA.final || { title: "Готово", text: "" };
    return `
      <div class="card pad-lg tilt">
        ${headerHTML()}
        <hr class="sep">
        <div style="font-size:22px;font-weight:900;margin-bottom:10px">${f.title}</div>
        <div style="white-space:pre-wrap;color:var(--muted);line-height:1.65">${f.text}</div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn primary" id="btnRestart">На старт</button>
        </div>
      </div>
    `;
  }

  // ---------- Effects: button glow + card tilt ----------
  function bindGlowButtons(root = document) {
    root.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        btn.style.setProperty("--bx", x + "%");
        btn.style.setProperty("--by", y + "%");
      }, { passive: true });
    });
  }

  function bindCardTilt(root = document) {
    root.querySelectorAll(".card.tilt").forEach((card) => {
      let rafId = 0;

      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;

        const rotY = (px - 0.5) * 6;  // deg
        const rotX = -(py - 0.5) * 5;

        card.style.setProperty("--hx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--hy", (py * 100).toFixed(1) + "%");

        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-1px)`;
        });
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        card.style.transform = `perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
      });
    });
  }

  // ---------- Screen transitions ----------
  const app = $("#app");
  function setScreenHTML(html, animate = true) {
    if (!app) return;

    if (!animate) {
      app.innerHTML = `<div class="stage"><div class="screen">${html}</div></div>`;
	  bindAfterRender(); // <-- ВАЖНО: чтобы кнопки работали после render(false)
      return;
    }

    const old = app.querySelector(".screen");
    if (old) old.classList.add("out");

    // mount new
    const wrap = document.createElement("div");
    wrap.className = "stage";
    const scr = document.createElement("div");
    scr.className = "screen";
    scr.innerHTML = html;
    wrap.appendChild(scr);

    // Replace after small delay so out animation shows
    if (old) {
      setTimeout(() => {
        app.innerHTML = "";
        app.appendChild(wrap);
        // bind interactions
        bindAfterRender();
      }, 170);
    } else {
      app.innerHTML = "";
      app.appendChild(wrap);
      bindAfterRender();
    }
  }

  function bindCommon() {
    const btnMute = $("#btnMute");
    const vol = $("#vol");

    if (btnMute) btnMute.addEventListener("click", async () => {
      state.audio.muted = !state.audio.muted;
      applyAudio();
      save();
      render(false);
      if (!state.audio.muted) await ensurePlay();
    });

    if (vol) vol.addEventListener("input", async (e) => {
      state.audio.volume = clamp(parseFloat(e.target.value || "0.3"), 0, 1);
      state.audio.muted = state.audio.volume <= 0.001;
      applyAudio();
      save();
      if (!state.audio.muted) await ensurePlay();
      render(false);
    });

    $("#btnReset")?.addEventListener("click", () => resetAll());
  }

  function bindStart() {
    $("#btnStart")?.addEventListener("click", async () => {
      state.started = true;
      save();
      render(true);
      await ensurePlay();
    });
  }

  function bindQuiz() {
    $("#options")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-idx]");
      if (!btn) return;

      const idx = Number(btn.getAttribute("data-idx"));
      const i = clamp(state.levelIndex, 0, DATA.levels.length - 1);
      const level = DATA.levels[i];

      if (idx === level.answerIndex) {
        state.key[i] = level.keyChar ?? "_";
        state.levelIndex = i + 1;

        if (state.levelIndex >= DATA.levels.length) {
          state.completed = true;
        }

        save();
        render(true);
        await ensurePlay();
      } else {
        btn.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
          { duration: 220, easing: "ease-out" }
        );
      }
    });
  }

  function bindFinal() {
    $("#btnRestart")?.addEventListener("click", () => {
      resetAll();
      pauseAudio();
      render(true);
    });
  }

  function bindAfterRender() {
    bindGlowButtons(document);
    bindCardTilt(document);
    bindCommon();

    if (!state.started) bindStart();
    else if (state.completed) bindFinal();
    else bindQuiz();

    applyAudio();
  }

  function render(animate = true) {
    if (!app) return;

    let html = "";
    if (!state.started) html = startScreen();
    else if (state.completed) html = finalScreen();
    else html = quizScreen();

    setScreenHTML(html, animate);
  }

  render(false);
})();
