/* UI wiring for the AI Financial Advisor prototype.
   initApp() is called by loader.js once MARKET_DATA has been assembled
   from the split per-country data files — nothing here runs at parse time
   except pure function/constant definitions. */

const ASSET_CLASS_LABELS = { index: 'Index', equity: 'Equity', commodity: 'Commodity' };
let ASSETS = [];
let ASSET_BY_SYMBOL = new Map();

let state = null;

function buildInitialState() {
  return {
    tab: 'dashboard',
    theme: loadTheme(),
    query: '',
    filterClass: 'all',
    filterCountry: 'all',
    activeSymbol: ASSETS[0].symbol,
    lookback: '12mo',
    compareSymbols: [],
    compareLookback: '12mo',
    compareQuery: '',
    rankingsTopN: 10,
    rankingsDirection: 'top',
    rankingsLookback: '12mo',
    rankingsClass: 'all',
    rankingsModel: 'composite',
    portfolio: loadPortfolio(),
    selectedModelKeys: ['ensemble'],
    dividendsTopN: 10,
    dividendsDirection: 'top',
    dividendsCountry: 'all',
    dividendsModel: 'composite',
  };
}

/* ---------- formatting helpers ---------- */

function formatPrice(value, currency) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 0 : abs >= 10 ? 2 : 4;
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + (currency ? ' ' + currency : '');
}
function formatPct(value) {
  if (!isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}
function pctClass(value) {
  if (!isFinite(value) || Math.abs(value) < 0.05) return 'neutral';
  return value >= 0 ? 'positive' : 'negative';
}
const INDEX_CURRENCY_OVERRIDES = {
  '^FTSE': 'GBP', '^GDAXI': 'EUR', '^FCHI': 'EUR', 'FTSEMIB.MI': 'EUR', '^IBEX': 'EUR', '^AEX': 'EUR',
  '^N225': 'JPY', '000001.SS': 'CNY', '^HSI': 'HKD', '^GSPTSE': 'CAD', '^SSMI': 'CHF',
  '^NSEI': 'INR', '^BVSP': 'BRL', '^KS11': 'KRW', '^AXJO': 'AUD', '^MXX': 'MXN',
  '^JKSE': 'IDR', '^TASI.SR': 'SAR', '^OMX': 'SEK', '^BFX': 'EUR',
};
const SUFFIX_CURRENCY = [
  ['.PA', 'EUR'], ['.DE', 'EUR'], ['.MI', 'EUR'], ['.MC', 'EUR'], ['.AS', 'EUR'], ['.BR', 'EUR'],
  ['.L', 'GBP'], ['.T', 'JPY'], ['.HK', 'HKD'], ['.TO', 'CAD'], ['.SW', 'CHF'],
  ['.NS', 'INR'], ['.BO', 'INR'], ['.SA', 'BRL'], ['.KS', 'KRW'], ['.AX', 'AUD'],
  ['.MX', 'MXN'], ['.JK', 'IDR'], ['.SR', 'SAR'], ['.ST', 'SEK'],
];

function currencyForAsset(asset) {
  if (asset.assetClass === 'index' && INDEX_CURRENCY_OVERRIDES[asset.symbol]) {
    return INDEX_CURRENCY_OVERRIDES[asset.symbol];
  }
  for (const [suffix, currency] of SUFFIX_CURRENCY) {
    if (asset.symbol.endsWith(suffix)) return currency;
  }
  return 'USD';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function riskBadgeStyle(riskLabel) {
  const map = {
    Low: 'background: var(--accent-soft); color: var(--accent-ink);',
    Moderate: 'background: var(--gold-soft); color: var(--gold-ink);',
    High: 'background: var(--risk-soft); color: var(--risk-ink);',
    'Very high': 'background: var(--risk-soft); color: var(--risk-ink);',
  };
  return map[riskLabel] || '';
}

/* ---------- persistence ---------- */

function loadTheme() {
  try {
    return localStorage.getItem('afa-theme') || 'light';
  } catch (e) {
    return 'light';
  }
}
function saveTheme(theme) {
  try {
    localStorage.setItem('afa-theme', theme);
  } catch (e) {}
}
function loadPortfolio() {
  try {
    const raw = localStorage.getItem('afa-portfolio');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function savePortfolio() {
  try {
    localStorage.setItem('afa-portfolio', JSON.stringify(state.portfolio));
  } catch (e) {}
}

/* ---------- theme ---------- */

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('theme-toggle').textContent = state.theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveTheme(state.theme);
  applyTheme();
});

document.getElementById('disclaimer-link').addEventListener('click', () => {
  state.tab = 'about';
  renderTabs();
});

/* ---------- tabs ---------- */

document.getElementById('tab-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  state.tab = btn.getAttribute('data-tab');
  renderTabs();
});

function renderTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === state.tab);
  });
  document.querySelectorAll('.view').forEach((el) => {
    el.classList.toggle('active', el.id === 'view-' + state.tab);
  });
  if (state.tab === 'dashboard') renderDashboard();
  if (state.tab === 'compare') renderCompare();
  if (state.tab === 'rankings') renderRankings();
  if (state.tab === 'portfolio') renderPortfolio();
  if (state.tab === 'dividends') renderDividends();
}

/* ---------- shared: chart SVG builder ---------- */

/* Converts a {dates, closes} series (the storage/forecast-math shape) into
   the array-of-{t,c}-points shape buildChartSvg expects. Kept as a small
   conversion at the UI boundary so the charting helper's contract stays
   generic (it also renders non-series data, like Compare's normalized %
   lines) while forecast.js/models.js work on parallel arrays throughout. */
function seriesToPoints(series) {
  const points = new Array(series.dates.length);
  for (let i = 0; i < series.dates.length; i++) points[i] = { t: series.dates[i], c: series.closes[i] };
  return points;
}

function buildChartSvg(opts) {
  // opts: { series: [{t,c}], forecast: [{t,c}], forecastBand: [{t,low,high}], width, height }
  const width = opts.width || 900;
  const height = opts.height || 320;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const bandPoints = opts.forecastBand || [];
  const allPrices = [
    ...opts.series.map((p) => p.c),
    ...(opts.forecast || []).map((p) => p.c),
    ...bandPoints.map((p) => p.low),
    ...bandPoints.map((p) => p.high),
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;
  const pad = priceRange * 0.08;
  const yMin = Math.max(opts.allowNegative ? -Infinity : 0, minPrice - pad);
  const yMax = maxPrice + pad;

  const allDates = [...opts.series, ...(opts.forecast || [])];
  const t0 = new Date(allDates[0].t).getTime();
  const t1 = new Date(allDates[allDates.length - 1].t).getTime();
  const tRange = t1 - t0 || 1;

  function xFor(dateStr) {
    return padL + ((new Date(dateStr).getTime() - t0) / tRange) * plotW;
  }
  function yFor(price) {
    return padT + plotH - ((price - yMin) / (yMax - yMin)) * plotH;
  }

  const seriesPath = opts.series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.t).toFixed(1)} ${yFor(p.c).toFixed(1)}`).join(' ');

  let bandArea = '';
  if (bandPoints.length) {
    const top = bandPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.t).toFixed(1)} ${yFor(p.high).toFixed(1)}`).join(' ');
    const bottom = bandPoints.slice().reverse().map((p) => `L ${xFor(p.t).toFixed(1)} ${yFor(p.low).toFixed(1)}`).join(' ');
    bandArea = `<path d="${top} ${bottom} Z" fill="var(--gold)" opacity="0.12" stroke="none" />`;
  }

  let forecastPath = '';
  let connector = '';
  if (opts.forecast && opts.forecast.length) {
    forecastPath = opts.forecast.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.t).toFixed(1)} ${yFor(p.c).toFixed(1)}`).join(' ');
    const lastSeries = opts.series[opts.series.length - 1];
    connector = `M ${xFor(lastSeries.t).toFixed(1)} ${yFor(lastSeries.c).toFixed(1)} L ${xFor(opts.forecast[0].t).toFixed(1)} ${yFor(opts.forecast[0].c).toFixed(1)}`;
  }

  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const price = yMin + ((yMax - yMin) * i) / gridCount;
    const y = yFor(price);
    gridLines.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1" />`);
    gridLines.push(`<text x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${opts.yFormat ? opts.yFormat(price) : formatPrice(price, '')}</text>`);
  }

  const lastActualX = xFor(opts.series[opts.series.length - 1].t);
  const todayLine = opts.forecast && opts.forecast.length
    ? `<line x1="${lastActualX.toFixed(1)}" y1="${padT}" x2="${lastActualX.toFixed(1)}" y2="${padT + plotH}" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="3 3" />`
    : '';

  const firstDate = opts.series[0].t;
  const lastDate = opts.series[opts.series.length - 1].t;
  const forecastEndDate = opts.forecast && opts.forecast.length ? opts.forecast[opts.forecast.length - 1].t : null;

  const extraSeries = (opts.extraSeries || []).map((es) => {
    const path = es.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.t).toFixed(1)} ${yFor(p.c).toFixed(1)}`).join(' ');
    const dash = es.dashed ? ' stroke-dasharray="5 4"' : '';
    const width = es.strokeWidth || 1.6;
    const opacity = es.opacity !== undefined ? es.opacity : 1;
    return `<path d="${path}" fill="none" stroke="${es.color}" stroke-width="${width}"${dash} opacity="${opacity}" />`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Price chart">
      ${gridLines.join('')}
      ${bandArea}
      ${todayLine}
      <path d="${seriesPath}" fill="none" stroke="${opts.seriesColor || 'var(--ink)'}" stroke-width="1.6" />
      ${extraSeries}
      ${connector ? `<path d="${connector}" fill="none" stroke="var(--gold)" stroke-width="1.4" stroke-dasharray="1 4" />` : ''}
      ${forecastPath ? `<path d="${forecastPath}" fill="none" stroke="var(--gold)" stroke-width="1.6" stroke-dasharray="5 4" />` : ''}
      <circle cx="${lastActualX.toFixed(1)}" cy="${yFor(opts.series[opts.series.length - 1].c).toFixed(1)}" r="3" fill="${opts.seriesColor || 'var(--ink)'}" />
      <text x="${padL}" y="${height - 8}" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${firstDate}</text>
      <text x="${lastActualX.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${lastDate}</text>
      ${forecastEndDate ? `<text x="${width - padR}" y="${height - 8}" text-anchor="end" font-size="10" fill="var(--gold-ink)" font-family="var(--font-mono)">${forecastEndDate}</text>` : ''}
    </svg>`;
}

