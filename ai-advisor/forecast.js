/* Forecast + recommendation engine for the AI Financial Advisor prototype.
   Method: linear regression on ln(price) vs time (models compound growth as
   a straight line), projected forward and exponentiated back to price.

   Bar data is stored and passed around as a "series": a plain object
   { dates: [...], closes: [...] } with two parallel arrays (dates as ISO
   strings, closes as numbers) rather than an array of {t,c} objects — this
   halves the in-memory/JSON overhead at scale (no repeated key names per
   bar) since only close price is ever used for forecasting. */

const LOOKBACKS = [
  { key: '1mo', label: '1 month', months: 1 },
  { key: '6mo', label: '6 months', months: 6 },
  { key: '12mo', label: '12 months', months: 12 },
  { key: '24mo', label: '24 months', months: 24 },
  { key: '60mo', label: '5 years', months: 60 },
  { key: '120mo', label: '10 years', months: 120 },
  { key: 'all', label: 'All history', months: null },
];

function seriesLength(series) {
  return series.dates.length;
}

function seriesSlice(series, start, end) {
  return { dates: series.dates.slice(start, end), closes: series.closes.slice(start, end) };
}

function seriesLast(series) {
  const n = series.dates.length;
  return { t: series.dates[n - 1], c: series.closes[n - 1] };
}

function seriesAt(series, i) {
  return { t: series.dates[i], c: series.closes[i] };
}

function barsForLookback(series, months) {
  if (months === null) return series;
  const n = seriesLength(series);
  const lastDate = new Date(series.dates[n - 1]);
  const cutoff = new Date(lastDate);
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let idx = series.dates.findIndex((d) => d >= cutoffStr);
  if (idx === -1) idx = 0;
  return seriesSlice(series, idx, n);
}

function linregLogPrice(series) {
  const n = seriesLength(series);
  const t0 = new Date(series.dates[0]).getTime();
  const xs = new Array(n);
  const ys = new Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = (new Date(series.dates[i]).getTime() - t0) / 86400000; // days since start
    ys[i] = Math.log(series.closes[i]);
  }

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den; // ln(price) per day
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, t0, r2, lastX: xs[n - 1] };
}

function projectForward(model, fromDate, daysAhead) {
  const points = [];
  const fromX = (fromDate.getTime() - model.t0) / 86400000;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = fromX + (daysAhead * i) / steps;
    const logPrice = model.intercept + model.slope * x;
    const date = new Date(model.t0 + x * 86400000);
    points.push({ t: date.toISOString().slice(0, 10), c: Math.exp(logPrice) });
  }
  return points;
}

/* Annualized volatility from daily/weekly log returns (std dev), used both as
   a standalone risk stat and to build the forecast confidence band. */
function annualizedVolatility(series) {
  const n = seriesLength(series);
  if (n < 3) return 0;
  const logReturns = [];
  const barsPerYear = [];
  for (let i = 1; i < n; i++) {
    logReturns.push(Math.log(series.closes[i] / series.closes[i - 1]));
    const days = (new Date(series.dates[i]) - new Date(series.dates[i - 1])) / 86400000;
    barsPerYear.push(days > 0 ? 365.25 / days : 365.25);
  }
  const meanBarsPerYear = barsPerYear.reduce((a, b) => a + b, 0) / barsPerYear.length;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (logReturns.length - 1);
  const stdDevPerBar = Math.sqrt(variance);
  return stdDevPerBar * Math.sqrt(meanBarsPerYear);
}

function riskLabel(annualVol) {
  if (annualVol < 0.15) return 'Low';
  if (annualVol < 0.3) return 'Moderate';
  if (annualVol < 0.5) return 'High';
  return 'Very high';
}

/* Confidence band around the forecast: widens with sqrt(time) the way a
   random walk's uncertainty would, scaled by the asset's own volatility. */
