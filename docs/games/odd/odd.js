// Odd One Out: all pictures but one belong to the same group. Find the one that doesn't.
(function () {
  const t = I18n.t;
  const GROUPS = [
    { name: "fruits", emoji: "🍎", items: ["🍎", "🍌", "🍇", "🍓", "🍊", "🍐", "🍒", "🍉"] },
    { name: "land animals", emoji: "🐾", kind: "animal", items: ["🐶", "🐱", "🐮", "🐷", "🐴", "🐑", "🦁", "🐯"] },
    { name: "things that go", emoji: "🚦", items: ["🚗", "🚌", "🚲", "🚂", "✈️", "🚀", "⛵", "🚜"] },
    { name: "weather", emoji: "🌦️", items: ["☀️", "🌧️", "❄️", "⛈️", "🌈", "☁️", "🌪️", "🌫️"] },
    { name: "balls", emoji: "⚽", items: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎱", "🏉"] },
    { name: "clothes", emoji: "👕", items: ["👕", "👖", "🧦", "👗", "🧢", "🧤", "👟", "🧣"] },
    { name: "sea animals", emoji: "🌊", kind: "animal", items: ["🐟", "🐙", "🦀", "🐬", "🐳", "🦈", "🐠", "🦑"] },
    { name: "music", emoji: "🎶", items: ["🎸", "🥁", "🎺", "🎻", "🎹", "🎷", "🎤", "🎧"] },
    { name: "vegetables", emoji: "🥕", items: ["🥕", "🥦", "🌽", "🥔", "🍆", "🥒", "🧅", "🥬"] },
    { name: "bugs", emoji: "🐞", kind: "animal", items: ["🐞", "🐝", "🦋", "🐛", "🐜", "🦗", "🦟", "🕷️"] },
  ];
  const ROUNDS = 10;

  const boardEl = document.getElementById("board");
  const starsEl = document.getElementById("stars");
  const roundEl = document.getElementById("round");
  const messageEl = document.getElementById("message");
  const hintEl = document.getElementById("hint");

  let round = 1, stars = 0, firstTry = true, locked = false, buttons = [], timer = 0;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function newRound() {
    clearTimeout(timer);
    locked = false;
    firstTry = true;
    const [main, ...rest] = shuffle(GROUPS.slice());
    // Never mix two kinds of animals: a fish among dogs would be confusing.
    const other = rest.find((g) => !main.kind || g.kind !== main.kind);
    // Later rounds show five pictures instead of four.
    const count = round > 5 ? 5 : 4;
    const odd = other.items[Math.floor(Math.random() * other.items.length)];
    const pics = shuffle(shuffle(main.items.slice()).slice(0, count - 1).concat(odd));

    boardEl.className = "board" + (count === 5 ? " five" : "");
    boardEl.innerHTML = "";
    buttons = pics.map((pic, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = '<span class="key">' + (i + 1) + "</span>" + pic;
      b.setAttribute("aria-label", t("Picture {n}", { n: i + 1 }) + ": " + pic);
      b.addEventListener("click", () => choose(b, pic === odd, main, other));
      boardEl.appendChild(b);
      return b;
    });
    roundEl.textContent = round;
    hintEl.textContent = "";
    messageEl.textContent = t("Which one does not belong?");
    messageEl.classList.remove("win");
  }

  function choose(btn, isOdd, main, other) {
    if (locked || btn.disabled) return;
    if (!isOdd) {
      btn.classList.add("wrong");
      btn.disabled = true;
      firstTry = false;
      messageEl.textContent = t("That one fits with the others. Try again!");
      return;
    }
    locked = true;
    btn.classList.add("right");
    if (firstTry) stars++;
    starsEl.textContent = stars;
    hintEl.textContent = t("The others are {a}, this is {b}", { a: t(main.name) + " " + main.emoji, b: t(other.name) + " " + other.emoji });
    if (round === ROUNDS) {
      Accounts.submit("odd", stars);
      messageEl.textContent = t("🎉 All done! {n} stars out of {total}! 🎉", { n: stars, total: ROUNDS });
      messageEl.classList.add("win");
      return;
    }
    messageEl.textContent = firstTry ? t("Yes! ⭐") : t("Found it! 👍");
    messageEl.classList.add("win");
    round++;
    timer = setTimeout(newRound, 1800);
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= buttons.length) buttons[n - 1].click();
  });

  document.getElementById("restart").addEventListener("click", () => {
    round = 1;
    stars = 0;
    starsEl.textContent = 0;
    newRound();
  });

  newRound();
})();
