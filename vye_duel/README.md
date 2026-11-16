# Vye Duel

A two-player micro version of Vye, the card game of capture and control. Tiles flip to show
ownership, so no tokens are needed. The page has three tabs:

- **Setup** — Land types and copies, each player's Family sideboard, which Specials go in the deck, board limits, stacking and end conditions.
- **Play** — play against an AI persona, hotseat, or watch two AIs.
- **Simulate** — run hundreds of AI-vs-AI games and see win rates, first-player advantage and each card's swing (min, max, mean, SD).

Play it at https://gamedesignerjoe.github.io/vye_duel/

## Default build

7 Land types × 3 (Dragon Keep, Longship, Owl Marsh, Raven Moor, Firelands, Violet Peaks, Green Hills), a King and a Knave for each player, a hand of 2, one each of Usurp, Sinkhole and Lost City,
unlimited stacking (anything but the Crossroads can be covered), and Family captures can take the Crossroads.

## House rule

The second player wins ties. With careful players this comes out close to 50/50.
(An earlier "first player must win by 2" rule, +1 point for the second player, tipped things to the second player once the AI got smarter.)
You can change this in Setup → Game end.

## Print and play

`print/vye-duel-print-and-play.pdf`: 2 pages of rules and 3 double-sided sheets of 2.5-inch tiles (US Letter, print pages 3–8 double-sided, flip on long edge).
`print/vye-duel-print-and-play-67mm.pdf` is the same game with 67 mm tiles for 70 mm square card sleeves (9 per page, 4 sheets); build it with `node build_pdf.js 67mm`.

To rebuild it after changing tiles or rules (`print/rules.html`, `print/print.css`, the tile list in `print/build_pdf.js`):

```
cd print
npm i playwright
npx playwright install chromium
node build_pdf.js
```

### Small-tile edition

`print/small/vye-duel-small-tiles-print-and-play.pdf`: the same rules plus one double-sided sheet with two full sets of 0.7 inch (Scrabble-size) icon tiles.
The icons live in `print/small/tiles.js`, which the game also uses for its **Icons** tile style. Rebuild with `node build_small_pdf.js` in `print/small`.

## Card art

Tile art lives in `art/`, one square image per card: the whole 3rd-edition picture, nothing cut off, on plain card paper (#F9F1E4).
All 16 Lands are in the game; the first 7 in `LANDS` (engine.js, same order in `print/small/tiles.js`) are the default set and the only ones in the print and play.

| Folder | Files |
|---|---|
| `art/lands/` | `dragon-keep.jpg`, `longship.jpg`, `owl-marsh.jpg`, `raven-moor.jpg`, `firelands.jpg`, `violet-peaks.jpg`, `green-hills.jpg`, then `wolf-hollow.jpg`, `spire-isle.jpg`, `ice-cliffs.jpg`, `golden-fields.jpg`, `night-thicket.jpg`, `birchwood.jpg` (the desert fox art for now), `high-peaks.jpg`, `whale-sea.jpg`, `stag-forest.jpg` |
| `art/specials/` | `lostcity.jpg`, `sinkhole.jpg`, `sanctuary.jpg`, `underminers.jpg`, `earthquake.jpg`, `waystone.jpg` (Usurp has no art yet; add `usurp.jpg` and list it in `ART_SPECIALS` in `ui.html`) |
| `art/family/` | `<house>-<member>.jpg` for house `blue`, `red`, `green`, `orange`, `black` and member `king`, `queen`, `heir`, `advisor` plus `blue-knave.jpg` and `red-knave.jpg` (cropped from your full Knave cards, kept in `art/knave-cards/`). Midnight uses `blue`, Roses uses `red`. |

To change a picture, replace the file with a square image of the same name (around 320×320 px).
To redo all the art from the 3rd-edition card exports (it also writes the larger print copies to `print/art/`):

```
pip install pillow numpy
python tools\crop_art3.py path\to\card-exports art\knave-cards
```

It covers the card-type logo in the top-left with paper and keeps the whole picture. Rebuild the PDFs afterwards.
The house badges (Midnight owl, Roses rose) are traced from the crests and live in `SIGIL` in `print/small/tiles.js`.

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
