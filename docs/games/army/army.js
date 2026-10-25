// Army Rush: a silly army marches down at you. Your army shoots by itself; you aim.
// Shoot boxes to get a new weapon, more of your weapon, or a stronger defence.
// A new weapon swaps your whole army for one of it, and a weapon you miss never comes back.
// The enemy breaks your wall first, then hits your life. Enemies never get hurt for real:
// they flash, squash, and tumble away with dizzy eyes.
(function () {
  const t = I18n.t;
  const W = 480;
  const H = 640;
  const WALL_Y = H - 108;  // sandbag wall: enemies stop and bash it until it breaks
  const SQUAD_Y = H - 72;  // your army
  const STEP = 1 / 60;

  // One unit of each weapon: dps = dmg * rate * (multi || 1). max = how many you can have,
  // add = how many an army box gives. Each new weapon starts as one unit.
  const WEAPONS = [
    { name: t("Stones"), emoji: "🪨", dmg: 1, rate: 2, speed: 420, kind: "stone", max: 6, add: 2 },
    { name: t("Axes"), emoji: "🪓", dmg: 3, rate: 2, speed: 430, kind: "axe", max: 6, add: 2 },
    { name: t("Bows"), emoji: "🏹", dmg: 6, rate: 2.5, speed: 620, kind: "arrow", max: 5, add: 1 },
    { name: t("Pistol"), emoji: "🔫", dmg: 14, rate: 3, speed: 650, kind: "dart", max: 5, add: 1 },
    { name: t("Two pistols"), emoji: "🔫🔫", dmg: 18, rate: 3, multi: 2, speed: 650, kind: "dart", max: 4, add: 1 },
    { name: t("Cannon"), emoji: "💣", dmg: 250, rate: 1.2, speed: 420, splash: 45, kind: "ball", max: 4, add: 1, vehicle: true },
    { name: t("Gatling"), emoji: "💥", dmg: 80, rate: 10, speed: 760, kind: "pellet", max: 3, add: 1 },
    { name: t("Tank"), emoji: "🛡️", dmg: 1400, rate: 1.5, speed: 520, splash: 55, kind: "shell", max: 3, add: 1, vehicle: true },
    { name: t("Missiles"), emoji: "🚀", dmg: 1900, rate: 1.5, multi: 2, speed: 480, splash: 60, kind: "missile", max: 3, add: 1 },
    { name: t("Planes"), emoji: "✈️", dmg: 7500, rate: 2, speed: 380, splash: 60, kind: "plane", max: 3, add: 1, vehicle: true },
    { name: t("Satellite laser"), emoji: "🛰️", dmg: 10000, rate: 4, speed: 1100, pierce: 3, kind: "laser", max: 2, add: 1, vehicle: true },
    { name: t("Mega bomb"), emoji: "☢️", dmg: 110000, rate: 1, speed: 360, splash: 130, kind: "bomb", max: 1, add: 0, vehicle: true },
  ];

  // hp is a multiple of the wave's toughness. hit = life lost when it reaches your army,
  // bash = wall damage per second while it stands at the wall, shot = what it throws at you.
  const ENEMIES = {
    thrower: { name: t("Stone thrower"), r: 20, speed: 40, hp: 1, hit: 5, bash: 3, color: "#f4a261", hat: "bandana", prop: "stone", mouth: "tongue",
      shot: { kind: "stone", every: 3.4, dmg: 1 } },
    boss: { name: t("Big Boss"), r: 40, speed: 22, hp: 7, hit: 15, bash: 8, color: "#e76f51", hat: "crown", prop: "club", mouth: "teeth",
      shot: { kind: "rock", every: 3, dmg: 3 } },
    soldier: { name: t("Soldier"), r: 21, speed: 46, hp: 1.2, hit: 6, bash: 4, color: "#c9a0dc", hat: "helmet", prop: "stick", mouth: "smile",
      shot: { kind: "cork", every: 2.8, dmg: 1 } },
    cannon: { name: t("Cannon crew"), r: 24, speed: 34, hp: 2, hit: 8, bash: 5, color: "#ffb4a2", hat: "helmet", prop: "cannon", mouth: "o",
      shot: { kind: "ball", every: 3.2, dmg: 2 } },
    bigboss: { name: t("Big Big Boss"), r: 55, speed: 17, hp: 14, hit: 20, bash: 12, color: "#ef476f", hat: "crown", prop: "club", mouth: "teeth", mustache: true,
      shot: { kind: "rock", every: 2.4, dmg: 4 } },
    tank: { name: t("Tank"), r: 32, speed: 30, hp: 3, hit: 10, bash: 8, color: "#90a955", tank: true,
      shot: { kind: "shell", every: 3.2, dmg: 3 } },
    bigtank: { name: t("Big tank"), r: 45, speed: 23, hp: 6, hit: 15, bash: 12, color: "#bc6c25", tank: true,
      shot: { kind: "shell", every: 2.6, dmg: 4 } },
    tankboss: { name: t("Tank Boss"), r: 62, speed: 15, hp: 20, hit: 30, bash: 20, color: "#6d597a", tank: true, crown: true,
      shot: { kind: "bigshell", every: 2, dmg: 6 } },
    king: { name: t("KING TANK"), r: 82, speed: 10, hp: 55, hit: 100, bash: 40, color: "#f4c430", tank: true, crown: true, mustache: true,
      shot: { kind: "bigshell", every: 1.4, dmg: 8 } },
  };

  const WAVES = [
    { name: t("Stone throwers!"), groups: [["thrower", 8]], gap: 2 },
    { name: t("Here comes Big Boss!"), groups: [["thrower", 8], ["boss", 1]], gap: 1.8 },
    { name: t("Soldiers!"), groups: [["soldier", 12]], gap: 1.5 },
    { name: t("Two Big Bosses!"), groups: [["soldier", 10], ["boss", 2]], gap: 1.5 },
    { name: t("Cannons!"), groups: [["soldier", 8], ["cannon", 7]], gap: 1.4 },
    { name: t("Big Big Boss!"), groups: [["cannon", 9], ["bigboss", 1]], gap: 1.4 },
    { name: t("Tanks!"), groups: [["soldier", 6], ["tank", 8]], gap: 1.4 },
    { name: t("Bigger tanks!"), groups: [["tank", 8], ["bigtank", 4]], gap: 1.4 },
    { name: t("Boss parade!"), groups: [["bigtank", 6], ["bigboss", 2]], gap: 1.5 },
    { name: t("Tank Boss!"), groups: [["tank", 10], ["tankboss", 1]], gap: 1.3 },
    { name: t("The whole tank army!"), groups: [["bigtank", 10], ["tankboss", 2]], gap: 1.3 },
    { name: t("THE KING TANK!"), groups: [["tank", 10], ["king", 1]], gap: 1.3 },
  ];
  // How tough each wave is (roughly the firepower a good player has by then).
  const POWER = [2, 9, 35, 100, 300, 500, 1500, 4000, 9000, 14000, 25000, 33000];

  // power = enemy toughness, boxes = chance that a door is a box (else a tough wall),
  // hurt = how hard enemies hit your wall and your life.
  const LEVELS = {
    easy: { name: t("Easy"), power: 0.5, boxes: 1, hurt: 1 },
    normal: { name: t("Normal"), power: 0.85, boxes: 2 / 3, hurt: 1.2 },
    hard: { name: t("Hard"), power: 1, boxes: 1 / 2, hurt: 1.4 },
    mega: { name: t("Mega-hard"), power: 1.05, boxes: 1 / 3, hurt: 1.6 },
  };

  const POOF_WORDS = I18n.list(["POOF!", "BOING!", "Bye-bye!", "Oof!", "Wheee!", "Ouchie!", "BONK!", "Oopsie!"]);

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const el = {
    wave: document.getElementById("wave"),
    life: document.getElementById("life"),
    weapon: document.getElementById("weapon"),
    menu: document.getElementById("menu"),
  };
  const levelBtns = document.querySelectorAll("[data-level]");

  let g;            // everything about the current battle
  let level = "easy";
  let state = "ready";
  let time = 0;     // seconds, keeps animations going on every screen
  let endedAt = -10; // a short pause after the end, so a stray tap does not restart at once
  const input = { left: false, right: false, targetX: null, dragging: false };

  // "Manage my city": a second view where your city helps this battle (see city.js).
  const city = ArmyCity.create({
    W, wallY: WALL_Y, weapons: WEAPONS,
    game: () => g, state: () => state, start: () => start(), sync: () => syncStats(),
    placeToggle: (label) => document.getElementById("menu").appendChild(label),
    placeButton: (btn) => document.querySelector(".hud .home").after(btn),
    onToggle() { state = "ready"; newGame(); },
  });

  function newGame() {
    g = {
      wave: 0, spawnQueue: [], spawnIn: 0, breakIn: city.peace, banner: null,
      enemies: [], bullets: [], shots: [], doors: [], doorIn: 4, fx: [], tumblers: [],
      tier: 0, count: 1, missed: new Set(), life: 100, wall: 100, wallMax: 100, shield: 0,
      squadX: W / 2, fireIn: 0.3, shake: 0, hurt: 0,
    };
    city.reset();
    startWave(0);
    syncStats();
  }

  function startWave(i) {
    g.wave = i;
    const wave = WAVES[i];
    g.spawnQueue = [];
    wave.groups.forEach(([type, count]) => { for (let n = 0; n < count; n++) g.spawnQueue.push(type); });
    // With a city to look after, there is a calm moment before the first attack.
    g.calm = i === 0 && city.on;
    g.spawnIn = i === 0 ? city.firstWait : 2.5;
    g.banner = { text: city.on ? city.waveTitle(i, wave.name) : t("Wave {n}: {name}", { n: i + 1, name: wave.name }), t: 2.5 };
    // A fresh pair of doors with every wave, so there is always something to aim for.
    g.doorIn = Math.min(g.doorIn, 1);
    syncStats();
  }

  function dps() {
    const w = WEAPONS[g.tier];
    return w.dmg * w.rate * (w.multi || 1) * g.count;
  }

  function fmt(n) {
    n = Math.ceil(n);
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    if (n < 1e6) return Math.round(n / 1000) + "k";
    return (n / 1e6).toFixed(1).replace(".0", "") + "M";
  }

  function syncStats() {
    el.wave.textContent = city.on ? city.round : g.wave + 1;
    el.life.textContent = Math.max(0, Math.ceil(g.life));
    const w = WEAPONS[g.tier];
    el.weapon.textContent = w.emoji + " " + w.name + (g.count > 1 ? " ×" + g.count : "");
  }

  // The next weapon you can still get: missed ones are gone for this game.
  function nextWeapon() {
    for (let t = g.tier + 1; t < WEAPONS.length; t++) if (!g.missed.has(t)) return t;
    return -1;
  }

  // ---------- Spawning ----------

  function spawnEnemy(type) {
    const T = ENEMIES[type];
    const hp = Math.max(1, Math.round(T.hp * POWER[g.wave] * LEVELS[level].power));
    g.enemies.push({
      type, x: T.r + 10 + Math.random() * (W - 2 * T.r - 20), y: -T.r - 10,
      hp, maxHp: hp, shownHp: hp, flash: 0, seed: Math.random() * 10, wobble: 0.6 + Math.random() * 0.8,
      shotIn: 1 + Math.random() * T.shot.every, bash: 0,
    });
  }

  function spawnDoors() {
    if (g.noDoors) return;
    const boxHp = (secs) => Math.max(4, Math.ceil(dps() * secs));
    // Managing a city: your city makes the army, so only a shield box comes now and then
    // (less often on harder levels), on one side of the road.
    if (city.on) {
      if (Math.random() >= LEVELS[level].boxes * 0.3) return;
      const box = { kind: "shield", hp: boxHp(2) };
      box.maxHp = box.hp;
      const left = Math.random() < 0.5;
      box.x0 = left ? 18 : W / 2 + 12; box.x1 = left ? W / 2 - 12 : W - 18;
      g.doors.push({ y: -90, h: 84, speed: 52, list: [box] });
      return;
    }
    const w = WEAPONS[g.tier];
    const next = nextWeapon();
    const offers = [];
    // New weapons arrive at a steady pace, about one per wave.
    if (next >= 0 && next <= g.wave + 2) offers.push({ kind: "weapon", tier: next, hp: boxHp(2.4) });
    if (g.count < w.max) offers.push({ kind: "army", amount: Math.min(w.add, w.max - g.count), hp: boxHp(2) });
    const wallHurt = g.wall < g.wallMax * 0.7;
    const wall = { kind: "wall", hp: boxHp(2) };
    const shield = { kind: "shield", hp: boxHp(2) };
    if (wallHurt || Math.random() < 0.5) offers.push(wall, shield); else offers.push(shield, wall);
    let pair = offers.slice(0, 2);
    // Where a box is missing there is a tough wall instead (more of them on harder levels).
    pair = pair.map((d) => (Math.random() < LEVELS[level].boxes ? d : { kind: "barrier", hp: boxHp(2) * 4 }));
    pair.forEach((d) => { d.maxHp = d.hp; });
    let [a, b] = pair;
    if (Math.random() < 0.5) [a, b] = [b, a];
    a.x0 = 18; a.x1 = W / 2 - 12;
    b.x0 = W / 2 + 12; b.x1 = W - 18;
    g.doors.push({ y: -90, h: 84, speed: 52, list: [a, b] });
  }

  // ---------- Update ----------

  function unitGap() {
    return WEAPONS[g.tier].vehicle ? 46 : 30;
  }

  function squadSpots() {
    const spots = [];
    const gap = unitGap();
    for (let i = 0; i < g.count; i++) spots.push({ x: g.squadX + (i - (g.count - 1) / 2) * gap, y: SQUAD_Y, i });
    return spots;
  }

  function squadHalfWidth() {
    return ((g.count - 1) * unitGap()) / 2 + (WEAPONS[g.tier].vehicle ? 22 : 15);
  }

  function fire() {
    const w = WEAPONS[g.tier];
    const multi = w.multi || 1;
    squadSpots().forEach((s) => {
      for (let m = 0; m < multi; m++) {
        const off = multi > 1 ? (m - 0.5) * 10 : 0;
        g.bullets.push({ x: s.x + off, y: s.y - 16, vy: -w.speed, dmg: w.dmg, kind: w.kind,
          splash: w.splash || 0, pierce: w.pierce || 0, hit: [], age: 0 });
      }
    });
    g.kick = 0.08;
  }

  function hurtEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.15;
    if (e.hp <= 0) {
      g.enemies.splice(g.enemies.indexOf(e), 1);
      const T = ENEMIES[e.type];
      g.tumblers.push({ type: e.type, x: e.x, y: e.y, vx: (Math.random() - 0.5) * 360, vy: -320 - T.r * 3,
        rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6), seed: e.seed, t: 0 });
      poof(e.x, e.y, T.r, POOF_WORDS[Math.floor(Math.random() * POOF_WORDS.length)]);
      if (T.r > 40) g.shake = 0.4;
    }
  }

  function poof(x, y, r, word) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fx.push({ type: "puff", x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, r: r * 0.4, t: 0, life: 0.6 });
    }
    for (let i = 0; i < 4; i++) {
      g.fx.push({ type: "star", x, y, vx: (Math.random() - 0.5) * 300, vy: -100 - Math.random() * 200,
        t: 0, life: 0.8, color: ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77"][i] });
    }
    if (word) say(word, x, y - r, 18 + r * 0.3, "#fff");
  }

  function say(text, x, y, size, color) {
    g.fx.push({ type: "text", text, x, y, vy: -50, t: 0, life: 1.1, size, color });
  }

  function boom(x, y, radius) {
    g.fx.push({ type: "boom", x, y, r: radius, t: 0, life: 0.45 });
    if (radius >= 100) {
      g.fx.push({ type: "text", text: "KA-BOOM!", x, y: y - 20, vy: -40, t: 0, life: 1.2, size: 40, color: "#ffd93d" });
      g.shake = 0.35;
    }
  }

  function confetti(cx, cy, n, colors) {
    for (let i = 0; i < n; i++) {
      g.fx.push({ type: "confetti", x: cx + (Math.random() - 0.5) * 120, y: cy, vx: (Math.random() - 0.5) * 300,
        vy: -150 - Math.random() * 250, t: 0, life: 1.4, rot: Math.random() * 6, color: colors[i % colors.length] });
    }
  }

  function breakDoor(pair, door) {
    door.broken = true;
    const cx = (door.x0 + door.x1) / 2;
    const cy = pair.y + pair.h / 2;
    if (door.kind === "barrier") {
      // A wall is not a prize: it just crumbles out of the way.
      door.gone = true;
      confetti(cx, cy, 16, ["#adb5bd", "#6c757d", "#ced4da"]);
      say(t("CRUMBLE!"), cx, cy, 24, "#fff");
      return;
    }
    confetti(cx, cy, 24, ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77", "#9b5de5"]);
    let text;
    if (door.kind === "weapon") {
      g.tier = door.tier;
      g.count = 1;
      text = t("{name}!", { name: WEAPONS[g.tier].name });
    } else if (door.kind === "army") {
      g.count = Math.min(WEAPONS[g.tier].max, g.count + door.amount);
      text = "+" + door.amount + " " + WEAPONS[g.tier].emoji;
    } else if (door.kind === "wall") {
      g.wallMax += 40;
      g.wall = g.wallMax;
      text = t("Bigger wall!");
    } else {
      g.shield = 12;
      text = t("Shield!");
    }
    g.banner = { text: "🎉 " + text, t: 1.8 };
    // You only get one box of the pair: the other one fades away.
    pair.list.forEach((d) => { if (d !== door && d.kind !== "barrier") d.gone = true; });
    pair.done = true;
    closePair(pair);
    syncStats();
  }

  // When a pair is finished, a weapon you did not take is missed for the rest of the game.
  function closePair(pair) {
    pair.closed = true;
    pair.list.forEach((d) => {
      if (d.kind === "weapon" && !d.broken) {
        g.missed.add(d.tier);
        g.banner = { text: t("😮 Missed the {name}!", { name: WEAPONS[d.tier].name }), t: 2 };
      }
    });
  }

  function hurtWall(dmg) {
    if (g.wall <= 0) return;
    g.wall -= dmg;
    if (g.wall <= 0) {
      g.wall = 0;
      g.shake = 0.5;
      confetti(W / 2, WALL_Y, 30, ["#d4a373", "#a47148", "#e9c46a"]);
      say(t("CRASH! The wall broke!"), W / 2, WALL_Y - 30, 28, "#ff6b6b");
    }
  }

  function hurtLife(dmg) {
    g.life -= dmg;
    g.hurt = 0.4;
    g.shake = Math.max(g.shake, 0.25);
    say("-" + Math.ceil(dmg) + " ❤️", g.squadX, SQUAD_Y - 34, 24, "#ff6b6b");
    syncStats();
    if (g.life <= 0) gameOver();
  }

  function breakThrough(e) {
    const T = ENEMIES[e.type];
    g.enemies.splice(g.enemies.indexOf(e), 1);
    poof(e.x, SQUAD_Y, T.r, t("Hee hee!"));
    g.leaks = (g.leaks || 0) + 1;
    hurtLife(T.hit * LEVELS[level].hurt);
  }

  function enemyShoot(e) {
    const T = ENEMIES[e.type];
    const s = T.shot;
    const x = e.x + (T.tank ? 0 : T.r * 0.6), y = e.y + T.r * 0.6, vy = s.kind === "bigshell" ? 190 : 150;
    g.shots.push({ x, y, vy, vx: city.towerAim(x, y, vy),
      dmg: s.dmg, kind: s.kind, age: 0 });
    e.throwT = 0.3;
  }

  function update(dt) {
    if (state !== "playing") return;
    const w = WEAPONS[g.tier];
    const L = LEVELS[level];
    city.tick(dt);

    // Move the army.
    const speed = 380;
    if (input.left || input.right) {
      input.targetX = null;
      g.squadX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * speed * dt;
    } else if (input.targetX !== null) {
      const d = input.targetX - g.squadX;
      g.squadX += Math.sign(d) * Math.min(Math.abs(d), speed * 1.4 * dt);
    }
    const half = squadHalfWidth();
    g.squadX = Math.max(half, Math.min(W - half, g.squadX));

    // Shoot all the time.
    g.fireIn -= dt;
    if (g.fireIn <= 0) {
      g.fireIn += 1 / w.rate;
      fire();
    }
    g.shield = Math.max(0, g.shield - dt);

    // Spawn the wave.
    if (g.spawnQueue.length) {
      g.spawnIn -= dt;
      if (g.spawnIn <= 0) {
        g.calm = false;
        spawnEnemy(g.spawnQueue.shift());
        g.spawnIn = WAVES[g.wave].gap * (0.7 + Math.random() * 0.6);
      } else if (g.calm && (!g.banner || g.banner.t <= 0.6)) {
        city.countdown(g.spawnIn);
      }
    } else if (!g.enemies.length) {
      // With a city to look after there is no last wave: the battle goes on until you lose.
      if (g.wave === WAVES.length - 1 && !city.on) return win();
      g.breakIn -= dt;
      if (g.breakIn <= 0) {
        g.breakIn = city.peace;
        startWave(city.nextWave(g.wave));
      } else if (city.on && g.breakIn < city.peace - 2.4) {
        city.countdown(g.breakIn);
      } else if (!g.banner || g.banner.t <= 0) {
        g.banner = { text: t("Wave {n} done! ⭐", { n: city.on ? city.round : g.wave + 1 }), t: 2.4 };
      }
    }

    // Doors.
    g.doorIn -= dt;
    if (g.doorIn <= 0) {
      spawnDoors();
      g.doorIn = 7;
    }
    g.doors.forEach((p) => {
      p.y += p.speed * dt;
      p.list.forEach((d) => { if (d.gone || d.broken) d.fade = (d.fade || 0) + dt; });
      if (!p.closed && p.y >= WALL_Y - p.h) closePair(p);
    });
    g.doors = g.doors.filter((p) => p.y < WALL_Y - p.h + 10 && !p.list.every((d) => d.fade > 0.5));

    // Enemies march down, stop to bash the wall, and throw things at you.
    g.enemies.slice().forEach((e) => {
      const T = ENEMIES[e.type];
      const stopY = WALL_Y - T.r * 0.9 - 8;
      e.atWall = g.wall > 0 && e.y >= stopY;
      if (e.atWall) {
        e.y = stopY;
        e.bash += dt;
        if (!city.towerBash(e.x, T.r, T.bash * L.hurt * dt)) hurtWall(T.bash * L.hurt * dt);
      } else {
        e.y += T.speed * dt;
        e.x += (Math.sin(time * e.wobble + e.seed) * 14 + city.towerPull(e.x, e.y)) * dt;
        e.x = Math.max(T.r, Math.min(W - T.r, e.x));
        e.shotIn -= dt;
        if (e.shotIn <= 0 && e.y > 30 && e.y < WALL_Y - 80) {
          e.shotIn = T.shot.every * (0.8 + Math.random() * 0.4);
          enemyShoot(e);
        }
      }
      e.throwT = Math.max(0, (e.throwT || 0) - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.shownHp += (e.hp - e.shownHp) * Math.min(1, dt * 6);
      if (e.y + T.r * 0.6 >= SQUAD_Y - 10) breakThrough(e);
    });
    if (state !== "playing") return;

    // Enemy shots hit the wall, or your army once the wall is gone. The shield blocks them all.
    g.shots.forEach((s) => {
      s.y += s.vy * dt;
      if (s.vx) s.x += s.vx * dt;
      s.age += dt;
      // The enemy aims at your towers first: they take the hit instead of the wall.
      if (city.towerShot(s.x, s.y, s.dmg * L.hurt)) { s.dead = true; return; }
      const lineY = g.wall > 0 ? WALL_Y - 6 : SQUAD_Y - 12;
      if (s.y < lineY) return;
      const onArmy = Math.abs(s.x - g.squadX) < squadHalfWidth() + 6;
      if (g.wall <= 0 && !onArmy) {
        if (s.y > H + 20) s.dead = true;
        return;
      }
      s.dead = true;
      if (g.shield > 0) {
        say(t("Boing!"), s.x, lineY - 10, 16, "#90e0ef");
        return;
      }
      g.fx.push({ type: "puff", x: s.x, y: lineY, vx: 0, vy: -20, r: 8, t: 0, life: 0.4 });
      if (g.wall > 0) hurtWall(s.dmg * L.hurt);
      else hurtLife(s.dmg * L.hurt);
    });
    g.shots = g.shots.filter((s) => !s.dead);
    if (state !== "playing") return;

    // Bullets fly up and hit the first thing in their way.
    g.bullets.forEach((b) => {
      b.y += b.vy * dt;
      if (b.vx) b.x += b.vx * dt;
      b.age += dt;
      for (const e of g.enemies) {
        if (b.hit.includes(e)) continue;
        const T = ENEMIES[e.type];
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (T.r + 6) * (T.r + 6)) {
          if (b.splash) {
            boom(b.x, b.y, b.splash);
            g.enemies.slice().forEach((o) => {
              const ox = o.x - b.x, oy = o.y - b.y, rr = b.splash + ENEMIES[o.type].r;
              if (ox * ox + oy * oy < rr * rr) hurtEnemy(o, b.dmg);
            });
          } else {
            hurtEnemy(e, b.dmg);
            g.fx.push({ type: "pow", x: b.x, y: b.y, t: 0, life: 0.2 });
          }
          b.hit.push(e);
          if (b.hit.length > b.pierce) { b.dead = true; return; }
        }
      }
      // Tower shots fly past the boxes: picking a box is your choice.
      if (b.tower) return;
      for (const p of g.doors) {
        if (b.y > p.y + p.h || b.y < p.y) continue;
        for (const d of p.list) {
          if (d.gone || d.broken || b.x < d.x0 || b.x > d.x1) continue;
          d.hp -= b.dmg;
          d.flash = 0.1;
          if (b.splash) boom(b.x, b.y, Math.min(60, b.splash));
          else g.fx.push({ type: "pow", x: b.x, y: b.y, t: 0, life: 0.2 });
          if (d.hp <= 0) breakDoor(p, d);
          b.dead = true;
          return;
        }
      }
    });
    g.bullets = g.bullets.filter((b) => !b.dead && b.y > -40 && b.x > -40 && b.x < W + 40);

    g.doors.forEach((p) => p.list.forEach((d) => { if (d.flash) d.flash = Math.max(0, d.flash - dt); }));
  }

  // Effects keep moving even on the win / game-over screens.
  function updateFx(dt) {
    time += dt;
    if (!g) return;
    g.fx.forEach((f) => {
      f.t += dt;
      if (f.vx) f.x += f.vx * dt;
      if (f.vy) f.y += f.vy * dt;
      if (f.type === "star" || f.type === "confetti") f.vy += 500 * dt;
    });
    g.fx = g.fx.filter((f) => f.t < f.life);
    g.tumblers.forEach((t) => {
      t.t += dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 700 * dt;
      t.rot += t.vr * dt;
    });
    g.tumblers = g.tumblers.filter((t) => t.y < H + 120);
    g.shake = Math.max(0, g.shake - dt);
    g.hurt = Math.max(0, g.hurt - dt);
    g.kick = Math.max(0, (g.kick || 0) - dt);
    if (g.banner) g.banner.t -= dt;
    if (state === "won" && Math.random() < 0.3) {
      g.fx.push({ type: "confetti", x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 60, vy: 60,
        t: 0, life: 4, rot: Math.random() * 6, color: ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77", "#9b5de5"][Math.floor(Math.random() * 5)] });
    }
  }

  // Best scores: the wave you reached, on its level ("-city" with Manage my city).
  function sendScore() {
    if (g.scored) return;
    g.scored = true;
    Accounts.submit("army", city.on ? city.round : g.wave + 1, level + (city.on ? "-city" : ""));
  }

  function gameOver() {
    state = "over";
    endedAt = time;
    sendScore();
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  function win() {
    state = "won";
    endedAt = time;
    sendScore();
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  // ---------- Drawing helpers ----------

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyes(x, y, size, gap, seed, dizzy) {
    [-1, 1].forEach((side) => {
      const ex = x + side * gap;
      circle(ex, y, size, "#fff");
      ctx.strokeStyle = "#2b2d42";
      ctx.lineWidth = Math.max(1, size * 0.15);
      ctx.beginPath(); ctx.arc(ex, y, size, 0, Math.PI * 2); ctx.stroke();
      if (dizzy) {
        // Swirly dizzy eyes.
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) {
          const rad = (a / (Math.PI * 4)) * size * 0.8;
          ctx.lineTo(ex + Math.cos(a + time * 10) * rad, y + Math.sin(a + time * 10) * rad);
        }
        ctx.stroke();
      } else {
        // Googly pupils that jiggle around.
        const jx = Math.sin(time * 9 + seed + side) * size * 0.25;
        const jy = Math.cos(time * 7 + seed) * size * 0.2 + size * 0.25;
        circle(ex + jx, y + jy, size * 0.45, "#2b2d42");
      }
    });
  }

  function crown(x, y, s) {
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "#e09f00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s, y - s * 0.9);
    ctx.lineTo(x - s * 0.5, y - s * 0.4);
    ctx.lineTo(x, y - s * 1.1);
    ctx.lineTo(x + s * 0.5, y - s * 0.4);
    ctx.lineTo(x + s, y - s * 0.9);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    circle(x, y - s * 0.35, s * 0.15, "#ff6b6b");
  }

  function mustache(x, y, s) {
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = s * 0.25;
    ctx.lineCap = "round";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * s * 0.6, y + s * 0.3, x + side * s, y - s * 0.2 + Math.sin(time * 6) * s * 0.1);
      ctx.stroke();
    });
    ctx.lineCap = "butt";
  }

  // ---------- Enemies ----------

  function drawPerson(T, e, dizzy) {
    const r = T.r;
    const phase = time * 8 + e.seed;
    const hit = e.flash > 0;
    // Legs march.
    ctx.fillStyle = "#3d405b";
    [-1, 1].forEach((side) => {
      const lift = Math.sin(phase + (side > 0 ? Math.PI : 0)) * r * 0.15;
      ctx.beginPath();
      ctx.ellipse(side * r * 0.4, r * 0.85 + lift, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Arm + prop, with a silly swing.
    // Arm swings, with a big wind-up when throwing.
    const swing = e.throwT > 0 ? 1.4 - e.throwT * 6 : Math.sin(time * 4 + e.seed) * 0.6;
    ctx.save();
    ctx.translate(r * 0.85, -r * 0.1);
    ctx.rotate(-0.6 + swing);
    ctx.strokeStyle = T.color;
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.6); ctx.stroke();
    ctx.lineCap = "butt";
    if (T.prop === "stone") circle(0, -r * 0.75, r * 0.28, "#8d99ae");
    if (T.prop === "club") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = r * 0.2;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, -r * 1.2); ctx.stroke();
      circle(0, -r * 1.25, r * 0.25, "#a0522d");
    }
    if (T.prop === "stick") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, -r * 1.4); ctx.stroke();
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 0.6, -r * 1.25); ctx.lineTo(0, -r * 1.1); ctx.fill();
    }
    ctx.restore();
    // Body.
    circle(0, 0, r, hit ? "#fff" : T.color);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    // Face.
    eyes(0, -r * 0.2, r * 0.28, r * 0.36, e.seed, dizzy);
    ctx.fillStyle = "#2b2d42";
    ctx.strokeStyle = "#2b2d42";
    ctx.lineWidth = Math.max(2, r * 0.08);
    const my = r * 0.35;
    if (hit || dizzy || T.mouth === "o") {
      ctx.beginPath(); ctx.ellipse(0, my, r * 0.15, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (T.mouth === "tongue") {
      ctx.beginPath(); ctx.arc(0, my - r * 0.08, r * 0.25, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = "#ff8fab";
      ctx.beginPath(); ctx.ellipse(r * 0.08, my + r * 0.2, r * 0.1, r * 0.13 + Math.sin(time * 10) * r * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    } else if (T.mouth === "teeth") {
      ctx.fillStyle = "#2b2d42";
      rr(-r * 0.32, my - r * 0.1, r * 0.64, r * 0.26, r * 0.1); ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 4; i++) ctx.fillRect(-r * 0.28 + i * r * 0.15, my - r * 0.1, r * 0.1, r * 0.1);
    } else {
      ctx.beginPath(); ctx.arc(0, my - r * 0.1, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    if (T.mustache) mustache(0, my - r * 0.12, r * 0.4);
    // Hats.
    if (T.hat === "helmet") {
      ctx.fillStyle = "#6b705c";
      ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.75, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r * 0.9, -r * 0.6, r * 1.8, r * 0.14);
    } else if (T.hat === "bandana") {
      ctx.fillStyle = "#e63946";
      ctx.fillRect(-r * 0.85, -r * 0.75, r * 1.7, r * 0.25);
      ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.65); ctx.lineTo(-r * 1.3, -r * 0.4 + Math.sin(time * 8) * 3); ctx.lineTo(-r * 1.2, -r * 0.85); ctx.fill();
    } else if (T.hat === "crown") {
      crown(0, -r * 0.8, r * 0.5);
    }
    // A tiny cannon rolling in front.
    if (T.prop === "cannon") {
      circle(-r * 0.75, r * 0.95, r * 0.25, "#6c584c");
      circle(r * 0.75, r * 0.95, r * 0.25, "#6c584c");
      ctx.fillStyle = "#495057";
      rr(-r * 0.6, r * 0.5, r * 1.2, r * 0.6, r * 0.25); ctx.fill();
      rr(-r * 0.22, r * 0.8, r * 0.44, r * 0.7, r * 0.15); ctx.fill();
    }
  }

  function drawTank(T, e, dizzy) {
    const r = T.r;
    const hit = e.flash > 0;
    const body = hit ? "#fff" : T.color;
    const roll = (time * T.speed) % 10;
    // Treads with moving bumps.
    [-1, 1].forEach((side) => {
      ctx.fillStyle = "#3d405b";
      rr(side * r * 0.75 - r * 0.25, -r * 0.95, r * 0.5, r * 1.9, r * 0.2); ctx.fill();
      ctx.fillStyle = "#6c757d";
      for (let y = -r * 0.9 + roll * (r / 20); y < r * 0.9; y += r * 0.3) {
        ctx.fillRect(side * r * 0.75 - r * 0.2, y, r * 0.4, r * 0.08);
      }
    });
    // Hull.
    ctx.fillStyle = body;
    rr(-r * 0.6, -r * 0.8, r * 1.2, r * 1.6, r * 0.25); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    rr(-r * 0.5, r * 0.2, r, r * 0.5, r * 0.15); ctx.fill();
    // Barrel points at you and wiggles.
    ctx.save();
    ctx.rotate(Math.sin(time * 3 + e.seed) * 0.25);
    ctx.fillStyle = hit ? "#fff" : "#495057";
    rr(-r * 0.12, 0, r * 0.24, r * 1.2, r * 0.08); ctx.fill();
    circle(0, r * 1.2, r * 0.16, "#2b2d42");
    ctx.restore();
    // Turret with a face.
    circle(0, -r * 0.1, r * 0.55, hit ? "#fff" : shade(T.color));
    eyes(0, -r * 0.2, r * 0.18, r * 0.24, e.seed, dizzy);
    ctx.strokeStyle = "#2b2d42";
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (T.mustache) mustache(0, r * 0.08, r * 0.3);
    if (T.crown) crown(0, -r * 0.55, r * 0.35);
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.round(v * 0.82));
    return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")";
  }

  function drawEnemy(e, dizzy) {
    const T = ENEMIES[e.type];
    ctx.save();
    ctx.translate(e.x, e.y);
    if (!dizzy) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath(); ctx.ellipse(0, T.r * 1.05, T.r * 0.9, T.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      // Bob while marching, squash when hit.
      if (e.atWall) ctx.translate(0, Math.abs(Math.sin(e.bash * 10)) * T.r * 0.2);
      else ctx.translate(0, T.tank ? 0 : -Math.abs(Math.sin(time * 8 + e.seed)) * T.r * 0.12);
      const sq = e.flash > 0 ? 0.18 : 0;
      ctx.scale(1 + sq, 1 - sq);
    } else {
      ctx.rotate(e.rot);
    }
    if (T.tank) drawTank(T, e, dizzy); else drawPerson(T, e, dizzy);
    ctx.restore();
  }

  function lifeBar(x, y, w, ratio, shown) {
    ctx.fillStyle = "#2b2d42";
    rr(x - w / 2 - 2, y - 2, w + 4, 10, 5); ctx.fill();
    ctx.fillStyle = "#fff3b0";
    rr(x - w / 2, y, w * Math.max(0, shown), 6, 3); ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? "#6bcb77" : ratio > 0.25 ? "#ffd93d" : "#ff6b6b";
    if (ratio > 0) { rr(x - w / 2, y, w * ratio, 6, 3); ctx.fill(); }
  }

  // ---------- Your army ----------

  function drawSoldier(x, y, hero, kick, tier) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.3, 1.3);
    const bob = Math.abs(Math.sin(time * 9 + x * 0.1)) * 2;
    ctx.translate(0, -bob + (kick || 0) * 2);
    // Seen from behind: backpack, body, helmet. The hero wears a red cape.
    if (hero) {
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(12 + Math.sin(time * 10) * 2, 14); ctx.lineTo(-12, 14); ctx.fill();
    }
    circle(0, 0, hero ? 11 : 9, "#4d96ff");
    ctx.fillStyle = "#7b5e3b";
    rr(-5, -2, 10, 9, 3); ctx.fill();
    circle(0, -8, hero ? 8 : 7, "#2a9d8f");
    ctx.fillStyle = "#21867a";
    ctx.fillRect(hero ? -9 : -8, -9, hero ? 18 : 16, 3);
    weaponIcon(tier, 10, -6, 9);
    ctx.restore();
  }

  // One unit of your army: a soldier holding the weapon, or the machine itself.
  function drawUnit(x, y, hero, kick, tier) {
    if (!WEAPONS[tier].vehicle) return drawSoldier(x, y, hero, kick, tier);
    const bob = Math.sin(time * 6 + x * 0.1) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    weaponIcon(tier, x, y - 2 + bob + kick * 3, 20);
  }

  // Small drawings for each weapon: used in hands, on doors, and as the bullets.
  function weaponIcon(tier, x, y, s, spin) {
    ctx.save();
    ctx.translate(x, y);
    if (spin) ctx.rotate(spin);
    switch (tier) {
      case 0: circle(0, 0, s * 0.55, "#8d99ae"); circle(-s * 0.15, -s * 0.15, s * 0.18, "#c0c7d1"); break;
      case 1:
        ctx.fillStyle = "#8b5a2b"; ctx.fillRect(-s * 0.1, -s * 0.9, s * 0.2, s * 1.8);
        ctx.fillStyle = "#adb5bd";
        ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.quadraticCurveTo(s * 0.9, -s * 0.8, s * 0.7, -s * 0.1); ctx.lineTo(0, -s * 0.3); ctx.fill();
        break;
      case 2:
        ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = s * 0.18;
        ctx.beginPath(); ctx.arc(-s * 0.3, 0, s * 0.9, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s * 0.3 + Math.cos(-1.2) * s * 0.9, Math.sin(-1.2) * s * 0.9);
        ctx.lineTo(-s * 0.3 + Math.cos(1.2) * s * 0.9, Math.sin(1.2) * s * 0.9); ctx.stroke();
        break;
      case 3: case 4: {
        const one = (ox) => {
          ctx.fillStyle = "#4d96ff"; rr(ox - s * 0.25, -s * 0.9, s * 0.5, s * 1.3, s * 0.15); ctx.fill();
          ctx.fillStyle = "#ff9f1c"; ctx.fillRect(ox - s * 0.25, -s * 1.05, s * 0.5, s * 0.25);
          ctx.fillStyle = "#3d405b"; ctx.fillRect(ox - s * 0.2, s * 0.2, s * 0.4, s * 0.6);
        };
        if (tier === 3) one(0); else { one(-s * 0.35); one(s * 0.35); }
        break;
      }
      case 5:
        circle(-s * 0.5, s * 0.5, s * 0.35, "#6c584c"); circle(s * 0.5, s * 0.5, s * 0.35, "#6c584c");
        ctx.fillStyle = "#343a40"; rr(-s * 0.35, -s, s * 0.7, s * 1.5, s * 0.3); ctx.fill();
        break;
      case 6:
        ctx.fillStyle = "#495057";
        for (let i = -1; i <= 1; i++) ctx.fillRect(i * s * 0.3 - s * 0.1, -s, s * 0.2, s * 1.4);
        ctx.fillStyle = "#ffd93d"; rr(-s * 0.55, s * 0.1, s * 1.1, s * 0.6, s * 0.2); ctx.fill();
        break;
      case 7:
        ctx.fillStyle = "#3d405b"; ctx.fillRect(-s * 0.8, -s * 0.6, s * 0.3, s * 1.3); ctx.fillRect(s * 0.5, -s * 0.6, s * 0.3, s * 1.3);
        ctx.fillStyle = "#2a9d8f"; rr(-s * 0.55, -s * 0.5, s * 1.1, s * 1.1, s * 0.2); ctx.fill();
        ctx.fillStyle = "#21867a"; ctx.fillRect(-s * 0.1, -s * 1.1, s * 0.2, s * 0.8);
        circle(0, 0, s * 0.35, "#21867a");
        break;
      case 8:
        ctx.fillStyle = "#ff6b6b"; rr(-s * 0.25, -s * 0.7, s * 0.5, s * 1.3, s * 0.25); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.55); ctx.lineTo(0, -s * 1.1); ctx.lineTo(s * 0.25, -s * 0.55); ctx.fill();
        ctx.fillStyle = "#4d96ff"; ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.3); ctx.lineTo(-s * 0.55, s * 0.7); ctx.lineTo(-s * 0.25, s * 0.6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.3); ctx.lineTo(s * 0.55, s * 0.7); ctx.lineTo(s * 0.25, s * 0.6); ctx.fill();
        break;
      case 9:
        ctx.fillStyle = "#e9ecef"; rr(-s * 0.18, -s, s * 0.36, s * 1.9, s * 0.18); ctx.fill();
        ctx.fillStyle = "#4d96ff";
        ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(-s, s * 0.1); ctx.lineTo(-s, s * 0.3); ctx.lineTo(s, s * 0.3); ctx.lineTo(s, s * 0.1); ctx.fill();
        ctx.fillRect(-s * 0.4, s * 0.7, s * 0.8, s * 0.18);
        circle(0, -s * 0.65, s * 0.12, "#90e0ef");
        break;
      case 10:
        ctx.fillStyle = "#4d96ff"; ctx.fillRect(-s * 1.1, -s * 0.3, s * 0.7, s * 0.6); ctx.fillRect(s * 0.4, -s * 0.3, s * 0.7, s * 0.6);
        ctx.fillStyle = "#adb5bd"; rr(-s * 0.4, -s * 0.45, s * 0.8, s * 0.9, s * 0.2); ctx.fill();
        circle(0, -s * 0.6, s * 0.2, "#ff6b6b");
        break;
      case 11:
        circle(0, 0, s * 0.8, "#2b2d42");
        ctx.fillStyle = "#ffd93d";
        for (let i = 0; i < 3; i++) {
          const a = time * 3 + i * (Math.PI * 2 / 3);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.6, a, a + 0.8); ctx.fill();
        }
        circle(0, 0, s * 0.15, "#ffd93d");
        ctx.strokeStyle = "#e09f00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.quadraticCurveTo(s * 0.3, -s * 1.2, s * 0.1, -s * 1.4); ctx.stroke();
        circle(s * 0.1, -s * 1.4, 2 + Math.random() * 2, "#ff9f1c");
        break;
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const kind = b.kind;
    if (kind === "stone") return weaponIcon(0, b.x, b.y, 9);
    if (kind === "axe") return weaponIcon(1, b.x, b.y, 10, b.age * 18);
    if (kind === "arrow") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 22); ctx.stroke();
      ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.moveTo(b.x - 5, b.y + 2); ctx.lineTo(b.x, b.y - 7); ctx.lineTo(b.x + 5, b.y + 2); ctx.fill();
      ctx.fillStyle = "#ff6b6b"; ctx.fillRect(b.x - 4, b.y + 18, 8, 5);
      return;
    }
    if (kind === "dart") {
      ctx.fillStyle = "#ff9f1c"; rr(b.x - 3, b.y - 6, 6, 14, 3); ctx.fill();
      circle(b.x, b.y - 6, 3.5, "#4d96ff");
      return;
    }
    if (kind === "pellet") { ctx.fillStyle = "#ffd93d"; rr(b.x - 2.5, b.y - 7, 5, 14, 2.5); ctx.fill(); return; }
    if (kind === "ball") { circle(b.x, b.y, 10, "#2b2d42"); circle(b.x - 3, b.y - 3, 3, "#6c757d"); return; }
    if (kind === "shell") { ctx.fillStyle = "#e09f00"; rr(b.x - 6, b.y - 12, 12, 22, 6); ctx.fill(); return; }
    if (kind === "missile") {
      circle(b.x, b.y + 16, 5 + Math.random() * 3, "#ff9f1c");
      return weaponIcon(8, b.x, b.y, 12);
    }
    if (kind === "plane") return weaponIcon(9, b.x, b.y, 16);
    if (kind === "laser") {
      ctx.strokeStyle = "rgba(0, 220, 255, 0.5)"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 70); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 70); ctx.stroke();
      return;
    }
    if (kind === "bomb") return weaponIcon(11, b.x, b.y, 18, Math.sin(b.age * 10) * 0.3);
  }

  // ---------- Doors ----------

  function drawDoor(p, d) {
    const x = d.x0, y = p.y, w = d.x1 - d.x0, h = p.h;
    ctx.save();
    ctx.globalAlpha = d.fade ? Math.max(0, 1 - d.fade * 2) : 1;
    const shake = d.flash ? (Math.random() - 0.5) * 4 : 0;
    ctx.translate(shake, 0);
    const weapon = d.kind === "weapon";
    if (d.kind === "barrier") {
      drawBarrier(d, x, y, w, h);
      ctx.restore();
      return;
    }
    // Frame + panel.
    ctx.fillStyle = "#7f5539";
    rr(x - 6, y - 6, w + 12, h + 12, 12); ctx.fill();
    const colors = { weapon: "#ffd166", army: "#90e0ef", wall: "#f4c7a1", shield: "#cdb4ff" };
    ctx.fillStyle = d.flash ? "#fff" : colors[d.kind];
    rr(x, y, w, h, 8); ctx.fill();
    circle(x + w - 12, y + h / 2 - 6, 4, "#7f5539");
    if (d.broken) {
      ctx.fillStyle = "#2b2d42";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("OPEN!"), x + w / 2, y + h / 2 + 8);
      ctx.restore();
      return;
    }
    // What is behind the door.
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b2d42";
    if (weapon) {
      weaponIcon(d.tier, x + 34, y + 34, 20);
      ctx.font = "bold 20px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.textAlign = "left";
      wrapText(WEAPONS[d.tier].name, x + 64, y + 30, w - 84);
    } else if (d.kind === "army") {
      drawUnit(x + 32, y + 38, false, 0, g.tier);
      ctx.font = "bold 34px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.fillStyle = "#2b2d42";
      ctx.textAlign = "left";
      ctx.fillText("+" + d.amount, x + 62, y + 48);
    } else {
      ctx.font = "34px sans-serif";
      ctx.fillStyle = "#000";
      ctx.fillText(d.kind === "wall" ? "🧱" : "🛡️", x + 32, y + 46);
      ctx.font = "bold 20px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.textAlign = "left";
      wrapText(t(d.kind === "wall" ? "Bigger wall" : "Shield"), x + 64, y + 30, w - 84);
    }
    // How much it still needs.
    const left = Math.max(0, d.hp / d.maxHp);
    lifeBar(x + w / 2 - 18, y + h - 15, w - 56, left, left);
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#2b2d42";
    ctx.fillText(fmt(Math.max(0, d.hp)), x + w - 6, y + h - 6);
    ctx.restore();
  }

  // A tough grey wall where a box is missing: it blocks your shots until you smash it.
  function drawBarrier(d, x, y, w, h) {
    ctx.fillStyle = d.flash ? "#fff" : "#8d99ae";
    rr(x - 4, y, w + 8, h, 6); ctx.fill();
    ctx.strokeStyle = "#5c677d"; ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const by = y + row * (h / 4);
      ctx.beginPath(); ctx.moveTo(x - 4, by); ctx.lineTo(x + w + 4, by); ctx.stroke();
      for (let bx = x + (row % 2 ? 20 : 0); bx < x + w; bx += 40) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + h / 4); ctx.stroke();
      }
    }
    const left = Math.max(0, d.hp / d.maxHp);
    lifeBar(x + w / 2 - 18, y + h - 15, w - 56, left, left);
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.fillText(fmt(Math.max(0, d.hp)), x + w - 6, y + h - 6);
  }

  // Breaks between words, or between any two characters for Chinese (no spaces).
  function wrapText(text, x, y, maxW) {
    const sep = text.includes(" ") ? " " : "";
    const words = sep ? text.split(" ") : Array.from(text);
    let line = "";
    words.forEach((word) => {
      const test = line ? line + sep + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += 19;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, x, y);
  }

  // ---------- Scene ----------

  function drawField() {
    const v = view;
    // A meadow all around, and the field reaches past the edges of the screen, as in Army Rush 3D.
    ctx.fillStyle = "#74c69d";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const top = Math.min(0, v.y0), bottom = Math.max(H, v.y1);
    ctx.fillStyle = "#95d5b2";
    ctx.fillRect(-20, top, W + 40, bottom - top);
    // Stripes scroll toward you, like the army is running up.
    ctx.fillStyle = "#a7e0c0";
    const off = (time * 40) % 80;
    for (let y = off - 80 * Math.ceil((off - top) / 80); y < bottom; y += 80) ctx.fillRect(-20, y, W + 40, 40);
    if (v.x0 < 0 || v.x1 > W) drawSides();
    // Little flowers.
    for (let i = 0; i < 10; i++) {
      const fx = (i * 97) % W + 10;
      const fy = ((i * 173 + time * 40) % (H + 40)) - 20;
      circle(fx, fy, 4, i % 2 ? "#fff" : "#ffd93d");
    }
    // Sandbag wall: it gets cracks as it gets hurt, and only rubble is left once it breaks.
    const health = g.wall / g.wallMax;
    for (let x = 0, i = 0; x < W + 30; x += 34, i++) {
      if (g.wall <= 0) {
        circle(x + 6, WALL_Y + 4, 6, "#c8a27a");
        circle(x + 20, WALL_Y + 6, 4, "#a47148");
        continue;
      }
      ctx.fillStyle = "#d4a373";
      rr(x - 4, WALL_Y - 8, 34, 16, 8); ctx.fill();
      ctx.strokeStyle = "#a47148"; ctx.lineWidth = 2; ctx.stroke();
      if (health < 0.7 && (i * 7) % 3 === 0 || health < 0.35 && i % 2) {
        ctx.beginPath(); ctx.moveTo(x + 6, WALL_Y - 6); ctx.lineTo(x + 12, WALL_Y); ctx.lineTo(x + 8, WALL_Y + 6); ctx.stroke();
      }
    }
    if (g.wall > 0) {
      ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#000";
      ctx.fillText("🧱", 8, WALL_Y + 6);
      lifeBar(W / 2 - 50, WALL_Y - 3, W - 160, health, health);
    }
  }

  // Beside the field, as in Army Rush 3D: a fence, a row of trees and streaks of wind, all
  // rolling toward you.
  function drawSides() {
    const v = view;
    const top = Math.min(0, v.y0) - 120, bottom = Math.max(H, v.y1) + 120;
    [-1, 1].forEach((side) => {
      const edge = side < 0 ? 0 : W;
      // Fence: posts with a rail.
      const px = edge + side * 18;
      ctx.fillStyle = "#e9c46a";
      ctx.fillRect(px - 2, top, 4, bottom - top);
      ctx.fillStyle = "#d4a373";
      for (let y = top + (time * 40) % 60; y < bottom; y += 60) { rr(px - 4, y - 4, 8, 8, 2); ctx.fill(); }
      // Wind streaks.
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let i = 0; i < 7; i++) {
        const x = edge + side * (6 + ((i * 29) % 50));
        const y = top + ((i * 157 + time * 104) % (bottom - top));
        ctx.fillRect(x - 1, y, 2, 60 + (i % 3) * 30);
      }
      // Trees: one row near the fence, and a few further out. Tree n always looks the same.
      for (let row = 0; row < 2; row++) {
        const gap = row ? 210 : 140;
        const shift = time * 40 + (side > 0 ? gap / 2 : 0) + row * 50;
        for (let n = Math.floor((top - shift) / gap); n * gap + shift < bottom + 80; n++) {
          const k = ((n * 7 + row * 3 + (side > 0 ? 5 : 0)) % 10 + 10) % 10;
          const x = edge + side * (row ? 190 + k * 11 : 70 + ((k * 53) % 60));
          if (side < 0 ? x < v.x0 - 60 : x > v.x1 + 60) continue;
          drawTree(x, n * gap + shift, 0.8 + ((k * 37) % 10) / 20, k % 3 ? "#52b788" : "#40916c");
        }
      }
    });
  }

  function drawTree(x, y, s, color) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.beginPath(); ctx.ellipse(x, y + 2, 22 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(x - 4 * s, y - 24 * s, 8 * s, 26 * s);
    circle(x, y - 40 * s, 24 * s, color);
    circle(x + 9 * s, y - 56 * s, 16 * s, "#52b788");
  }

  // On a tall screen the field runs on into the haze above it, so the enemies fade in from far away.
  function drawHaze() {
    const v = view;
    if (v.y0 >= 0) return;
    const fade = Math.min(90, -v.y0);
    const grad = ctx.createLinearGradient(0, -fade, 0, 0);
    grad.addColorStop(0, "rgba(189, 224, 254, 1)");
    grad.addColorStop(1, "rgba(189, 224, 254, 0)");
    ctx.fillStyle = "#bde0fe";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, -fade - v.y0);
    ctx.fillStyle = grad;
    ctx.fillRect(v.x0, -fade, v.x1 - v.x0, fade);
  }

  // A tower from your city, standing on the wall with your weapon on top.
  function drawTower(s) {
    const x = s.x, y = s.y;
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 10, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#adb5bd"; rr(x - 13, y - 34, 26, 44, 4); ctx.fill();
    ctx.strokeStyle = "#6c757d"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#adb5bd";
    for (let k = 0; k < 3; k++) ctx.fillRect(x - 13 + k * 10, y - 40, 6, 7);
    ctx.fillStyle = "#2b2d42"; rr(x - 4, y - 22, 8, 12, 4); ctx.fill();
    weaponIcon(s.tier, x, y - 48, 9);
    lifeBar(x, y - 66, 30, s.hp / s.max, s.hp / s.max); // its own life: the enemy goes for it first
  }

  // Your life gauge along the bottom.
  function drawLife() {
    ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#000";
    ctx.fillText("❤️", 8, H - 6);
    const r = Math.max(0, g.life / 100);
    lifeBar(W / 2 - 50, H - 18, W - 160, r, r);
  }

  function drawShield() {
    if (g.shield <= 0 || (g.shield < 2 && Math.floor(time * 8) % 2)) return;
    const top = (g.wall > 0 ? WALL_Y : SQUAD_Y) - 40;
    ctx.fillStyle = "rgba(144, 224, 239, 0.35)";
    ctx.strokeStyle = "rgba(77, 150, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, top + 40);
    ctx.quadraticCurveTo(W / 2, top - 20, W, top + 40);
    ctx.lineTo(W, top + 48); ctx.lineTo(0, top + 48);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Things the enemy throws at you.
  function drawShot(s) {
    if (s.kind === "stone" || s.kind === "rock") {
      const r = s.kind === "rock" ? 10 : 6;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.age * 8);
      circle(0, 0, r, "#8d99ae"); circle(-r * 0.3, -r * 0.3, r * 0.3, "#c0c7d1");
      ctx.restore();
    } else if (s.kind === "cork") {
      ctx.fillStyle = "#c08552"; rr(s.x - 4, s.y - 6, 8, 12, 3); ctx.fill();
    } else if (s.kind === "ball") {
      circle(s.x, s.y, 8, "#2b2d42"); circle(s.x - 2, s.y - 2, 2.5, "#6c757d");
    } else {
      const big = s.kind === "bigshell";
      circle(s.x, s.y - (big ? 14 : 10), 4 + Math.random() * 3, "#ff9f1c");
      ctx.fillStyle = big ? "#9d0208" : "#6c584c";
      rr(s.x - (big ? 7 : 5), s.y - (big ? 10 : 7), big ? 14 : 10, big ? 22 : 16, big ? 7 : 5); ctx.fill();
    }
  }

  function drawFx(only) {
    g.fx.forEach((f) => {
      if (only && f.type !== only) return;
      const k = f.t / f.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (f.type === "puff") circle(f.x, f.y, f.r * (1 + k), "#fff");
      else if (f.type === "star") star(f.x, f.y, 7, f.color);
      else if (f.type === "pow") star(f.x, f.y, 6 + k * 10, "#ffd93d");
      else if (f.type === "boom") {
        circle(f.x, f.y, f.r * (0.4 + k * 0.8), "#ff9f1c");
        circle(f.x, f.y, f.r * (0.25 + k * 0.6), "#ffd93d");
        circle(f.x, f.y, f.r * k * 0.4, "#fff");
      } else if (f.type === "confetti") {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 8);
        ctx.fillStyle = f.color; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
      } else if (f.type === "text") {
        ctx.font = "bold " + Math.round(f.size) + "px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 5; ctx.strokeStyle = "#2b2d42";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      }
    });
    ctx.globalAlpha = 1;
  }

  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }

  function bigText(lines, y) {
    ctx.textAlign = "center";
    lines.forEach(([text, size, color], i) => {
      ctx.font = "bold " + size + "px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.lineWidth = 6; ctx.strokeStyle = "#2b2d42";
      ctx.strokeText(text, W / 2, y, W - 20);
      ctx.fillStyle = color || "#fff";
      ctx.fillText(text, W / 2, y, W - 20);
      y += size + 14;
    });
  }

  function draw() {
    ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
    const all = [view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0];
    el.menu.hidden = state === "playing";
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * g.shake, (Math.random() - 0.5) * 12 * g.shake);
    drawField();
    city.towerSpots().forEach(drawTower);

    g.doors.forEach((p) => p.list.forEach((d) => drawDoor(p, d)));

    // Enemies, the ones in front drawn last.
    const sorted = g.enemies.slice().sort((a, b) => a.y - b.y);
    sorted.forEach((e) => drawEnemy(e));
    sorted.forEach((e) => {
      const T = ENEMIES[e.type];
      const bw = Math.max(36, T.r * 1.8);
      const boss = T.r >= 40;
      // Keep the life bar on screen, even while a big boss is still walking in.
      const by = Math.max(boss ? 22 : 4, e.y - T.r - (T.hat === "crown" || T.crown ? T.r * 0.6 : 0) - 16);
      lifeBar(e.x, by, bw, e.hp / e.maxHp, e.shownHp / e.maxHp);
      if (boss) {
        ctx.font = "bold 15px 'Comic Sans MS', 'Chalkboard SE', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 4; ctx.strokeStyle = "#fff";
        ctx.strokeText(T.name, e.x, by - 6);
        ctx.fillStyle = "#2b2d42"; ctx.fillText(T.name, e.x, by - 6);
      }
    });

    g.bullets.forEach((b) => {
      if (!b.vx) return drawBullet(b);
      // Tower shots fly at an angle.
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vx, -b.vy)); ctx.translate(-b.x, -b.y);
      drawBullet(b);
      ctx.restore();
    });
    g.shots.forEach(drawShot);

    squadSpots().forEach((s) => drawUnit(s.x, s.y, s.i === 0, g.kick > 0 ? 1 : 0, g.tier));
    drawShield();
    drawLife();

    g.tumblers.forEach((t) => drawEnemy({ type: t.type, x: t.x, y: t.y, rot: t.rot, seed: t.seed, flash: 0 }, true));

    drawFx();
    drawHaze();
    ctx.restore();

    if (g.hurt > 0) {
      ctx.fillStyle = "rgba(255, 107, 107, " + g.hurt * 0.6 + ")";
      ctx.fillRect(...all);
    }

    if (state === "playing" && g.banner && g.banner.t > 0) {
      ctx.globalAlpha = Math.min(1, g.banner.t * 2);
      // A long message goes on two lines instead of being squeezed.
      const font = (px) => "bold " + px + "px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      let px = 26;
      ctx.font = font(px);
      let lines = [g.banner.text];
      if (ctx.measureText(g.banner.text).width > W - 60) {
        const words = g.banner.text.split(" ");
        let best = null;
        for (let i = 1; i < words.length; i++) {
          const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
          const wide = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
          if (!best || wide < best.wide) best = { lines: [a, b], wide };
        }
        if (best) { lines = best.lines; px = Math.max(16, Math.min(24, Math.floor((24 * (W - 60)) / best.wide))); }
      }
      const boxH = lines.length > 1 ? 88 : 60;
      ctx.fillStyle = "rgba(43, 45, 66, 0.7)";
      rr(20, H * 0.36, W - 40, boxH, 16); ctx.fill();
      ctx.font = font(px);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.36 + (lines.length > 1 ? 36 + i * 32 : 40), W - 60));
      ctx.globalAlpha = 1;
    }

    if (state !== "playing") {
      ctx.fillStyle = "rgba(43, 45, 66, 0.45)";
      ctx.fillRect(...all);
      if (state === "ready") {
        bigText([[t("🪖 Army Rush!"), 44, "#ffd93d"], [t("A silly army is coming!"), 24], [t("Shoot boxes to get"), 24],
          [t("a new weapon 🏹, more of it,"), 24], [t("or a stronger defence 🧱"), 24],
          [t("Level: {name}", { name: LEVELS[level].name }), 24, "#ffd93d"], [t("Tap to start!"), 32, "#6bcb77"]], H * 0.18);
      } else if (state === "over") {
        bigText([[t("Oh no! 😵"), 48, "#ff6b6b"], [t("They got through!"), 28], [t("You reached wave {n}", { n: city.on ? city.round : g.wave + 1 }), 26],
          [t("Tip: open more boxes!"), 24, "#ffd93d"], [t("Tap to try again"), 32, "#6bcb77"]], H * 0.28);
      } else {
        bigText([[t("YOU WIN! 🏆"), 50, "#ffd93d"], [t("The King Tank"), 28], [t("went BOING!"), 28],
          [t("Tap to play again"), 30, "#6bcb77"]], H * 0.32);
      }
      drawFx("confetti");
    }
  }

  // ---------- Fitting the field on the screen ----------

  // The canvas fills the whole screen. The field (W x H) is as big as it can be: on a tall screen
  // it stands just above the ⬅️ ➡️ buttons, under the top bar; on a wide one it fills the height.
  // k is screen pixels per field unit, and x0..x1, y0..y1 is the part of the world on screen.
  const view = { k: 1, ox: 0, oy: 0, x0: 0, y0: 0, x1: W, y1: H };
  const TOP = 56, BOTTOM = 84;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    let s, top;
    if (w / W < h / H) {
      s = Math.min(w / W, (h - TOP - BOTTOM) / H);
      top = Math.max(TOP, h - BOTTOM - H * s);
    } else {
      s = h / H;
      top = 0;
    }
    view.k = s * dpr;
    view.ox = ((w - W * s) / 2) * dpr;
    view.oy = top * dpr;
    view.x0 = -view.ox / view.k;
    view.y0 = -view.oy / view.k;
    view.x1 = (canvas.width - view.ox) / view.k;
    view.y1 = (canvas.height - view.oy) / view.k;
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);

  // ---------- Loop + controls ----------

  let last = 0, acc = 0;
  function loop(now) {
    acc += Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      updateFx(STEP);
      acc -= STEP;
    }
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    if (time - endedAt < 1.2) return;
    newGame();
    state = "playing";
    input.targetX = null;
  }

  function canvasX(e) {
    const rect = canvas.getBoundingClientRect();
    return (((e.clientX - rect.left) / rect.width) * canvas.width - view.ox) / view.k;
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state !== "playing") return start();
    input.dragging = true;
    input.targetX = canvasX(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (input.dragging) input.targetX = canvasX(e);
  });
  const stopDrag = () => { input.dragging = false; };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

  [["left", "left"], ["right", "right"]].forEach(([id, key]) => {
    const btn = document.getElementById(id);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state !== "playing") return start();
      input[key] = true;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, () => { input[key] = false; }));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  document.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { input.left = true; e.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { input.right = true; e.preventDefault(); }
    else if ((k === " " || k === "Enter") && state !== "playing") { e.preventDefault(); start(); }
  });
  document.addEventListener("keyup", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") input.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") input.right = false;
  });

  levelBtns.forEach((btn) => btn.addEventListener("click", () => {
    level = btn.dataset.level;
    levelBtns.forEach((b) => b.setAttribute("aria-pressed", b === btn));
    state = "ready";
    newGame();
    btn.blur();
  }));

  // ?debug lets the test script fast-forward the battle and steer the army.
  if (/[?&]debug/.test(location.search)) {
    window.armyDebug = {
      get g() { return g; }, get state() { return state; }, dps, nextWeapon, WEAPONS, ENEMIES, input, start, city,
      setLevel(l) { level = l; },
      step(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } },
    };
  }

  newGame();
  requestAnimationFrame(loop);
})();
