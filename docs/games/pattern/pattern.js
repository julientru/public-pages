// What's Next?: spot the repeating pattern and choose the missing picture.
(function () {
  const t = I18n.t;
  const SETS = [
    ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠"],
    ["🐶", "🐱", "🐭", "🐰", "🐻", "🐷"],
    ["🍎", "🍌", "🍇", "🍓", "🍊", "🍒"],
    ["⭐", "🌙", "☀️", "☁️", "⚡", "🌈"],
    ["🚗", "🚌", "🚲", "🚀", "🚂", "⛵"],
    ["🟥", "🟦", "🟩", "🟨", "🟪", "🟧"],
  ];
  // Patterns get harder as the stars go up. Each letter stands for a picture.
  const PATTERNS = [
    ["AB", "AAB", "ABB"],
    ["ABC", "AABB", "ABAC"],
    ["ABCD", "AABC", "ABBC", "ABCB", "AAABB"],
  ];

  const rowEl = document.getElementById("row");
  const choicesEl = document.getElementById("choices");
  const starsEl = document.getElementById("stars");
  const streakEl = document.getElementById("streak");
  const messageEl = document.getElementById("message");

  let stars = 0, streak = 0, answer = "", locked = false, choiceBtns = [], nextTimer = 0;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function newRound() {
    clearTimeout(nextTimer);
    locked = false;
    const level = Math.min(PATTERNS.length - 1, Math.floor(stars / 4));
    const pattern = pick(PATTERNS[level]);
    const pics = shuffle(pick(SETS).slice());
    const letters = [...new Set(pattern)];
    const map = {};
    letters.forEach((l, i) => (map[l] = pics[i]));

    // Show the pattern at least twice, then ask for one of the next pieces.
    const shown = Math.max(6, pattern.length * 2) + Math.floor(Math.random() * pattern.length);
    const seq = Array.from({ length: shown + 1 }, (_, i) => map[pattern[i % pattern.length]]);
    answer = seq[shown];

    rowEl.innerHTML = "";
    seq.forEach((pic, i) => {
      const el = document.createElement("div");
      el.className = "item" + (i === shown ? " ask" : "");
      el.textContent = i === shown ? "❓" : pic;
      rowEl.appendChild(el);
    });

    // Wrong choices come from the same pattern when possible, so you really have to look.
    const others = shuffle(pics.filter((p) => p !== answer));
    const inPattern = others.filter((p) => letters.some((l) => map[l] === p));
    const wrong = inPattern.concat(others.filter((p) => !inPattern.includes(p))).slice(0, 2);
    const options = shuffle([answer].concat(wrong));

    choicesEl.innerHTML = "";
    choiceBtns = options.map((pic, i) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.innerHTML = '<span class="key">' + (i + 1) + "</span>" + pic;
      b.setAttribute("aria-label", t("Choice {n}", { n: i + 1 }) + ": " + pic);
      b.addEventListener("click", () => choose(b, pic));
      choicesEl.appendChild(b);
      return b;
    });
    messageEl.textContent = t("What comes next?");
    messageEl.classList.remove("win");
  }

  function choose(btn, pic) {
    if (locked) return;
    if (pic === answer) {
      locked = true;
      btn.classList.add("right");
      stars++;
      streak++;
      rowEl.lastChild.textContent = pic;
      rowEl.lastChild.classList.remove("ask");
      messageEl.textContent = streak >= 3 ? t("🔥 {n} in a row! 🔥", { n: streak }) : pick(I18n.list(["Yes! 🌟", "Great looking! 👀", "Correct! 🎉"]));
      messageEl.classList.add("win");
      nextTimer = setTimeout(newRound, 1100);
    } else {
      btn.classList.add("wrong");
      btn.disabled = true;
      streak = 0;
      messageEl.textContent = t("Not quite. Look again! 🔍");
    }
    starsEl.textContent = stars;
    streakEl.textContent = streak;
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= choiceBtns.length && !choiceBtns[n - 1].disabled) choiceBtns[n - 1].click();
  });

  document.getElementById("restart").addEventListener("click", () => {
    stars = 0;
    streak = 0;
    starsEl.textContent = 0;
    streakEl.textContent = 0;
    newRound();
  });

  newRound();
})();
