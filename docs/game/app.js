(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function showFatal(msg) {
    const root = $("#app");
    root.innerHTML = `
      <div class="toast">
        <div style="font-weight:900;font-size:18px;margin-bottom:6px;">Ошибка</div>
        <div class="muted">${msg}</div>
      </div>
    `;
  }

  // ЖЁСТКАЯ ПРОВЕРКА: data.js обязан создать window.QUIZ_DATA
  if (!window.QUIZ_DATA) {
    showFatal(
      `Не найден <b>window.QUIZ_DATA</b>.<br>
       1) Открой <span class="keyBox">/mark-quest/game/data.js</span> и проверь, что там есть <b>window.QUIZ_DATA = {...}</b><br>
       2) Проверь, что в <b>index.html</b> подключение идёт так: <b>data.js</b> ПЕРЕД <b>app.js</b>.`
    );
    console.error("QUIZ_DATA missing. window keys:", Object.keys(window));
    return;
  }

  const DATA = window.QUIZ_DATA;

  const storageKey = "mark_quest_state_v1";
  const TOTAL = (DATA.levels?.length) || 12;

  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { levelIndex: 0, key: "" };
  }
  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function setMain(html) { $("#app").innerHTML = html; }

  function home() {
    setMain(`
      <div class="card">
        <h1>🎁 ${escapeHtml(DATA.title || "Квест")}</h1>
        <div class="muted">${escapeHtml(DATA.subtitle || "")}</div>
        <div class="hr"></div>
        <button class="btn primary" id="btnStart">Начать</button>
      </div>
    `);
    $("#btnStart").addEventListener("click", () => { render(); });
  }

  function render() {
    state.levelIndex = clamp(state.levelIndex, 0, TOTAL - 1);

    const level = DATA.levels[state.levelIndex];
    if (!level) return home();

    // Уровень edit (если есть)
    if (level.type === "edit") return renderEditStub(level);

    setMain(`
      <div class="row">
        <div class="col">
          <div class="card">
            <div class="muted" style="font-weight:800;margin-bottom:8px;">
              Прогресс: ${state.levelIndex + 1}/${TOTAL}
            </div>
            <h2>${escapeHtml(level.title || `Уровень ${state.levelIndex+1}/${TOTAL}`)}</h2>
            <div class="muted" style="margin:10px 0 14px 0;">
              ${escapeHtml(level.question || "")}
            </div>
            <div class="list">
              ${(level.options || []).map((t, i) => `
                <button class="btn option" data-i="${i}">
                  ${escapeHtml(String(t))}
                </button>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="col" style="max-width:420px;">
          <div class="card">
            <h2>🔑 Ключ</h2>
            <div class="muted">Собери ${DATA.keyLength || 12} символов:</div>
            <div style="margin-top:10px;">
              <span class="keyBox">${escapeHtml(maskKey(state.key, DATA.keyLength || 12))}</span>
            </div>
            <div class="hr"></div>
            <button class="btn danger" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
      </div>
    `);

    // ответы
    document.querySelectorAll("[data-i]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        if (i === level.answerIndex) {
          // правильный
          const ch = (level.keyChar ?? "");
          if (ch && state.key.length < (DATA.keyLength || 12)) state.key += String(ch);
          state.levelIndex++;
          saveState();
          if (state.levelIndex >= TOTAL) return showFinish();
          render();
        } else {
          // неправильный
          btn.classList.add("danger");
          btn.textContent = "❌ Неверно";
          setTimeout(render, 450);
        }
      });
    });

    $("#btnReset").addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      location.reload();
    });
  }

  function renderEditStub(level) {
    setMain(`
      <div class="card">
        <div class="muted" style="font-weight:800;margin-bottom:8px;">
          Прогресс: ${state.levelIndex + 1}/${TOTAL}
        </div>
        <h2>${escapeHtml(level.title || "Edit Challenge")}</h2>
        <div class="muted" style="margin:10px 0 14px 0;">
          ${escapeHtml(level.question || "Выбери 3 клипа.")}
        </div>

        <div class="hr"></div>
        <div class="muted small">
          Сейчас тут заглушка. Твой полноценный редактор у тебя уже есть — мы его аккуратно подключим сюда следующим шагом.
        </div>

        <div class="hr"></div>
        <button class="btn primary" id="btnNext">Дальше</button>
        <button class="btn" id="btnBack" style="margin-left:10px;">← Назад</button>
      </div>
    `);

    $("#btnBack").addEventListener("click", () => {
      state.levelIndex = clamp(state.levelIndex - 1, 0, TOTAL - 1);
      saveState();
      render();
    });

    $("#btnNext").addEventListener("click", () => {
      const ch = (level.keyChar ?? "");
      if (ch && state.key.length < (DATA.keyLength || 12)) state.key += String(ch);
      state.levelIndex++;
      saveState();
      if (state.levelIndex >= TOTAL) return showFinish();
      render();
    });
  }

  function showFinish() {
    setMain(`
      <div class="card">
        <h1>✅ Готово</h1>
        <div class="muted">Ключ:</div>
        <div style="margin-top:10px;">
          <span class="keyBox">${escapeHtml(state.key)}</span>
        </div>
        <div class="hr"></div>
        <button class="btn danger" id="btnReset">Сбросить прогресс</button>
      </div>
    `);

    $("#btnReset").addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      location.reload();
    });
  }

  function maskKey(k, len) {
    const s = String(k || "");
    const pad = "_".repeat(Math.max(0, len - s.length));
    return s + pad;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // старт
  home();
})();
