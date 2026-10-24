// Memory Match: flip two cards at a time and find every pair.
(function () {
  const t = I18n.t;
  const PICTURES = ["🐶", "🐱", "🦊", "🐸", "🐵", "🐼", "🦁", "🐷", "🐙", "🦄", "🐢", "🐝"];
  const COLUMNS = { 6: 4, 8: 4, 10: 5 };

  const boardEl = document.getElementById("board");
  const triesEl = document.getElementById("tries");
  const pairsEl = document.getElementById("pairs");
  const messageEl = document.getElementById("message");
  const levelBtns = document.querySelectorAll("[data-pairs]");

  let pairCount = 6, first = null, locked = false, tries = 0, found = 0;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function newGame() {
    first = null;
    locked = false;
    tries = 0;
    found = 0;
    triesEl.textContent = 0;
    pairsEl.textContent = "0 / " + pairCount;
    messageEl.textContent = t("Find two cards that match!");

    const picks = shuffle(PICTURES.slice()).slice(0, pairCount);
    const deck = shuffle(picks.concat(picks));
    boardEl.style.gridTemplateColumns = "repeat(" + COLUMNS[pairCount] + ", 1fr)";
    boardEl.innerHTML = "";
    deck.forEach((pic) => {
      const card = document.createElement("button");
      card.className = "card";
      card.textContent = pic;
      card.dataset.pic = pic;
      card.setAttribute("aria-label", t("Hidden card"));
      card.addEventListener("click", () => flip(card));
      boardEl.appendChild(card);
    });
  }

  function flip(card) {
    if (locked || card === first || card.classList.contains("done")) return;
    card.classList.add("up");
    card.setAttribute("aria-label", card.dataset.pic);

    if (!first) {
      first = card;
      return;
    }

    tries++;
    triesEl.textContent = tries;
    const second = card;

    if (first.dataset.pic === second.dataset.pic) {
      first.classList.add("done");
      second.classList.add("done");
      first = null;
      found++;
      pairsEl.textContent = found + " / " + pairCount;
      if (found === pairCount) {
        messageEl.textContent = t("🎉 You found them all in {n} tries! 🎉", { n: tries });
      } else {
        messageEl.textContent = I18n.list(["Yay! 🌟", "A match! 🎈", "Well done! 👏"])[found % 3];
      }
    } else {
      locked = true;
      messageEl.textContent = t("Oops, not a pair. Try again!");
      setTimeout(() => {
        [first, second].forEach((c) => {
          c.classList.remove("up");
          c.setAttribute("aria-label", t("Hidden card"));
        });
        first = null;
        locked = false;
      }, 900);
    }
  }

  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      pairCount = Number(btn.dataset.pairs);
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      newGame();
    });
  });
  document.getElementById("restart").addEventListener("click", newGame);

  newGame();
})();
