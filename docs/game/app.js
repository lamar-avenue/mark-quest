/* Mark Quest — app.js
   Vanilla JS. Reads window.QUIZ_DATA from data.js.
   Supports:
   - обычные уровни (вопрос + варианты)
   - video-уровень: стоп на stopAt, варианты появляются, при верном — видео продолжается, уровень засчитывается по ended.
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
// ===== Progress pulse feedback =====
function pulseProgress(kind = "ok") {
  const fill = document.querySelector(".progressFill");
  const bar  = document.querySelector(".progressBar");
  if (!fill || !bar) return;

  fill.classList.remove("pulseOk", "pulseBad");
  bar.classList.remove("barPulse");

  // форсим перезапуск анимации
  void fill.offsetWidth;

  fill.classList.add(kind === "bad" ? "pulseBad" : "pulseOk");
  bar.classList.add("barPulse");

  setTimeout(() => {
    fill.classList.remove("pulseOk", "pulseBad");
    bar.classList.remove("barPulse");
  }, 560);
}

  const TOTAL = DATA.levels.length;
  const KEY_LEN = Number.isFinite(DATA.keyLength) ? DATA.keyLength : TOTAL;

  const STORAGE_KEY = "markquest_state_v3";
  const VOL_KEY = "markquest_volume_v2";
  const TRACK_KEY = "markquest_track_v2";

  /** @type {{levelIndex:number, key:string}} */
  let state = loadState();
  
function clearFeedback(){
  document.querySelectorAll(".optBtn.is-wrong,.optBtn.is-correct,.optBtn.pop,.optBtn.shakeHard")
    .forEach(el => el.classList.remove("is-wrong","is-correct","pop","shakeHard"));
  document.querySelectorAll(".options.dimOthers")
    .forEach(el => el.classList.remove("dimOthers"));
}

function markWrong(btn){
  clearFeedback();
  btn.classList.add("is-wrong","shakeHard");
  setTimeout(() => btn.classList.remove("shakeHard"), 450);
}