function projectForwardBand(model, fromDate, daysAhead, annualVol) {
  const points = [];
  const fromX = (fromDate.getTime() - model.t0) / 86400000;
  const steps = 24;
  const dailyVol = annualVol / Math.sqrt(365.25);
  for (let i = 0; i <= steps; i++) {
    const daysOut = (daysAhead * i) / steps;
    const x = fromX + daysOut;
    const logPrice = model.intercept + model.slope * x;
    const date = new Date(model.t0 + x * 86400000);
    const bandWidth = dailyVol * Math.sqrt(Math.max(daysOut, 0)); // ln-space std dev at this horizon
    points.push({
      t: date.toISOString().slice(0, 10),
      c: Math.exp(logPrice),
      low: Math.exp(logPrice - bandWidth),
      high: Math.exp(logPrice + bandWidth),
    });
  }
  return points;
}

/* Recent momentum: compare mean of the last 20% of the window to the mean of
   the first 20%, annualized, to catch trend reversals the long regression misses. */
function recentMomentum(series) {
  const n = seriesLength(series);
  const chunk = Math.max(2, Math.round(n * 0.2));
  const early = seriesSlice(series, 0, chunk);
  const recent = seriesSlice(series, n - chunk, n);

  const earlyMean = early.closes.reduce((a, b) => a + b, 0) / early.closes.length;
  const recentMean = recent.closes.reduce((a, b) => a + b, 0) / recent.closes.length;
  const earlyMid = new Date(early.dates[Math.floor(early.dates.length / 2)]).getTime();
  const recentMid = new Date(recent.dates[Math.floor(recent.dates.length / 2)]).getTime();
  const yearsBetween = Math.max((recentMid - earlyMid) / (365.25 * 86400000), 1 / 365);
  const cagr = (recentMean / earlyMean) ** (1 / yearsBetween) - 1;
  return cagr;
}

function annualizedGrowth(slope) {
  // slope is ln(price) per day; annualize and convert to % growth
  return Math.exp(slope * 365.25) - 1;
}

function classify(longTermAnnualGrowth, momentumAnnualGrowth, r2) {
  const strong = 0.08; // 8%/yr threshold for a clear trend
  const weak = 0.02;
  const lowConfidence = r2 < 0.3;

  const longUp = longTermAnnualGrowth > weak;
  const longDown = longTermAnnualGrowth < -weak;
  const momentumUp = momentumAnnualGrowth > weak;
  const momentumDown = momentumAnnualGrowth < -weak;

  let label;
  let reason;

  if (longTermAnnualGrowth > strong && momentumUp) {
    label = 'Bullish';
    reason = 'Sustained uptrend over the selected period, and recent momentum confirms it.';
  } else if (longTermAnnualGrowth < -strong && momentumDown) {
    label = 'Bearish';
    reason = 'Sustained downtrend over the selected period, and recent momentum confirms it.';
  } else if (longUp && momentumDown) {
    label = 'Caution';
    reason = 'Longer-term trend is positive, but recent momentum has turned down — possible reversal.';
  } else if (longDown && momentumUp) {
    label = 'Watch';
    reason = 'Longer-term trend is negative, but recent momentum has turned up — possible recovery.';
  } else if (longUp) {
    label = 'Bullish';
    reason = 'Modest but consistent uptrend over the selected period.';
  } else if (longDown) {
    label = 'Bearish';
    reason = 'Modest but consistent downtrend over the selected period.';
  } else {
    label = 'Neutral';
    reason = 'No clear directional trend over the selected period.';
  }

  if (lowConfidence) {
    reason += ' Price movement is noisy relative to the trend line, so treat this with extra caution.';
  }

  return { label, reason, confidence: lowConfidence ? 'low' : r2 > 0.6 ? 'high' : 'medium' };
}

/* Public entry point: given an asset's full series (dates/closes arrays) and
   a lookback key, return the sliced series, regression, forecast points,
   and recommendation. */
