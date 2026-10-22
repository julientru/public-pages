// Tower Move (Tower of Hanoi): move every ring to the star pole, never putting a big ring on a small one.
(function () {
  const COLORS = ["#ff6b6b", "#ff9f43", "#ffc93d", "#6bcb77", "#4d96ff"];

  const pegsEl = document.getElementById("pegs");
  const movesEl = document.getElementById("moves");
  const targetEl = document.getElementById("target");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-disks]");

  let disks = 3, pegs = [], picked = -1, moves = 0, won = false;
  const pegEls = [0, 1, 2].map((i) => {
    const el = document.createElement("button");
    el.className = "peg" + (i === 2 ? " goal" : "");
    el.addEventListener("click", () => choose(i));
    pegsEl.appendChild(el);
    return el;
  });

  function newGame() {
    // Each pole is a list of ring sizes, bottom first. Bigger number = bigger ring.
    pegs = [Array.from({ length: disks }, (_, i) => disks - i), [], []];
    picked = -1;
    moves = 0;
    won = false;
    targetEl.textContent = Math.pow(2, disks) - 1;
    messageEl.textContent = "Move the whole tower to the ⭐ pole!";
    messageEl.classList.remove("win");
    draw();
  }

  function draw() {
    pegEls.forEach((el, i) => {
      el.innerHTML = '<span class="label">' + (i + 1) + (i === 2 ? " ⭐" : "") + "</span>";
      pegs[i].forEach((size, k) => {
        const d = document.createElement("div");
        d.className = "disk" + (i === picked && k === pegs[i].length - 1 ? " up" : "");
        d.style.width = 30 + (size / 5) * 65 + "%";
        d.style.background = COLORS[(size - 1) % COLORS.length];
        el.appendChild(d);
      });
      el.classList.toggle("picked", i === picked);
      el.setAttribute("aria-label", "Pole " + (i + 1) + (i === 2 ? " (goal)" : "") + ", " + pegs[i].length + " rings");
    });
    movesEl.textContent = moves;
  }

  function choose(i) {
    if (won) return;
    if (picked < 0) {
      if (pegs[i].length === 0) {
        messageEl.textContent = "That pole is empty. Pick one with rings!";
        return;
      }
      picked = i;
      messageEl.textContent = "Now tap where it should go.";
    } else if (picked === i) {
      picked = -1;
      messageEl.textContent = "Put it back. Pick a ring!";
    } else {
      const ring = pegs[picked][pegs[picked].length - 1];
      const top = pegs[i][pegs[i].length - 1];
      if (top !== undefined && top < ring) {
        messageEl.textContent = "Too big! A big ring can't sit on a small one.";
        return;
      }
      pegs[i].push(pegs[picked].pop());
      picked = -1;
      moves++;
      messageEl.textContent = "Move the whole tower to the ⭐ pole!";
    }
    draw();
    if (pegs[2].length === disks) {
      won = true;
      const best = Math.pow(2, disks) - 1;
      messageEl.textContent = moves === best
        ? "🏆 Perfect! Done in " + moves + " moves! 🏆"
        : "🎉 You did it in " + moves + " moves! 🎉";
      messageEl.classList.add("win");
    }
  }

  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 3) choose(n - 1);
  });

  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      disks = Number(btn.dataset.disks);
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      newGame();
    });
  });
  document.getElementById("restart").addEventListener("click", newGame);

  newGame();
})();
