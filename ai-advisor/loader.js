/* Loads the split market-data files (data/index.json + one file per country
   + commodities.json) in parallel, assembles them into the same MARKET_DATA
   shape the rest of the app expects, then calls initApp(). */

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
      <div class="loading-title">AI Financial Advisor</div>
      <div class="loading-error">
        Could not load market data: ${message}<br><br>
        This prototype needs to be served over HTTP (not opened directly as a file) so it can fetch its data files — double-click <code>start.command</code> in this folder, or run <code>node serve.js</code> yourself and open http://localhost:4300/.
      </div>`;
  }

  async function loadAll() {
    if (window.location.protocol === 'file:') {
      throw new Error(
        "this page was opened directly from disk (file://), which browsers block from loading local data files. " +
        "Double-click start.command in the prototypes folder instead — it starts a local server and opens this page correctly."
      );
    }

    setProgress(0, 1, 'Loading market index…');
    const indexResp = await fetch('data/index.json');
    if (!indexResp.ok) throw new Error(`index.json: HTTP ${indexResp.status}`);
    const index = await indexResp.json();

    const groups = [...new Set(index.assets.map((a) => a.group))];
    let loaded = 0;
    setProgress(0, groups.length, `Loading ${groups.length} data files…`);

    const seriesBySymbol = new Map();
    await Promise.all(
      groups.map(async (group) => {
        const resp = await fetch(`data/${group}.json`);
        if (!resp.ok) throw new Error(`${group}.json: HTTP ${resp.status}`);
        const payload = await resp.json();
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
