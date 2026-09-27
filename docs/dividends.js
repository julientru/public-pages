/* Dividend outlook scoring for the AI Financial Advisor prototype.

   Rather than one blended number claiming to be "the" answer, this offers
   7 independent models plus the original Composite, matching how the
   price-forecast side of the app (models.js) already presents several
   methods side by side. Each model exposes:
     { key, label, methodNote, score: 0-100|null, outlookLabel, detail }
   `score`/`outlookLabel` follow the same 4-tier scale as the Composite
   (Strong outlook / Stable / Caution / At risk) so they're comparable at a
   glance, even though what each one measures is different.

   Shared building blocks (growth consistency from real dividend history,
   FCF trend, quarterly momentum) are computed once per asset and reused
   across models rather than recomputed per model.

   Data limitations, stated plainly: annual FCF/revenue history is capped
   at ~4-5 years by Yahoo's fundamentals API, quarterly at ~5 quarters
   (~15 months) regardless of how far back it's requested, and this covers
   ~300 large-cap assets across all 20 countries in the main asset universe
   (top ~15 companies per country) — not the full 540-asset universe.
   Assets outside that set, or with no dividend at all, are excluded from
   rankings but can still be looked up individually. Sector/debt data is
   missing for some companies (notably debt-to-equity for many banks and
   insurers, who don't report it the way industrials do) — those models
   degrade to "not applicable" rather than guessing. */

const OUTLOOK_TIERS = [
  { min: 70, label: 'Strong outlook' },
  { min: 50, label: 'Stable' },
  { min: 30, label: 'Caution' },
  { min: -Infinity, label: 'At risk' },
];

function outlookLabelForScore(score) {
  if (score === null || !isFinite(score)) return 'Insufficient data';
  return OUTLOOK_TIERS.find((t) => score >= t.min).label;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ---------- Shared: dividend growth consistency (real payment history) ---------- */
/* Groups individual payments into calendar years (handles quarterly,
   semi-annual, and annual payers uniformly), then looks at year-over-year
   change in the annual total. A "cut" is a >10% drop vs. the prior year —
   payment-count changes near a year boundary create noise smaller than
   that threshold, so it's a deliberate margin, not a precise trigger. */
function annualDividendTotals(dividends) {
  const byYear = new Map();
  for (const d of dividends) {
    const year = Number(d.t.slice(0, 4));
    byYear.set(year, (byYear.get(year) || 0) + d.amount);
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]);
}

function analyzeDividendGrowth(dividends) {
  if (!dividends || dividends.length === 0) {
    return { hasDividend: false, label: 'No dividend', cagr: null, cutYears: [], consistency: null, years: [], consecutiveYearsNoCut: 0 };
  }

  const totals = annualDividendTotals(dividends);
  // Drop the first and last calendar year: both are usually partial (fetch
  // window starts/ends mid-year), which would misread as a "cut".
  const fullYears = totals.length > 2 ? totals.slice(1, -1) : totals;

  if (fullYears.length < 2) {
    return { hasDividend: true, label: 'Too little history', cagr: null, cutYears: [], consistency: null, years: fullYears, consecutiveYearsNoCut: fullYears.length };
  }

  const cutYears = [];
  let grownOrFlat = 0;
  let consecutiveYearsNoCut = 1; // the first year always "counts" as a start
  let brokeStreak = false;
  for (let i = 1; i < fullYears.length; i++) {
    const [, prevAmt] = fullYears[i - 1];
    const [year, amt] = fullYears[i];
    const change = (amt - prevAmt) / prevAmt;
    if (change < -0.1) {
      cutYears.push(year);
      brokeStreak = true;
    } else {
      grownOrFlat++;
      if (!brokeStreak) consecutiveYearsNoCut++;
    }
  }

  const first = fullYears[0][1];
  const last = fullYears[fullYears.length - 1][1];
  const yearsSpan = fullYears[fullYears.length - 1][0] - fullYears[0][0];
  const cagr = yearsSpan > 0 && first > 0 ? (last / first) ** (1 / yearsSpan) - 1 : null;
  const consistency = grownOrFlat / (fullYears.length - 1);

  let label;
  if (cutYears.length >= 2) label = 'History of cuts';
  else if (cutYears.length === 1) label = 'One cut on record';
  else if (cagr !== null && cagr > 0.03) label = 'Consistently growing';
  else label = 'Flat / stable';

  return { hasDividend: true, label, cagr, cutYears, consistency, years: fullYears, consecutiveYearsNoCut };
}