/* ============================================================
   FORECAST MODELS (models.js: linear trend, MA crossover, ARIMA,
   Holt's linear trend, GARCH, feature regression, sentiment proxy,
   Monte Carlo, and the ensemble that blends them)
   ============================================================ */

const MODEL_COLORS = {
  'linear-trend': '#8C8C8C',
  'ma-crossover': '#2B6E5E',
  'arima': '#B8892F',
  'holt-linear': '#6E4F16',
  'feature-regression': '#3B6FB8',
  'sentiment-proxy': '#9A5FB0',
  'monte-carlo': '#B34632',
  'ensemble': 'var(--ink)',
};

const RANKING_MODEL_OPTIONS = [
  { key: 'composite', label: 'Composite score (default)' },
  { key: 'linear-trend', label: 'Linear Trend' },
  { key: 'ma-crossover', label: 'Moving Average Crossover' },
  { key: 'arima', label: 'ARIMA(1,1,0)' },
  { key: 'holt-linear', label: "Holt's Linear Trend" },
  { key: 'feature-regression', label: 'Feature Regression (ML-style)' },
  { key: 'sentiment-proxy', label: 'Sentiment Proxy (simulated)' },
  { key: 'monte-carlo', label: 'Monte Carlo Simulation' },
  { key: 'ensemble', label: 'Ensemble (all models)' },
];

function modelColor(key) {
  return MODEL_COLORS[key] || '#888';
}

/* `ctx` is a small state-and-callback bag so this section can be driven
   either by the global Dashboard state or by an isolated per-row context
   (Rankings' inline expansion) without the two interfering with each
   other. Shape: { selectedModelKeys: string[], onChange: () => void }. */
function renderModelSection(asset, lookbackKey, ctx) {
  const result = runAllModels(asset, lookbackKey);
  if (!result) return '';

  const { models, daysAhead } = result;
  const pickable = models.filter((m) => m.key !== 'garch'); // GARCH has no price path to plot

  // keep only still-valid selections (a model may be unavailable at this lookback)
  const availableKeys = new Set(pickable.map((m) => m.key));
  ctx.selectedModelKeys = ctx.selectedModelKeys.filter((k) => availableKeys.has(k));
  if (ctx.selectedModelKeys.length === 0) ctx.selectedModelKeys = ['ensemble'];

  const chips = pickable.map((m) => {
    const active = ctx.selectedModelKeys.includes(m.key) ? ' active' : '';
    return `<button class="chip model-chip${active}" data-model="${m.key}" style="${active ? `background:${modelColor(m.key)};border-color:${modelColor(m.key)};color:#fff;` : `border-color:${modelColor(m.key)};color:${modelColor(m.key)};`}">${escapeHtml(m.label)}</button>`;
  }).join('');

  const selectedModels = pickable.filter((m) => ctx.selectedModelKeys.includes(m.key));
  const linearSeries = result.linearAnalysis.series;
  const lastBar = { t: linearSeries.dates[linearSeries.dates.length - 1], c: linearSeries.closes[linearSeries.closes.length - 1] };

  const extraSeries = selectedModels
    .filter((m) => m.key !== 'ensemble')
    .map((m) => ({
      points: [{ t: lastBar.t, c: lastBar.c }, ...m.path.slice(1)],
      color: modelColor(m.key),
      dashed: true,
      strokeWidth: 1.6,
    }));

  const ensembleSelected = selectedModels.find((m) => m.key === 'ensemble');
  const ensembleBand = ensembleSelected
    ? [
        { t: lastBar.t, low: lastBar.c, high: lastBar.c, c: lastBar.c },
        { t: ensembleSelected.path[ensembleSelected.path.length - 1].t, low: lastBar.c * (1 + ensembleSelected.forecastLowChangePct / 100), high: lastBar.c * (1 + ensembleSelected.forecastHighChangePct / 100), c: ensembleSelected.path[ensembleSelected.path.length - 1].c },
      ]
    : null;

  const overlaySvg = buildChartSvg({
    series: seriesToPoints(linearSeries),
    forecast: ensembleSelected ? [{ t: lastBar.t, c: lastBar.c }, ...ensembleSelected.path.slice(1)] : null,
    forecastBand: ensembleBand,
    extraSeries,
  });

  const legend = selectedModels.map((m) => `<span><span class="dot" style="background:${modelColor(m.key)};"></span>${escapeHtml(m.label)}</span>`).join('');

  const rows = pickable.map((m) => {
    const hasRange = m.forecastLowChangePct !== undefined && m.forecastLowChangePct !== null;
    return `
      <tr>
        <td><span class="dot" style="background:${modelColor(m.key)};display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;"></span>${escapeHtml(m.label)}</td>
        <td class="${pctClass(m.forecastChangePct)}">${formatPct(m.forecastChangePct)}</td>
        <td style="color:var(--text-3); font-size:11px;">${hasRange ? formatPct(m.forecastLowChangePct) + ' to ' + formatPct(m.forecastHighChangePct) : '—'}</td>
      </tr>`;
  }).join('');

  const garch = models.find((m) => m.key === 'garch');
  const garchNote = garch ? `<div class="footnote" style="margin:8px 0 0;"><b>GARCH(1,1)</b> current volatility forecast: ${garch.currentAnnualVolPct.toFixed(1)}%/yr. ${garch.methodNote}</div>` : '';

  const methodNotes = selectedModels.map((m) => `<div class="footnote" style="margin:2px 0;"><b>${escapeHtml(m.label)}:</b> ${escapeHtml(m.methodNote)}</div>`).join('');

  return `
    <div class="section-block">
      <div class="section-title">Forecast models (${daysAhead}d horizon)</div>
      <div class="sort-row" id="model-chip-row" style="margin-bottom:12px;">${chips}</div>
      <div class="chart-legend">${legend || '<span style="color:var(--text-3);">Select a model below to plot it.</span>'}</div>
      ${overlaySvg}
      <table class="rankings-table" style="margin-top:10px;">
        <thead><tr><th>Model</th><th>Forecast</th><th>Range</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${methodNotes}
      ${garchNote}
    </div>`;
}

