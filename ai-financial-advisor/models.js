/* Additional forecasting models for the AI Financial Advisor prototype.
   forecast.js already provides the "Linear trend" model (log-price
   regression) via analyzeAsset(); this file adds independent alternative
   models plus an ensemble that blends all of them, so several methods can
   be compared side by side rather than presenting one number as "the"
   forecast.

   Series are passed around as { dates: [...], closes: [...] } (parallel
   arrays), matching forecast.js — not arrays of {t,c} objects — so large
   histories don't carry a repeated-key-name object per bar.

   Every price-direction model exposes the same shape:
     { key, label, methodNote, path: [{t,c}], forecastChangePct, meta }
   where `path` starts at the last actual bar and extends `daysAhead` days
   forward. Models that don't apply (e.g. too little data) return null. */

const TRADING_DAYS_PER_YEAR = 252;

function logReturnsFromCloses(closes) {
  const out = new Array(closes.length - 1);
  for (let i = 1; i < closes.length; i++) out[i - 1] = Math.log(closes[i] / closes[i - 1]);
  return out;
}

function datesForward(lastDate, daysAhead, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const frac = (daysAhead * i) / steps;
    out.push(new Date(lastDate.getTime() + frac * 86400000));
  }
  return out;
}

function pctChange(from, to) {
  return (to / from - 1) * 100;
}

function smaAt(arr, window, endIdx) {
  const start = Math.max(0, endIdx - window + 1);
  let sum = 0;
  for (let i = start; i <= endIdx; i++) sum += arr[i];
  return sum / (endIdx - start + 1);
}

/* ---------- 2. Moving Average Crossover ---------- */
/* Short vs long simple moving average on log-price. The forecast
   extrapolates the short MA's most recent slope — a smoother, less
   outlier-sensitive alternative to the raw linear-trend fit. */
function movingAverageModel(series, daysAhead, shortWindow = 20, longWindow = 50) {
  const n = series.closes.length;
  if (n < longWindow + 5) return null;

  const logPrices = series.closes.map((c) => Math.log(c));

  const shortMA = new Array(n);
  const longMA = new Array(n);
  for (let i = 0; i < n; i++) {
    shortMA[i] = smaAt(logPrices, shortWindow, i);
    longMA[i] = smaAt(logPrices, longWindow, i);
  }

  const lookback = Math.min(shortWindow, n - 1);
  const recentSlope = (shortMA[n - 1] - shortMA[n - 1 - lookback]) / lookback;

  const lastDate = new Date(series.dates[n - 1]);
  const lastLogPrice = shortMA[n - 1];
  const steps = 24;
  const dates = datesForward(lastDate, daysAhead, steps);
  const path = dates.map((d, i) => ({
    t: d.toISOString().slice(0, 10),
    c: Math.exp(lastLogPrice + recentSlope * ((daysAhead * i) / steps)),
  }));

  const crossover = shortMA[n - 1] >= longMA[n - 1] ? 'golden' : 'death';

  return {
    key: 'ma-crossover',
    label: 'Moving Average Crossover',
    methodNote: `${shortWindow}-bar vs ${longWindow}-bar SMA on log-price; forecast extrapolates the short MA's recent slope.`,
    path,
    forecastChangePct: pctChange(series.closes[n - 1], path[path.length - 1].c),
    meta: { crossover, shortMA: Math.exp(shortMA[n - 1]), longMA: Math.exp(longMA[n - 1]) },
  };
}

/* ---------- 3. ARIMA (simplified: differenced series + AR(1)) ---------- */
/* A full ARIMA(p,d,q) fit (MLE over AR and MA terms) is out of scope for a
   client-side prototype. This implements the well-known ARIMA(1,1,0)
   special case explicitly: difference the log-price series once (the "I"),
   then fit a first-order autoregression on the differences (the "AR"),
   with no moving-average term. Honestly labeled as a simplification. */
