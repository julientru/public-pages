// Color Flood: grow your patch from the top-left corner until the whole board is one color.
(function () {
  const t = I18n.t;
  const COLORS = [
    { fill: "#ff6b6b", name: "red", icon: "❤️" },
    { fill: "#4d96ff", name: "blue", icon: "💧" },
    { fill: "#6bcb77", name: "green", icon: "🍀" },
    { fill: "#ffc93d", name: "yellow", icon: "⭐" },
    { fill: "#9b5de5", name: "purple", icon: "🍇" },
    { fill: "#ff9f43", name: "orange", icon: "🍊" },
  ];
  // size, number of colors, and extra moves on top of a simple computer solution.
  const LEVELS = [
    { size: 6, colors: 4, spare: 3 },
    { size: 8, colors: 5, spare: 2 },
    { size: 10, colors: 6, spare: 1 },
  ];

  const boardEl = document.getElementById("board");
  const colorsEl = document.getElementById("colors");
  const leftEl = document.getElementById("left");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-level]");

  let level = LEVELS[0], grid = [], left = 0, over = false, cells = [], colorBtns = [];

  // Cells connected to the top-left corner through the same color.
  function region(g) {
    const n = level.size, color = g[0], seen = new Set([0]), stack = [0];
    while (stack.length) {
      const i = stack.pop(), r = Math.floor(i / n), c = i % n;
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
        const j = nr * n + nc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen.has(j) && g[j] === color) {
          seen.add(j);
          stack.push(j);
        }
      });
    }
    return seen;
  }

  function fill(g, color) {
    region(g).forEach((i) => (g[i] = color));
  }

  // Always pick the color that grows the patch most. Not perfect, but always finishes.
  function greedyMoves(start) {
    const g = start.slice();
    let moves = 0;
    while (region(g).size < g.length) {
      let bestColor = -1, bestSize = -1;
      for (let k = 0; k < level.colors; k++) {
        if (k === g[0]) continue;
        const t = g.slice();
        fill(t, k);
        const s = region(t).size;
        if (s > bestSize) { bestSize = s; bestColor = k; }
      }
      fill(g, bestColor);
      moves++;
    }
    return moves;
  }

  function newGame() {
    const n = level.size;
    grid = Array.from({ length: n * n }, () => Math.floor(Math.random() * level.colors));
    left = greedyMoves(grid) + level.spare;
    over = false;

    boardEl.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    boardEl.innerHTML = "";
    cells = grid.map((_, i) => {
      const el = document.createElement("div");
      el.addEventListener("click", () => play(grid[i]));
      boardEl.appendChild(el);
      return el;
    });

    colorsEl.innerHTML = "";
    colorBtns = COLORS.slice(0, level.colors).map((col, k) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.style.background = col.fill;
      b.innerHTML = '<span class="key">' + (k + 1) + "</span>" + col.icon;
      b.setAttribute("aria-label", t(col.name));
      b.addEventListener("click", () => play(k));
      colorsEl.appendChild(b);
      return b;
    });

    messageEl.textContent = t("Fill the whole board with one color!");
    messageEl.classList.remove("win");
    draw();
  }

  function draw() {
    const mine = region(grid);
    cells.forEach((el, i) => {
      el.style.background = COLORS[grid[i]].fill;
      el.classList.toggle("mine", mine.has(i));
    });
    colorBtns.forEach((b, k) => (b.disabled = over || k === grid[0]));
    leftEl.textContent = left;
  }

  function play(k) {
    if (over || k === grid[0]) return;
    fill(grid, k);
    left--;
    const done = region(grid).size === grid.length;
    if (done) {
      over = true;
      messageEl.textContent = t(left > 1 ? "🎉 You flooded it! {n} moves to spare! 🎉" : left === 1 ? "🎉 You flooded it! 1 move to spare! 🎉" : "🎉 You flooded it! 🎉", { n: left });
      messageEl.classList.add("win");
    } else if (left === 0) {
      over = true;
      messageEl.textContent = t("Out of moves! Press New game to try again. 💪");
    } else {
      messageEl.textContent = left <= 2 ? t("Careful, only {n} left! 😮", { n: left }) : t("Fill the whole board with one color!");
    }
    draw();
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= level.colors) play(n - 1);
  });

  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      level = LEVELS[Number(btn.dataset.level)];
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      newGame();
    });
  });
  document.getElementById("restart").addEventListener("click", newGame);

  newGame();
})();
