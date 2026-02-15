/* game/app.js
   One-file vanilla app for "Квест для Марка"
   - Supports MCQ levels + VIDEO levels (type:"video")
   - VIDEO: pauses at stopAt, shows options, on correct continues and counts level only after video ends
*/

(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  // closest() safe for text nodes (Firefox иногда отдаёт Text как target)
  function closestSafe(node, sel) {
    if (!node) return null;
    if (node.nodeType === 1) return node.closest(sel);
    return node.parentElement ? node.parentElement.closest(sel) : null;
  }

  // ---------- data ----------
  const DATA = window.QUIZ_DATA;
  if (!DATA || !Array.isArray(DATA.levels)) {
    document.body.innerHTML = `
      <div style="max-width:980px;margin:20px auto;padding:16px;font:14px system-ui;color:#fff;background:#2b0f17;border:1px solid #5b1b2f;border-radius:14px">
        <b>Ошибка:</b> не найден <code>window.QUIZ_DATA</code>.<br/>
        Проверь, что <code>game/data.js</code> загружается <b>перед</b> <code>game/app.js</code>.
      </div>`;
    return;
  }

  const TOTAL = DATA.levels.length;
  const STORAGE_KEY = "mark-quest:v1";

  // ---------- state ----------
  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { started: false, levelIndex: 0, key: "", completed: false, vol: 0.45 };
      const s = JSON.parse(raw);
      return {
        started: !!s.started,
        levelIndex: clamp(Number(s.levelIndex || 0), 0, TOTAL - 1),
        key: String(s.key || ""),
        completed: !!s.completed,
        vol: typeof s.vol === "number" ? clamp(s.vol, 0, 1) : 0.45
      };
    } catch {
      return { started: false, levelIndex: 0, key: "", completed: false, vol: 0.45 };
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  // ---------- audio (bgm) ----------
  const music = new Audio();
  music.loop = true;
  music.preload = "auto";
  music.volume = state.vol ?? 0.45;

  let musicReady = false;
  let userInteracted = false;

  function ensureMusicReady() {
    if (musicReady) return;
    const tracks = Array.isArray(DATA.musicTracks) ? DATA.musicTracks : [];
    if (!tracks.length) return;
    music.src = tracks[0];
    musicReady = true;
  }

  async function tryPlayMusic() {
    ensureMusicReady();
    if (!musicReady) return;
    if (music.paused) {
      try { await music.play(); } catch {}
    }
  }

  function setVolume(v) {
    state.vol = clamp(v, 0, 1);
    music.volume = state.vol;
    saveState();
    const pct = Math.round(state.vol * 100);
    const el = $("#audioPct");
    if (el) el.textContent = `${pct}%`;
  }

  // unlock audio on first interaction
  window.addEventListener("pointerdown", () => {
    userInteracted = true;
    tryPlayMusic();
  }, { once: true, passive: true });

  // ---------- render ----------
  const app = $("#app");
  if (!app) return;

  function setMain(html) {
    app.innerHTML = html;
    const screen = $("#screen");
    if (screen) {
      screen.classList.remove("is-in");
      requestAnimationFrame(() => screen.classList.add("is-in"));
    }
  }

  function headerHTML() {
    const pct = Math.round((state.vol ?? 0.45) * 100);
    return `
      <div class="topbar">
        <div class="brand">
          <div class="brandTitle">🎁 🎁 🎁 <span>${esc(DATA.title || "Квест")}</span></div>
          <div class="brandSub">${esc(DATA.subtitle || "")}</div>
        </div>

        <div class="audio">
          <button class="audioBtn" id="audioToggle" title="Музыка">🔊</button>
          <input class="audioRange" id="audioRange" type="range" min="0" max="1" step="0.01" value="${esc(state.vol ?? 0.45)}" />
          <div class="audioPct" id="audioPct">${pct}%</div>
        </div>
      </div>
      <div class="progressBar"><div class="progressFill" style="width:${(state.key.length / (DATA.keyLength || TOTAL)) * 100}%"></div></div>
    `;
  }

  function keyCardHTML() {
    const keyLen = Number(DATA.keyLength || TOTAL);
    const masked = (state.key || "").padEnd(keyLen, "—");
    return `
      <div class="card keyCard">
        <div class="keyTitle">🔑 <b>Ключ</b></div>
        <div class="small">Собери ${keyLen} символов:</div>
        <div class="keyBox">${esc(masked)}</div>
        <div class="small" style="margin-top:10px">Прогресс: <b>${esc(state.key.length)}</b>/${esc(keyLen)}</div>
      </div>
    `;
  }

  function bindAudioUI() {
    const rng = $("#audioRange");
    const btn = $("#audioToggle");
    if (rng) {
      rng.addEventListener("input", () => {
        setVolume(Number(rng.value));
        if (userInteracted) tryPlayMusic();
      });
    }
    if (btn) {
      btn.addEventListener("click", async () => {
        if (!musicReady) ensureMusicReady();
        if (!userInteracted) userInteracted = true;
        if (music.paused) {
          await tryPlayMusic();
        } else {
          music.pause();
        }
      });
    }
  }

  function resetProgress() {
    state.started = false;
    state.completed = false;
    state.levelIndex = 0;
    state.key = "";
    saveState();
    render();
  }

  function startScreen() {
    setMain(`
      <div class="screen" id="screen">
        ${headerHTML()}
        <div class="grid grid-1">
          <div class="card pad-lg">
            <div style="font-size:42px;font-weight:900;letter-spacing:-.02em">🎁 ${esc(DATA.title || "Квест")}</div>
            <div class="muted" style="margin-top:8px">${esc(DATA.subtitle || "")}</div>
            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn" id="btnStart">Начать</button>
              <button class="btn btnGhost" id="btnReset">Сбросить прогресс</button>
            </div>
          </div>

          ${keyCardHTML()}
        </div>
      </div>
    `);

    bindAudioUI();

    $("#btnStart")?.addEventListener("click", () => {
      state.started = true;
      state.completed = false;
      state.levelIndex = clamp(state.levelIndex || 0, 0, TOTAL - 1);
      saveState();
      tryPlayMusic();
      render();
    });

    $("#btnReset")?.addEventListener("click", resetProgress);
  }

  function onCorrectAnswer(char) {
    if (char && typeof char === "string") {
      const keyLen = Number(DATA.keyLength || TOTAL);
      if (state.key.length < keyLen) state.key += char;
    }

    if (state.levelIndex >= TOTAL - 1) {
      state.completed = true;
      saveState();
      render();
      return;
    }

    state.levelIndex++;
    saveState();
    render();
  }

  function renderQuizLevel(level, shownNum) {
    const options = Array.isArray(level.options) ? level.options : [];
    const title = level.title || `Уровень ${shownNum}/${TOTAL}`;
    const question = level.question || "";

    setMain(`
      <div class="screen" id="screen">
        ${headerHTML()}
        <div class="grid grid-2">
          <div class="card pad-lg level">
            <div class="muted">Уровень ${esc(shownNum)}/${esc(TOTAL)}</div>
            <div class="levelTitle">${esc(title)}</div>
            <div class="levelQ">${esc(question)}</div>

            <div class="opts" id="opts">
              ${options.map((t, i) => `
                <button class="btn optBtn" data-idx="${i}">
                  <span class="optKey">${String.fromCharCode(65 + i)}</span>
                  <span class="optText">${esc(t)}</span>
                </button>
              `).join("")}
            </div>

            <div id="msg" class="msg" aria-live="polite"></div>

            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btnGhost" id="btnReset">Сбросить прогресс</button>
            </div>
          </div>

          ${keyCardHTML()}
        </div>
      </div>
    `);

    bindAudioUI();
    $("#btnReset")?.addEventListener("click", resetProgress);

    const msg = $("#msg");

    $("#opts")?.addEventListener("click", (e) => {
      const btn = closestSafe(e.target, ".optBtn");
      if (!btn) return;

      const idx = Number(btn.dataset.idx);
      const ok = idx === Number(level.answerIndex);

      if (!ok) {
        if (msg) {
          msg.classList.remove("ok");
          msg.classList.add("bad");
          msg.textContent = "✖ Неверно. Попробуй ещё.";
        }
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 220);
        return;
      }

      if (msg) {
        msg.classList.remove("bad");
        msg.classList.add("ok");
        msg.textContent = "✔ Верно!";
      }

      $$(".optBtn").forEach(b => b.disabled = true);
      setTimeout(() => onCorrectAnswer(level.keyChar || ""), 420);
    });
  }

  function renderVideoLevel(level, shownNum) {
    const title = level.title || `Уровень ${shownNum}/${TOTAL}`;
    const question = level.question || "";
    const stopAt = Number(level.stopAt ?? 0);
    const options = Array.isArray(level.options) ? level.options : [];
    const src = level.videoSrc || level.src || "";

    setMain(`
      <div class="screen" id="screen">
        ${headerHTML()}
        <div class="grid grid-2">
          <div class="card pad-lg level">
            <div class="muted">Уровень ${esc(shownNum)}/${esc(TOTAL)}</div>
            <div class="levelTitle">${esc(title)}</div>
            <div class="levelQ">${esc(question)}</div>

            <div class="card" style="margin-top:14px;padding:12px">
              <div class="vWrap">
                <video id="video" class="v" src="${esc(src)}" controls playsinline preload="metadata"></video>
                <button id="videoStartBtn" class="vStart" type="button">▶ Смотреть</button>
              </div>
              <div class="small" style="margin-top:10px;opacity:.9">
                После остановки выбери вариант, чтобы видео продолжилось.
              </div>
            </div>

            <div class="opts" id="videoOptions" style="display:none;margin-top:14px">
              ${options.map((t, i) => `
                <button class="btn optBtn" data-idx="${i}">
                  <span class="optKey">${String.fromCharCode(65 + i)}</span>
                  <span class="optText">${esc(t)}</span>
                </button>
              `).join("")}
            </div>

            <div id="msg" class="msg" aria-live="polite"></div>

            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btnGhost" id="btnReset">Сбросить прогресс</button>
            </div>
          </div>

          ${keyCardHTML()}
        </div>
      </div>
    `);

    bindAudioUI();
    $("#btnReset")?.addEventListener("click", resetProgress);

    const v = $("#video");
    const startBtn = $("#videoStartBtn");
    const optWrap = $("#videoOptions");
    const msg = $("#msg");

    let gated = false;
    let solved = false;

    function showOptions() {
      if (!optWrap) return;
      optWrap.style.display = "";
      optWrap.classList.add("reveal");
      setTimeout(() => optWrap.classList.remove("reveal"), 300);
    }

    function hideOptions() {
      if (!optWrap) return;
      optWrap.style.display = "none";
    }

    function gateCheck() {
      if (!v || solved) return;
      if (stopAt > 0 && v.currentTime >= stopAt && !gated) {
        gated = true;
        v.pause();
        try { v.currentTime = stopAt; } catch {}
        showOptions();
      }
    }

    if (v) {
      v.addEventListener("timeupdate", gateCheck);
      v.addEventListener("seeked", gateCheck);

      // засчитываем уровень ТОЛЬКО когда видео закончилось, и только если solved
      v.addEventListener("ended", () => {
        if (solved) onCorrectAnswer(level.keyChar || "");
      });
    }

    startBtn?.addEventListener("click", async () => {
      startBtn.style.display = "none";
      try { await v.play(); } catch {}
    });

    if (!(stopAt > 0)) showOptions();

    optWrap?.addEventListener("click", async (e) => {
      const btn = closestSafe(e.target, ".optBtn");
      if (!btn || !v) return;

      const idx = Number(btn.dataset.idx);
      const ok = idx === Number(level.answerIndex);

      if (!ok) {
        if (msg) {
          msg.classList.remove("ok");
          msg.classList.add("bad");
          msg.textContent = "✖ Неверно. Попробуй ещё.";
        }
        if (stopAt > 0) {
          v.pause();
          try { v.currentTime = stopAt; } catch {}
          gated = true;
        }
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 220);
        return;
      }

      solved = true;
      hideOptions();

      if (msg) {
        msg.classList.remove("bad");
        msg.classList.add("ok");
        msg.textContent = "✔ Верно. Смотри продолжение…";
      }

      // чтобы не срабатывал gateCheck повторно на той же секунде
      try {
        if (stopAt > 0) v.currentTime = Math.min(stopAt + 0.08, (v.duration || stopAt + 0.08));
      } catch {}

      try { await v.play(); } catch {}
    });
  }

  function finalScreen() {
    const keyLen = Number(DATA.keyLength || TOTAL);
    const key = (state.key || "").padEnd(keyLen, "—");

    setMain(`
      <div class="screen" id="screen">
        ${headerHTML()}
        <div class="grid grid-1">
          <div class="card pad-lg">
            <div style="font-size:42px;font-weight:900;letter-spacing:-.02em">🎉 Финал</div>
            <div class="muted" style="margin-top:8px">Ключ собран:</div>
            <div class="keyBox" style="margin-top:12px;font-size:20px">${esc(key)}</div>

            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn" id="btnAgain">Пройти ещё раз</button>
              <button class="btn btnGhost" id="btnReset">Сбросить прогресс</button>
            </div>
          </div>

          ${keyCardHTML()}
        </div>
      </div>
    `);

    bindAudioUI();

    $("#btnAgain")?.addEventListener("click", () => {
      state.started = true;
      state.completed = false;
      state.levelIndex = 0;
      state.key = "";
      saveState();
      render();
    });

    $("#btnReset")?.addEventListener("click", resetProgress);
  }

  function render() {
    if (!state.started) return startScreen();
    if (state.completed) return finalScreen();

    state.levelIndex = clamp(state.levelIndex, 0, TOTAL - 1);
    const level = DATA.levels[state.levelIndex];
    const shownNum = state.levelIndex + 1;

    // музыку не трогаем при переходах (не будет “провалов”)
    if (userInteracted) tryPlayMusic();

    if (level && level.type === "video") return renderVideoLevel(level, shownNum);
    return renderQuizLevel(level || {}, shownNum);
  }

  // ---------- init ----------
  ensureMusicReady();
  render();

})();