function arimaModel(series, daysAhead) {
  const n = series.closes.length;
  if (n < 30) return null;

  const logPrices = series.closes.map((c) => Math.log(c));
  const diffs = new Array(n - 1);
  for (let i = 1; i < n; i++) diffs[i - 1] = logPrices[i] - logPrices[i - 1];

  // AR(1) on the differenced series: diff[t] = phi * diff[t-1] + c
  const x = diffs.slice(0, -1);
  const y = diffs.slice(1);
  const m = x.length;
  const xMean = x.reduce((a, b) => a + b, 0) / m;
  const yMean = y.reduce((a, b) => a + b, 0) / m;
  let num = 0;
  let den = 0;
  for (let i = 0; i < m; i++) {
    num += (x[i] - xMean) * (y[i] - yMean);
    den += (x[i] - xMean) ** 2;
  }
  const phi = den === 0 ? 0 : Math.max(-0.98, Math.min(0.98, num / den)); // clamp for stability
  const c = yMean - phi * xMean;
  const longRunDiff = den === 0 ? yMean : c / (1 - phi); // AR(1) unconditional mean

  const lastDate = new Date(series.dates[n - 1]);
  let lastLogPrice = logPrices[n - 1];
  let lastDiff = diffs[diffs.length - 1];

  const dailyPath = [{ t: series.dates[n - 1], c: series.closes[n - 1] }];
  const daysToProject = Math.ceil(daysAhead);
  for (let i = 1; i <= daysToProject; i++) {
    const nextDiff = phi * lastDiff + c;
    lastLogPrice += nextDiff;
    lastDiff = nextDiff;
    const d = new Date(lastDate.getTime() + i * 86400000);
    dailyPath.push({ t: d.toISOString().slice(0, 10), c: Math.exp(lastLogPrice) });
  }

  // Downsample to ~24 points for consistent chart resolution
  const steps = 24;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const idx = Math.round((i / steps) * (dailyPath.length - 1));
    path.push(dailyPath[idx]);
  }

  return {
    key: 'arima',
    label: 'ARIMA(1,1,0)',
    methodNote: 'Simplified ARIMA: log-price differenced once, then a first-order autoregression fit on the differences (no MA term). phi=' + phi.toFixed(3) + '.',
    path,
    forecastChangePct: pctChange(series.closes[n - 1], path[path.length - 1].c),
    meta: { phi, longRunDailyDrift: longRunDiff },
  };
}

/* ---------- 4. Holt's Linear Trend (damped double exponential smoothing) ---------- */
/* Holt-Winters without the seasonal component (irregular trading calendars
   make a clean seasonal period hard to define here) — level + trend
   smoothing on log-price, a standard alternative to a single regression
   line that adapts faster to recent direction changes. Uses a damping
   factor (phi < 1) on the trend, the standard fix for plain Holt's linear
   trend: without damping, a locally-elevated trend estimate compounds
   linearly forever and produces wildly overconfident long-horizon forecasts. */
function holtLinearModel(series, daysAhead, alpha = 0.3, beta = 0.1, phi = 0.98) {
  const n = series.closes.length;
  if (n < 10) return null;

  const logPrices = series.closes.map((c) => Math.log(c));
  let level = logPrices[0];
  let trend = logPrices[1] - logPrices[0];

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * logPrices[i] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }

  const lastDate = new Date(series.dates[n - 1]);
  const steps = 24;
  const dates = datesForward(lastDate, daysAhead, steps);
  // Damped multi-step-ahead forecast: level + trend * (phi^1 + phi^2 + ... + phi^h),
  // using the geometric series closed form so fractional h (sub-day steps) work too.
  const dampedTrendSum = (h) => (h <= 0 ? 0 : (phi * (1 - Math.pow(phi, h))) / (1 - phi));
  const path = dates.map((d, i) => {
    const h = (daysAhead * i) / steps;
    return { t: d.toISOString().slice(0, 10), c: Math.exp(level + dampedTrendSum(h) * trend) };
  });

  return {
    key: 'holt-linear',
    label: "Holt's Linear Trend",
    methodNote: `Damped double exponential smoothing on log-price (level + trend, no seasonality), alpha=${alpha}, beta=${beta}, phi=${phi} (trend damping).`,
    path,
    forecastChangePct: pctChange(series.closes[n - 1], path[path.length - 1].c),
    meta: { level: Math.exp(level), dailyTrend: trend },
  };
}

