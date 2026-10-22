// Army Rush: a silly army marches down at you. Your soldiers shoot by themselves; you aim.
// Shoot doors to get a better weapon or more soldiers. The army keeps getting tougher,
// so without upgrades you cannot win. Enemies never get hurt for real: they flash,
// squash, and tumble away with dizzy eyes.
(function () {
  const W = 480;
  const H = 640;
  const WALL_Y = H - 108;   // sandbags: an enemy that reaches them breaks through
  const SQUAD_Y = H - 76;  // front row of your army
  const STEP = 1 / 60;

  // dps per soldier = dmg * rate * (multi || 1). Each tier is clearly stronger than the last.
  const WEAPONS = [
    { name: "Stones", emoji: "🪨", dmg: 1, rate: 2, speed: 420, cap: 6, kind: "stone" },
    { name: "Axes", emoji: "🪓", dmg: 2, rate: 2, speed: 430, cap: 6, kind: "axe" },
    { name: "Bows", emoji: "🏹", dmg: 3, rate: 2.5, speed: 620, cap: 6, kind: "arrow" },
    { name: "Pistol", emoji: "🔫", dmg: 4, rate: 3, speed: 650, cap: 6, kind: "dart" },
    { name: "Two pistols", emoji: "🔫🔫", dmg: 4, rate: 3, multi: 2, speed: 650, cap: 6, kind: "dart" },
    { name: "Cannon", emoji: "💣", dmg: 25, rate: 1.2, speed: 420, cap: 3, splash: 45, kind: "ball" },
    { name: "Gatling", emoji: "💥", dmg: 5, rate: 10, speed: 760, cap: 4, kind: "pellet" },
    { name: "Tank", emoji: "🛡️", dmg: 60, rate: 1.5, speed: 520, cap: 2, splash: 55, kind: "shell" },
    { name: "Missiles", emoji: "🚀", dmg: 50, rate: 1.5, multi: 2, speed: 480, cap: 3, splash: 60, kind: "missile" },
    { name: "Planes", emoji: "✈️", dmg: 125, rate: 2, speed: 380, cap: 2, splash: 60, kind: "plane" },
    { name: "Satellite laser", emoji: "🛰️", dmg: 100, rate: 4, speed: 1100, cap: 2, pierce: 3, kind: "laser" },
    { name: "Mega bomb", emoji: "☢️", dmg: 700, rate: 1, speed: 360, cap: 1, splash: 130, kind: "bomb" },
  ];

  // hp is a multiple of the wave's toughness. bite = soldiers lost when it reaches the sandbags.
  const ENEMIES = {
    thrower: { name: "Stone thrower", r: 20, speed: 40, hp: 1, bite: 1, color: "#f4a261", hat: "bandana", prop: "stone", mouth: "tongue" },
    boss: { name: "Big Boss", r: 40, speed: 22, hp: 7, bite: 3, color: "#e76f51", hat: "crown", prop: "club", mouth: "teeth" },
    soldier: { name: "Soldier", r: 21, speed: 46, hp: 1.2, bite: 1, color: "#c9a0dc", hat: "helmet", prop: "stick", mouth: "smile" },
    cannon: { name: "Cannon crew", r: 24, speed: 34, hp: 2, bite: 2, color: "#ffb4a2", hat: "helmet", prop: "cannon", mouth: "o" },
    bigboss: { name: "Big Big Boss", r: 55, speed: 17, hp: 14, bite: 5, color: "#ef476f", hat: "crown", prop: "club", mouth: "teeth", mustache: true },
    tank: { name: "Tank", r: 32, speed: 30, hp: 3, bite: 3, color: "#90a955", tank: true },
    bigtank: { name: "Big tank", r: 45, speed: 23, hp: 6, bite: 5, color: "#bc6c25", tank: true },
    tankboss: { name: "Tank Boss", r: 62, speed: 15, hp: 20, bite: 10, color: "#6d597a", tank: true, crown: true },
    king: { name: "KING TANK", r: 82, speed: 10, hp: 55, bite: 99, color: "#f4c430", tank: true, crown: true, mustache: true },
  };

  const WAVES = [
    { name: "Stone throwers!", groups: [["thrower", 8]], gap: 2 },
    { name: "Here comes Big Boss!", groups: [["thrower", 8], ["boss", 1]], gap: 1.8 },
    { name: "Soldiers!", groups: [["soldier", 12]], gap: 1.5 },
    { name: "Two Big Bosses!", groups: [["soldier", 10], ["boss", 2]], gap: 1.5 },
    { name: "Cannons!", groups: [["soldier", 8], ["cannon", 7]], gap: 1.4 },
    { name: "Big Big Boss!", groups: [["cannon", 9], ["bigboss", 1]], gap: 1.4 },
    { name: "Tanks!", groups: [["soldier", 6], ["tank", 8]], gap: 1.4 },
    { name: "Bigger tanks!", groups: [["tank", 8], ["bigtank", 4]], gap: 1.4 },
    { name: "Boss parade!", groups: [["bigtank", 6], ["bigboss", 2]], gap: 1.5 },
    { name: "Tank Boss!", groups: [["tank", 10], ["tankboss", 1]], gap: 1.3 },
    { name: "The whole tank army!", groups: [["bigtank", 10], ["tankboss", 2]], gap: 1.3 },
    { name: "THE KING TANK!", groups: [["tank", 10], ["king", 1]], gap: 1.3 },
  ];
  // How tough each wave is (roughly the firepower a good player has by then).
  const POWER = [2, 10, 50, 200, 480, 900, 1500, 2600, 4400, 7000, 11000, 13000];

  const POOF_WORDS = ["POOF!", "BOING!", "Bye-bye!", "Oof!", "Wheee!", "Ouchie!", "BONK!", "Oopsie!"];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const el = {
    wave: document.getElementById("wave"),
    hearts: document.getElementById("hearts"),
    soldiers: document.getElementById("soldiers"),
    weapon: document.getElementById("weapon"),
  };

  let g;            // everything about the current battle
  let state = "ready";
  let time = 0;     // seconds, keeps animations going on every screen
  let endedAt = -10; // a short pause after the end, so a stray tap does not restart at once
  const input = { left: false, right: false, targetX: null, dragging: false };

  function newGame() {
    g = {
      wave: 0, spawnQueue: [], spawnIn: 0, breakIn: 2.5, banner: null,
      enemies: [], bullets: [], doors: [], doorIn: 4, fx: [], tumblers: [],
      soldiers: 1, tier: 0, hearts: 3, squadX: W / 2, fireIn: 0.3, shake: 0, hurt: 0,
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
    g.banner = { text: "Wave " + (i + 1) + ": " + wave.name, t: 2.5 };
    // A fresh pair of doors with every wave, so there is always something to aim for.
    g.doorIn = Math.min(g.doorIn, 1);
    syncStats();
  }

  function dps() {
    const w = WEAPONS[g.tier];
    return w.dmg * w.rate * (w.multi || 1) * g.soldiers;
  }

  function fmt(n) {
    n = Math.ceil(n);
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return Math.round(n / 1000) + "k";
  }

  function syncStats() {
    el.wave.textContent = g.wave + 1;
    el.hearts.textContent = g.hearts;
    el.soldiers.textContent = g.soldiers;
    const w = WEAPONS[g.tier];
    el.weapon.textContent = w.emoji + " " + w.name;
  }

  // ---------- Spawning ----------

  function spawnEnemy(type) {
    const T = ENEMIES[type];
    const hp = Math.max(1, Math.round(T.hp * POWER[g.wave]));
    g.enemies.push({
      type, x: T.r + 10 + Math.random() * (W - 2 * T.r - 20), y: -T.r - 10,
      hp, maxHp: hp, shownHp: hp, flash: 0, seed: Math.random() * 10, wobble: 0.6 + Math.random() * 0.8,
    });
  }

  function spawnDoors() {
    if (g.noDoors) return;
    const army = (amount, hpFor) => ({ kind: "army", amount, hp: hpFor, maxHp: hpFor });
    const base = 1 + Math.floor(g.wave * 0.5);
    const d = dps();
    const doorHp = (secs) => Math.max(4, Math.ceil(d * secs));
    let a, b;
    const canUpgrade = g.tier < WEAPONS.length - 1 && g.tier <= g.wave + 1;
    if (canUpgrade) {
      a = { kind: "weapon", tier: g.tier + 1, hp: doorHp(2.4), maxHp: doorHp(2.4) };
      b = army(base + (Math.random() < 0.5 ? 1 : 0), doorHp(2));
    } else {
      a = army(base, doorHp(1.6));
      b = army(base * 2 + 1, doorHp(3.2));
    }
    if (Math.random() < 0.5) [a, b] = [b, a];
    a.x0 = 18; a.x1 = W / 2 - 12;
    b.x0 = W / 2 + 12; b.x1 = W - 18;
    g.doors.push({ y: -90, h: 84, speed: 52, list: [a, b] });
  }

  // ---------- Update ----------

  function squadSpots() {
    // Front row of up to 6, more rows behind. Big armies are drawn as 18 soldiers plus a number.
    const n = Math.min(g.soldiers, 18);
    const spots = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 6);
      const inRow = Math.min(6, n - row * 6);
      const col = i % 6;
      spots.push({ x: g.squadX + (col - (inRow - 1) / 2) * 27, y: SQUAD_Y + row * 18, i });
    }
    return spots;
  }

  function squadHalfWidth() {
    return (Math.min(6, g.soldiers) - 1) * 13.5 + 15;
  }

  function fire() {
    const w = WEAPONS[g.tier];
    const spots = squadSpots().slice(0, 6);
    // Spread the shooters across the front row.
    const count = Math.min(w.cap, spots.length);
    const shooters = [];
    for (let i = 0; i < count; i++) {
      shooters.push(spots[Math.round(count === 1 ? (spots.length - 1) / 2 : i * (spots.length - 1) / (count - 1))]);
    }
    const multi = w.multi || 1;
    const dmg = (w.dmg * g.soldiers) / shooters.length;
    shooters.forEach((s) => {
      for (let m = 0; m < multi; m++) {
        const off = multi > 1 ? (m - 0.5) * 10 : 0;
        g.bullets.push({ x: s.x + off, y: s.y - 14, vy: -w.speed, dmg, kind: w.kind,
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
    if (word) g.fx.push({ type: "text", text: word, x, y: y - r, vy: -50, t: 0, life: 1, size: 18 + r * 0.3, color: "#fff" });
  }

  function boom(x, y, radius) {
    g.fx.push({ type: "boom", x, y, r: radius, t: 0, life: 0.45 });
    if (radius >= 100) {
      g.fx.push({ type: "text", text: "KA-BOOM!", x, y: y - 20, vy: -40, t: 0, life: 1.2, size: 40, color: "#ffd93d" });
      g.shake = 0.35;
    }
  }

  function breakDoor(pair, door) {
    door.broken = true;
    const cx = (door.x0 + door.x1) / 2;
    const cy = pair.y + pair.h / 2;
    for (let i = 0; i < 24; i++) {
      g.fx.push({ type: "confetti", x: cx + (Math.random() - 0.5) * 120, y: cy, vx: (Math.random() - 0.5) * 300,
        vy: -150 - Math.random() * 250, t: 0, life: 1.4, rot: Math.random() * 6,
        color: ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77", "#9b5de5"][i % 5] });
    }
    let text;
    if (door.kind === "weapon") {
      g.tier = Math.max(g.tier, door.tier);
      text = WEAPONS[g.tier].name + "!";
    } else {
      g.soldiers = Math.min(40, g.soldiers + door.amount);
      text = "+" + door.amount + " soldiers!";
    }
    g.banner = { text: "🎉 " + text, t: 1.8 };
    // You only get one door of the pair: the other one fades away.
    pair.list.forEach((d) => { if (d !== door) d.gone = true; });
    pair.done = true;
    syncStats();
  }

  function breakThrough(e) {
    const T = ENEMIES[e.type];
    g.enemies.splice(g.enemies.indexOf(e), 1);
    poof(e.x, WALL_Y, T.r, "Hee hee!");
    g.leaks = (g.leaks || 0) + 1;
    g.shake = 0.3;
    g.hurt = 0.4;
    if (g.soldiers > 1) {
      const lost = Math.min(T.bite, g.soldiers - 1);
      const spots = squadSpots();
      for (let i = 0; i < lost; i++) {
        const s = spots[Math.max(0, spots.length - 1 - i)] || { x: g.squadX, y: SQUAD_Y };
        g.tumblers.push({ type: "friend", x: s.x, y: s.y, vx: (Math.random() - 0.5) * 300, vy: -300,
          rot: 0, vr: 12, seed: Math.random() * 10, t: 0 });
      }
      g.soldiers -= lost;
      g.fx.push({ type: "text", text: "-" + lost + " 👥", x: g.squadX, y: SQUAD_Y - 30, vy: -40, t: 0, life: 1.2, size: 26, color: "#ff6b6b" });
    } else {
      g.hearts--;
      g.fx.push({ type: "text", text: "💔", x: g.squadX, y: SQUAD_Y - 30, vy: -40, t: 0, life: 1.2, size: 34, color: "#ff6b6b" });
      if (g.hearts <= 0) gameOver();
    }
    syncStats();
  }

  function update(dt) {
    if (state !== "playing") return;
    const w = WEAPONS[g.tier];

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
        g.banner = { text: "Wave " + (g.wave + 1) + " done! ⭐", t: 2.4 };
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
    });
    g.doors = g.doors.filter((p) => p.y < WALL_Y - p.h + 10 && !(p.done && p.list.every((d) => d.fade > 0.5)));

    // Enemies march down.
    g.enemies.slice().forEach((e) => {
      const T = ENEMIES[e.type];
      e.y += T.speed * dt;
      e.x += Math.sin(time * e.wobble + e.seed) * 14 * dt;
      e.x = Math.max(T.r, Math.min(W - T.r, e.x));
      e.flash = Math.max(0, e.flash - dt);
      e.shownHp += (e.hp - e.shownHp) * Math.min(1, dt * 6);
      if (e.y + T.r * 0.6 >= WALL_Y) breakThrough(e);
    });
    if (state !== "playing") return;

    // Bullets fly up and hit the first thing in their way.
    g.bullets.forEach((b) => {
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
            g.fx.push({ type: "pow", x: b.x, y: b.y, t: 0, life: 0.2 });
          }
          b.hit.push(e);
          if (b.hit.length > b.pierce) { b.dead = true; return; }
        }
      }
      for (const p of g.doors) {
        if (p.done || b.y > p.y + p.h || b.y < p.y) continue;
        for (const d of p.list) {
          if (b.x < d.x0 || b.x > d.x1) continue;
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
    g.bullets = g.bullets.filter((b) => !b.dead && b.y > -40);

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

  function gameOver() {
    state = "over";
    endedAt = time;
    g.banner = null;
    g.doors = [];
  }

  function win() {
    state = "won";
    endedAt = time;
    g.banner = null;
    g.doors = [];
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
    const swing = Math.sin(time * 4 + e.seed) * 0.6;
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
      ctx.translate(0, T.tank ? 0 : -Math.abs(Math.sin(time * 8 + e.seed)) * T.r * 0.12);
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

  function drawSoldier(x, y, hero, kick, dizzy, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(1.3, 1.3);
    const bob = dizzy ? 0 : Math.abs(Math.sin(time * 9 + x * 0.1)) * 2;
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
    if (dizzy) {
      ctx.fillStyle = "#2b2d42";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Oops!", 0, -18);
    } else {
      weaponIcon(g.tier, 10, -6, 9);
    }
    ctx.restore();
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
    // Frame + panel.
    ctx.fillStyle = "#7f5539";
    rr(x - 6, y - 6, w + 12, h + 12, 12); ctx.fill();
    ctx.fillStyle = d.flash ? "#fff" : weapon ? "#ffd166" : "#90e0ef";
    rr(x, y, w, h, 8); ctx.fill();
    circle(x + w - 12, y + h / 2 - 6, 4, "#7f5539");
    if (d.broken) {
      ctx.fillStyle = "#2b2d42";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OPEN!", x + w / 2, y + h / 2 + 8);
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
    } else {
      drawSoldier(x + 32, y + 40, false, 0);
      ctx.font = "bold 34px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.fillStyle = "#2b2d42";
      ctx.textAlign = "left";
      ctx.fillText("+" + d.amount, x + 58, y + 48);
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

  function wrapText(text, x, y, maxW) {
    const words = text.split(" ");
    let line = "";
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
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
    ctx.fillStyle = "#95d5b2";
    ctx.fillRect(0, 0, W, H);
    // Stripes scroll toward you, like the army is running up.
    ctx.fillStyle = "#a7e0c0";
    const off = (time * 40) % 80;
    for (let y = -80 + off; y < H; y += 80) ctx.fillRect(0, y, W, 40);
    // Little flowers.
    for (let i = 0; i < 10; i++) {
      const fx = (i * 97) % W + 10;
      const fy = ((i * 173 + time * 40) % (H + 40)) - 20;
      circle(fx, fy, 4, i % 2 ? "#fff" : "#ffd93d");
    }
    // Sandbag wall.
    for (let x = 0; x < W + 30; x += 34) {
      ctx.fillStyle = "#d4a373";
      rr(x - 4, WALL_Y - 8, 34, 16, 8); ctx.fill();
      ctx.strokeStyle = "#a47148"; ctx.lineWidth = 2; ctx.stroke();
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
      ctx.strokeText(text, W / 2, y);
      ctx.fillStyle = color || "#fff";
      ctx.fillText(text, W / 2, y);
      y += size + 14;
    });
  }

  function draw() {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * g.shake, (Math.random() - 0.5) * 12 * g.shake);
    drawField();

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

    g.bullets.forEach(drawBullet);

    // Your army: back rows first.
    const spots = squadSpots();
    spots.slice().reverse().forEach((s) => drawSoldier(s.x, s.y, s.i === 0, s.i < 6 && g.kick > 0 ? 1 : 0));
    if (g.soldiers > 1) {
      const lx = Math.max(30, Math.min(W - 30, g.squadX));
      ctx.font = "bold 20px 'Comic Sans MS', 'Chalkboard SE', sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2b2d42"; ctx.lineWidth = 5;
      ctx.strokeText("👥 " + g.soldiers, lx, H - 6); ctx.fillText("👥 " + g.soldiers, lx, H - 6);
    }

    g.tumblers.forEach((t) => {
      if (t.type === "friend") drawSoldier(t.x, t.y, false, 0, true, t.rot);
      else drawEnemy({ type: t.type, x: t.x, y: t.y, rot: t.rot, seed: t.seed, flash: 0 }, true);
    });

    drawFx();
    ctx.restore();

    if (g.hurt > 0) {
      ctx.fillStyle = "rgba(255, 107, 107, " + g.hurt * 0.6 + ")";
      ctx.fillRect(0, 0, W, H);
    }

    if (state === "playing" && g.banner && g.banner.t > 0) {
      ctx.globalAlpha = Math.min(1, g.banner.t * 2);
      ctx.fillStyle = "rgba(43, 45, 66, 0.7)";
      rr(20, H * 0.36, W - 40, 60, 16); ctx.fill();
      ctx.font = "bold 26px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(g.banner.text, W / 2, H * 0.36 + 40, W - 60);
      ctx.globalAlpha = 1;
    }

    if (state !== "playing") {
      ctx.fillStyle = "rgba(43, 45, 66, 0.45)";
      ctx.fillRect(0, 0, W, H);
      if (state === "ready") {
        bigText([["🪖 Army Rush!", 44, "#ffd93d"], ["A silly army is coming!", 24], ["Shoot doors to get", 24],
          ["better weapons 🏹", 24], ["and more soldiers 👥", 24], ["Tap to start!", 32, "#6bcb77"]], H * 0.22);
      } else if (state === "over") {
        bigText([["Oh no! 😵", 48, "#ff6b6b"], ["They got through!", 28], ["You reached wave " + (g.wave + 1), 26],
          ["Tip: open more doors!", 24, "#ffd93d"], ["Tap to try again", 32, "#6bcb77"]], H * 0.28);
      } else {
        bigText([["YOU WIN! 🏆", 50, "#ffd93d"], ["The King Tank", 28], ["went BOING!", 28],
          ["Tap to play again", 30, "#6bcb77"]], H * 0.32);
      }
      drawFx("confetti");
    }
  }

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
    return ((e.clientX - rect.left) / rect.width) * W;
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

  // ?debug lets the test script fast-forward the battle and steer the army.
  if (/[?&]debug/.test(location.search)) {
    window.armyDebug = {
      get g() { return g; }, get state() { return state; }, dps, WEAPONS, ENEMIES, input, start,
      step(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } },
    };
  }

  newGame();
  requestAnimationFrame(loop);
})();