function wireModelChipListeners(panel, asset, lookbackKey, ctx) {
  const chipRow = panel.querySelector('#model-chip-row');
  if (!chipRow) return;
  chipRow.querySelectorAll('.model-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-model');
      if (ctx.selectedModelKeys.includes(key)) {
        ctx.selectedModelKeys = ctx.selectedModelKeys.filter((k) => k !== key);
      } else {
        ctx.selectedModelKeys.push(key);
      }
      ctx.onChange();
    });
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function populateDashboardFilters() {
  const classSelect = document.getElementById('filter-class');
  const countrySelect = document.getElementById('filter-country');

  const classes = ['all', ...new Set(ASSETS.map((a) => a.assetClass))];
  classSelect.innerHTML = classes.map((c) => `<option value="${c}">${c === 'all' ? 'All classes' : ASSET_CLASS_LABELS[c] || c}</option>`).join('');

  const countries = ['all', ...new Set(ASSETS.map((a) => a.country).filter(Boolean))].sort((a, b) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)));
  countrySelect.innerHTML = countries.map((c) => `<option value="${c}">${c === 'all' ? 'All countries' : c}</option>`).join('');

  classSelect.addEventListener('change', () => { state.filterClass = classSelect.value; renderAssetList(); });
  countrySelect.addEventListener('change', () => { state.filterCountry = countrySelect.value; renderAssetList(); });
}

function filteredAssets() {
  const q = state.query.trim().toLowerCase();
  return ASSETS.filter((a) => {
    if (state.filterClass !== 'all' && a.assetClass !== state.filterClass) return false;
    if (state.filterCountry !== 'all' && a.country !== state.filterCountry) return false;
    if (q && !a.displayName.toLowerCase().includes(q) && !a.symbol.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderAssetList() {
  const container = document.getElementById('asset-list');
  const groups = [
    { key: 'index', label: 'Indices' },
    { key: 'equity', label: 'Equities' },
    { key: 'commodity', label: 'Commodities' },
  ];
  const assets = filteredAssets();

  let html = '';
  for (const group of groups) {
    const groupAssets = assets.filter((a) => a.assetClass === group.key);
    if (groupAssets.length === 0) continue;
    html += `<div class="asset-group-label">${group.label} (${groupAssets.length})</div>`;
    for (const asset of groupAssets) {
      const active = asset.symbol === state.activeSymbol ? ' active' : '';
      html += `
        <div class="asset-row${active}" data-symbol="${escapeHtml(asset.symbol)}">
          <div>
            <div class="asset-row-name">${escapeHtml(asset.displayName)}</div>
            <div class="asset-row-symbol">${escapeHtml(asset.symbol)}${asset.country ? ' · ' + escapeHtml(asset.country) : ''}</div>
          </div>
        </div>`;
    }
  }
  if (!html) html = '<div class="empty-state">No assets match your filters.</div>';
  container.innerHTML = html;

  container.querySelectorAll('.asset-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.activeSymbol = row.getAttribute('data-symbol');
      renderAssetList();
      renderDetail();
    });
  });
}

/* Renders the full asset-detail view (chart, recommendation, stats, forecast
   models, backtest) into `panel` for the given symbol. `ctx` decouples this
   from any one caller's state: { lookback, selectedModelKeys, onChange,
   showExportButton? }. Used by both the Dashboard (backed by global `state`)
   and Rankings' inline per-row expansion (backed by an isolated per-row ctx). */
function renderAssetDetail(panel, symbol, ctx) {
  const asset = ASSET_BY_SYMBOL.get(symbol);
  if (!asset) {
    panel.innerHTML = '<div class="empty-state">Select an asset.</div>';
    return;
  }

  const analysis = analyzeAsset(asset, ctx.lookback);
  if (!analysis) {
    panel.innerHTML = '<div class="empty-state">Not enough data for this period.</div>';
    return;
  }

  const currency = currencyForAsset(asset);
  const assetLen = asset.closes.length;
  const lastRaw = { t: asset.dates[assetLen - 1], c: asset.closes[assetLen - 1] };
  const prevRaw = assetLen >= 2 ? { t: asset.dates[assetLen - 2], c: asset.closes[assetLen - 2] } : null;
  const dayChangePct = prevRaw ? ((lastRaw.c - prevRaw.c) / prevRaw.c) * 100 : 0;

  const lookbackButtons = LOOKBACKS.map((lb) => {
    const active = lb.key === ctx.lookback ? ' active' : '';
    return `<button class="lookback-btn${active}" data-lookback="${lb.key}">${lb.label}</button>`;
  }).join('');

  const rec = analysis.recommendation;

  const chartSvg = buildChartSvg({
    series: seriesToPoints(analysis.series),
    forecast: analysis.forecast,
    forecastBand: analysis.forecastBand,
  });

  // Backtest: window ~ half the selected lookback's bar count (min 30), hold ~10% of window
  const windowBars = Math.max(30, Math.floor(analysis.series.closes.length * 0.5));
  const holdBars = Math.max(5, Math.floor(windowBars * 0.15));
  const fullSeries = { dates: asset.dates, closes: asset.closes };
  let backtestHtml = '';
  if (assetLen > windowBars + holdBars + 5) {
    const bt = backtestRecommendation(fullSeries, windowBars, holdBars);
    if (bt.directionalTradeCount >= 3) {
      const hitClass = bt.hitRate >= 0.55 ? 'positive' : bt.hitRate <= 0.45 ? 'negative' : 'neutral';
      backtestHtml = `
        <div class="section-block">
          <div class="section-title">Backtest: following this rule mechanically</div>
          <div class="backtest-summary">
            <div class="stat-cell">
              <div class="stat-label">Signal hit rate</div>
              <div class="stat-value ${hitClass}">${(bt.hitRate * 100).toFixed(0)}%</div>
            </div>
            <div class="stat-cell">
              <div class="stat-label">Directional signals</div>
              <div class="stat-value">${bt.directionalTradeCount}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-label">Strategy return (full history)</div>
              <div class="stat-value ${pctClass(bt.strategyReturnPct)}">${formatPct(bt.strategyReturnPct)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-label">Buy &amp; hold return</div>
              <div class="stat-value ${pctClass(bt.buyHoldReturnPct)}">${formatPct(bt.buyHoldReturnPct)}</div>
            </div>
          </div>
          <div class="footnote" style="margin:0;">
            Simulates following this Bullish/Bearish rule mechanically on rolling windows across the asset's full history (long when Bullish, hypothetical short when Bearish, flat otherwise), rebalanced every ${holdBars} bars. Compared against simply buying and holding. This is a sanity check on the rule, not a guarantee it will work going forward — in most cases buy-and-hold wins, which is itself an honest result.
          </div>
        </div>`;
    }
  }

  panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">
        <h1>${escapeHtml(asset.displayName)}</h1>
        <div class="symbol">${escapeHtml(asset.symbol)} · ${ASSET_CLASS_LABELS[asset.assetClass] || asset.assetClass}${asset.country ? ' · ' + escapeHtml(asset.country) : ''}${asset.unit ? ' · ' + escapeHtml(asset.unit) : ''}</div>
      </div>
      <div style="text-align:right;">
        <div class="detail-price">
          <div class="value">${formatPrice(lastRaw.c, currency)}</div>
          <div class="change ${pctClass(dayChangePct)}">${formatPct(dayChangePct)} vs prior close</div>
        </div>
        <div class="detail-actions">
          <button class="icon-btn export-btn">⬇ Export summary</button>
        </div>
      </div>
    </div>

    <div class="lookback-bar">${lookbackButtons}</div>

    <div class="chart-area">
      <div class="chart-legend">
        <span><span class="dot dot-actual"></span>Historical (${analysis.lookback.label})</span>
        <span><span class="dot dot-forecast"></span>Forecast (${analysis.forecastHorizonDays}d ahead, linear trend)</span>
        <span><span class="dot dot-band"></span>Confidence band (±1σ, volatility-based)</span>
      </div>
      ${chartSvg}
    </div>

    <div class="recommendation-block">
      <div class="rec-badge rec-${rec.label}">${rec.label}</div>
      <div class="rec-text">
        <p>${rec.reason}</p>
        <div class="rec-meta">Confidence: <b>${rec.confidence}</b> (R² = ${analysis.model.r2.toFixed(2)}) · Risk: <b>${analysis.riskLabel}</b> (${analysis.annualVolatilityPct.toFixed(1)}%/yr volatility) · Based on the <b>${analysis.lookback.label}</b> lookback</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-cell">
        <div class="stat-label">Change over period</div>
        <div class="stat-value ${pctClass(analysis.periodChangePct)}">${formatPct(analysis.periodChangePct)}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Trend growth (ann.)</div>
        <div class="stat-value ${pctClass(analysis.longTermAnnualGrowthPct)}">${formatPct(analysis.longTermAnnualGrowthPct)}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Momentum (ann.)</div>
        <div class="stat-value ${pctClass(analysis.momentumAnnualGrowthPct)}">${formatPct(analysis.momentumAnnualGrowthPct)}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Volatility (ann.)</div>
        <div class="stat-value">${analysis.annualVolatilityPct.toFixed(1)}%</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Forecast (base / range)</div>
        <div class="stat-value ${pctClass(analysis.forecastChangePct)}">${formatPct(analysis.forecastChangePct)}<br><span style="font-size:10px; color:var(--text-3); font-weight:400;">${formatPct(analysis.forecastLowChangePct)} to ${formatPct(analysis.forecastHighChangePct)}</span></div>
      </div>
    </div>

    ${renderModelSection(asset, ctx.lookback, ctx)}

    ${backtestHtml}

    <div class="footnote">
      Forecast method: linear regression on log-price over the selected lookback, projected forward and exponentiated back to price. Confidence band widens with √(time) scaled by the asset's own historical volatility, the way uncertainty grows under a random-walk assumption. This is a naive trend continuation, not a statistical prediction.
    </div>
  `;

  panel.querySelectorAll('.lookback-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ctx.lookback = btn.getAttribute('data-lookback');
      ctx.onChange();
    });
  });

  panel.querySelector('.export-btn').addEventListener('click', () => exportAssetSummary(asset, analysis));
  wireModelChipListeners(panel, asset, ctx.lookback, ctx);
}

/* Dashboard wrapper: renders into #detail-panel, backed by global `state`. */
function renderDetail() {
  const panel = document.getElementById('detail-panel');
  const ctx = {
    lookback: state.lookback,
    selectedModelKeys: state.selectedModelKeys,
    onChange: () => {
      state.lookback = ctx.lookback;
      state.selectedModelKeys = ctx.selectedModelKeys;
      renderDetail();
    },
  };
  renderAssetDetail(panel, state.activeSymbol, ctx);
}

function exportAssetSummary(asset, analysis) {
  const rec = analysis.recommendation;
  const lines = [
    `AI Financial Advisor — prototype export`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Asset: ${asset.displayName} (${asset.symbol})`,
    `Class: ${ASSET_CLASS_LABELS[asset.assetClass] || asset.assetClass}${asset.country ? ' · ' + asset.country : ''}`,
    `Lookback: ${analysis.lookback.label}`,
    ``,
    `Recommendation: ${rec.label} (confidence: ${rec.confidence})`,
    `Reason: ${rec.reason}`,
    ``,
    `Last price: ${formatPrice(analysis.lastPrice, currencyForAsset(asset))} (${analysis.lastDate})`,
    `Change over period: ${formatPct(analysis.periodChangePct)}`,
    `Trend growth (annualized): ${formatPct(analysis.longTermAnnualGrowthPct)}`,
    `Recent momentum (annualized): ${formatPct(analysis.momentumAnnualGrowthPct)}`,
    `Volatility (annualized): ${analysis.annualVolatilityPct.toFixed(1)}% (${analysis.riskLabel} risk)`,
    `Forecast to ${analysis.forecastEndDate}: ${formatPct(analysis.forecastChangePct)} (range ${formatPct(analysis.forecastLowChangePct)} to ${formatPct(analysis.forecastHighChangePct)})`,
    ``,
    `Not real financial advice — this is a UX prototype using naive trend extrapolation.`,
  ];
  downloadTextFile(`${asset.symbol.replace(/[^a-z0-9]/gi, '_')}_summary.txt`, lines.join('\n'));
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderDashboard() {
  renderAssetList();
  renderDetail();
}

document.getElementById('search-input').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderAssetList();
});

