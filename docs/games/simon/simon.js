// Copy Me: watch a growing sequence of pads light up, then repeat it.
(function () {
  const t = I18n.t;
  const NOTES = [329.6, 392.0, 523.3, 659.3];

  const pads = Array.from(document.querySelectorAll(".pad"));
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");
  const startBtn = document.getElementById("start");

  let sequence = [], step = 0, best = 0, state = "ready", audio = null, timers = [];

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function beep(i, ms) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = NOTES[i];
      osc.type = "triangle";
      gain.gain.setValueAtTime(0.2, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + ms / 1000);
    } catch (e) {
      // No sound available: the game still works with lights only.
    }
  }

  function flash(i, ms) {
    pads[i].classList.add("lit");
    beep(i, ms);
    later(() => pads[i].classList.remove("lit"), ms);
  }

  function setPadsEnabled(on) {
    pads.forEach((p) => (p.disabled = !on));
  }

  function playSequence() {
    state = "showing";
    setPadsEnabled(false);
    messageEl.textContent = t("👀 Watch...");
    messageEl.classList.remove("win");
    // Gets a little faster as the sequence grows, but stays kid-paced.
    const gap = Math.max(420, 750 - sequence.length * 25);
    sequence.forEach((pad, k) => later(() => flash(pad, gap * 0.65), 600 + k * gap));
    later(() => {
      state = "input";
      step = 0;
      setPadsEnabled(true);
      messageEl.textContent = t("Your turn! 👆");
    }, 600 + sequence.length * gap);
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * 4));
    scoreEl.textContent = sequence.length - 1;
    playSequence();
  }

  function start() {
    timers.forEach(clearTimeout);
    timers = [];
    pads.forEach((p) => p.classList.remove("lit"));
    sequence = [];
    startBtn.textContent = t("Restart");
    nextRound();
  }

  function press(i) {
    if (state !== "input") return;
    flash(i, 250);
    if (i !== sequence[step]) {
      state = "over";
      setPadsEnabled(false);
      const score = sequence.length - 1;
      best = Math.max(best, score);
      bestEl.textContent = best;
      messageEl.textContent = t("Oops! You copied {n}. Press Play to try again.", { n: score });
      startBtn.textContent = t("Play");
      flash(sequence[step], 900);
      return;
    }
    step++;
    if (step === sequence.length) {
      state = "showing";
      scoreEl.textContent = sequence.length;
      messageEl.textContent = I18n.list(["Great! 🌟", "Yes! 🎉", "Super memory! 🧠"])[sequence.length % 3];
      messageEl.classList.add("win");
      later(nextRound, 900);
    }
  }

  pads.forEach((p, i) => p.addEventListener("click", () => press(i)));
  startBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 4) press(n - 1);
    else if ((e.key === " " || e.key === "Enter") && state !== "input" && state !== "showing" && document.activeElement === document.body) {
      e.preventDefault();
      start();
    }
  });
})();
