// Jumpy Frog: jump over rocks, score goes up for each rock you clear.
(function () {
  const t = I18n.t;
  const W = 800;
  const H = 300;
  const GROUND = 250;
  const GRAVITY = 0.6;
  const JUMP_SPEED = -13;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");

  const frog = { x: 90, y: GROUND, w: 44, h: 40, vy: 0 };
  let rocks, clouds, speed, score, best = 0, spawnIn, state = "ready", rafId;

  function reset() {
    frog.y = GROUND;
    frog.vy = 0;
    rocks = [];
    clouds = [{ x: 120, y: 60 }, { x: 450, y: 40 }, { x: 700, y: 80 }];
    speed = 4;
    score = 0;
    spawnIn = 90;
    scoreEl.textContent = 0;
  }

  function jump() {
    if (state === "ready" || state === "over") {
      reset();
      state = "playing";
      messageEl.textContent = t("Jump! 🐸");
      cancelAnimationFrame(rafId);
      lastTime = 0;
      acc = 0;
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (frog.y >= GROUND) frog.vy = JUMP_SPEED;
  }

  function spawnRock() {
    const size = 26 + Math.random() * 18;
    rocks.push({ x: W + 20, w: size, h: size * 0.8, passed: false });
    // Leave plenty of room between rocks; gaps shrink a little as speed grows.
    spawnIn = 70 + Math.random() * 80 - speed * 2;
  }

  function hits(rock) {
    // Slightly forgiving hitbox so near-misses count as jumps.
    const pad = 8;
    const fx1 = frog.x + pad, fx2 = frog.x + frog.w - pad;
    const fy2 = frog.y - pad / 2;
    const rx1 = rock.x, rx2 = rock.x + rock.w;
    const ry1 = GROUND - rock.h;
    return fx2 > rx1 && fx1 < rx2 && fy2 > ry1;
  }

  function update() {
    frog.vy += GRAVITY;
    frog.y = Math.min(GROUND, frog.y + frog.vy);
    if (frog.y === GROUND) frog.vy = 0;

    if (--spawnIn <= 0) spawnRock();
    rocks.forEach((r) => { r.x -= speed; });
    rocks = rocks.filter((r) => r.x + r.w > -10);
    clouds.forEach((c) => { c.x -= speed * 0.2; if (c.x < -80) c.x = W + 40; });

    for (const r of rocks) {
      if (hits(r)) return gameOver();
      if (!r.passed && r.x + r.w < frog.x) {
        r.passed = true;
        score++;
        scoreEl.textContent = score;
        if (score % 5 === 0) messageEl.textContent = t("{n} rocks! Super! 🌟", { n: score });
        speed = Math.min(9, 4 + score * 0.15);
      }
    }
  }

  function drawFrog() {
    const x = frog.x, y = frog.y - frog.h;
    ctx.fillStyle = "#6bcb77";
    ctx.beginPath();
    ctx.ellipse(x + frog.w / 2, y + frog.h * 0.6, frog.w / 2, frog.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    [x + 12, x + frog.w - 12].forEach((ex) => {
      ctx.fillStyle = "#6bcb77";
      ctx.beginPath(); ctx.arc(ex, y + 10, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ex, y + 9, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b2d42";
      ctx.beginPath(); ctx.arc(ex + 1, y + 9, 3, 0, Math.PI * 2); ctx.fill();
    });
    // Smile
    ctx.strokeStyle = "#2b2d42";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + frog.w / 2, y + frog.h * 0.55, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  function drawRock(r) {
    ctx.fillStyle = "#8d99ae";
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, GROUND, r.w / 2, r.h, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(r.x + r.w * 0.4, GROUND - r.h * 0.6, r.w * 0.15, r.h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#bde0fe");
    sky.addColorStop(1, "#e7f6ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffd93d";
    ctx.beginPath(); ctx.arc(W - 70, 55, 30, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#fff";
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
      ctx.arc(c.x + 22, c.y - 8, 22, 0, Math.PI * 2);
      ctx.arc(c.x + 46, c.y, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#95d5b2";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#74c69d";
    ctx.fillRect(0, GROUND, W, 6);

    rocks.forEach(drawRock);
    drawFrog();
  }

  // Fixed 60 steps per second so the game runs at the same speed on every screen.
  const STEP = 1000 / 60;
  let lastTime = 0, acc = 0;

  function loop(time) {
    if (state !== "playing") return;
    acc += Math.min(100, time - (lastTime || time));
    lastTime = time;
    while (acc >= STEP && state === "playing") {
      update();
      acc -= STEP;
    }
    draw();
    if (state === "playing") rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    state = "over";
    best = Math.max(best, score);
    bestEl.textContent = best;
    messageEl.textContent = t("Bonk! You jumped {n} rocks. Tap to try again!", { n: score });
  }

  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
  document.getElementById("jump").addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "ArrowUp") {
      e.preventDefault();
      jump();
    }
  });

  reset();
  draw();
})();