/* ============================================================
   COMPARE
   ============================================================ */

const COMPARE_COLORS = ['var(--ink)', 'var(--accent)', 'var(--gold)', 'var(--risk)'];

function renderCompareSelected() {
  const container = document.getElementById('compare-selected');
  if (state.compareSymbols.length === 0) {
    container.innerHTML = '<span style="font-size:11.5px; color:var(--text-3);">No assets selected yet.</span>';
    return;
  }
  container.innerHTML = state.compareSymbols.map((symbol, i) => {
    const asset = ASSET_BY_SYMBOL.get(symbol);
    return `<span class="compare-tag" style="border-left:3px solid ${COMPARE_COLORS[i]};">${escapeHtml(asset.displayName)} <button data-symbol="${escapeHtml(symbol)}">✕</button></span>`;
  }).join('');
  container.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.compareSymbols = state.compareSymbols.filter((s) => s !== btn.getAttribute('data-symbol'));
      renderCompare();
    });
  });
}

function renderCompareSearchResults() {
  const container = document.getElementById('compare-search-results');
  const q = state.compareQuery.trim().toLowerCase();
  if (!q || state.compareSymbols.length >= 4) {
    container.innerHTML = '';
    return;
  }
  const matches = ASSETS.filter((a) => !state.compareSymbols.includes(a.symbol) && (a.displayName.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q))).slice(0, 8);
  if (matches.length === 0) {
    container.innerHTML = '<div style="padding:8px 0; font-size:12px; color:var(--text-3);">No matches.</div>';
    return;
  }
  container.innerHTML = '<div style="display:flex; flex-direction:column; border:1px solid var(--line); border-radius:8px; margin-top:8px; overflow:hidden;">' +
    matches.map((a) => `<div class="asset-row" data-symbol="${escapeHtml(a.symbol)}" style="border-left:none;"><div><div class="asset-row-name">${escapeHtml(a.displayName)}</div><div class="asset-row-symbol">${escapeHtml(a.symbol)}${a.country ? ' · ' + escapeHtml(a.country) : ''}</div></div></div>`).join('') +
    '</div>';
  container.querySelectorAll('.asset-row').forEach((row) => {
    row.addEventListener('click', () => {
      const symbol = row.getAttribute('data-symbol');
      if (state.compareSymbols.length < 4 && !state.compareSymbols.includes(symbol)) {
        state.compareSymbols.push(symbol);
      }
      state.compareQuery = '';
      document.getElementById('compare-search').value = '';
      renderCompare();
    });
  });
}

function renderCompareChart() {
  const area = document.getElementById('compare-chart-area');
  if (state.compareSymbols.length === 0) {
    area.innerHTML = '<div class="empty-state">Select 2–4 assets above to compare their performance.</div>';
    return;
  }

  const lookback = LOOKBACKS.find((l) => l.key === state.compareLookback) || LOOKBACKS.find((l) => l.key === '12mo');
  const seriesList = state.compareSymbols.map((symbol, i) => {
    const asset = ASSET_BY_SYMBOL.get(symbol);
    const series = barsForLookback({ dates: asset.dates, closes: asset.closes }, lookback.months);
    const base = series.closes[0];
    const normalized = series.dates.map((t, idx) => ({ t, c: ((series.closes[idx] / base) - 1) * 100 }));
    return { symbol, displayName: asset.displayName, color: COMPARE_COLORS[i], points: normalized };
  });

  const primary = seriesList[0];
  const rest = seriesList.slice(1).map((s) => ({ points: s.points, color: s.color }));

  const legend = seriesList.map((s) => `<span><span class="dot" style="background:${s.color};"></span>${escapeHtml(s.displayName)}</span>`).join('');

  const chartSvg = buildChartSvg({
    series: primary.points,
    extraSeries: rest,
    seriesColor: primary.color,
    allowNegative: true,
    yFormat: (v) => v.toFixed(0) + '%',
  });

  area.innerHTML = `<div class="chart-legend">${legend}</div>${chartSvg}`;
}

const CORRELATION_DEFAULT_SYMBOLS = ['^GSPC', '^GDAXI', '^N225', 'AAPL', 'GC=F', 'CL=F', 'HG=F'];

