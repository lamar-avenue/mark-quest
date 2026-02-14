/* docs/game/app.js
   Stable build: quiz 12 levels + key + bgm + level 8 clip picker
*/

(() => {
  "use strict";

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const LS_KEY = "markQuest_v7_state";
  const DEFAULT_VOL = 0.30;

  // ---------------------------
  // Data (from data.js)
  // ---------------------------
  const DATA = window.QUIZ_DATA || null;

  // Fallback (если data.js не подхватился — покажем понятную ошибку)
  if (!DATA) {
    document.body.innerHTML = `
      <div style="max-width:900px;margin:40px auto;padding:18px;font-family:system-ui;color:#fff;background:#111827;border-radius:14px">
        <h2 style="margin:0 0 10px 0">Ошибка: не найден QUIZ_DATA</h2>
        <div style="opacity:.8">Проверь, что в <b>game/data.js</b> есть <code>window.QUIZ_DATA = {...}</code> и что он подключён перед app.js.</div>
      </div>
    `;
    return;
  }

  const TOTAL_LEVELS = DATA.levels.length;

  // ---------------------------
  // State
  // ---------------------------
  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return freshState();
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return freshState();
      // минимальная валидация
      s.screen ??= "intro";
      s.levelIndex ??= 0;
      s.key ??= "";
      s.wrongCounts ??= {};
      s.bgm ??= { vol: DEFAULT_VOL, muted: false };
      s.level8 ??= { picked: [], activeId: null, done: false };
      return s;
    } catch {
      return freshState();
    }
  }

  function freshState() {
    return {
      screen: "intro",     // intro | quiz | done
      levelIndex: 0,       // 0..TOTAL_LEVELS-1
      key: "",
      wrongCounts: {},
      bgm: { vol: DEFAULT_VOL, muted: false },
      level8: { picked: [], activeId: null, done: false },
    };
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  // ---------------------------
  // UI Mount
  // ---------------------------
  const root = $("#app") || document.body;

  function setMain(html) {
    root.innerHTML = html;
  }

  // ---------------------------
  // Toast (mini)
  // ---------------------------
  function toast(msg, kind = "info") {
    const id = "toastBox";
    let box = $("#" + id);
    if (!box) {
      box = document.createElement("div");
      box.id = id;
      box.style.cssText = `
        position:fixed;left:50%;top:18px;transform:translateX(-50%);
        z-index:99999;max-width:900px;width:calc(100% - 24px);
        pointer-events:none;
      `;
      document.body.appendChild(box);
    }

    const el = document.createElement("div");
    el.style.cssText = `
      pointer-events:auto;
      background:${kind === "err" ? "rgba(185,28,28,.35)" : "rgba(30,41,59,.55)"};
      border:1px solid rgba(148,163,184,.25);
      color:#fff;border-radius:14px;
      padding:10px 12px;margin:8px auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 12px 30px rgba(0,0,0,.35);
      font: 14px/1.35 system-ui;
      opacity:0; transform: translateY(-8px);
      transition: .25s ease;
    `;
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  // ---------------------------
  // Background Music
  // ---------------------------
  const bgm = {
    audio: new Audio(),
    fading: false,
    targetVol: DEFAULT_VOL,
    raf: null,
  };

  bgm.audio.preload = "auto";
  bgm.audio.loop = true;

  function pickTrackUrl() {
    const tracks = DATA.musicTracks || [];
    if (!tracks.length) return null;
    // Можно сделать случайный трек:
    const i = Math.floor(Math.random() * tracks.length);
    return tracks[i];
  }

  function applyBgmUIToAudio() {
    const vol = clamp(state.bgm.vol ?? DEFAULT_VOL, 0, 1);
    bgm.targetVol = vol;
    bgm.audio.volume = state.bgm.muted ? 0 : vol;
    bgm.audio.muted = false; // мы управляем громкостью сами
  }

  async function ensureBgmPlaying() {
    const url = pickTrackUrl();
    if (!url) return;

    if (bgm.audio.src !== new URL(url, location.href).toString()) {
      bgm.audio.src = url;
    }

    applyBgmUIToAudio();

    try {
      // автозапуск в браузерах может блокироваться — тогда включится после первого клика пользователя
      await bgm.audio.play();
    } catch {
      // тихо игнорируем
    }
  }

  function fadeBgm(to, ms = 450) {
    cancelAnimationFrame(bgm.raf);
    const from = bgm.audio.volume;
    const start = performance.now();
    bgm.fading = true;

    const tick = (t) => {
      const k = clamp((t - start) / ms, 0, 1);
      const v = from + (to - from) * k;
      bgm.audio.volume = v;
      if (k < 1) bgm.raf = requestAnimationFrame(tick);
      else bgm.fading = false;
    };
    bgm.raf = requestAnimationFrame(tick);
  }

  function stopBgmSmooth() {
    // плавно в 0
    fadeBgm(0, 500);
  }

  function resumeBgmSmooth() {
    if (state.bgm.muted) return;
    fadeBgm(clamp(state.bgm.vol ?? DEFAULT_VOL, 0, 1), 600);
  }

  // ---------------------------
  // Render: Layout blocks
  // ---------------------------
  function render() {
    // БГМ: в интро/вопросах включаем, в level8 выключаем
    if (state.screen === "intro" || state.screen === "quiz" || state.screen === "done") {
      // если сейчас НЕ edit уровень — музыка должна быть
      const lvl = DATA.levels[state.levelIndex];
      const isEdit = lvl && lvl.type === "edit";
      if (!isEdit) ensureBgmPlaying();
    }

    if (state.screen === "intro") return renderIntro();
    if (state.screen === "done") return renderDone();
    return renderQuiz();
  }

  function topBarHTML() {
    // компактный контрол громкости в правом верхнем углу
    const volPct = Math.round((state.bgm.vol ?? DEFAULT_VOL) * 100);
    const muted = !!state.bgm.muted;

    return `
      <div class="topbar">
        <div class="volbox" title="Громкость фоновой музыки">
          <button class="iconbtn" id="btnMute" aria-label="mute">${muted ? "🔇" : "🔊"}</button>
          <input id="volSlider" type="range" min="0" max="100" value="${volPct}" />
          <div class="volpct">${volPct}%</div>
        </div>
      </div>
    `;
  }

  function keyCardHTML() {
    const keyLen = DATA.keyLength || TOTAL_LEVELS;
    const shown = (state.key || "").padEnd(keyLen, "_");
    return `
      <div class="card keycard">
        <h2 style="margin:0 0 8px 0">🔑 Ключ</h2>
        <div class="muted">Собери ${keyLen} символов:</div>
        <div class="keyline">${escapeHtml(shown)}</div>
      </div>
    `;
  }

  function wireTopBar() {
    const muteBtn = $("#btnMute");
    const slider = $("#volSlider");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        state.bgm.muted = !state.bgm.muted;
        saveState();
        applyBgmUIToAudio();
        // если включили звук — мягко вернём
        if (!state.bgm.muted) resumeBgmSmooth();
        render(); // обновить иконку
      });
    }
    if (slider) {
      slider.addEventListener("input", () => {
        const v = clamp(parseInt(slider.value, 10) / 100, 0, 1);
        state.bgm.vol = v;
        saveState();
        // без “потухания на секунду”: просто меняем громкость без fade
        if (!state.bgm.muted) bgm.audio.volume = v;
        const pct = $(".volpct");
        if (pct) pct.textContent = `${Math.round(v * 100)}%`;
      });
    }
  }

  // ---------------------------
  // Intro / Done
  // ---------------------------
  function renderIntro() {
    setMain(`
      ${topBarHTML()}
      <div class="page">
        <div class="card hero">
          <h1 style="margin:0 0 6px 0">🎁 ${escapeHtml(DATA.title || "Квест")}</h1>
          <div class="muted">${escapeHtml(DATA.subtitle || "12 уровней. За каждый — 1 символ. Собери ключ и откроешь финал.")}</div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primary" id="btnStart">Начать</button>
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>

          <div class="muted" style="margin-top:10px;opacity:.75">
            Если музыка не играет — кликни один раз по странице (браузеры иногда блокируют автозапуск).
          </div>
        </div>

        ${keyCardHTML()}
      </div>
    `);

    wireTopBar();

    $("#btnStart")?.addEventListener("click", () => {
      state.screen = "quiz";
      saveState();
      render();
    });

    $("#btnReset")?.addEventListener("click", () => {
      const s = freshState();
      Object.assign(state, s);
      saveState();
      toast("Прогресс сброшен");
      render();
    });
  }

  function renderDone() {
    // фикс “13/12”: прогресс считаем как TOTAL_LEVELS
    setMain(`
      ${topBarHTML()}
      <div class="page">
        <div class="card hero">
          <h1 style="margin:0 0 6px 0">✅ Готово</h1>
          <div class="muted">Ключ собран:</div>
          <div class="keyline" style="margin-top:8px">${escapeHtml(state.key || "")}</div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primary" id="btnFinal">Открыть финал</button>
            <button class="btn" id="btnToStart">На старт</button>
          </div>
        </div>

        ${keyCardHTML()}
      </div>
    `);

    wireTopBar();

    $("#btnFinal")?.addEventListener("click", () => {
      // Тут потом можно сделать ссылку/переход
      toast("Финал можно оформить отдельной страницей 🙂");
    });

    $("#btnToStart")?.addEventListener("click", () => {
      state.screen = "intro";
      saveState();
      render();
    });
  }

  // ---------------------------
  // Quiz renderer
  // ---------------------------
  function renderQuiz() {
    const level = DATA.levels[state.levelIndex];
    const shownLevelNum = state.levelIndex + 1;

    if (!level) {
      state.screen = "done";
      saveState();
      return render();
    }

    // Level 8: edit challenge
    if (level.type === "edit") {
      return renderEditLevel(level, shownLevelNum);
    }

    // Обычный уровень
    const showHintBtn = false; // ты хотел убрать кнопки "Подсказка" — оставляю выключенным

    setMain(`
      ${topBarHTML()}
      <div class="page wide">
        <div class="card maincard">
          <div class="muted">Уровень ${shownLevelNum}/${TOTAL_LEVELS}</div>
          <h1 style="margin:6px 0 10px 0">${escapeHtml(level.title || `Уровень ${shownLevelNum}`)}</h1>
          <div class="qtext">${escapeHtml(level.question || "")}</div>

          <div class="answers" id="answers"></div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            ${showHintBtn ? `<button class="btn" id="btnHint">Подсказка</button>` : ""}
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>

          <div class="hintbox" id="hintBox" style="display:none"></div>
        </div>

        ${keyCardHTML()}
      </div>
    `);

    wireTopBar();

    $("#btnReset")?.addEventListener("click", () => {
      Object.assign(state, freshState());
      saveState();
      toast("Прогресс сброшен");
      render();
    });

    if (showHintBtn) {
      $("#btnHint")?.addEventListener("click", () => {
        const hb = $("#hintBox");
        if (!hb) return;
        hb.style.display = "block";
        hb.textContent = level.hint || "Подсказки нет 🙂";
      });
    }

    const answers = $("#answers");
    const opts = Array.isArray(level.options) ? level.options : [];
    answers.innerHTML = opts
      .map((t, i) => `<button class="ans" data-i="${i}">${escapeHtml(t)}</button>`)
      .join("");

    $$(".ans", answers).forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-i"), 10);
        const ok = isCorrect(level, i);

        if (!ok) {
          state.wrongCounts[state.levelIndex] = (state.wrongCounts[state.levelIndex] || 0) + 1;
          saveState();
          toast("Неправильно 🙂 попробуй ещё", "err");
          // без затухания музыки — ничего не трогаем
          return;
        }

        onLevelComplete(level);
      });
    });
  }

  function isCorrect(level, pickedIndex) {
    // варианты: answerIndex или answerText
    if (typeof level.answerIndex === "number") {
      return pickedIndex === level.answerIndex;
    }
    if (typeof level.answerText === "string") {
      const opts = level.options || [];
      return (opts[pickedIndex] || "").trim().toLowerCase() === level.answerText.trim().toLowerCase();
    }
    return false;
  }

  function onLevelComplete(level) {
    // добавляем символ ключа
    const ch = (level.keyChar ?? "").toString();
    if (ch && state.key.length < (DATA.keyLength || TOTAL_LEVELS)) {
      state.key += ch;
    }

    // следующий уровень
    if (state.levelIndex >= TOTAL_LEVELS - 1) {
      state.screen = "done";
    } else {
      state.levelIndex += 1;
    }

    saveState();
    toast("Верно ✅");
    render();
  }

  // ---------------------------
  // Level 8: Edit Challenge (clip picker)
  // ---------------------------
  function renderEditLevel(level, shownLevelNum) {
    // ВАЖНО: только тут плавно гасим фон-музыку
    stopBgmSmooth();

    const clips = (DATA.editClips || []).slice(); // ожидаем [{id,title,group,src,thumb}, ...]

    // Активный клип в большом плеере
    const activeId = state.level8.activeId || (clips[0]?.id ?? null);
    if (!state.level8.activeId && activeId) state.level8.activeId = activeId;

    const picked = state.level8.picked || [];
    const pickedSet = new Set(picked);

    const activeClip = clips.find((c) => c.id === state.level8.activeId) || clips[0];

    setMain(`
      ${topBarHTML()}
      <div class="page wide">
        <div class="card maincard">
          <div class="muted">Уровень ${shownLevelNum}/${TOTAL_LEVELS}</div>
          <h1 style="margin:6px 0 10px 0">${escapeHtml(level.title || "Edit Challenge")}</h1>
          <div class="qtext">${escapeHtml(level.question || "Выбери 3 клипа. Клик по карточке — откроет в большом плеере. Кружок справа сверху — выбор.")}</div>

          <div class="playerWrap">
            <div class="muted" style="margin-bottom:8px">Просмотр: <b>${escapeHtml(activeClip?.title || "")}</b></div>
            <video id="bigPlayer" controls playsinline preload="metadata"
              style="width:100%;border-radius:14px;background:#000"
              src="${escapeAttr(activeClip?.src || "")}">
            </video>
          </div>

          <div class="muted" style="margin-top:10px">Выбрано: ${picked.length}/3</div>

          <button class="btn primary" id="btnEditNext" ${picked.length === 3 ? "" : "disabled"} style="margin-top:10px">
            Дальше (к редактору)
          </button>

          <div class="grid" id="clipGrid" style="margin-top:14px">
            ${clips.map((c) => clipCardHTML(c, pickedSet.has(c.id), c.id === activeId)).join("")}
          </div>

          <div class="muted" style="margin-top:12px;opacity:.75">
            Сейчас это этап выбора. Следующим шагом встроим редактор/экспорт так, чтобы работало в Chrome/Opera стабильно.
          </div>
        </div>

        ${keyCardHTML()}
      </div>
    `);

    wireTopBar();

    // клики по карточкам
    $$("#clipGrid .clipCard").forEach((card) => {
      const id = card.getAttribute("data-id");

      // открыть в плеере
      card.addEventListener("click", (e) => {
        // если клик по кружку — не надо менять активный (мы обработаем отдельно)
        if ((e.target && e.target.closest && e.target.closest(".pickDot")) || (e.target && e.target.classList && e.target.classList.contains("pickDot"))) {
          return;
        }
        state.level8.activeId = id;
        saveState();
        render(); // перерисуем, чтобы обновить плеер/рамку
      });

      // выбор
      const dot = card.querySelector(".pickDot");
      if (dot) {
        dot.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const pickedArr = state.level8.picked || [];
          const has = pickedArr.includes(id);

          if (has) {
            state.level8.picked = pickedArr.filter((x) => x !== id);
          } else {
            if (pickedArr.length >= 3) {
              toast("Можно выбрать только 3 клипа", "err");
              return;
            }
            state.level8.picked = pickedArr.concat([id]);
          }

          saveState();
          render();
        });
      }
    });

    $("#btnEditNext")?.addEventListener("click", () => {
      if ((state.level8.picked || []).length !== 3) return;

      // Тут можно открыть твой существующий редактор или перейти на встроенный экран редактора
      // Пока сделаем просто: засчитываем уровень как пройденный (и включаем музыку обратно)
      resumeBgmSmooth();

      onLevelComplete(level);
    });
  }

  function clipCardHTML(c, picked, active) {
    const thumb = c.thumb || "";
    return `
      <div class="clipCard ${active ? "active" : ""}" data-id="${escapeAttr(c.id)}">
        <div class="thumb" style="background-image:url('${escapeAttr(thumb)}')">
          <div class="pickDot ${picked ? "on" : ""}" title="Выбрать клип"></div>
        </div>
        <div class="clipMeta">
          <div class="clipTitle">${escapeHtml(c.title || "CLIP")}</div>
          <div class="clipSub">${escapeHtml(c.group || "")}</div>
        </div>
      </div>
    `;
  }

  // ---------------------------
  // Escaping
  // ---------------------------
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("`", "");
  }

  // ---------------------------
  // Global click to allow audio autoplay
  // ---------------------------
  document.addEventListener("click", () => {
    // первая попытка play после взаимодействия
    if (bgm.audio.paused) ensureBgmPlaying();
  }, { once: true });

  // ---------------------------
  // Inject minimal CSS for the pieces we used (если style.css ещё не содержит)
  // ---------------------------
  injectBaseCSS();

  function injectBaseCSS() {
    const css = `
      .topbar{position:fixed;right:18px;top:14px;z-index:9990;display:flex;gap:10px}
      .volbox{
        display:flex;align-items:center;gap:10px;
        padding:10px 12px;border-radius:16px;
        background:rgba(15,23,42,.55);
        border:1px solid rgba(148,163,184,.18);
        backdrop-filter: blur(12px);
        box-shadow: 0 12px 30px rgba(0,0,0,.25);
      }
      .iconbtn{border:0;background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:8px 10px;cursor:pointer}
      #volSlider{width:180px}
      .volpct{min-width:42px;text-align:right;opacity:.85}

      .page{max-width:1100px;margin:90px auto 40px auto;padding:0 14px;display:grid;grid-template-columns: 1fr 360px;gap:16px}
      .page.wide{grid-template-columns: 1fr 380px}
      @media (max-width: 980px){.page,.page.wide{grid-template-columns:1fr} .topbar{right:10px}}
      .card{
        background: rgba(15,23,42,.45);
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 20px;
        padding: 18px;
        backdrop-filter: blur(16px);
        box-shadow: 0 18px 40px rgba(0,0,0,.35);
      }
      .hero{padding:22px}
      .muted{opacity:.78}
      .keycard .keyline{
        margin-top:10px;
        padding:10px 12px;
        border-radius:14px;
        border:1px dashed rgba(148,163,184,.35);
        letter-spacing:2px;
        font-weight:800;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }
      .btn{
        border:1px solid rgba(148,163,184,.22);
        background: rgba(255,255,255,.06);
        color:#fff;
        border-radius: 14px;
        padding: 10px 14px;
        cursor:pointer;
      }
      .btn:disabled{opacity:.45;cursor:not-allowed}
      .btn.primary{
        background: rgba(59,130,246,.22);
        border-color: rgba(59,130,246,.35);
      }
      .qtext{margin-top:6px;opacity:.9;line-height:1.4}
      .answers{margin-top:14px;display:grid;gap:10px}
      .ans{
        text-align:center;
        padding: 12px 14px;
        border-radius: 16px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(255,255,255,.05);
        color:#fff;
        cursor:pointer;
        transition:.15s ease;
      }
      .ans:hover{transform: translateY(-1px); background: rgba(255,255,255,.07)}
      .hintbox{
        margin-top:12px;
        padding:10px 12px;
        border-radius:14px;
        background: rgba(16,185,129,.10);
        border:1px solid rgba(16,185,129,.22);
      }

      .playerWrap{margin-top:14px}
      .grid{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:12px;
      }
      @media (max-width: 900px){.grid{grid-template-columns: repeat(2, minmax(0, 1fr));}}
      @media (max-width: 560px){.grid{grid-template-columns: 1fr;}}
      .clipCard{
        border-radius:18px;
        overflow:hidden;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(255,255,255,.04);
        cursor:pointer;
        transition:.18s ease;
        position:relative;
      }
      .clipCard:hover{transform: translateY(-2px)}
      .clipCard.active{outline: 2px solid rgba(59,130,246,.55)}
      .thumb{
        height:130px;
        background-size:cover;
        background-position:center;
        background-color: rgba(255,255,255,.06);
        position:relative;
      }
      .pickDot{
        width:18px;height:18px;border-radius:999px;
        border:2px solid rgba(226,232,240,.9);
        position:absolute;right:10px;top:10px;
        background: rgba(0,0,0,.25);
        box-shadow: 0 6px 14px rgba(0,0,0,.35);
        transition:.18s ease;
      }
      .pickDot.on{
        background: rgba(59,130,246,.95);
        border-color: rgba(191,219,254,1);
      }
      .clipMeta{padding:12px}
      .clipTitle{font-weight:900}
      .clipSub{opacity:.75;font-size:12px;margin-top:2px}
    `.trim();

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------
  // Start
  // ---------------------------
  render();

})();
