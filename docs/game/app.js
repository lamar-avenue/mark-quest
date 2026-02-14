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

  const LS_KEY = "markquest_state_v3";

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

  // ----- Background parallax (smooth) -----
  let tx = window.innerWidth * 0.5, ty = window.innerHeight * 0.3;
  let cx = tx, cy = ty;

  window.addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
  }, { passive: true });

  function raf() {
    cx += (tx - cx) * 0.10;
    cy += (ty - cy) * 0.10;
    document.documentElement.style.setProperty("--mx", cx + "px");
    document.documentElement.style.setProperty("--my", cy + "px");
    requestAnimationFrame(raf);
  }
  raf();

  // ----- Audio -----
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = true;

  function applyAudioState() {
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
    if (audio.src.indexOf(src) === -1) audio.src = src;
    applyAudioState();
    try { await audio.play(); } catch { /* browser may block until gesture */ }
  }

  function pauseAudio() {
    try { audio.pause(); } catch {}
  }

  // Start music after first user gesture
  let gestureArmed = false;
  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    window.addEventListener("pointerdown", () => ensurePlay(), { once: true });
    window.addEventListener("keydown", () => ensurePlay(), { once: true });
  }
  armGesture();

  // ----- Render -----
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function resetAll() {
    state = defaultState();
    save();
    render();
  }

  function currentKeyString() {
    const len = DATA.keyLength || (DATA.levels?.length ?? 12);
    const arr = Array.from({ length: len }, (_, i) => state.key[i] ?? "_");
    return arr.join("");
  }

  function headerHTML() {
    const volPct = Math.round((state.audio.muted ? 0 : state.audio.volume) * 100);
    return `
      <div class="topbar">
        <div>
          <h1 class="h1">${DATA.title}</h1>
          <p class="sub">${DATA.subtitle}</p>
          <div class="pills">
            <span class="pill">🧩 Уровни: <b>${DATA.levels.length}</b></span>
            <span class="pill">🔑 Ключ: <span class="keyLine">${currentKeyString()}</span></span>
          </div>
        </div>

        <div class="audio" title="Громкость фоновой музыки">
          <button id="btnMute" aria-label="mute">${state.audio.muted ? "🔇" : "🔊"}</button>
          <input id="vol" type="range" min="0" max="1" step="0.01" value="${state.audio.muted ? 0 : state.audio.volume}">
          <div class="pct">${volPct}%</div>
        </div>
      </div>
    `;
  }

  function startScreen() {
    return `
      <div class="card pad-lg">
        ${headerHTML()}
        <hr class="sep">
        <div class="row" style="gap:12px">
          <div class="small">Можно закрывать и возвращаться — прогресс сохранится.</div>
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

    return `
      <div class="grid2">
        <div class="card pad-lg">
          ${headerHTML()}
          <hr class="sep">
          <div class="small">Прогресс: ${i + 1}/${DATA.levels.length}</div>
          <div style="margin-top:10px;font-weight:800;font-size:18px">${level.title}</div>
          <div style="margin-top:6px;color:var(--muted);line-height:1.5">${level.question}</div>

          <div class="options" id="options">
            ${level.options.map((t, idx) => `
              <button class="btn option" data-idx="${idx}">${t}</button>
            `).join("")}
          </div>

          <div style="margin-top:14px;display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>

        <div class="card pad-lg">
          <div style="font-weight:800;font-size:16px;margin-bottom:10px">🔑 Ключ</div>
          <div class="small" style="margin-bottom:10px">Собери ${DATA.keyLength} символов:</div>
          <div class="keyLine">${currentKeyString()}</div>
          <hr class="sep">
          <div class="small">
            Подсказки убрали, чтобы интерфейс был чище. Если захочешь — добавим “мягкую” подсказку без кнопки.
          </div>
        </div>
      </div>
    `;
  }

  function finalScreen() {
    const f = DATA.final || { title: "Готово", text: "" };
    return `
      <div class="card pad-lg">
        ${headerHTML()}
        <hr class="sep">
        <div style="font-size:22px;font-weight:900;margin-bottom:10px">${f.title}</div>
        <div style="white-space:pre-wrap;color:var(--muted);line-height:1.6">${f.text}</div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn primary" id="btnRestart">На старт</button>
        </div>
      </div>
    `;
  }

  function bindCommon() {
    const btnMute = $("#btnMute");
    const vol = $("#vol");

    if (btnMute) btnMute.addEventListener("click", async () => {
      state.audio.muted = !state.audio.muted;
      applyAudioState();
      save();
      render();
      if (!state.audio.muted) await ensurePlay();
    });

    if (vol) vol.addEventListener("input", async (e) => {
      state.audio.volume = clamp(parseFloat(e.target.value || "0.3"), 0, 1);
      state.audio.muted = state.audio.volume <= 0.001;
      applyAudioState();
      save();
      if (!state.audio.muted) await ensurePlay();
      render();
    });

    const btnReset = $("#btnReset");
    if (btnReset) btnReset.addEventListener("click", () => {
      resetAll();
    });
  }

  function bindStart() {
    $("#btnStart")?.addEventListener("click", async () => {
      state.started = true;
      save();
      render();
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
        render();
        await ensurePlay();
      } else {
        // мягкая реакция без “режущего” UI
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
      render();
    });
  }

  function render() {
    const app = $("#app");
    if (!app) return;

    // fix: не показываем “13/12” — финал отдельным экраном
    let html = "";
    if (!state.started) html = startScreen();
    else if (state.completed) html = finalScreen();
    else html = quizScreen();

    app.innerHTML = html;

    bindCommon();
    if (!state.started) bindStart();
    else if (state.completed) bindFinal();
    else bindQuiz();

    applyAudioState();
  }

  render();
})();
