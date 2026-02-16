/* Mark Quest — app.js (Figma UI, vanilla)
   Vanilla JS. Reads window.QUIZ_DATA from data.js.
   Logic preserved:
   - 12 levels; correct adds 1 char; wrong doesn't advance
   - music starts after user interaction
   - video level: stopAt gate, options after stop, correct resumes, level completes on ended
*/
(() => {
  "use strict";

  const DATA = window.QUIZ_DATA;
  const ROOT = document.getElementById("app");
  if (!ROOT) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function safeClosest(target, selector) {
    const el = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
    return el && el.closest ? el.closest(selector) : null;
  }

  if (!DATA || !Array.isArray(DATA.levels)) {
    ROOT.innerHTML = `
      <div class="screen show">
        <div class="card pad-lg">
          <div class="h1">Ошибка</div>
          <div class="muted">Не найден <b>window.QUIZ_DATA</b> или <b>levels</b>.</div>
          <div class="muted" style="margin-top:10px">Проверь, что <code>game/data.js</code> подключён <b>перед</b> <code>game/app.js</code>.</div>
        </div>
      </div>
    `;
    return;
  }

  const TOTAL = DATA.levels.length;
  const KEY_LEN = Number.isFinite(DATA.keyLength) ? DATA.keyLength : TOTAL;

  const STORAGE_KEY = "markquest_state_v4";
  const VOL_KEY = "markquest_volume_v3";
  const TRACK_KEY = "markquest_track_v3";

  /** @type {{levelIndex:number, key:string}} */
  let state = loadState();

  // ---------------- Music ----------------
  const music = new Audio();
  music.loop = true;
  music.preload = "auto";

  const tracks = Array.isArray(DATA.musicTracks) ? DATA.musicTracks.filter(Boolean) : [];
  let chosen = localStorage.getItem(TRACK_KEY) || "";
  if (!chosen && tracks.length) {
    chosen = tracks[Math.floor(Math.random() * tracks.length)];
    localStorage.setItem(TRACK_KEY, chosen);
  }
  if (chosen) music.src = chosen;

  let volume = parseFloat(localStorage.getItem(VOL_KEY) || "0.65");
  if (!Number.isFinite(volume)) volume = 0.65;
  volume = clamp(volume, 0, 1);
  music.volume = volume;

  function ensureMusicStarted() {
    if (!music.src) return;
    if (!music.paused) return;
    music.play().catch(() => {});
  }

  // ---------------- Screen transitions (Figma-like) ----------------
  function setMain(screenInnerHtml) {
    const prev = ROOT.querySelector(".screen");

    const mount = (html) => {
      ROOT.innerHTML = `
        <div class="screen is-entering">
          ${html}
        </div>
      `;
      const s = ROOT.querySelector(".screen");
      requestAnimationFrame(() => s && s.classList.add("is-ready"));
    };

    if (!prev) {
      mount(screenInnerHtml);
      return;
    }

    prev.classList.add("is-leaving");
    setTimeout(() => mount(screenInnerHtml), 240);
  }

  // ---------------- HUD ----------------
  function hudHtml() {
    const progress = clamp(state.levelIndex, 0, TOTAL) / TOTAL;
    const pct = Math.round(progress * 100);

    return `
      <div class="topbar">
        <div class="brand">
          <div class="brand-title">MARK QUEST</div>
          <div class="brand-subtitle">BIRTHDAY SPECIAL EDITION</div>
          <div class="brand-underline"></div>
        </div>

        <div class="audio">
          <button class="audioBtn" id="muteBtn" aria-label="Mute">${music.volume <= 0.001 ? "🔇" : "🔊"}</button>
          <input id="vol" class="audioRange" type="range" min="0" max="1" step="0.01" value="${music.volume}">
        </div>
      </div>

      <div class="progressBar" aria-hidden="true">
        <div class="progressFill" style="width:${(progress * 100).toFixed(2)}%"></div>
      </div>
    `;
  }

  function bindHud() {
    const vol = $("#vol");
    const muteBtn = $("#muteBtn");

    if (vol) {
      vol.addEventListener("input", () => {
        volume = clamp(parseFloat(vol.value), 0, 1);
        music.volume = volume;
        localStorage.setItem(VOL_KEY, String(volume));
        if (muteBtn) muteBtn.textContent = volume <= 0.001 ? "🔇" : "🔊";
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        ensureMusicStarted();
        if (music.volume > 0.001) {
          volume = music.volume;
          music.volume = 0;
          localStorage.setItem(VOL_KEY, "0");
          if (vol) vol.value = "0";
          muteBtn.textContent = "🔇";
        } else {
          const restore = clamp(volume || 0.65, 0.05, 1);
          music.volume = restore;
          localStorage.setItem(VOL_KEY, String(restore));
          if (vol) vol.value = String(restore);
          muteBtn.textContent = "🔊";
        }
      });
    }
  }

  // ---------------- UI helpers ----------------
  function dotsHtml(activeIndexInclusive) {
    const dots = [];
    for (let i = 0; i < TOTAL; i++) {
      dots.push(`<span class="dot ${i <= activeIndexInclusive ? "is-active" : ""}"></span>`);
    }
    return `<div class="dots" aria-hidden="true">${dots.join("")}</div>`;
  }

  function keyCardHtml(shownNumMinus1) {
    const raw = (state.key || "");
    const filled = raw.padEnd(KEY_LEN, "_").slice(0, KEY_LEN);
    const slots = [];
    for (let i = 0; i < KEY_LEN; i++) {
      const ch = filled[i];
      const v = ch && ch !== "_" ? esc(ch) : "?";
      const isKnown = v !== "?";
      slots.push(`<div class="keySlot ${isKnown ? "is-known" : ""}">${v}</div>`);
    }

    const progress = clamp(state.levelIndex, 0, TOTAL) / TOTAL;
    const pct = Math.round(progress * 100);

    return `
      <div class="card pad-lg keyCard">
        <div class="keyTitle">СЕКРЕТНЫЙ КЛЮЧ</div>

        <div class="keyGrid">${slots.join("")}</div>

        <div class="keyFooter">
          <div class="keyLabel">ПРОГРЕСС</div>
          <div class="keyPct">${pct}%</div>
        </div>
        <div class="keyBar"><div class="keyBarFill" style="width:${(progress*100).toFixed(2)}%"></div></div>

        <button class="linkBtn" id="resetBtn" type="button">Сбросить прогресс</button>
      </div>
    `;
  }

  // ---------------- Rendering ----------------
  function render() {
    if (state.levelIndex >= TOTAL) {
      renderFinish();
      return;
    }
    const level = DATA.levels[state.levelIndex];
    if (!level) { renderFinish(); return; }

    if (String(level.type || "").toLowerCase() === "video") {
      renderVideoLevel(level, state.levelIndex + 1);
    } else {
      renderQuizLevel(level, state.levelIndex + 1);
    }
  }

  function renderStart() {
    setMain(`
      ${hudHtml()}
      <div class="grid2">
        <div class="card pad-lg">
          <div class="kicker">УРОВЕНЬ 0/${TOTAL}</div>
          <div class="h1">${esc(DATA.startTitle || "Готов?")}</div>
          <div class="muted" style="margin-top:10px">${esc(DATA.startText || "Нажми «Начать», включи звук и наслаждайся.")}</div>

          <div class="startRow">
            <button class="btnPrimary" id="startBtn" type="button"><span>First Step</span></button>
          </div>
        </div>

        ${keyCardHtml(0)}
      </div>
    `);

    bindHud();

    $("#startBtn")?.addEventListener("click", () => {
      ensureMusicStarted();
      render();
    });
    $("#resetBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function renderFinish() {
    setMain(`
      ${hudHtml()}
      <div class="grid2">
        <div class="card pad-lg">
          <div class="kicker">ФИНАЛ</div>
          <div class="h1">Готово.</div>
          <div class="muted" style="margin-top:10px">Ты собрал весь ключ.</div>

          <div class="startRow">
            <button class="btnPrimary" id="againBtn" type="button"><span>Ещё раз</span></button>
          </div>
        </div>

        ${keyCardHtml(TOTAL)}
      </div>
    `);

    bindHud();
    $("#againBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
    $("#resetBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function renderQuizLevel(level, shownNum) {
    const title = level.title || `УРОВЕНЬ ${shownNum}/${TOTAL}`;
    const question = level.question || "";
    const opts = Array.isArray(level.options) ? level.options : [];
    const answerIndex = Number(level.answerIndex ?? 0);

    setMain(`
      ${hudHtml()}
      <div class="grid2">
        <div class="card pad-lg">
          <div class="cardTop">
            <div class="kicker">${esc(title)}</div>
            ${dotsHtml(shownNum - 1)}
          </div>

          <div class="qTitle">${esc(question)}</div>

          <div class="optGrid">
            ${opts.map((t, i) => `
              <button class="optCard" type="button" data-idx="${i}">
                <span class="optText">${esc(t)}</span>
                <span class="optDot"></span>
              </button>
            `).join("")}
          </div>

          <div id="msg" class="msg muted"></div>
        </div>

        ${keyCardHtml(shownNum - 1)}
      </div>
    `);

    bindHud();
    ensureMusicStarted();

    const msg = $("#msg");

    $$(".optCard").forEach(btn => {
      btn.addEventListener("click", () => {
        ensureMusicStarted();

        // UI: single selection highlight
        $$(".optCard").forEach(b => b.classList.remove("is-selected","is-wrong","is-correct"));
        btn.classList.add("is-selected");

        const idx = Number(btn.dataset.idx);
        const ok = idx === answerIndex;

        if (!ok) {
          if (msg) msg.textContent = "Неверно. Попробуй ещё.";
          btn.classList.add("is-wrong");
          return;
        }

        if (msg) msg.textContent = "Верно!";
        btn.classList.add("is-correct");

        // small delay to let the UI breathe (figma feel)
        setTimeout(() => onCorrectAnswer(level.keyChar ?? ""), 260);
      });
    });

    $("#resetBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function renderVideoLevel(level, shownNum) {
    const title = level.title || `УРОВЕНЬ ${shownNum}/${TOTAL}`;
    const question = level.question || "Смотри отрывок до кульминации. Что будет дальше?";
    const videoSrc = level.videoSrc || "";
    const stopAt = Number(level.stopAt ?? 0);
    const opts = Array.isArray(level.options) ? level.options : [];
    const answerIndex = Number(level.answerIndex ?? 0);

    setMain(`
      ${hudHtml()}
      <div class="grid2">
        <div class="card pad-lg">
          <div class="cardTop">
            <div class="kicker">${esc(title)}</div>
            ${dotsHtml(shownNum - 1)}
          </div>

          <div class="qTitle">${esc(question)}</div>

          <div class="videoWrap">
            <video id="video" class="video" src="${esc(videoSrc)}" controls preload="metadata" playsinline></video>
            <button id="videoStartBtn" class="btnPrimary videoOverlay" type="button"><span>Смотреть</span></button>
          </div>

          <div id="videoOptions" class="optGrid" style="display:none">
            ${opts.map((t, i) => `
              <button class="optCard" type="button" data-idx="${i}">
                <span class="optText">${esc(t)}</span>
                <span class="optDot"></span>
              </button>
            `).join("")}
          </div>

          <div id="msg" class="msg muted"></div>
        </div>

        ${keyCardHtml(shownNum - 1)}
      </div>
    `);

    bindHud();
    ensureMusicStarted();

    const v = $("#video");
    const startBtn = $("#videoStartBtn");
    const optionsEl = $("#videoOptions");
    const msg = $("#msg");

    let gated = false;
    let solved = false;

    function showOptions() {
      if (optionsEl) optionsEl.style.display = "";
      if (msg) msg.textContent = "Выбери вариант, чтобы продолжить.";
    }
    function hideOptions() {
      if (optionsEl) optionsEl.style.display = "none";
    }

    function gateCheck() {
      if (!v || solved) return;
      if (stopAt > 0 && v.currentTime >= stopAt && !gated) {
        gated = true;
        try { v.pause(); } catch (_) {}
        try { v.currentTime = stopAt; } catch (_) {}
        showOptions();
      }
    }

    if (v) {
      const startPlayback = () => {
        ensureMusicStarted();
        startBtn?.classList.add("is-hidden");
        v.play().catch(() => {});
      };
      startBtn?.addEventListener("click", startPlayback);
      v.addEventListener("play", () => startBtn?.classList.add("is-hidden"));

      v.addEventListener("timeupdate", gateCheck);
      v.addEventListener("seeking", gateCheck);

      v.addEventListener("ended", () => {
        if (!solved) return;
        onCorrectAnswer(level.keyChar ?? "");
      });

      if (!(stopAt > 0)) showOptions();
    }

    $$("#videoOptions .optCard").forEach(btn => {
      btn.addEventListener("click", () => {
        ensureMusicStarted();
        if (solved) return;

        $$("#videoOptions .optCard").forEach(b => b.classList.remove("is-selected","is-wrong","is-correct"));
        btn.classList.add("is-selected");

        const idx = Number(btn.dataset.idx);
        const ok = idx === answerIndex;

        if (!ok) {
          if (msg) msg.textContent = "Неверно. Попробуй ещё.";
          btn.classList.add("is-wrong");
          if (v && stopAt > 0) {
            try { v.pause(); } catch (_) {}
            try { v.currentTime = stopAt; } catch (_) {}
          }
          return;
        }

        solved = true;
        btn.classList.add("is-correct");
        hideOptions();
        if (msg) msg.textContent = "Верно. Смотри продолжение…";

        if (v) {
          if (stopAt > 0) {
            try { v.currentTime = Math.min(stopAt + 0.08, (v.duration || stopAt + 0.08)); } catch (_) {}
          }
          v.play().catch(() => {});
        } else {
          onCorrectAnswer(level.keyChar ?? "");
        }
      });
    });

    $("#resetBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function onCorrectAnswer(char) {
    const c = String(char ?? "");
    if (c) state.key += c;
    state.levelIndex += 1;
    saveState();
    render();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { levelIndex: 0, key: "" };
      const obj = JSON.parse(raw);
      const li = Number(obj.levelIndex ?? 0);
      const key = String(obj.key ?? "");
      return { levelIndex: Number.isFinite(li) ? li : 0, key };
    } catch (_) {
      return { levelIndex: 0, key: "" };
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function resetState() {
    state = { levelIndex: 0, key: "" };
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try { localStorage.removeItem(TRACK_KEY); } catch (_) {}
  }

  // ---------------- Micro interactions ----------------
  // 1) BG aura follows cursor: CSS reads --px/--py (smoothed)
  (() => {
    const root = document.documentElement;
    let raf = 0;
    let x = 0.5, y = 0.35, tx = x, ty = y;

    function tick(){
      raf = 0;
      x += (tx - x) * 0.10;
      y += (ty - y) * 0.10;
      root.style.setProperty("--px", (x*100).toFixed(2) + "%");
      root.style.setProperty("--py", (y*100).toFixed(2) + "%");
      if (Math.abs(tx-x) + Math.abs(ty-y) > 0.002) raf = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", (e) => {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      tx = e.clientX / vw;
      ty = e.clientY / vh;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive:true });
  })();

  // 2) Button glow position: CSS can read --bx/--by if needed
  document.addEventListener("pointermove", (e) => {
    const el = safeClosest(e.target, ".btnPrimary, .optCard, .linkBtn");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--bx", mx.toFixed(2) + "%");
    el.style.setProperty("--by", my.toFixed(2) + "%");
  }, { passive: true });

  // ---------------- Start ----------------
  if (state.levelIndex === 0 && !state.key) {
    renderStart();
  } else {
    render();
  }
})();
