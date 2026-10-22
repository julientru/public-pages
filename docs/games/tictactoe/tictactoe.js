// Tic-Tac-Toe: you (❌) against a robot (⭕). The easy robot makes mistakes, the clever one never loses.
(function () {
  const ME = "❌", BOT = "⭕";
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  const boardEl = document.getElementById("board");
  const messageEl = document.getElementById("message");
  const scoreEls = { you: document.getElementById("you"), robot: document.getElementById("robot"), draws: document.getElementById("draws") };
  const levelBtns = document.querySelectorAll("[data-level]");

  let level = "easy", board = [], over = false, botTurn = false, robotStarts = false, timer = 0;
  const score = { you: 0, robot: 0, draws: 0 };

  const spots = Array.from({ length: 9 }, (_, i) => {
    const b = document.createElement("button");
    b.className = "spot";
    b.addEventListener("click", () => play(i));
    boardEl.appendChild(b);
    return b;
  });

  function winner(b) {
    for (const line of LINES) {
      const [x, y, z] = line;
      if (b[x] && b[x] === b[y] && b[x] === b[z]) return { who: b[x], line };
    }
    return b.every(Boolean) ? { who: "draw", line: [] } : null;
  }

  function free(b) {
    return b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  }

  // Score a position for the robot: +1 robot wins, -1 you win, 0 draw.
  function minimax(b, turn) {
    const w = winner(b);
    if (w) return w.who === BOT ? 1 : w.who === ME ? -1 : 0;
    const results = free(b).map((i) => {
      b[i] = turn;
      const v = minimax(b, turn === BOT ? ME : BOT);
      b[i] = null;
      return v;
    });
    return turn === BOT ? Math.max(...results) : Math.min(...results);
  }

  function bestMove() {
    const options = free(board);
    let best = -2, picks = [];
    options.forEach((i) => {
      board[i] = BOT;
      const v = minimax(board, ME);
      board[i] = null;
      if (v > best) { best = v; picks = [i]; }
      else if (v === best) picks.push(i);
    });
    return picks[Math.floor(Math.random() * picks.length)];
  }

  function finishingMove(who) {
    return free(board).find((i) => {
      board[i] = who;
      const w = winner(board);
      board[i] = null;
      return w && w.who === who;
    });
  }

  function robotMove() {
    if (level === "hard") return bestMove();
    // Easy robot: wins if it can, sometimes blocks, otherwise picks any square.
    const win = finishingMove(BOT);
    if (win !== undefined) return win;
    const block = finishingMove(ME);
    if (block !== undefined && Math.random() < 0.5) return block;
    const options = free(board);
    return options[Math.floor(Math.random() * options.length)];
  }

  function newGame() {
    clearTimeout(timer);
    board = Array(9).fill(null);
    over = false;
    messageEl.classList.remove("win");
    draw();
    if (robotStarts) {
      messageEl.textContent = "🤖 Robot goes first this time...";
      robotTurn();
    } else {
      botTurn = false;
      messageEl.textContent = "You are ❌. Get three in a row!";
    }
    robotStarts = !robotStarts;
  }

  function draw(line) {
    spots.forEach((b, i) => {
      b.innerHTML = '<span class="key">' + (i + 1) + "</span>" + (board[i] || "");
      b.disabled = over || !!board[i];
      b.classList.toggle("line", !!line && line.includes(i));
      b.setAttribute("aria-label", "Square " + (i + 1) + ": " + (board[i] === ME ? "yours" : board[i] === BOT ? "robot" : "empty"));
    });
  }

  function check() {
    const w = winner(board);
    if (!w) return false;
    over = true;
    if (w.who === ME) {
      score.you++;
      messageEl.textContent = "🎉 You win! 🎉";
      messageEl.classList.add("win");
    } else if (w.who === BOT) {
      score.robot++;
      messageEl.textContent = "🤖 Robot wins! Try again?";
    } else {
      score.draws++;
      messageEl.textContent = "🤝 A draw! Nobody wins.";
    }
    Object.keys(score).forEach((k) => (scoreEls[k].textContent = score[k]));
    draw(w.line);
    return true;
  }

  function robotTurn() {
    botTurn = true;
    timer = setTimeout(() => {
      board[robotMove()] = BOT;
      botTurn = false;
      draw();
      if (!check()) messageEl.textContent = "Your turn ❌";
    }, 600);
  }

  function play(i) {
    if (over || botTurn || board[i]) return;
    board[i] = ME;
    draw();
    if (check()) return;
    messageEl.textContent = "🤖 Thinking...";
    robotTurn();
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 9) play(n - 1);
  });

  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      level = btn.dataset.level;
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      robotStarts = false;
      newGame();
    });
  });
  document.getElementById("restart").addEventListener("click", newGame);

  newGame();
})();