function markCorrect(btn){
  clearFeedback();
  btn.classList.add("is-correct","pop");
  const wrap = btn.closest(".options");
  if (wrap) wrap.classList.add("dimOthers");
  setTimeout(() => btn.classList.remove("pop"), 350);
}

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

  // ---------------- Rendering ----------------
  function setMain(html) {
    ROOT.innerHTML = html;
    const screen = $(".screen", ROOT);
    if (screen) {
      requestAnimationFrame(() => screen.classList.add("show"));
    }
  }

  function hudHtml() {
    const progress = clamp(state.levelIndex, 0, TOTAL) / TOTAL;
    const key = (state.key || "").padEnd(KEY_LEN, "_").slice(0, KEY_LEN);

    return `
      <div class="topbar">
        <div>
          <div class="brandTitle">🎁 🎁 🎁 ${esc(DATA.title || "Квест для Марка")}</div>
          <div class="brandSub muted">${esc(DATA.subtitle || "12 уровней. За каждый — 1 символ. Собери ключ и откроешь финал.")}</div>

          <div class="pills" style="margin-top:10px">
            <div class="pill">🍀 ${TOTAL} уровней</div>
            <div class="pill">🔑 <span class="mono">${esc(key)}</span></div>
          </div>
        </div>

        <div class="audio">
          <button class="audioBtn" id="muteBtn" aria-label="Mute">${music.volume <= 0.001 ? "🔇" : "🔊"}</button>
          <input id="vol" class="audioRange" type="range" min="0" max="1" step="0.01" value="${music.volume}">
          <div class="audioPct muted">${Math.round(music.volume * 100)}%</div>
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
    const pct = $(".audioPct");

    if (vol) {
      vol.addEventListener("input", () => {
        volume = clamp(parseFloat(vol.value), 0, 1);
        music.volume = volume;
        localStorage.setItem(VOL_KEY, String(volume));
        if (pct) pct.textContent = `${Math.round(volume * 100)}%`;
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
          if (pct) pct.textContent = "0%";
          muteBtn.textContent = "🔇";
        } else {
          const restore = clamp(volume || 0.65, 0.05, 1);
          music.volume = restore;
          localStorage.setItem(VOL_KEY, String(restore));
          if (vol) vol.value = String(restore);
          if (pct) pct.textContent = `${Math.round(restore * 100)}%`;
          muteBtn.textContent = "🔊";
        }
      });
    }
  }

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
    const key = (state.key || "").padEnd(KEY_LEN, "_").slice(0, KEY_LEN);
    setMain(`
      <div class="screen">
        ${hudHtml()}

        <div class="grid2" style="margin-top:14px">
          <div class="card pad-lg">
            <div class="h1">${esc(DATA.title || "Квест для Марка")}</div>
            <div class="muted" style="margin-top:8px">${esc(DATA.subtitle || "")}</div>
            <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" id="startBtn">Начать</button>
              <button class="btn" id="resetBtn">Сбросить прогресс</button>
            </div>
          </div>

          <div class="card pad-lg keyCard">
            <div class="h2">🔑 Ключ</div>
            <div class="muted">Собери ${KEY_LEN} символов:</div>
            <div class="key mono" style="margin-top:10px">${esc(key)}</div>
            <div class="muted" style="margin-top:10px">Прогресс: ${clamp(state.levelIndex, 0, TOTAL)}/${TOTAL}</div>
          </div>
        </div>
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
    const key = (state.key || "").padEnd(KEY_LEN, "_").slice(0, KEY_LEN);
    setMain(`
      <div class="screen">
        ${hudHtml()}
        <div class="grid2" style="margin-top:14px">
          <div class="card pad-lg">
            <div class="h1">🎉 Финал</div>
            <div class="muted" style="margin-top:8px">Все уровни пройдены.</div>
            <div class="h2" style="margin-top:16px">Ключ:</div>
            <div class="key mono" style="margin-top:10px">${esc(key)}</div>
            <div style="margin-top:14px">
              <button class="btn" id="againBtn">Пройти ещё раз</button>
            </div>
          </div>

          <div class="card pad-lg">
            <div class="h2">Подсказка</div>
            <div class="muted" style="margin-top:8px">Если хочешь — добавим “вау”: мини-параллакс, подсветку по курсору, анимации экранов, красивый финальный экран.</div>
          </div>
        </div>
      </div>
    `);
    bindHud();
    $("#againBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function renderQuizLevel(level, shownNum) {
    const title = level.title || `Уровень ${shownNum}/${TOTAL}`;
    const question = level.question || "";
    const opts = Array.isArray(level.options) ? level.options : [];
    const answerIndex = Number(level.answerIndex ?? 0);

    setMain(`
      <div class="screen">
        ${hudHtml()}
        <div class="grid2" style="margin-top:14px">
          <div class="card pad-lg">
            <div class="muted">${esc(title)}</div>
            <div class="h2" style="margin-top:8px">${esc(question)}</div>

            <div class="options" style="margin-top:14px">
              ${opts.map((t, i) => `
                <button class="optBtn" data-idx="${i}"><span>${esc(t)}</span></button>
              `).join("")}
            </div>

            <div id="msg" class="msg muted" style="margin-top:12px; min-height:22px"></div>

            <div style="margin-top:14px">
              <button class="btn" id="resetBtn">Сбросить прогресс</button>
            </div>
          </div>

          <div class="card pad-lg keyCard">
            <div class="h2">🔑 Ключ</div>
            <div class="muted">Собери ${KEY_LEN} символов:</div>
            <div class="key mono" style="margin-top:10px">${esc((state.key || "").padEnd(KEY_LEN, "_").slice(0, KEY_LEN))}</div>
            <div class="muted" style="margin-top:10px">Прогресс: ${shownNum - 1}/${TOTAL}</div>
          </div>
        </div>
      </div>
    `);

    bindHud();
    ensureMusicStarted();

    const msg = $("#msg");

    $$(".optBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        ensureMusicStarted();
        const idx = Number(btn.dataset.idx);
        const ok = idx === answerIndex;

        if (!ok) {
          if (msg) msg.textContent = "✖ Неверно. Попробуй ещё.";
          btn.classList.add("shake");
          setTimeout(() => btn.classList.remove("shake"), 420);
          return;
        }

        if (msg) msg.textContent = "✔ Верно!";
        btn.classList.add("ok");
        onCorrectAnswer(level.keyChar ?? "");
      });
    });

    $("#resetBtn")?.addEventListener("click", () => {
      resetState();
      renderStart();
    });
  }

  function renderVideoLevel(level, shownNum) {
    const title = level.title || `Уровень ${shownNum}/${TOTAL}`;
    const question = level.question || "Смотри отрывок до кульминации. Что будет дальше?";
    const videoSrc = level.videoSrc || "";
    const stopAt = Number(level.stopAt ?? 0);
    const opts = Array.isArray(level.options) ? level.options : [];
    const answerIndex = Number(level.answerIndex ?? 0);

    setMain(`
      <div class="screen">
        ${hudHtml()}
        <div class="grid2" style="margin-top:14px">
          <div class="card pad-lg">
            <div class="muted">${esc(title)}</div>
            <div class="h2" style="margin-top:8px">${esc(question)}</div>

            <div class="videoWrap" style="margin-top:14px">
              <video id="video" class="video" src="${esc(videoSrc)}" controls preload="metadata" playsinline></video>
              <button id="videoStartBtn" class="videoStartBtn" type="button">▶ Смотреть</button>
            </div>

            <div id="videoOptions" class="options" style="margin-top:14px; display:none">
              ${opts.map((t, i) => `
                <button class="optBtn" data-idx="${i}"><span>${esc(t)}</span></button>
              `).join("")}
            </div>

            <div id="msg" class="msg muted" style="margin-top:12px; min-height:22px"></div>

            <div style="margin-top:14px">
              <button class="btn" id="resetBtn">Сбросить прогресс</button>
            </div>
          </div>

          <div class="card pad-lg keyCard">
            <div class="h2">🔑 Ключ</div>
            <div class="muted">Собери ${KEY_LEN} символов:</div>
            <div class="key mono" style="margin-top:10px">${esc((state.key || "").padEnd(KEY_LEN, "_").slice(0, KEY_LEN))}</div>
            <div class="muted" style="margin-top:10px">Прогресс: ${shownNum - 1}/${TOTAL}</div>
          </div>
        </div>
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
        startBtn?.classList.add("hide");
        v.play().catch(() => {});
      };
      startBtn?.addEventListener("click", startPlayback);
      v.addEventListener("play", () => startBtn?.classList.add("hide"));

      v.addEventListener("timeupdate", gateCheck);
      v.addEventListener("seeking", gateCheck);

      v.addEventListener("ended", () => {
        if (!solved) return;
        onCorrectAnswer(level.keyChar ?? "");
      });

      if (!(stopAt > 0)) showOptions();
    }

    $$("#videoOptions .optBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        ensureMusicStarted();
        if (solved) return;

        const idx = Number(btn.dataset.idx);
        const ok = idx === answerIndex;

        if (!ok) {
          if (msg) msg.textContent = "✖ Неверно. Попробуй ещё.";
          if (v && stopAt > 0) {
            try { v.pause(); } catch (_) {}
            try { v.currentTime = stopAt; } catch (_) {}
          }
          btn.classList.add("shake");
          setTimeout(() => btn.classList.remove("shake"), 420);
          return;
        }

        solved = true;
        hideOptions();
        if (msg) msg.textContent = "✔ Верно. Смотри продолжение…";

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

  // ---------------- Pointer / wow micro ----------------
  // 1) BG gradient follows cursor: CSS reads --px/--py
  document.addEventListener("pointermove", (e) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty("--px", x.toFixed(2) + "%");
    document.documentElement.style.setProperty("--py", y.toFixed(2) + "%");
  }, { passive: true });

  // 2) Button glow position: CSS reads --bx/--by and/or --mx/--my
  document.addEventListener("pointermove", (e) => {
    const el = safeClosest(e.target, ".btn, .optBtn, .pill");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--bx", mx.toFixed(2) + "%");
    el.style.setProperty("--by", my.toFixed(2) + "%");
    el.style.setProperty("--mx", mx.toFixed(2) + "%");
    el.style.setProperty("--my", my.toFixed(2) + "%");
  }, { passive: true });

  // 3) Card tilt (safe)
  document.addEventListener("pointermove", (e) => {
    const card = safeClosest(e.target, ".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width) - 0.5;
    const dy = ((e.clientY - r.top) / r.height) - 0.5;
    const rx = (-dy * 6).toFixed(2);
    const ry = (dx * 8).toFixed(2);
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    $$(".card").forEach(c => (c.style.transform = ""));
  }, true);

  // ---------------- Start ----------------
  if (state.levelIndex === 0 && !state.key) {
    renderStart();
  } else {
    render();
  }
})();
// Soft cursor aura for background (optional)
(function(){
  const root = document.documentElement;
  let raf = 0, x = 0.5, y = 0.35, tx = x, ty = y;

  function onMove(e){
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    tx = e.clientX / vw;
    ty = e.clientY / vh;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(){
    raf = 0;
    // smooth follow
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    root.style.setProperty('--mx', (x*100).toFixed(2) + '%');
    root.style.setProperty('--my', (y*100).toFixed(2) + '%');
    // continue smoothing if still far
    if (Math.abs(tx-x) + Math.abs(ty-y) > 0.002) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', onMove, { passive: true });
})();
// Cursor aura follow (background only). No tilt.
(() => {
  const root = document.documentElement;

  // стартовая позиция (чтобы не было "прыжка")
  let x = 0.5, y = 0.35;
  let tx = x, ty = y;
  let raf = 0;

  const setVars = () => {
    root.style.setProperty("--mx", (x * 100).toFixed(2) + "%");
    root.style.setProperty("--my", (y * 100).toFixed(2) + "%");
  };
  setVars();

  const tick = () => {
    raf = 0;
    // мягкое следование (не дёргается)
    x += (tx - x) * 0.10;
    y += (ty - y) * 0.10;
    setVars();

    // продолжаем пока “догоняет”
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) {
      raf = requestAnimationFrame(tick);
    }
  };

  window.addEventListener("pointermove", (e) => {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    tx = e.clientX / vw;
    ty = e.clientY / vh;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();
