function el(id){ return document.getElementById(id); }

window.addEventListener("DOMContentLoaded", function () {
  if (!window.LEVELS || !Array.isArray(window.LEVELS) || window.LEVELS.length === 0) {
    el("title").textContent = "Ошибка";
    el("question").textContent = "LEVELS не загрузился. Проверь data.js.";
    return;
  }

  // ----------------- BGM (фон) -----------------
  var cfg = window.GAME_CONFIG || {};
  var bgmList = Array.isArray(cfg.bgm) ? cfg.bgm : [];
  var bgmBaseVol = (typeof cfg.bgmVolume === "number") ? cfg.bgmVolume : 0.06;

  var bgm = new Audio();
  bgm.loop = false;
  bgm.volume = 0;

  var bgmIndex = 0;
  var bgmTargetVol = bgmBaseVol;
  var bgmMuted = false;
  var bgmFader = null;
  var bgmPrimed = false;
  var bgmDesired = true;
  var bgmIsPlaying = false;

  function bgmPickTrack(){
    if (!bgmList.length) return null;
    var t = bgmList[bgmIndex % bgmList.length];
    bgmIndex++;
    return t;
  }
  function bgmStopFade(){ if (bgmFader) { clearInterval(bgmFader); bgmFader = null; } }
  function bgmFadeTo(target, ms, after){
    bgmStopFade();
    var start = bgm.volume;
    var t0 = Date.now();
    var dur = Math.max(80, ms | 0);
    bgmFader = setInterval(function(){
      var p = (Date.now() - t0) / dur;
      if (p >= 1) p = 1;
      bgm.volume = start + (target - start) * p;
      if (p === 1) {
        bgmStopFade();
        if (after) after();
      }
    }, 20);
  }
  function bgmEnsureSrc(){
    if (!bgm.src) {
      var tr = bgmPickTrack();
      if (!tr) return false;
      bgm.src = tr;
    }
    return true;
  }
  function bgmEnsurePlaying(){
    if (!bgmList.length || bgmMuted) return;
    if (!bgmEnsureSrc()) return;

    bgm.onended = function(){
      var next = bgmPickTrack();
      if (next) bgm.src = next;
      bgm.currentTime = 0;
      bgm.play().catch(function(){});
    };
    bgm.play().then(function(){ bgmIsPlaying = true; }).catch(function(){});
  }
  function bgmPlaySoft(){
    if (!bgmList.length || bgmMuted) return;
    bgmEnsurePlaying();
    if (bgmIsPlaying && bgm.volume > Math.max(0.02, bgmTargetVol * 0.6)) {
      bgmFadeTo(bgmTargetVol, 180);
      return;
    }
    var startVol = Math.max(0, Math.min(1, bgmTargetVol * 0.30));
    if (bgm.volume < 0.005) bgm.volume = 0;
    bgmFadeTo(startVol, 200, function(){
      bgmFadeTo(bgmTargetVol, 450);
    });
  }
  function bgmPauseSoft(){
    bgmFadeTo(0, 450, function(){
      try { bgm.pause(); } catch(e){}
      bgmIsPlaying = false;
    });
  }
  function bgmSetDesired(shouldPlay){
    bgmDesired = !!shouldPlay;
    if (!bgmPrimed) return;
    if (bgmMuted) return;
    if (bgmDesired) bgmPlaySoft();
    else bgmPauseSoft();
  }

  // BGM UI
  var bgmPanel = document.createElement("div");
  bgmPanel.id = "bgmPanel";
  bgmPanel.style.position = "fixed";
  bgmPanel.style.top = "12px";
  bgmPanel.style.right = "12px";
  bgmPanel.style.zIndex = "9999";
  bgmPanel.style.display = "flex";
  bgmPanel.style.alignItems = "center";
  bgmPanel.style.gap = "10px";
  bgmPanel.style.padding = "8px 10px";
  bgmPanel.style.borderRadius = "14px";
  bgmPanel.style.border = "1px solid rgba(255,255,255,0.18)";
  bgmPanel.style.background = "rgba(255,255,255,0.06)";
  bgmPanel.style.backdropFilter = "blur(8px)";

  var bgmBtn = document.createElement("button");
  bgmBtn.style.borderRadius = "12px";
  bgmBtn.style.border = "1px solid rgba(255,255,255,0.18)";
  bgmBtn.style.background = "rgba(0,0,0,0.18)";
  bgmBtn.style.color = "white";
  bgmBtn.style.fontWeight = "900";
  bgmBtn.style.padding = "8px 10px";
  bgmBtn.style.cursor = "pointer";

  function updateBgmBtn(){
    bgmBtn.textContent = bgmMuted ? "🔇" : "🔊";
    bgmBtn.title = bgmMuted ? "Включить музыку" : "Выключить музыку";
  }
  function bgmToggle(){
    bgmMuted = !bgmMuted;
    updateBgmBtn();
    if (bgmMuted) bgmPauseSoft();
    else { if (bgmDesired) bgmPlaySoft(); }
  }
  bgmBtn.onclick = function(){ bgmToggle(); };

  var vol = document.createElement("input");
  vol.type = "range";
  vol.min = "0"; vol.max = "100";
  vol.value = String(Math.round(bgmTargetVol * 100));
  vol.style.width = "120px";
  vol.style.cursor = "pointer";

  var volLabel = document.createElement("div");
  volLabel.style.color = "rgba(255,255,255,0.75)";
  volLabel.style.fontWeight = "800";
  volLabel.style.fontSize = "12px";
  volLabel.textContent = vol.value + "%";

  vol.oninput = function(){
    var v = parseInt(vol.value || "0", 10);
    bgmTargetVol = Math.max(0, Math.min(1, v / 100));
    volLabel.textContent = v + "%";
    if (!bgmMuted && bgmDesired) {
      bgmEnsurePlaying();
      bgmFadeTo(bgmTargetVol, 160);
    }
  };

  bgmPanel.appendChild(bgmBtn);
  bgmPanel.appendChild(vol);
  bgmPanel.appendChild(volLabel);
  document.body.appendChild(bgmPanel);
  updateBgmBtn();

  document.addEventListener("pointerdown", function primeOnce(){
    if (bgmPrimed) return;
    bgmPrimed = true;
    document.removeEventListener("pointerdown", primeOnce);
    if (!bgmMuted && bgmDesired) bgmPlaySoft();
  });

  // ----------------- Game core -----------------
  var idx = 0;
  var key = Array(window.LEVELS.length).fill("_");

  function clearUI(){
    el("toast").textContent = "";
    el("hintText").textContent = "";
    el("answers").innerHTML = "";
  }
  function setProgress(){
    el("progressLine").textContent = "Прогресс: " + (idx+1) + "/" + window.LEVELS.length;
    el("keyBox").textContent = key.join("");
  }
  function finish(){
    bgmSetDesired(true);
    el("title").textContent = "✅ Готово";
    el("question").textContent = "Ключ: " + key.join("");
    el("answers").innerHTML = '<a class="btn secondary" href="./end.html">Открыть финал</a>';
    el("keyBox").textContent = key.join("");
  }
  function isEditLevel(L){ return L && L.type === "edit"; }

  function render(){
    clearUI();
    setProgress();

    if (idx >= window.LEVELS.length) { finish(); return; }

    var L = window.LEVELS[idx];
    el("title").textContent = L.title;
    el("question").textContent = L.question;

    el("hintBtn").onclick = function(){ el("hintText").textContent = L.hint || "Подсказки нет."; };
    el("resetBtn").onclick = function(){ location.reload(); };

    bgmSetDesired(!isEditLevel(L));

    if (isEditLevel(L)) { renderEditChallenge(L); return; }

    for (var i = 0; i < L.answers.length; i++) {
      (function(iCopy){
        var b = document.createElement("button");
        b.textContent = L.answers[iCopy];
        b.onclick = function(){
          if (iCopy === L.correct) {
            key[idx] = L.symbol;
            idx++;
            render();
          } else {
            el("toast").textContent = "Неа 🙂 попробуй ещё раз";
          }
        };
        el("answers").appendChild(b);
      })(i);
    }
  }

  // ----------------- Level 8 editor (per-clip + project) -----------------
  function renderEditChallenge(L){
    var maxPick = L.maxPick || 3;

    // styles once
    if (!document.getElementById("cap2Styles")) {
      var st = document.createElement("style");
      st.id = "cap2Styles";
      st.textContent =
        ".cap2Wrap{display:grid;gap:12px;margin-top:10px;}" +
        ".cap2Card{border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.03);padding:10px;}" +
        ".cap2Grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}" +
        "@media (max-width:900px){.cap2Grid{grid-template-columns:repeat(2,1fr);}}" +
        ".cap2Clip{position:relative;border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02);cursor:pointer;transition:transform .12s ease,border-color .12s ease;}" +
        ".cap2Clip:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.25)}" +
        ".cap2Clip.active{border-color:rgba(255,255,255,.35)}" +
        ".cap2Thumb{position:relative;height:110px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.01));}" +
        ".cap2Meta{padding:10px;}" +
        ".cap2T{font-weight:900;font-size:14px;margin:0 0 4px;}" +
        ".cap2Tag{color:rgba(255,255,255,.65);font-size:12px;margin:0;}" +
        ".cap2Check{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:999px;border:2px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);}" +
        ".cap2Fill{width:0;height:0;border-radius:999px;background:rgba(100,180,255,1);transition:width .18s ease,height .18s ease,opacity .18s ease;opacity:0;}" +
        ".cap2Check.on .cap2Fill{width:12px;height:12px;opacity:1;}" +

        ".cap2Bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}" +
        ".cap2Btn{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:white;font-weight:900;cursor:pointer;}" +
        ".cap2Btn:disabled{opacity:.45;cursor:not-allowed;}" +

        ".cap2Cols{display:grid;grid-template-columns:1.45fr .95fr;gap:12px;align-items:start;}" +
        "@media (max-width:1100px){.cap2Cols{grid-template-columns:1fr;}}" +
        ".cap2PlayerBox{position:relative;border-radius:14px;overflow:hidden;}" +
        ".cap2Player{width:100%;border-radius:14px;display:block;}" +
        ".cap2Overlay{position:absolute;inset:0;pointer-events:none;}" +
        ".cap2Text{position:absolute;transform-origin:center;font-weight:900;text-shadow:0 2px 14px rgba(0,0,0,.65);white-space:pre;}" +
        ".cap2Sticker{position:absolute;transform-origin:center;}" +

        ".cap2Right{border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.02);overflow:hidden;}" +
        ".cap2Tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.10);}" +
        ".cap2Tab{flex:1;padding:10px 8px;background:rgba(0,0,0,.15);border:0;color:rgba(255,255,255,.75);font-weight:900;cursor:pointer;}" +
        ".cap2Tab.active{background:rgba(255,255,255,.08);color:white;}" +
        ".cap2Pane{padding:10px;max-height:540px;overflow:auto;}" +
        "@media (max-height:800px){.cap2Pane{max-height:440px;}}" +

        ".cap2Row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;}" +
        ".cap2Lbl{color:rgba(255,255,255,.7);min-width:140px;font-weight:900;font-size:13px;}" +
        ".cap2Input{flex:1;min-width:220px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:white;}" +
        ".cap2Kbd{padding:4px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);color:rgba(255,255,255,.85);font-weight:900;font-size:12px;}" +

        ".cap2MiniRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}" +
        ".cap2Mini{padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.20);color:rgba(255,255,255,.88);font-weight:900;cursor:pointer;}" +

        ".cap2Strip{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;}" +
        ".cap2Chip{padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.18);color:rgba(255,255,255,.85);font-weight:900;cursor:pointer;}" +
        ".cap2Chip.active{background:rgba(100,180,255,.18);border-color:rgba(100,180,255,.40);}" +

        ".cap2Hint{color:rgba(255,255,255,.65);font-weight:800;font-size:13px;}" +
        ".cap2Sep{margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);}" +

        ".cap2Result{display:grid;gap:10px;margin-top:8px;}" +
        ".cap2Result video{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.12);}"+
        ".cap2Link{display:inline-block;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:white;font-weight:900;text-decoration:none;}";
      document.head.appendChild(st);
    }

    // state
    var phase = "pick";
    var picks = [];
    var activeId = (L.clips && L.clips[0]) ? L.clips[0].id : null;

    function clipById(id){
      for (var i=0;i<L.clips.length;i++) if (L.clips[i].id === id) return L.clips[i];
      return null;
    }

    // per clip: trim/speed/vol
    var edits = {};
    function ensureEdit(id){
      if (!edits[id]) edits[id] = { start: 0, end: 0, speed: 1.0, vol: 1.0 };
      return edits[id];
    }

    // layers (per-clip + project)
    function defaultText(){ return { text:"", size:42, rot:0, x:50, y:82, color:"#ffffff", alpha:1, stroke:2 }; }
    function defaultSticker(){ return { enabled:false, url:"", size:30, rot:0, x:80, y:25, alpha:1 }; }
    function defaultFx(){ return { brightness:1, contrast:1, saturate:1, hue:0, blur:0 }; }

    var project = { text: defaultText(), sticker: defaultSticker(), fx: defaultFx() };
    var clipLayers = {}; // id -> {text, sticker, fx}
    function ensureClipLayer(id){
      if (!clipLayers[id]) clipLayers[id] = { text: defaultText(), sticker: defaultSticker(), fx: defaultFx() };
      return clipLayers[id];
    }

    var editTarget = "clip"; // "clip" | "project"
    function curLayer(){
      if (editTarget === "project") return project;
      return ensureClipLayer(activeId);
    }

    // export
    var exportBusy = false;
    var exportUrl = null;

    // UI build
    var root = document.createElement("div");
    root.className = "cap2Wrap";

    // PICK card
    var pickCard = document.createElement("div");
    pickCard.className = "cap2Card";

    var pickTitle = document.createElement("div");
    pickTitle.style.color = "rgba(255,255,255,.85)";
    pickTitle.style.fontWeight = "900";
    pickTitle.style.fontSize = "16px";
    pickTitle.textContent = "Шаг 1: выбери " + maxPick + " клипа";
    pickCard.appendChild(pickTitle);

    var pickInfo = document.createElement("div");
    pickInfo.className = "cap2Hint";
    pickInfo.style.marginTop = "6px";
    pickInfo.textContent = "Выбрано: 0/" + maxPick;
    pickCard.appendChild(pickInfo);

    var pickTopLabel = document.createElement("div");
    pickTopLabel.className = "cap2Hint";
    pickTopLabel.style.marginTop = "10px";
    pickTopLabel.textContent = "Просмотр:";
    pickCard.appendChild(pickTopLabel);

    var pickTop = document.createElement("div");
    pickTop.className = "cap2PlayerBox";
    pickCard.appendChild(pickTop);

    var pickVideo = document.createElement("video");
    pickVideo.className = "cap2Player";
    pickVideo.controls = true;
    pickVideo.preload = "metadata";
    pickVideo.playsInline = true;
    pickTop.appendChild(pickVideo);

    var pickBar = document.createElement("div");
    pickBar.className = "cap2Bar";
    pickBar.style.marginTop = "10px";
    pickCard.appendChild(pickBar);

    var btnToEditor = document.createElement("button");
    btnToEditor.className = "cap2Btn";
    btnToEditor.textContent = "Открыть редактор";
    btnToEditor.disabled = true;
    pickBar.appendChild(btnToEditor);

    var pickGrid = document.createElement("div");
    pickGrid.className = "cap2Grid";
    pickGrid.style.marginTop = "10px";
    pickCard.appendChild(pickGrid);

    // EDIT card
    var editCard = document.createElement("div");
    editCard.className = "cap2Card";
    editCard.style.display = "none";

    var topBar = document.createElement("div");
    topBar.className = "cap2Bar";
    editCard.appendChild(topBar);

    var leftTitle = document.createElement("div");
    leftTitle.style.color = "rgba(255,255,255,.88)";
    leftTitle.style.fontWeight = "900";
    leftTitle.textContent = "Редактор: собери одно видео из 3 клипов";
    topBar.appendChild(leftTitle);

    var topBtns = document.createElement("div");
    topBtns.style.display = "flex";
    topBtns.style.gap = "10px";
    topBtns.style.flexWrap = "wrap";
    topBar.appendChild(topBtns);

    var btnPrev = document.createElement("button");
    btnPrev.className = "cap2Btn";
    btnPrev.textContent = "◀ Предыдущий";
    topBtns.appendChild(btnPrev);

    var btnNext = document.createElement("button");
    btnNext.className = "cap2Btn";
    btnNext.textContent = "Следующий ▶";
    topBtns.appendChild(btnNext);

    var btnPreviewAll = document.createElement("button");
    btnPreviewAll.className = "cap2Btn";
    btnPreviewAll.textContent = "▶ Превью всей сборки";
    topBtns.appendChild(btnPreviewAll);

    var btnExport = document.createElement("button");
    btnExport.className = "cap2Btn";
    btnExport.textContent = "🎬 Сгенерировать видео (со звуком)";
    topBtns.appendChild(btnExport);

    var btnNextLevel = document.createElement("button");
    btnNextLevel.className = "cap2Btn";
    btnNextLevel.textContent = "Дальше";
    btnNextLevel.disabled = true;
    topBtns.appendChild(btnNextLevel);

    var cols = document.createElement("div");
    cols.className = "cap2Cols";
    cols.style.marginTop = "10px";
    editCard.appendChild(cols);

    // left col
    var leftCol = document.createElement("div");
    cols.appendChild(leftCol);

    var playerBox = document.createElement("div");
    playerBox.className = "cap2PlayerBox";
    leftCol.appendChild(playerBox);

    var editVideo = document.createElement("video");
    editVideo.className = "cap2Player";
    editVideo.controls = true;
    editVideo.playsInline = true;
    editVideo.preload = "metadata";
    playerBox.appendChild(editVideo);

    var overlay = document.createElement("div");
    overlay.className = "cap2Overlay";
    playerBox.appendChild(overlay);

    var overlayText = document.createElement("div");
    overlayText.className = "cap2Text";
    overlay.appendChild(overlayText);

    var overlaySticker = document.createElement("img");
    overlaySticker.className = "cap2Sticker";
    overlaySticker.style.display = "none";
    overlay.appendChild(overlaySticker);

    var stripTitle = document.createElement("div");
    stripTitle.className = "cap2Hint";
    stripTitle.style.marginTop = "10px";
    stripTitle.textContent = "Выбранные клипы:";
    leftCol.appendChild(stripTitle);

    var strip = document.createElement("div");
    strip.className = "cap2Strip";
    leftCol.appendChild(strip);

    // right col
    var rightCol = document.createElement("div");
    rightCol.className = "cap2Right";
    cols.appendChild(rightCol);

    var tabs = document.createElement("div");
    tabs.className = "cap2Tabs";
    rightCol.appendChild(tabs);

    var pane = document.createElement("div");
    pane.className = "cap2Pane";
    rightCol.appendChild(pane);

    function addTab(name){
      var b = document.createElement("button");
      b.className = "cap2Tab";
      b.textContent = name;
      tabs.appendChild(b);
      return b;
    }

    var tabClip = addTab("Клип");
    var tabText = addTab("Текст");
    var tabSticker = addTab("Стикер");
    var tabFx = addTab("Фильтры");
    var tabExportUI = addTab("Экспорт");

    var currentTab = "Клип";
    function setTab(tab){
      currentTab = tab;
      [tabClip,tabText,tabSticker,tabFx,tabExportUI].forEach(function(x){ x.classList.remove("active"); });
      pane.innerHTML = "";

      if (tab === "Клип") { tabClip.classList.add("active"); renderPaneClip(); }
      if (tab === "Текст") { tabText.classList.add("active"); renderPaneText(); }
      if (tab === "Стикер") { tabSticker.classList.add("active"); renderPaneSticker(); }
      if (tab === "Фильтры") { tabFx.classList.add("active"); renderPaneFx(); }
      if (tab === "Экспорт") { tabExportUI.classList.add("active"); renderPaneExport(); }
    }

    tabClip.onclick = function(){ setTab("Клип"); };
    tabText.onclick = function(){ setTab("Текст"); };
    tabSticker.onclick = function(){ setTab("Стикер"); };
    tabFx.onclick = function(){ setTab("Фильтры"); };
    tabExportUI.onclick = function(){ setTab("Экспорт"); };

    function buildFilterString(fxObj){
      return "brightness("+fxObj.brightness+") contrast("+fxObj.contrast+") saturate("+fxObj.saturate+") hue-rotate("+fxObj.hue+"deg) blur("+fxObj.blur+"px)";
    }

    function applyOverlaysPreview(){
      var layer = curLayer();
      editVideo.style.filter = buildFilterString(layer.fx);

      var t = (layer.text.text || "").trim();
      if (!t) {
        overlayText.style.display = "none";
      } else {
        overlayText.style.display = "block";
        overlayText.textContent = t;
        overlayText.style.left = layer.text.x + "%";
        overlayText.style.top = layer.text.y + "%";
        overlayText.style.fontSize = layer.text.size + "px";
        overlayText.style.color = layer.text.color;
        overlayText.style.opacity = String(layer.text.alpha);
        overlayText.style.transform = "translate(-50%, -50%) rotate(" + layer.text.rot + "deg)";
        overlayText.style.webkitTextStroke = (layer.text.stroke > 0)
          ? (layer.text.stroke + "px rgba(0,0,0,0.85)")
          : "0px transparent";
      }

      if (layer.sticker.enabled && layer.sticker.url) {
        overlaySticker.style.display = "block";
        overlaySticker.src = layer.sticker.url;
        overlaySticker.style.left = layer.sticker.x + "%";
        overlaySticker.style.top = layer.sticker.y + "%";
        overlaySticker.style.opacity = String(layer.sticker.alpha);
        overlaySticker.style.transform = "translate(-50%, -50%) rotate(" + layer.sticker.rot + "deg)";
        overlaySticker.style.width = layer.sticker.size + "%";
        overlaySticker.style.height = "auto";
      } else {
        overlaySticker.style.display = "none";
      }
    }

    // loop within start/end
    editVideo.ontimeupdate = function(){
      if (phase !== "edit") return;
      var st = ensureEdit(activeId);
      if (st.end > st.start && editVideo.currentTime > st.end) {
        editVideo.currentTime = st.start;
      }
    };

    function updatePrevNextButtons(){
      var i = picks.indexOf(activeId);
      btnPrev.disabled = (i <= 0);
      btnNext.disabled = (i < 0 || i >= picks.length - 1);
    }

    function renderStrip(){
      strip.innerHTML = "";
      for (var i=0;i<picks.length;i++){
        (function(id, ix){
          var c = clipById(id);
          var chip = document.createElement("button");
          chip.className = "cap2Chip" + (id === activeId ? " active" : "");
          chip.textContent = (ix+1) + ") " + (c ? c.title : id);
          chip.onclick = function(){ loadEditClip(id); };
          strip.appendChild(chip);
        })(picks[i], i);
      }
    }

    function loadEditClip(id){
      activeId = id;
      var c = clipById(id);
      if (!c) return;

      renderStrip();
      var st = ensureEdit(id);

      editVideo.src = c.src;
      editVideo.load();

      editVideo.onloadedmetadata = function(){
        var dur = (isFinite(editVideo.duration) && editVideo.duration > 0) ? editVideo.duration : 10;

        if (st.end === 0) st.end = Math.min(dur, 3);
        st.start = Math.max(0, Math.min(st.start, dur));
        st.end = Math.max(0, Math.min(st.end, dur));
        if (st.end < st.start) st.end = st.start;

        editVideo.currentTime = st.start;
        editVideo.playbackRate = st.speed;
        editVideo.volume = st.vol;

        applyOverlaysPreview();
        editVideo.play().catch(function(){});

        updatePrevNextButtons();
        setTab(currentTab);
      };
    }

    function makeRow(lblText, inputEl, kbdText){
      var row = document.createElement("div");
      row.className = "cap2Row";
      var lbl = document.createElement("div");
      lbl.className = "cap2Lbl";
      lbl.textContent = lblText;
      row.appendChild(lbl);
      row.appendChild(inputEl);
      var k = null;
      if (kbdText != null) {
        k = document.createElement("div");
        k.className = "cap2Kbd";
        k.textContent = kbdText;
        row.appendChild(k);
      }
      return { row: row, kbd: k };
    }
    function makeRange(min,max,step,value){
      var r = document.createElement("input");
      r.type = "range";
      r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(value);
      r.style.flex = "1";
      r.style.minWidth = "220px";
      return r;
    }
    function divider(text){
      var d = document.createElement("div");
      d.className = "cap2Sep cap2Hint";
      d.textContent = text;
      return d;
    }

    function renderTargetSwitch(){
      var row = document.createElement("div");
      row.className = "cap2Row";

      var lbl = document.createElement("div");
      lbl.className = "cap2Lbl";
      lbl.textContent = "Редактируешь";
      row.appendChild(lbl);

      var b1 = document.createElement("button");
      b1.className = "cap2Btn";
      b1.textContent = "Этот клип";
      b1.onclick = function(){ editTarget = "clip"; applyOverlaysPreview(); setTab(currentTab); };
      row.appendChild(b1);

      var b2 = document.createElement("button");
      b2.className = "cap2Btn";
      b2.textContent = "Проект (всё видео)";
      b2.onclick = function(){ editTarget = "project"; applyOverlaysPreview(); setTab(currentTab); };
      row.appendChild(b2);

      var hint = document.createElement("div");
      hint.className = "cap2Hint";
      hint.style.marginTop = "6px";
      hint.textContent = (editTarget === "project")
        ? "Сейчас правишь ОБЩИЙ слой (на всё итоговое видео)."
        : "Сейчас правишь ТОЛЬКО текущий клип.";
      pane.appendChild(row);
      pane.appendChild(hint);
    }

    function renderPaneClip(){
      renderTargetSwitch();
      pane.appendChild(divider("Настройки клипа (Start/End/Speed/Volume)"));

      var c = clipById(activeId);
      var st = ensureEdit(activeId);

      var name = document.createElement("div");
      name.style.color = "rgba(255,255,255,.85)";
      name.style.fontWeight = "900";
      name.textContent = c ? c.title : "—";
      pane.appendChild(name);

      var dur = (isFinite(editVideo.duration) && editVideo.duration > 0) ? editVideo.duration : 10;

      var rStart = makeRange(0, dur, 0.1, st.start);
      var rowStart = makeRow("Start (сек)", rStart, st.start.toFixed(1)+"s");
      pane.appendChild(rowStart.row);
      rStart.oninput = function(){
        st.start = parseFloat(rStart.value);
        if (st.end < st.start) st.end = st.start;
        rowStart.kbd.textContent = st.start.toFixed(1)+"s";
      };

      var rEnd = makeRange(0, dur, 0.1, st.end);
      var rowEnd = makeRow("End (сек)", rEnd, st.end.toFixed(1)+"s");
      pane.appendChild(rowEnd.row);
      rEnd.oninput = function(){
        st.end = parseFloat(rEnd.value);
        if (st.end < st.start) st.start = st.end;
        rowEnd.kbd.textContent = st.end.toFixed(1)+"s";
      };

      var rSpeed = makeRange(0.5, 2.0, 0.1, st.speed);
      var rowSpeed = makeRow("Speed", rSpeed, st.speed.toFixed(1)+"x");
      pane.appendChild(rowSpeed.row);
      rSpeed.oninput = function(){
        st.speed = parseFloat(rSpeed.value);
        editVideo.playbackRate = st.speed;
        rowSpeed.kbd.textContent = st.speed.toFixed(1)+"x";
      };

      var rVol = makeRange(0, 1, 0.05, st.vol);
      var rowVol = makeRow("Громкость", rVol, Math.round(st.vol*100)+"%");
      pane.appendChild(rowVol.row);
      rVol.oninput = function(){
        st.vol = parseFloat(rVol.value);
        editVideo.volume = st.vol;
        rowVol.kbd.textContent = Math.round(st.vol*100)+"%";
      };
    }

    function renderPaneText(){
      renderTargetSwitch();
      pane.appendChild(divider("Текст (НЕ переносится между клипами, если выбран “Этот клип”)"));

      var layer = curLayer();

      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "cap2Input";
      inp.placeholder = "Напр: MARK EDIT";
      inp.value = layer.text.text;
      inp.oninput = function(){ layer.text.text = inp.value; applyOverlaysPreview(); };
      pane.appendChild(makeRow("Текст", inp).row);

      function addR(lbl, min,max,step, val, suffix, setter){
        var r = makeRange(min,max,step,val);
        var row = makeRow(lbl, r, String(val)+(suffix||""));
        pane.appendChild(row.row);
        r.oninput = function(){
          var v = parseFloat(r.value);
          setter(v);
          row.kbd.textContent = String(v)+(suffix||"");
          applyOverlaysPreview();
        };
      }

      addR("Размер", 12, 140, 1, layer.text.size, "px", function(v){ layer.text.size=v; });
      addR("Поворот", -180, 180, 1, layer.text.rot, "°", function(v){ layer.text.rot=v; });
      addR("X", 0, 100, 1, layer.text.x, "%", function(v){ layer.text.x=v; });
      addR("Y", 0, 100, 1, layer.text.y, "%", function(v){ layer.text.y=v; });
      addR("Прозрачн.", 0, 1, 0.05, layer.text.alpha, "", function(v){ layer.text.alpha=v; });
      addR("Обводка", 0, 8, 1, layer.text.stroke, "px", function(v){ layer.text.stroke=v; });

      var colorRow = document.createElement("div");
      colorRow.className = "cap2Row";
      var lbl = document.createElement("div");
      lbl.className = "cap2Lbl";
      lbl.textContent = "Цвет";
      colorRow.appendChild(lbl);

      var col = document.createElement("input");
      col.type = "color";
      col.value = layer.text.color;
      col.style.height = "40px";
      col.style.width = "70px";
      col.style.borderRadius = "10px";
      col.style.border = "1px solid rgba(255,255,255,.18)";
      col.style.background = "rgba(0,0,0,.2)";
      col.oninput = function(){ layer.text.color = col.value; applyOverlaysPreview(); };
      colorRow.appendChild(col);
      pane.appendChild(colorRow);
    }

    function renderPaneSticker(){
      renderTargetSwitch();
      pane.appendChild(divider("Стикер/картинка (тоже отдельно по клипу или общая на проект)"));

      var layer = curLayer();

      var row = document.createElement("div");
      row.className = "cap2Row";
      var lbl = document.createElement("div");
      lbl.className = "cap2Lbl";
      lbl.textContent = "Загрузить";
      row.appendChild(lbl);

      var f = document.createElement("input");
      f.type = "file";
      f.accept = "image/*";
      f.style.flex = "1";
      f.onchange = function(){
        var file = f.files && f.files[0];
        if (!file) return;
        layer.sticker.enabled = true;
        layer.sticker.url = URL.createObjectURL(file);
        applyOverlaysPreview();
      };
      row.appendChild(f);
      pane.appendChild(row);

      function addR(lbl, min,max,step, val, suffix, setter){
        var r = makeRange(min,max,step,val);
        var row = makeRow(lbl, r, String(val)+(suffix||""));
        pane.appendChild(row.row);
        r.oninput = function(){
          var v = parseFloat(r.value);
          setter(v);
          row.kbd.textContent = String(v)+(suffix||"");
          applyOverlaysPreview();
        };
      }

      addR("Размер", 5, 90, 1, layer.sticker.size, "%", function(v){ layer.sticker.size=v; });
      addR("Поворот", -180, 180, 1, layer.sticker.rot, "°", function(v){ layer.sticker.rot=v; });
      addR("X", 0, 100, 1, layer.sticker.x, "%", function(v){ layer.sticker.x=v; });
      addR("Y", 0, 100, 1, layer.sticker.y, "%", function(v){ layer.sticker.y=v; });
      addR("Прозрачн.", 0, 1, 0.05, layer.sticker.alpha, "", function(v){ layer.sticker.alpha=v; });

      var off = document.createElement("button");
      off.className = "cap2Btn";
      off.textContent = "Убрать стикер";
      off.onclick = function(){
        layer.sticker.enabled = false;
        layer.sticker.url = "";
        applyOverlaysPreview();
        setTab("Стикер");
      };
      pane.appendChild(off);
    }

    function renderPaneFx(){
      renderTargetSwitch();
      pane.appendChild(divider("Фильтры (отдельно на клип или общий на проект)"));

      var layer = curLayer();

      function addFx(lbl, min,max,step, val, suffix, setter){
        var r = makeRange(min,max,step,val);
        var row = makeRow(lbl, r, String(val)+(suffix||""));
        pane.appendChild(row.row);
        r.oninput = function(){
          var v = parseFloat(r.value);
          setter(v);
          row.kbd.textContent = String(val)+(suffix||"");
          applyOverlaysPreview();
        };
        // FIX: correct display
        r.oninput = function(){
          var v = parseFloat(r.value);
          setter(v);
          row.kbd.textContent = String(v)+(suffix||"");
          applyOverlaysPreview();
        };
      }

      addFx("Brightness", 0.5, 1.6, 0.05, layer.fx.brightness, "", function(v){ layer.fx.brightness=v; });
      addFx("Contrast", 0.5, 1.8, 0.05, layer.fx.contrast, "", function(v){ layer.fx.contrast=v; });
      addFx("Saturate", 0.0, 2.2, 0.05, layer.fx.saturate, "", function(v){ layer.fx.saturate=v; });
      addFx("Hue", -180, 180, 1, layer.fx.hue, "°", function(v){ layer.fx.hue=v; });
      addFx("Blur", 0, 6, 0.2, layer.fx.blur, "px", function(v){ layer.fx.blur=v; });

      var reset = document.createElement("button");
      reset.className = "cap2Btn";
      reset.textContent = "Сбросить фильтры";
      reset.onclick = function(){
        layer.fx = defaultFx();
        if (editTarget === "project") project.fx = layer.fx;
        else ensureClipLayer(activeId).fx = layer.fx;
        applyOverlaysPreview();
        setTab("Фильтры");
      };
      pane.appendChild(reset);
    }

    function renderPaneExport(){
      pane.appendChild(divider("Результат"));
      var hint = document.createElement("div");
      hint.className = "cap2Hint";
      hint.textContent = exportUrl ? "Готово: смотри и скачивай ниже." : "Сначала нажми “Сгенерировать видео (со звуком)” сверху.";
      pane.appendChild(hint);

      var box = document.createElement("div");
      box.className = "cap2Result";
      pane.appendChild(box);

      var v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      box.appendChild(v);

      var a = document.createElement("a");
      a.className = "cap2Link";
      a.textContent = "⬇ Скачать видео";
      a.href = "#";
      a.download = "edit_challenge.webm";
      box.appendChild(a);

      if (exportUrl) {
        v.src = exportUrl;
        v.load();
        a.href = exportUrl;
      } else {
        v.style.display = "none";
        a.style.display = "none";
      }
    }

    // preview sequence
    var seqMode = false;
    function sleep(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }

    async function previewAll(){
      if (seqMode) return;
      seqMode = true;
      try {
        for (var i=0;i<picks.length;i++){
          var id = picks[i];
          var c = clipById(id);
          var st = ensureEdit(id);

          await new Promise(function(resolve){
            editVideo.onloadedmetadata = function(){
              editVideo.playbackRate = st.speed;
              editVideo.volume = st.vol;
              editVideo.currentTime = st.start;
              applyOverlaysPreview();
              resolve();
            };
            editVideo.src = c.src;
            editVideo.load();
          });

          await editVideo.play().catch(function(){});
          while (editVideo.currentTime < st.end) {
            await sleep(60);
          }
        }
      } catch(e) {
        console.error(e);
      } finally {
        seqMode = false;
      }
    }

    // ==== EXPORT FIX: avoid black canvas ====

    async function waitFirstFrame(){
      var t0 = Date.now();
      while ((!editVideo.videoWidth || !editVideo.videoHeight) && (Date.now() - t0) < 3000){
        await sleep(50);
      }
      try { await editVideo.play(); } catch(e) {}
      await sleep(120);

      var c = document.createElement("canvas");
      c.width = 64; c.height = 36;
      var x = c.getContext("2d");

      try{
        x.drawImage(editVideo, 0, 0, c.width, c.height);
      }catch(e){
        return { ok:false, reason:"drawImage error" };
      }

      var px = x.getImageData(0,0,c.width,c.height).data;
      var sum = 0;
      for (var i=0;i<px.length;i+=4){
        sum += px[i] + px[i+1] + px[i+2];
      }
      if (sum < 1000) return { ok:false, reason:"black frame" };
      return { ok:true };
    }

    function buildFilterString(fxObj){
      return "brightness("+fxObj.brightness+") contrast("+fxObj.contrast+") saturate("+fxObj.saturate+") hue-rotate("+fxObj.hue+"deg) blur("+fxObj.blur+"px)";
    }

    function drawFrame(ctx, w, h, clipLayer, projectLayer){
      ctx.clearRect(0,0,w,h);

      ctx.filter = buildFilterString(clipLayer.fx);
      try { ctx.drawImage(editVideo, 0, 0, w, h); } catch(e) {}

      try{
        ctx.filter = buildFilterString(projectLayer.fx);
        ctx.drawImage(ctx.canvas, 0, 0);
      } catch(e) {}

      ctx.filter = "none";

      function drawText(layer){
        var t = (layer.text.text || "").trim();
        if (!t) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, layer.text.alpha));
        ctx.translate((layer.text.x/100) * w, (layer.text.y/100) * h);
        ctx.rotate((layer.text.rot * Math.PI) / 180);
        ctx.font = "900 " + Math.round(layer.text.size) + "px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (layer.text.stroke > 0) {
          ctx.lineWidth = layer.text.stroke * 2;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.strokeText(t, 0, 0);
        }
        ctx.fillStyle = layer.text.color;
        ctx.fillText(t, 0, 0);
        ctx.restore();
      }

      function drawSticker(layer){
        if (!layer.sticker.enabled || !layer.sticker.url) return;
        var img = layer._stImg;
        if (!img || !img.complete) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, layer.sticker.alpha));
        var px = (layer.sticker.x/100) * w;
        var py = (layer.sticker.y/100) * h;
        var targetW = (layer.sticker.size/100) * w;
        var ratio = img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) : 1;
        var targetH = targetW * ratio;

        ctx.translate(px, py);
        ctx.rotate((layer.sticker.rot * Math.PI) / 180);
        ctx.drawImage(img, -targetW/2, -targetH/2, targetW, targetH);
        ctx.restore();
      }

      drawText(clipLayer);
      drawSticker(clipLayer);
      drawText(projectLayer);
      drawSticker(projectLayer);
    }

    function ensureStickerImagesLoaded(){
      function loadImgFor(layer){
        if (!layer.sticker.enabled || !layer.sticker.url) { layer._stImg = null; return Promise.resolve(); }
        return new Promise(function(resolve){
          var img = new Image();
          img.onload = function(){ layer._stImg = img; resolve(); };
          img.onerror = function(){ layer._stImg = null; resolve(); };
          img.src = layer.sticker.url;
        });
      }

      var promises = [loadImgFor(project)];
      picks.forEach(function(id){
        promises.push(loadImgFor(ensureClipLayer(id)));
      });
      return Promise.all(promises);
    }

    async function exportWebmWithAudio(){
      if (exportBusy) return;
      exportBusy = true;
      btnExport.disabled = true;
      btnExport.textContent = "⏳ Генерация...";

      try {
        await ensureStickerImagesLoaded();

        // load first clip to get real frame size
        var first = clipById(picks[0]);
        var firstSt = ensureEdit(picks[0]);

        await new Promise(function(resolve){
          editVideo.onloadedmetadata = function(){
            editVideo.playbackRate = firstSt.speed;
            editVideo.volume = firstSt.vol;
            editVideo.currentTime = firstSt.start;
            resolve();
          };
          editVideo.src = first.src;
          editVideo.load();
        });

        var okFrame = await waitFirstFrame();
        if (!okFrame.ok){
          el("toast").textContent =
            "❌ Экспорт: видео рисуется чёрным (браузер не отдаёт кадры в canvas). " +
            "Открой квест в Chrome/Edge. Если уже там — проверь, что mp4 обычные (H.264).";
          throw new Error("Canvas frame not available: " + okFrame.reason);
        }

        var baseW = editVideo.videoWidth || 1280;
        var baseH = editVideo.videoHeight || 720;

        var canvas = document.createElement("canvas");
        canvas.width = baseW;
        canvas.height = baseH;
        var ctx = canvas.getContext("2d");

        var canvasStream = canvas.captureStream(30);

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        var ac = new AudioCtx();

        var srcNode = ac.createMediaElementSource(editVideo);
        var gainNode = ac.createGain();
        gainNode.gain.value = 1.0;
        var dest = ac.createMediaStreamDestination();

        srcNode.connect(gainNode);
        gainNode.connect(dest);

        var mixedStream = new MediaStream([]);
        canvasStream.getVideoTracks().forEach(function(t){ mixedStream.addTrack(t); });
        dest.stream.getAudioTracks().forEach(function(t){ mixedStream.addTrack(t); });

        var mime = "";
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) mime = "video/webm;codecs=vp9,opus";
        else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) mime = "video/webm;codecs=vp8,opus";
        else mime = "video/webm";

        var rec = new MediaRecorder(mixedStream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        var chunks = [];
        rec.ondataavailable = function(e){
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        rec.start(250);
        await ac.resume();

        for (var i=0;i<picks.length;i++){
          var id = picks[i];
          var c = clipById(id);
          var st = ensureEdit(id);

          await new Promise(function(resolve){
            editVideo.onloadedmetadata = function(){
              editVideo.playbackRate = st.speed;
              editVideo.volume = st.vol;
              editVideo.currentTime = st.start;
              resolve();
            };
            editVideo.src = c.src;
            editVideo.load();
          });

          var ok2 = await waitFirstFrame();
          if (!ok2.ok){
            throw new Error("Black frame on clip " + id + ": " + ok2.reason);
          }

          await editVideo.play().catch(function(){});

          var clipLayer = ensureClipLayer(id);

          while (editVideo.currentTime < st.end) {
            drawFrame(ctx, baseW, baseH, clipLayer, project);
            await sleep(33);
          }

          drawFrame(ctx, baseW, baseH, clipLayer, project);
          await sleep(60);
        }

        rec.stop();
        await new Promise(function(resolve){ rec.onstop = resolve; });

        var blob = new Blob(chunks, { type: "video/webm" });
        if (exportUrl) URL.revokeObjectURL(exportUrl);
        exportUrl = URL.createObjectURL(blob);

        btnNextLevel.disabled = false;
        el("toast").textContent = "✅ Видео готово! Открой вкладку “Экспорт” для просмотра/скачивания.";
        if (currentTab === "Экспорт") setTab("Экспорт");

        try { srcNode.disconnect(); gainNode.disconnect(); } catch(e){}
        try { await ac.close(); } catch(e){}

      } catch (e) {
        console.error(e);
        if (!el("toast").textContent) {
          el("toast").textContent = "❌ Не удалось сгенерировать видео. Лучше всего работает в Chrome/Edge.";
        }
      } finally {
        exportBusy = false;
        btnExport.disabled = false;
        btnExport.textContent = "🎬 Сгенерировать видео (со звуком)";
      }
    }

    // PICK logic
    function updatePickUI(){
      pickInfo.textContent = "Выбрано: " + picks.length + "/" + maxPick;
      btnToEditor.disabled = (picks.length !== maxPick);
      btnToEditor.textContent = btnToEditor.disabled
        ? ("Открыть редактор ("+picks.length+"/"+maxPick+")")
        : "Открыть редактор";
    }

    function setActivePick(id){
      activeId = id;
      var c = clipById(id);
      if (!c) return;
      pickVideo.src = c.src;
      pickVideo.load();
      pickVideo.play().catch(function(){});
      renderPickGrid();
    }

    function togglePick(id){
      var p = picks.indexOf(id);
      if (p >= 0) picks.splice(p,1);
      else {
        if (picks.length >= maxPick) { el("toast").textContent = "Можно выбрать только " + maxPick + " клипа 🙂"; return; }
        picks.push(id);
      }
      el("toast").textContent = "";
      updatePickUI();
      renderPickGrid();
    }

    function renderPickGrid(){
      pickGrid.innerHTML = "";
      for (var i=0;i<L.clips.length;i++){
        (function(c){
          var card = document.createElement("div");
          card.className = "cap2Clip" + (c.id === activeId ? " active" : "");
          card.onclick = function(){ setActivePick(c.id); };

          var thumb = document.createElement("div");
          thumb.className = "cap2Thumb";
          if (c.thumb) {
            thumb.style.backgroundImage = "url('" + c.thumb + "')";
            thumb.style.backgroundSize = "cover";
            thumb.style.backgroundPosition = "center";
            var shade = document.createElement("div");
            shade.style.position = "absolute";
            shade.style.inset = "0";
            shade.style.background = "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55))";
            thumb.appendChild(shade);
          }
          card.appendChild(thumb);

          var meta = document.createElement("div");
          meta.className = "cap2Meta";
          var t = document.createElement("div");
          t.className = "cap2T";
          t.textContent = c.title;
          var tag = document.createElement("div");
          tag.className = "cap2Tag";
          tag.textContent = c.tag || "";
          meta.appendChild(t);
          meta.appendChild(tag);
          card.appendChild(meta);

          var check = document.createElement("div");
          check.className = "cap2Check" + (picks.indexOf(c.id)>=0 ? " on" : "");
          check.onclick = function(ev){
            ev.stopPropagation();
            togglePick(c.id);
          };
          var fill = document.createElement("div");
          fill.className = "cap2Fill";
          check.appendChild(fill);
          card.appendChild(check);

          pickGrid.appendChild(card);
        })(L.clips[i]);
      }
    }

    function enterEditor(){
      phase = "edit";
      pickCard.style.display = "none";
      editCard.style.display = "block";

      bgmSetDesired(false);

      activeId = picks[0];
      renderStrip();
      loadEditClip(activeId);
      setTab("Клип");
    }

    // buttons
    btnToEditor.onclick = function(){ enterEditor(); };

    btnPrev.onclick = function(){
      var i = picks.indexOf(activeId);
      if (i > 0) loadEditClip(picks[i-1]);
    };
    btnNext.onclick = function(){
      var i = picks.indexOf(activeId);
      if (i >= 0 && i < picks.length-1) loadEditClip(picks[i+1]);
    };

    btnPreviewAll.onclick = function(){ previewAll(); };
    btnExport.onclick = function(){ exportWebmWithAudio(); };

    btnNextLevel.onclick = function(){
      key[idx] = L.symbol;
      idx++;
      bgmSetDesired(true);
      render();
    };

    // mount
    root.appendChild(pickCard);
    root.appendChild(editCard);
    el("answers").appendChild(root);

    // init
    function initPick(){
      updatePickUI();
      if (activeId) setActivePick(activeId);
      renderPickGrid();
    }
    initPick();
  }

  render();
});
