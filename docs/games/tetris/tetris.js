// Blocks: a gentle, kid-paced falling-blocks game.
(function () {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
  };
  const COLORS = {
    I: "#4dd0e1", O: "#ffd93d", T: "#9b5de5", S: "#6bcb77",
    Z: "#ff6b6b", J: "#4d96ff", L: "#ff9f43",
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const messageEl = document.getElementById("message");
  const startBtn = document.getElementById("start");

  let grid, piece, score, lines, dropInterval, dropTimer, lastTime, running, rafId;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomPiece() {
    const keys = Object.keys(SHAPES);
    const type = keys[Math.floor(Math.random() * keys.length)];
    const shape = SHAPES[type].map((row) => row.slice());
    return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
  }

  function rotate(shape) {
    // Clockwise: new row r = old column r read bottom-to-top.
    return shape[0].map((_, c) => shape.map((row) => row[c]).reverse());
  }

  function collides(shape, x, y) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = x + c;
        const ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = piece.type;
      })
    );
    clearLines();
    piece = randomPiece();
    if (collides(piece.shape, piece.x, piece.y)) gameOver();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(Boolean)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // re-check the same row index after shifting
      }
    }
    if (cleared) {
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared];
      // Speed up slowly so it stays fun for young players.
      dropInterval = Math.max(250, 900 - lines * 25);
      messageEl.textContent = cleared > 1 ? "WOW! " + cleared + " lines! 🎉" : "Great job! 🌟";
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
  }

  function move(dx) {
    if (!running) return;
    if (!collides(piece.shape, piece.x + dx, piece.y)) piece.x += dx;
    draw();
  }

  function turn() {
    if (!running) return;
    const rotated = rotate(piece.shape);
    // Try a small sideways nudge so turning near walls still works.
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(rotated, piece.x + kick, piece.y)) {
        piece.shape = rotated;
        piece.x += kick;
        break;
      }
    }
    draw();
  }

  function softDrop() {
    if (!running) return;
    if (!collides(piece.shape, piece.x, piece.y + 1)) {
      piece.y++;
    } else {
      lockPiece();
    }
    dropTimer = 0;
    draw();
  }

  function hardDrop() {
    if (!running) return;
    while (!collides(piece.shape, piece.x, piece.y + 1)) piece.y++;
    lockPiece();
    dropTimer = 0;
    draw();
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, 6);
  }

  function draw() {
    ctx.fillStyle = "#fdfdfd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#eee";
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }
    grid.forEach((row, y) => row.forEach((t, x) => { if (t) drawCell(x, y, COLORS[t]); }));
    if (piece) {
      // Ghost shows where the piece will land.
      let gy = piece.y;
      while (!collides(piece.shape, piece.x, gy + 1)) gy++;
      piece.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect((piece.x + c) * CELL + 1, (gy + r) * CELL + 1, CELL - 2, CELL - 2);
        }
      }));
      piece.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) drawCell(piece.x + c, piece.y + r, COLORS[piece.type]);
      }));
    }
  }

  function loop(time) {
    if (!running) return;
    const delta = time - (lastTime || time);
    lastTime = time;
    dropTimer += delta;
    if (dropTimer > dropInterval) softDrop();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    cancelAnimationFrame(rafId);
    grid = emptyGrid();
    piece = randomPiece();
    score = 0;
    lines = 0;
    dropInterval = 900;
    dropTimer = 0;
    lastTime = 0;
    running = true;
    messageEl.textContent = "Fill a whole line to clear it!";
    startBtn.textContent = "Restart";
    updateStats();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    piece = null;
    messageEl.textContent = "Game over! You cleared " + lines + " lines. 👏";
    startBtn.textContent = "Play again";
  }

  startBtn.addEventListener("click", start);

  const actions = { left: () => move(-1), right: () => move(1), rotate: turn, drop: hardDrop };
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => actions[btn.dataset.action]());
  });

  document.addEventListener("keydown", (e) => {
    const keys = {
      ArrowLeft: () => move(-1),
      ArrowRight: () => move(1),
      ArrowUp: turn,
      ArrowDown: softDrop,
      " ": hardDrop,
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  });

  grid = emptyGrid();
  draw();
})();