function analyzeAsset(asset, lookbackKey) {
  const lookback = LOOKBACKS.find((l) => l.key === lookbackKey) || LOOKBACKS[2];
  const fullSeries = { dates: asset.dates, closes: asset.closes };
  const series = barsForLookback(fullSeries, lookback.months);
  const n = seriesLength(series);
  if (n < 5) {
    return null;
  }

  const model = linregLogPrice(series);
  const longTermAnnualGrowth = annualizedGrowth(model.slope);
  const momentumAnnualGrowth = recentMomentum(series);
  const annualVol = annualizedVolatility(series);

  const lastBar = seriesLast(series);
  const lastDate = new Date(lastBar.t);
  const spanDays = (lastDate.getTime() - new Date(series.dates[0]).getTime()) / 86400000;
  const forecastDays = Math.max(30, Math.round(spanDays * 0.25));
  const forecast = projectForward(model, lastDate, forecastDays);
  const forecastBand = projectForwardBand(model, lastDate, forecastDays, annualVol);

  const forecastEnd = forecast[forecast.length - 1];
  const forecastChangePct = (forecastEnd.c / lastBar.c - 1) * 100;
  const forecastBandEnd = forecastBand[forecastBand.length - 1];
  const forecastLowChangePct = (forecastBandEnd.low / lastBar.c - 1) * 100;
  const forecastHighChangePct = (forecastBandEnd.high / lastBar.c - 1) * 100;

  const recommendation = classify(longTermAnnualGrowth, momentumAnnualGrowth, model.r2);

  const periodChangePct = (lastBar.c / series.closes[0] - 1) * 100;

  const rankScore = rankingScore(longTermAnnualGrowth, momentumAnnualGrowth, model.r2, annualVol);

  return {
    lookback,
    series,
    forecast,
    forecastBand,
    model,
    lastPrice: lastBar.c,
    lastDate: lastBar.t,
    periodChangePct,
    longTermAnnualGrowthPct: longTermAnnualGrowth * 100,
    momentumAnnualGrowthPct: momentumAnnualGrowth * 100,
    annualVolatilityPct: annualVol * 100,
    riskLabel: riskLabel(annualVol),
    forecastHorizonDays: forecastDays,
    forecastEndDate: forecastEnd.t,
    forecastChangePct,
    forecastLowChangePct,
    forecastHighChangePct,
    recommendation,
    rankScore,
  };
}

/* Composite score for ranking assets by growth potential: blends the
   forecasted trend growth with momentum and discounts for low confidence
   (noisy fit) and high volatility, so a noisy 200%/yr outlier doesn't beat
   a steady, well-supported grower. */
function rankingScore(longTermAnnualGrowth, momentumAnnualGrowth, r2, annualVol) {
  const blendedGrowth = 0.6 * longTermAnnualGrowth + 0.4 * momentumAnnualGrowth;
  const confidenceFactor = 0.4 + 0.6 * Math.max(0, Math.min(1, r2)); // 0.4-1.0
  const volatilityPenalty = 1 / (1 + Math.max(0, annualVol - 0.2)); // penalize vol above 20%/yr
  return blendedGrowth * confidenceFactor * volatilityPenalty;
}

/* Backtest: walk the series in a rolling window, apply the same
   trend+momentum rule at each step using only data available up to that
   point, and compare the rule's implied direction to what actually happened
   next. Returns hit rate and a simple equity curve for "follow the signal". */
