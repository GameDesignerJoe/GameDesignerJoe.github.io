# Vye Duel

A two-player micro version of Vye, the card game of capture and control. Tiles flip to show
ownership, so no tokens are needed. The page has three tabs:

- **Setup** — Land types and copies, each player's Family sideboard, which Specials go in the deck, board limits, stacking and end conditions.
- **Play** — play against an AI persona, hotseat, or watch two AIs.
- **Simulate** — run hundreds of AI-vs-AI games and see win rates, first-player advantage and each card's swing (min, max, mean, SD).

Play it at https://gamedesignerjoe.github.io/vye_duel/

## House rule

The first player must win by 2: the second player gets +1 point and wins ties.
Simulations showed careful players won about 55% going first without it, and about 49% with it.
You can change this in Setup → Game end.

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
