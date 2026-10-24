// Helpers shared by the face-to-face games (see css/duel.css).
// Player 0 sits at the top edge, player 1 at the bottom edge.
window.Duel = (function () {
  const overlay = document.getElementById("overlay");
  const halves = overlay.querySelectorAll(".half");
  const goBtn = document.getElementById("go");
  let onGo = null;

  goBtn.addEventListener("click", () => {
    overlay.hidden = true;
    if (onGo) onGo();
  });

  return {
    // Show the same screen to both players, each the right way up.
    showScreen(topText, bottomText, buttonLabel, callback) {
      halves[0].textContent = topText;
      halves[1].textContent = bottomText;
      goBtn.textContent = buttonLabel;
      onGo = callback;
      overlay.hidden = false;
    },
    // Show the end screen: the winner's half says so, the other half cheers them on.
    showWinner(winner, callback) {
      const texts = [I18n.t("😊 Good try!"), I18n.t("😊 Good try!")];
      texts[winner] = I18n.t("🏆 You win!");
      this.showScreen(texts[0], texts[1], I18n.t("🔄 Again"), callback);
    },
    stars(score, goal) {
      return "⭐".repeat(score) + "⚪".repeat(goal - score);
    },
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
  };
})();
