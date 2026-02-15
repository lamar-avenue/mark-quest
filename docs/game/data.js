// docs/game/data.js
window.QUIZ_DATA = {
  title: "🎁 Квест для Марка",
  subtitle: "12 уровней. За каждый — 1 символ. Собери ключ и откроешь финал.",
  keyLength: 12,

  // Фоновая музыка (если не надо — оставь пустой массив [])
  musicTracks: [
    "game/assets/music/track1.mp3",
    "game/assets/music/track2.mp3"
  ],

  // 12 уровней: подставь свои вопросы/ответы и правильный индекс
  levels: [
    { title:"Уровень 1/12", question:"Разогрев. Что обычно бывает сразу после дня рождения?", options:["Новый год","День после дня рождения","Лето"], answerIndex:1, keyChar:"M" },
    { title:"Уровень 2/12", question:"Вопрос 2", options:["A","B","C"], answerIndex:0, keyChar:"A" },
    {
  type: "video",
  title: "Уровень 3/12 — ЧБД",
  question: "Смотри отрывок до кульминации. Что будет дальше?",
  videoSrc: "game/assets/level3/chbd.mp4",
  options: [
    "Вариант A — ...",
    "Вариант B — ...",
    "Вариант C — ..."
  ],
  answerIndex: 1,   // правильный вариант (0=A, 1=B, 2=C)
  keyChar: "R"      // символ ключа за правильный ответ
},

    { title:"Уровень 4/12", question:"Вопрос 4", options:["A","B","C"], answerIndex:0, keyChar:"K" },
    { title:"Уровень 5/12", question:"Что важнее в подарке?", options:["Цена","Оригинальность","Упаковка"], answerIndex:1, keyChar:"2" },
    { title:"Уровень 6/12", question:"Вопрос 6", options:["A","B","C"], answerIndex:0, keyChar:"0" },
    { title:"Уровень 7/12", question:"Вопрос 7", options:["A","B","C"], answerIndex:0, keyChar:"2" },
    { title:"Уровень 8/12", question:"Вопрос 8", options:["A","B","C"], answerIndex:0, keyChar:"6" },
    { title:"Уровень 9/12", question:"Вопрос 9", options:["A","B","C"], answerIndex:0, keyChar:"B" },
    { title:"Уровень 10/12", question:"Вопрос 10", options:["A","B","C"], answerIndex:0, keyChar:"R" },
    { title:"Уровень 11/12", question:"Вопрос 11", options:["A","B","C"], answerIndex:0, keyChar:"O" },
    { title:"Уровень 12/12", question:"Вопрос 12", options:["A","B","C"], answerIndex:0, keyChar:"!" }
  ],

  // Финальный текст (потом можешь сделать ссылку/страницу)
  final: {
    title: "✅ Готово",
    text:
      "Марк, с днём рождения!\n\n" +
      "Сертификат: 1 катка/созвон/прогулка по первому требованию 😄\n" +
      "Активируется словами: «Бро, давай по сертификату»."
  }
};
