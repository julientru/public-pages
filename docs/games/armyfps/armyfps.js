// Army Rush FPS: the same battle as Army Rush, seen through your own eyes from behind the wall.
// The rules run on the same flat 480 x 640 field as the 2D game (x across, y down the field
// toward you); Three.js only draws it. You stand in the middle of your army and it shoots
// wherever your cross-hair points. Turn left and right to see the rest of your army beside you.
// Enemies never get hurt for real: they flash, squash, and tumble away with dizzy stars.
(function () {
  const t = I18n.t;
  const W = 480;
  const H = 640;
  const WALL_Y = H - 108;  // sandbag wall: enemies stop and bash it until it breaks
  const SQUAD_Y = H - 72;  // your army
  const STEP = 1 / 60;
  const ZOOM = 1.6;        // shots fly this much faster than in Army Rush, so aiming feels snappy

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
  const PARTY = ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77", "#9b5de5"];
  const FONT = "'Comic Sans MS', 'Chalkboard SE', sans-serif";

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const el = {
    wave: document.getElementById("wave"),
    life: document.getElementById("life"),
    weapon: document.getElementById("weapon"),
    lifeFill: document.getElementById("lifeFill"),
    banner: document.getElementById("banner"),
    hurt: document.getElementById("hurt"),
    screen: document.getElementById("screen"),
    cross: document.getElementById("cross"),
    wallFill: document.getElementById("wallFill"),
    wallGauge: document.getElementById("wallGauge"),
    menu: document.getElementById("menu"),
    gauges: document.querySelector(".gauges"),
  };
  const levelBtns = document.querySelectorAll("[data-level]");

  let g;            // everything about the current battle
  let level = "easy";
  let state = "ready";
  let time = 0;     // seconds, keeps animations going on every screen
  let endedAt = -10; // a short pause after the end, so a stray tap does not restart at once
  // left / right turn the view (buttons or keys), up / down move the cross-hair (keys), aim = where
  // the cross-hair is, from -1 to 1 across and up the view, held = a finger is on the view.
  const input = { left: false, right: false, up: false, down: false, aim: { x: 0, y: 0 }, held: false };

  function newGame() {
    g = {
      wave: 0, spawnQueue: [], spawnIn: 0, breakIn: 2.5, banner: null,
      enemies: [], bullets: [], shots: [], doors: [], doorIn: 4, fx: [], tumblers: [],
      tier: 0, count: 1, missed: new Set(), life: 100, wall: 100, wallMax: 100, shield: 0,
      squadX: W / 2, fireIn: 0.3, shake: 0, hurt: 0, target: { x: W / 2, y: 0 }, targetH: 10, combo: 0, comboT: 0,
    };
    startWave(0);
    syncStats();
  }

  function startWave(i) {
    g.wave = i;
    const wave = WAVES[i];
    g.spawnQueue = [];
    wave.groups.forEach(([type, count]) => { for (let n = 0; n < count; n++) g.spawnQueue.push(type); });
    g.spawnIn = 2.5;
    g.banner = { text: t("Wave {n}: {name}", { n: i + 1, name: wave.name }), t: 2.5 };
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
    el.wave.textContent = g.wave + 1;
    el.life.textContent = Math.max(0, Math.ceil(g.life));
    el.lifeFill.style.width = Math.max(0, Math.min(100, g.life)) + "%";
    el.lifeFill.style.background = g.life > 50 ? "#6bcb77" : g.life > 25 ? "#ffd93d" : "#ff6b6b";
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

  // You (i = 0) stand in the middle; the others take turns on your left and your right.
  function rank(i) {
    return i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
  }

  function squadSpots() {
    const spots = [];
    const gap = unitGap();
    for (let i = 0; i < g.count; i++) spots.push({ x: g.squadX + rank(i) * gap, y: SQUAD_Y, i });
    return spots;
  }

  function squadHalfWidth() {
    return Math.ceil((g.count - 1) / 2) * unitGap() + (WEAPONS[g.tier].vehicle ? 22 : 15);
  }

  // Every soldier shoots at the spot under your cross-hair.
  function fire() {
    const w = WEAPONS[g.tier];
    const multi = w.multi || 1;
    const speed = w.speed * ZOOM;
    squadSpots().forEach((s) => {
      let dx = g.target.x - s.x, dy = g.target.y - (s.y - 16);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      for (let m = 0; m < multi; m++) {
        const off = multi > 1 ? (m - 0.5) * 10 : 0;
        g.bullets.push({ x: s.x - dy * off, y: s.y - 16 + dx * off, vx: dx * speed, vy: dy * speed, dmg: w.dmg, kind: w.kind,
          splash: w.splash || 0, pierce: w.pierce || 0, hit: [], age: 0, you: s.i === 0 });
      }
    });
    g.kick = 0.09;
    g.flash = 0.06;
  }

  function hurtEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.15;
    if (e.hp <= 0) {
      g.enemies.splice(g.enemies.indexOf(e), 1);
      const T = ENEMIES[e.type];
      // Knocked up into the air and back down the field, spinning.
      g.tumblers.push({ type: e.type, x: e.x, y: e.y, h: 0, vx: (Math.random() - 0.5) * 240, vy: -140 - Math.random() * 80,
        vh: 280 + T.r * 1.5, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6), seed: e.seed, t: 0, view: e.view });
      poof(e.x, e.y, T.r, POOF_WORDS[Math.floor(Math.random() * POOF_WORDS.length)]);
      if (T.r > 40) g.shake = 0.4;
      g.shake = Math.max(g.shake, 0.08);
      // Quick knock-outs in a row make a combo.
      g.combo = g.comboT > 0 ? g.combo + 1 : 1;
      g.comboT = 1.2;
      if (g.combo >= 3) say(t("COMBO ×{n}!", { n: g.combo }), e.x, e.y, 22 + Math.min(g.combo, 10) * 2, "#ffd93d", T.r * 2.4 + 50);
      g.hitMark = 0.25;
    } else {
      g.hitMark = Math.max(g.hitMark || 0, 0.12);
    }
  }

  // Effects live on the field too: x and y like everything else, plus h = height above the grass.
  function poof(x, y, r, word) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fx.push({ type: "puff", x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.3, h: r * (0.6 + 0.5 * Math.abs(Math.sin(a))),
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 30, vh: 20, r: r * 0.4, t: 0, life: 0.6 });
    }
    for (let i = 0; i < 4; i++) {
      g.fx.push({ type: "star", x, y, h: r, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 100, vh: 120 + Math.random() * 200,
        grav: 500, t: 0, life: 0.8, color: ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77"][i] });
    }
    if (word) say(word, x, y, 18 + r * 0.3, "#fff", r * 2.4 + 10);
  }

  function say(text, x, y, size, color, h) {
    g.fx.push({ type: "text", text, x, y, h: h === undefined ? 40 : h, vh: 50, t: 0, life: 1.1, size, color });
  }

  function boom(x, y, radius) {
    g.fx.push({ type: "boom", x, y, h: 18, r: radius, t: 0, life: 0.45 });
    if (radius >= 100) {
      say(t("KA-BOOM!"), x, y, 40, "#ffd93d", 90);
      g.shake = 0.35;
    }
  }

  function confetti(cx, cy, n, colors) {
    for (let i = 0; i < n; i++) {
      g.fx.push({ type: "confetti", x: cx + (Math.random() - 0.5) * 120, y: cy + (Math.random() - 0.5) * 30, h: 40,
        vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 120, vh: 150 + Math.random() * 250, grav: 500,
        t: 0, life: 1.4, rot: Math.random() * 6, color: colors[i % colors.length] });
    }
  }

  function breakDoor(pair, door) {
    door.broken = true;
    const cx = (door.x0 + door.x1) / 2;
    const cy = pair.y + pair.h;
    if (door.kind === "barrier") {
      // A wall is not a prize: it just crumbles out of the way.
      door.gone = true;
      confetti(cx, cy, 16, ["#adb5bd", "#6c757d", "#ced4da"]);
      say(t("CRUMBLE!"), cx, cy, 24, "#fff", 100);
      return;
    }
    confetti(cx, cy, 24, PARTY);
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
      say(t("CRASH! The wall broke!"), W / 2, WALL_Y, 28, "#ff6b6b", 60);
    }
  }

  function hurtLife(dmg) {
    g.life -= dmg;
    g.hurt = 0.4;
    g.shake = Math.max(g.shake, 0.25);
    say("-" + Math.ceil(dmg) + " ❤️", g.squadX, WALL_Y - 70, 24, "#ff6b6b", 60);
    syncStats();
    if (g.life <= 0) gameOver();
  }

  function breakThrough(e) {
    const T = ENEMIES[e.type];
    g.enemies.splice(g.enemies.indexOf(e), 1);
    poof(e.x, WALL_Y - 20, T.r, t("Hee hee!"));
    g.leaks = (g.leaks || 0) + 1;
    hurtLife(T.hit * LEVELS[level].hurt);
  }

  function enemyShoot(e) {
    const T = ENEMIES[e.type];
    const s = T.shot;
    g.shots.push({ x: e.x + (T.tank ? 0 : T.r * 0.6), y: e.y + T.r * 0.6, vy: s.kind === "bigshell" ? 190 : 150,
      dmg: s.dmg, kind: s.kind, age: 0, y0: e.y + T.r * 0.6, h0: T.tank ? T.r * 0.75 : T.r * 2.4 });
    e.throwT = 0.3;
  }

  function update(dt) {
    if (state !== "playing") return;
    const w = WEAPONS[g.tier];
    const L = LEVELS[level];

    g.comboT = Math.max(0, g.comboT - dt);

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
        spawnEnemy(g.spawnQueue.shift());
        g.spawnIn = WAVES[g.wave].gap * (0.7 + Math.random() * 0.6);
      }
    } else if (!g.enemies.length) {
      if (g.wave === WAVES.length - 1) return win();
      g.breakIn -= dt;
      if (g.breakIn <= 0) {
        g.breakIn = 2.5;
        startWave(g.wave + 1);
      } else if (!g.banner || g.banner.t <= 0) {
        g.banner = { text: t("Wave {n} done! ⭐", { n: g.wave + 1 }), t: 2.4 };
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
        hurtWall(T.bash * L.hurt * dt);
      } else {
        e.y += T.speed * dt;
        e.x += Math.sin(time * e.wobble + e.seed) * 14 * dt;
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
      s.age += dt;
      const lineY = g.wall > 0 ? WALL_Y - 6 : SQUAD_Y - 12;
      if (s.y < lineY) return;
      const onArmy = Math.abs(s.x - g.squadX) < squadHalfWidth() + 6;
      if (g.wall <= 0 && !onArmy) {
        if (s.y > H + 20) s.dead = true;
        return;
      }
      s.dead = true;
      if (g.shield > 0) {
        say(t("Boing!"), s.x, lineY, 16, "#90e0ef", 50);
        return;
      }
      g.fx.push({ type: "puff", x: s.x, y: lineY, h: 10, vh: 20, r: 8, t: 0, life: 0.4 });
      if (g.wall > 0) hurtWall(s.dmg * L.hurt);
      else hurtLife(s.dmg * L.hurt);
    });
    g.shots = g.shots.filter((s) => !s.dead);
    if (state !== "playing") return;

    // Bullets fly up the field and hit the first thing in their way.
    g.bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
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
            g.fx.push({ type: "pow", x: b.x, y: b.y, h: shotHeight(b.kind), t: 0, life: 0.2 });
          }
          b.hit.push(e);
          if (b.hit.length > b.pierce) { b.dead = true; return; }
        }
      }
      for (const p of g.doors) {
        if (b.y > p.y + p.h || b.y < p.y) continue;
        for (const d of p.list) {
          if (d.gone || d.broken || b.x < d.x0 || b.x > d.x1) continue;
          d.hp -= b.dmg;
          d.flash = 0.1;
          g.hitMark = Math.max(g.hitMark || 0, 0.12);
          if (b.splash) boom(b.x, p.y + p.h, Math.min(60, b.splash));
          else g.fx.push({ type: "pow", x: b.x, y: p.y + p.h, h: shotHeight(b.kind), t: 0, life: 0.2 });
          if (d.hp <= 0) breakDoor(p, d);
          b.dead = true;
          return;
        }
      }
    });
    g.bullets = g.bullets.filter((b) => !b.dead && b.y > -60 && b.y < H + 40 && b.x > -60 && b.x < W + 60);

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
      if (f.vh) f.h += f.vh * dt;
      if (f.grav) {
        f.vh -= f.grav * dt;
        if (f.h < 1) { f.h = 1; f.vh = 0; f.vx *= 0.8; f.vy *= 0.8; }
      }
    });
    g.fx = g.fx.filter((f) => f.t < f.life);
    g.tumblers.forEach((t) => {
      t.t += dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.h += t.vh * dt;
      t.vh -= 700 * dt;
      t.rot += t.vr * dt;
      if (t.h < 0 && t.t > 0.2) {
        t.done = true;
        g.fx.push({ type: "puff", x: t.x, y: t.y, h: 8, vh: 30, r: ENEMIES[t.type].r * 0.8, t: 0, life: 0.5 });
      }
    });
    g.tumblers = g.tumblers.filter((t) => !t.done);
    g.shake = Math.max(0, g.shake - dt);
    g.hurt = Math.max(0, g.hurt - dt);
    g.kick = Math.max(0, (g.kick || 0) - dt);
    g.flash = Math.max(0, (g.flash || 0) - dt);
    g.hitMark = Math.max(0, (g.hitMark || 0) - dt);
    if (g.banner) g.banner.t -= dt;
    if (state === "won" && Math.random() < 0.3) {
      g.fx.push({ type: "confetti", x: Math.random() * W, y: Math.random() * (H - 60), h: 200, vh: -70,
        t: 0, life: 3, rot: Math.random() * 6, color: PARTY[Math.floor(Math.random() * 5)] });
    }
  }

  function gameOver() {
    state = "over";
    endedAt = time;
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  function win() {
    state = "won";
    endedAt = time;
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  // ======================================================================
  // 3D drawing. Field x -> world X (centred), field y -> world Z (you are at +Z),
  // height -> world Y. One field unit is one world unit, except behind the wall,
  // which is squeezed so your army stands right behind the sandbags.
  // ======================================================================

  const BACK = 0.4;
  const SPREAD = 2.2; // your soldiers stand further apart in the picture, so they don't block your view
  const sx = (x) => W / 2 + (x - W / 2) * SPREAD;
  const wx = (x) => x - W / 2;
  const wz = (y) => (y <= WALL_Y ? y : WALL_Y + (y - WALL_Y) * BACK) - H;
  const fieldY = (z) => z + H;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    el.screen.innerHTML = "<div class='big'>😢</div><div>" + t("This device can't show 3D.") + "</div>" +
      "<div><a href='../army/index.html'>" + t("Play Army Rush (2D)") + "</a></div>";
    el.menu.hidden = true;
    return;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const SKY = 0xbde0fe;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 750, 1500);
  const camera = new THREE.PerspectiveCamera(85, 0.75, 1, 3000);
  scene.add(camera); // so your weapon, which hangs on the camera, is drawn

  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-200, 400, 300);
  scene.add(sun);

  // Three tones of light: the flat cartoon look.
  const gradient = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;

  const toonCache = {};
  function mat(color) {
    return toonCache[color] || (toonCache[color] = new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  }
  const basicCache = {};
  function basic(color) {
    return basicCache[color] || (basicCache[color] = new THREE.MeshBasicMaterial({ color }));
  }
  const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function starShape() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rad = i % 2 ? 0.45 : 1;
      if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    return new THREE.ShapeGeometry(s);
  }

  const GEO = {
    sphere: new THREE.SphereGeometry(1, 16, 12),
    ball: new THREE.SphereGeometry(1, 10, 8),
    dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    tube: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true),
    cone: new THREE.ConeGeometry(1, 1, 14),
    plane: new THREE.PlaneGeometry(1, 1),
    barPlane: new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0),
    disc: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    arc: new THREE.TorusGeometry(1, 0.2, 6, 14, Math.PI),
    star: starShape(),
    shield: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
  };

  // A mesh with a size and a place, added to its parent.
  function part(parent, geo, material, size, pos) {
    const m = new THREE.Mesh(GEO[geo], typeof material === "string" ? mat(material) : material);
    if (typeof size === "number") m.scale.setScalar(size); else m.scale.set(size[0], size[1], size[2]);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    parent.add(m);
    return m;
  }

  const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });
  function blob(parent, r) {
    const m = part(parent, "disc", SHADOW, [r, 1, r * 0.8], [0, 0.6, 0]);
    m.renderOrder = 1;
    return m;
  }

  function lighten(hex, k) {
    return "#" + new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHexString();
  }
  function darken(hex, k) {
    return "#" + new THREE.Color(hex).multiplyScalar(k).getHexString();
  }

  // ---------- Text sprites (words that pop up, boss names) ----------

  const textCache = new Map();
  function textTexture(text, color) {
    const key = text + "|" + color;
    if (textCache.has(key)) return textCache.get(key);
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const font = "bold 64px " + FONT;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    c.width = w;
    c.height = 92;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#2b2d42";
    ctx.strokeText(text, w / 2, 48);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const out = { tex, aspect: w / 92 };
    textCache.set(key, out);
    return out;
  }

  function textSprite(text, color, height) {
    const t = textTexture(text, color);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, depthTest: false, transparent: true }));
    sp.scale.set(height * t.aspect, height, 1);
    sp.renderOrder = 40;
    return sp;
  }

  // ---------- Life bars: always face you and draw on top ----------

  const barMat = (color) => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const BAR = { bg: barMat("#2b2d42"), shown: barMat("#fff3b0"), green: barMat("#6bcb77"), yellow: barMat("#ffd93d"), red: barMat("#ff6b6b") };

  function makeBar(w, thick) {
    const t = thick || 7;
    const group = new THREE.Group();
    const bg = part(group, "plane", BAR.bg, [w + 5, t + 5, 1], [0, 0, 0]);
    const shown = part(group, "barPlane", BAR.shown, [w, t, 1], [-w / 2, 0, 0]);
    const fg = part(group, "barPlane", BAR.green, [w, t, 1], [-w / 2, 0, 0]);
    bg.renderOrder = 30; shown.renderOrder = 31; fg.renderOrder = 32;
    return {
      group,
      set(ratio, shownRatio) {
        ratio = Math.max(0, Math.min(1, ratio));
        shownRatio = Math.max(0, Math.min(1, shownRatio));
        fg.visible = ratio > 0;
        if (ratio > 0) fg.scale.x = w * ratio;
        fg.material = ratio > 0.5 ? BAR.green : ratio > 0.25 ? BAR.yellow : BAR.red;
        shown.visible = shownRatio > 0;
        if (shownRatio > 0) shown.scale.x = w * shownRatio;
      },
    };
  }

  // ---------- Silly enemies ----------

  function addEyes(parent, v, y, z, size, gap) {
    [-1, 1].forEach((side) => {
      part(parent, "sphere", "#ffffff", size, [side * gap, y, z]);
      const p = part(parent, "ball", "#2b2d42", size * 0.5, [side * gap, y - size * 0.2, z + size * 0.62]);
      p.userData.base = p.position.clone();
      p.userData.side = side;
      p.userData.size = size;
      v.pupils.push(p);
    });
  }

  // The crown band is an open tube, so it needs an inside too.
  const crownMat = new THREE.MeshToonMaterial({ color: "#ffd93d", gradientMap: gradient, side: THREE.DoubleSide });
  function addCrown(parent, s, y) {
    const c = new THREE.Group();
    c.position.y = y;
    const band = part(c, "tube", crownMat, [s * 0.85, s * 0.55, s * 0.85], [0, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      part(c, "cone", "#ffd93d", [s * 0.2, s * 0.55, s * 0.2], [Math.sin(a) * s * 0.8, s * 0.5, Math.cos(a) * s * 0.8]);
    }
    part(c, "sphere", "#ff6b6b", s * 0.18, [0, 0, s * 0.86]);
    parent.add(c);
    return band;
  }

  function addMustache(parent, s, y, z) {
    [-1, 1].forEach((side) => {
      const m = part(parent, "sphere", "#3d2b1f", [s * 0.55, s * 0.16, s * 0.16], [side * s * 0.45, y, z]);
      m.rotation.z = side * 0.35;
    });
  }

  function buildPerson(T, v) {
    const r = T.r, c = r * 1.15, b = v.body;
    [-1, 1].forEach((side) => {
      const leg = part(b, "sphere", "#3d405b", [r * 0.24, r * 0.32, r * 0.26], [side * r * 0.42, r * 0.3, 0]);
      leg.userData.side = side;
      v.legs.push(leg);
    });
    v.paint.push(part(b, "sphere", T.color, r, [0, c, 0]));
    v.paint.push(part(b, "sphere", lighten(T.color, 0.35), [r * 0.62, r * 0.5, r * 0.3], [0, c - r * 0.42, r * 0.76]));
    addEyes(b, v, c + r * 0.22, r * 0.78, r * 0.27, r * 0.36);
    // Mouth: the normal one, and an "O" for when they get hit.
    const my = c - r * 0.18, mz = r * 0.97;
    v.mouth = new THREE.Group();
    b.add(v.mouth);
    if (T.mouth === "tongue" || T.mouth === "smile") {
      const smile = part(v.mouth, "arc", "#2b2d42", r * 0.22, [0, my + r * 0.05, mz - r * 0.02]);
      smile.rotation.z = Math.PI;
      if (T.mouth === "tongue") v.tongue = part(v.mouth, "sphere", "#ff8fab", [r * 0.1, r * 0.13, r * 0.06], [r * 0.08, my - r * 0.2, mz - r * 0.04]);
    } else if (T.mouth === "teeth") {
      part(v.mouth, "box", "#2b2d42", [r * 0.62, r * 0.24, r * 0.1], [0, my - r * 0.04, mz - r * 0.06]);
      for (let i = 0; i < 4; i++) part(v.mouth, "box", "#ffffff", [r * 0.11, r * 0.1, r * 0.06], [-r * 0.22 + i * r * 0.15, my + r * 0.03, mz]);
    }
    v.mouthO = part(b, "sphere", "#2b2d42", [r * 0.14, r * 0.19, r * 0.06], [0, my - r * 0.04, mz - r * 0.03]);
    if (T.mouth === "o") v.mouth = null; else v.mouthO.visible = false;
    if (T.mustache) addMustache(b, r * 0.45, my + r * 0.12, mz + r * 0.02);
    // Hats.
    let top = c + r;
    if (T.hat === "helmet") {
      part(b, "dome", "#6b705c", r * 0.86, [0, c + r * 0.38, -r * 0.02]);
      part(b, "cyl", "#5b604c", [r * 1.0, r * 0.07, r * 1.0], [0, c + r * 0.38, 0]);
      top += r * 0.25;
    } else if (T.hat === "bandana") {
      part(b, "cyl", "#e63946", [r * 0.86, r * 0.22, r * 0.86], [0, c + r * 0.55, 0]);
      const tail = part(b, "box", "#e63946", [r * 0.12, r * 0.18, r * 0.5], [-r * 0.5, c + r * 0.5, -r * 0.9]);
      tail.rotation.y = 0.5;
      v.tail = tail;
    } else if (T.hat === "crown") {
      addCrown(b, r * 0.5, c + r * 0.92);
      top += r * 0.65;
    }
    // Arm with a prop, swinging toward you when they throw.
    const arm = new THREE.Group();
    arm.position.set(r * 0.88, c - r * 0.1, 0);
    arm.rotation.z = -0.35;
    b.add(arm);
    part(arm, "cyl", T.color, [r * 0.13, r * 0.65, r * 0.13], [0, r * 0.32, 0]);
    if (T.prop === "stone") part(arm, "ball", "#8d99ae", r * 0.28, [0, r * 0.78, 0]);
    if (T.prop === "club") {
      part(arm, "cyl", "#8b5a2b", [r * 0.09, r * 0.75, r * 0.09], [0, r * 0.85, 0]);
      part(arm, "sphere", "#a0522d", r * 0.25, [0, r * 1.25, 0]);
    }
    if (T.prop === "stick") {
      part(arm, "cyl", "#8b5a2b", [r * 0.05, r * 1.05, r * 0.05], [0, r * 0.9, 0]);
      part(arm, "box", "#ff6b6b", [r * 0.04, r * 0.3, r * 0.55], [0, r * 1.25, r * 0.28]);
    }
    v.arm = arm;
    // A tiny cannon rolling in front.
    if (T.prop === "cannon") {
      [-1, 1].forEach((side) => {
        const wheel = part(b, "cyl", "#6c584c", [r * 0.28, r * 0.12, r * 0.28], [side * r * 0.62, r * 0.28, r * 1.1]);
        wheel.rotation.z = Math.PI / 2;
      });
      part(b, "box", "#6c584c", [r * 1.05, r * 0.3, r * 0.5], [0, r * 0.35, r * 1.1]);
      const barrel = part(b, "cyl", "#495057", [r * 0.22, r * 0.9, r * 0.22], [0, r * 0.62, r * 1.25]);
      barrel.rotation.x = Math.PI / 2 - 0.35;
    }
    return top;
  }

  function buildTank(T, v) {
    const r = T.r, b = v.body;
    v.bumps = [];
    [-1, 1].forEach((side) => {
      part(b, "box", "#3d405b", [r * 0.48, r * 0.5, r * 1.9], [side * r * 0.76, r * 0.26, 0]);
      for (let i = 0; i < 5; i++) {
        const bump = part(b, "box", "#6c757d", [r * 0.5, r * 0.08, r * 0.1], [side * r * 0.76, r * 0.52, 0]);
        bump.userData.i = i;
        v.bumps.push(bump);
      }
    });
    v.paint.push(part(b, "box", T.color, [r * 1.15, r * 0.48, r * 1.6], [0, r * 0.48, 0]));
    v.paint.push(part(b, "box", darken(T.color, 0.85), [r * 0.95, r * 0.12, r * 1.3], [0, r * 0.76, 0]));
    const ty = r * 0.95;
    v.paint.push(part(b, "sphere", darken(T.color, 0.82), r * 0.55, [0, ty, 0]));
    // Barrel points at you and wiggles.
    const gun = new THREE.Group();
    gun.position.set(0, ty - r * 0.18, 0);
    b.add(gun);
    const tubeMesh = part(gun, "cyl", "#495057", [r * 0.12, r * 1.25, r * 0.12], [0, 0, r * 0.75]);
    tubeMesh.rotation.x = Math.PI / 2;
    part(gun, "sphere", "#2b2d42", r * 0.16, [0, 0, r * 1.38]);
    v.barrel = gun;
    addEyes(b, v, ty + r * 0.2, r * 0.4, r * 0.18, r * 0.24);
    v.mouthO = part(b, "sphere", "#2b2d42", [r * 0.1, r * 0.12, r * 0.05], [0, ty + r * 0.02, r * 0.53]);
    v.mouthO.visible = false;
    v.mouth = new THREE.Group();
    b.add(v.mouth);
    const smile = part(v.mouth, "arc", "#2b2d42", r * 0.14, [0, ty + r * 0.06, r * 0.52]);
    smile.rotation.z = Math.PI;
    if (T.mustache) addMustache(b, r * 0.32, ty + r * 0.06, r * 0.56);
    let top = ty + r * 0.55;
    if (T.crown) { addCrown(b, r * 0.35, ty + r * 0.48); top += r * 0.45; }
    return top;
  }

  const nameMats = {};
  function makeEnemy(type) {
    const T = ENEMIES[type];
    const root = new THREE.Group();
    const v = { root, body: new THREE.Group(), paint: [], legs: [], pupils: [], flashOn: false };
    blob(root, T.r * 0.95);
    root.add(v.body);
    const top = T.tank ? buildTank(T, v) : buildPerson(T, v);
    v.paint.forEach((m) => { m.userData.mat = m.material; });
    v.bar = makeBar(Math.max(36, T.r * 1.8));
    v.bar.group.position.y = top + 14;
    root.add(v.bar.group);
    if (T.r >= 40) {
      if (!nameMats[type]) nameMats[type] = textSprite(T.name, "#ffffff", 16).material;
      const t = textTexture(T.name, "#ffffff");
      v.label = new THREE.Sprite(nameMats[type]);
      v.label.scale.set(18 * t.aspect, 18, 1);
      v.label.renderOrder = 40;
      v.label.position.y = top + 30;
      root.add(v.label);
    }
    return v;
  }

  function paintFlash(v, on) {
    if (v.flashOn === on) return;
    v.flashOn = on;
    v.paint.forEach((m) => { m.material = on ? FLASH : m.userData.mat; });
    if (v.mouth) { v.mouth.visible = !on; v.mouthO.visible = on; }
  }

  function animateFace(v, seed, r) {
    v.pupils.forEach((p) => {
      const s = p.userData.size;
      p.position.x = p.userData.base.x + Math.sin(time * 9 + seed + p.userData.side) * s * 0.25;
      p.position.y = p.userData.base.y + Math.cos(time * 7 + seed) * s * 0.2;
    });
    if (v.tongue) v.tongue.scale.y = r * (0.13 + Math.sin(time * 10) * 0.03);
    if (v.tail) v.tail.rotation.y = 0.5 + Math.sin(time * 8) * 0.3;
  }

  function updateEnemy(e, v) {
    const T = ENEMIES[e.type], r = T.r;
    v.root.position.set(wx(e.x), 0, wz(e.y) - e.flash * 30);
    // Bob while marching, hop while bashing, squash when hit.
    let lift = 0;
    if (e.atWall) lift = Math.abs(Math.sin(e.bash * 10)) * r * 0.2;
    else if (!T.tank) lift = Math.abs(Math.sin(time * 8 + e.seed)) * r * 0.12;
    v.body.position.y = lift;
    const sq = e.flash > 0 ? 0.18 : 0;
    v.body.scale.set(1 + sq, 1 - sq, 1 + sq);
    paintFlash(v, e.flash > 0);
    animateFace(v, e.seed, r);
    v.legs.forEach((leg) => {
      leg.position.y = r * 0.3 + Math.max(0, Math.sin(time * 8 + e.seed + (leg.userData.side > 0 ? Math.PI : 0))) * r * 0.18;
    });
    if (v.arm) {
      const swing = e.throwT > 0 ? 1.4 - e.throwT * 6 : Math.sin(time * 4 + e.seed) * 0.6;
      v.arm.rotation.x = -0.5 + swing;
    }
    if (v.barrel) v.barrel.rotation.y = Math.sin(time * 3 + e.seed) * 0.25;
    if (v.bumps) {
      const roll = ((time * T.speed) / (r * 0.4)) % 1;
      v.bumps.forEach((b) => { b.position.z = r * 0.85 - ((b.userData.i + roll) / 5) * r * 1.7; });
    }
    v.bar.set(e.hp / e.maxHp, e.shownHp / e.maxHp);
    v.bar.group.quaternion.copy(camera.quaternion);
  }

  const STAR_MAT = new THREE.MeshBasicMaterial({ color: "#ffd93d", side: THREE.DoubleSide });
  // Defeated enemies fly away spinning with stars around their head.
  function updateTumbler(t, v) {
    if (!v.dizzy) {
      v.dizzy = true;
      v.bar.group.visible = false;
      if (v.label) v.label.visible = false;
      paintFlash(v, false);
      v.body.scale.set(1, 1, 1);
      v.pupils.forEach((p) => { p.scale.multiplyScalar(0.45); });
      if (v.mouth) { v.mouth.visible = false; v.mouthO.visible = true; }
      const T = ENEMIES[t.type];
      v.stars = new THREE.Group();
      v.stars.position.y = T.r * (T.tank ? 1.6 : 2.4);
      for (let i = 0; i < 3; i++) {
        const s = part(v.stars, "star", STAR_MAT, T.r * 0.22, [Math.cos(i * 2.1) * T.r * 0.6, 0, Math.sin(i * 2.1) * T.r * 0.6]);
        s.rotation.x = -Math.PI / 2;
      }
      v.body.add(v.stars);
      v.root.children[0].visible = false; // no shadow in the air
    }
    v.root.position.set(wx(t.x), Math.max(0, t.h), wz(t.y));
    v.body.rotation.z = t.rot;
    v.body.rotation.x = t.rot * 0.4;
    v.body.scale.setScalar(Math.max(0.35, 1 - t.t * 0.5)); // shrinks away into the distance
    v.stars.rotation.y = time * 8;
    animateFace(v, t.seed, ENEMIES[t.type].r);
  }

  // ---------- Your army ----------

  // What a soldier holds. Each faces away from you (toward -Z).
  function makeHeld(tier) {
    const h = new THREE.Group();
    const pistol = (x) => {
      part(h, "box", "#4d96ff", [4.5, 5, 12], [x, 0, -3]);
      part(h, "box", "#ff9f1c", [4.6, 5.1, 3], [x, 0, -10]);
      part(h, "box", "#3d405b", [3.5, 7, 3.5], [x, -4, 1]);
    };
    switch (tier) {
      case 0: part(h, "ball", "#8d99ae", 5, [0, 0, 0]); break;
      case 1:
        part(h, "cyl", "#8b5a2b", [1.2, 20, 1.2], [0, 4, 0]);
        part(h, "box", "#adb5bd", [9, 8, 1.6], [4.5, 11, 0]);
        break;
      case 2: {
        const bow = new THREE.Group();
        const arc = part(bow, "arc", "#8b5a2b", 10, [0, 0, 0]);
        arc.rotation.set(0, Math.PI / 2, -Math.PI / 2);
        part(bow, "cyl", "#ffffff", [0.4, 20, 0.4], [0, 0, 0]);
        h.add(bow);
        h.position.y += 3;
        break;
      }
      case 3: pistol(0); break;
      case 4: pistol(-3.5); pistol(3.5); break;
      case 6:
        for (let i = 0; i < 3; i++) {
          const t = part(h, "cyl", "#495057", [1.4, 18, 1.4], [Math.cos(i * 2.1) * 2.6, Math.sin(i * 2.1) * 2.6, -8]);
          t.rotation.x = Math.PI / 2;
        }
        part(h, "box", "#ffd93d", [12, 8, 9], [0, -1, 3]);
        break;
      case 8: {
        h.position.set(-2, 14, 0);
        const tube = part(h, "cyl", "#ff6b6b", [3.6, 18, 3.6], [0, 0, -2]);
        tube.rotation.x = Math.PI / 2;
        const nose = part(h, "cone", "#ffffff", [3.6, 6, 3.6], [0, 0, -14]);
        nose.rotation.x = -Math.PI / 2;
        part(h, "box", "#4d96ff", [11, 1.2, 4], [0, 0, 6]);
        break;
      }
    }
    return h;
  }

  function makeSoldier(tier, hero) {
    const u = new THREE.Group();
    const k = hero ? 1.15 : 1;
    blob(u, 14 * k);
    const body = new THREE.Group();
    u.add(body);
    [-1, 1].forEach((side) => part(body, "sphere", "#3d405b", [3.2 * k, 4 * k, 3.4 * k], [side * 5 * k, 3.5, 0]));
    const br = 11 * k, by = 4 + br;
    part(body, "sphere", "#4d96ff", br, [0, by, 0]);
    part(body, "box", "#7b5e3b", [12 * k, 12 * k, 6], [0, by + 1, br * 0.82]);
    part(body, "box", "#5e4529", [12.4 * k, 2, 6.4], [0, by + 4, br * 0.82]);
    part(body, "sphere", "#f1c27d", 7.5 * k, [0, by + br + 3, 0]);
    part(body, "dome", "#2a9d8f", 8.6 * k, [0, by + br + 4, 0.5]);
    part(body, "cyl", "#21867a", [9.6 * k, 1.4, 9.6 * k], [0, by + br + 4, 0.5]);
    if (hero) {
      const cape = new THREE.Mesh(GEO.plane, capeMat);
      cape.scale.set(20, 24, 1);
      cape.position.set(0, by - 2, br + 3.5);
      cape.rotation.x = 0.2;
      body.add(cape);
      u.userData.cape = cape;
    }
    const held = makeHeld(tier);
    held.position.x += 13 * k;
    held.position.y += by;
    held.position.z += -3;
    body.add(held);
    u.userData.body = body;
    return u;
  }
  const capeMat = new THREE.MeshToonMaterial({ color: "#ff6b6b", gradientMap: gradient, side: THREE.DoubleSide });

  // The machines: cannon, tank, plane, satellite and mega bomb.
  function makeVehicle(tier) {
    const u = new THREE.Group();
    const body = new THREE.Group();
    u.add(body);
    u.userData.body = body;
    if (tier === 5) {
      blob(u, 20);
      [-1, 1].forEach((side) => {
        const w = part(body, "cyl", "#6c584c", [8, 3.5, 8], [side * 11, 8, 3]);
        w.rotation.z = Math.PI / 2;
        part(body, "cyl", "#ffd93d", [2.5, 3.8, 2.5], [side * 11, 8, 3]).rotation.z = Math.PI / 2;
      });
      part(body, "box", "#7f5539", [16, 6, 18], [0, 8, 4]);
      const barrel = part(body, "cyl", "#343a40", [6.5, 30, 6.5], [0, 15, -6]);
      barrel.rotation.x = Math.PI / 2 - 0.3;
      part(body, "sphere", "#343a40", 7.5, [0, 11, 8]);
    } else if (tier === 7) {
      blob(u, 22);
      [-1, 1].forEach((side) => part(body, "box", "#3d405b", [7, 9, 30], [side * 13, 4.5, 0]));
      part(body, "box", "#2a9d8f", [20, 10, 24], [0, 10, 0]);
      part(body, "sphere", "#21867a", 9, [0, 17, 2]);
      const gun = part(body, "cyl", "#21867a", [2.4, 22, 2.4], [0, 17, -12]);
      gun.rotation.x = Math.PI / 2;
      part(body, "box", "#ffd93d", [6, 1, 6], [0, 26, 2]);
    } else if (tier === 9) {
      blob(u, 18);
      body.position.y = 46;
      const f = part(body, "cyl", "#e9ecef", [4.5, 34, 4.5], [0, 0, 0]);
      f.rotation.x = Math.PI / 2;
      const nose = part(body, "cone", "#ff6b6b", [4.5, 8, 4.5], [0, 0, -21]);
      nose.rotation.x = -Math.PI / 2;
      part(body, "box", "#4d96ff", [42, 1.8, 9], [0, 0, -3]);
      part(body, "box", "#4d96ff", [16, 1.5, 5], [0, 0, 14]);
      part(body, "box", "#4d96ff", [1.5, 9, 6], [0, 5, 14]);
      part(body, "sphere", "#90e0ef", [3, 2.6, 5], [0, 3.5, -8]);
      const prop = part(body, "box", "#2b2d42", [14, 1.5, 0.8], [0, 0, -25.5]);
      u.userData.prop = prop;
    } else if (tier === 10) {
      blob(u, 16);
      body.position.y = 74;
      part(body, "box", "#adb5bd", [14, 14, 14], [0, 0, 0]);
      [-1, 1].forEach((side) => {
        part(body, "box", "#4d96ff", [17, 1.2, 11], [side * 17, 0, 0]);
        part(body, "cyl", "#6c757d", [0.8, 4, 0.8], [side * 8, 0, 0]).rotation.z = Math.PI / 2;
      });
      part(body, "sphere", "#ff6b6b", 2.5, [0, 8, 0]);
      const dish = part(body, "cone", "#e9ecef", [6, 5, 6], [0, -9, -2]);
      dish.rotation.x = Math.PI;
    } else {
      blob(u, 20);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
        part(body, "cyl", "#2b2d42", [4, 3, 4], [sx * 12, 4, sz * 9]).rotation.z = Math.PI / 2;
      }));
      part(body, "box", "#ff6b6b", [24, 5, 26], [0, 7, 0]);
      part(body, "sphere", "#2b2d42", 14, [0, 22, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const blade = part(body, "box", "#ffd93d", [5, 6, 1], [Math.sin(a) * 6, 22 + Math.cos(a) * 6, 13.6]);
        blade.rotation.z = -a;
      }
      part(body, "sphere", "#ffd93d", [2, 2, 1], [0, 22, 14]);
      part(body, "cyl", "#e09f00", [1, 7, 1], [2, 38, 0]).rotation.z = -0.3;
      u.userData.spark = part(body, "sphere", basic("#ff9f1c"), 3, [3.5, 42, 0]);
    }
    return u;
  }

  function makeUnit(tier, hero) {
    return WEAPONS[tier].vehicle ? makeVehicle(tier) : makeSoldier(tier, hero);
  }

  const squad = { group: new THREE.Group(), key: "", units: [] };
  scene.add(squad.group);

  function updateSquad() {
    const key = g.tier + ":" + g.count;
    if (squad.key !== key) {
      squad.key = key;
      squad.group.clear();
      squad.units = [];
      // You are the camera, so unit 0 is only your weapon in your hands.
      for (let i = 0; i < g.count; i++) {
        const u = i === 0 ? new THREE.Group() : makeUnit(g.tier, false);
        squad.units.push(u);
        squad.group.add(u);
      }
      setViewModel(g.tier);
    }
    const vehicle = WEAPONS[g.tier].vehicle;
    squadSpots().forEach((s) => {
      if (s.i === 0) return;
      const u = squad.units[s.i];
      u.position.set(wx(sx(s.x)), DECK.h, Math.max(wz(s.y), DECK.front + 10) + (g.kick > 0 ? 2 : 0));
      // Turned toward the cross-hair, like you.
      u.rotation.y = Math.atan2(-(g.target.x - s.x), -(g.target.y - s.y)) * 0.8;
      const body = u.userData.body;
      if (!vehicle) body.position.y = Math.abs(Math.sin(time * 9 + s.x * 0.1)) * 2.5;
      else if (g.tier === 9 || g.tier === 10) {
        body.position.y = (g.tier === 9 ? 46 : 74) + Math.sin(time * 3 + s.i) * 4;
        body.rotation.z = Math.sin(time * 2 + s.i) * 0.12;
      } else body.position.y = Math.abs(Math.sin(time * 6 + s.x * 0.1)) * 1.5;
      if (u.userData.cape) u.userData.cape.rotation.x = 0.25 + Math.sin(time * 10) * 0.15;
      if (u.userData.prop) u.userData.prop.rotation.z = time * 40;
      if (u.userData.spark) u.userData.spark.scale.setScalar(2 + Math.random() * 2);
    });
  }

  // How high each kind of shot flies above the grass.
  function shotHeight(kind) {
    return { plane: 46, laser: 30, bomb: 22, ball: 15, shell: 17, missile: 18 }[kind] || 20;
  }

  // ---------- Your shots ----------

  const LASER_GLOW = new THREE.MeshBasicMaterial({ color: 0x00dcff, transparent: true, opacity: 0.5, depthWrite: false });

  function makeBullet(b) {
    const root = new THREE.Group();
    const m = new THREE.Group();
    root.add(m);
    const along = (geo, color, rad, len, z) => {
      const p = part(m, geo, color, [rad, len, rad], [0, 0, z || 0]);
      p.rotation.x = -Math.PI / 2;
      return p;
    };
    switch (b.kind) {
      case "stone": part(m, "ball", "#8d99ae", 5.5); break;
      case "axe":
        part(m, "cyl", "#8b5a2b", [1.3, 18, 1.3]);
        part(m, "box", "#adb5bd", [1.6, 8, 9], [0, 6, -4]);
        break;
      case "arrow":
        along("cyl", "#8b5a2b", 1, 22, 4);
        along("cone", "#adb5bd", 2.6, 6, -9);
        part(m, "box", "#ff6b6b", [6, 4, 4], [0, 0, 14]);
        break;
      case "dart":
        along("cyl", "#ff9f1c", 2.6, 12, 0);
        part(m, "ball", "#4d96ff", 3.4, [0, 0, -6]);
        break;
      case "pellet": along("cyl", basic("#ffd93d"), 2, 14, 0); break;
      case "ball": part(m, "ball", "#2b2d42", 9); part(m, "ball", "#6c757d", 3, [-3, 3, 6]); break;
      case "shell": along("cyl", "#e09f00", 5, 18, 0); along("cone", "#e09f00", 5, 6, -12); break;
      case "missile":
        along("cyl", "#ff6b6b", 4, 18, 0);
        along("cone", "#ffffff", 4, 7, -12.5);
        part(m, "box", "#4d96ff", [13, 1.2, 4], [0, 0, 7]);
        root.userData.flame = part(m, "ball", basic("#ff9f1c"), 4, [0, 0, 12]);
        break;
      case "plane": {
        const p = makeVehicle(9).userData.body;
        p.position.set(0, 0, 0);
        p.scale.setScalar(0.7);
        m.add(p);
        break;
      }
      case "laser": {
        const glow = part(m, "box", LASER_GLOW, [12, 12, 70], [0, 0, 35]);
        glow.renderOrder = 5;
        part(m, "box", basic("#ffffff"), [4, 4, 70], [0, 0, 35]);
        break;
      }
      case "bomb":
        part(m, "sphere", "#2b2d42", 16);
        part(m, "box", "#ffd93d", [9, 9, 1], [0, 0, 16]);
        part(m, "cyl", "#e09f00", [1, 7, 1], [0, 18, 0]);
        root.userData.flame = part(m, "ball", basic("#ff9f1c"), 3, [0, 22, 0]);
        break;
    }
    if (TRAILS[b.kind]) {
      const trail = root.userData.trail = part(root, "box", TRAIL_MAT[TRAILS[b.kind]], [b.kind === "pellet" ? 2.2 : 3, b.kind === "pellet" ? 2.2 : 3, 46], [0, 0, 30]);
      trail.renderOrder = 4;
    }
    root.userData.spin = m;
    root.rotation.y = Math.atan2(-b.vx, -b.vy);
    // Shots start at the gun and fly up or down to the height under your cross-hair.
    b.h0 = b.you ? CAM.h - 10 : DECK.h + 20;
    b.h1 = Math.max(shotHeight(b.kind) * 0.5, g.targetH);
    b.reach = Math.max(60, Math.hypot(g.target.x - b.x, g.target.y - b.y));
    b.x0 = b.x; b.y0 = b.y;
    return { root };
  }
  const TRAILS = { stone: "white", axe: "white", arrow: "white", dart: "gold", pellet: "gold", ball: "smoke", shell: "smoke", missile: "smoke", bomb: "smoke" };
  const TRAIL_MAT = {
    white: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false }),
    gold: new THREE.MeshBasicMaterial({ color: "#ffd93d", transparent: true, opacity: 0.7, depthWrite: false }),
    smoke: new THREE.MeshBasicMaterial({ color: "#dee2e6", transparent: true, opacity: 0.55, depthWrite: false }),
  };

  function updateBullet(b, v) {
    const k = Math.min(1, Math.hypot(b.x - b.x0, b.y - b.y0) / b.reach);
    // Starts from the soldier who fired it, and meets the others at the cross-hair.
    v.root.position.set(wx(b.x) + (sx(b.x0) - b.x0) * (1 - k), b.h0 + (b.h1 - b.h0) * k, wz(b.y));
    // No trail right in front of your eyes.
    // Your own shots show up once they are out of your hands; the muzzle flash covers the start.
    v.root.visible = !b.you || b.age > 0.05;
    if (v.root.userData.trail) v.root.userData.trail.visible = b.age > (b.you ? 0.16 : 0.05);
    const m = v.root.userData.spin;
    if (b.kind === "axe") m.rotation.x = -b.age * 18;
    else if (b.kind === "stone") m.rotation.x = -b.age * 10;
    else if (b.kind === "bomb") m.rotation.z = Math.sin(b.age * 10) * 0.3;
    if (v.root.userData.flame) v.root.userData.flame.scale.setScalar(3 + Math.random() * 2.5);
  }

  // ---------- Things the enemy throws ----------

  function makeShot(s) {
    const root = new THREE.Group();
    const m = new THREE.Group();
    root.add(m);
    if (s.kind === "stone" || s.kind === "rock") {
      const r = s.kind === "rock" ? 10 : 6;
      part(m, "ball", "#8d99ae", r);
      part(m, "ball", "#c0c7d1", r * 0.35, [-r * 0.35, r * 0.4, r * 0.6]);
    } else if (s.kind === "cork") {
      part(m, "cyl", "#c08552", [4, 11, 4]).rotation.x = Math.PI / 2;
    } else if (s.kind === "ball") {
      part(m, "ball", "#2b2d42", 8);
    } else {
      const big = s.kind === "bigshell";
      const r = big ? 7 : 5;
      part(m, "cyl", big ? "#9d0208" : "#6c584c", [r, r * 3, r]).rotation.x = Math.PI / 2;
      part(m, "cone", big ? "#9d0208" : "#6c584c", [r, r * 1.3, r], [0, 0, r * 2]).rotation.x = Math.PI / 2;
      root.userData.flame = part(m, "ball", basic("#ff9f1c"), r * 0.8, [0, 0, -r * 1.8]);
    }
    root.userData.spin = m;
    return { root };
  }

  function updateShot(s, v) {
    // Thrown in a nice arc from the enemy's hand to the wall (or to you).
    const lineY = g.wall > 0 ? WALL_Y - 6 : SQUAD_Y - 12;
    const k = Math.max(0, Math.min(1, (s.y - s.y0) / Math.max(1, lineY - s.y0)));
    const tank = s.kind === "shell" || s.kind === "bigshell";
    const end = g.wall > 0 ? 10 : CAM.h - 6;
    const h = s.h0 * (1 - k) + end * k + Math.sin(k * Math.PI) * (tank ? 18 : 55);
    v.root.position.set(wx(s.x), h, wz(s.y));
    if (!tank) v.root.userData.spin.rotation.x = s.age * 8;
    if (v.root.userData.flame) v.root.userData.flame.scale.setScalar(3 + Math.random() * 3);
  }

  // ---------- Boxes and tough walls ----------

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function circ(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  // Flat pictures of each weapon for the box fronts (same drawings as Army Rush).
  function weaponIcon(c, tier, x, y, s) {
    c.save();
    c.translate(x, y);
    switch (tier) {
      case 0: circ(c, 0, 0, s * 0.55, "#8d99ae"); circ(c, -s * 0.15, -s * 0.15, s * 0.18, "#c0c7d1"); break;
      case 1:
        c.fillStyle = "#8b5a2b"; c.fillRect(-s * 0.1, -s * 0.9, s * 0.2, s * 1.8);
        c.fillStyle = "#adb5bd";
        c.beginPath(); c.moveTo(0, -s * 0.9); c.quadraticCurveTo(s * 0.9, -s * 0.8, s * 0.7, -s * 0.1); c.lineTo(0, -s * 0.3); c.fill();
        break;
      case 2:
        c.strokeStyle = "#8b5a2b"; c.lineWidth = s * 0.18;
        c.beginPath(); c.arc(-s * 0.3, 0, s * 0.9, -1.2, 1.2); c.stroke();
        c.strokeStyle = "#fff"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-s * 0.3 + Math.cos(-1.2) * s * 0.9, Math.sin(-1.2) * s * 0.9);
        c.lineTo(-s * 0.3 + Math.cos(1.2) * s * 0.9, Math.sin(1.2) * s * 0.9); c.stroke();
        break;
      case 3: case 4: {
        const one = (ox) => {
          c.fillStyle = "#4d96ff"; rrect(c, ox - s * 0.25, -s * 0.9, s * 0.5, s * 1.3, s * 0.15); c.fill();
          c.fillStyle = "#ff9f1c"; c.fillRect(ox - s * 0.25, -s * 1.05, s * 0.5, s * 0.25);
          c.fillStyle = "#3d405b"; c.fillRect(ox - s * 0.2, s * 0.2, s * 0.4, s * 0.6);
        };
        if (tier === 3) one(0); else { one(-s * 0.35); one(s * 0.35); }
        break;
      }
      case 5:
        circ(c, -s * 0.5, s * 0.5, s * 0.35, "#6c584c"); circ(c, s * 0.5, s * 0.5, s * 0.35, "#6c584c");
        c.fillStyle = "#343a40"; rrect(c, -s * 0.35, -s, s * 0.7, s * 1.5, s * 0.3); c.fill();
        break;
      case 6:
        c.fillStyle = "#495057";
        for (let i = -1; i <= 1; i++) c.fillRect(i * s * 0.3 - s * 0.1, -s, s * 0.2, s * 1.4);
        c.fillStyle = "#ffd93d"; rrect(c, -s * 0.55, s * 0.1, s * 1.1, s * 0.6, s * 0.2); c.fill();
        break;
      case 7:
        c.fillStyle = "#3d405b"; c.fillRect(-s * 0.8, -s * 0.6, s * 0.3, s * 1.3); c.fillRect(s * 0.5, -s * 0.6, s * 0.3, s * 1.3);
        c.fillStyle = "#2a9d8f"; rrect(c, -s * 0.55, -s * 0.5, s * 1.1, s * 1.1, s * 0.2); c.fill();
        c.fillStyle = "#21867a"; c.fillRect(-s * 0.1, -s * 1.1, s * 0.2, s * 0.8);
        circ(c, 0, 0, s * 0.35, "#21867a");
        break;
      case 8:
        c.fillStyle = "#ff6b6b"; rrect(c, -s * 0.25, -s * 0.7, s * 0.5, s * 1.3, s * 0.25); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(-s * 0.25, -s * 0.55); c.lineTo(0, -s * 1.1); c.lineTo(s * 0.25, -s * 0.55); c.fill();
        c.fillStyle = "#4d96ff"; c.beginPath(); c.moveTo(-s * 0.25, s * 0.3); c.lineTo(-s * 0.55, s * 0.7); c.lineTo(-s * 0.25, s * 0.6); c.fill();
        c.beginPath(); c.moveTo(s * 0.25, s * 0.3); c.lineTo(s * 0.55, s * 0.7); c.lineTo(s * 0.25, s * 0.6); c.fill();
        break;
      case 9:
        c.fillStyle = "#e9ecef"; rrect(c, -s * 0.18, -s, s * 0.36, s * 1.9, s * 0.18); c.fill();
        c.fillStyle = "#4d96ff";
        c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(-s, s * 0.1); c.lineTo(-s, s * 0.3); c.lineTo(s, s * 0.3); c.lineTo(s, s * 0.1); c.fill();
        c.fillRect(-s * 0.4, s * 0.7, s * 0.8, s * 0.18);
        circ(c, 0, -s * 0.65, s * 0.12, "#90e0ef");
        break;
      case 10:
        c.fillStyle = "#4d96ff"; c.fillRect(-s * 1.1, -s * 0.3, s * 0.7, s * 0.6); c.fillRect(s * 0.4, -s * 0.3, s * 0.7, s * 0.6);
        c.fillStyle = "#adb5bd"; rrect(c, -s * 0.4, -s * 0.45, s * 0.8, s * 0.9, s * 0.2); c.fill();
        circ(c, 0, -s * 0.6, s * 0.2, "#ff6b6b");
        break;
      case 11:
        circ(c, 0, 0, s * 0.8, "#2b2d42");
        c.fillStyle = "#ffd93d";
        for (let i = 0; i < 3; i++) {
          const a = i * (Math.PI * 2 / 3);
          c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.6, a, a + 0.8); c.fill();
        }
        circ(c, 0, 0, s * 0.15, "#ffd93d");
        c.strokeStyle = "#e09f00"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, -s * 0.8); c.quadraticCurveTo(s * 0.3, -s * 1.2, s * 0.1, -s * 1.4); c.stroke();
        circ(c, s * 0.1, -s * 1.4, 3, "#ff9f1c");
        break;
    }
    c.restore();
  }

  // A soldier from behind holding the weapon, or the machine, for the "+ army" box.
  function unitIcon(c, tier, x, y) {
    if (WEAPONS[tier].vehicle) return weaponIcon(c, tier, x, y - 2, 20);
    c.save();
    c.translate(x, y);
    c.scale(1.3, 1.3);
    circ(c, 0, 0, 9, "#4d96ff");
    c.fillStyle = "#7b5e3b"; rrect(c, -5, -2, 10, 9, 3); c.fill();
    circ(c, 0, -8, 7, "#2a9d8f");
    c.fillStyle = "#21867a"; c.fillRect(-8, -9, 16, 3);
    weaponIcon(c, tier, 10, -6, 9);
    c.restore();
  }

  // Breaks between words, or between any two characters for Chinese (no spaces).
  function wrapText(c, text, x, y, maxW) {
    const sep = text.includes(" ") ? " " : "";
    let line = "";
    (sep ? text.split(" ") : Array.from(text)).forEach((word) => {
      const test = line ? line + sep + word : word;
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y);
        line = word;
        y += 19;
      } else {
        line = test;
      }
    });
    c.fillText(line, x, y);
  }

  function lifeBar2d(c, x, y, w, ratio) {
    c.fillStyle = "#2b2d42";
    rrect(c, x - w / 2 - 2, y - 2, w + 4, 10, 5); c.fill();
    c.fillStyle = ratio > 0.5 ? "#6bcb77" : ratio > 0.25 ? "#ffd93d" : "#ff6b6b";
    if (ratio > 0) { rrect(c, x - w / 2, y, w * ratio, 6, 3); c.fill(); }
  }

  const DOOR_COLORS = { weapon: "#ffd166", army: "#90e0ef", wall: "#f4c7a1", shield: "#cdb4ff" };
  const DOOR_H = 96, DOOR_DEPTH = 18, TEX = 2;

  // The picture on the front of a box: drawn on a canvas like in Army Rush, then used as a texture.
  function drawDoorFace(v, d) {
    const left = Math.max(0, d.hp);
    const key = (d.broken ? "open" : "") + fmt(left);
    if (key === v.drawn) return;
    if (v.drawn && !d.broken && time - v.drawAt < 0.08) return;
    v.drawn = key;
    v.drawAt = time;
    const c = v.ctx, fw = v.fw, w = fw - 12, h = DOOR_H - 12, x = 6, y = 6;
    c.setTransform(TEX, 0, 0, TEX, 0, 0);
    c.clearRect(0, 0, fw, DOOR_H);
    const ratio = left / d.maxHp;
    if (d.kind === "barrier") {
      c.fillStyle = "#8d99ae"; c.fillRect(0, 0, fw, DOOR_H);
      c.strokeStyle = "#5c677d"; c.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const by = row * (DOOR_H / 4);
        c.beginPath(); c.moveTo(0, by); c.lineTo(fw, by); c.stroke();
        for (let bx = row % 2 ? 20 : 0; bx < fw; bx += 40) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + DOOR_H / 4); c.stroke(); }
      }
      lifeBar2d(c, fw / 2 - 18, DOOR_H - 18, fw - 60, ratio);
      c.font = "bold 16px sans-serif"; c.textAlign = "right"; c.fillStyle = "#fff";
      c.fillText(fmt(left), fw - 6, DOOR_H - 8);
      v.tex.needsUpdate = true;
      return;
    }
    c.fillStyle = "#7f5539"; c.fillRect(0, 0, fw, DOOR_H);
    c.fillStyle = DOOR_COLORS[d.kind];
    rrect(c, x, y, w, h, 8); c.fill();
    circ(c, x + w - 12, y + h / 2 - 6, 4, "#7f5539");
    c.fillStyle = "#2b2d42";
    if (d.broken) {
      c.font = "bold 26px " + FONT; c.textAlign = "center";
      c.fillText(t("OPEN!"), fw / 2, DOOR_H / 2 + 9);
      v.tex.needsUpdate = true;
      return;
    }
    c.font = "bold 20px " + FONT; c.textAlign = "left";
    if (d.kind === "weapon") {
      weaponIcon(c, d.tier, x + 34, y + 34, 20);
      wrapText(c, WEAPONS[d.tier].name, x + 64, y + 30, w - 84);
    } else if (d.kind === "army") {
      unitIcon(c, g.tier, x + 32, y + 38);
      c.font = "bold 34px " + FONT;
      c.fillText("+" + d.amount, x + 62, y + 48);
    } else if (d.kind === "wall") {
      c.fillStyle = "#c1440e";
      for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) rrect(c, x + 14 + i * 18 + (r % 2) * 9 - 4, y + 18 + r * 11, 16, 9, 2), c.fill();
      c.fillStyle = "#2b2d42";
      wrapText(c, t("Bigger wall"), x + 64, y + 30, w - 84);
    } else {
      c.fillStyle = "#4d96ff";
      c.beginPath(); c.moveTo(x + 32, y + 12); c.lineTo(x + 50, y + 20); c.quadraticCurveTo(x + 50, y + 48, x + 32, y + 58);
      c.quadraticCurveTo(x + 14, y + 48, x + 14, y + 20); c.closePath(); c.fill();
      c.fillStyle = "#90e0ef"; c.beginPath(); c.arc(x + 32, y + 34, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2b2d42";
      wrapText(c, t("Shield"), x + 64, y + 30, w - 84);
    }
    lifeBar2d(c, x + w / 2 - 18, y + h - 15, w - 56, ratio);
    c.font = "bold 15px sans-serif"; c.textAlign = "right"; c.fillStyle = "#2b2d42";
    c.fillText(fmt(left), x + w - 6, y + h - 6);
    v.tex.needsUpdate = true;
  }

  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function makeDoor(d) {
    const fw = d.x1 - d.x0 + 12;
    const cv = document.createElement("canvas");
    cv.width = Math.round(fw * TEX);
    cv.height = DOOR_H * TEX;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    const front = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const side = mat(d.kind === "barrier" ? "#5c677d" : "#7f5539").clone();
    side.transparent = true;
    const root = new THREE.Group();
    blob(root, fw * 0.55);
    const box = new THREE.Mesh(GEO.box, [side, side, side, side, front, side]);
    box.scale.set(fw, DOOR_H, DOOR_DEPTH);
    box.position.y = DOOR_H / 2;
    root.add(box);
    const v = { root, box, fw, ctx: cv.getContext("2d"), tex, mats: [front, side], drawn: "", drawAt: -1,
      dispose() { tex.dispose(); front.dispose(); side.dispose(); } };
    drawDoorFace(v, d);
    return v;
  }

  // Close to the wall, boxes sink half into the ground so they don't hide the enemies behind them.
  function doorSink(p) {
    return Math.max(0, Math.min(1, (p.y + p.h - (WALL_Y - 140)) / 110)) * DOOR_H * 0.5;
  }

  function updateDoor(d, v) {
    const p = d.pair;
    const shake = d.flash ? (Math.random() - 0.5) * 5 : 0;
    v.root.position.set(wx((d.x0 + d.x1) / 2) + shake, -doorSink(p), wz(p.y + p.h) - DOOR_DEPTH / 2);
    const pop = d.flash ? 1.04 : 1;
    v.box.scale.set(v.fw * pop, DOOR_H * pop, DOOR_DEPTH);
    const a = d.fade ? Math.max(0, 1 - d.fade * 2) : 1;
    v.mats.forEach((m) => { m.opacity = a; });
    v.root.children[0].visible = a > 0.5;
    drawDoorFace(v, d);
  }

  // ---------- Effects ----------

  function makeFx(f) {
    const root = new THREE.Group();
    const v = { root, mats: [] };
    const own = (m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; v.mats.push(c); return c; };
    if (f.type === "puff") {
      v.mesh = part(root, "ball", own(mat("#ffffff")), 1);
    } else if (f.type === "star" || f.type === "pow") {
      v.mesh = part(root, "star", own(basic(f.type === "pow" ? "#ffd93d" : f.color)), 1);
      v.mesh.material.side = THREE.DoubleSide;
      v.face = true;
    } else if (f.type === "boom") {
      v.parts = ["#ff9f1c", "#ffd93d", "#ffffff"].map((c) => part(root, "ball", own(basic(c)), 1));
    } else if (f.type === "confetti") {
      v.mesh = part(root, "plane", own(basic(f.color)), [10, 6, 1]);
      v.mesh.material.side = THREE.DoubleSide;
    } else if (f.type === "text") {
      v.mesh = textSprite(f.text, f.color, f.size * 1.3);
      v.mats.push(v.mesh.material);
      root.add(v.mesh);
    }
    v.dispose = () => v.mats.forEach((m) => m.dispose());
    return v;
  }

  function updateFxView(f, v) {
    const k = f.t / f.life;
    v.root.position.set(wx(f.x), f.h, wz(f.y));
    const fade = Math.max(0, 1 - k);
    v.mats.forEach((m) => { m.opacity = fade; });
    if (f.type === "puff") v.mesh.scale.setScalar(f.r * (1 + k));
    else if (f.type === "star") v.mesh.scale.setScalar(7);
    else if (f.type === "pow") v.mesh.scale.setScalar(6 + k * 10);
    else if (f.type === "boom") {
      v.parts[0].scale.setScalar(f.r * (0.4 + k * 0.8));
      v.parts[1].scale.setScalar(f.r * (0.25 + k * 0.6));
      v.parts[2].scale.setScalar(Math.max(0.01, f.r * k * 0.4));
    } else if (f.type === "confetti") {
      v.mesh.rotation.set(f.rot + f.t * 8, f.rot + f.t * 5, 0);
      if (state === "won") v.mats[0].opacity = 1;
    }
    if (v.face) {
      v.mesh.quaternion.copy(camera.quaternion);
      v.mesh.rotateZ(f.t * 6);
    }
  }

  // ---------- The field ----------

  function stripeTexture() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 2;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#95d5b2"; ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = "#a7e0c0"; ctx.fillRect(0, 1, 4, 1);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const FIELD_LEN = 1600;
  const stripes = stripeTexture();
  stripes.repeat.set(1, FIELD_LEN / 80);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, FIELD_LEN), new THREE.MeshLambertMaterial({ map: stripes }));
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0, 300 - FIELD_LEN / 2);
  scene.add(field);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: "#74c69d" }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(0, -0.5, -800);
  scene.add(meadow);

  // Fluffy clouds far away, so a tall view has something in the sky.
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const s = 1 + (i % 3) * 0.4;
    [[0, 0, 40], [38, -6, 30], [-36, -8, 28], [14, 18, 26]].forEach(([x, y, r]) => part(cloud, "sphere", basic("#ffffff"), [r * s, r * s * 0.7, r * s * 0.6], [x * s, y * s, 0]));
    const a = -1.5 + (i / 8) * 3 + Math.sin(i * 7) * 0.12;
    cloud.position.set(Math.sin(a) * 1300, 260 + ((i * 53) % 5) * 70, -Math.cos(a) * 1300 - 200);
    cloud.lookAt(0, cloud.position.y, 0);
    scene.add(cloud);
  }

  // Little flowers, fence posts and trees, spread along the field.
  const scenery = [];
  for (let i = 0; i < 10; i++) {
    const f = part(scene, "ball", i % 2 ? "#ffffff" : "#ffd93d", 4, [0, 2, 0]);
    scenery.push({ mesh: f, x: wx((i * 97) % W + 10), base: i * 173, span: H + 40, off: -20 });
  }
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 12; i++) {
      const post = new THREE.Group();
      part(post, "box", "#d4a373", [6, 22, 6], [0, 11, 0]);
      part(post, "box", "#e9c46a", [4, 4, 60], [0, 16, 0]);
      scene.add(post);
      scenery.push({ mesh: post, x: side * (W / 2 + 18), base: i * 60, span: 720, off: -620 });
    }
    for (let i = 0; i < 7; i++) {
      const tree = new THREE.Group();
      const s = 0.8 + ((i * 37) % 10) / 20;
      part(tree, "cyl", "#8b5a2b", [6 * s, 30 * s, 6 * s], [0, 15 * s, 0]);
      part(tree, "sphere", i % 3 ? "#52b788" : "#40916c", 26 * s, [0, 46 * s, 0]);
      part(tree, "sphere", "#52b788", 18 * s, [10 * s, 62 * s, 4]);
      scene.add(tree);
      scenery.push({ mesh: tree, x: side * (W / 2 + 70 + ((i * 53) % 60)), base: i * 140 + (side > 0 ? 70 : 0), span: 980, off: -900 });
    }
  });

  scenery.forEach((s) => {
    s.mesh.position.set(s.x, s.mesh.position.y, wz((s.base % s.span) + s.off));
  });

  // The sandbag wall: it gets cracks as it gets hurt, and only rubble is left once it breaks.
  const wall = { group: new THREE.Group(), bags: [], rubble: new THREE.Group(), look: "" };
  wall.group.position.z = wz(WALL_Y);
  scene.add(wall.group);
  for (let x = 0, i = 0; x < W + 10; x += 34, i++) {
    const low = part(wall.group, "sphere", "#d4a373", [19, 8, 11], [wx(x + 4), 8, 0]);
    const high = part(wall.group, "sphere", "#d4a373", [19, 8, 11], [wx(x + 21), 21, 0]);
    wall.bags.push(low, high);
    high.userData.i = i;
    high.userData.base = high.position.clone();
  }
  for (let x = 0; x < W + 10; x += 34) {
    part(wall.rubble, "ball", "#c8a27a", 7, [wx(x + 6), 3, 4]);
    part(wall.rubble, "ball", "#a47148", 5, [wx(x + 20), 2, -3]);
  }
  wall.group.add(wall.rubble);
  wall.bar = makeBar(W - 160, 8);
  wall.bar.group.position.set(0, 44, 0);
  wall.group.add(wall.bar.group);

  function updateWall() {
    const health = g.wall / g.wallMax;
    const look = g.wall <= 0 ? "gone" : health < 0.35 ? "bad" : health < 0.7 ? "hurt" : "ok";
    if (look !== wall.look) {
      wall.look = look;
      wall.bags.forEach((b) => { b.visible = look !== "gone"; b.material = mat("#d4a373"); b.rotation.z = 0; });
      wall.rubble.visible = look === "gone";
      wall.bags.forEach((b) => {
        const i = b.userData.i;
        if (i === undefined) return;
        b.position.copy(b.userData.base);
        if ((look === "hurt" || look === "bad") && i % 3 === 0) { b.material = mat("#b5835a"); b.rotation.z = 0.3; }
        if (look === "bad" && i % 2) { b.position.y = 6; b.position.z = -10; b.rotation.z = -0.4; }
      });
    }
    wall.bar.group.visible = false;
    el.wallFill.style.width = Math.max(0, health * 100) + "%";
    el.wallGauge.classList.toggle("gone", g.wall <= 0);
  }

  const shieldMat = new THREE.MeshBasicMaterial({ color: "#90e0ef", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const shieldMesh = new THREE.Mesh(GEO.shield, shieldMat);
  shieldMesh.scale.set(W + 60, 150, 26);
  shieldMesh.renderOrder = 6;
  scene.add(shieldMesh);
  const shieldRim = new THREE.Mesh(GEO.shield, new THREE.MeshBasicMaterial({ color: "#4d96ff", wireframe: true, transparent: true, opacity: 0.5 }));
  shieldMesh.add(shieldRim);

  function updateShield() {
    shieldMesh.visible = g.shield > 0 && !(g.shield < 2 && Math.floor(time * 8) % 2);
    shieldMesh.position.z = wz(WALL_Y - 30);
  }

  // ---------- Keeping the 3D world in step with the battle ----------

  const live = {};
  function syncList(key, list, make, update) {
    const seen = new Set();
    list.forEach((o) => {
      if (!o.view) o.view = make(o);
      if (!o.view.root.parent) scene.add(o.view.root);
      seen.add(o.view);
      update(o, o.view);
    });
    (live[key] || []).forEach((v) => {
      if (seen.has(v)) return;
      scene.remove(v.root);
      if (v.dispose) v.dispose();
    });
    live[key] = Array.from(seen);
  }

  function allDoors() {
    const out = [];
    g.doors.forEach((p) => p.list.forEach((d) => { d.pair = p; out.push(d); }));
    return out;
  }

  // ---------- Your lookout: a wooden deck behind the wall ----------

  // When the camera has to sit higher than a soldier's eyes to keep the wall at the bottom of the
  // view, your army stands on a deck so the soldiers next to you are at your height.
  const EYE = 44;
  const DECK = { h: 0, front: 0, group: new THREE.Group() };
  scene.add(DECK.group);
  function buildDeck() {
    DECK.group.clear();
    if (DECK.h < 2) return;
    const z0 = DECK.front, z1 = CAM.z + 40, len = z1 - z0, mid = (z0 + z1) / 2;
    part(DECK.group, "box", "#7f5539", [W + 300, DECK.h, len], [0, DECK.h / 2, mid]);
    part(DECK.group, "box", "#c8a27a", [W + 300, 2, len], [0, DECK.h + 1, mid]);
    for (let x = -W / 2 - 150; x < W / 2 + 150; x += 26) part(DECK.group, "box", "#a47148", [2, 2.4, len], [x, DECK.h + 1, mid]);
  }

  // ---------- Your own weapon, in your hands at the bottom of the view ----------

  const view = { yaw: 0, group: new THREE.Group(), gun: new THREE.Group(), tanH: 1, tanV: 1, depth: 30, base: new THREE.Vector3() };
  camera.add(view.group);
  view.group.add(view.gun);
  const MUZZLE = new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const MUZZLE_CORE = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });

  function setViewModel(tier) {
    view.gun.clear();
    view.tier = tier;
    placeViewModel();
    const w = WEAPONS[tier];
    let muzzle = [0, 1, -16];
    if (!w.vehicle) {
      // Your arm in its blue sleeve, holding the same weapon as your army.
      const arm = part(view.gun, "cyl", "#4d96ff", [3.6, 22, 3.6], [3, -6, 10]);
      arm.rotation.x = Math.PI / 2 - 0.35;
      part(view.gun, "sphere", "#f1c27d", 3.8, [0.5, -1.5, -0.5]);
      const held = makeHeld(tier);
      held.position.set(0, tier === 1 ? -6 : 0, 0);
      view.gun.add(held);
      muzzle = { 0: [0, 0, -5], 1: [5, 7, -3], 2: [0, 0, -6], 6: [0, 0, -19], 8: [0, 0, -18] }[tier] || [0, 1, -13];
    } else if (tier === 5 || tier === 7) {
      // Sitting behind the cannon or in the tank turret.
      const tank = tier === 7;
      const barrel = part(view.gun, "cyl", tank ? "#21867a" : "#343a40", tank ? [3, 34, 3] : [5.5, 26, 5.5], [0, 0, -12]);
      barrel.rotation.x = Math.PI / 2;
      part(view.gun, "cyl", tank ? "#2a9d8f" : "#495057", [tank ? 3.8 : 6.6, 3, tank ? 3.8 : 6.6], [0, 0, -26]).rotation.x = Math.PI / 2;
      part(view.gun, "sphere", tank ? "#2a9d8f" : "#7f5539", tank ? 10 : 8, [0, -6, 6]);
      muzzle = [0, 0, -29];
    } else if (tier === 9) {
      // A plane on your hand, ready to throw.
      const plane = makeVehicle(9).userData.body;
      plane.position.set(0, 0, -4);
      plane.scale.setScalar(0.42);
      view.gun.add(plane);
      part(view.gun, "sphere", "#f1c27d", 4, [0, -3.5, 0]);
      muzzle = [0, 0, -14];
    } else {
      // A remote control: a laser button, or the big mega bomb plunger.
      part(view.gun, "box", tier === 10 ? "#adb5bd" : "#ffd93d", [11, 5, 14], [0, -2, 0]);
      part(view.gun, "sphere", "#ff6b6b", 2.6, [0, 1, -2]);
      if (tier === 10) {
        part(view.gun, "cyl", "#6c757d", [0.6, 12, 0.6], [4, 5, 4]);
        part(view.gun, "sphere", "#00dcff", 1.4, [4, 11, 4]);
      } else {
        part(view.gun, "cyl", "#2b2d42", [1, 8, 1], [0, 3, 3]);
        part(view.gun, "box", "#2b2d42", [9, 1.6, 1.6], [0, 7, 3]);
      }
      part(view.gun, "sphere", "#f1c27d", [7, 4, 7], [0, -5, 2]);
      muzzle = [0, 3, -6];
    }
    const flash = new THREE.Group();
    flash.position.set(muzzle[0], muzzle[1], muzzle[2]);
    part(flash, "star", MUZZLE, 6);
    part(flash, "star", MUZZLE_CORE, 3, [0, 0, 0.2]);
    flash.children.forEach((m) => { m.renderOrder = 50; });
    flash.visible = false;
    view.gun.add(flash);
    view.flash = flash;
    view.gun.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
  }

  // Places your weapon low on the right, the same size on any screen.
  function placeViewModel() {
    const d = view.depth;
    // Cannons and tank guns sit in the middle, everything else is in your right hand.
    const middle = view.tier === 5 || view.tier === 7;
    view.base.set((middle ? 0 : 0.38) * view.tanH * d, (middle ? -0.75 : -0.62) * view.tanV * d, -d);
    view.gun.scale.setScalar(0.75 * Math.min(view.tanH, view.tanV));
  }

  const aimPoint = new THREE.Vector3();
  function updateViewModel() {
    const k = g.kick > 0 ? g.kick / 0.09 : 0;
    view.gun.position.copy(view.base);
    view.gun.position.z += k * 4;
    view.gun.position.y += Math.sin(time * 3) * 0.3;
    // Point it at the cross-hair.
    aimPoint.set(input.aim.x * view.tanH * 300, input.aim.y * view.tanV * 300, -300).sub(view.base);
    view.gun.rotation.set(Math.atan2(aimPoint.y, Math.hypot(aimPoint.x, aimPoint.z)) + k * 0.25, Math.atan2(-aimPoint.x, -aimPoint.z), 0, "YXZ");
    view.flash.visible = g.flash > 0 && state === "playing";
    if (view.flash.visible) {
      view.flash.rotation.z = Math.random() * 6;
      view.flash.scale.setScalar(0.8 + Math.random() * 0.7);
    }
  }

  // ---------- Camera: your eyes, just behind the wall ----------

  // The view is 85° wide when the phone is upright and 135° wide when it is on its side (the
  // height follows from the screen's shape). The camera tilts so the top of your wall sits at the
  // bottom of the view, and goes up just high enough to see down to the far end of the field.
  const CAM = { h: EYE, z: wz(WALL_Y) + 22, pitch: 0, wide: 85, wall: -0.78, far: 0.15 };
  const WALL_TOP = 29, MAX_YAW = 1.3;
  const tmp = new THREE.Vector3();

  function project(x, h, y) {
    return tmp.set(wx(x), h, wz(y)).project(camera);
  }

  function aimCamera(yaw) {
    camera.position.set(0, CAM.h, CAM.z);
    camera.rotation.set(CAM.pitch, yaw, 0, "YXZ");
    camera.updateMatrixWorld();
  }

  // 0 for a phone held upright, 1 for a phone on its side.
  function landscape(aspect) {
    return Math.max(0, Math.min(1, (aspect - 0.8) / (1.5 - 0.8)));
  }

  function tiltToWall() {
    let lo = -1.3, hi = 1.0;
    for (let i = 0; i < 18; i++) {
      CAM.pitch = (lo + hi) / 2;
      aimCamera(0);
      if (project(W / 2, WALL_TOP, WALL_Y).y > CAM.wall) lo = CAM.pitch; else hi = CAM.pitch;
    }
    CAM.pitch = hi;
    aimCamera(0);
  }

  function fitCamera() {
    // Upright, the view is tall, so the wall takes a bit more of the bottom.
    const k = landscape(camera.aspect);
    CAM.wide = 85 + (135 - 85) * k;
    CAM.wall = -0.64 - 0.14 * k;
    CAM.far = 0.1 + 0.05 * k;
    view.tanH = Math.tan((CAM.wide / 2) * Math.PI / 180);
    view.tanV = view.tanH / camera.aspect;
    camera.fov = (2 * Math.atan(view.tanV) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    let best = EYE, bestFar = -9;
    for (let h = EYE; h <= 220; h += 4) {
      CAM.h = h;
      tiltToWall();
      const far = project(W / 2, 0, -40).y;
      if (far > bestFar) { bestFar = far; best = h; }
      if (far >= CAM.far) break;
    }
    CAM.h = best;
    tiltToWall();
    // The deck starts just behind the line from your eyes to the top of the wall.
    const deck = Math.max(0, Math.round(CAM.h - EYE));
    const front = Math.max(wz(WALL_Y) + 12, CAM.z - ((CAM.z - wz(WALL_Y)) * (CAM.h - deck)) / (CAM.h - WALL_TOP) + 4);
    if (deck !== DECK.h || front !== DECK.front) { DECK.h = deck; DECK.front = front; buildDeck(); }
    placeViewModel();
    // A little haze only beyond the far end of the field.
    const far = camera.position.distanceTo(tmp.set(0, 0, wz(-60)));
    scene.fog.near = far;
    scene.fog.far = far * 2.2;
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fitCamera();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);

  // ---------- What is under the cross-hair ----------

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ball = new THREE.Sphere();
  const crate = new THREE.Box3();
  const hitP = new THREE.Vector3();

  // The spot on the field your army shoots at, its height, and whether it is an enemy or a box.
  function pickTarget() {
    ndc.set(input.aim.x, input.aim.y);
    ray.setFromCamera(ndc, camera);
    const r = ray.ray;
    let best = Infinity, out = null;
    const closer = (o) => {
      const d = hitP.distanceTo(r.origin);
      if (d < best) { best = d; out = o; }
    };
    g.enemies.forEach((e) => {
      const T = ENEMIES[e.type];
      ball.center.set(wx(e.x), T.tank ? T.r * 0.6 : T.r * 1.2, wz(e.y));
      ball.radius = T.r * 1.25;
      if (r.intersectSphere(ball, hitP)) closer({ x: e.x, y: e.y, h: ball.center.y, on: true });
    });
    g.doors.forEach((p) => p.list.forEach((d) => {
      if (d.gone || d.broken) return;
      const zf = wz(p.y + p.h);
      crate.min.set(wx(d.x0), 0, zf - DOOR_DEPTH);
      crate.max.set(wx(d.x1), DOOR_H - doorSink(p), zf);
      if (r.intersectBox(crate, hitP)) closer({ x: hitP.x + W / 2, y: p.y + p.h - 4, h: hitP.y, on: true });
    }));
    if (out) return out;
    // The grass under the cross-hair, or far down the field when you aim at the sky or the wall.
    const dx = r.direction.x, dz = r.direction.z, flat = Math.hypot(dx, dz) || 1;
    if (r.direction.y < -0.01) {
      const k = -r.origin.y / r.direction.y;
      const y = fieldY(r.origin.z + dz * k);
      if (y < WALL_Y - 40 && y > -100) return { x: r.origin.x + dx * k + W / 2, y, h: 8, on: false };
    }
    const len = dz < -0.05 * flat ? Math.min(900, (SQUAD_Y + 100) / (-dz / flat)) : 400;
    return { x: W / 2 + (dx / flat) * len, y: SQUAD_Y + (dz / flat) * len, h: 20, on: false };
  }

  // ---------- Screens and banner (plain HTML on top of the 3D view) ----------

  let screenKey = "";
  function updateScreen() {
    const key = state === "ready" ? "ready:" + level : state;
    if (key === screenKey) return;
    screenKey = key;
    el.screen.hidden = state === "playing";
    el.menu.hidden = state === "playing";
    el.gauges.hidden = state !== "playing";
    if (state === "ready") {
      el.screen.innerHTML = "<div class='big'>" + t("🪖 Army Rush FPS!") + "</div><div>" + t("A silly army is coming!") + "</div>" +
        "<div>" + t("Tap where you want to shoot 🎯") + "</div><div>" + t("Shoot boxes to get") + "</div><div>" + t("a new weapon 🏹, more of it,") + "</div><div>" + t("or a stronger defence 🧱") + "</div>" +
        "<div>" + t("Hold ⬅️ ➡️ to look at your army") + "</div>" +
        "<div class='gold'>" + t("Level: {name}", { name: LEVELS[level].name }) + "</div><div class='go'>" + t("Tap to start!") + "</div>";
    } else if (state === "over") {
      el.screen.innerHTML = "<div class='big bad'>" + t("Oh no! 😵") + "</div><div>" + t("They got through!") + "</div>" +
        "<div>" + t("You reached wave {n}", { n: g.wave + 1 }) + "</div><div class='gold'>" + t("Tip: open more boxes!") + "</div>" +
        "<div class='go'>" + t("Tap to try again") + "</div>";
    } else if (state === "won") {
      el.screen.innerHTML = "<div class='big'>" + t("YOU WIN! 🏆") + "</div><div>" + t("The King Tank") + "</div><div>" + t("went BOING!") + "</div>" +
        "<div class='go'>" + t("Tap to play again") + "</div>";
    }
  }

  let bannerText = "";
  function updateHud() {
    const b = g.banner;
    const show = state === "playing" && b && b.t > 0;
    el.banner.hidden = !show;
    if (show) {
      if (b.text !== bannerText) { bannerText = b.text; el.banner.textContent = b.text; }
      el.banner.style.opacity = Math.min(1, b.t * 2);
    }
    el.hurt.style.opacity = g.hurt > 0 ? g.hurt * 0.6 : 0;
    updateScreen();
  }


  function render(dt) {
    turnView(dt);
    const sh = g.shake > 0 ? g.shake : 0;
    aimCamera(view.yaw);
    if (sh) {
      camera.rotation.x += (Math.random() - 0.5) * sh * 0.06;
      camera.rotation.y += (Math.random() - 0.5) * sh * 0.06;
      camera.position.y += (Math.random() - 0.5) * sh * 10;
    }
    camera.rotation.x += (g.kick || 0) * 0.05; // a small kick up with every shot
    camera.updateMatrixWorld();

    if (state === "playing") {
      const tg = pickTarget();
      g.target.x = tg.x;
      g.target.y = tg.y;
      g.targetH = tg.h;
      el.cross.classList.toggle("on", tg.on);
    }
    el.cross.hidden = state !== "playing";
    el.cross.classList.toggle("hit", g.hitMark > 0);
    el.cross.style.left = ((input.aim.x + 1) / 2) * 100 + "%";
    el.cross.style.top = ((1 - input.aim.y) / 2) * 100 + "%";

    updateWall();
    updateShield();
    updateSquad();
    updateViewModel();
    syncList("doors", allDoors(), makeDoor, updateDoor);
    syncList("enemies", g.enemies, (e) => makeEnemy(e.type), updateEnemy);
    syncList("tumblers", g.tumblers, (t) => makeEnemy(t.type), updateTumbler);
    syncList("bullets", g.bullets, makeBullet, updateBullet);
    syncList("shots", g.shots, makeShot, updateShot);
    syncList("fx", g.fx, makeFx, updateFxView);
    updateHud();
    renderer.render(scene, camera);
  }

  // Turn with the buttons or keys, or by holding your finger at a side of the view.
  const EDGE = 0.82;
  function turnView(dt) {
    let turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (input.held && Math.abs(input.aim.x) > EDGE) turn += Math.sign(input.aim.x) * (Math.abs(input.aim.x) - EDGE) / (1 - EDGE);
    if (input.up || input.down) input.aim.y = Math.max(-0.9, Math.min(0.9, input.aim.y + ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * 1.2 * dt));
    view.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, view.yaw - turn * 2.4 * dt));
  }

  // ---------- Loop + controls ----------

  // If the phone struggles, draw fewer pixels.
  let slow = 0;
  function watchSpeed(ms) {
    if (pixelRatio <= 1) return;
    slow = ms > 26 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 90) {
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
    }
  }

  let last = 0, acc = 0;
  function loop(now) {
    const ms = last ? now - last : 16;
    const dt = Math.min(0.1, ms / 1000);
    acc += dt;
    last = now;
    watchSpeed(ms);
    while (acc >= STEP) {
      update(STEP);
      updateFx(STEP);
      acc -= STEP;
    }
    render(dt);
    requestAnimationFrame(loop);
  }

  // The cross-hair starts on the middle of the field, looking straight ahead.
  function centreAim() {
    view.yaw = 0;
    aimCamera(0);
    const p = project(W / 2, 30, 200);
    input.aim.x = 0;
    input.aim.y = Math.max(-0.6, Math.min(0.6, p.y));
  }

  function start() {
    if (time - endedAt < 1.2) return;
    newGame();
    state = "playing";
    centreAim();
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function aimAt(e) {
    const rect = stage.getBoundingClientRect();
    input.aim.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -0.99, 0.99);
    input.aim.y = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2, -0.95, 0.95);
  }

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    e.preventDefault();
    if (state !== "playing") return start();
    input.held = true;
    aimAt(e);
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (state === "playing" && (input.held || e.pointerType === "mouse")) aimAt(e);
  });
  const letGo = () => { input.held = false; };
  stage.addEventListener("pointerup", letGo);
  stage.addEventListener("pointercancel", letGo);

  [["left", "left"], ["right", "right"]].forEach(([id, key]) => {
    const btn = document.getElementById(id);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== "playing") return start();
      input[key] = true;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, () => { input[key] = false; }));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
  document.addEventListener("keydown", (e) => {
    const k = KEYS[e.key];
    if (k) { input[k] = true; e.preventDefault(); }
    else if ((e.key === " " || e.key === "Enter") && state !== "playing") { e.preventDefault(); start(); }
  });
  document.addEventListener("keyup", (e) => {
    const k = KEYS[e.key];
    if (k) input[k] = false;
  });

  levelBtns.forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    level = btn.dataset.level;
    levelBtns.forEach((b) => b.setAttribute("aria-pressed", b === btn));
    state = "ready";
    newGame();
    btn.blur();
  }));

  // ?debug lets the test script fast-forward the battle and aim.
  if (/[?&]debug/.test(location.search)) {
    window.armyDebug = {
      get g() { return g; }, get state() { return state; }, dps, nextWeapon, WEAPONS, ENEMIES, input, start,
      setLevel(l) { level = l; }, project, renderer, scene, view, DECK, pickTarget,
      get pixelRatio() { return pixelRatio; }, CAM, camera, fitCamera,
      step(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } render(0); },
      tick(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } },
    };
  }

  newGame();
  requestAnimationFrame(loop);
})();