/* ---------- 5. GARCH(1,1) — volatility forecast ---------- */
/* Forecasts forward volatility, not price direction. Used to size the
   ensemble's uncertainty band instead of producing its own price line. */
function garchModel(series) {
  const returns = logReturnsFromCloses(series.closes);
  if (returns.length < 30) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const centered = returns.map((r) => r - mean);
  const unconditionalVar = centered.reduce((a, b) => a + b * b, 0) / centered.length;

  // Fixed, commonly-used starting weights for a prototype (omega small,
  // alpha+beta close to but under 1 for a persistent-but-stationary process)
  // rather than a full MLE fit, which needs numerical optimization.
  const alpha = 0.08;
  const beta = 0.9;
  const omega = unconditionalVar * (1 - alpha - beta);

  let variance = unconditionalVar;
  for (let i = 0; i < centered.length; i++) {
    variance = omega + alpha * centered[i] * centered[i] + beta * variance;
  }

  const dailyVol = Math.sqrt(Math.max(variance, 1e-10));
  const annualVol = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Forecast forward: GARCH(1,1) variance reverts toward the unconditional
  // variance; h-day-ahead expected variance has a closed form.
  function varianceAtHorizon(h) {
    if (alpha + beta >= 1) return variance; // non-stationary fallback
    const persistence = alpha + beta;
    return unconditionalVar + (variance - unconditionalVar) * persistence ** h;
  }

  return {
    key: 'garch',
    label: 'GARCH(1,1)',
    methodNote: 'Forecasts volatility, not price direction — sets the ensemble\'s uncertainty band width. Fixed alpha=0.08, beta=0.90 (not fit via MLE).',
    forecastChangePct: null,
    currentAnnualVolPct: annualVol * 100,
    varianceAtHorizonDays: (h) => varianceAtHorizon(h),
    meta: { alpha, beta, omega, dailyVol, annualVol },
  };
}

/* ---------- 6. Feature Regression ("ML-style") ---------- */
/* A small hand-rolled linear regression predicting next-period log-return
   from engineered features (lagged return, short-vs-long MA gap, and an
   RSI-like momentum measure). Genuinely a basic machine-learning approach
   (feature engineering + linear model), computed fresh in-browser with no
   training/storage step — not a stand-in for a real Random Forest/LSTM. */