function backtestRecommendation(fullSeries, windowBars, holdBars) {
  const n = seriesLength(fullSeries);
  const trades = [];
  let equity = 1;
  const equityCurve = [];

  for (let i = windowBars; i + holdBars < n; i += holdBars) {
    const window = seriesSlice(fullSeries, i - windowBars, i + 1);
    const model = linregLogPrice(window);
    const longTermAnnualGrowth = annualizedGrowth(model.slope);
    const momentumAnnualGrowth = recentMomentum(window);
    const rec = classify(longTermAnnualGrowth, momentumAnnualGrowth, model.r2);

    const entryPrice = fullSeries.closes[i];
    const exitPrice = fullSeries.closes[i + holdBars];
    const actualReturn = exitPrice / entryPrice - 1;

    const isBullish = rec.label === 'Bullish';
    const isBearish = rec.label === 'Bearish';
    let signalReturn = 0; // Neutral/Caution/Watch: sit out
    if (isBullish) signalReturn = actualReturn;
    else if (isBearish) signalReturn = -actualReturn; // hypothetical short

    equity *= 1 + signalReturn;
    equityCurve.push({ t: fullSeries.dates[i + holdBars], equity });

    trades.push({
      date: fullSeries.dates[i],
      label: rec.label,
      actualReturnPct: actualReturn * 100,
      correct: (isBullish && actualReturn > 0) || (isBearish && actualReturn < 0) || (!isBullish && !isBearish && Math.abs(actualReturn) < 0.02),
    });
  }

  const directional = trades.filter((t) => t.label === 'Bullish' || t.label === 'Bearish');
  const correctCount = directional.filter((t) => t.correct).length;
  const hitRate = directional.length ? correctCount / directional.length : null;

  const buyHoldReturn = n > windowBars ? fullSeries.closes[n - 1] / fullSeries.closes[windowBars] - 1 : 0;

  return {
    trades,
    equityCurve,
    hitRate,
    directionalTradeCount: directional.length,
    strategyReturnPct: (equity - 1) * 100,
    buyHoldReturnPct: buyHoldReturn * 100,
  };
}

/* Pairwise Pearson correlation of log returns between two series, aligned by
   date (inner join) so mismatched trading calendars don't skew the result. */
function correlate(seriesA, seriesB) {
  const mapB = new Map(seriesB.dates.map((d, i) => [d, seriesB.closes[i]]));
  const alignedA = [];
  const alignedB = [];
  for (let i = 0; i < seriesA.dates.length; i++) {
    const d = seriesA.dates[i];
    if (mapB.has(d)) {
      alignedA.push(seriesA.closes[i]);
      alignedB.push(mapB.get(d));
    }
  }
  if (alignedA.length < 10) return null;

  const returnsA = [];
  const returnsB = [];
  for (let i = 1; i < alignedA.length; i++) {
    returnsA.push(Math.log(alignedA[i] / alignedA[i - 1]));
    returnsB.push(Math.log(alignedB[i] / alignedB[i - 1]));
  }

  const meanA = returnsA.reduce((a, b) => a + b, 0) / returnsA.length;
  const meanB = returnsB.reduce((a, b) => a + b, 0) / returnsB.length;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < returnsA.length; i++) {
    const da = returnsA[i] - meanA;
    const db = returnsB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

/* Rank every asset in the universe by growth-potential score at a given
   lookback. Returns all assets sorted best-first; caller slices top N. */
function rankAssets(assets, lookbackKey) {
  const results = [];
  for (const asset of assets) {
    const analysis = analyzeAsset(asset, lookbackKey);
    if (!analysis) continue;
    results.push({
      symbol: asset.symbol,
      displayName: asset.displayName,
      assetClass: asset.assetClass,
      country: asset.country || null,
      unit: asset.unit || null,
      rankScore: analysis.rankScore,
      forecastChangePct: analysis.forecastChangePct,
      longTermAnnualGrowthPct: analysis.longTermAnnualGrowthPct,
      momentumAnnualGrowthPct: analysis.momentumAnnualGrowthPct,
      annualVolatilityPct: analysis.annualVolatilityPct,
      riskLabel: analysis.riskLabel,
      confidence: analysis.recommendation.confidence,
      r2: analysis.model.r2,
      lastPrice: analysis.lastPrice,
      recommendationLabel: analysis.recommendation.label,
    });
  }
  results.sort((a, b) => b.rankScore - a.rankScore);
  return results;
}
