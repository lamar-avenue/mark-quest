(() => {
  "use strict";

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // Firefox: click target can be TextNode (nodeType 3) => no .closest()
  const closestSafe = (node, sel) => {
    if (!node) return null;
    const el = node.nodeType === 1 ? node : node.parentElement; // element or parent
    if (!el || typeof el.closest !== "function") return null;
    return el.closest(sel);
  };

  // -------------------------
  // Data
  // -------------------------
  const DATA = window.QUIZ_DATA;
  if (!DATA || !Array.isArray(DATA.levels)) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="screen">
          <div class="card pad-lg">
            <div style="font-weight:900;font-size:22px">Ошибка</div>
            <div class="muted" style="margin-top:8px">
              Не найден window.QUIZ_DATA.<br>
              Проверь, что <b>game/data.js</b> подключен <b>перед</b> app.js и внутри есть <code>window.QUIZ_DATA = {...}</code>
            </div>
          </div>
        </div>`;
    }
    return;
  }

  const TOTAL = DATA.levels.length;
  const KEY_LEN = Number(DATA.keyLength || TOTAL) || TOTAL;

  // -------------------------
  // State (localStorage)
  // -------------------------
  const LS_KEY = "markquest_state_v1";
  const loadState = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) throw 0;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") throw 0;
      return {
        started: !!s.started,
        levelIndex: clamp(Number(s.levelIndex || 0), 0, TOTAL - 1),
        key: String(s.key || ""),
        completed: !!s.completed,
        // for video level runtime flags:
        videoSolved: false,
        videoGated: false,
      };
    } catch {
      return {
        started: false,
        levelIndex: 0,
        key: "",
        completed: false,
        videoSolved: false,
        videoGated: false,
      };
    }
  };

  let state = loadState();
  const saveState = () => {
    const safe = {
      started: state.started,
      levelIndex: state.levelIndex,
      key: state.key,
      completed: state.completed,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(safe));
  };

  const resetProgress = () => {
    state = {
      started: false,
      levelIndex: 0,
      key: "",
      completed: false,
      videoSolved: false,
      videoGated: false,
    };
    saveState();
    render();
  };

  const addKeyChar = (ch) => {
    if (!ch) return;
    if (state.key.length >= KEY_LEN) return;
    state.key += String(ch).slice(0, 1);
    saveState();
  };

  const nextLevel = () => {
    state.videoSolved = false;
    state.videoGated = false;

    if (state.levelIndex >= TOTAL - 1) {
      state.completed = true;
      saveState();
      render();
      return;
    }
    state.levelIndex++;
    saveState();
    render();
  };

  // -------------------------
  // Background pointer (gradient follows cursor)
  // -------------------------
  const attachPointerGradient = () => {
    const root = document.documentElement;
    let raf = 0;
    window.addEventListener(
      "pointermove",
      (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const x = (e.clientX / window.innerWidth) * 100;
          const y = (e.clientY / window.innerHeight) * 100;
          root.style.setProperty("--mx", x.toFixed(2) + "%");
          root.style.setProperty("--my", y.toFixed(2) + "%");
        });
      },
      { passive: true }
    );
  };

  // -------------------------
  // BGM (optional)
  // -------------------------
  let bg = null;

  const pickTrack = () => {
    const arr = Array.isArray(DATA.musicTracks) ? DATA.musicTracks : [];
    return arr.length ? arr[0] : null;
  };

  const ensureBgm = () => {
    const src = pickTrack();
    if (!src) return;

    if (!bg) {
      bg = new Audio(src);
      bg.loop = true;
      bg.preload = "auto";
      bg.volume = 0.12;
    } else if (bg.src && !bg.src.includes(src)) {
      bg.src = src;
    }
  };

  const syncVolumeUI = () => {
    const vol = $("#vol");
    const pct = $("#volPct");
    if (!vol || !pct) return;
    if (!bg) ensureBgm();

    vol.value = String(Math.round(((bg?.volume ?? 0.12) || 0) * 100));
    pct.textContent = `${vol.value}%`;
  };

  const setVolume = (val01) => {
    if (!bg) ensureBgm();
    if (!bg) return;
    bg.volume = clamp(val01, 0, 1);
    const pct = $("#volPct");
    if (pct) pct.textContent = `${Math.round(bg.volume * 100)}%`;
  };

  const playBgmSoft = async () => {
    ensureBgm();
    if (!bg) return;
    try {
      await bg.play();
    } catch {
      // autoplay can be blocked until user interaction
    }
  };

  // -------------------------
  // Render templates
  // -------------------------
  const headerHTML = () => {
    const keyShown = (state.key || "").padEnd(KEY_LEN, "—");
    const progress = `${Math.min(state.key.length, KEY_LEN)}/${KEY_LEN}`;
    const levelNum = state.started ? state.levelIndex + 1 : 0;
    const topTitle = esc(DATA.title || "Квест");
    const sub = esc(DATA.subtitle || "");

    const p = state.started ? Math.round(((state.levelIndex + 1) / TOTAL) * 100) : 0;

    return `
      <div class="topbar">
        <div class="brand">
          <div class="brandTitle">🎁 🎁 ${topTitle}</div>
          <div class="brandSub">${sub}</div>
        </div>

        <div class="vol">
          <div class="volIcon" title="Громкость">🔊</div>
          <input id="vol" class="volRange" type="range" min="0" max="100" value="12" />
          <div id="volPct" class="volPct">12%</div>
        </div>
      </div>

      <div class="chips">
        <div class="chip">🧩 ${TOTAL} уровней</div>
        <div class="chip">🔑 <span class="mono">${esc(keyShown)}</span></div>
      </div>

      <div class="progressWrap">
        <div class="progressBar" style="--p:${p}%">
          <div class="progressFill"></div>
        </div>
      </div>

      <div class="grid">
        <div class="left" id="main"></div>
        <div class="right">
          <div class="card pad-md keyCard">
            <div class="rowTitle">🔑 Ключ</div>
            <div class="muted">Собери ${KEY_LEN} символов:</div>
            <div class="keyMono mono">${esc(keyShown)}</div>
            <div class="muted" style="margin-top:10px">Прогресс: ${esc(progress)}</div>
          </div>
        </div>
      </div>
    `;
  };

  const startHTML = () => {
    const topTitle = esc(DATA.title || "Квест");
    const sub = esc(DATA.subtitle || "");
    return `
      <div class="screen">
        <div class="card pad-lg">
          <div style="font-weight:900;font-size:40px;letter-spacing:-.02em">${topTitle}</div>
          <div class="muted" style="margin-top:8px">${sub}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button class="btn" id="btnStart">Начать</button>
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
      </div>
    `;
  };

  const doneHTML = () => {
    const keyShown = (state.key || "").padEnd(KEY_LEN, "—");
    return `
      <div class="screen">
        <div class="card pad-lg">
          <div style="font-weight:900;font-size:34px">🎉 Готово!</div>
          <div class="muted" style="margin-top:8px">Ключ собран:</div>
          <div class="keyMono mono" style="margin-top:10px">${esc(keyShown)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
      </div>
    `;
  };

  const quizHTML = (lvl) => {
    const shown = state.levelIndex + 1;

    // VIDEO LEVEL
    if (lvl && lvl.type === "video") {
      const title = esc(lvl.title || `Уровень ${shown}/${TOTAL}`);
      const q = esc(lvl.question || "");
      const src = esc(lvl.videoSrc || "");
      const opts = Array.isArray(lvl.options) ? lvl.options : [];
      return `
        <div class="screen">
          <div class="card pad-lg">
            <div class="muted">Уровень ${shown}/${TOTAL}</div>
            <div class="h2">${title}</div>
            <div class="h3">${q}</div>

            <div class="card" style="margin-top:14px;padding:14px">
              <div class="videoWrap">
                <video id="videoEl" class="videoEl" controls playsinline preload="metadata">
                  <source src="${src}" type="video/mp4">
                </video>

                <button id="videoStartBtn" class="videoStartBtn btn" type="button">
                  ▶ Смотреть
                </button>
              </div>
              <div id="videoHint" class="muted" style="margin-top:10px">
                Досмотри до остановки — потом появятся варианты ответа.
              </div>
            </div>

            <div id="videoOptions" class="videoOptions" style="display:none;margin-top:14px">
              ${opts
                .map(
                  (t, i) => `
                    <button class="btn optBtn" data-idx="${i}" style="width:100%;text-align:left;padding:14px 16px">
                      ${esc(t)}
                    </button>
                  `
                )
                .join("")}
            </div>

            <div id="msg" class="muted" style="margin-top:12px;min-height:22px"></div>

            <div style="margin-top:14px">
              <button class="btn" id="btnReset">Сбросить прогресс</button>
            </div>
          </div>
        </div>
      `;
    }

    // NORMAL QUIZ LEVEL
    const title = esc(lvl.title || `Уровень ${shown}/${TOTAL}`);
    const q = esc(lvl.question || "");
    const opts = Array.isArray(lvl.options) ? lvl.options : [];
    return `
      <div class="screen">
        <div class="card pad-lg">
          <div class="muted">Уровень ${shown}/${TOTAL}</div>
          <div class="h2">${title}</div>
          <div class="h3">${q}</div>

          <div id="options" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
            ${opts
              .map(
                (t, i) => `
              <button class="btn optBtn" data-idx="${i}" style="width:100%;text-align:left;padding:14px 16px">
                ${esc(t)}
              </button>`
              )
              .join("")}
          </div>

          <div id="msg" class="muted" style="margin-top:12px;min-height:22px"></div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
      </div>
    `;
  };

  // -------------------------
  // Render + Bind
  // -------------------------
  const mount = () => {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
      <div class="shell">
        ${headerHTML()}
      </div>
    `;
    syncVolumeUI();
  };

  const setMain = (html) => {
    const main = document.getElementById("main");
    if (!main) return;
    main.innerHTML = html;
  };

  const bindCommon = () => {
    const app = document.getElementById("app");
    if (!app) return;

    // Start
    app.addEventListener("click", (e) => {
      const startBtn = closestSafe(e.target, "#btnStart");
      if (startBtn) {
        state.started = true;
        saveState();
        playBgmSoft();
        render();
        return;
      }

      const resetBtn = closestSafe(e.target, "#btnReset");
      if (resetBtn) {
        resetProgress();
        return;
      }
    });

    // Volume
    app.addEventListener("input", (e) => {
      const vol = closestSafe(e.target, "#vol");
      if (!vol) return;
      const v = clamp(Number(vol.value || 0), 0, 100) / 100;
      setVolume(v);
    });

    // First user gesture => allow bgm
    window.addEventListener(
      "pointerdown",
      () => {
        playBgmSoft();
      },
      { once: true }
    );
  };

  const setupVideoRuntime = (lvl) => {
    const v = $("#videoEl");
    const startBtn = $("#videoStartBtn");
    const optBox = $("#videoOptions");
    const msg = $("#msg");

    if (!v) return;

    const stopAt = Number(lvl.stopAt || 0);
    const hasStop = Number.isFinite(stopAt) && stopAt > 0.2;

    const showOptions = () => {
      if (!optBox) return;
      optBox.style.display = "flex";
      optBox.style.flexDirection = "column";
      optBox.style.gap = "10px";
      // мягкая анимация появления (CSS у .screen уже есть, но тут отдельно)
      optBox.style.opacity = "0";
      optBox.style.transform = "translateY(10px)";
      requestAnimationFrame(() => {
        optBox.style.transition = "opacity .35s ease, transform .35s ease";
        optBox.style.opacity = "1";
        optBox.style.transform = "translateY(0)";
      });
    };

    const hideOptions = () => {
      if (!optBox) return;
      optBox.style.display = "none";
    };

    const gateCheck = () => {
      if (!hasStop) return;
      if (state.videoSolved) return;
      if (state.videoGated) return;
      if (v.currentTime >= stopAt) {
        state.videoGated = true;
        try {
          v.pause();
        } catch {}
        try {
          v.currentTime = stopAt;
        } catch {}
        showOptions();
        if (msg) msg.textContent = "Выбери, что будет дальше.";
      }
    };

    v.addEventListener("timeupdate", gateCheck);
    v.addEventListener("seeked", gateCheck);

    v.addEventListener("ended", () => {
      // засчитываем уровень только если уже решён (правильный вариант)
      if (!state.videoSolved) return;
      addKeyChar(lvl.keyChar);
      nextLevel();
    });

    // overlay start (autoplay block safe)
    const start = async () => {
      if (startBtn) startBtn.style.display = "none";
      try {
        await v.play();
      } catch {
        // если браузер блокирует - покажем кнопку обратно
        if (startBtn) startBtn.style.display = "flex";
      }
    };

    if (startBtn) {
      startBtn.addEventListener("click", () => start());
    }

    // if user clicks video itself - attempt play
    v.addEventListener("click", () => {
      if (v.paused && !state.videoGated) start();
    });

    // options click
    document.addEventListener("click", (e) => {
      const btn = closestSafe(e.target, ".optBtn");
      if (!btn) return;
      // ensure we are on video level screen (has #videoEl)
      if (!$("#videoEl")) return;

      const idx = Number(btn.dataset.idx);
      const ok = idx === Number(lvl.answerIndex);

      if (!ok) {
        if (msg) msg.textContent = "✖ Неверно. Попробуй ещё.";
        // держим на стоп-кадре
        try {
          v.pause();
        } catch {}
        if (hasStop) {
          try {
            v.currentTime = stopAt;
          } catch {}
        }
        return;
      }

      // correct
      state.videoSolved = true;
      hideOptions();
      if (msg) msg.textContent = "✅ Верно. Смотри продолжение…";

      // чтобы gateCheck не сработал снова на точном равенстве stopAt
      if (hasStop) {
        try {
          v.currentTime = Math.min(stopAt + 0.08, (v.duration || stopAt + 0.08));
        } catch {}
      }
      v.play().catch(() => {});
    });
  };

  const bindQuiz = (lvl) => {
    // NORMAL + VIDEO uses same .optBtn class, but logic differs by lvl.type
    document.addEventListener("click", (e) => {
      const btn = closestSafe(e.target, ".optBtn");
      if (!btn) return;

      // if current level is video -> handled in setupVideoRuntime
      if (lvl && lvl.type === "video") return;

      const idx = Number(btn.dataset.idx);
      const ok = idx === Number(lvl.answerIndex);
      const msg = $("#msg");

      if (!ok) {
        if (msg) msg.textContent = "✖ Неверно. Попробуй ещё.";
        return;
      }

      if (msg) msg.textContent = "✅ Верно!";
      addKeyChar(lvl.keyChar);

      // небольшая задержка, чтобы “вау” ощущалось и анимация успела
      setTimeout(() => nextLevel(), 350);
    });
  };

  const render = () => {
    mount();

    const main = $("#main");
    if (!main) return;

    if (!state.started) {
      setMain(startHTML());
      return;
    }

    if (state.completed) {
      setMain(doneHTML());
      return;
    }

    const lvl = DATA.levels[state.levelIndex] || {};
    setMain(quizHTML(lvl));

    // runtime bindings
    if (lvl && lvl.type === "video") {
      setupVideoRuntime(lvl);
    } else {
      bindQuiz(lvl);
    }

    // keep volume UI synced
    syncVolumeUI();
  };

  // -------------------------
  // Init
  // -------------------------
  attachPointerGradient();
  ensureBgm();
  bindCommon();
  render();
})();
