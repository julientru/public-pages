# kids-games

Simple logic games for kids aged 5 to 10, in English, French and Cantonese. Plain HTML and vanilla JavaScript: no build step, and nothing saved except the language you pick (everything else lives in browser memory).

## Games

| Game | Folder | Controls |
| --- | --- | --- |
| 🧱 Blocks (Tetris-style) | `games/tetris/` | On-screen buttons, or ⬅️ ➡️ move, ⬆️ turn, ⬇️ faster, Space drop |
| 🐸 Jumpy Frog | `games/jump/` | Tap the game / Jump button, or Space / ⬆️ |
| 🃏 Memory Match | `games/memory/` | Tap cards, or Tab + Enter. Easy / Medium / Hard |
| 💡 Lights Out | `games/lights/` | Tap a light, or Tab + Enter. Easy / Medium / Hard |
| 🧩 Slide Puzzle | `games/slide/` | Tap a tile next to the space, or arrow keys. Easy / Hard |
| 🍎 Picture Sudoku | `games/sudoku/` | Tap a square then a fruit, or Tab + keys 1–6. Easy (4×4) / Hard (6×6) |
| 🎵 Copy Me | `games/simon/` | Tap the animals, or keys 1–4 |
| 🗼 Tower Move | `games/hanoi/` | Tap a pole to pick up, tap another to drop, or keys 1–3. 3 / 4 / 5 rings |
| 🔁 What's Next? | `games/pattern/` | Tap a choice, or keys 1–3. Gets harder as you score |
| 🐭 Mouse Maze | `games/maze/` | Swipe, on-screen arrows, or arrow keys / WASD. Easy / Medium / Hard |
| 🔍 Odd One Out | `games/odd/` | Tap a picture, or keys 1–5. 10 rounds |
| 🌊 Color Flood | `games/flood/` | Tap a square or color button, or keys 1–6. Easy / Medium / Hard |
| ❌ Tic-Tac-Toe | `games/tictactoe/` | Tap a square, or keys 1–9. Easy robot / Clever robot |
| 🪖 Army Rush | `games/army/` | Slide on the field, hold ⬅️ ➡️, or arrow keys / A D. Your army shoots by itself; shoot a box for a new weapon, more of your weapon, a bigger wall or a shield. A missed weapon never comes back. Easy / Normal / Hard / Mega-hard, 12 waves |
| 🪖 Army Rush 3D | `games/army3d/` | Same rules and controls as Army Rush, drawn in 3D from behind your army (uses Three.js) |
| 🎯 Army Rush FPS | `games/armyfps/` | Same rules as Army Rush, seen through your own eyes from behind the wall. Tap or drag to move the cross-hair (or use the mouse); your army shoots at it. Hold ⬅️ ➡️ (or the arrow keys, or keep your finger at a side) to turn and see your soldiers beside you. 85° wide view upright, 135° on its side (uses Three.js) |

### 2-player games

Pick 👤👤 2 at the top of the hub to see them.

| Game | Folder | How to play |
| --- | --- | --- |
| ⚡ Snap Match | `games/snap/` | Face to face: phone flat between the players. First to tap the yellow picture in your own grid gets a ⭐. Wrong tap = frozen for 1 second. 5 ⭐ wins. |
| 🍎 Apple Grab | `games/apples/` | Face to face, taking turns: take 1, 2 or 3 apples. Whoever takes the last apple wins the round. 3 rounds wins. |
| 🔴🟡 Four in a Row | `games/connect4/` | Take turns on the same screen: tap a column to drop a disc. Four in a line wins. |

## Languages

The hub has a switch for English, Français and 廣東話 (Cantonese, written in Traditional Chinese). On the first visit the language comes from the browser's language settings: French for `fr…`, Cantonese for `yue`, `zh-HK`, `zh-MO` or `zh-Hant`, otherwise English. Once someone taps the switch, that choice is kept in the browser (`localStorage`) for the hub and every game. Add `?lang=fr` (or `en`, `zh-HK`) to any page address to force a language for a test.

`js/i18n.js` does the work. The English text is the key, so the English pages need no change: each game has a `strings.js` with the French and Cantonese for its texts, and once the page loads every text and `aria-label` with a translation is swapped. Texts the game writes while you play go through `I18n.t("…")`, with `{n}` for numbers. Anything with no translation simply stays in English.

## Libraries

Army Rush 3D and Army Rush FPS draw with [Three.js](https://threejs.org/) r159, committed as one file in `js/lib/three.min.js` (MIT licence in `js/lib/three.LICENSE`). It is the classic script build, so the game works from GitHub Pages, offline, and when opening the file directly. Every other game uses no library.

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

Create `games/<name>/index.html` (link `../../css/style.css` for the shared look and include a 🏠 link back to `../../index.html`), then add a card for it in the root `index.html`. Load `../../js/i18n.js` and a `strings.js` with the game's French and Cantonese before the game's script, and add the card's name and description to `js/hub.js`.

For a multiplayer game, add `data-players="2"` (or 3, 4) to its card so the player-count menu shows it; cards without it are 1-player games. Face-to-face games can reuse `css/duel.css` and `js/duel.js` (top half turned upside down, shared start/winner screen).