function featureRegressionModel(series, daysAhead) {
  const n = series.closes.length;
  if (n < 40) return null;

  const logPrices = series.closes.map((c) => Math.log(c));
  const rets = logReturnsFromCloses(series.closes);

  function rsiLike(idx, window = 14) {
    const start = Math.max(1, idx - window + 1);
    let gains = 0;
    let losses = 0;
    for (let i = start; i <= idx; i++) {
      const r = rets[i - 1];
      if (r > 0) gains += r;
      else losses -= r;
    }
    const total = gains + losses;
    return total === 0 ? 0.5 : gains / total; // 0..1, like RSI/100
  }

  // Build feature rows: for each day t (with enough history), features
  // describe day t, target is the return realized on day t+1.
  const rows = [];
  for (let i = 20; i < rets.length; i++) {
    const shortMA = smaAt(logPrices, 5, i);
    const longMA = smaAt(logPrices, 20, i);
    const maGap = shortMA - longMA;
    const lagReturn = rets[i - 1];
    const rsi = rsiLike(i);
    const target = rets[i];
    rows.push({ features: [1, lagReturn, maGap, rsi - 0.5], target });
  }
  if (rows.length < 15) return null;

  // Ordinary least squares via normal equations (4 features incl. intercept)
  const k = rows[0].features.length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const XtY = new Array(k).fill(0);
  for (const row of rows) {
    for (let a = 0; a < k; a++) {
      XtY[a] += row.features[a] * row.target;
      for (let b = 0; b < k; b++) XtX[a][b] += row.features[a] * row.features[b];
    }
  }
  const coeffs = solveLinearSystem(XtX, XtY);
  if (!coeffs) return null;

  // Predict forward by iterating the model day-by-day, feeding its own
  // predictions back in as the new "lag return" (a simple recursive
  // forecast, same idea as an AR model but with engineered features).
  let curLogPrices = logPrices.slice();
  let curRets = rets.slice();
  const lastDate = new Date(series.dates[n - 1]);
  const dailyPath = [{ t: series.dates[n - 1], c: series.closes[n - 1] }];
  const daysToProject = Math.ceil(daysAhead);

  for (let step = 1; step <= daysToProject; step++) {
    const idx = curLogPrices.length - 1;
    const shortMA = smaAt(curLogPrices, 5, idx);
    const longMA = smaAt(curLogPrices, 20, idx);
    const maGap = shortMA - longMA;
    const lagReturn = curRets[curRets.length - 1];
    const rsi = rsiLikeFromReturns(curRets, 14);
    const features = [1, lagReturn, maGap, rsi - 0.5];
    let predictedReturn = 0;
    for (let a = 0; a < k; a++) predictedReturn += coeffs[a] * features[a];
    predictedReturn = Math.max(-0.15, Math.min(0.15, predictedReturn)); // clamp extreme single-day moves

    const nextLogPrice = curLogPrices[curLogPrices.length - 1] + predictedReturn;
    curLogPrices = [...curLogPrices, nextLogPrice];
    curRets = [...curRets, predictedReturn];

    const d = new Date(lastDate.getTime() + step * 86400000);
    dailyPath.push({ t: d.toISOString().slice(0, 10), c: Math.exp(nextLogPrice) });
  }

  const steps = 24;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const idx = Math.round((i / steps) * (dailyPath.length - 1));
    path.push(dailyPath[idx]);
  }

  return {
    key: 'feature-regression',
    label: 'Feature Regression (ML-style)',
    methodNote: 'Linear regression of next-day return on lagged return, 5/20-day MA gap, and a 14-day RSI-like feature; recursively projected forward. A basic feature-engineering + linear-model approach, not a trained deep model.',
    path,
    forecastChangePct: pctChange(series.closes[n - 1], path[path.length - 1].c),
    meta: { coefficients: coeffs },
  };
}

function rsiLikeFromReturns(rets, window) {
  const start = Math.max(0, rets.length - window);
  let gains = 0;
  let losses = 0;
  for (let i = start; i < rets.length; i++) {
    const r = rets[i];
    if (r > 0) gains += r;
    else losses -= r;
  }
  const total = gains + losses;
  return total === 0 ? 0.5 : gains / total;
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) return null; // singular
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/* ---------- 7. Sentiment Proxy ---------- */
/* No real news/sentiment data source is wired up. This is a clearly-labeled
   SIMULATED signal derived purely from recent price behavior (momentum +
   volatility contraction/expansion), framed the way a sentiment score would
   read, so the UI slot and ensemble math exist — swap in a real news/NLP
   pipeline later without changing the rest of the model. */
