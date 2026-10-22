// Snap Match: both players see the same yellow picture. First to tap it in
// their own grid gets a star. A wrong tap freezes your side for a moment.
(function () {
  const PICTURES = ["🐶", "🐱", "🦊", "🐸", "🐵", "🐼", "🦁", "🐷", "🐙", "🦄", "🐢", "🐝",
    "🍎", "🍌", "🍓", "🚗", "🚀", "⚽", "🌈", "⭐", "🌻", "🍦", "🎈", "🐳"];
  const GOAL = 5;
  const CHOICES = 6;

  const sides = Array.from(document.querySelectorAll(".side")).map((el) => ({
    el,
    stars: el.querySelector(".stars"),
    target: el.querySelector(".target"),
    choices: el.querySelector(".choices"),
  }));

  let scores, frozen, roundOver, target;

  function newGame() {
    scores = [0, 0];
    newRound();
  }

  function newRound() {
    roundOver = false;
    frozen = [false, false];
    const picks = Duel.shuffle(PICTURES.slice());
    target = picks[0];
    const others = picks.slice(1);
    sides.forEach((side, p) => {
      side.el.classList.remove("frozen");
      side.stars.textContent = Duel.stars(scores[p], GOAL);
      side.target.textContent = target;
      // Each player gets their own mix, so nobody can copy the other side.
      const mine = Duel.shuffle([target].concat(Duel.shuffle(others.slice()).slice(0, CHOICES - 1)));
      side.choices.innerHTML = "";
      mine.forEach((pic) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.textContent = pic;
        btn.setAttribute("aria-label", pic);
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(p, btn); });
        side.choices.appendChild(btn);
      });
    });
  }

  function tap(p, btn) {
    if (roundOver || frozen[p]) return;
    if (btn.textContent === target) {
      roundOver = true;
      btn.classList.add("right");
      scores[p]++;
      sides[p].stars.textContent = Duel.stars(scores[p], GOAL);
      if (scores[p] === GOAL) setTimeout(() => Duel.showWinner(p, newGame), 700);
      else setTimeout(newRound, 900);
    } else {
      frozen[p] = true;
      btn.classList.add("wrong", "shake");
      sides[p].el.classList.add("frozen");
      setTimeout(() => {
        frozen[p] = false;
        btn.classList.remove("wrong", "shake");
        sides[p].el.classList.remove("frozen");
      }, 1000);
    }
  }

  const HELLO = "⚡ Find the yellow picture first!";
  Duel.showScreen(HELLO, HELLO, "▶️ Play", newGame);
})();
