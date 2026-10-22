# kids-games

Simple logic games for kids aged 5 to 10. Plain HTML and vanilla JavaScript: no build step, no dependencies, nothing saved (everything lives in browser memory).

## Games

| Game | Folder | Controls |
| --- | --- | --- |
| 🧱 Blocks (Tetris-style) | `games/tetris/` | On-screen buttons, or ⬅️ ➡️ move, ⬆️ turn, ⬇️ faster, Space drop |
| 🐸 Jumpy Frog | `games/jump/` | Tap the game / Jump button, or Space / ⬆️ |
| 🃏 Memory Match | `games/memory/` | Tap cards, or Tab + Enter. Easy / Medium / Hard |

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish with GitHub Pages

1. In the repo on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-user>.github.io/kids-games/`.

All links are relative, so the site works from that sub-path. The empty `.nojekyll` file tells Pages to serve files as-is.

## Adding a game

Create `games/<name>/index.html` (link `../../css/style.css` for the shared look and include a 🏠 link back to `../../index.html`), then add a card for it in the root `index.html`.