function sentimentProxyModel(series, daysAhead) {
  const n = series.closes.length;
  if (n < 20) return null;

  const rets = logReturnsFromCloses(series.closes);
  const recentWindow = Math.min(20, rets.length);
  const recentRets = rets.slice(-recentWindow);
  const recentMeanReturn = recentRets.reduce((a, b) => a + b, 0) / recentRets.length;

  const olderRets = rets.slice(Math.max(0, rets.length - recentWindow * 2), rets.length - recentWindow);
  const olderMeanReturn = olderRets.length ? olderRets.reduce((a, b) => a + b, 0) / olderRets.length : recentMeanReturn;

  // Map recent-vs-older momentum shift onto a -1..+1 "sentiment" score
  const shift = recentMeanReturn - olderMeanReturn;
  const scale = 0.01; // tune so typical shifts land within -1..1
  const sentimentScore = Math.max(-1, Math.min(1, shift / scale));

  // Turn the score into an assumed forward daily drift, smaller than the
  // recent actual drift so this stays a modest tilt, not a dominant signal.
  const impliedDailyDrift = sentimentScore * recentMeanReturn * 0.5;

  const lastDate = new Date(series.dates[n - 1]);
  const lastLogPrice = Math.log(series.closes[n - 1]);
  const steps = 24;
  const dates = datesForward(lastDate, daysAhead, steps);
  const path = dates.map((d, i) => ({
    t: d.toISOString().slice(0, 10),
    c: Math.exp(lastLogPrice + impliedDailyDrift * ((daysAhead * i) / steps)),
  }));

  let label = 'Neutral';
  if (sentimentScore > 0.3) label = 'Positive';
  else if (sentimentScore < -0.3) label = 'Negative';

  return {
    key: 'sentiment-proxy',
    label: 'Sentiment Proxy (simulated)',
    methodNote: 'SIMULATED — no real news/text data source is connected. This score is derived from recent price momentum shift, framed as sentiment, purely to demonstrate where a real news/NLP signal would plug in.',
    path,
    forecastChangePct: pctChange(series.closes[n - 1], path[path.length - 1].c),
    meta: { sentimentScore, label, simulated: true },
  };
}

/* ---------- 8. Monte Carlo Simulation ---------- */
/* Simulates many random price paths under geometric Brownian motion, using
   the historical drift and GARCH-estimated volatility, then reports
   percentile bands across the simulated outcomes at the forecast horizon —
   a distribution instead of one line. */
