// docs/game/data.js
window.QUIZ_DATA = {
  title: "Квест для Марка",
  subtitle: "12 уровней. За каждый — 1 символ. Собери ключ и откроешь финал.",
  keyLength: 12,

  // фоновая музыка (пути проверь)
  musicTracks: [
    "game/assets/music/track1.mp3",
    "game/assets/music/track2.mp3",
  ],

  // клипы 8 уровня (проверь пути)
  editClips: [
    { id:"bleach1", title:"Bleach — clip 1", group:"аниме • Bleach",
      src:"game/assets/level8/bleach1.mp4", thumb:"game/assets/level8/bleach1.jpg" },
    { id:"bleach2", title:"Bleach — clip 2", group:"аниме • Bleach",
      src:"game/assets/level8/bleach2.mp4", thumb:"game/assets/level8/bleach2.jpg" },
    { id:"jjk1", title:"Магическая битва — clip 1", group:"аниме • JJK",
      src:"game/assets/level8/jjk1.mp4", thumb:"game/assets/level8/jjk1.jpg" },
  ],

  // 12 уровней (пока заглушки)
  levels: [
    { title:"Уровень 1/12", question:"Тест вопрос 1", options:["A","B","C"], answerIndex:0, keyChar:"M" },
    { title:"Уровень 2/12", question:"Тест вопрос 2", options:["A","B","C"], answerIndex:1, keyChar:"A" },
    { title:"Уровень 3/12", question:"Тест вопрос 3", options:["A","B","C"], answerIndex:2, keyChar:"R" },
    { title:"Уровень 4/12", question:"Тест вопрос 4", options:["A","B","C"], answerIndex:0, keyChar:"K" },
    { title:"Уровень 5/12", question:"Тест вопрос 5", options:["A","B","C"], answerIndex:1, keyChar:"2" },
    { title:"Уровень 6/12", question:"Тест вопрос 6", options:["A","B","C"], answerIndex:2, keyChar:"0" },
    { title:"Уровень 7/12", question:"Тест вопрос 7", options:["A","B","C"], answerIndex:0, keyChar:"2" },

    // 8 уровень — edit
    { type:"edit", title:"Уровень 8/12 — Edit Challenge", question:"Выбери 3 клипа.", keyChar:"6" },

    { title:"Уровень 9/12", question:"Тест вопрос 9", options:["A","B","C"], answerIndex:1, keyChar:"B" },
    { title:"Уровень 10/12", question:"Тест вопрос 10", options:["A","B","C"], answerIndex:2, keyChar:"R" },
    { title:"Уровень 11/12", question:"Тест вопрос 11", options:["A","B","C"], answerIndex:0, keyChar:"O" },
    { title:"Уровень 12/12", question:"Тест вопрос 12", options:["A","B","C"], answerIndex:1, keyChar:"!" },
  ],
};
