(() => {
  "use strict";

  const DATA = window.QUIZ_DATA;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  if (!DATA?.levels?.length) {
    document.body.innerHTML = `<div style="padding:18px;color:#fff;font-family:Inter,sans-serif">
      Ошибка: нет window.QUIZ_DATA.levels в game/data.js
    </div>`;
    return;
  }

  const TOTAL = DATA.levels.length;
  const KEY_LEN = Number(DATA.keyLength || TOTAL || 12) || 12;

  const LS = "markQuestState_premium_v1";
  const LS_VOL = "markQuestVol_premium_v1";

  const defaultState = () => ({
    stage: "start",   // start | quiz | done | final
    levelIndex: 0,
    key: ""
  });

  let state = load();

  function load(){
    try{
      const s = JSON.parse(localStorage.getItem(LS) || "null");
      if (!s) return defaultState();
      return {
        stage: ["start","quiz","done","final"].includes(s.stage) ? s.stage : "start",
        levelIndex: clamp(Number(s.levelIndex||0), 0, TOTAL),
        key: typeof s.key === "string" ? s.key : ""
      };
    } catch {
      return defaultState();
    }
  }
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(state)); }catch{} }

  // ---- background follows cursor (for CSS vars) ----
  let tx = innerWidth * 0.5, ty = innerHeight * 0.35;
  let cx = tx, cy = ty;
  addEventListener("mousemove", (e)=>{ tx=e.clientX; ty=e.clientY; }, {passive:true});
  (function raf(){
    cx += (tx - cx) * 0.10;
    cy += (ty - cy) * 0.10;
    const x = (cx / Math.max(1, innerWidth)) * 100;
    const y = (cy / Math.max(1, innerHeight)) * 100;
    document.documentElement.style.setProperty("--mx", x.toFixed(2) + "%");
    document.documentElement.style.setProperty("--my", y.toFixed(2) + "%");
    requestAnimationFrame(raf);
  })();

  // ---- audio (no “dip” on correct answer) ----
  const tracks = Array.isArray(DATA.musicTracks) ? DATA.musicTracks : [];
  const bgm = new Audio();
  bgm.preload = "auto";
  bgm.crossOrigin = "anonymous";
  bgm.loop = false;

  let bgmStarted = false;
  let currentTrack = 0;

  let bgmVol = (() => {
    const v = Number(localStorage.getItem(LS_VOL));
    return Number.isFinite(v) ? clamp(v,0,1) : 0.30;
  })();

  function setVol(v){
    bgmVol = clamp(v,0,1);
    bgm.volume = bgmVol;
    try{ localStorage.setItem(LS_VOL, String(bgmVol)); }catch{}
    const pct = $("#volPct");
    if (pct) pct.textContent = `${Math.round(bgmVol*100)}%`;
    const range = $("#vol");
    if (range) range.value = String(Math.round(bgmVol*100));
  }

  function fadeTo(target, ms=450){
    const start = bgm.volume;
    const end = clamp(target,0,1);
    const t0 = performance.now();
    const id = setInterval(()=>{
      const t = (performance.now() - t0)/ms;
      if (t>=1){
        bgm.volume = end;
        clearInterval(id);
        return;
      }
      const e = t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
      bgm.volume = start + (end-start)*e;
    },16);
  }

  function ensureBgm(){
    if (!tracks.length) return;
    if (!bgm.src) bgm.src = tracks[currentTrack % tracks.length];

    bgm.onended = () => {
      currentTrack = (currentTrack + 1) % tracks.length;
      bgm.src = tracks[currentTrack];
      bgm.currentTime = 0;
      bgm.play().catch(()=>{});
    };

    // если уже играет — не трогаем (важно!)
    if (!bgm.paused && bgm.currentTime > 0) return;

    bgm.play().then(()=>{
      if (!bgmStarted){
        bgmStarted = true;
        bgm.volume = 0;
        fadeTo(bgmVol, 500);
      } else {
        bgm.volume = bgmVol;
      }
    }).catch(()=>{});
  }

  // browser unlock
  let unlocked = false;
  addEventListener("pointerdown", ()=>{
    if (unlocked) return;
    unlocked = true;
    if (state.stage === "start" || state.stage === "quiz") ensureBgm();
  }, {once:true});

  // ---- UI ----
  const app = $("#app");
  if (!app) return;

  function keyShown(){
    return state.key.padEnd(KEY_LEN, "_").slice(0, KEY_LEN);
  }
  function progressPct(){
    return Math.round((clamp(state.levelIndex,0,TOTAL) / TOTAL) * 100);
  }

  function headerHTML(){
    return `
      <div class="topbar">
        <div>
          <div class="brandTitle">🎁 ${esc(DATA.title || "Квест")}</div>
          <div class="brandSub">${esc(DATA.subtitle || "12 уровней. Собери ключ и открой финал.")}</div>
          <div class="pills">
            <span class="pill">🧩 ${TOTAL} уровней</span>
            <span class="pill">🔑 <span class="keyLine">${esc(keyShown())}</span></span>
          </div>
        </div>

        <div class="audio">
          <button id="btnMute" class="audioBtn" title="Mute">🔈</button>
          <input id="vol" class="audioRange" type="range" min="0" max="100" value="${Math.round(bgmVol*100)}">
          <div id="volPct" class="audioPct">${Math.round(bgmVol*100)}%</div>
        </div>
      </div>
    `;
  }

  function keyCardHTML(){
    return `
      <div class="card pad keyCard">
        <div style="font-weight:950;font-size:18px;margin-bottom:8px;">🔑 Ключ</div>
        <div class="small" style="margin-bottom:10px;">Собери ${KEY_LEN} символов:</div>
        <div class="keyLine">${esc(keyShown())}</div>
        <div class="small" style="margin-top:10px;">Прогресс: ${Math.min(state.levelIndex, TOTAL)}/${TOTAL}</div>
      </div>
    `;
  }

  function startHTML(){
    return `
      <div class="grid">
        <div class="card pad-lg">
          <h1 class="h1">Квест для Марка</h1>
          <div class="small">Прогресс сохраняется. Лучше всего проходить на ПК.</div>
          <div class="sep"></div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn primary" id="btnStart">Начать</button>
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>

        ${keyCardHTML()}
      </div>
    `;
  }

  function quizHTML(){
    const i = clamp(state.levelIndex, 0, TOTAL-1);
    const lvl = DATA.levels[i];

    const title = lvl.title || `Уровень ${i+1}/${TOTAL}`;
    const question = lvl.question || "Выбери вариант:";
    const options = Array.isArray(lvl.options) ? lvl.options : [];

    const pct = progressPct();

    return `
      <div class="grid">
        ${headerHTML()}

        <div class="progressBar" aria-label="progress">
          <div class="progressFill" style="width:${pct}%"></div>
        </div>

        <div class="grid2">
          <div class="card pad-lg">
            <div class="small" style="font-weight:900;opacity:.8;">${esc(title)}</div>
            <div style="margin-top:6px;font-weight:950;font-size:18px;">${esc(question)}</div>

            <div class="options" id="options">
              ${options.map((t, idx)=>`
                <button class="btn optBtn" data-idx="${idx}">${esc(t)}</button>
              `).join("")}
            </div>

            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn" id="btnReset">Сбросить прогресс</button>
              <div id="toast" class="small" style="display:none;"></div>
            </div>
          </div>

          ${keyCardHTML()}
        </div>
      </div>
    `;
  }

  function doneHTML(){
    return `
      <div class="grid">
        ${headerHTML()}
        <div class="card pad-lg">
          <div style="font-size:28px;font-weight:950;">✅ Готово</div>
          <div class="small" style="margin-top:6px;">Ключ собран: <span class="keyLine">${esc(state.key.slice(0, KEY_LEN))}</span></div>
          <div class="sep"></div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn primary" id="btnOpenFinal">Открыть финал</button>
            <button class="btn" id="btnReset">Сбросить прогресс</button>
          </div>
        </div>
        ${keyCardHTML()}
      </div>
    `;
  }

  function finalHTML(){
    const html = DATA.finalHtml;
    const text = DATA.finalText || (DATA.final?.text ?? "");
    const title = DATA.finalTitle || (DATA.final?.title ?? "Финал");

    return `
      <div class="grid">
        ${headerHTML()}
        <div class="card pad-lg">
          <div style="font-size:34px;font-weight:950;">🎉 ${esc(title)}</div>
          <div class="sep"></div>
          <div style="color:var(--muted);line-height:1.65;white-space:pre-wrap;">
            ${html ? html : esc(text || "Добавь финал в data.js: finalText или finalHtml")}
          </div>

          <div style="margin-top:16px;">
            <button class="btn" id="btnToStart">На старт</button>
          </div>
        </div>
      </div>
    `;
  }

  function render(){
    // guard
    state.levelIndex = clamp(state.levelIndex, 0, TOTAL);
    if (state.key.length > KEY_LEN) state.key = state.key.slice(0, KEY_LEN);

    if (state.key.length >= KEY_LEN || state.levelIndex >= TOTAL) {
      if (state.stage === "quiz") state.stage = "done";
    }

    if (state.stage === "start") app.innerHTML = startHTML();
    else if (state.stage === "quiz") app.innerHTML = quizHTML();
    else if (state.stage === "done") app.innerHTML = doneHTML();
    else app.innerHTML = finalHTML();

    // smooth key card in
    const keyCard = $(".keyCard");
    if (keyCard) {
      keyCard.classList.remove("is-in");
      requestAnimationFrame(()=>requestAnimationFrame(()=>keyCard.classList.add("is-in")));
    }

    bindUI();
  }

  function bindGlow(){
    $$(".btn").forEach((btn)=>{
      btn.addEventListener("pointermove", (e)=>{
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        btn.style.setProperty("--bx", x.toFixed(2) + "%");
        btn.style.setProperty("--by", y.toFixed(2) + "%");
      }, {passive:true});
    });
  }

  function bindUI(){
    bindGlow();

    $("#btnReset")?.addEventListener("click", ()=>{
      state = defaultState();
      save();
      render();
    });

    $("#btnStart")?.addEventListener("click", ()=>{
      state.stage = "quiz";
      save();
      render();
      if (unlocked) ensureBgm();
    });

    $("#btnOpenFinal")?.addEventListener("click", ()=>{
      state.stage = "final";
      save();
      render();
    });

    $("#btnToStart")?.addEventListener("click", ()=>{
      state.stage = "start";
      save();
      render();
    });

    // volume: NO render on input
    const vol = $("#vol");
    const pct = $("#volPct");
    if (vol){
      vol.value = String(Math.round(bgmVol*100));
      vol.addEventListener("input", ()=>{
        const v = clamp(Number(vol.value)/100, 0, 1);
        setVol(v);
        if (pct) pct.textContent = `${Math.round(v*100)}%`;
      }, {passive:true});
    }

    $("#btnMute")?.addEventListener("click", ()=>{
      if (bgmVol > 0.001) setVol(0);
      else setVol(0.30);
    });

    // quiz options
    const options = $("#options");
    if (options){
      options.addEventListener("click", (e)=>{
        const btn = e.target.closest("button[data-idx]");
        if (!btn) return;

        const idx = Number(btn.getAttribute("data-idx"));
        const i = clamp(state.levelIndex, 0, TOTAL-1);
        const lvl = DATA.levels[i];

        const ok = Number(lvl.answerIndex) === idx;
        const toast = $("#toast");

        if (toast){
          toast.style.display = "block";
          toast.textContent = ok ? "✅ Верно!" : "❌ Неверно. Попробуй ещё.";
        }

        if (!ok){
          btn.animate(
            [{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(0)"}],
            {duration:220,easing:"ease-out"}
          );
          return;
        }

        const ch = typeof lvl.keyChar === "string" ? lvl.keyChar : "";
        if (ch && state.key.length < KEY_LEN) state.key += ch;

        state.levelIndex = clamp(state.levelIndex + 1, 0, TOTAL);

        if (state.levelIndex >= TOTAL || state.key.length >= KEY_LEN){
          state.stage = "done";
        }

        save();
        setTimeout(()=>render(), 220);
      });
    }
  }

  render();
})();
// =========================
// WOW UI helpers (toasts + ripple + hover glow)
// =========================
(function WOW_UI(){
  // toast container
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap){
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }

  function toast({type="bad", title="Упс", subtitle="", ms=2200}){
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `
      <div class="ico">${type==="ok" ? "✅" : "❌"}</div>
      <div>
        <div class="txt">${title}</div>
        ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
      </div>
      <button class="x" aria-label="Закрыть">✕</button>
    `;
    wrap.appendChild(t);

    const close = () => {
      t.style.animation = "toastOut .28s ease forwards";
      setTimeout(() => t.remove(), 260);
    };
    t.querySelector(".x").addEventListener("click", close);

    if (ms) setTimeout(close, ms);
  }

  // expose globally so you can call it from existing logic
  window.UI_TOAST = toast;

  // ripple on click (delegated)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, .btn, .option, .answer, .choice");
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    const s = document.createElement("span");
    s.className = "ripple";
    s.style.left = x + "px";
    s.style.top  = y + "px";
    btn.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }, { passive: true });

  // cursor glow position for buttons
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest("button, .btn, .option, .answer, .choice");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--mx", mx + "%");
    el.style.setProperty("--my", my + "%");
  }, { passive: true });
})();