function monteCarloModel(series, daysAhead, garch, numPaths = 500, keepPaths = true) {
  const n = series.closes.length;
  if (n < 20) return null;

  const rets = logReturnsFromCloses(series.closes);
  const meanDailyReturn = rets.reduce((a, b) => a + b, 0) / rets.length;
  const dailyVol = garch ? garch.meta.dailyVol : annualizedVolatilityFallback(rets) / Math.sqrt(TRADING_DAYS_PER_YEAR);

  const lastPrice = series.closes[n - 1];
  const daysToProject = Math.max(1, Math.round(daysAhead));

  // Simple linear congruential PRNG so results are reproducible per run
  // without depending on Math.random's non-seedable behavior.
  let seed = Math.round(lastPrice * 1000) % 2147483647 || 42;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  function gaussian() {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const finalPrices = [];
  const allPaths = [];
  const pathsToKeep = keepPaths ? Math.min(numPaths, 60) : 0; // keep a subset for chart display

  for (let p = 0; p < numPaths; p++) {
    let logPrice = Math.log(lastPrice);
    const pathPoints = p < pathsToKeep ? [{ dayIndex: 0, c: lastPrice }] : null;
    for (let d = 1; d <= daysToProject; d++) {
      logPrice += meanDailyReturn + dailyVol * gaussian();
      if (pathPoints) pathPoints.push({ dayIndex: d, c: Math.exp(logPrice) });
    }
    finalPrices.push(Math.exp(logPrice));
    if (pathPoints) allPaths.push(pathPoints);
  }

  finalPrices.sort((a, b) => a - b);
  function percentile(p) {
    const idx = Math.min(finalPrices.length - 1, Math.max(0, Math.round((p / 100) * (finalPrices.length - 1))));
    return finalPrices[idx];
  }

  const lastDate = new Date(series.dates[n - 1]);
  function dateAt(dayIndex) {
    return new Date(lastDate.getTime() + dayIndex * 86400000).toISOString().slice(0, 10);
  }

  const median = percentile(50);
  const p10 = percentile(10);
  const p90 = percentile(90);

  return {
    key: 'monte-carlo',
    label: 'Monte Carlo Simulation',
    methodNote: `${numPaths} simulated geometric Brownian motion paths using historical drift and ${garch ? 'GARCH-estimated' : 'historical'} volatility; band shows the 10th-90th percentile of simulated outcomes.`,
    path: [
      { t: series.dates[n - 1], c: lastPrice },
      { t: dateAt(daysToProject), c: median },
    ],
    forecastChangePct: pctChange(lastPrice, median),
    forecastLowChangePct: pctChange(lastPrice, p10),
    forecastHighChangePct: pctChange(lastPrice, p90),
    sampledPaths: allPaths.map((points) => points.map((pt) => ({ t: dateAt(pt.dayIndex), c: pt.c }))),
    meta: { median, p10, p90, numPaths, dailyVol, meanDailyReturn },
  };
}

function annualizedVolatilityFallback(rets) {
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/* ---------- Ensemble ---------- */
/* Averages the forecastChangePct of every available price-direction model
   (linear trend from forecast.js + the 5 new directional models; Monte
   Carlo's median counts too, sentiment proxy is included but down-weighted
   since it is simulated, not real data). GARCH does not contribute a
   price-direction vote — instead its volatility forecast sets the
   ensemble's uncertainty band, replacing the single-model volatility used
   in forecast.js's own band. */
function buildEnsemble(linearAnalysis, directionalModels, garch, daysAhead) {
  const weighted = [];
  for (const m of directionalModels) {
    if (!m || m.forecastChangePct === null || m.forecastChangePct === undefined) continue;
    const weight = m.key === 'sentiment-proxy' ? 0.5 : 1;
    weighted.push({ key: m.key, label: m.label, forecastChangePct: m.forecastChangePct, weight });
  }
  weighted.push({ key: 'linear-trend', label: 'Linear Trend', forecastChangePct: linearAnalysis.forecastChangePct, weight: 1 });

  const totalWeight = weighted.reduce((a, m) => a + m.weight, 0);
  const blendedChangePct = totalWeight > 0
    ? weighted.reduce((a, m) => a + m.forecastChangePct * m.weight, 0) / totalWeight
    : linearAnalysis.forecastChangePct;

  const lastPrice = linearAnalysis.lastPrice;
  const lastDate = linearAnalysis.lastDate;
  const endPrice = lastPrice * (1 + blendedChangePct / 100);

  const annualVol = garch ? garch.meta.annualVol : linearAnalysis.annualVolatilityPct / 100;
  const dailyVol = annualVol / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const bandWidth = dailyVol * Math.sqrt(daysAhead);

  const d0 = new Date(lastDate);
  const d1 = new Date(d0.getTime() + daysAhead * 86400000);

  return {
    key: 'ensemble',
    label: `Ensemble (${weighted.length} models)`,
    methodNote: `Weighted average forecast across ${weighted.length} directional models (sentiment proxy weighted at 0.5 since it is simulated). Uncertainty band width comes from GARCH's volatility forecast${garch ? '' : ' (GARCH unavailable — fell back to historical volatility)'}, not a single model's fit.`,
    path: [
      { t: d0.toISOString().slice(0, 10), c: lastPrice },
      { t: d1.toISOString().slice(0, 10), c: endPrice },
    ],
    forecastChangePct: blendedChangePct,
    forecastLowChangePct: pctChange(lastPrice, lastPrice * Math.exp(Math.log(1 + blendedChangePct / 100) - bandWidth)),
    forecastHighChangePct: pctChange(lastPrice, lastPrice * Math.exp(Math.log(1 + blendedChangePct / 100) + bandWidth)),
    components: weighted,
    meta: { annualVolPctUsed: annualVol * 100 },
  };
}

/* ---------- Public entry point ---------- */
/* Runs every model against the given asset/lookback and returns them all
   plus the ensemble. Relies on analyzeAsset() from forecast.js for the
   existing linear-trend model, series slicing, and forecast horizon.

   `lightweight` skips Monte Carlo's per-path chart data and uses far fewer
   simulated paths (still enough for a stable median) — meant for running
   every model across the full asset universe (e.g. Rankings), where only
   the scalar forecastChangePct is needed and the full 500-path/keepPaths
   version would be too slow to run on every dropdown change. */
function runAllModels(asset, lookbackKey, lightweight = false) {
  const linearAnalysis = analyzeAsset(asset, lookbackKey);
  if (!linearAnalysis) return null;

  const series = linearAnalysis.series;
  const daysAhead = linearAnalysis.forecastHorizonDays;
  const n = series.closes.length;

  const garch = garchModel(series);
  const directional = [
    movingAverageModel(series, daysAhead),
    arimaModel(series, daysAhead),
    holtLinearModel(series, daysAhead),
    featureRegressionModel(series, daysAhead),
    sentimentProxyModel(series, daysAhead),
  ].filter(Boolean);

  const monteCarlo = lightweight
    ? monteCarloModel(series, daysAhead, garch, 80, false)
    : monteCarloModel(series, daysAhead, garch);
  const ensemble = buildEnsemble(linearAnalysis, [...directional, monteCarlo].filter(Boolean), garch, daysAhead);

  const linearModel = {
    key: 'linear-trend',
    label: 'Linear Trend',
    methodNote: 'Linear regression on log-price over the selected lookback, projected forward — the original model.',
    path: [{ t: series.dates[n - 1], c: linearAnalysis.lastPrice }, ...linearAnalysis.forecast.slice(1)],
    forecastChangePct: linearAnalysis.forecastChangePct,
    forecastLowChangePct: linearAnalysis.forecastLowChangePct,
    forecastHighChangePct: linearAnalysis.forecastHighChangePct,
    meta: { r2: linearAnalysis.model.r2 },
  };

  const all = [linearModel, ...directional, garch, monteCarlo, ensemble].filter(Boolean);

  return { linearAnalysis, models: all, ensemble, garch, daysAhead };
}

/* Ranks the given assets by a chosen model's forecastChangePct at a given
   lookback. modelKey matches each model's `key` (e.g. 'linear-trend',
   'ensemble', 'monte-carlo', ...). Returns all assets sorted best-first;
   caller slices top N. Assets where the model isn't available at this
   lookback (e.g. ARIMA needs 30+ bars) are skipped. */
function rankAssetsByModel(assets, lookbackKey, modelKey) {
  const results = [];
  for (const asset of assets) {
    const result = runAllModels(asset, lookbackKey, true);
    if (!result) continue;
    const model = result.models.find((m) => m.key === modelKey);
    if (!model || model.forecastChangePct === null || model.forecastChangePct === undefined) continue;

    results.push({
      symbol: asset.symbol,
      displayName: asset.displayName,
      assetClass: asset.assetClass,
      country: asset.country || null,
      unit: asset.unit || null,
      forecastChangePct: model.forecastChangePct,
      forecastLowChangePct: model.forecastLowChangePct ?? null,
      forecastHighChangePct: model.forecastHighChangePct ?? null,
      lastPrice: result.linearAnalysis.lastPrice,
      recommendationLabel: result.linearAnalysis.recommendation.label,
      riskLabel: result.linearAnalysis.riskLabel,
      annualVolatilityPct: result.linearAnalysis.annualVolatilityPct,
      r2: result.linearAnalysis.model.r2,
    });
  }
  results.sort((a, b) => b.forecastChangePct - a.forecastChangePct);
  return results;
}
