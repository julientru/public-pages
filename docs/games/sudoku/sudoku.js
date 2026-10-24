// Picture Sudoku: a 4x4 or 6x6 sudoku with fruit pictures instead of numbers.
(function () {
  const t = I18n.t;
  const FRUITS = ["🍎", "🍌", "🍇", "🍊", "🍓", "🥝"];
  // Box shape (rows x columns) for each size.
  const BOX = { 4: [2, 2], 6: [2, 3] };
  const BLANKS = { 4: 8, 6: 18 };

  const boardEl = document.getElementById("board");
  const paletteEl = document.getElementById("palette");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-size]");

  let size = 4, grid = [], given = [], cells = [], selected = -1, won = false;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function range(n) {
    return Array.from({ length: n }, (_, i) => i);
  }

  function makeSolution() {
    const [br, bc] = BOX[size];
    // Shuffle rows inside each band and the bands themselves, same for columns, then the symbols.
    const rows = shuffle(range(size / br)).flatMap((b) => shuffle(range(br)).map((r) => b * br + r));
    const cols = shuffle(range(size / bc)).flatMap((s) => shuffle(range(bc)).map((c) => s * bc + c));
    const symbols = shuffle(range(size));
    return rows.map((r) => cols.map((c) => symbols[(bc * (r % br) + Math.floor(r / br) + c) % size]));
  }

  function fits(g, r, c, v) {
    const [br, bc] = BOX[size];
    for (let i = 0; i < size; i++) {
      if (i !== c && g[r][i] === v) return false;
      if (i !== r && g[i][c] === v) return false;
    }
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let i = r0; i < r0 + br; i++) {
      for (let j = c0; j < c0 + bc; j++) {
        if ((i !== r || j !== c) && g[i][j] === v) return false;
      }
    }
    return true;
  }

  // Counts solutions, stopping at 2: we only need to know if there is exactly one.
  function countSolutions(g) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r][c] !== null) continue;
        let total = 0;
        for (let v = 0; v < size && total < 2; v++) {
          if (fits(g, r, c, v)) {
            g[r][c] = v;
            total += countSolutions(g);
            g[r][c] = null;
          }
        }
        return total;
      }
    }
    return 1;
  }

  function newGame() {
    const solution = makeSolution();
    grid = solution.map((row) => row.slice());
    let removed = 0;
    for (const i of shuffle(range(size * size))) {
      if (removed === BLANKS[size]) break;
      const r = Math.floor(i / size), c = i % size, keep = grid[r][c];
      grid[r][c] = null;
      if (countSolutions(grid.map((row) => row.slice())) === 1) removed++;
      else grid[r][c] = keep;
    }
    given = grid.map((row) => row.map((v) => v !== null));
    selected = -1;
    won = false;
    build();
    messageEl.textContent = t("Each row, column and box gets every fruit once!");
    messageEl.classList.remove("win");
  }

  function build() {
    const [br, bc] = BOX[size];
    boardEl.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const el = document.createElement("button");
        el.className = "cell";
        if ((c + 1) % bc === 0 && c < size - 1) el.classList.add("box-right");
        if ((r + 1) % br === 0 && r < size - 1) el.classList.add("box-bottom");
        if (given[r][c]) {
          el.classList.add("given");
          el.tabIndex = -1;
        }
        const i = r * size + c;
        el.addEventListener("click", () => select(i));
        el.addEventListener("focus", () => { if (!given[r][c]) select(i); });
        boardEl.appendChild(el);
        cells.push(el);
      }
    }
    paletteEl.innerHTML = "";
    FRUITS.slice(0, size).forEach((fruit, v) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = fruit;
      b.setAttribute("aria-label", t("Put {fruit}", { fruit }));
      b.addEventListener("click", () => place(v));
      paletteEl.appendChild(b);
    });
    const erase = document.createElement("button");
    erase.className = "btn erase";
    erase.textContent = "🧽";
    erase.setAttribute("aria-label", t("Clear square"));
    erase.addEventListener("click", () => place(null));
    paletteEl.appendChild(erase);
    draw();
  }

  function draw() {
    cells.forEach((el, i) => {
      const r = Math.floor(i / size), c = i % size, v = grid[r][c];
      el.textContent = v === null ? "" : FRUITS[v];
      el.classList.toggle("selected", i === selected);
      el.classList.toggle("bad", v !== null && !given[r][c] && !fits(grid, r, c, v));
      el.setAttribute("aria-label", t("Row {r} column {c}", { r: r + 1, c: c + 1 }) + ": " + (v === null ? t("empty") : FRUITS[v]));
    });
  }

  function select(i) {
    if (won) return;
    const r = Math.floor(i / size), c = i % size;
    if (given[r][c]) return;
    selected = i;
    draw();
  }

  function place(v) {
    if (won) return;
    if (selected < 0) {
      messageEl.textContent = t("First tap an empty square 👆");
      return;
    }
    const r = Math.floor(selected / size), c = selected % size;
    grid[r][c] = v;
    draw();
    const full = grid.every((row) => row.every((x) => x !== null));
    const ok = grid.every((row, rr) => row.every((x, cc) => x !== null && fits(grid, rr, cc, x)));
    if (full && ok) {
      won = true;
      selected = -1;
      draw();
      messageEl.textContent = t("🎉 You solved it! 🎉");
      messageEl.classList.add("win");
    } else if (v !== null && !fits(grid, r, c, v)) {
      messageEl.textContent = t("Hmm, that fruit is already in this row, column or box.");
    } else {
      messageEl.textContent = t("Each row, column and box gets every fruit once!");
    }
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= size) place(n - 1);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") place(null);
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
