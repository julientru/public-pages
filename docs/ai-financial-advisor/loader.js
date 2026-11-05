/* Loads the split market-data files (data/index.js + one file per country
   + commodities.js) and assembles them into the same MARKET_DATA shape the
   rest of the app expects, then calls initApp().

   Each data file is a plain script that registers its payload on
   window.AFA_DATA (see scripts/data-file.js), so the page works when
   opened straight from disk (file://) — no local server needed. data/index.js
   is loaded by a <script> tag in index.html; the per-group files are added
   here so the progress bar can track them. */

(function () {
  try {
    const savedTheme = localStorage.getItem('afa-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (e) {}

  const barFill = document.getElementById('loading-bar-fill');
  const detail = document.getElementById('loading-detail');
  const loadingScreen = document.getElementById('loading-screen');
  const appRoot = document.getElementById('app-root');

  function setProgress(loaded, total, label) {
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
    barFill.style.width = pct + '%';
    if (label) detail.textContent = label;
  }

  function showError(message) {
    loadingScreen.innerHTML = `
      <div class="loading-title">My Financial Advisor</div>
      <div class="loading-error">
        Could not load market data: ${message}<br><br>
        Make sure the <code>data</code> folder sits next to <code>index.html</code> and contains the <code>.js</code> data files.
      </div>`;
  }

  const store = () => window.AFA_DATA || {};

  function loadScript(name) {
    return new Promise((resolve, reject) => {
      if (store()[name]) return resolve(store()[name]);
      const el = document.createElement('script');
      el.src = `data/${name}.js`;
      el.onload = () => (store()[name] ? resolve(store()[name]) : reject(new Error(`data/${name}.js did not define its data`)));
      el.onerror = () => reject(new Error(`could not load data/${name}.js`));
      document.head.appendChild(el);
    });
  }

  async function loadAll() {
    setProgress(0, 1, 'Loading market index…');
    const index = await loadScript('index');

    const groups = [...new Set(index.assets.map((a) => a.group))];
    let loaded = 0;
    setProgress(0, groups.length, `Loading ${groups.length} data files…`);

    const seriesBySymbol = new Map();
    await Promise.all(
      groups.map(async (group) => {
        const payload = await loadScript(group);
        for (const asset of payload.assets) {
          seriesBySymbol.set(asset.symbol, { dates: asset.dates, closes: asset.closes });
        }
        loaded++;
        setProgress(loaded, groups.length, `Loaded ${loaded}/${groups.length} data files…`);
      })
    );

    const assets = index.assets
      .map((meta) => {
        const series = seriesBySymbol.get(meta.symbol);
        if (!series) return null;
        return {
          symbol: meta.symbol,
          displayName: meta.displayName,
          assetClass: meta.assetClass,
          country: meta.country,
          unit: meta.unit,
          dates: series.dates,
          closes: series.closes,
        };
      })
      .filter(Boolean);

    window.MARKET_DATA = { generatedAt: index.generatedAt, assets };

    // Dividend data is a separate, smaller dataset (a large-cap subset,
    // not the full universe) — load it too, but don't fail the whole app
    // if it's missing or errors; the Dividends tab just shows an empty state.
    setProgress(groups.length, groups.length, 'Loading dividend data…');
    try {
      window.DIVIDEND_DATA = await loadScript('dividends');
    } catch (e) {
      console.warn('Could not load dividend data:', e.message);
      window.DIVIDEND_DATA = { generatedAt: null, assets: [] };
    }
  }

  loadAll()
    .then(() => {
      setProgress(1, 1, 'Ready.');
      loadingScreen.hidden = true;
      appRoot.hidden = false;
      if (typeof window.initApp === 'function') window.initApp();
    })
    .catch((err) => {
      console.error(err);
      showError(err.message);
    });
})();
