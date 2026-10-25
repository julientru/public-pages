// Best scores page: my best in each game, the top 10 of each game, and the bests on this device.
(function () {
  const t = I18n.t;
  I18n.add({
    fr: {
      "Best scores": "Records",
      "🏆 Best scores": "🏆 Records",
      "Player": "Joueur",
      "⭐ My best": "⭐ Mes records",
      "🏆 Top 10": "🏆 Top 10",
      "📱 On this device": "📱 Sur cet appareil",
      "Loading…": "Chargement…",
      "No scores yet. Play a game!": "Pas encore de scores. Va jouer !",
      "Can't reach the internet. Try again later.": "Pas d'internet. Réessaie plus tard.",
      "Log in to keep your scores and see everyone's.": "Connecte-toi pour garder tes scores et voir ceux des autres.",
      "⏱️ Time to win": "⏱️ Temps pour gagner",
      "⭐ Points": "⭐ Points",
      "🪨 Rocks": "🪨 Cailloux",
      "🎵 Copied": "🎵 Copiés",
      "⭐ Stars": "⭐ Étoiles",
      "Army Rush": "Armée en folie",
      "Army Rush 3D": "Armée en folie 3D",
      "Army Rush FPS": "Armée en folie FPS",
      "Blocks": "Blocs",
      "Jumpy Frog": "Grenouille sauteuse",
      "Copy Me": "Imite-moi",
      "Odd One Out": "L'intrus",
    },
    "zh-HK": {
      "Best scores": "最高分",
      "🏆 Best scores": "🏆 最高分",
      "Player": "玩家",
      "⭐ My best": "⭐ 我嘅最高分",
      "🏆 Top 10": "🏆 頭十名",
      "📱 On this device": "📱 喺呢部機",
      "Loading…": "載入緊…",
      "No scores yet. Play a game!": "仲未有分數，去玩吓啦！",
      "Can't reach the internet. Try again later.": "上唔到網，遲啲再試啦。",
      "Log in to keep your scores and see everyone's.": "登入就可以留住你嘅分數，同埋睇到大家嘅分數。",
      "⏱️ Time to win": "⏱️ 幾耐贏到",
      "⭐ Points": "⭐ 分數",
      "🪨 Rocks": "🪨 石頭",
      "🎵 Copied": "🎵 跟到",
      "⭐ Stars": "⭐ 星星",
      "Army Rush": "軍隊大衝鋒",
      "Army Rush 3D": "軍隊大衝鋒 3D",
      "Army Rush FPS": "軍隊大衝鋒 FPS",
      "Blocks": "砌方塊",
      "Jumpy Frog": "跳跳青蛙",
      "Copy Me": "跟住我",
      "Odd One Out": "邊個唔同？",
    },
  });

  const main = document.getElementById("scores");
  Accounts.makeBar(document.getElementById("account"));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function heading(text) {
    main.appendChild(el("h2", null, text));
  }

  // A card for one game and level: "🪖 Army Rush · Hard 🏘️".
  function card(board) {
    const c = el("section", "score-card");
    const lvl = Accounts.levelName(board.level);
    c.appendChild(el("h3", null, board.game.emoji + " " + t(board.game.name) + (lvl ? " · " + lvl : "")));
    main.appendChild(c);
    return c;
  }

  // One big number: my best, or the best on this device.
  function bigCard(board) {
    const c = card(board);
    c.appendChild(el("p", "big", Accounts.show(board.game.id, board.rows[0].score)));
    c.appendChild(el("span", "unit", t(board.game.unit)));
  }

  function localSection() {
    const boards = Accounts.boards(Accounts.localBest());
    if (!boards.length) return false;
    heading(t("📱 On this device"));
    boards.forEach(bigCard);
    return true;
  }

  let drawing = 0;
  async function draw() {
    const mine = ++drawing;
    main.innerHTML = "";
    if (!Accounts.online) {
      if (!localSection()) main.appendChild(el("p", "empty", t("No scores yet. Play a game!")));
      return;
    }
    main.appendChild(el("p", "empty", t("Loading…")));
    let rows;
    try {
      rows = await Accounts.bestScores();
    } catch (e) {
      rows = null;
    }
    if (mine !== drawing) return;
    main.innerHTML = "";
    const me = Accounts.player;

    if (!rows) {
      main.appendChild(el("p", "empty", t("Can't reach the internet. Try again later.")));
      localSection();
      return;
    }

    if (me) {
      const myBoards = Accounts.boards(rows.filter((r) => r.player_id === me.id));
      if (myBoards.length) {
        heading(t("⭐ My best"));
        myBoards.forEach(bigCard);
      }
    } else {
      main.appendChild(el("p", "empty", t("Log in to keep your scores and see everyone's.")));
      localSection();
    }

    const boards = Accounts.boards(rows);
    if (!boards.length) {
      main.appendChild(el("p", "empty", t("No scores yet. Play a game!")));
      return;
    }
    heading(t("🏆 Top 10"));
    boards.forEach((board) => {
      const c = card(board);
      c.appendChild(el("div", "unit", t(board.game.unit)));
      const list = el("ol");
      // Equal scores share a place.
      let place = 0, last = null;
      board.rows.slice(0, 10).forEach((r, i) => {
        if (r.score !== last) place = i + 1;
        last = r.score;
        const li = el("li", me && r.player_id === me.id ? "mine" : null);
        li.appendChild(el("span", "rank", place <= 3 ? ["🥇", "🥈", "🥉"][place - 1] : place + "."));
        li.appendChild(el("span", "who", r.username));
        li.appendChild(el("span", "pts", Accounts.show(r.game, r.score)));
        list.appendChild(li);
      });
      c.appendChild(list);
    });
  }

  Accounts.onChange(draw);
  draw();
})();
