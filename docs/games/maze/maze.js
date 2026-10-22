// Mouse Maze: a new random maze every time. Walk the mouse to the cheese.
(function () {
  const PX = 520;
  const DIRS = {
    up: { dr: -1, dc: 0, bit: 1, back: 4 },
    right: { dr: 0, dc: 1, bit: 2, back: 8 },
    down: { dr: 1, dc: 0, bit: 4, back: 1 },
    left: { dr: 0, dc: -1, bit: 8, back: 2 },
  };

  const canvas = document.getElementById("maze");
  const ctx = canvas.getContext("2d");
  const stepsEl = document.getElementById("steps");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-size]");

  let size = 6, open = [], player, trail, steps = 0, won = false;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // open[r][c] holds a bit for each side with no wall (1 up, 2 right, 4 down, 8 left).
  function generate() {
    open = Array.from({ length: size }, () => Array(size).fill(0));
    const seen = Array.from({ length: size }, () => Array(size).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const next = shuffle(Object.values(DIRS)).find((d) => {
        const nr = r + d.dr, nc = c + d.dc;
        return nr >= 0 && nr < size && nc >= 0 && nc < size && !seen[nr][nc];
      });
      if (!next) {
        stack.pop();
        continue;
      }
      const nr = r + next.dr, nc = c + next.dc;
      open[r][c] |= next.bit;
      open[nr][nc] |= next.back;
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }

  function newGame() {
    generate();
    player = { r: 0, c: 0 };
    trail = new Set(["0,0"]);
    steps = 0;
    won = false;
    stepsEl.textContent = 0;
    messageEl.textContent = "Help the mouse find the cheese!";
    messageEl.classList.remove("win");
    draw();
  }

  function draw() {
    const cell = PX / size;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PX, PX);

    ctx.fillStyle = "#fff3b0";
    trail.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      ctx.fillRect(c * cell, r * cell, cell, cell);
    });

    ctx.strokeStyle = "#3d405b";
    ctx.lineWidth = Math.max(3, cell / 9);
    ctx.lineCap = "round";
    ctx.beginPath();
    const pad = ctx.lineWidth / 2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = c * cell, y = r * cell, o = open[r][c];
        if (!(o & 1)) { ctx.moveTo(x, y + (r ? 0 : pad)); ctx.lineTo(x + cell, y + (r ? 0 : pad)); }
        if (!(o & 8)) { ctx.moveTo(x + (c ? 0 : pad), y); ctx.lineTo(x + (c ? 0 : pad), y + cell); }
        if (r === size - 1) { ctx.moveTo(x, PX - pad); ctx.lineTo(x + cell, PX - pad); }
        if (c === size - 1) { ctx.moveTo(PX - pad, y); ctx.lineTo(PX - pad, y + cell); }
      }
    }
    ctx.stroke();

    ctx.font = Math.floor(cell * 0.7) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧀", (size - 0.5) * cell, (size - 0.5) * cell + cell * 0.05);
    ctx.fillText("🐭", (player.c + 0.5) * cell, (player.r + 0.5) * cell + cell * 0.05);
  }

  function move(name) {
    if (won) return;
    const d = DIRS[name];
    if (!(open[player.r][player.c] & d.bit)) {
      messageEl.textContent = "Bump! That's a wall. 🧱";
      return;
    }
    player = { r: player.r + d.dr, c: player.c + d.dc };
    trail.add(player.r + "," + player.c);
    steps++;
    stepsEl.textContent = steps;
    messageEl.textContent = "Help the mouse find the cheese!";
    draw();
    if (player.r === size - 1 && player.c === size - 1) {
      won = true;
      messageEl.textContent = "🎉 Yum! The mouse found the cheese! 🎉";
      messageEl.classList.add("win");
    }
  }

  document.addEventListener("keydown", (e) => {
    const name = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right",
    }[e.key];
    if (!name) return;
    e.preventDefault();
    move(name);
  });

  document.querySelectorAll("[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => move(btn.dataset.dir));
  });

  // Swipe on the maze: a long swipe keeps walking until the path turns or splits.
  let start = null;
  canvas.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    const name = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    move(name);
    // Keep going down a straight corridor so little fingers don't need many swipes.
    while (!won && open[player.r][player.c] & DIRS[name].bit && corridor(name)) move(name);
  });

  function corridor(name) {
    const o = open[player.r][player.c];
    const exits = [1, 2, 4, 8].filter((b) => o & b).length;
    return exits === 2 && (o & DIRS[name].back);
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
