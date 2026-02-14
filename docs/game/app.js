/* =========================================================
   app.js (full rewrite) — Mark Quest
   Works on GitHub Pages, no libs, premium-ready structure
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     SETTINGS
     ========================= */
  const TOTAL_LEVELS = 12;

  // Включи для подарка: скрывает подсказки/сброс и "лишние" админ-элементы
  const MARK_MODE = true;

  // Уровень, на котором фон-музыка должна остановиться (edit challenge)
  const EDIT_LEVEL_NUM = 8;

  // Тихая громкость по умолчанию (30%)
  const DEFAULT_BGM_VOLUME = 0.30;

  // Плавность затухания музыки
  const FADE_MS = 650;

  // localStorage ключи
  const LS_KEY = "markquest_state_v2";

  /* =========================
     SAFE HELPERS
     ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function isNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
  }

  /* =========================
     DATA (from data.js)
     Expect one of:
       window.QUIZ_LEVELS = [...]
       window.LEVELS = [...]
       window.MARK_LEVELS = [...]
     Each level:
       {
         title: "Уровень 1/12",
         question: "....",
         answers: ["a","b","c"],
         correct: 1, // index
         hint?: "..."
         keyChar?: "M"
         type?: "quiz" | "edit"
       }
     ========================= */
  function loadLevels() {
    const levels =
      window.QUIZ_LEVELS ||
      window.LEVELS ||
      window.MARK_LEVELS ||
      null;

    if (Array.isArray(levels) && levels.length) {
      return levels;
    }

    // Fallback demo (чтобы сайт не падал)
    const demo = [];
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      demo.push({
        type: i === EDIT_LEVEL_NUM ? "edit" : "quiz",
        title: `Уровень ${i}/${TOTAL_LEVELS}`,
        question: i === EDIT_LEVEL_NUM
          ? "Edit Challenge: выбери 3 клипа и собери одно видео."
          : `Демо-вопрос ${i}: выбери правильный вариант.`,
        answers: i === EDIT_LEVEL_NUM ? [] : ["Вариант A", "Вариант B", "Вариант C"],
        correct: 1,
        hint: "Демо-подсказка.",
        keyChar: "X"
      });
    }
    return demo;
  }

  const LEVELS = loadLevels();

  /* =========================
     STATE
     ========================= */
  const state = {
    levelIndex: 0,              // 0..TOTAL_LEVELS-1
    key: [],                    // array of chars
    mistakes: {},               // { [levelIndex]: count }
    completed: false,
    // for edit challenge minimal selections
    edit: {
      selectedIds: []           // your ids from data if you use
    },
    bgm: {
      volume: DEFAULT_BGM_VOLUME,
      muted: false,
      trackIndex: 0
    }
  };

  function loadState() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;

    const saved = safeJSONParse(raw, null);
    if (!saved) return;

    if (isNumber(saved.levelIndex)) state.levelIndex = clamp(saved.levelIndex, 0, TOTAL_LEVELS - 1);
    if (Array.isArray(saved.key)) state.key = saved.key.slice(0, TOTAL_LEVELS);
    if (saved.mistakes && typeof saved.mistakes === "object") state.mistakes = saved.mistakes;
    if (typeof saved.completed === "boolean") state.completed = saved.completed;

    if (saved.edit && typeof saved.edit === "object") {
      state.edit.selectedIds = Array.isArray(saved.edit.selectedIds) ? saved.edit.selectedIds.slice(0, 3) : [];
    }

    if (saved.bgm && typeof saved.bgm === "object") {
      if (isNumber(saved.bgm.volume)) state.bgm.volume = clamp(saved.bgm.volume, 0, 1);
      if (typeof saved.bgm.muted === "boolean") state.bgm.muted = saved.bgm.muted;
      if (isNumber(saved.bgm.trackIndex)) state.bgm.trackIndex = clamp(saved.bgm.trackIndex, 0, 999);
    }
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      levelIndex: state.levelIndex,
      key: state.key,
      mistakes: state.mistakes,
      completed: state.completed,
      edit: state.edit,
      bgm: state.bgm
    }));
  }

  function resetProgress() {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }

  /* =========================
     ROOT + UI HOOKS
     ========================= */
  const root = $("#app") || $("#root") || document.body;

  // Optional containers (if exist in your HTML)
  const main = $("#main") || root;
  const keyBox = $("#keyBox") || $("#keyPanel") || null;
  const toastBox = $("#toast") || null;

  /* =========================
     TOAST
     ========================= */
  function toast(msg, type = "info") {
    if (!toastBox) {
      // fallback
      console.log(`[${type}]`, msg);
      return;
    }
    toastBox.textContent = msg;
    toastBox.classList.remove("ok", "err", "info");
    toastBox.classList.add(type);
    toastBox.style.opacity = "1";
    setTimeout(() => { toastBox.style.opacity = "0"; }, 2400);
  }

  /* =========================
     BACKGROUND MUSIC
     ========================= */
  let bgmAudio = null;
  let bgmTracks = [];

  function initBgm() {
    // You can define tracks in data.js:
    // window.BGM_TRACKS = ["game/assets/music/track1.mp3", "game/assets/music/track2.mp3"];
    bgmTracks = Array.isArray(window.BGM_TRACKS) ? window.BGM_TRACKS : [
      "game/assets/music/track1.mp3",
      "game/assets/music/track2.mp3",
    ];

    bgmAudio = new Audio();
    bgmAudio.loop = false; // мы сами включим следующий трек
    bgmAudio.preload = "auto";

    applyBgmVolume();

    bgmAudio.addEventListener("ended", () => {
      state.bgm.trackIndex = (state.bgm.trackIndex + 1) % bgmTracks.length;
      playBgm(true);
    });
  }

  function applyBgmVolume() {
    if (!bgmAudio) return;
    bgmAudio.muted = !!state.bgm.muted;
    bgmAudio.volume = clamp(state.bgm.volume, 0, 1);
  }

  async function fadeBgmTo(targetVol, ms = FADE_MS) {
    if (!bgmAudio) return;
    targetVol = clamp(targetVol, 0, 1);

    const start = bgmAudio.volume;
    const t0 = performance.now();

    while (true) {
      const t = performance.now() - t0;
      const p = clamp(t / ms, 0, 1);
      const v = start + (targetVol - start) * p;
      bgmAudio.volume = v;
      if (p >= 1) break;
      await sleep(16);
    }
  }

  async function playBgm(force = false) {
    if (!bgmAudio || !bgmTracks.length) return;

    const shouldStop = (getShownLevelNum() === EDIT_LEVEL_NUM);
    if (shouldStop && !force) return;

    const src = bgmTracks[state.bgm.trackIndex % bgmTracks.length];
    if (bgmAudio.src !== src) bgmAudio.src = src;

    applyBgmVolume();

    try {
      // Важно: браузеры требуют user gesture. У нас это будет после клика "Начать"/ответ.
      await bgmAudio.play();
    } catch (e) {
      // Не спамим
      console.warn("BGM play blocked:", e);
    }
  }

  async function stopBgmSmooth() {
    if (!bgmAudio) return;
    try {
      await fadeBgmTo(0, FADE_MS);
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      // возвращаем громкость назад (на будущее)
      bgmAudio.volume = clamp(state.bgm.volume, 0, 1);
    } catch {}
  }

  async function resumeBgmSmooth() {
    if (!bgmAudio) return;
    try {
      // стартуем с 0, потом мягко поднимаем
      const target = clamp(state.bgm.volume, 0, 1);
      bgmAudio.volume = 0;
      await playBgm(true);
      await fadeBgmTo(target, FADE_MS);
    } catch {}
  }

  function renderAudioWidget() {
    // маленький виджет сверху справа: mute + slider + %
    let w = $("#bgmWidget");
    if (!w) {
      w = document.createElement("div");
      w.id = "bgmWidget";
      w.style.position = "fixed";
      w.style.top = "14px";
      w.style.right = "14px";
      w.style.zIndex = "9999";
      w.style.display = "flex";
      w.style.alignItems = "center";
      w.style.gap = "10px";
      w.style.padding = "10px 12px";
      w.style.borderRadius = "14px";
      w.style.background = "rgba(20,24,35,.65)";
      w.style.border = "1px solid rgba(255,255,255,.10)";
      w.style.backdropFilter = "blur(10px)";
      w.style.boxShadow = "0 12px 40px rgba(0,0,0,.45)";
      document.body.appendChild(w);
    }

    w.innerHTML = `
      <button id="bgmMuteBtn" title="Mute" style="width:40px;height:34px;border-radius:12px;">
        ${state.bgm.muted ? "🔇" : "🔊"}
      </button>
      <input id="bgmSlider" type="range" min="0" max="100" value="${Math.round(state.bgm.volume * 100)}" style="width:160px;">
      <div id="bgmPct" style="min-width:34px;opacity:.85;font-weight:600;">${Math.round(state.bgm.volume * 100)}%</div>
    `;

    $("#bgmMuteBtn").addEventListener("click", () => {
      state.bgm.muted = !state.bgm.muted;
      applyBgmVolume();
      saveState();
      renderAudioWidget();
    });

    $("#bgmSlider").addEventListener("input", (e) => {
      state.bgm.volume = clamp(parseInt(e.target.value, 10) / 100, 0, 1);
      state.bgm.muted = false;
      applyBgmVolume();
      $("#bgmPct").textContent = `${Math.round(state.bgm.volume * 100)}%`;
      saveState();
    });
  }

  /* =========================
     KEY PANEL
     ========================= */
  function getShownLevelNum() {
    // levelIndex is 0-based, shown is 1..TOTAL_LEVELS
    return clamp(state.levelIndex + 1, 1, TOTAL_LEVELS);
  }

  function renderKeyPanel() {
    if (!keyBox) return;

    const filled = state.key.join("");
    const missing = Math.max(0, TOTAL_LEVELS - state.key.length);
    const mask = filled + "_".repeat(missing);

    keyBox.innerHTML = `
      <div style="font-weight:800;font-size:18px;margin-bottom:6px;">🔑 Ключ</div>
      <div style="opacity:.85;margin-bottom:8px;">Собери ${TOTAL_LEVELS} символов:</div>
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                  padding:10px 12px;border:1px dashed rgba(255,255,255,.18);
                  border-radius:12px;letter-spacing:1px;">
        ${mask}
      </div>
    `;
  }

  /* =========================
     RENDER (Start / Level / Done)
     ========================= */
  function setMain(html) {
    main.innerHTML = html;
  }

  function renderStartScreen() {
    // Запускаем музыку после первого клика (gesture)
    setMain(`
      <div class="card fadeInUp" style="max-width:980px;margin:40px auto;padding:22px;">
        <div style="font-size:28px;font-weight:900;display:flex;gap:10px;align-items:center;">
          🎁 Квест для Марка
        </div>
        <div style="opacity:.9;margin-top:8px;line-height:1.5;">
          12 уровней. За каждый — 1 символ ключа. Собери ключ и откроешь финал.
        </div>

        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          <button id="btnStart" class="btn" style="padding:12px 16px;font-weight:800;">Начать</button>
          ${MARK_MODE ? "" : `<button id="btnReset" class="btn" style="padding:12px 16px;">Сбросить прогресс</button>`}
        </div>

        <div style="opacity:.75;margin-top:12px;">
          Если звук не стартует — нажми “Начать”, это требуется браузером.
        </div>
      </div>
    `);

    $("#btnStart").addEventListener("click", async () => {
      await resumeBgmSmooth();
      render();
    });

    if (!MARK_MODE) {
      const r = $("#btnReset");
      if (r) r.addEventListener("click", resetProgress);
    }
  }

  function renderDoneScreen() {
    // прогресс строго 12/12
    setMain(`
      <div class="card fadeInUp" style="max-width:1100px;margin:30px auto;padding:22px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(61,255,204,.18);
                      display:grid;place-items:center;border:1px solid rgba(61,255,204,.30);">✅</div>
          <div style="font-size:28px;font-weight:900;">Готово</div>
        </div>

        <div style="margin-top:8px;opacity:.9;">
          Ключ: <b>${state.key.join("")}</b>
        </div>

        <div style="margin-top:14px;">
          <button id="btnFinal" class="btn" style="width:100%;padding:14px 16px;font-weight:900;">Открыть финал</button>
        </div>

        ${MARK_MODE ? "" : `
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
            <button id="btnReset2" class="btn" style="padding:12px 16px;">Сбросить прогресс</button>
          </div>
        `}
      </div>
    `);

    $("#btnFinal").addEventListener("click", () => {
      // TODO: сюда потом поставишь свою ссылку/страницу
      // например: location.href = "end.html";
      // или: window.open("https://...", "_blank");
      alert("Финал можно подключить позже: end.html или ссылка. Сейчас всё готово 🙂");
    });

    if (!MARK_MODE) {
      const r = $("#btnReset2");
      if (r) r.addEventListener("click", resetProgress);
    }
  }

  function renderQuizLevel(level, shownLevelNum) {
    const answers = Array.isArray(level.answers) ? level.answers : [];
    const mistakeCount = state.mistakes[state.levelIndex] || 0;

    const showHint = !MARK_MODE && mistakeCount > 0 && !!level.hint;

    setMain(`
      <div class="card fadeInUp" style="max-width:1100px;margin:22px auto;padding:22px;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="opacity:.85;font-weight:700;">Прогресс: ${shownLevelNum}/${TOTAL_LEVELS}</div>
            <div style="font-size:34px;font-weight:950;margin-top:2px;">${level.title || `Уровень ${shownLevelNum}/${TOTAL_LEVELS}`}</div>
            <div style="opacity:.92;margin-top:8px;font-size:16px;line-height:1.45;">
              ${level.question || ""}
            </div>
          </div>
        </div>

        <div style="margin-top:16px;display:grid;gap:10px;">
          ${answers.map((a, idx) => `
            <button class="btn ansBtn hoverLift" data-idx="${idx}" style="text-align:center;padding:14px 16px;font-weight:800;">
              ${a}
            </button>
          `).join("")}
        </div>

        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          ${showHint ? `<button id="btnHint" class="btn" style="padding:12px 16px;">Подсказка</button>` : ""}
          ${MARK_MODE ? "" : `<button id="btnReset" class="btn" style="padding:12px 16px;">Сбросить прогресс</button>`}
        </div>

        ${showHint ? `<div id="hintBox" class="card" style="margin-top:12px;padding:12px 14px;display:none;"></div>` : ""}
      </div>
    `);

    $$(".ansBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        // разблокируем музыку по пользовательскому клику
        await playBgm();

        const idx = parseInt(btn.dataset.idx, 10);
        const correct = isNumber(level.correct) ? level.correct : 0;

        if (idx === correct) {
          // add key char
          const ch = (level.keyChar || "").toString().slice(0, 1) || "X";
          if (state.key.length < TOTAL_LEVELS) state.key.push(ch);

          // next level
          if (state.levelIndex >= TOTAL_LEVELS - 1) {
            state.completed = true;
          } else {
            state.levelIndex++;
          }
          saveState();
          render();
        } else {
          state.mistakes[state.levelIndex] = (state.mistakes[state.levelIndex] || 0) + 1;
          saveState();
          toast("Неправильно 🙂 попробуй ещё раз", "err");
          // не глушим музыку и не делаем паузу — чтобы не было "потухло на секунду"
          renderKeyPanel();
          // Показ подсказки появится только если MARK_MODE=false
          if (!MARK_MODE) render();
        }
      });
    });

    if (!MARK_MODE) {
      const r = $("#btnReset");
      if (r) r.addEventListener("click", resetProgress);
    }

    if (showHint) {
      $("#btnHint").addEventListener("click", () => {
        const hb = $("#hintBox");
        hb.style.display = "block";
        hb.textContent = level.hint;
      });
    }
  }

  function renderEditLevel(level, shownLevelNum) {
    // На edit уровне — стопаем фон-музыку
    stopBgmSmooth();

    // Минимальная версия: выбор 3 клипов + кнопка "Дальше"
    // Твои карточки/редактор могут быть уже в level8.html — тогда просто делай переход на него.
    setMain(`
      <div class="card fadeInUp" style="max-width:1200px;margin:22px auto;padding:22px;">
        <div style="opacity:.85;font-weight:700;">Прогресс: ${shownLevelNum}/${TOTAL_LEVELS}</div>
        <div style="font-size:34px;font-weight:950;margin-top:2px;">${level.title || `Уровень ${shownLevelNum}/${TOTAL_LEVELS} — Edit Challenge`}</div>
        <div style="opacity:.92;margin-top:8px;line-height:1.45;">
          ${level.question || "Собери одно видео из 3 клипов. (Редактор у тебя уже есть — можно подключить сюда.)"}
        </div>

        <div class="card" style="margin-top:14px;padding:14px;">
          <div style="font-weight:800;margin-bottom:8px;">⚠️ Здесь должен быть твой редактор (уровень 8).</div>
          <div style="opacity:.85;">
            Сейчас этот `app.js` оставил место. Если хочешь — я подгоню под твой текущий редактор 8 уровня,
            чтобы он работал прямо тут и потом кнопка “Дальше”.
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <button id="btnBackToQuiz" class="btn" style="padding:12px 16px;">← Назад</button>
          <button id="btnNextFromEdit" class="btn" style="padding:12px 16px;font-weight:900;">Дальше →</button>
        </div>
      </div>
    `);

    $("#btnBackToQuiz").addEventListener("click", async () => {
      // возвращаемся (чисто навигация)
      state.levelIndex = clamp(state.levelIndex - 1, 0, TOTAL_LEVELS - 1);
      saveState();
      await resumeBgmSmooth();
      render();
    });

    $("#btnNextFromEdit").addEventListener("click", async () => {
      // Тут ты позже поставишь проверку "экспорт готов" и т.п.
      // Пока просто идём дальше и возвращаем музыку
      if (state.levelIndex >= TOTAL_LEVELS - 1) {
        state.completed = true;
      } else {
        state.levelIndex++;
      }
      saveState();
      await resumeBgmSmooth();
      render();
    });
  }

  function render() {
    // всегда корректный прогресс
    const shownLevelNum = getShownLevelNum();

    renderAudioWidget();
    renderKeyPanel();

    if (state.completed || state.key.length >= TOTAL_LEVELS) {
      state.completed = true;
      state.levelIndex = TOTAL_LEVELS - 1; // зафиксируем
      saveState();
      renderDoneScreen();
      return;
    }

    const level = LEVELS[state.levelIndex] || {};
    const type = level.type || (shownLevelNum === EDIT_LEVEL_NUM ? "edit" : "quiz");

    // На обычных уровнях музыка может играть
    if (shownLevelNum !== EDIT_LEVEL_NUM) {
      // не форсим — просто пробуем
      playBgm();
    }

    if (type === "edit") {
      renderEditLevel(level, shownLevelNum);
    } else {
      renderQuizLevel(level, shownLevelNum);
    }
  }

  /* =========================
     INIT
     ========================= */
  function boot() {
    loadState();
    initBgm();
    renderAudioWidget();
    renderKeyPanel();

    // Если прогресс есть — сразу в игру, иначе стартовый экран
    const hasProgress = state.key.length > 0 || state.levelIndex > 0;
    if (hasProgress) {
      render();
    } else {
      renderStartScreen();
    }
  }

  // Start
  boot();

})();
