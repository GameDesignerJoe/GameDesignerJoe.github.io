# CLAUDE.md — Cartographer Development Guide

## Project Overview

**Cartographer** is a chill, top-down 2D exploration game where the player IS the cartographer — you explore uncharted islands, survey terrain, collect specimens, and gradually build a hand-drawn map. The game aesthetic is Darwin-era naturalist field journals: ink on parchment, hand-drawn trees and rocks, wobbly coastlines, and IM Fell English typography.

The game is deployed as a static site on GitHub Pages. It uses native ES Modules — no build step, no npm, no bundler. A local HTTP server is required for development (ES modules don't work over `file://`).

## Tech Stack

- **Language**: Vanilla JavaScript (ES2020+, native ES modules)
- **Rendering**: HTML5 Canvas 2D
- **Styling**: External CSS (`css/style.css`)
- **Fonts**: Google Fonts (IM Fell DW Pica, IM Fell DW Pica SC, Caveat)
- **Audio**: HTML5 Audio API (user-provided audio files, planned)
- **AI Integration**: Anthropic API for procedural journal generation (planned)
- **Deployment**: Static site on GitHub Pages
- **No dependencies**: No npm, no build tools, no frameworks

## File Structure

```
cartographer/
├── index.html              ← HTML shell; loads main.js as module
├── css/
│   └── style.css           ← All styles
├── js/
│   ├── main.js             ← Entry point: game loops, startGame(), newMap()
│   ├── config.js           ← All constants (TILE, GRID, colors, speeds, thresholds)
│   ├── canvas.js           ← Canvas/ctx singleton + resize handler
│   ├── state.js            ← Shared mutable game state (single exported object)
│   ├── terrain.js          ← getElevation, getTerrain, isLand, isWalkable, seededRandom, smoothNoise
│   ├── camera.js           ← worldToScreen, screenToWorld, updateCamera, zoom
│   ├── fogOfWar.js         ← revealAroundPlayer, surveyAroundPlayer, revealSquareAround
│   ├── movement.js         ← tryMove, processKeyboardMovement, processClickMovement, updateMeasureTrail
│   ├── landmarks.js        ← LANDMARK_TYPES, generateLandmarks, checkLandmarkDiscovery
│   ├── specimens.js        ← SPECIMEN_TYPES, generateSpecimens, tryCollectSpecimen, generateIslandName
│   ├── tools.js            ← doSurvey, toggleMeasure, doSextant, doCollect, selectTool, handleInteraction
│   ├── input.js            ← setupInputHandlers (keyboard, mouse, touch, wheel)
│   ├── rendering.js        ← Main render() function; orchestrates all draw calls
│   ├── ui.js               ← All DOM updates: quests, specimen slots, toasts, coord display
│   └── draw/
│       ├── coastline.js    ← wobblyLine, coastLine helpers
│       ├── features.js     ← drawTree, drawRock, drawGrass, drawContourForTile
│       ├── tiles.js        ← drawTile (all 4 tile states)
│       ├── entities.js     ← drawPlayer, drawLandmarks, drawSpecimens, drawMeasureTrails, drawSextantFixes, drawCoordinateGrid
│       └── animations.js   ← drawAnimations (survey ring, sextant starlines)
├── docs/
│   ├── CLAUDE.md           ← This file
│   ├── DESIGN.md           ← Game design document
│   ├── TECHNICAL.md        ← Technical architecture document
│   └── MILESTONES.md       ← Development roadmap
└── ref/
    └── cartographer_v3.html   ← Original prototype (preserved for reference)
```

## Dependency Graph (no circular imports)

```
config.js           ← no imports
canvas.js           ← no imports
state.js            ← config
terrain.js          ← config, state
camera.js           ← config, state, canvas
fogOfWar.js         ← config, state, terrain
movement.js         ← config, state, terrain, fogOfWar
landmarks.js        ← config, state, terrain
specimens.js        ← config, state, terrain
draw/coastline.js   ← canvas, terrain
draw/features.js    ← canvas, config, terrain, draw/coastline
draw/tiles.js       ← canvas, config, state, terrain, camera, draw/coastline, draw/features
draw/entities.js    ← canvas, config, state, camera, draw/coastline
draw/animations.js  ← canvas, config, state, camera, draw/coastline
rendering.js        ← canvas, config, state, camera, draw/*
ui.js               ← config, state, terrain
tools.js            ← config, state, terrain, fogOfWar, landmarks, specimens, camera, ui
input.js            ← config, state, canvas, camera, tools, movement
main.js             ← all modules (entry point)
```

## State Architecture

`state.js` exports a single mutable object. All modules import and mutate it directly. `state.js` imports only from `config.js`, so there are no circular dependencies.

Key state fields:
- `gameStarted`, `currentTool` — game status
- `player: { x, y }`, `camera: { x, y }`, `zoom` — positioning
- `seedOffset`, `placementSeed` — island generation seeds
- `revealedTiles: Set<"tx,ty">`, `surveyedTiles: Set<"tx,ty">` — fog of war
- `landmarks`, `specimens`, `discoveredLandmarks`, `collectedSpecimens` — game objects
- `measuring`, `measureTrail`, `measureDistance`, `completedMeasures` — measure tool
- `sextantReadings`, `coordDigitsLat`, `coordDigitsLng`, `revealedDigitCount` — sextant
- `activeAnimation` — current canvas animation (survey ring or sextant starlines)
- `keys: {}` — live keyboard state map
- `moveTarget` — click-to-move destination

## Coding Conventions

### Module Rules
- Import `ctx` and `canvas` from `canvas.js` — don't pass as parameters
- Import `state` and mutate it directly — no prop-drilling
- No side effects on import — all init happens in `main.js`
- Never create circular imports — always check the dependency graph above

### Rendering Rules
- All world-space drawing happens inside the `ctx.save()/ctx.restore()` zoom transform block in `rendering.js`
- HUD elements are HTML overlays (not canvas), so they're unaffected by zoom
- Use `worldToScreen(wx, wy)` for tile → canvas pixel conversion
- Use `screenToWorld(sx, sy)` for mouse/touch → tile coordinate conversion
- Use `coastLine()` (seeded, deterministic) for coastlines
- Use `wobblyLine()` (Math.random, jitters) for decorative elements only
- Use `seededRandom(x, y)` for anything that must be stable frame-to-frame (terrain features)
- Use `Math.random()` only for per-session randomness (specimen/landmark placement)

### Terrain System
- `getElevation(tx, ty)` → float — source of truth for terrain height
- `getTerrain(tx, ty)` → string biome — source of truth for terrain type
- `isLand()` and `isWalkable()` must defer to `getTerrain()`, never raw elevation
- All terrain is deterministic: same `state.seedOffset` = same island

### Two-tier Fog of War
- **Revealed** (`revealedTiles`): Terrain color + coastline visible, no interior detail
- **Surveyed** (`surveyedTiles`): Full detail — trees, rocks, grass, contour lines, heavy coastline

## What NOT to Do

- **Don't add a build step.** No webpack, vite, parcel, or npm.
- **Don't create circular imports.** If you need A→B and B→A, extract shared code into a third module.
- **Don't draw HUD elements inside the zoom transform block.** The zoom will scale them — they should be HTML overlays.
- **Don't use `Math.random()` for terrain features.** They'll jitter every frame. Use `seededRandom()`.
- **Don't use `await import()` (dynamic imports) in synchronous functions.** Use static top-level imports.
- **Don't use global variables.** Everything lives in modules — use imports/exports.
- **Don't hardcode island shape parameters.** Everything derives from `seedOffset`/`placementSeed`.

## Running Locally

ES modules require HTTP — open via a local server, not `file://`:

```bash
# From the project root
python3 -m http.server 8000
# Open: http://localhost:8000/cartographer/
```

## Testing Checklist

1. **Title screen loads**: Parchment background + animated wave lines + "Begin Expedition" button
2. **Island generates**: Click "Begin Expedition" — unique island shape with all terrain types
3. **Walk tool**: WASD + click-to-move both work; player can't enter water
4. **Fog of war**: Terrain reveals as player walks; survey reveals features
5. **All 5 tools work**: Walk, Theodolite (survey), Measure (toggle), Sextant (fix), Naturalist (collect)
6. **Quest tracker updates**: All 4 categories increment correctly
7. **New Expedition**: Click "New Expedition" — fresh island with new shape
8. **Zoom**: Mouse wheel zooms in/out smoothly
9. **Console**: Zero errors in browser devtools console
