// Player accounts and best scores, kept in Supabase (see supabase/README.md).
// Kids sign in with a name and a 4 to 6 digit PIN. Games call Accounts.submit(game, score, level)
// when a round ends. The score is kept on this device first (for its best scores and in case
// the internet is down), then sent to Supabase when someone is signed in. Scores made while
// signed out are sent the next time someone signs in on this device.
// With no project in js/config.js, everything stays on this device.
window.Accounts = (function () {
  const t = I18n.t;
  const cfg = window.KIDS_GAMES_SUPABASE || {};
  const url = String(cfg.url || "").replace(/\/+$/, "");
  const key = String(cfg.key || "");
  const online = !!(url && key);

  const SESSION = "kids-games-player";   // { token, id, name }
  const WAITING = "kids-games-waiting";  // scores not sent yet: [{ game, level, score, played_at, owner }]
  const LOCAL = "kids-games-best";       // best on this device: { game: { score, level } }

  // The games with a score, in the order the Best scores page shows them.
  const GAMES = [
    { id: "army", emoji: "🪖", name: "Army Rush", unit: "🌊 Wave" },
    { id: "army3d", emoji: "🪖", name: "Army Rush 3D", unit: "🌊 Wave" },
    { id: "armyfps", emoji: "🎯", name: "Army Rush FPS", unit: "🌊 Wave" },
    { id: "tetris", emoji: "🧱", name: "Blocks", unit: "⭐ Points" },
    { id: "jump", emoji: "🐸", name: "Jumpy Frog", unit: "🪨 Rocks" },
    { id: "simon", emoji: "🎵", name: "Copy Me", unit: "🎵 Copied" },
    { id: "odd", emoji: "🔍", name: "Odd One Out", unit: "⭐ Stars" },
  ];

  function load(name, empty) {
    try {
      return JSON.parse(localStorage.getItem(name)) || empty;
    } catch (e) {
      return empty;
    }
  }
  function save(name, value) {
    try {
      if (value == null) localStorage.removeItem(name);
      else localStorage.setItem(name, JSON.stringify(value));
    } catch (e) {
      // Private window: kept until the page is closed.
    }
  }

  let player = load(SESSION, null);
  const listeners = [];
  function changed() {
    listeners.forEach((fn) => fn(player));
  }

  // Calls one of the functions in supabase/setup.sql.
  async function rpc(name, args) {
    const headers = { apikey: key, "Content-Type": "application/json" };
    // Legacy "anon" keys are JWTs and go in Authorization too; new publishable keys don't.
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
    const res = await fetch(url + "/rest/v1/rpc/" + name, { method: "POST", headers, body: JSON.stringify(args) });
    if (!res.ok) throw new Error("Supabase " + res.status);
    return res.json();
  }

  async function read(path) {
    const headers = { apikey: key };
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
    const res = await fetch(url + "/rest/v1/" + path, { headers });
    if (!res.ok) throw new Error("Supabase " + res.status);
    return res.json();
  }

  const ERRORS = {
    bad_name: "Names are 2 to 16 letters or numbers, no spaces.",
    bad_pin: "The PIN is 4 to 6 numbers.",
    name_taken: "Someone already has that name. Try another one!",
    wrong: "That name and PIN don't match. Try again!",
    locked: "Too many wrong PINs. Wait 10 minutes and try again.",
  };

  async function enter(fn, name, pin) {
    if (!online) throw new Error(t("Scores are only kept on this device for now."));
    name = String(name || "").trim();
    pin = String(pin || "").trim();
    if (!/^[A-Za-z0-9]{2,16}$/.test(name)) throw new Error(t(ERRORS.bad_name));
    if (!/^[0-9]{4,6}$/.test(pin)) throw new Error(t(ERRORS.bad_pin));
    let out;
    try {
      out = await rpc(fn, { p_username: name, p_pin: pin });
    } catch (e) {
      throw new Error(t("Can't reach the internet. Try again later."));
    }
    if (out.error) throw new Error(t(ERRORS[out.error] || "Something went wrong. Try again!"));
    player = { token: out.token, id: out.player_id, name: out.username };
    save(SESSION, player);
    await send();
    changed();
    return player;
  }

  function logOut() {
    if (player && online) rpc("log_out", { p_token: player.token }).catch(() => {});
    player = null;
    save(SESSION, null);
    changed();
  }

  // Sends the scores waiting on this device: the signed-in player's own, and any made signed out.
  let sending = false;
  async function send() {
    if (!online || !player || sending) return;
    const me = player;
    const waiting = load(WAITING, []);
    const mine = waiting.filter((s) => !s.owner || s.owner === me.id);
    if (!mine.length) return;
    sending = true;
    try {
      const batch = mine.slice(0, 50);
      const out = await rpc("add_scores", {
        p_token: me.token,
        p_scores: batch.map((s) => ({ game: s.game, level: s.level, score: s.score, played_at: s.played_at })),
      });
      if (out.error === "signed_out") {
        if (player === me) logOut();
        return;
      }
      // Sent (or not a possible score): drop them. Read the list again, a new score may have come in.
      save(WAITING, load(WAITING, []).filter((s) => !batch.some((b) => b.at === s.at && b.game === s.game)));
      if (mine.length > batch.length) setTimeout(send, 0);
    } catch (e) {
      // No internet: they stay on this device and go next time.
    } finally {
      sending = false;
    }
  }

  // A game calls this when a round ends. level is the difficulty, like "easy" ("" if none).
  function submit(game, score, level) {
    score = Math.floor(Number(score));
    if (!(score > 0)) return;
    level = level || "";
    const best = load(LOCAL, {});
    if (!best[game] || score > best[game].score) {
      best[game] = { score, level };
      save(LOCAL, best);
    }
    const waiting = load(WAITING, []);
    waiting.push({ game, level, score, played_at: new Date().toISOString(), at: Date.now(), owner: player ? player.id : null });
    // Keep the list small if nobody signs in for a long time: the best 200.
    waiting.sort((a, b) => b.score - a.score);
    save(WAITING, waiting.slice(0, 200));
    send();
  }

  // Every player's best in every game: [{ game, player_id, username, level, score }], highest first.
  async function bestScores() {
    return read("best_scores?select=game,player_id,username,level,score&order=score.desc,played_at.asc");
  }

  // Level names for the Best scores page.
  function levelName(level) {
    if (!level) return "";
    const city = level.endsWith("-city");
    const names = { easy: "Easy", normal: "Normal", hard: "Hard", mega: "Mega-hard" };
    const base = level.replace(/-city$/, "");
    return t(names[base] || base) + (city ? " 🏘️" : "");
  }

  // ---------- Sign-in bar and window (hub and Best scores page) ----------

  function makeBar(holder, opts) {
    opts = opts || {};
    const dialog = document.createElement("dialog");
    dialog.className = "login";
    dialog.innerHTML =
      '<form method="dialog">' +
      '<button class="close" value="cancel" formnovalidate aria-label="' + t("Close") + '">✖</button>' +
      "<h2>👤 " + t("Who is playing?") + "</h2>" +
      "<label>" + t("Your name") + ' <input name="player" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" required></label>' +
      "<label>" + t("Your secret PIN") + ' <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" required></label>' +
      '<p class="error" role="alert"></p>' +
      '<div class="row"><button class="btn go" value="login">' + t("▶️ Log in") + "</button>" +
      '<button class="btn" value="new">' + t("🆕 I'm new") + "</button></div>" +
      '<p class="note">' + t("New here? Pick a name and a PIN of 4 to 6 numbers, then tap “I'm new”. Don't use your real full name!") + "</p>" +
      "</form>";
    document.body.appendChild(dialog);
    const form = dialog.querySelector("form");
    const errorEl = dialog.querySelector(".error");
    const buttons = dialog.querySelectorAll(".row .btn");

    form.addEventListener("submit", async (e) => {
      const which = e.submitter && e.submitter.value;
      if (which === "cancel") return;
      e.preventDefault();
      errorEl.textContent = "";
      buttons.forEach((b) => (b.disabled = true));
      try {
        await enter(which === "new" ? "sign_up" : "log_in", form.elements.player.value, form.elements.pin.value);
        form.reset();
        dialog.close();
      } catch (err) {
        errorEl.textContent = err.message;
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    });

    function draw() {
      holder.innerHTML = "";
      if (online && player) {
        const me = document.createElement("span");
        me.className = "me";
        me.textContent = "👤 " + player.name;
        holder.appendChild(me);
      }
      if (opts.scoresHref) {
        const a = document.createElement("a");
        a.className = "btn";
        a.href = opts.scoresHref;
        a.textContent = t("🏆 Best scores");
        holder.appendChild(a);
      }
      if (!online) return;
      const b = document.createElement("button");
      b.className = "btn";
      if (player) {
        b.textContent = t("👋 Log out");
        b.addEventListener("click", logOut);
      } else {
        b.textContent = t("👤 Log in");
        b.classList.add("go");
        b.addEventListener("click", () => {
          errorEl.textContent = "";
          dialog.showModal();
          form.elements.player.focus();
        });
      }
      holder.appendChild(b);
    }
    listeners.push(draw);
    draw();
  }

  I18n.add({
    fr: {
      "Names are 2 to 16 letters or numbers, no spaces.": "Un nom, c'est 2 à 16 lettres ou chiffres, sans espace.",
      "The PIN is 4 to 6 numbers.": "Le code, c'est 4 à 6 chiffres.",
      "Someone already has that name. Try another one!": "Quelqu'un a déjà ce nom. Essaie un autre !",
      "That name and PIN don't match. Try again!": "Ce nom et ce code ne vont pas ensemble. Réessaie !",
      "Too many wrong PINs. Wait 10 minutes and try again.": "Trop de mauvais codes. Attends 10 minutes et réessaie.",
      "Something went wrong. Try again!": "Oups, ça n'a pas marché. Réessaie !",
      "Can't reach the internet. Try again later.": "Pas d'internet. Réessaie plus tard.",
      "Scores are only kept on this device for now.": "Pour l'instant, les scores restent sur cet appareil.",
      "Close": "Fermer",
      "Who is playing?": "Qui joue ?",
      "Your name": "Ton nom",
      "Your secret PIN": "Ton code secret",
      "▶️ Log in": "▶️ Entrer",
      "🆕 I'm new": "🆕 Je suis nouveau",
      "New here? Pick a name and a PIN of 4 to 6 numbers, then tap “I'm new”. Don't use your real full name!":
        "Nouveau ? Choisis un nom et un code de 4 à 6 chiffres, puis touche « Je suis nouveau ». N'utilise pas ton vrai nom complet !",
      "🏆 Best scores": "🏆 Records",
      "👋 Log out": "👋 Sortir",
      "👤 Log in": "👤 Se connecter",
      "Normal": "Normal",
      "Mega-hard": "Méga-difficile",
    },
    "zh-HK": {
      "Names are 2 to 16 letters or numbers, no spaces.": "名要 2 至 16 個英文字母或者數字，唔可以有空格。",
      "The PIN is 4 to 6 numbers.": "密碼係 4 至 6 個數字。",
      "Someone already has that name. Try another one!": "已經有人用咗呢個名，試吓第二個啦！",
      "That name and PIN don't match. Try again!": "個名同密碼對唔上，再試吓！",
      "Too many wrong PINs. Wait 10 minutes and try again.": "錯咗太多次密碼，等 10 分鐘再試啦。",
      "Something went wrong. Try again!": "出咗啲問題，再試吓！",
      "Can't reach the internet. Try again later.": "上唔到網，遲啲再試啦。",
      "Scores are only kept on this device for now.": "暫時分數只會留喺呢部機。",
      "Close": "關閉",
      "Who is playing?": "邊個玩緊？",
      "Your name": "你個名",
      "Your secret PIN": "你嘅秘密密碼",
      "▶️ Log in": "▶️ 登入",
      "🆕 I'm new": "🆕 我係新嚟嘅",
      "New here? Pick a name and a PIN of 4 to 6 numbers, then tap “I'm new”. Don't use your real full name!":
        "第一次嚟？揀個名同 4 至 6 個數字嘅密碼，再撳「我係新嚟嘅」。唔好用你嘅真實全名！",
      "🏆 Best scores": "🏆 最高分",
      "👋 Log out": "👋 登出",
      "👤 Log in": "👤 登入",
      "Normal": "普通",
      "Mega-hard": "超級難",
    },
  });

  // Scores left waiting last time (no internet, or made signed out) go now.
  send();

  return {
    online, games: GAMES, submit, bestScores, levelName, makeBar, logOut,
    get player() { return player; },
    localBest: () => load(LOCAL, {}),
    onChange: (fn) => listeners.push(fn),
  };
})();
