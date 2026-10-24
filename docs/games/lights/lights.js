// Lights Out: every tap flips a light and its four neighbours. Turn them all off.
(function () {
  const t = I18n.t;
  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const leftEl = document.getElementById("left");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-size]");

  let size = 3, lights = [], cells = [], moves = 0, won = false;

  function toggle(r, c) {
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) lights[nr][nc] = !lights[nr][nc];
    });
  }

  function countOn() {
    return lights.flat().filter(Boolean).length;
  }

  function draw() {
    cells.forEach((cell) => {
      const on = lights[cell.r][cell.c];
      cell.el.classList.toggle("on", on);
      cell.el.setAttribute("aria-label", t("Row {r} column {c}", { r: cell.r + 1, c: cell.c + 1 }) + t(on ? ", on" : ", off"));
    });
    movesEl.textContent = moves;
    leftEl.textContent = countOn();
  }

  function newGame() {
    moves = 0;
    won = false;
    lights = Array.from({ length: size }, () => Array(size).fill(false));
    // Start from all-off and tap random cells, so every puzzle can be solved.
    const taps = size + 1 + Math.floor(Math.random() * size);
    while (countOn() === 0) {
      for (let i = 0; i < taps; i++) toggle(Math.floor(Math.random() * size), Math.floor(Math.random() * size));
    }

    boardEl.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const el = document.createElement("button");
        el.className = "light";
        el.addEventListener("click", () => tap(r, c));
        boardEl.appendChild(el);
        cells.push({ r, c, el });
      }
    }
    messageEl.textContent = t("Turn off all the lights!");
    messageEl.classList.remove("win");
    draw();
  }

  function tap(r, c) {
    if (won) return;
    toggle(r, c);
    moves++;
    draw();
    if (countOn() === 0) {
      won = true;
      messageEl.textContent = t("🎉 All dark in {n} taps! 🎉", { n: moves });
      messageEl.classList.add("win");
    }
  }

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
