# Vye Duel

A two-player micro version of Vye, the card game of capture and control. Tiles flip to show
ownership, so no tokens are needed. The page has three tabs:

- **Setup** — Land types and copies, each player's Family sideboard, which Specials go in the deck, board limits, stacking and end conditions.
- **Play** — play against an AI persona, hotseat, or watch two AIs.
- **Simulate** — run hundreds of AI-vs-AI games and see win rates, first-player advantage and each card's swing (min, max, mean, SD).

Play it at https://gamedesignerjoe.github.io/vye_duel/

## Default build

7 Land types × 3, a King and a Knave for each player, a hand of 2, one each of Usurp, Sinkhole and Lost City,
unlimited stacking (anything but the Crossroads can be covered), and Family captures can take the Crossroads.

## House rule

The first player must win by 2: the second player gets +1 point and wins ties.
Simulations showed careful players won about 55% going first without it, and about 49% with it.
You can change this in Setup → Game end.

## Card art

Tile art lives in `art/`, one square image per card:

| Folder | Files |
|---|---|
| `art/lands/` | `birchwood.jpg`, `wolf-hollow.jpg`, `violet-peaks.jpg`, `golden-fields.jpg`, `ice-cliffs.jpg`, `spire-isle.jpg`, `night-thicket.jpg`, `high-peaks.jpg`, `whale-sea.jpg`, `stag-forest.jpg`, `green-hills.jpg`, `dragon-keep.jpg`, `raven-moor.jpg`, `owl-marsh.jpg`, `longship.jpg`, `firelands.jpg` |
| `art/specials/` | `lostcity.jpg`, `sinkhole.jpg`, `sanctuary.jpg`, `underminers.jpg`, `earthquake.jpg`, `waystone.jpg` (Usurp has no art yet; add `usurp.jpg` and list it in `ART_SPECIALS` in `ui.html`) |
| `art/family/` | `<house>-<member>.jpg` for house `blue`, `red`, `green`, `orange`, `black` and member `king`, `queen`, `heir`, `advisor` (and `knave` once there's art for it). Midnight uses `blue`, Roses uses `red`. |

To change a picture, replace the file with a square image of the same name (around 320×320 px).
To crop a full card face down to just its illustration:

```
pip install pillow numpy
python tools\crop_art.py path\to\card.jpg art\lands\birchwood.jpg
```

If a file is missing, the tile falls back to a simple symbol. The **Card art** checkbox on the Play tab turns art off.

## Files

| File | What it is |
|---|---|
| `engine.js` | Rules, AI personas and batch simulator. Works in the browser and in Node. |
| `ui.html` | Page source. The engine is inlined at build time. |
| `build.js` | Builds `index.html` from `ui.html` + `engine.js`. |
| `sim.js` | Command-line batch run. |
| `compare.js` | Runs several rule variants side by side. |

## Commands (Windows, from this folder)

```
node build.js
node sim.js 1000 cautious greedy
node sim.js 500 builder cautious "{\"landCopies\":2,\"landSets\":10}"
node compare.js
```

Personas: `greedy`, `builder`, `cautious`, `hoarder`, `chaotic`, `random`.
The config JSON is the same as the page's **Copy config** button.
