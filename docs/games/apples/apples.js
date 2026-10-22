// Apple Grab (a game of Nim): players take turns picking 1, 2 or 3 apples.
// Whoever takes the very last apple wins the round. First to 3 rounds wins.
(function () {
  const GOAL = 3;
  const MAX_TAKE = 3;

  const treeEl = document.getElementById("tree");
  const sides = Array.from(document.querySelectorAll(".side")).map((el, p) => {
    const side = { el, stars: el.querySelector(".stars"), who: el.querySelector(".who"), buttons: [] };
    for (let n = 1; n <= MAX_TAKE; n++) {
      const btn = document.createElement("button");
      btn.className = "take";
      btn.innerHTML = n + "<small>" + "🍎".repeat(n) + "</small>";
      btn.setAttribute("aria-label", "Take " + n);
      btn.addEventListener("click", () => take(p, n));
      el.querySelector(".takes").appendChild(btn);
      side.buttons.push(btn);
    }
    return side;
  });

  let scores, apples, left, turn, starter = 0, busy;

  function newGame() {
    scores = [0, 0];
    newRound();
  }

  function newRound() {
    left = 10 + Math.floor(Math.random() * 7); // 10 to 16 apples
    busy = false;
    treeEl.innerHTML = "";
    apples = [];
    for (let i = 0; i < left; i++) {
      const a = document.createElement("span");
      a.textContent = "🍎";
      treeEl.appendChild(a);
      apples.push(a);
    }
    turn = starter;
    render();
  }

  function render() {
    treeEl.setAttribute("aria-label", left + " apples left");
    sides.forEach((side, p) => {
      side.stars.textContent = Duel.stars(scores[p], GOAL);
      const mine = p === turn;
      side.el.classList.toggle("waiting", !mine);
      side.who.textContent = mine ? "👉 Your turn!" : "⏳";
      side.buttons.forEach((btn, i) => (btn.disabled = !mine || i + 1 > left));
    });
  }

  function take(p, n) {
    if (busy || p !== turn || n > left) return;
    for (let i = 0; i < n; i++) apples[--left].classList.add("gone");
    if (left === 0) {
      busy = true;
      scores[p]++;
      sides.forEach((side) => side.buttons.forEach((btn) => (btn.disabled = true)));
      sides[p].stars.textContent = Duel.stars(scores[p], GOAL);
      sides[p].who.textContent = "🎉 Last apple!";
      sides[1 - p].who.textContent = "";
      starter = 1 - p; // the other player starts next round
      if (scores[p] === GOAL) setTimeout(() => Duel.showWinner(p, newGame), 1200);
      else setTimeout(newRound, 1600);
      return;
    }
    turn = 1 - p;
    render();
  }

  const HELLO = "🍎 Take 1, 2 or 3. Get the last apple!";
  Duel.showScreen(HELLO, HELLO, "▶️ Play", newGame);
})();
