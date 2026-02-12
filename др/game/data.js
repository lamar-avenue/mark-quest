window.GAME_CONFIG = {
  // фоновая музыка (играет на всех уровнях, кроме edit)
  bgm: [
    "./assets/music/track1.mp3",
    "./assets/music/track2.mp3"
  ],
  // насколько тихо (0..1). 0.12 = очень тихо
  bgmVolume: 0.06
};

window.LEVELS = [
  { title:"Уровень 1/12", question:"Разогрев. Что обычно бывает сразу после дня рождения?", answers:["Новый год","День после дня рождения","Лето"], correct:1, symbol:"M", hint:"Буквально." },
  { title:"Уровень 2/12", question:"Логика. Что НЕ является числом?", answers:["7","два","0"], correct:1, symbol:"A", hint:"Формат записи." },
  { title:"Уровень 3/12", question:"Внимательность. Сколько букв в слове «Марк»?", answers:["3","4","5"], correct:1, symbol:"R", hint:"Посчитай." },
  { title:"Уровень 4/12", question:"Какое слово лишнее?", answers:["кот","собака","таблетка"], correct:2, symbol:"K", hint:"Два — животные." },
  { title:"Уровень 5/12", question:"3 + 5 = ?", answers:["7","8","9"], correct:1, symbol:"2", hint:"База." },
  { title:"Уровень 6/12", question:"Выбери строку без ошибки:", answers:["С ДНЁМ РОЖДЕНИЯ, МАРК!","С ДНЁМ РАЖДЕНИЯ, МАРК!","С ДНЁМ РОЖДЕНИЯ, МАРК!!1"], correct:0, symbol:"0", hint:"Опечатка." },
  { title:"Уровень 7/12", question:"Продолжи: 2, 4, 6, 8, …", answers:["9","10","12"], correct:1, symbol:"2", hint:"Чётные." },

  {
    title:"Уровень 8/12 — Edit Challenge",
    type:"edit",
    question:"Выбери 3 клипа для эдита. Клик по карточке — открывает в большом плеере. Кружок справа сверху — выбор.",
    hint:"Сначала посмотри клипы, потом выбери любые 3. Старт станет доступен.",
    maxPick: 3,
    symbol:"6",
    clips: [
      { id:"bleach1", title:"Bleach — clip 1", src:"./assets/level8/bleach1.mp4", thumb:"./assets/level8/bleach1.jpg", tag:"аниме • Bleach" },
      { id:"bleach2", title:"Bleach — clip 2", src:"./assets/level8/bleach2.mp4", thumb:"./assets/level8/bleach2.jpg", tag:"аниме • Bleach" },
      { id:"jjk1",    title:"Магическая битва — clip 1", src:"./assets/level8/jjk1.mp4",    thumb:"./assets/level8/jjk1.jpg",    tag:"аниме • JJK" },
      { id:"jjk2",    title:"Магическая битва — clip 2", src:"./assets/level8/jjk2.mp4",    thumb:"./assets/level8/jjk2.jpg",    tag:"аниме • JJK" },
      { id:"gohs1",   title:"Бог старшей школы — clip 1", src:"./assets/level8/gohs1.mp4",   thumb:"./assets/level8/gohs1.jpg",   tag:"аниме • GOHS" },
      { id:"gohs2",   title:"Бог старшей школы — clip 2", src:"./assets/level8/gohs2.mp4",   thumb:"./assets/level8/gohs2.jpg",   tag:"аниме • GOHS" }
    ]
  },

  { title:"Уровень 9/12", question:"Этот квест — …", answers:["Скучный","Нормальный","Легендарный"], correct:2, symbol:"B", hint:"Очевидно 😄" },
  { title:"Уровень 10/12", question:"Как пишется правильно?", answers:["падарок","подарок","подорок"], correct:1, symbol:"R", hint:"Орфография." },
  { title:"Уровень 11/12", question:"Что тяжелее?", answers:["1 кг железа","1 кг перьев","Одинаково"], correct:2, symbol:"O", hint:"Килограмм." },
  { title:"Уровень 12/12", question:"Финал. Нажми «ФИНИШ».", answers:["Почти","Не туда","ФИНИШ"], correct:2, symbol:"!", hint:"Смотри на надпись." }
];