function renderCorrelationMatrix() {
  const container = document.getElementById('correlation-section');
  const symbols = state.compareSymbols.length >= 2 ? state.compareSymbols : CORRELATION_DEFAULT_SYMBOLS;
  const assets = symbols.map((s) => ASSET_BY_SYMBOL.get(s)).filter(Boolean);
  if (assets.length < 2) {
    container.innerHTML = '';
    return;
  }

  // Use ~2 years of daily bars for a responsive, recent-relationship view.
  const recentSeries = assets.map((a) => barsForLookback({ dates: a.dates, closes: a.closes }, 24));

  const matrix = assets.map((rowAsset, i) =>
    assets.map((colAsset, j) => (i === j ? 1 : correlate(recentSeries[i], recentSeries[j])))
  );

  const headerCells = assets.map((a) => `<th title="${escapeHtml(a.displayName)}">${escapeHtml(a.symbol)}</th>`).join('');
  const rows = assets.map((rowAsset, i) => {
    const cells = assets.map((colAsset, j) => {
      const v = matrix[i][j];
      if (v === null) return '<td style="color:var(--text-3);">—</td>';
      const bg = correlationColor(v);
      return `<td style="background:${bg};" title="${escapeHtml(rowAsset.displayName)} vs ${escapeHtml(colAsset.displayName)}: ${v.toFixed(2)}">${v.toFixed(2)}</td>`;
    }).join('');
    return `<tr><th class="row-label" title="${escapeHtml(rowAsset.displayName)}">${escapeHtml(rowAsset.symbol)}</th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="section-title">Correlation matrix (24 months, daily returns)</div>
    <div class="corr-scroll">
      <table class="corr-table">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="footnote" style="margin:8px 22px 0;">
      Pearson correlation of daily log returns over the last 24 months. +1 = move together, -1 = move opposite, 0 = unrelated. ${state.compareSymbols.length >= 2 ? 'Showing your selected assets above.' : 'Showing a default set — pick 2+ assets above to see their correlations instead.'} Useful as a rough diversification check: highly correlated assets don't diversify each other much.
    </div>`;
}

function correlationColor(v) {
  // green for positive correlation, red for negative, intensity scaled by |v|
  const intensity = Math.min(1, Math.abs(v));
  if (v >= 0) {
    return `color-mix(in srgb, var(--accent-soft) ${(intensity * 100).toFixed(0)}%, var(--paper-raised))`;
  }
  return `color-mix(in srgb, var(--risk-soft) ${(intensity * 100).toFixed(0)}%, var(--paper-raised))`;
}

function renderCompare() {
  const lookbackBar = document.getElementById('compare-lookback-bar');
  lookbackBar.innerHTML = LOOKBACKS.map((lb) => {
    const active = lb.key === state.compareLookback ? ' active' : '';
    return `<button class="lookback-btn${active}" data-lookback="${lb.key}">${lb.label}</button>`;
  }).join('');
  lookbackBar.querySelectorAll('.lookback-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.compareLookback = btn.getAttribute('data-lookback');
      renderCompare();
    });
  });

  renderCompareSelected();
  renderCompareSearchResults();
  renderCompareChart();
  renderCorrelationMatrix();
}

document.getElementById('compare-search').addEventListener('input', (e) => {
  state.compareQuery = e.target.value;
  renderCompareSearchResults();
});

/* ============================================================
   RANKINGS
   ============================================================ */

function populateRankingsFilters() {
  const lookbackSelect = document.getElementById('rankings-lookback');
  lookbackSelect.innerHTML = LOOKBACKS.map((lb) => `<option value="${lb.key}">${lb.label}</option>`).join('');
  lookbackSelect.value = state.rankingsLookback;
  lookbackSelect.addEventListener('change', () => { state.rankingsLookback = lookbackSelect.value; renderRankings(); });

  const classSelect = document.getElementById('rankings-class');
  const classes = ['all', ...new Set(ASSETS.map((a) => a.assetClass))];
  classSelect.innerHTML = classes.map((c) => `<option value="${c}">${c === 'all' ? 'All classes' : ASSET_CLASS_LABELS[c] || c}</option>`).join('');
  classSelect.addEventListener('change', () => { state.rankingsClass = classSelect.value; renderRankings(); });

  document.getElementById('rankings-top-n').addEventListener('change', (e) => {
    state.rankingsTopN = parseInt(e.target.value, 10);
    renderRankings();
  });

  const modelSelect = document.getElementById('rankings-model');
  modelSelect.innerHTML = RANKING_MODEL_OPTIONS.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join('');
  modelSelect.value = state.rankingsModel;
  modelSelect.addEventListener('change', () => { state.rankingsModel = modelSelect.value; renderRankings(); });

  document.getElementById('rankings-direction-top').addEventListener('click', () => {
    state.rankingsDirection = 'top';
    renderRankings();
  });
  document.getElementById('rankings-direction-bottom').addEventListener('click', () => {
    state.rankingsDirection = 'bottom';
    renderRankings();
  });
  updateRankingsDirectionChips();
}

function updateRankingsDirectionChips() {
  document.getElementById('rankings-direction-top').classList.toggle('active', state.rankingsDirection === 'top');
  document.getElementById('rankings-direction-bottom').classList.toggle('active', state.rankingsDirection === 'bottom');
}

/* Slices the best-first-sorted `ranked` array to the top or bottom N per
   state.rankingsDirection. "Bottom" is reversed so worst-first still reads
   top-to-bottom in the table (rank 1 = worst), rather than showing the
   overall #516 through #540 in ascending order. */
function sliceForRankingsDirection(ranked, topN) {
  if (state.rankingsDirection === 'bottom') {
    return ranked.slice(-topN).reverse();
  }
  return ranked.slice(0, topN);
}

function renderRankings() {
  updateRankingsDirectionChips();
  const pool = state.rankingsClass === 'all' ? ASSETS : ASSETS.filter((a) => a.assetClass === state.rankingsClass);
  const usingModel = state.rankingsModel !== 'composite';

  const wrap = document.getElementById('rankings-table-wrap');

  if (usingModel) {
    wrap.innerHTML = '<div class="empty-state">Computing forecasts across all assets…</div>';
  }

  // Defer so the "computing…" state actually paints before the (up to ~1s) blocking computation.
  const run = () => {
    if (usingModel) {
      renderRankingsForModel(wrap, pool);
    } else {
      renderRankingsForComposite(wrap, pool);
    }
  };
  if (usingModel) requestAnimationFrame(() => requestAnimationFrame(run));
  else run();
}

