// Hub: filter the game cards by how many players are picked.
// Cards without data-players are 1-player games. The choice lives in the URL hash
// (#players=2) so the 🏠 button of a 2-player game brings you back to the same list.
// The hub's texts in French and Cantonese are below; the language buttons come from js/i18n.js.
(function () {
  I18n.add({
    fr: {
      "Kids Games": "Jeux pour enfants",
      "🎈 Kids Games 🎈": "🎈 Jeux pour enfants 🎈",
      "Pick a game and have fun!": "Choisis un jeu et amuse-toi !",
      "Language": "Langue",
      "Player": "Joueur",
      "How many players?": "Combien de joueurs ?",
      "🚧 Games for this many players are coming soon!": "🚧 Des jeux pour autant de joueurs arrivent bientôt !",
      "Blocks": "Blocs",
      "Turn and drop the falling blocks to fill whole lines.": "Tourne et lâche les blocs pour remplir des lignes entières.",
      "Jumpy Frog": "Grenouille sauteuse",
      "Jump over the rocks. How far can you go?": "Saute par-dessus les cailloux. Jusqu'où iras-tu ?",
      "Memory Match": "Memory",
      "Flip the cards and find all the pairs.": "Retourne les cartes et trouve toutes les paires.",
      "Lights Out": "Éteins tout",
      "Tap to flip the lights. Can you turn them all off?": "Touche les lampes pour les changer. Arriveras-tu à toutes les éteindre ?",
      "Slide Puzzle": "Taquin",
      "Slide the numbers until they are in order.": "Fais glisser les nombres pour les remettre dans l'ordre.",
      "Picture Sudoku": "Sudoku des fruits",
      "Every fruit once in each row, column and box.": "Chaque fruit une fois par ligne, par colonne et par carré.",
      "Copy Me": "Imite-moi",
      "Watch the animals light up, then copy them.": "Regarde les animaux s'allumer, puis refais pareil.",
      "Tower Move": "La tour",
      "Move the tower, one ring at a time.": "Déplace la tour, un anneau à la fois.",
      "What's Next?": "Et après ?",
      "Find the pattern and pick what comes next.": "Trouve la suite et choisis ce qui vient après.",
      "Mouse Maze": "Labyrinthe",
      "Help the mouse find the cheese.": "Aide la souris à trouver le fromage.",
      "Odd One Out": "L'intrus",
      "Which picture does not belong?": "Quelle image n'est pas comme les autres ?",
      "Color Flood": "Marée de couleurs",
      "Fill the board with one color before you run out of moves.": "Remplis le plateau d'une seule couleur avant la fin des coups.",
      "Tic-Tac-Toe": "Morpion",
      "Three in a row against the robot.": "Trois à la suite contre le robot.",
      "Army Rush": "Armée en folie",
      "Stop the silly army! Shoot doors for better weapons and more soldiers.": "Arrête l'armée rigolote ! Tire sur les boîtes pour avoir de meilleures armes et plus de soldats.",
      "Army Rush 3D": "Armée en folie 3D",
      "The same silly battle in 3D, seen from right behind your army!": "La même bataille rigolote en 3D, vue juste derrière ton armée !",
      "Army Rush FPS": "Armée en folie FPS",
      "Stand behind your wall and aim with your finger. Fast and furious!": "Tiens-toi derrière ton mur et vise avec ton doigt. À toute vitesse !",
      "Snap Match": "Vite, la paire !",
      "Face to face: who finds the same picture first?": "Face à face : qui trouve la même image en premier ?",
      "Apple Grab": "Attrape-pommes",
      "Face to face: take 1, 2 or 3 apples. Grab the last one to win!": "Face à face : prends 1, 2 ou 3 pommes. Celui qui prend la dernière gagne !",
      "Four in a Row": "Puissance 4",
      "Take turns dropping discs. Line up four!": "Chacun son tour, lâche un jeton. Aligne-en quatre !",
    },
    "zh-HK": {
      "Kids Games": "小朋友遊戲",
      "🎈 Kids Games 🎈": "🎈 小朋友遊戲 🎈",
      "Pick a game and have fun!": "揀個遊戲，玩得開心啲！",
      "Language": "語言",
      "Player": "玩家",
      "How many players?": "幾多個人玩？",
      "🚧 Games for this many players are coming soon!": "🚧 呢個人數嘅遊戲就快有啦！",
      "Blocks": "砌方塊",
      "Turn and drop the falling blocks to fill whole lines.": "轉吓啲方塊再放落去，砌滿成行就消失。",
      "Jumpy Frog": "跳跳青蛙",
      "Jump over the rocks. How far can you go?": "跳過啲石頭，睇吓你可以去到幾遠？",
      "Memory Match": "記憶配對",
      "Flip the cards and find all the pairs.": "反啲咭，搵晒所有一對對。",
      "Lights Out": "熄燈",
      "Tap to flip the lights. Can you turn them all off?": "撳一下就會轉燈，你可唔可以熄晒佢哋？",
      "Slide Puzzle": "推推數字",
      "Slide the numbers until they are in order.": "推啲數字，排返好佢哋。",
      "Picture Sudoku": "生果數獨",
      "Every fruit once in each row, column and box.": "每橫排、每直行、每個大格都要有齊每種生果一次。",
      "Copy Me": "跟住我",
      "Watch the animals light up, then copy them.": "睇住啲動物着燈，然後跟住撳。",
      "Tower Move": "搬塔",
      "Move the tower, one ring at a time.": "一次搬一個圈，將成座塔搬走。",
      "What's Next?": "下一個係乜？",
      "Find the pattern and pick what comes next.": "睇吓有乜規律，揀下一個。",
      "Mouse Maze": "老鼠迷宮",
      "Help the mouse find the cheese.": "幫老鼠搵到芝士。",
      "Odd One Out": "邊個唔同？",
      "Which picture does not belong?": "邊幅圖同其他唔一樣？",
      "Color Flood": "顏色大淹水",
      "Fill the board with one color before you run out of moves.": "喺步數用完之前，將成塊板變晒同一隻顏色。",
      "Tic-Tac-Toe": "井字過三關",
      "Three in a row against the robot.": "同機械人鬥，三個連成一線就贏。",
      "Army Rush": "軍隊大衝鋒",
      "Stop the silly army! Shoot doors for better weapons and more soldiers.": "擋住傻傻地嘅軍隊！射爆盒仔攞更勁嘅武器同更多士兵。",
      "Army Rush 3D": "軍隊大衝鋒 3D",
      "The same silly battle in 3D, seen from right behind your army!": "同一場搞笑大戰，變成 3D，喺你軍隊後面睇！",
      "Army Rush FPS": "軍隊大衝鋒 FPS",
      "Stand behind your wall and aim with your finger. Fast and furious!": "企喺你道牆後面，用手指瞄準。又快又勁！",
      "Snap Match": "快手配對",
      "Face to face: who finds the same picture first?": "面對面：邊個最快搵到同一幅圖？",
      "Apple Grab": "搶蘋果",
      "Face to face: take 1, 2 or 3 apples. Grab the last one to win!": "面對面：每次攞 1、2 或者 3 個蘋果，攞到最後一個就贏！",
      "Four in a Row": "四子棋",
      "Take turns dropping discs. Line up four!": "輪流放棋子，四粒連成一線就贏！",
    },
  });
  I18n.makeSwitch(document.getElementById("langs"));
  Accounts.makeBar(document.getElementById("account"), { scoresHref: "scores.html" });

  const pickBtns = document.querySelectorAll("[data-pick]");
  const cards = document.querySelectorAll(".game-card");
  const soonEl = document.getElementById("soon");

  function show(count) {
    let shown = 0;
    cards.forEach((card) => {
      // Cards marked data-off are put away for now; drop the attribute to bring one back.
      const match = !("off" in card.dataset) && (card.dataset.players || "1") === count;
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