/* ---------- Shared: sustainability (FCF + earnings-based payout ratio) ---------- */
function analyzeSustainability(fundamentals, payoutRatio) {
  const rows = (fundamentals || []).filter((r) => r.fcfMargin !== null);

  let marginTrend = null;
  let fcfCagr = null;
  if (rows.length >= 2) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    marginTrend = last.fcfMargin - first.fcfMargin;
    const yearsSpan = new Date(last.date).getFullYear() - new Date(first.date).getFullYear();
    if (yearsSpan > 0 && first.freeCashFlow > 0) {
      fcfCagr = (last.freeCashFlow / first.freeCashFlow) ** (1 / yearsSpan) - 1;
    }
  }

  let payoutTier;
  if (payoutRatio === null || payoutRatio === undefined) payoutTier = 'unknown';
  else if (payoutRatio <= 0.5) payoutTier = 'comfortable';
  else if (payoutRatio <= 0.8) payoutTier = 'moderate';
  else if (payoutRatio <= 1.0) payoutTier = 'tight';
  else payoutTier = 'exceeds earnings';

  const latestFcfMargin = rows.length ? rows[rows.length - 1].fcfMargin : null;

  // The *level* of FCF margin, not just its trend: a company stuck at a
  // deeply negative margin (burning cash relative to revenue) is a bad
  // sign for dividend durability even if that margin isn't getting worse,
  // and the payout ratio alone (earnings-based) won't catch it — earnings
  // and cash flow can diverge (working capital, capex timing, one-offs).
  // 0% margin scores neutral (50); every 10 points of margin moves the
  // score by roughly 15, clamped to 0-100.
  const fcfMarginLevelScore = latestFcfMargin === null ? null : clamp(50 + latestFcfMargin * 150, 0, 100);

  return {
    latestFcfMargin,
    marginTrend,
    fcfCagr,
    payoutRatio,
    payoutTier,
    fcfMarginLevelScore,
    fcfRows: rows,
  };
}

/* ---------- Shared: recent momentum, quarter-over-quarter FCF ---------- */
/* Yahoo caps quarterly fundamentals at ~5 quarters (~15 months) no matter
   how far back it's asked for — confirmed across multiple symbols, not a
   fetch-side limitation. So this is a short "recent momentum" read
   alongside the annual (4-5yr) trend, not a variable lookback — there
   simply isn't enough quarterly history from the data source for that. */
