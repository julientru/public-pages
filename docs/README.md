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

### Manage my city (all three Army Rush games)

Tick **🏘️ Manage my city** under the levels, then tap the 🏘️ button to open a 2D map of your own city while the battle goes on. It starts as a village with one hut and one person. Give people jobs (🌾 farmer, 👷 brick maker, ⛏️ miner, 🛒 trader, 🐄 cow herder, 🧪 scientist), build houses so more people come, and the city moves up through 20 ages as it grows: Stone Age, First Farmers, Egyptian Empire, Ancient Greece, Roman Empire, Chinese Empire, Viking Age, Middle Ages, Renaissance, Age of Explorers, Industrial Age, Railway Age, Electric Age, Age of Cars, Jet Age, Space Age, Computer Age, Internet Age, Robot Age and AI Empire.

The bigger the city, the more food each person eats. In every new age you can upgrade your houses (one more person in each, and the look of the age), labs (more ideas) and barracks (faster training) in the Build tab.

The ground and walls change with every age, each age leaves its landmark beside the road at the bottom of the map, from the Railway Age the road gets the vehicles of the age and flying machines cross the sky, and day turns to night (windows light up). The main gate leads down to the road, the only way the enemy comes in; the fields and the mine have their own gate on the left of the wall, and the pasture and the brick yard one on the right. The people are all different (men and women, many skin tones, clothes and hats), and each worker carries the tool of their job.

The battle follows your age: its waves come from your age and repeat until you reach the next one, and there is no last wave, so the AI Empire's waves (King Tank included) keep coming until you lose. The city helps: barracks train soldiers, traders' gold buys soldiers, the lab finds the next weapon (each one only once its age is reached), towers on the wall shoot at the enemy (upgrade them in Build, but they always stay one weapon behind your army, so never the mega bomb; the enemy goes for them first, each has its own life bar, you fix them in Build and build a new one when one falls), and bricks make the wall stronger or fix it. A red bar warns you when the enemy attacks or hits your wall or towers, the enemy plants its silly flag in the middle of your town when you lose, and there are 15 calm seconds between waves. With the city on, the battle has no weapon, army or wall boxes: your city makes all that. Only a shield box comes now and then, less often on harder levels. The shared code is in `games/army/city.js`, `city.css` and `city-strings.js`.

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

Create `games/<name>/index.html` (link `../../css/style.css` for the shared look and include a 🏠 link back to `../../index.html`), then add a card for it in the root `index.html`. Load `../../js/i18n.js` and a `strings.js` with the game's French and Cantonese before the game's script, and add the card's name and description to `js/hub.js`. A card with `data-off` stays hidden from the hub (its game still works); remove the attribute to show it again.

For a multiplayer game, add `data-players="2"` (or 3, 4) to its card so the player-count menu shows it; cards without it are 1-player games. Face-to-face games can reuse `css/duel.css` and `js/duel.js` (top half turned upside down, shared start/winner screen).