function renderRankingsForComposite(wrap, pool) {
  const ranked = sliceForRankingsDirection(rankAssets(pool, state.rankingsLookback), state.rankingsTopN);

  const rows = ranked.map((r, i) => `
      <tr data-symbol="${escapeHtml(r.symbol)}">
        <td class="rank-num">${i + 1}</td>
        <td>
          <div class="asset-row-name">${escapeHtml(r.displayName)}</div>
          <div class="asset-row-symbol">${escapeHtml(r.symbol)}${r.country ? ' · ' + escapeHtml(r.country) : ''}</div>
        </td>
        <td>${ASSET_CLASS_LABELS[r.assetClass] || r.assetClass}</td>
        <td class="${pctClass(r.forecastChangePct)}">${formatPct(r.forecastChangePct)}</td>
        <td class="${pctClass(r.longTermAnnualGrowthPct)}">${formatPct(r.longTermAnnualGrowthPct)}</td>
        <td><span class="mini-badge" style="${riskBadgeStyle(r.riskLabel)}">${r.riskLabel}</span></td>
        <td>${r.r2.toFixed(2)}</td>
        <td><span class="mini-badge rec-${r.recommendationLabel}">${r.recommendationLabel}</span></td>
      </tr>`).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
    <table class="rankings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Asset</th>
          <th>Class</th>
          <th title="Projected change to the forecast horizon shown on the Dashboard for this lookback (e.g. ~3 months for a 12mo lookback)">Forecast %</th>
          <th title="The trend's slope, annualized as if it continued for a full year — can look extreme for short/volatile windows, use alongside R² and Risk">Trend (ann.)*</th>
          <th>Risk</th>
          <th title="R² of the trend line fit — how cleanly the asset has followed that trend (closer to 1 = cleaner)">R²</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8" class="empty-state">No assets match.</td></tr>'}</tbody>
    </table>
    </div>
    <div class="footnote">
      Ranked by a composite growth-potential score: 60% long-term trend + 40% recent momentum, scaled down for low-confidence (noisy) fits and for volatility above 20%/yr — so a noisy short-term spike doesn't outrank a steady, well-supported trend. Showing the ${state.rankingsDirection === 'bottom' ? 'lowest' : 'highest'}-scoring assets first. *Trend (ann.) annualizes the selected window's slope as if it continued for a full year — for short or fast-moving windows this can look far larger than the "Forecast %" figure, which instead projects to a realistic near-term horizon. This is not investment advice; it mechanically reflects only past price history.
    </div>`;

  wireRankingsRowClicks(wrap);
}

function renderRankingsForModel(wrap, pool) {
  const modelMeta = RANKING_MODEL_OPTIONS.find((m) => m.key === state.rankingsModel);
  const ranked = sliceForRankingsDirection(rankAssetsByModel(pool, state.rankingsLookback, state.rankingsModel), state.rankingsTopN);

  const rows = ranked.map((r, i) => {
    const hasRange = r.forecastLowChangePct !== null && r.forecastLowChangePct !== undefined;
    return `
      <tr data-symbol="${escapeHtml(r.symbol)}">
        <td class="rank-num">${i + 1}</td>
        <td>
          <div class="asset-row-name">${escapeHtml(r.displayName)}</div>
          <div class="asset-row-symbol">${escapeHtml(r.symbol)}${r.country ? ' · ' + escapeHtml(r.country) : ''}</div>
        </td>
        <td>${ASSET_CLASS_LABELS[r.assetClass] || r.assetClass}</td>
        <td class="${pctClass(r.forecastChangePct)}">${formatPct(r.forecastChangePct)}</td>
        <td style="color:var(--text-3); font-size:11px;">${hasRange ? formatPct(r.forecastLowChangePct) + ' to ' + formatPct(r.forecastHighChangePct) : '—'}</td>
        <td><span class="mini-badge" style="${riskBadgeStyle(r.riskLabel)}">${r.riskLabel}</span></td>
        <td>${r.r2.toFixed(2)}</td>
        <td><span class="mini-badge rec-${r.recommendationLabel}">${r.recommendationLabel}</span></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
    <table class="rankings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Asset</th>
          <th>Class</th>
          <th title="Projected change to the forecast horizon for this lookback, from the selected model">Forecast %</th>
          <th title="Low/high forecast range where the model provides one (Linear Trend, Monte Carlo, Ensemble)">Range</th>
          <th>Risk</th>
          <th title="R² of the underlying trend fit at this lookback (from the Linear Trend model, shown for context regardless of which model is selected)">R²</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8" class="empty-state">No assets match, or this model needs more history than most assets have at this lookback.</td></tr>'}</tbody>
    </table>
    </div>
    <div class="footnote">
      Ranked by <b>${escapeHtml(modelMeta ? modelMeta.label : state.rankingsModel)}</b>'s forecast % at the selected lookback, ${state.rankingsDirection === 'bottom' ? 'lowest' : 'highest'} first. Assets skipped where this model needs more history than is available (e.g. ARIMA/Moving Average Crossover/Feature Regression need 30-50+ bars). This is not investment advice; it mechanically reflects only past price history.
    </div>`;

  wireRankingsRowClicks(wrap);
}

/* Per-row expansion state: symbol of the currently-expanded row (or null)
   and its own isolated lookback/model-selection context, kept separate
   from the Dashboard's global state so opening a row in Rankings never
   affects (or is affected by) what's selected on the Dashboard tab. */
let rankingsExpandedSymbol = null;
let rankingsExpandedCtx = null;

function wireRankingsRowClicks(wrap) {
  wrap.querySelectorAll('tr[data-symbol]').forEach((row) => {
    row.addEventListener('click', () => {
      const symbol = row.getAttribute('data-symbol');
      if (rankingsExpandedSymbol === symbol) {
        rankingsExpandedSymbol = null;
        rankingsExpandedCtx = null;
      } else {
        rankingsExpandedSymbol = symbol;
        rankingsExpandedCtx = {
          lookback: state.rankingsLookback,
          selectedModelKeys: ['ensemble'],
          onChange: () => renderRankings(),
        };
      }
      renderRankings();
    });
  });

  if (rankingsExpandedSymbol) {
    const activeRow = wrap.querySelector(`tr[data-symbol="${cssEscape(rankingsExpandedSymbol)}"]`);
    if (activeRow) {
      activeRow.classList.add('rankings-row-expanded');
      const colCount = activeRow.children.length;
      const detailRow = document.createElement('tr');
      detailRow.className = 'rankings-detail-row';
      const cell = document.createElement('td');
      cell.colSpan = colCount;
      cell.innerHTML = '<div class="rankings-inline-detail panel"></div>';
      detailRow.appendChild(cell);
      activeRow.insertAdjacentElement('afterend', detailRow);
      renderAssetDetail(cell.querySelector('.rankings-inline-detail'), rankingsExpandedSymbol, rankingsExpandedCtx);
    } else {
      // The expanded asset fell out of the current filtered/sorted view.
      rankingsExpandedSymbol = null;
      rankingsExpandedCtx = null;
    }
  }
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/* ============================================================
   DIVIDENDS
   ============================================================ */

const DIVIDEND_LABEL_STYLE = {
  'Strong outlook': 'background: var(--accent-soft); color: var(--accent-ink);',
  'Stable': 'background: var(--gold-soft); color: var(--gold-ink);',
  'Caution': 'background: var(--gold-soft); color: var(--gold-ink);',
  'At risk': 'background: var(--risk-soft); color: var(--risk-ink);',
  'No dividend': 'background: var(--line); color: var(--text-2);',
  'Insufficient data': 'background: var(--line); color: var(--text-2);',
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Distinct months (across all years on record) this company has paid a
   dividend in, e.g. "Feb, May, Aug, Nov" for a typical quarterly payer —
   more useful for "when should I expect a payment" than just the most
   recent one. */
function typicalDividendMonths(dividends) {
  if (!dividends || dividends.length === 0) return null;
  const months = new Set(dividends.map((d) => Number(d.t.slice(5, 7)) - 1));
  return [...months].sort((a, b) => a - b).map((m) => MONTH_ABBR[m]).join(', ');
}

/* Average close price in the `windowMonths` before `dateStr`, from the
   asset's own price series in MARKET_DATA (already loaded for every
   dividend-tab company — confirmed 1:1 overlap with the price universe).
   Used to compute what % of the share price each dividend payment
   represented at the time, not just today's yield. */
function averagePriceBeforeDate(priceSeries, dateStr, windowMonths) {
  if (!priceSeries || priceSeries.dates.length === 0) return null;
  const end = new Date(dateStr);
  const start = new Date(end);
  start.setMonth(start.getMonth() - windowMonths);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  let sum = 0;
  let count = 0;
  for (let i = 0; i < priceSeries.dates.length; i++) {
    const d = priceSeries.dates[i];
    if (d >= startStr && d < endStr) {
      sum += priceSeries.closes[i];
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/* Per-payment yield: each dividend amount ÷ the average share price over
   the 3 months before that payout date, using the asset's real price
   history rather than a flat current-price estimate. */
function dividendsWithYieldAtPayout(dividends, priceSeries) {
  return (dividends || []).map((d) => {
    const avgPrice = averagePriceBeforeDate(priceSeries, d.t, 3);
    const yieldAtPayout = avgPrice && avgPrice > 0 ? d.amount / avgPrice : null;
    return { ...d, avgPrice3mo: avgPrice, yieldAtPayout };
  });
}

function populateDividendsFilters() {
  const countrySelect = document.getElementById('dividends-country');
  const countries = ['all', ...new Set((DIVIDEND_DATA.assets || []).map((a) => a.country))].sort((a, b) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)));
  countrySelect.innerHTML = countries.map((c) => `<option value="${c}">${c === 'all' ? 'All countries' : escapeHtml(c)}</option>`).join('');
  countrySelect.value = state.dividendsCountry;
  countrySelect.addEventListener('change', () => { state.dividendsCountry = countrySelect.value; renderDividends(); });

  const modelSelect = document.getElementById('dividends-model');
  modelSelect.innerHTML = DIVIDEND_MODEL_DEFS.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join('');
  modelSelect.value = state.dividendsModel;
  modelSelect.addEventListener('change', () => { state.dividendsModel = modelSelect.value; renderDividends(); });

  document.getElementById('dividends-top-n').addEventListener('change', (e) => {
    state.dividendsTopN = parseInt(e.target.value, 10);
    renderDividends();
  });

  document.getElementById('dividends-direction-top').addEventListener('click', () => {
    state.dividendsDirection = 'top';
    renderDividends();
  });
  document.getElementById('dividends-direction-bottom').addEventListener('click', () => {
    state.dividendsDirection = 'bottom';
    renderDividends();
  });
}

function updateDividendsDirectionChips() {
  document.getElementById('dividends-direction-top').classList.toggle('active', state.dividendsDirection === 'top');
  document.getElementById('dividends-direction-bottom').classList.toggle('active', state.dividendsDirection === 'bottom');
}

let dividendsExpandedSymbol = null;

function renderDividends() {
  updateDividendsDirectionChips();
  const wrap = document.getElementById('dividends-table-wrap');

  const pool = state.dividendsCountry === 'all'
    ? DIVIDEND_DATA.assets
    : DIVIDEND_DATA.assets.filter((a) => a.country === state.dividendsCountry);

  if (!pool || pool.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Dividend data isn\'t available (data/dividends.json failed to load or is empty).</div>';
    return;
  }

  // Sector-relative-yield needs peers from the *whole* dividend universe,
  // not just the country-filtered pool, so percentiles don't shift when
  // filtering to one country.
  const ranked = rankDividendAssets(pool, state.dividendsModel, DIVIDEND_DATA.assets);
  const sliced = state.dividendsDirection === 'bottom'
    ? ranked.slice(-state.dividendsTopN).reverse()
    : ranked.slice(0, state.dividendsTopN);

  const modelMeta = DIVIDEND_MODEL_DEFS.find((m) => m.key === state.dividendsModel) || DIVIDEND_MODEL_DEFS[0];

  const rows = sliced.map((r, i) => {
    const asset = DIVIDEND_DATA.assets.find((a) => a.symbol === r.symbol);
    const yieldStr = r.yieldPct !== null ? (r.yieldPct * 100).toFixed(2) + '%' : '—';
    const monthsStr = typicalDividendMonths(asset?.dividends) || '—';
    const scoreStr = r.model.score !== null ? r.model.score.toFixed(0) : '—';
    return `
      <tr data-symbol="${escapeHtml(r.symbol)}">
        <td class="rank-num">${i + 1}</td>
        <td>
          <div class="asset-row-name">${escapeHtml(r.displayName)}</div>
          <div class="asset-row-symbol">${escapeHtml(r.symbol)} · ${escapeHtml(r.country)}</div>
        </td>
        <td>${yieldStr}</td>
        <td style="font-size:var(--fs-small); color:var(--text-2);">${escapeHtml(monthsStr)}</td>
        <td>${scoreStr}</td>
        <td><span class="mini-badge" style="${DIVIDEND_LABEL_STYLE[r.model.outlookLabel] || ''}">${escapeHtml(r.model.outlookLabel)}</span></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
    <table class="rankings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Company</th>
          <th title="Current dividend yield (annual dividend / share price)">Yield</th>
          <th title="Distinct months this company has paid a dividend in, across its history on record">Paid in</th>
          <th title="${escapeHtml(modelMeta.label)} model score, 0-100">Score</th>
          <th title="${escapeHtml(modelMeta.label)} model outcome">Outlook</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty-state">No dividend-paying companies match this filter.</td></tr>'}</tbody>
    </table>
    </div>
    <div class="footnote">
      Ranked by the <b>${escapeHtml(modelMeta.label)}</b> model. Companies with a token dividend under 1.5% yield are excluded from this ranking even if their score is high (they're still viewable individually). Click a company to see all 7 models compared side by side. This is not investment advice; it mechanically reflects historical dividend payments and recent financial statements.
    </div>`;

  wrap.querySelectorAll('tr[data-symbol]').forEach((row) => {
    row.addEventListener('click', () => {
      const symbol = row.getAttribute('data-symbol');
      dividendsExpandedSymbol = dividendsExpandedSymbol === symbol ? null : symbol;
      renderDividends();
    });
  });

  if (dividendsExpandedSymbol) {
    const activeRow = wrap.querySelector(`tr[data-symbol="${cssEscape(dividendsExpandedSymbol)}"]`);
    if (activeRow) {
      activeRow.classList.add('rankings-row-expanded');
      const colCount = activeRow.children.length;
      const detailRow = document.createElement('tr');
      detailRow.className = 'rankings-detail-row';
      const cell = document.createElement('td');
      cell.colSpan = colCount;
      cell.innerHTML = '<div class="rankings-inline-detail panel"></div>';
      detailRow.appendChild(cell);
      activeRow.insertAdjacentElement('afterend', detailRow);
      renderDividendDetail(cell.querySelector('.rankings-inline-detail'), dividendsExpandedSymbol);
    } else {
      dividendsExpandedSymbol = null;
    }
  }
}

function renderDividendDetail(panel, symbol) {
  const asset = (DIVIDEND_DATA.assets || []).find((a) => a.symbol === symbol);
  if (!asset) {
    panel.innerHTML = '<div class="empty-state">No data for this asset.</div>';
    return;
  }

  const priceAsset = ASSET_BY_SYMBOL.get(symbol);
  const priceSeries = priceAsset ? { dates: priceAsset.dates, closes: priceAsset.closes } : null;
  const sectorYields = sectorYieldPercentiles(DIVIDEND_DATA.assets);

  const r = analyzeDividendAsset(asset, priceSeries, sectorYields);
  const currency = currencyForAsset({ symbol: r.symbol, assetClass: 'equity', country: r.country });

  const paymentsWithYield = dividendsWithYieldAtPayout(asset.dividends, priceSeries);
  const paymentRows = paymentsWithYield
    .slice()
    .reverse()
    .map((d) => `<tr><td>${d.t}</td><td>${formatPrice(d.amount, currency)}</td><td>${d.avgPrice3mo !== null ? formatPrice(d.avgPrice3mo, currency) : '—'}</td><td>${d.yieldAtPayout !== null ? (d.yieldAtPayout * 100).toFixed(2) + '%' : '—'}</td></tr>`)
    .join('');

  const fcfRows = (r.sustainability.fcfRows || []).map((row) => `<tr><td>${new Date(row.date).getFullYear()}</td><td>${row.freeCashFlow !== null && row.freeCashFlow !== undefined ? formatPrice(row.freeCashFlow / 1e6, currency) + 'M' : '—'}</td><td>${row.fcfMargin !== null ? (row.fcfMargin * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('');

  const modelRows = r.models.map((m) => {
    const scoreStr = m.score !== null ? m.score.toFixed(0) : '—';
    return `
      <tr>
        <td>${escapeHtml(m.label)}</td>
        <td>${scoreStr}</td>
        <td><span class="mini-badge" style="${DIVIDEND_LABEL_STYLE[m.outlookLabel] || ''}">${escapeHtml(m.outlookLabel)}</span></td>
        <td style="font-size:var(--fs-small); color:var(--text-2);">${escapeHtml(m.detail || '')}</td>
      </tr>`;
  }).join('');
  const modelNotes = r.models
    .filter((m) => m.methodNote)
    .map((m) => `<div class="footnote" style="margin:2px 0;"><b>${escapeHtml(m.label)}:</b> ${escapeHtml(m.methodNote)}</div>`)
    .join('');

  function quarterLabel(dateStr) {
    const d = new Date(dateStr);
    return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  }
  const quarterlyRows = (r.momentum.quarters || []).map((row) => `<tr><td>${quarterLabel(row.date)}</td><td>${formatPrice(row.freeCashFlow / 1e6, '')}M</td><td>${row.fcfMargin !== null ? (row.fcfMargin * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('');
  const momentumSection = r.momentum.available
    ? `
    <div class="section-block">
      <div class="section-title">Recent momentum — quarter-over-quarter FCF</div>
      <table class="rankings-table"><thead><tr><th>Quarter</th><th>Free cash flow</th><th>FCF margin</th></tr></thead><tbody>${quarterlyRows}</tbody></table>
      <div class="footnote" style="margin:8px 0 0;">Yahoo only provides the trailing ~5 quarters of cash flow data (about 15 months), regardless of how far back it's requested — this is the full quarterly window available, not a selectable range. It nudges the sustainability score by at most ±10 points, on top of the longer, more stable annual trend above.</div>
    </div>`
    : `
    <div class="section-block">
      <div class="section-title">Recent momentum — quarter-over-quarter FCF</div>
      <div class="footnote" style="margin:0;">Not available for this company — some markets (e.g. many UK-listed companies) report cash flow semi-annually rather than quarterly, so Yahoo has no quarterly data to show here. The annual trend above is unaffected.</div>
    </div>`;

  panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">
        <h1>${escapeHtml(asset.displayName)}</h1>
        <div class="symbol">${escapeHtml(asset.symbol)} · ${escapeHtml(asset.country)}</div>
      </div>
      <div class="detail-price">
        <div class="value">${formatPrice(r.snapshot?.currentPrice, currency)}</div>
      </div>
    </div>
    <div class="recommendation-block">
      <div class="rec-badge" style="${DIVIDEND_LABEL_STYLE[r.label] || ''}">${escapeHtml(r.label)}</div>
      <div class="rec-text">
        <p>${escapeHtml(r.growth.label)}. Payout ratio is ${escapeHtml(r.sustainability.payoutTier)}${r.sustainability.payoutRatio !== null ? ' (' + (r.sustainability.payoutRatio * 100).toFixed(0) + '% of earnings)' : ''}.${r.sustainability.marginTrend !== null ? ' FCF margin has ' + (r.sustainability.marginTrend >= 0 ? 'expanded' : 'contracted') + ' by ' + Math.abs(r.sustainability.marginTrend * 100).toFixed(1) + ' points over the available history.' : ''}${r.momentum.available && r.momentum.qoqGrowth !== null ? ' Recent quarters show FCF ' + (r.momentum.qoqGrowth >= 0 ? 'growing' : 'shrinking') + ' quarter-over-quarter.' : ''}</p>
        <div class="rec-meta">Current yield: <b>${r.yieldPct !== null ? (r.yieldPct * 100).toFixed(2) + '%' : '—'}</b> · Trailing P/E: <b>${r.snapshot?.trailingPE ? r.snapshot.trailingPE.toFixed(1) : '—'}</b> · Trailing EPS: <b>${r.snapshot?.trailingEps !== null && r.snapshot?.trailingEps !== undefined ? formatPrice(r.snapshot.trailingEps, currency) : '—'}</b></div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-cell">
        <div class="stat-label">Dividend CAGR</div>
        <div class="stat-value ${r.growth.cagr !== null ? pctClass(r.growth.cagr * 100) : ''}">${r.growth.cagr !== null ? formatPct(r.growth.cagr * 100) : '—'}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Years with cuts</div>
        <div class="stat-value ${r.growth.cutYears.length > 0 ? 'negative' : 'positive'}">${r.growth.cutYears.length}${r.growth.cutYears.length ? ' (' + r.growth.cutYears.join(', ') + ')' : ''}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">FCF margin (latest)</div>
        <div class="stat-value">${r.sustainability.latestFcfMargin !== null ? (r.sustainability.latestFcfMargin * 100).toFixed(1) + '%' : '—'}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">FCF growth (annualized)</div>
        <div class="stat-value ${r.sustainability.fcfCagr !== null ? pctClass(r.sustainability.fcfCagr * 100) : ''}">${r.sustainability.fcfCagr !== null ? formatPct(r.sustainability.fcfCagr * 100) : '—'}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">FCF momentum (recent quarters)</div>
        <div class="stat-value ${r.momentum.qoqGrowth !== null ? pctClass(r.momentum.qoqGrowth * 100) : ''}">${r.momentum.qoqGrowth !== null ? formatPct(r.momentum.qoqGrowth * 100) : '—'}</div>
      </div>
    </div>
    <div class="section-block">
      <div class="section-title">7 dividend models compared</div>
      <table class="rankings-table"><thead><tr><th>Model</th><th>Score</th><th>Outlook</th><th>Detail</th></tr></thead><tbody>${modelRows}</tbody></table>
      ${modelNotes}
    </div>
    <div class="section-block">
      <div class="section-title">Dividend payments</div>
      ${paymentRows ? `<table class="rankings-table"><thead><tr><th>Payment date</th><th>Amount</th><th>Avg. price (3mo prior)</th><th>Yield at payout</th></tr></thead><tbody>${paymentRows}</tbody></table>` : '<div class="footnote" style="margin:0;">No dividend history available.</div>'}
      <div class="footnote" style="margin:8px 0 0;">"Yield at payout" is that payment's amount ÷ the average closing price over the 3 months before the payment date — using this company's own real price history, not today's price. Shows what each payment was actually worth relative to the stock at the time, rather than assuming a flat current yield applied throughout.</div>
    </div>
    <div class="section-block">
      <div class="section-title">Free cash flow margin by year</div>
      ${fcfRows ? `<table class="rankings-table"><thead><tr><th>Fiscal year</th><th>Free cash flow</th><th>FCF margin</th></tr></thead><tbody>${fcfRows}</tbody></table>` : '<div class="footnote" style="margin:0;">No FCF history available.</div>'}
    </div>
    ${momentumSection}
    <div class="footnote">
      Dividend history and FCF/revenue are real historical figures from Yahoo Finance (dividend payments, and up to ~5 years of annual cash flow statements). This is a mechanical read of the past, not a forecast guarantee — companies can cut dividends or see FCF deteriorate for reasons this model can't see coming.
    </div>`;
}

/* ============================================================
   PORTFOLIO
   ============================================================ */

function populatePortfolioAssetSelect() {
  const select = document.getElementById('portfolio-asset-select');
  const groups = { index: [], equity: [], commodity: [] };
  ASSETS.forEach((a) => groups[a.assetClass].push(a));
  select.innerHTML = Object.entries(groups).map(([cls, list]) =>
    `<optgroup label="${ASSET_CLASS_LABELS[cls]}">${list.map((a) => `<option value="${escapeHtml(a.symbol)}">${escapeHtml(a.displayName)} (${escapeHtml(a.symbol)})</option>`).join('')}</optgroup>`
  ).join('');
}

document.getElementById('portfolio-add-btn').addEventListener('click', () => {
  const symbol = document.getElementById('portfolio-asset-select').value;
  const qty = parseFloat(document.getElementById('portfolio-qty-input').value);
  if (!symbol || !isFinite(qty) || qty <= 0) return;
  const existing = state.portfolio.find((h) => h.symbol === symbol);
  if (existing) existing.qty += qty;
  else state.portfolio.push({ symbol, qty });
  savePortfolio();
  document.getElementById('portfolio-qty-input').value = '';
  renderPortfolio();
});

function renderPortfolio() {
  populatePortfolioAssetSelect();

  const wrap = document.getElementById('portfolio-table-wrap');
  const summary = document.getElementById('portfolio-summary');
  const chartArea = document.getElementById('portfolio-chart-area');

  if (state.portfolio.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No holdings yet. Add an asset and quantity above.</div>';
    summary.innerHTML = '';
    chartArea.innerHTML = '';
    return;
  }

  const lookback = '12mo';
  let totalValue = 0;
  let totalForecastValue = 0;
  const rows = state.portfolio.map((holding) => {
    const asset = ASSET_BY_SYMBOL.get(holding.symbol);
    if (!asset) return '';
    const analysis = analyzeAsset(asset, lookback);
    const value = holding.qty * analysis.lastPrice;
    const forecastValue = holding.qty * analysis.lastPrice * (1 + analysis.forecastChangePct / 100);
    totalValue += value;
    totalForecastValue += forecastValue;
    const currency = currencyForAsset(asset);
    return `
      <tr>
        <td>${escapeHtml(asset.displayName)} <span class="asset-row-symbol">${escapeHtml(asset.symbol)}</span></td>
        <td>${holding.qty}</td>
        <td>${formatPrice(analysis.lastPrice, currency)}</td>
        <td>${formatPrice(value, currency)}</td>
        <td class="${pctClass(analysis.forecastChangePct)}">${formatPct(analysis.forecastChangePct)}</td>
        <td><span class="mini-badge rec-${analysis.recommendation.label}">${analysis.recommendation.label}</span></td>
        <td><button class="remove-btn" data-symbol="${escapeHtml(holding.symbol)}">Remove</button></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
    <table class="holdings-table">
      <thead><tr><th>Asset</th><th>Qty</th><th>Price</th><th>Value (mixed currencies)</th><th>12mo forecast</th><th>Signal</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;

  wrap.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.portfolio = state.portfolio.filter((h) => h.symbol !== btn.getAttribute('data-symbol'));
      savePortfolio();
      renderPortfolio();
    });
  });

  const forecastChangePct = totalValue > 0 ? ((totalForecastValue / totalValue) - 1) * 100 : 0;
  summary.innerHTML = `
    <div class="stat-cell">
      <div class="stat-label">Holdings</div>
      <div class="stat-value">${state.portfolio.length}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Total value (mixed currencies, face value)</div>
      <div class="stat-value">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Blended 12mo forecast</div>
      <div class="stat-value ${pctClass(forecastChangePct)}">${formatPct(forecastChangePct)}</div>
    </div>`;

  chartArea.innerHTML = '<div class="footnote" style="margin:0 0 8px;">Note: values are summed across each asset\'s native currency without FX conversion — for a mixed-currency portfolio, treat the total as directional only.</div>';
}

/* ============================================================
   INIT — called by loader.js once MARKET_DATA is assembled
   ============================================================ */

function initApp() {
  ASSETS = MARKET_DATA.assets;
  ASSET_BY_SYMBOL = new Map(ASSETS.map((a) => [a.symbol, a]));
  state = buildInitialState();

  applyTheme();
  populateDashboardFilters();
  populateRankingsFilters();
  populateDividendsFilters();
  renderTabs();
}

window.initApp = initApp;
