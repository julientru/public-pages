// Slide Puzzle: slide the numbered tiles into the empty space until they are 1, 2, 3... in order.
(function () {
  const t = I18n.t;
  const COLORS = ["#ff6b6b", "#ff9f43", "#ffc93d", "#6bcb77", "#4dd0e1", "#4d96ff", "#9b5de5", "#f15bb5"];

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-size]");

  let size = 3, tiles = [], moves = 0, won = false;

  function neighbours(i) {
    const r = Math.floor(i / size), c = i % size, list = [];
    if (r > 0) list.push(i - size);
    if (r < size - 1) list.push(i + size);
    if (c > 0) list.push(i - 1);
    if (c < size - 1) list.push(i + 1);
    return list;
  }

  function solved() {
    return tiles.every((t, i) => t === (i + 1) % (size * size));
  }

  function newGame() {
    tiles = Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
    // Shuffle with real moves so the puzzle is always solvable.
    let blank = tiles.length - 1, prev = -1;
    const steps = size === 3 ? 60 : 160;
    for (let s = 0; s < steps || solved(); s++) {
      const options = neighbours(blank).filter((n) => n !== prev);
      const pick = options[Math.floor(Math.random() * options.length)];
      tiles[blank] = tiles[pick];
      tiles[pick] = 0;
      prev = blank;
      blank = pick;
    }
    moves = 0;
    won = false;
    messageEl.textContent = t("Put the numbers in order!");
    messageEl.classList.remove("win");
    boardEl.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    draw();
  }

  function draw(focusIndex) {
    boardEl.innerHTML = "";
    tiles.forEach((n, i) => {
      const el = document.createElement("button");
      el.className = "tile" + (n === 0 ? " blank" : "") + (n !== 0 && n === i + 1 ? " home" : "");
      if (n === 0) {
        el.tabIndex = -1;
        el.setAttribute("aria-label", t("Empty space"));
      } else {
        el.textContent = n;
        el.style.background = COLORS[(n - 1) % COLORS.length];
        el.addEventListener("click", () => slide(i));
      }
      boardEl.appendChild(el);
    });
    movesEl.textContent = moves;
    if (focusIndex !== undefined) boardEl.children[focusIndex].focus();
  }

  function slide(i) {
    if (won) return;
    const blank = tiles.indexOf(0);
    if (!neighbours(blank).includes(i)) {
      messageEl.textContent = t("That one can't move. Pick one next to the space!");
      return;
    }
    tiles[blank] = tiles[i];
    tiles[i] = 0;
    moves++;
    const hadFocus = boardEl.contains(document.activeElement);
    draw(hadFocus ? blank : undefined);
    if (solved()) {
      won = true;
      messageEl.textContent = t("🎉 Solved in {n} moves! 🎉", { n: moves });
      messageEl.classList.add("win");
    } else {
      messageEl.textContent = t("Put the numbers in order!");
    }
  }

  document.addEventListener("keydown", (e) => {
    // The arrow says which way a tile slides into the space.
    const blank = tiles.indexOf(0), r = Math.floor(blank / size), c = blank % size;
    const from = {
      ArrowLeft: c < size - 1 ? blank + 1 : -1,
      ArrowRight: c > 0 ? blank - 1 : -1,
      ArrowUp: r < size - 1 ? blank + size : -1,
      ArrowDown: r > 0 ? blank - size : -1,
    }[e.key];
    if (from === undefined) return;
    e.preventDefault();
    if (from >= 0) slide(from);
  });

  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      size = Number(btn.dataset.size);
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      newGame();
    });
  });
  document.getElementById("restart").addEventListener("click", newGame);

  newGame();
})();
