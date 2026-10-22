// Hub: filter the game cards by how many players are picked.
// Cards without data-players are 1-player games. The choice lives in the URL hash
// (#players=2) so the 🏠 button of a 2-player game brings you back to the same list.
(function () {
  const pickBtns = document.querySelectorAll("[data-pick]");
  const cards = document.querySelectorAll(".game-card");
  const soonEl = document.getElementById("soon");

  function show(count) {
    let shown = 0;
    cards.forEach((card) => {
      const match = (card.dataset.players || "1") === count;
      card.hidden = !match;
      if (match) shown++;
    });
    pickBtns.forEach((btn) => btn.setAttribute("aria-pressed", btn.dataset.pick === count));
    soonEl.hidden = shown > 0;
  }

  function fromHash() {
    const m = location.hash.match(/players=([1-4])/);
    show(m ? m[1] : "1");
  }

  pickBtns.forEach((btn) => btn.addEventListener("click", () => {
    history.replaceState(null, "", "#players=" + btn.dataset.pick);
    show(btn.dataset.pick);
  }));
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
