/* docs/game/app.js
   Mark Quest — single-file app logic (no frameworks)
   - 12 уровней (7 квиз + 8 edit challenge + 4 квиз)
   - собирает ключ из 12 символов
   - сохраняет прогресс в localStorage
   - фоновая музыка (тихо по умолчанию + ползунок)
   - “Edit Challenge” (уровень 8): выбор 3 клипов, предпросмотр, простой оверлей-текст/стикер, экспорт WebM (canvas+MediaRecorder).
*/

(() => {
  "use strict";
  // === Premium moving background (cursor parallax) ===
(() => {
  const root = document.documentElement;

  function setXY(clientX, clientY) {
    const x = (clientX / window.innerWidth) * 100;
    const y = (clientY / window.innerHeight) * 100;
    root.style.setProperty("--mx", x.toFixed(2) + "%");
    root.style.setProperty("--my", y.toFixed(2) + "%");
  }

  // default center
  setXY(window.innerWidth / 2, window.innerHeight / 2);

  window.addEventListener("mousemove", (e) => setXY(e.clientX, e.clientY), { passive: true });

  // touch support
  window.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (t) setXY(t.clientX, t.clientY);
  }, { passive: true });
})();


  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const LS_KEY = "markQuest_v3_state";

  // ---------------------------
  // Default data (fallback)
  // Если есть window.QUIZ_DATA — используем его.
  // ---------------------------
  const DEFAULT_DATA = {
    title: "🎁 Квест для Марка",
    subtitle: "12 уровней. За каждый — 1 символ. Собери ключ и открой финал.",
    keyLength: 12,

    // Фоновая музыка (файлы положи в docs/game/assets/music/)
    musicTracks: [
      "./game/assets/music/track1.mp3",
      "./game/assets/music/track2.mp3",
    ],

    // Уровень 8 (Edit Challenge)
    editLevel: {
      title: "Уровень 8/12 — Edit Challenge",
      intro:
        "Выбери 3 клипа. Клик по карточке — большой предпросмотр. Кружок справа сверху — выбрать/убрать.",
      exportNote:
        "Экспорт идёт в WebM. В Opera/Chrome обычно работает лучше всего.",
      // клипы и превью (jpg) положи в docs/game/assets/level8/
      clips: [
        { id: "bleach1", title: "Bleach — clip 1", group: "аниме • Bleach", src: "./game/assets/level8/bleach1.mp4", thumb: "./game/assets/level8/bleach1.jpg" },
        { id: "bleach2", title: "Bleach — clip 2", group: "аниме • Bleach", src: "./game/assets/level8/bleach2.mp4", thumb: "./game/assets/level8/bleach2.jpg" },
        { id: "jjk1",    title: "Магическая битва — clip 1", group: "аниме • JJK", src: "./game/assets/level8/jjk1.mp4", thumb: "./game/assets/level8/jjk1.jpg" },
        { id: "jjk2",    title: "Магическая битва — clip 2", group: "аниме • JJK", src: "./game/assets/level8/jjk2.mp4", thumb: "./game/assets/level8/jjk2.jpg" },
        { id: "gohs1",   title: "Бог старшей школы — clip 1", group: "аниме • GOHS", src: "./game/assets/level8/gohs1.mp4", thumb: "./game/assets/level8/gohs1.jpg" },
        { id: "gohs2",   title: "Бог старшей школы — clip 2", group: "аниме • GOHS", src: "./game/assets/level8/gohs2.mp4", thumb: "./game/assets/level8/gohs2.jpg" },
      ],
    },

    // 12 уровней: 1..7 квиз, 8 edit, 9..12 квиз
    // keyChar — символ, который добавится при правильном прохождении уровня
    levels: [
      { type: "quiz", title: "Уровень 1/12", question: "Разогрев. Что бывает сразу после дня рождения?", options: ["Новый год", "День после дня рождения", "Лето"], answerIndex: 1, keyChar: "M" },
      { type: "quiz", title: "Уровень 2/12", question: "Что лучше описывает Марка?", options: ["Скучный", "Легенда", "Случайный NPC"], answerIndex: 1, keyChar: "A" },
      { type: "quiz", title: "Уровень 3/12", question: "Что сильнее: мотивация или лень?", options: ["Лень", "Мотивация", "Зависит от вайба"], answerIndex: 2, keyChar: "R" },
      { type: "quiz", title: "Уровень 4/12", question: "Если выбрать один — что?", options: ["Аниме", "Фильмы", "Тиктоки"], answerIndex: 0, keyChar: "K" },
      { type: "quiz", title: "Уровень 5/12", question: "Что важнее в подарке?", options: ["Цена", "Оригинальность", "Упаковка"], answerIndex: 1, keyChar: "2" },
      { type: "quiz", title: "Уровень 6/12", question: "Самый правильный режим?", options: ["Спать 8 часов", "Играть всю ночь", "Как получится"], answerIndex: 2, keyChar: "0" },
      { type: "quiz", title: "Уровень 7/12", question: "Финальный разогрев: кто тут бро?", options: ["Ты", "Марк", "Мы оба"], answerIndex: 2, keyChar: "2" },

      // Уровень 8 — edit challenge (keyChar добавим после экспорта или на кнопку "Дальше")
      { type: "edit", title: "Уровень 8/12 — Edit Challenge", keyChar: "6" },

      { type: "quiz", title: "Уровень 9/12", question: "Что лучше для победы?", options: ["Скилл", "Удача", "Всё сразу"], answerIndex: 2, keyChar: "B" },
      { type: "quiz", title: "Уровень 10/12", question: "Какой стиль тебе ближе?", options: ["Спокойный", "Брутальный", "Смешной"], answerIndex: 2, keyChar: "R" },
      { type: "quiz", title: "Уровень 11/12", question: "Важный выбор:", options: ["Сдаться", "Ещё попытка", "Перерыв и снова"], answerIndex: 2, keyChar: "O" },
      { type: "quiz", title: "Уровень 12/12", question: "Последний шаг:", options: ["Открыть финал", "Почитать подсказку", "Сбросить прогресс"], answerIndex: 0, keyChar: "!" },
    ],

    final: {
      title: "🎉 Марк, с днём рождения!",
      text:
        "Это не «дорогой» подарок, но сделан руками специально для тебя.\n" +
        "Сертификат: 1 катка/созвон/прогулка по первому требованию 😄\n\n" +
        "Активируется словами: «Бро, давай по сертификату».",
    },
  };

  const DATA = (typeof window !== "undefined" && window.QUIZ_DATA) ? window.QUIZ_DATA : DEFAULT_DATA;

  const TOTAL_LEVELS = (DATA.levels?.length || 12);

  // ---------------------------
  // State
  // ---------------------------
  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      return {
        screen: parsed.screen ?? "intro", // intro | game | final
        levelIndex: clamp(parsed.levelIndex ?? 0, 0, TOTAL_LEVELS - 1),
        key: String(parsed.key ?? ""),
        completed: !!parsed.completed,
        audio: {
          enabled: parsed.audio?.enabled ?? true,
          volume: clamp(Number(parsed.audio?.volume ?? 0.3), 0, 1),
          trackIndex: clamp(Number(parsed.audio?.trackIndex ?? 0), 0, (DATA.musicTracks?.length ?? 1) - 1),
        },
        edit: parsed.edit ?? {
          selectedIds: [],
          activeId: null,
          // per-clip settings
          clipSettings: {},
          // global overlay settings
          overlay: { text: "aura", size: 48, x: 40, y: 70, color: "#ff4dff", stroke: true },
          sticker: { emoji: "💀", size: 140, x: 980, y: 180 },
          filter: { brightness: 1, contrast: 1, saturate: 1 },
          exportUrl: null,
        },
      };
    } catch {
      return freshState();
    }
  }

  function freshState() {
    return {
      screen: "intro",
      levelIndex: 0,
      key: "",
      completed: false,
      audio: { enabled: true, volume: 0.3, trackIndex: 0 },
      edit: {
        selectedIds: [],
        activeId: null,
        clipSettings: {},
        overlay: { text: "aura", size: 48, x: 40, y: 70, color: "#ff4dff", stroke: true },
        sticker: { emoji: "💀", size: 140, x: 980, y: 180 },
        filter: { brightness: 1, contrast: 1, saturate: 1 },
        exportUrl: null,
      },
    };
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  // ---------------------------
  // DOM bootstrap
  // ---------------------------
  const root = document.getElementById("app") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "app" }));

  // ---------------------------
  // Background music
  // ---------------------------
  const bgm = new Audio();
  bgm.loop = true;
  bgm.preload = "auto";
  bgm.volume = state.audio.volume;

  let bgmReady = false;
  let bgmFading = false;

  function setBgmTrack(i) {
    const tracks = DATA.musicTracks || [];
    if (!tracks.length) return;
    state.audio.trackIndex = clamp(i, 0, tracks.length - 1);
    bgm.src = tracks[state.audio.trackIndex];
    bgmReady = false;
    bgm.load();
  }

  async function tryStartBgm() {
    if (!(DATA.musicTracks && DATA.musicTracks.length)) return;
    if (!bgm.src) setBgmTrack(state.audio.trackIndex);

    bgm.volume = state.audio.enabled ? state.audio.volume : 0;

    try {
      await bgm.play();
      bgmReady = true;
    } catch {
      // autoplay blocked: will start on first user interaction
      bgmReady = false;
    }
  }

  function ensureBgmOnUserGestureOnce() {
    const handler = async () => {
      window.removeEventListener("pointerdown", handler);
      await tryStartBgm();
    };
    window.addEventListener("pointerdown", handler, { once: true });
  }

  async function fadeBgmTo(target, ms = 450) {
    if (bgmFading) return;
    bgmFading = true;
    const start = bgm.volume;
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      bgm.volume = start + (target - start) * t;
      await sleep(ms / steps);
    }
    bgm.volume = target;
    bgmFading = false;
  }

  async function pauseBgmSmooth() {
    if (!bgmReady) return;
    await fadeBgmTo(0, 380);
    bgm.pause();
  }

  async function resumeBgmSmooth() {
    if (!(DATA.musicTracks && DATA.musicTracks.length)) return;
    if (!bgm.src) setBgmTrack(state.audio.trackIndex);

    try {
      await bgm.play();
      bgmReady = true;
      const target = state.audio.enabled ? state.audio.volume : 0;
      bgm.volume = 0;
      await fadeBgmTo(target, 420);
    } catch {
      bgmReady = false;
    }
  }

  // ---------------------------
  // Rendering
  // ---------------------------
  function setMain(html) {
    root.innerHTML = html;
  }

  function render() {
    if (state.completed || state.screen === "final") {
      renderFinal();
      return;
    }

    if (state.screen === "intro") {
      renderIntro();
      return;
    }

    renderGame();
  }

  function renderIntro() {
    setMain(`
      <div class="bg">
        <div class="topbar">
          ${renderAudioWidget()}
        </div>

        <div class="wrap">
          <div class="hero card fade-in">
            <div class="heroTitle">${escapeHtml(DATA.title || "Квест")}</div>
            <div class="heroSub">${escapeHtml(DATA.subtitle || "")}</div>
            <div class="heroBullets">
              <div>• Ничего устанавливать не нужно.</div>
              <div>• Можно закрывать и возвращаться — прогресс сохранится.</div>
              <div>• Лучший браузер для “экспорта” — Chrome/Opera.</div>
            </div>

            <div class="heroActions">
              <button class="btn primary" id="btnStart">Начать</button>
              <button class="btn" id="btnResetAll">Сбросить прогресс</button>
            </div>
          </div>
        </div>
      </div>
    `);

    hookAudioWidget();

    $("#btnStart").addEventListener("click", async () => {
      state.screen = "game";
      saveState();
      await tryStartBgm();
      render();
    });

    $("#btnResetAll").addEventListener("click", () => {
      const fresh = freshState();
      Object.assign(state, fresh);
      saveState();
      render();
    });

    ensureBgmOnUserGestureOnce();
  }

  function renderGame() {
    const level = DATA.levels[state.levelIndex];
    const shownLevelNum = state.levelIndex + 1;

    const keyMasked = renderKeyMasked(state.key, DATA.keyLength || 12);

    const left = (level.type === "edit")
      ? renderEditLevel(level, shownLevelNum)
      : renderQuizLevel(level, shownLevelNum);

    setMain(`
      <div class="bg">
        <div class="topbar">
          <div class="crumbs">${escapeHtml(DATA.title || "Квест")}</div>
          ${renderAudioWidget()}
        </div>

        <div class="layout">
          <div class="mainCol">
            ${left}
          </div>

          <div class="sideCol">
            <div class="card sideCard fade-in">
              <div class="sideTitle">🔑 Ключ</div>
              <div class="sideText">Собери ${DATA.keyLength || 12} символов:</div>
              <div class="keyBox">${escapeHtml(keyMasked)}</div>

              <div class="sideMini">
                <div class="miniLabel">Прогресс</div>
                <div class="miniValue">${shownLevelNum}/${TOTAL_LEVELS}</div>
              </div>

              <button class="btn" id="btnResetRun">Сбросить прохождение</button>
            </div>
          </div>
        </div>
      </div>
    `);

    hookAudioWidget();

    $("#btnResetRun").addEventListener("click", () => {
      // сбрасываем только прогресс, оставляя настройки звука
      const keepAudio = { ...state.audio };
      const fresh = freshState();
      Object.assign(state, fresh);
      state.audio = keepAudio;
      saveState();
      render();
    });
  }

  function renderQuizLevel(level, shownLevelNum) {
    return `
      <div class="card fade-in">
        <div class="lvlTop">
          <div class="lvlProgress">Уровень ${shownLevelNum}/${TOTAL_LEVELS}</div>
          <div class="lvlTitle">${escapeHtml(level.title || "")}</div>
        </div>

        <div class="question">${escapeHtml(level.question || "")}</div>

        <div class="answers">
          ${(level.options || []).map((opt, idx) => `
            <button class="ans" data-idx="${idx}">
              <span class="ansDot"></span>
              <span class="ansText">${escapeHtml(opt)}</span>
            </button>
          `).join("")}
        </div>

        <div class="hintRow">
          <div class="muted">Выбери один вариант.</div>
        </div>
      </div>
    `;
  }

  function renderEditLevel(level, shownLevelNum) {
    const E = DATA.editLevel || DEFAULT_DATA.editLevel;

    return `
      <div class="card fade-in">
        <div class="lvlTop">
          <div class="lvlProgress">Уровень ${shownLevelNum}/${TOTAL_LEVELS}</div>
          <div class="lvlTitle">${escapeHtml(E.title || level.title || "")}</div>
        </div>

        <div class="muted" style="margin-top:8px;">${escapeHtml(E.intro || "")}</div>

        <div class="editGrid">
          <div class="editLeft cardInner">
            <div class="bigPreviewTitle">Просмотр: <span id="bigTitle">—</span></div>
            <div class="bigPreviewWrap">
              <video id="bigVideo" controls playsinline></video>
              <div class="badge" id="selBadge">Выбрано: 0/3</div>
            </div>

            <div class="clipGrid" id="clipGrid"></div>

            <div class="editFooter">
              <button class="btn primary" id="btnGoEditor" disabled>Перейти в редактор</button>
            </div>
          </div>

          <div class="editRight cardInner">
            <div class="editorTop">
              <div class="editorTitle">Редактор</div>
              <div class="muted">Собери одно видео из 3 клипов → экспорт → дальше.</div>
            </div>

            <div class="tabs">
              <button class="tab active" data-tab="clip">Клип</button>
              <button class="tab" data-tab="text">Текст</button>
              <button class="tab" data-tab="sticker">Стикер</button>
              <button class="tab" data-tab="filter">Фильтры</button>
              <button class="tab" data-tab="export">Экспорт</button>
            </div>

            <div class="editorBody">
              <div class="editorCanvasWrap">
                <canvas id="previewCanvas" width="1280" height="720"></canvas>
                <div class="editorNote" id="editorNote">Сначала выбери 3 клипа слева и нажми «Перейти в редактор».</div>
              </div>

              <div class="panel" id="panelClip"></div>
              <div class="panel hidden" id="panelText"></div>
              <div class="panel hidden" id="panelSticker"></div>
              <div class="panel hidden" id="panelFilter"></div>
              <div class="panel hidden" id="panelExport"></div>
            </div>

            <div class="editorFooter">
              <button class="btn" id="btnBackToQuiz">Назад</button>
              <button class="btn primary" id="btnNextAfterEdit" disabled>Дальше</button>
            </div>

            <div class="muted" style="margin-top:10px;">${escapeHtml(E.exportNote || "")}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderFinal() {
    setMain(`
      <div class="bg">
        <div class="topbar">
          <div class="crumbs">${escapeHtml(DATA.title || "Квест")}</div>
          ${renderAudioWidget()}
        </div>

        <div class="wrap">
          <div class="card fade-in">
            <div class="finalTitle">✅ Готово</div>
            <div class="finalKey">Ключ: <span>${escapeHtml(state.key || "")}</span></div>

            <div class="finalBox cardInner">
              <div class="finalBig">${escapeHtml(DATA.final?.title || "Финал")}</div>
              <div class="finalText">${escapeHtml(DATA.final?.text || "").replaceAll("\n", "<br>")}</div>
              <div style="margin-top:14px;">
                <button class="btn primary" id="btnRestart">На старт</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    hookAudioWidget();

    $("#btnRestart").addEventListener("click", () => {
      const keepAudio = { ...state.audio };
      const fresh = freshState();
      Object.assign(state, fresh);
      state.audio = keepAudio;
      saveState();
      render();
    });
  }

  // ---------------------------
  // Events: quiz + edit
  // ---------------------------
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ans");
    if (!btn) return;

    const level = DATA.levels[state.levelIndex];
    if (!level || level.type !== "quiz") return;

    const chosen = Number(btn.dataset.idx);
    const correct = chosen === Number(level.answerIndex);

    // UI feedback
    $$(".ans").forEach((b) => b.classList.add("disabled"));
    btn.classList.add(correct ? "correct" : "wrong");

    await sleep(420);

    if (!correct) {
      // просто даём попробовать снова: перерендер уровня
      render();
      return;
    }

    // add key char
    pushKeyChar(level.keyChar);

    // next
    goNextLevel();
  });

  function pushKeyChar(ch) {
    const max = DATA.keyLength || 12;
    if (!ch) return;
    if (state.key.length >= max) return;
    state.key += String(ch).slice(0, 1);
  }

  function goNextLevel() {
    if (state.levelIndex >= TOTAL_LEVELS - 1) {
      // done
      state.completed = true;
      state.screen = "final";
      saveState();
      render();
      return;
    }
    state.levelIndex++;
    saveState();
    render();
  }

  // ---------------------------
  // Audio Widget
  // ---------------------------
  function renderAudioWidget() {
    const volPct = Math.round((state.audio.volume || 0) * 100);
    return `
      <div class="audio cardMini">
        <button class="iconBtn" id="btnMute" title="Вкл/выкл">
          ${state.audio.enabled ? "🔊" : "🔇"}
        </button>
        <input id="vol" class="vol" type="range" min="0" max="100" value="${volPct}" />
        <div class="volPct">${volPct}%</div>
      </div>
    `;
  }

  function hookAudioWidget() {
    const mute = $("#btnMute");
    const vol = $("#vol");

    if (mute) {
      mute.addEventListener("click", async () => {
        state.audio.enabled = !state.audio.enabled;
        saveState();

        if (!bgmReady) await tryStartBgm();
        const target = state.audio.enabled ? state.audio.volume : 0;
        await fadeBgmTo(target, 200);
        render();
      });
    }

    if (vol) {
      vol.addEventListener("input", async () => {
        const v = clamp(Number(vol.value) / 100, 0, 1);
        state.audio.volume = v;
        saveState();

        if (!bgmReady) await tryStartBgm();
        if (state.audio.enabled) {
          bgm.volume = v;
        }
      });
    }
  }

  // ---------------------------
  // Edit Challenge Logic
  // ---------------------------
  let editMounted = false;

  function mountEditLevelIfNeeded() {
    const level = DATA.levels[state.levelIndex];
    if (!level || level.type !== "edit") {
      editMounted = false;
      return;
    }
    if (editMounted) return;

    editMounted = true;

    // stop bgm smoothly during edit
    pauseBgmSmooth();

    const E = DATA.editLevel || DEFAULT_DATA.editLevel;

    const bigVideo = $("#bigVideo");
    const bigTitle = $("#bigTitle");
    const selBadge = $("#selBadge");
    const grid = $("#clipGrid");
    const btnGoEditor = $("#btnGoEditor");

    const canvas = $("#previewCanvas");
    const ctx = canvas.getContext("2d");

    const panelClip = $("#panelClip");
    const panelText = $("#panelText");
    const panelSticker = $("#panelSticker");
    const panelFilter = $("#panelFilter");
    const panelExport = $("#panelExport");

    const btnBack = $("#btnBackToQuiz");
    const btnNext = $("#btnNextAfterEdit");

    const note = $("#editorNote");

    // Build cards
    grid.innerHTML = (E.clips || []).map((c) => {
      const picked = state.edit.selectedIds.includes(c.id);
      return `
        <button class="clipCard" data-id="${escapeAttr(c.id)}">
          <div class="clipThumb" style="background-image:url('${escapeAttr(c.thumb)}')"></div>
          <div class="clipMeta">
            <div class="clipName">${escapeHtml(c.title)}</div>
            <div class="clipGroup">${escapeHtml(c.group || "")}</div>
          </div>
          <div class="pickDot ${picked ? "picked" : ""}"></div>
        </button>
      `;
    }).join("");

    function updateBadge() {
      const n = state.edit.selectedIds.length;
      selBadge.textContent = `Выбрано: ${n}/3`;
      btnGoEditor.disabled = n !== 3;
      if (n === 3) btnGoEditor.classList.add("pulse");
      else btnGoEditor.classList.remove("pulse");
    }

    function setActiveClip(id) {
      const clip = (E.clips || []).find((x) => x.id === id);
      if (!clip) return;
      state.edit.activeId = id;
      saveState();

      bigVideo.src = clip.src;
      bigTitle.textContent = clip.title;
      bigVideo.load();
      bigVideo.play().catch(() => {});
    }

    updateBadge();

    // Clicking cards
    grid.addEventListener("click", (ev) => {
      const card = ev.target.closest(".clipCard");
      if (!card) return;
      const id = card.dataset.id;

      // click on dot area toggles selection too (we keep it simple: click card = active, double-click toggles? no — do both via modifier)
      // Here: click = open; Shift+click = toggle select
      if (ev.shiftKey) {
        toggleSelect(id);
        return;
      }
      setActiveClip(id);
    });

    // Right top “dot” toggles on click (better UX)
    grid.addEventListener("pointerdown", (ev) => {
      const dot = ev.target.closest(".pickDot");
      const card = ev.target.closest(".clipCard");
      if (!dot || !card) return;
      ev.preventDefault();
      toggleSelect(card.dataset.id);
    });

    function toggleSelect(id) {
      const list = state.edit.selectedIds.slice();
      const idx = list.indexOf(id);

      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        if (list.length >= 3) return;
        list.push(id);
      }

      state.edit.selectedIds = list;
      saveState();

      // update dots
      $$(".clipCard", grid).forEach((card) => {
        const d = $(".pickDot", card);
        const picked = state.edit.selectedIds.includes(card.dataset.id);
        d.classList.toggle("picked", picked);
      });

      updateBadge();
    }

    // default active
    if (!state.edit.activeId) {
      setActiveClip((E.clips?.[0]?.id) || null);
    } else {
      setActiveClip(state.edit.activeId);
    }

    // Tabs
    $$(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        $$(".tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const tab = t.dataset.tab;

        [panelClip, panelText, panelSticker, panelFilter, panelExport].forEach((p) => p.classList.add("hidden"));
        if (tab === "clip") panelClip.classList.remove("hidden");
        if (tab === "text") panelText.classList.remove("hidden");
        if (tab === "sticker") panelSticker.classList.remove("hidden");
        if (tab === "filter") panelFilter.classList.remove("hidden");
        if (tab === "export") panelExport.classList.remove("hidden");
      });
    });

    // Editor panels
    const ensureClipSettings = (id) => {
      if (!state.edit.clipSettings[id]) {
        state.edit.clipSettings[id] = { trimStart: 0, trimEnd: null, volume: 1 };
      }
      return state.edit.clipSettings[id];
    };

    function renderPanels() {
      const selected = state.edit.selectedIds;
      const active = state.edit.activeId || (selected[0] || null);

      // Clip panel
      panelClip.innerHTML = `
        <div class="panelTitle">Клипы</div>
        <div class="muted">Настройки применяются к выбранному клипу (активному).</div>
        <div class="row">
          <label class="lbl">Активный клип</label>
          <select id="selActive">
            ${(selected.length ? selected : (E.clips||[]).map(c=>c.id)).map((id) => {
              const clip = (E.clips||[]).find(x=>x.id===id);
              return `<option value="${escapeAttr(id)}" ${id===active?"selected":""}>${escapeHtml(clip?clip.title:id)}</option>`;
            }).join("")}
          </select>
        </div>

        <div class="row">
          <label class="lbl">Громкость клипа</label>
          <input id="clipVol" type="range" min="0" max="200" value="${Math.round((ensureClipSettings(active).volume||1)*100)}"/>
          <div class="mini">${Math.round((ensureClipSettings(active).volume||1)*100)}%</div>
        </div>

        <div class="row">
          <label class="lbl">Trim start (сек)</label>
          <input id="trimStart" type="number" step="0.1" min="0" value="${Number(ensureClipSettings(active).trimStart||0).toFixed(1)}"/>
        </div>

        <div class="row">
          <label class="lbl">Trim end (сек, пусто = до конца)</label>
          <input id="trimEnd" type="number" step="0.1" min="0" value="${ensureClipSettings(active).trimEnd==null?"":Number(ensureClipSettings(active).trimEnd).toFixed(1)}"/>
        </div>

        <div class="muted">Подсказка: активный клип меняется кликом по карточке слева.</div>
      `;

      // Text panel
      const O = state.edit.overlay;
      panelText.innerHTML = `
        <div class="panelTitle">Текст</div>

        <div class="row">
          <label class="lbl">Текст</label>
          <input id="txText" type="text" value="${escapeAttr(O.text || "")}" />
        </div>

        <div class="row">
          <label class="lbl">Размер</label>
          <input id="txSize" type="range" min="12" max="140" value="${clamp(Number(O.size||48),12,140)}" />
          <div class="mini">${clamp(Number(O.size||48),12,140)}px</div>
        </div>

        <div class="row">
          <label class="lbl">X</label>
          <input id="txX" type="range" min="0" max="1280" value="${clamp(Number(O.x||40),0,1280)}" />
          <div class="mini">${clamp(Number(O.x||40),0,1280)}</div>
        </div>

        <div class="row">
          <label class="lbl">Y</label>
          <input id="txY" type="range" min="0" max="720" value="${clamp(Number(O.y||70),0,720)}" />
          <div class="mini">${clamp(Number(O.y||70),0,720)}</div>
        </div>

        <div class="row">
          <label class="lbl">Цвет</label>
          <input id="txColor" type="color" value="${escapeAttr(O.color || "#ff4dff")}" />
          <label class="chk"><input id="txStroke" type="checkbox" ${O.stroke ? "checked":""}/> Обводка</label>
        </div>
      `;

      // Sticker panel
      const S = state.edit.sticker;
      panelSticker.innerHTML = `
        <div class="panelTitle">Стикер</div>

        <div class="row">
          <label class="lbl">Эмодзи</label>
          <input id="stEmoji" type="text" value="${escapeAttr(S.emoji || "💀")}" maxlength="2" />
        </div>

        <div class="row">
          <label class="lbl">Размер</label>
          <input id="stSize" type="range" min="40" max="260" value="${clamp(Number(S.size||140),40,260)}" />
          <div class="mini">${clamp(Number(S.size||140),40,260)}px</div>
        </div>

        <div class="row">
          <label class="lbl">X</label>
          <input id="stX" type="range" min="0" max="1280" value="${clamp(Number(S.x||980),0,1280)}" />
          <div class="mini">${clamp(Number(S.x||980),0,1280)}</div>
        </div>

        <div class="row">
          <label class="lbl">Y</label>
          <input id="stY" type="range" min="0" max="720" value="${clamp(Number(S.y||180),0,720)}" />
          <div class="mini">${clamp(Number(S.y||180),0,720)}</div>
        </div>
      `;

      // Filter panel
      const F = state.edit.filter;
      panelFilter.innerHTML = `
        <div class="panelTitle">Фильтры</div>

        <div class="row">
          <label class="lbl">Brightness</label>
          <input id="fB" type="range" min="50" max="150" value="${Math.round(clamp(Number(F.brightness||1),0.5,1.5)*100)}" />
          <div class="mini">${Math.round(clamp(Number(F.brightness||1),0.5,1.5)*100)}%</div>
        </div>

        <div class="row">
          <label class="lbl">Contrast</label>
          <input id="fC" type="range" min="50" max="150" value="${Math.round(clamp(Number(F.contrast||1),0.5,1.5)*100)}" />
          <div class="mini">${Math.round(clamp(Number(F.contrast||1),0.5,1.5)*100)}%</div>
        </div>

        <div class="row">
          <label class="lbl">Saturate</label>
          <input id="fS" type="range" min="50" max="180" value="${Math.round(clamp(Number(F.saturate||1),0.5,1.8)*100)}" />
          <div class="mini">${Math.round(clamp(Number(F.saturate||1),0.5,1.8)*100)}%</div>
        </div>

        <button class="btn" id="btnFilterReset">Сбросить фильтры</button>
      `;

      // Export panel
      panelExport.innerHTML = `
        <div class="panelTitle">Экспорт</div>
        <div class="muted">Выбери 3 клипа → «Перейти в редактор» → «Сгенерировать видео».</div>

        <div class="row" style="gap:10px;">
          <button class="btn primary" id="btnExport" ${selected.length===3 ? "" : "disabled"}>🎬 Сгенерировать видео</button>
          <button class="btn" id="btnClearExport">Очистить результат</button>
        </div>

        <div id="exportStatus" class="muted"></div>

        <div id="exportResult" class="${state.edit.exportUrl ? "" : "hidden"}" style="margin-top:12px;">
          <div class="panelTitle" style="font-size:14px;">Результат</div>
          <video id="outVideo" controls playsinline style="width:100%;border-radius:14px;background:#000;"></video>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <a class="btn primary" id="btnDownload" download="mark_edit.webm">⬇ Скачать видео</a>
            <div class="muted">После экспорта нажми «Дальше».</div>
          </div>
        </div>
      `;

      // Hook panel inputs
      const selActive = $("#selActive");
      if (selActive) {
        selActive.addEventListener("change", () => {
          const id = selActive.value;
          state.edit.activeId = id;
          saveState();
          setActiveClip(id);
          renderPanels();
        });
      }

      const clipVol = $("#clipVol");
      if (clipVol) {
        clipVol.addEventListener("input", () => {
          const id = state.edit.activeId;
          const cs = ensureClipSettings(id);
          cs.volume = clamp(Number(clipVol.value)/100, 0, 2);
          saveState();
        });
      }

      const trimStart = $("#trimStart");
      const trimEnd = $("#trimEnd");
      if (trimStart) {
        trimStart.addEventListener("input", () => {
          const id = state.edit.activeId;
          const cs = ensureClipSettings(id);
          cs.trimStart = clamp(Number(trimStart.value||0), 0, 9999);
          saveState();
        });
      }
      if (trimEnd) {
        trimEnd.addEventListener("input", () => {
          const id = state.edit.activeId;
          const cs = ensureClipSettings(id);
          const val = trimEnd.value;
          cs.trimEnd = (val === "" ? null : clamp(Number(val), 0, 9999));
          saveState();
        });
      }

      const bindOverlay = (id, prop, fn) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", () => {
          fn(el);
          saveState();
        });
      };

      bindOverlay("#txText", "text", (el) => state.edit.overlay.text = el.value);
      bindOverlay("#txSize", "size", (el) => state.edit.overlay.size = Number(el.value));
      bindOverlay("#txX", "x", (el) => state.edit.overlay.x = Number(el.value));
      bindOverlay("#txY", "y", (el) => state.edit.overlay.y = Number(el.value));
      bindOverlay("#txColor", "color", (el) => state.edit.overlay.color = el.value);
      const txStroke = $("#txStroke");
      if (txStroke) {
        txStroke.addEventListener("change", () => {
          state.edit.overlay.stroke = !!txStroke.checked;
          saveState();
        });
      }

      bindOverlay("#stEmoji", "emoji", (el) => state.edit.sticker.emoji = el.value);
      bindOverlay("#stSize", "size", (el) => state.edit.sticker.size = Number(el.value));
      bindOverlay("#stX", "x", (el) => state.edit.sticker.x = Number(el.value));
      bindOverlay("#stY", "y", (el) => state.edit.sticker.y = Number(el.value));

      const fB = $("#fB");
      const fC = $("#fC");
      const fS = $("#fS");
      if (fB) fB.addEventListener("input", () => { state.edit.filter.brightness = Number(fB.value)/100; saveState(); });
      if (fC) fC.addEventListener("input", () => { state.edit.filter.contrast = Number(fC.value)/100; saveState(); });
      if (fS) fS.addEventListener("input", () => { state.edit.filter.saturate = Number(fS.value)/100; saveState(); });

      const btnFilterReset = $("#btnFilterReset");
      if (btnFilterReset) {
        btnFilterReset.addEventListener("click", () => {
          state.edit.filter = { brightness: 1, contrast: 1, saturate: 1 };
          saveState();
          renderPanels();
        });
      }

      const btnExport = $("#btnExport");
      const btnClearExport = $("#btnClearExport");
      const exportStatus = $("#exportStatus");

      if (btnClearExport) {
        btnClearExport.addEventListener("click", () => {
          if (state.edit.exportUrl) URL.revokeObjectURL(state.edit.exportUrl);
          state.edit.exportUrl = null;
          saveState();
          renderPanels();
          btnNext.disabled = true;
        });
      }

      if (btnExport) {
        btnExport.addEventListener("click", async () => {
          if (state.edit.selectedIds.length !== 3) return;

          exportStatus.textContent = "Экспорт: подготовка…";
          btnExport.disabled = true;

          try {
            const url = await exportWebmFromSelected(E, canvas, ctx);
            if (state.edit.exportUrl) URL.revokeObjectURL(state.edit.exportUrl);
            state.edit.exportUrl = url;
            saveState();

            exportStatus.textContent = "Готово. Можешь скачать и нажать «Дальше».";
            renderPanels();
            const outVideo = $("#outVideo");
            const btnDownload = $("#btnDownload");
            if (outVideo) outVideo.src = url;
            if (btnDownload) btnDownload.href = url;

            btnNext.disabled = false; // можно идти дальше
          } catch (err) {
            exportStatus.textContent = "Не удалось экспортировать. Попробуй Chrome/Opera и проверь, что клипы открываются.";
            console.error(err);
          } finally {
            btnExport.disabled = false;
          }
        });
      }
    }

    // Canvas live preview (from bigVideo)
    let raf = 0;

    function videoFilterCss() {
      const F = state.edit.filter;
      const b = clamp(Number(F.brightness || 1), 0.5, 1.5);
      const c = clamp(Number(F.contrast || 1), 0.5, 1.5);
      const s = clamp(Number(F.saturate || 1), 0.5, 1.8);
      return `brightness(${b}) contrast(${c}) saturate(${s})`;
    }

    function drawOverlay() {
      // video frame
      ctx.save();
      ctx.filter = videoFilterCss();
      if (bigVideo.readyState >= 2) {
        // cover fit
        const vw = bigVideo.videoWidth || 1280;
        const vh = bigVideo.videoHeight || 720;

        const cw = canvas.width;
        const ch = canvas.height;

        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        ctx.drawImage(bigVideo, dx, dy, dw, dh);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();

      // text overlay
      const O = state.edit.overlay;
      ctx.save();
      ctx.font = `800 ${clamp(Number(O.size||48),12,200)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = O.color || "#ff4dff";
      ctx.textBaseline = "top";
      if (O.stroke) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,.65)";
        ctx.strokeText(O.text || "", Number(O.x||40), Number(O.y||70));
      }
      ctx.fillText(O.text || "", Number(O.x||40), Number(O.y||70));
      ctx.restore();

      // sticker
      const S = state.edit.sticker;
      ctx.save();
      ctx.font = `${clamp(Number(S.size||140),30,400)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(S.emoji || "💀", Number(S.x||980), Number(S.y||180));
      ctx.restore();

      raf = requestAnimationFrame(drawOverlay);
    }

    drawOverlay();

    // Editor gate
    btnGoEditor.addEventListener("click", async () => {
      if (state.edit.selectedIds.length !== 3) return;
      note.classList.add("hidden");

      // set active to first selected if none
      if (!state.edit.activeId || !state.edit.selectedIds.includes(state.edit.activeId)) {
        state.edit.activeId = state.edit.selectedIds[0];
        saveState();
        setActiveClip(state.edit.activeId);
      }

      renderPanels();
      // jump to clip tab
      $(".tab[data-tab='clip']").click();
    });

    // Back / Next
    btnBack.addEventListener("click", async () => {
      // go back to previous level
      state.levelIndex = clamp(state.levelIndex - 1, 0, TOTAL_LEVELS - 1);
      saveState();
      cancelAnimationFrame(raf);
      await resumeBgmSmooth();
      render();
    });

    btnNext.addEventListener("click", async () => {
      // allow next after export OR just allow anyway if хочешь:
      // здесь сделано: только если экспорт готов (btnNext включается)
      pushKeyChar(level.keyChar);
      cancelAnimationFrame(raf);
      await resumeBgmSmooth();
      goNextLevel();
    });

    // initial panels (empty until editor)
    panelClip.innerHTML = `<div class="panelTitle">Клипы</div><div class="muted">Выбери 3 клипа слева → «Перейти в редактор».</div>`;
    panelText.innerHTML = `<div class="panelTitle">Текст</div><div class="muted">Сначала выбери 3 клипа.</div>`;
    panelSticker.innerHTML = `<div class="panelTitle">Стикер</div><div class="muted">Сначала выбери 3 клипа.</div>`;
    panelFilter.innerHTML = `<div class="panelTitle">Фильтры</div><div class="muted">Сначала выбери 3 клипа.</div>`;
    panelExport.innerHTML = `<div class="panelTitle">Экспорт</div><div class="muted">Сначала выбери 3 клипа.</div>`;

    // if already have exportUrl
    if (state.edit.exportUrl) {
      // enable next
      btnNext.disabled = false;
    }
  }

  async function exportWebmFromSelected(E, canvas, ctx) {
    // We record canvas video track + audio track from source video via captureStream (Chromium best).
    const ids = state.edit.selectedIds;
    const clips = ids.map((id) => (E.clips || []).find((c) => c.id === id)).filter(Boolean);
    if (clips.length !== 3) throw new Error("Need exactly 3 clips");

    // hidden video element for rendering
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = false;
    v.playsInline = true;
    v.preload = "auto";

    // canvas stream
    const fps = 30;
    const canvasStream = canvas.captureStream(fps);

    // audio: use video.captureStream() per clip; in Chromium audio track persists if we keep one stream.
    // We'll stitch by re-creating audio track per clip and re-recording in one recorder:
    // simpler approach: use v.captureStream() once and swap src; audio track usually stays alive in Chromium.
    const videoStream = v.captureStream ? v.captureStream() : null;

    const tracks = [];
    tracks.push(...canvasStream.getVideoTracks());
    if (videoStream && videoStream.getAudioTracks().length) {
      tracks.push(...videoStream.getAudioTracks());
    }

    const mixed = new MediaStream(tracks);

    const chunks = [];
    const rec = new MediaRecorder(mixed, { mimeType: "video/webm;codecs=vp8,opus" });

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };

    const done = new Promise((resolve, reject) => {
      rec.onstop = () => resolve();
      rec.onerror = (e) => reject(e.error || e);
    });

    // draw loop: draw v frame + overlays
    let stopDraw = false;

    const draw = () => {
      if (stopDraw) return;
      ctx.save();
      ctx.filter = `brightness(${clamp(state.edit.filter.brightness,0.5,1.5)}) contrast(${clamp(state.edit.filter.contrast,0.5,1.5)}) saturate(${clamp(state.edit.filter.saturate,0.5,1.8)})`;
      if (v.readyState >= 2) {
        const vw = v.videoWidth || 1280;
        const vh = v.videoHeight || 720;
        const cw = canvas.width;
        const ch = canvas.height;
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.drawImage(v, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();

      // overlays
      const O = state.edit.overlay;
      ctx.save();
      ctx.font = `800 ${clamp(Number(O.size||48),12,200)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = O.color || "#ff4dff";
      ctx.textBaseline = "top";
      if (O.stroke) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,.65)";
        ctx.strokeText(O.text || "", Number(O.x||40), Number(O.y||70));
      }
      ctx.fillText(O.text || "", Number(O.x||40), Number(O.y||70));
      ctx.restore();

      const S = state.edit.sticker;
      ctx.save();
      ctx.font = `${clamp(Number(S.size||140),30,400)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(S.emoji || "💀", Number(S.x||980), Number(S.y||180));
      ctx.restore();

      requestAnimationFrame(draw);
    };

    // Start recording
    rec.start(250);
    stopDraw = false;
    draw();

    // Play clips sequentially
    for (const clip of clips) {
      const cs = state.edit.clipSettings[clip.id] || { trimStart: 0, trimEnd: null, volume: 1 };
      v.src = clip.src;
      v.load();

      await waitCanPlay(v);

      // apply per-clip volume
      v.volume = clamp(Number(cs.volume ?? 1), 0, 2);

      // go to trimStart
      const start = clamp(Number(cs.trimStart || 0), 0, Math.max(0, v.duration || 9999));
      try { v.currentTime = start; } catch {}

      await v.play();

      if (cs.trimEnd != null && !Number.isNaN(Number(cs.trimEnd))) {
        const end = clamp(Number(cs.trimEnd), start, (v.duration || (start + 3)));
        // wait until reaches end
        await waitUntilTime(v, end);
        v.pause();
      } else {
        // wait natural end
        await waitEnded(v);
      }
    }

    // stop
    stopDraw = true;
    rec.stop();
    await done;

    const blob = new Blob(chunks, { type: "video/webm" });
    return URL.createObjectURL(blob);
  }

  function waitCanPlay(v) {
    return new Promise((resolve, reject) => {
      const onOk = () => cleanup(resolve);
      const onErr = () => cleanup(() => reject(new Error("Video load error")));

      const cleanup = (cb) => {
        v.removeEventListener("canplay", onOk);
        v.removeEventListener("error", onErr);
        cb();
      };

      v.addEventListener("canplay", onOk, { once: true });
      v.addEventListener("error", onErr, { once: true });
    });
  }

  function waitEnded(v) {
    return new Promise((resolve) => v.addEventListener("ended", resolve, { once: true }));
  }

  function waitUntilTime(v, t) {
    return new Promise((resolve) => {
      const tick = () => {
        if (v.currentTime >= t - 0.02 || v.paused) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // ---------------------------
  // Escape helpers (safety)
  // ---------------------------
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("`", "&#096;");
  }

  function renderKeyMasked(key, len) {
    const k = String(key || "");
    const L = len || 12;
    return k.padEnd(L, "—");
  }

  // ---------------------------
  // Mount hooks after render
  // ---------------------------
  const _origRender = render;
  render = function () {
    _origRender();
    // after each render, if edit level shown — mount it
    setTimeout(mountEditLevelIfNeeded, 0);
  };

  // ---------------------------
  // Start
  // ---------------------------
  (async () => {
    // pre-track
    if (DATA.musicTracks && DATA.musicTracks.length) {
      setBgmTrack(state.audio.trackIndex);
    }

    // initial render
    render();

    // Try background music
    await tryStartBgm();
    ensureBgmOnUserGestureOnce();
  })();

})();