function analyzeQuarterlyMomentum(fundamentalsQuarterly) {
  const rows = (fundamentalsQuarterly || []).filter((r) => r.freeCashFlow !== null);
  if (rows.length < 2) {
    return { available: false, qoqGrowth: null, marginTrend: null, quarters: rows };
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const quarterSpan = rows.length - 1;

  // Geometric mean quarter-over-quarter growth rate across the window,
  // rather than just first-vs-last (which a single noisy quarter can skew).
  // Both endpoints must be positive: a fractional power of a negative
  // ratio (e.g. one quarter's FCF flips sign, which real companies with
  // lumpy capex do) is NaN in JS, not an error.
  let qoqGrowth = null;
  if (first.freeCashFlow > 0 && last.freeCashFlow > 0 && quarterSpan > 0) {
    qoqGrowth = (last.freeCashFlow / first.freeCashFlow) ** (1 / quarterSpan) - 1;
  }

  const marginTrend = first.fcfMargin !== null && last.fcfMargin !== null ? last.fcfMargin - first.fcfMargin : null;

  return { available: true, qoqGrowth, marginTrend, quarters: rows };
}

/* Bundles the three shared building blocks so each model function takes
   one `ctx` object instead of repeating the same three analyses. */
function buildContext(asset) {
  return {
    asset,
    growth: analyzeDividendGrowth(asset.dividends),
    sustainability: analyzeSustainability(asset.fundamentals, asset.snapshot?.payoutRatio),
    momentum: analyzeQuarterlyMomentum(asset.fundamentalsQuarterly),
    yieldPct: asset.snapshot?.dividendYield ?? null,
  };
}

/* ---------- Model 1: Composite (original) ---------- */
/* Blends growth consistency (40%), sustainability (40%, FCF trend +
   earnings-based payout ratio, nudged by recent quarterly momentum), and
   current yield (20%). Weighted toward sustainability and consistency
   deliberately: a high yield propped up by an unsustainable payout (see
   Nestlé's >100% payout ratio in the real data) is a value trap, not a
   good pick, so yield alone shouldn't dominate. */
function modelComposite(ctx) {
  const { growth, sustainability, momentum, yieldPct } = ctx;
  if (!growth.hasDividend) return nullModel('composite', 'Composite', 'No dividend');

  let growthScore = 50;
  if (growth.cutYears.length >= 2) growthScore = 5;
  else if (growth.cutYears.length === 1) growthScore = 30;
  else if (growth.cagr !== null) growthScore = clamp(50 + growth.cagr * 400, 0, 100);

  // Sustainability blends the payout-ratio tier (earnings-based) with the
  // *level* of FCF margin (cash-based) — a company can look fine on payout
  // ratio while burning cash relative to revenue, and the two can diverge
  // (working capital, capex timing, one-offs), so both are weighted in
  // rather than letting a decent payout ratio mask a bad FCF margin.
  const tierScore = { comfortable: 90, moderate: 65, tight: 35, 'exceeds earnings': 10, unknown: 50 };
  const payoutTierScore = tierScore[sustainability.payoutTier];
  let sustainScore = sustainability.fcfMarginLevelScore !== null
    ? payoutTierScore * 0.6 + sustainability.fcfMarginLevelScore * 0.4
    : payoutTierScore;
  // Trend is a bounded nudge, not a dominant term — the level blend above
  // already carries most of the weight. Capped to +/-15 points so a big
  // swing in a noisy series (common for banks/insurers) can't overwhelm
  // the level score the way an unbounded multiplier did before.
  if (sustainability.marginTrend !== null) sustainScore = clamp(sustainScore + clamp(sustainability.marginTrend * 40, -15, 15), 0, 100);
  if (momentum.available && momentum.qoqGrowth !== null) {
    sustainScore = clamp(sustainScore + clamp(momentum.qoqGrowth * 40, -10, 10), 0, 100);
  }

  const yieldScore = yieldPct === null ? 0 : clamp(yieldPct * 1200, 0, 100);
  const composite = growthScore * 0.4 + sustainScore * 0.4 + yieldScore * 0.2;

  const marginNote = sustainability.latestFcfMargin !== null
    ? ` FCF margin ${(sustainability.latestFcfMargin * 100).toFixed(0)}%.`
    : '';
  return finalizeModel('composite', 'Composite', composite, {
    methodNote: '40% growth consistency + 40% sustainability (60% payout ratio + 40% FCF margin level, nudged by FCF margin trend and recent quarterly momentum) + 20% current yield.',
    detail: `${growth.label}. Payout ${sustainability.payoutTier}.${marginNote} Yield ${yieldPct !== null ? (yieldPct * 100).toFixed(2) + '%' : '—'}.`,
  });
}

/* ---------- Model 2: Tenure ---------- */
/* How many consecutive years (from real payment history) has this company
   avoided a cut? Distinct from CAGR: a 15-year unbroken streak reads very
   differently from a 3-year one even at the same growth rate — this is
   the "Dividend Aristocrat"-style question, isolated from everything else. */
function modelTenure(ctx) {
  const { growth } = ctx;
  if (!growth.hasDividend) return nullModel('tenure', 'Tenure (streak)', 'No dividend');
  if (growth.years.length < 2) return nullModel('tenure', 'Tenure (streak)', 'Too little history');

  const years = growth.consecutiveYearsNoCut;
  // 0 years -> 0, 15+ years -> 100, roughly linear between.
  const score = clamp((years / 15) * 100, 0, 100);

  return finalizeModel('tenure', 'Tenure (streak)', score, {
    methodNote: 'Consecutive years without a >10% cut in annual dividend total, from real payment history. 15+ years scores at the top of the scale.',
    detail: `${years} consecutive year${years === 1 ? '' : 's'} without a cut (of ${growth.years.length} years on record).`,
    consecutiveYearsNoCut: years,
  });
}

/* ---------- Model 3: FCF-based payout ---------- */
/* Yahoo's payoutRatio (used by Composite) is earnings-based. This model
   instead computes dividends-paid ÷ free-cash-flow directly from the real
   numbers already fetched — some companies have a low earnings-based
   payout ratio while actually straining cash flow (or the reverse), so
   this can tell a different story than the Composite's sustainability
   read. Needs both a dividend total and an FCF figure for the same
   (approximate) year. */
function modelFcfPayout(ctx) {
  const { growth, sustainability, asset } = ctx;
  if (!growth.hasDividend) return nullModel('fcf-payout', 'FCF Payout Ratio', 'No dividend');
  if (!sustainability.fcfRows.length) return nullModel('fcf-payout', 'FCF Payout Ratio', 'No FCF data');

  // Approximate shares outstanding from market cap / price, to convert
  // per-share annual dividend totals into a total-dividend-dollars figure
  // comparable to FCF (which is reported in total dollars, not per-share).
  const price = asset.snapshot?.currentPrice;
  const marketCap = asset.snapshot?.marketCap;
  const sharesOutstanding = price && marketCap ? marketCap / price : null;

  if (!sharesOutstanding) {
    return nullModel('fcf-payout', 'FCF Payout Ratio', 'Cannot estimate shares outstanding');
  }

  // Match the most recent full year's dividend total to the most recent
  // annual FCF row with the same year.
  const latestFcfRow = sustainability.fcfRows[sustainability.fcfRows.length - 1];
  const fcfYear = new Date(latestFcfRow.date).getFullYear();
  const divYearEntry = growth.years.find(([year]) => year === fcfYear) || growth.years[growth.years.length - 1];

  if (!divYearEntry) {
    return nullModel('fcf-payout', 'FCF Payout Ratio', 'Insufficient matching data');
  }

  // Negative FCF in the matched year is a computable, clearly bad outcome
  // (the company paid a dividend while burning cash) — score it as such
  // rather than abstaining, which was silently hiding the worst cases
  // (e.g. banks/insurers with erratic reported FCF) from this ranking.
  if (latestFcfRow.freeCashFlow <= 0) {
    return finalizeModel('fcf-payout', 'FCF Payout Ratio', 0, {
      methodNote: 'Total dividends paid (per-share total × estimated shares outstanding) ÷ free cash flow, computed directly rather than using the earnings-based payout ratio — can disagree with the Composite model when earnings and cash flow diverge.',
      detail: `FCF was negative in ${fcfYear} while a dividend was paid — the payout wasn't covered by cash flow at all that year.`,
      fcfPayoutRatio: null,
      fcfPayoutTier: 'negative FCF',
      matchedYear: fcfYear,
    });
  }

  const totalDividendsPaid = divYearEntry[1] * sharesOutstanding;
  const fcfPayoutRatio = totalDividendsPaid / latestFcfRow.freeCashFlow;

  let tier;
  if (fcfPayoutRatio <= 0.5) tier = 'comfortable';
  else if (fcfPayoutRatio <= 0.8) tier = 'moderate';
  else if (fcfPayoutRatio <= 1.0) tier = 'tight';
  else tier = 'exceeds FCF';

  const tierScore = { comfortable: 90, moderate: 65, tight: 35, 'exceeds FCF': 10 };
  const score = tierScore[tier];

  return finalizeModel('fcf-payout', 'FCF Payout Ratio', score, {
    methodNote: 'Total dividends paid (per-share total × estimated shares outstanding) ÷ free cash flow, computed directly rather than using the earnings-based payout ratio — can disagree with the Composite model when earnings and cash flow diverge.',
    detail: `Dividends consumed ~${(fcfPayoutRatio * 100).toFixed(0)}% of FCF in ${fcfYear} (${tier}).`,
    fcfPayoutRatio,
    fcfPayoutTier: tier,
    matchedYear: fcfYear,
  });
}

/* ---------- Model 4: Volatility-adjusted yield ---------- */
/* A 4% yield from a low-volatility utility and a 4% yield from a
   high-volatility miner are different risk profiles even though the
   number is identical. Needs `annualizedVolatility` from forecast.js and
   the asset's own price series — computed over the last 24 months for a
   recent, stable read. */
function modelVolAdjustedYield(ctx, priceSeries) {
  const { growth, yieldPct } = ctx;
  if (!growth.hasDividend || yieldPct === null) return nullModel('vol-adjusted-yield', 'Volatility-Adjusted Yield', 'No dividend');
  if (!priceSeries || priceSeries.dates.length < 30) return nullModel('vol-adjusted-yield', 'Volatility-Adjusted Yield', 'Insufficient price history');

  const recent = barsForLookback(priceSeries, 24);
  const annualVol = annualizedVolatility(recent);
  if (!annualVol || annualVol <= 0) return nullModel('vol-adjusted-yield', 'Volatility-Adjusted Yield', 'Could not compute volatility');

  // "Yield per unit of risk": a 4% yield at 15% vol scores much better
  // than a 4% yield at 60% vol. Scaled so a very good risk-adjusted yield
  // (yield/vol ratio around 0.5, e.g. 5% yield at 10% vol) tops the scale.
  const ratio = yieldPct / annualVol;
  const score = clamp(ratio * 200, 0, 100);

  return finalizeModel('vol-adjusted-yield', 'Volatility-Adjusted Yield', score, {
    methodNote: 'Current yield divided by the asset\'s own annualized price volatility (last 24 months) — the same volatility measure used in the Dashboard\'s forecast models. Rewards a given yield more when it comes from a steadier stock.',
    detail: `${(yieldPct * 100).toFixed(2)}% yield at ${(annualVol * 100).toFixed(1)}%/yr volatility.`,
    annualVolatilityPct: annualVol * 100,
  });
}

/* ---------- Model 5: Leverage/debt-adjusted ---------- */
/* High leverage can make a comfortable-looking payout ratio fragile — one
   refinancing away from trouble. Financial-sector companies (banks,
   insurers) don't report a meaningful debt-to-equity ratio the way
   industrials do (deposits aren't "debt" in the usual sense), so this
   model explicitly marks them not-applicable rather than guessing or
   defaulting to a neutral score, which would be misleading either way. */
function modelLeverage(ctx) {
  const { growth, sustainability, asset } = ctx;
  if (!growth.hasDividend) return nullModel('leverage', 'Leverage-Adjusted', 'No dividend');

  const sector = asset.snapshot?.sector;
  if (sector === 'Financial Services') {
    return nullModel('leverage', 'Leverage-Adjusted', 'Not applicable (financial sector)');
  }

  const debtToEquity = asset.snapshot?.debtToEquity;
  if (debtToEquity === null || debtToEquity === undefined) {
    return nullModel('leverage', 'Leverage-Adjusted', 'No debt data available');
  }

  // debtToEquity from Yahoo is typically reported as a percentage-like
  // number (e.g. 78 means debt is 78% of equity), not a fraction.
  let leverageScore;
  if (debtToEquity <= 50) leverageScore = 90;
  else if (debtToEquity <= 100) leverageScore = 65;
  else if (debtToEquity <= 200) leverageScore = 35;
  else leverageScore = 10;

  // Blend with the sustainability score so this isn't purely about debt
  // in isolation — a low-debt company with a terrible payout ratio
  // shouldn't score as "safe" just because it has no leverage.
  const tierScore = { comfortable: 90, moderate: 65, tight: 35, 'exceeds earnings': 10, unknown: 50 };
  const sustainScore = tierScore[sustainability.payoutTier];
  const score = leverageScore * 0.6 + sustainScore * 0.4;

  return finalizeModel('leverage', 'Leverage-Adjusted', score, {
    methodNote: 'Blends debt-to-equity (60%) with the payout-ratio tier (40%). Not computed for Financial Services companies (banks, insurers) — they don\'t report debt-to-equity the way industrials do, so this is shown as not applicable rather than guessed.',
    detail: `Debt/equity ${debtToEquity.toFixed(0)}%, payout ${sustainability.payoutTier}.`,
    debtToEquity,
  });
}

/* ---------- Model 6: Sector-relative yield ---------- */
/* A 3% yield is mediocre for a bank but excellent for a tech company —
   ranks each company's yield against others in the same sector within
   this dividend universe (not the full market), so it's directional
   context rather than a precise percentile. Needs the full asset list to
   compute peer sector yields, so this is applied as a second pass in
   rankDividendAssets rather than being purely per-asset. */
function sectorYieldPercentiles(assets) {
  const bySector = new Map();
  for (const asset of assets) {
    const sector = asset.snapshot?.sector;
    const yieldPct = asset.snapshot?.dividendYield;
    if (!sector || yieldPct === null || yieldPct === undefined) continue;
    if (!bySector.has(sector)) bySector.set(sector, []);
    bySector.get(sector).push(yieldPct);
  }
  for (const yields of bySector.values()) yields.sort((a, b) => a - b);
  return bySector;
}

function percentileRank(sortedArr, value) {
  if (sortedArr.length === 0) return null;
  let below = 0;
  for (const v of sortedArr) if (v < value) below++;
  return below / sortedArr.length;
}

function modelSectorRelativeYield(ctx, sectorYields) {
  const { growth, yieldPct, asset } = ctx;
  if (!growth.hasDividend || yieldPct === null) return nullModel('sector-relative-yield', 'Sector-Relative Yield', 'No dividend');

  const sector = asset.snapshot?.sector;
  if (!sector || !sectorYields.has(sector)) {
    return nullModel('sector-relative-yield', 'Sector-Relative Yield', 'No sector data available');
  }

  const peers = sectorYields.get(sector);
  if (peers.length < 3) {
    return nullModel('sector-relative-yield', 'Sector-Relative Yield', 'Too few sector peers in this dataset');
  }

  const percentile = percentileRank(peers, yieldPct);
  const score = clamp(percentile * 100, 0, 100);

  return finalizeModel('sector-relative-yield', 'Sector-Relative Yield', score, {
    methodNote: `Percentile rank of current yield among ${peers.length} "${sector}" peers in this ~300-company dividend dataset (not the whole market) — a 3% yield can be weak for one sector and strong for another.`,
    detail: `${(yieldPct * 100).toFixed(2)}% yield ranks in the ${(percentile * 100).toFixed(0)}th percentile of ${sector} peers here.`,
    sector,
    sectorPercentile: percentile,
    sectorPeerCount: peers.length,
  });
}

/* ---------- Model 7: Analyst-implied forward dividend ---------- */
/* Yahoo has no direct analyst *dividend* forecast field — only forward EPS
   estimates. This derives an implied forward dividend as
   (forward EPS estimate × current payout ratio), assuming the payout
   ratio holds steady, and is explicitly labeled as a derived projection,
   not a real analyst dividend call. Recent EPS estimate revisions (more
   analysts raising vs. cutting estimates in the last 30 days) factor in
   as a smaller modifier. */
function modelAnalystImplied(ctx) {
  const { growth, sustainability, asset } = ctx;
  if (!growth.hasDividend) return nullModel('analyst-implied', 'Analyst-Implied Forward', 'No dividend');

  const forwardEps = asset.snapshot?.forwardEpsNextYear;
  const payoutRatio = asset.snapshot?.payoutRatio;
  const currentDividendRate = asset.snapshot?.dividendRate;

  if (forwardEps === null || forwardEps === undefined || !payoutRatio || !currentDividendRate) {
    return nullModel('analyst-implied', 'Analyst-Implied Forward', 'Insufficient analyst/payout data');
  }

  const impliedForwardDividend = forwardEps * payoutRatio;
  const impliedGrowthPct = (impliedForwardDividend / currentDividendRate - 1) * 100;

  let score = clamp(50 + impliedGrowthPct * 5, 0, 100);

  const upRevisions = asset.snapshot?.epsRevisionsUp30d ?? 0;
  const downRevisions = asset.snapshot?.epsRevisionsDown30d ?? 0;
  const totalRevisions = upRevisions + downRevisions;
  let revisionNote = '';
  if (totalRevisions > 0) {
    const revisionBalance = (upRevisions - downRevisions) / totalRevisions;
    score = clamp(score + revisionBalance * 10, 0, 100);
    revisionNote = ` ${upRevisions} analyst${upRevisions === 1 ? '' : 's'} raised, ${downRevisions} cut EPS estimates in the last 30 days.`;
  }

  return finalizeModel('analyst-implied', 'Analyst-Implied Forward', score, {
    methodNote: 'Derived, not a real analyst dividend forecast: forward EPS estimate × current payout ratio, assuming the payout ratio holds steady, compared to the current dividend rate. Nudged by the balance of recent analyst EPS estimate revisions.',
    detail: `Implied next-year dividend ~${impliedGrowthPct >= 0 ? '+' : ''}${impliedGrowthPct.toFixed(1)}% vs. current.${revisionNote}`,
    impliedForwardDividend,
    impliedGrowthPct,
  });
}

/* ---------- Model plumbing ---------- */
function nullModel(key, label, reason) {
  return { key, label, score: null, outlookLabel: reason, methodNote: '', detail: reason };
}

function finalizeModel(key, label, score, extra) {
  return { key, label, score, outlookLabel: outlookLabelForScore(score), ...extra };
}

const DIVIDEND_MODEL_DEFS = [
  { key: 'composite', label: 'Composite' },
  { key: 'tenure', label: 'Tenure (streak)' },
  { key: 'fcf-payout', label: 'FCF Payout Ratio' },
  { key: 'vol-adjusted-yield', label: 'Volatility-Adjusted Yield' },
  { key: 'leverage', label: 'Leverage-Adjusted' },
  { key: 'sector-relative-yield', label: 'Sector-Relative Yield' },
  { key: 'analyst-implied', label: 'Analyst-Implied Forward' },
];

/* Runs every model for one asset. `priceSeries` ({dates,closes}) and
   `sectorYields` (from sectorYieldPercentiles) are optional context some
   models need; omit them and those models degrade to "insufficient data"
   rather than throwing. */
function runAllDividendModels(asset, priceSeries, sectorYields) {
  const ctx = buildContext(asset);
  const models = [
    modelComposite(ctx),
    modelTenure(ctx),
    modelFcfPayout(ctx),
    modelVolAdjustedYield(ctx, priceSeries),
    modelLeverage(ctx),
    sectorYields ? modelSectorRelativeYield(ctx, sectorYields) : nullModel('sector-relative-yield', 'Sector-Relative Yield', 'Not computed'),
    modelAnalystImplied(ctx),
  ];
  return { ctx, models };
}

/* Backward-compatible single-model entry point, used by anything that
   wants "the" analysis for an asset (e.g. the detail view's headline
   badge) — returns the Composite model's result merged with the shared
   context fields the detail view also needs. */
function analyzeDividendAsset(asset, priceSeries, sectorYields) {
  const { ctx, models } = runAllDividendModels(asset, priceSeries, sectorYields);
  const composite = models.find((m) => m.key === 'composite');
  return {
    symbol: asset.symbol,
    displayName: asset.displayName,
    country: asset.country,
    growth: ctx.growth,
    sustainability: ctx.sustainability,
    momentum: ctx.momentum,
    yieldPct: ctx.yieldPct,
    snapshot: asset.snapshot,
    score: composite.score,
    label: composite.outlookLabel,
    models,
  };
}

/* A token dividend (well under 1%) can still score "Strong outlook" on
   growth-consistency and sustainability alone — technically correct, but
   not what "best dividend" means to most people. MIN_YIELD_TO_RANK keeps
   those companies analyzable individually while excluding them from the
   ranked list itself, for every model (all of them are still ultimately
   about dividend investing, not just the Composite). */
const MIN_YIELD_TO_RANK = 0.015; // 1.5%

/* Ranks by a specific model's score. `modelKey` matches DIVIDEND_MODEL_DEFS
   keys; defaults to 'composite'. Builds sector-relative peer data once
   across the whole (unfiltered) asset list, not the post-filter subset,
   so sector percentiles reflect the full dividend universe regardless of
   which country filter the UI has applied. */
function rankDividendAssets(assets, modelKey, allAssetsForSectorContext) {
  const key = modelKey || 'composite';
  const sectorYields = sectorYieldPercentiles(allAssetsForSectorContext || assets);

  const analyzed = [];
  for (const asset of assets) {
    const yieldPct = asset.snapshot?.dividendYield;
    if (yieldPct === null || yieldPct === undefined || yieldPct < MIN_YIELD_TO_RANK) continue;

    const { models } = runAllDividendModels(asset, null, sectorYields);
    const model = models.find((m) => m.key === key);
    if (!model || model.score === null) continue;

    analyzed.push({
      symbol: asset.symbol,
      displayName: asset.displayName,
      country: asset.country,
      yieldPct,
      model,
      allModels: models,
    });
  }
  analyzed.sort((a, b) => b.model.score - a.model.score);
  return analyzed;
}
