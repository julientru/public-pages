// Four in a Row: two players take turns on the same screen, dropping discs
// into columns. Four of your colour in a line (any direction) wins.
(function () {
  const t = I18n.t;
  const COLS = 7, ROWS = 6;
  const DISCS = ["🔴", "🟡"];

  const boardEl = document.getElementById("board");
  const turnEl = document.getElementById("turn");
  const scoreEls = [document.getElementById("score0"), document.getElementById("score1")];

  let grid, cells, turn, starter = 0, over, nextTimer;
  const scores = [0, 0];

  function newGame() {
    clearTimeout(nextTimer);
    turnEl.style.background = "";
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
    turn = starter;
    over = false;
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < ROWS; r++) {
      cells.push([]);
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.setAttribute("aria-label", t("Column {n}", { n: c + 1 }));
        cell.addEventListener("click", () => drop(c));
        boardEl.appendChild(cell);
        cells[r].push(cell);
      }
    }
    showTurn();
  }

  function showTurn() {
    turnEl.className = "turn p" + turn;
    turnEl.textContent = DISCS[turn] + " " + t("Your turn!");
  }

  function drop(c) {
    if (over) return;
    let r = ROWS - 1;
    while (r >= 0 && grid[r][c] !== -1) r--;
    if (r < 0) return; // column is full
    grid[r][c] = turn;
    const disc = document.createElement("span");
    disc.className = "disc p" + turn;
    disc.style.setProperty("--from", "calc(" + -(r + 1) + " * (100% + 4px))");
    cells[r][c].appendChild(disc);
    cells[r][c].setAttribute("aria-label", DISCS[turn]);

    const line = findLine(r, c);
    if (line) {
      over = true;
      line.forEach(([lr, lc]) => cells[lr][lc].classList.add("win"));
      scores[turn]++;
      scoreEls[turn].textContent = scores[turn];
      turnEl.textContent = t("{disc} wins! 🎉", { disc: DISCS[turn] });
      starter = 1 - turn; // the other player starts next game
      nextTimer = setTimeout(newGame, 2500);
    } else if (grid[0].every((v) => v !== -1)) {
      over = true;
      turnEl.className = "turn";
      turnEl.style.background = "var(--purple)";
      turnEl.textContent = t("🤝 Board full: a tie!");
      starter = 1 - starter;
      nextTimer = setTimeout(newGame, 2500);
    } else {
      turn = 1 - turn;
      showTurn();
    }
  }

  // Returns the winning cells through (r, c), or null.
  function findLine(r, c) {
    const who = grid[r][c];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [[r, c]];
      for (const sign of [1, -1]) {
        let rr = r + dr * sign, cc = c + dc * sign;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === who) {
          line.push([rr, cc]);
          rr += dr * sign;
          cc += dc * sign;
        }
      }
      if (line.length >= 4) return line;
    }
    return null;
  }

  document.getElementById("restart").addEventListener("click", newGame);
  newGame();
})();
