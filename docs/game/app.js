/* docs/game/app.js
   Single-page quiz app for GitHub Pages.
   Requires: docs/game/data.js defines window.QUIZ_DATA
*/

(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- data check ----------
  const DATA = window.QUIZ_DATA;
  if (!DATA || !DATA.levels || !Array.isArray(DATA.levels)) {
    mountFatal(
      `Ошибка: не найден <b>window.QUIZ_DATA</b>.<br>
       Проверь, что <code>game/data.js</code> содержит <code>window.QUIZ_DATA = {...}</code><br>
       и что в <code>index.html</code> подключение: <b>data.js ПЕРЕД app.js</b>.`
    );
    return;
  }

  const TOTAL_LEVELS = DATA.levels.length; // должно быть 12
  const KEY_LEN = Number(DATA.keyLength || TOTAL_LEVELS || 12) || 12;

  // ---------- state ----------
  const LS_KEY = "markQuestState_v3";
  const LS_VOL = "markQuestVol_v3";

  const defaultState = () => ({
    stage: "start",        // start | quiz | done | final
    levelIndex: 0,         // 0..TOTAL_LEVELS
    key: "",               // собранный ключ
    completed: false,
  });

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const out = defaultState();
      if (s && typeof s === "object") {
        out.stage = ["start", "quiz", "done", "final"].includes(s.stage) ? s.stage : "start";
        out.levelIndex = clamp(Number(s.levelIndex || 0), 0, TOTAL_LEVELS);
        out.key = typeof s.key === "string" ? s.key : "";
        out.completed = !!s.completed;
      }
      // защита: если ключ уже полный — done
      if (out.key.length >= KEY_LEN || out.levelIndex >= TOTAL_LEVELS) {
        out.completed = true;
        if (out.stage === "quiz") out.stage = "done";
      }
      return out;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }

  function resetProgress() {
    state = defaultState();
    saveState();
    render();
  }

  // ---------- background pointer gradient vars (если CSS использует --mx/--my) ----------
  let lastMoveTS = 0;
  window.addEventListener("mousemove", (e) => {
    const now = performance.now();
    if (now - lastMoveTS < 16) return; // ~60fps
    lastMoveTS = now;
    const x = e.clientX / Math.max(1, window.innerWidth);
    const y = e.clientY / Math.max(1, window.innerHeight);
    document.documentElement.style.setProperty("--mx", String(x));
    document.documentElement.style.setProperty("--my", String(y));
  }, { passive: true });

  // ---------- audio (bgm) ----------
  const tracks = Array.isArray(DATA.musicTracks) ? DATA.musicTracks.slice() : [];
  const bgm = new Audio();
  bgm.preload = "auto";
  bgm.loop = false;
  bgm.crossOrigin = "anonymous";
  window.__bgmAudio = bgm; // на всякий случай

  let currentTrack = 0;
  let fadeTimer = null;

  function getSavedVol() {
    const v = Number(localStorage.getItem(LS_VOL));
    if (Number.isFinite(v)) return clamp(v, 0, 1);
    return 0.30; // по умолчанию 30%
  }

  let bgmVol = getSavedVol();
  bgm.volume = bgmVol;

  function setVol(v01) {
    bgmVol = clamp(v01, 0, 1);
    bgm.volume = bgmVol;
    try { localStorage.setItem(LS_VOL, String(bgmVol)); } catch {}
  }

  function fadeTo(target, ms = 350) {
    clearInterval(fadeTimer);
    const start = bgm.volume;
    const end = clamp(target, 0, 1);
    const t0 = performance.now();

    fadeTimer = setInterval(() => {
      const t = (performance.now() - t0) / ms;
      if (t >= 1) {
        bgm.volume = end;
        clearInterval(fadeTimer);
        fadeTimer = null;
        return;
      }
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      bgm.volume = start + (end - start) * eased;
    }, 16);
  }

  function playBgm() {
    if (!tracks.length) return;
    if (!bgm.src) {
      bgm.src = tracks[currentTrack % tracks.length];
    }
    bgm.onended = () => {
      currentTrack = (currentTrack + 1) % tracks.length;
      bgm.src = tracks[currentTrack];
      bgm.currentTime = 0;
      bgm.play().catch(() => {});
    };
    // мягкий старт
    bgm.volume = 0;
    bgm.play().then(() => fadeTo(bgmVol, 500)).catch(() => {});
  }

  function stopBgm() {
    if (!tracks.length) return;
    // мягкая остановка
    fadeTo(0, 350);
    setTimeout(() => {
      try { bgm.pause(); } catch {}
      bgm.currentTime = 0;
      // возвращаем громкость к сохраненной (не ноль) чтобы следующий play был норм
      bgm.volume = bgmVol;
    }, 400);
  }

  // автозапуск после первого клика (ограничения браузеров)
  let audioUnlocked = false;
  window.addEventListener("pointerdown", () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // если мы на старте/квизе — включаем
    if (state.stage === "start" || state.stage === "quiz") playBgm();
  }, { once: true });

  // ---------- UI mount ----------
  const app = $("#app");
  if (!app) {
    mountFatal("Не найден элемент <code>#app</code> в HTML.");
    return;
  }

  function mountFatal(html) {
    const root = document.body;
    root.innerHTML = `
      <div style="max-width:900px;margin:40px auto;padding:20px;border-radius:16px;background:rgba(0,0,0,.45);color:#fff;font:16px/1.45 system-ui;">
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">Ошибка</div>
        <div>${html}</div>
      </div>
    `;
  }

  // ---------- templates ----------
  function topBarHTML() {
    const pct = Math.round(bgmVol * 100);
    return `
      <div class="topbar" style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;">
        <div class="brand" style="display:flex;align-items:center;gap:10px;">
          <div style="font-weight:900;font-size:18px;letter-spacing:.2px;">🎁 ${esc(DATA.title || "Квест")}</div>
        </div>

        <div class="topbarControls" style="display:flex;align-items:center;gap:10px;">
          <div class="volWrap" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);backdrop-filter: blur(10px);">
            <button id="btnMute" class="iconBtn" title="Mute" style="width:34px;height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.15);color:#fff;cursor:pointer;">
              🔈
            </button>
            <input id="vol" type="range" min="0" max="100" value="${pct}" style="width:180px;">
            <div id="volPct" style="min-width:34px;text-align:right;opacity:.8;font-weight:700;">${pct}%</div>
          </div>
        </div>
      </div>
    `;
  }

  function keyCardHTML() {
    const keyShown = state.key.padEnd(KEY_LEN, "_");
    const progress = `${Math.min(state.levelIndex, TOTAL_LEVELS)}/${TOTAL_LEVELS}`;
    return `
      <div class="keyCard" style="padding:18px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(12px);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="font-size:18px;">🔑</div>
          <div style="font-weight:900;font-size:18px;">Ключ</div>
        </div>
        <div style="opacity:.75;margin-bottom:10px;">Собери ${KEY_LEN} символов:</div>
        <div style="display:inline-block;padding:10px 12px;border-radius:14px;border:1px dashed rgba(255,255,255,.20);letter-spacing:2px;font-weight:900;">
          ${esc(keyShown)}
        </div>
        <div style="margin-top:10px;opacity:.75;">Прогресс: ${esc(progress)}</div>
      </div>
    `;
  }

  function startScreenHTML() {
    return `
      ${topBarHTML()}

      <div class="panel" style="padding:22px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(14px);">
        <div style="font-size:36px;font-weight:950;letter-spacing:-.5px;margin-bottom:6px;">Квест для Марка</div>
        <div style="opacity:.85;max-width:820px;">
          ${esc(DATA.subtitle || "12 уровней. За каждый — 1 символ. Собери ключ и открой финал.")}
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn" id="btnStart"
            style="padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#fff;font-weight:900;cursor:pointer;">
            Начать
          </button>

          <button class="btn" id="btnReset"
            style="padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.10);color:#fff;font-weight:800;cursor:pointer;">
            Сбросить прогресс
          </button>
        </div>
      </div>

      <div style="margin-top:16px;">
        ${keyCardHTML()}
      </div>
    `;
  }

  function quizScreenHTML() {
    const i = clamp(state.levelIndex, 0, TOTAL_LEVELS - 1);
    const lvl = DATA.levels[i];

    const title = lvl.title || `Уровень ${i + 1}/${TOTAL_LEVELS}`;
    const question = lvl.question || "Выбери вариант:";
    const opts = Array.isArray(lvl.options) ? lvl.options : [];

    // прогресс-бар сверху
    const pct = Math.round((Math.min(state.levelIndex, TOTAL_LEVELS) / TOTAL_LEVELS) * 100);

    return `
      ${topBarHTML()}

      <div style="height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden;margin-bottom:14px;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, rgba(96,165,250,.9), rgba(167,139,250,.9), rgba(45,212,191,.9));"></div>
      </div>

      <div class="layout" style="display:grid;grid-template-columns: 1.65fr 1fr;gap:14px;align-items:start;">
        <div class="panel" style="padding:20px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(14px);">
          <div style="opacity:.8;font-weight:800;margin-bottom:2px;">${esc(title)}</div>
          <div style="font-size:18px;font-weight:900;margin-bottom:12px;">${esc(question)}</div>

          <div class="options" style="display:flex;flex-direction:column;gap:10px;">
            ${opts
              .map((t, idx) => `
                <button class="optBtn" data-idx="${idx}"
                  style="text-align:left;padding:14px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.12);
                         background:rgba(0,0,0,.18);color:#fff;font-weight:850;cursor:pointer;">
                  ${esc(t)}
                </button>
              `)
              .join("")}
          </div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btnReset" style="padding:10px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.12);color:#fff;font-weight:800;cursor:pointer;">
              Сбросить прогресс
            </button>
          </div>

          <div id="toast" style="margin-top:12px;display:none;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);"></div>
        </div>

        ${keyCardHTML()}
      </div>
    `;
  }

  function doneScreenHTML() {
    // ключ уже собран
    const keyFinal = state.key.slice(0, KEY_LEN);

    return `
      ${topBarHTML()}

      <div class="panel" style="padding:22px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(14px);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;border-radius:14px;background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.35);display:flex;align-items:center;justify-content:center;font-size:22px;">✅</div>
          <div>
            <div style="font-size:30px;font-weight:950;letter-spacing:-.4px;">Готово</div>
            <div style="opacity:.85;font-weight:800;">Ключ: <span style="letter-spacing:2px;">${esc(keyFinal)}</span></div>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnOpenFinal"
            style="padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#fff;font-weight:900;cursor:pointer;">
            Открыть финал
          </button>

          <button id="btnReset"
            style="padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.10);color:#fff;font-weight:800;cursor:pointer;">
            Сбросить прогресс
          </button>
        </div>
      </div>

      <div style="margin-top:16px;">
        ${keyCardHTML()}
      </div>
    `;
  }

  function finalScreenHTML() {
    // Можно кастомизировать через DATA.finalHtml / DATA.finalText
    const finalHtml = DATA.finalHtml;
    const finalText = DATA.finalText;

    return `
      ${topBarHTML()}

      <div class="panel" style="padding:22px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(14px);">
        <div style="font-size:40px;font-weight:950;letter-spacing:-.6px;margin-bottom:6px;">🎉 Финал</div>

        <div style="opacity:.9;line-height:1.6;">
          ${
            finalHtml
              ? finalHtml
              : `<div>${esc(finalText || "Тут будет твой финальный экран. Можешь добавить текст/картинку/ссылку в data.js (finalText или finalHtml).")}</div>`
          }
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnToStart"
            style="padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.10);color:#fff;font-weight:900;cursor:pointer;">
            На старт
          </button>
        </div>
      </div>
    `;
  }

  // ---------- render ----------
  function setMain(html) {
    app.innerHTML = html;

    // плавный вход карточки ключа (если есть CSS .keyCard/.is-in)
    const keyCard = $(".keyCard");
    if (keyCard) {
      keyCard.classList.remove("is-in");
      requestAnimationFrame(() => requestAnimationFrame(() => keyCard.classList.add("is-in")));
    }

    // bind volume controls (важно: НИКАКОГО render() тут на input)
    bindVolumeUI();

    // bind shared
    const btnReset = $("#btnReset");
    if (btnReset) btnReset.addEventListener("click", resetProgress);

    // stage-specific binds
    const btnStart = $("#btnStart");
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        state.stage = "quiz";
        saveState();
        render();
        if (audioUnlocked) playBgm();
      });
    }

    const btnOpenFinal = $("#btnOpenFinal");
    if (btnOpenFinal) {
      btnOpenFinal.addEventListener("click", () => {
        state.stage = "final";
        saveState();
        render();
      });
    }

    const btnToStart = $("#btnToStart");
    if (btnToStart) {
      btnToStart.addEventListener("click", () => {
        state.stage = "start";
        saveState();
        render();
      });
    }

    // quiz options
    $$(".optBtn").forEach((btn) => {
      btn.addEventListener("click", () => handleAnswer(btn));
    });
  }

  function render() {
    // защита от “13/12”
    state.levelIndex = clamp(state.levelIndex, 0, TOTAL_LEVELS);
    if (state.key.length > KEY_LEN) state.key = state.key.slice(0, KEY_LEN);

    if (state.completed || state.key.length >= KEY_LEN || state.levelIndex >= TOTAL_LEVELS) {
      state.completed = true;
      if (state.stage === "quiz") state.stage = "done";
    }

    if (state.stage === "start") {
      setMain(startScreenHTML());
      if (audioUnlocked) playBgm();
      return;
    }

    if (state.stage === "quiz") {
      setMain(quizScreenHTML());
      if (audioUnlocked) playBgm();
      return;
    }

    if (state.stage === "done") {
      setMain(doneScreenHTML());
      if (audioUnlocked) playBgm();
      return;
    }

    if (state.stage === "final") {
      setMain(finalScreenHTML());
      if (audioUnlocked) playBgm();
      return;
    }

    // fallback
    state.stage = "start";
    saveState();
    setMain(startScreenHTML());
  }

  // ---------- quiz logic ----------
  function handleAnswer(btn) {
    const idx = Number(btn.getAttribute("data-idx"));
    const lvlIndex = clamp(state.levelIndex, 0, TOTAL_LEVELS - 1);
    const lvl = DATA.levels[lvlIndex];

    const correct = Number(lvl.answerIndex) === idx;
    const toast = $("#toast");

    // UI feedback
    if (toast) {
      toast.style.display = "block";
      toast.style.background = correct ? "rgba(34,197,94,.14)" : "rgba(239,68,68,.14)";
      toast.style.borderColor = correct ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)";
      toast.innerHTML = correct ? "✅ Верно!" : "❌ Неверно. Попробуй ещё.";
    }

    if (!correct) {
      // не меняем уровень/ключ
      return;
    }

    // добавляем символ ключа
    const ch = typeof lvl.keyChar === "string" ? lvl.keyChar : "";
    if (ch && state.key.length < KEY_LEN) state.key += ch;

    // следующий уровень
    state.levelIndex = clamp(state.levelIndex + 1, 0, TOTAL_LEVELS);

    // если всё — done
    if (state.levelIndex >= TOTAL_LEVELS || state.key.length >= KEY_LEN) {
      state.completed = true;
      state.stage = "done";
    }

    saveState();

    // небольшая задержка чтобы “✅ Верно!” было заметно
    setTimeout(() => render(), 220);
  }

  // ---------- volume UI binding ----------
  function bindVolumeUI() {
    const vol = $("#vol");
    const volPct = $("#volPct");
    const btnMute = $("#btnMute");

    if (vol) {
      vol.value = String(Math.round(bgmVol * 100));
      if (volPct) volPct.textContent = `${Math.round(bgmVol * 100)}%`;

      // ВАЖНО: тут НЕТ render()
      vol.addEventListener(
        "input",
        () => {
          const v = clamp(Number(vol.value) / 100, 0, 1);
          setVol(v);
          if (volPct) volPct.textContent = `${Math.round(v * 100)}%`;
        },
        { passive: true }
      );
    }

    if (btnMute) {
      btnMute.addEventListener("click", () => {
        if (bgmVol > 0.001) {
          setVol(0);
        } else {
          setVol(0.3);
        }
        if (vol) vol.value = String(Math.round(bgmVol * 100));
        if (volPct) volPct.textContent = `${Math.round(bgmVol * 100)}%`;
      });
    }
  }

  // ---------- init ----------
  render();
})();
