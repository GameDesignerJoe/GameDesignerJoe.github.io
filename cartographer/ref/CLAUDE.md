# CLAUDE.md — Cartographer Development Guide

## Project Overview

**Cartographer** is a chill, top-down 2D exploration game where the player IS the cartographer — you explore uncharted islands, survey terrain, collect specimens, and gradually build a hand-drawn map. The game aesthetic is Darwin-era naturalist field journals: ink on parchment, hand-drawn trees and rocks, wobbly coastlines, and IM Fell English typography.

The game is a single-file HTML/JS/CSS application deployed as a static site on GitHub Pages. There is no build step, no framework, no bundler. The entire game lives in one HTML file.

## Tech Stack

- **Language**: Vanilla JavaScript (ES6+)
- **Rendering**: HTML5 Canvas 2D
- **Styling**: Inline CSS within `<style>` tags
- **Fonts**: Google Fonts (IM Fell DW Pica, IM Fell DW Pica SC, Caveat)
- **Audio**: HTML5 Audio API (user-provided audio files)
- **AI Integration**: Anthropic API for procedural journal generation
- **Deployment**: Static HTML on GitHub Pages
- **No dependencies**: No npm, no build tools, no frameworks

## File Structure

```
/
├── CLAUDE.md              # This file
├── DESIGN.md              # Game design document
├── TECHNICAL.md           # Technical architecture document
├── MILESTONES.md          # Development roadmap
├── index.html             # The game (single file)
├── audio/                 # User-provided audio assets
│   ├── music/             # Background music tracks
│   ├── ambience/          # Biome ambient loops
│   ├── sfx/               # Sound effects (footsteps, UI)
│   └── journals/          # Voice-over audio for found journals
└── assets/                # Any future static assets
```

## Coding Conventions

### General Rules
- Everything lives in `index.html` — JS, CSS, and markup in one file
- No external JS/CSS files (fonts via Google Fonts CDN are the only exception)
- Use `const` and `let`, never `var`
- Use template literals for string interpolation
- Prefer `for...of` loops over `.forEach()` for performance in render loops
- Keep functions short and focused — if a function exceeds ~50 lines, split it

### Rendering Rules
- All world-space drawing happens inside the `ctx.save()/ctx.restore()` zoom transform block in `render()`
- UI/HUD elements draw AFTER `ctx.restore()` so they're not affected by zoom
- Use `worldToScreen()` for converting tile coordinates to canvas pixels
- Use `screenToWorld()` for converting mouse/touch input to tile coordinates
- Use `coastLine()` (deterministic wobble) for coastlines, `wobblyLine()` (random wobble) for decorative elements only
- `seededRandom(x, y)` for anything that must be consistent frame-to-frame (terrain features, tile decorations)
- `Math.random()` only for things that should vary per-session (specimen placement, landmark placement)

### Terrain System
- `getElevation(tx, ty)` returns a float — this is the source of truth for terrain
- `getTerrain(tx, ty)` maps elevation to terrain type strings
- `isLand()` and `isWalkable()` must always defer to `getTerrain()` — never use raw elevation thresholds
- Island shape is generated from `seedOffset` — changing this creates a new island

### State Management
- Game state is stored in module-level variables (no global object yet — this is a known refactor target)
- `revealedTiles` (Set) — tiles the player has walked near (fog cleared, no detail)
- `surveyedTiles` (Set) — tiles the player has surveyed with theodolite (full detail drawn)
- `specimens`, `landmarks`, `sextantReadings` — arrays of game objects
- `seedOffset` — controls terrain generation (randomized each new map)

### Input Handling
- Desktop: keyboard (WASD/arrows) + mouse click + scroll wheel
- Mobile: touch tap to move + pinch to zoom
- All input converts to world coordinates via `screenToWorld()` before processing
- Movement uses `tryMove()` which validates walkability with a margin buffer

## What NOT to Do

- **Don't add a build step.** No webpack, no vite, no parcel. This ships as a single HTML file.
- **Don't split into multiple files** unless explicitly directed. The single-file approach is intentional.
- **Don't add npm dependencies.** If you need a library, use a CDN link.
- **Don't use `requestAnimationFrame` for game logic.** `update()` runs game logic, `render()` draws. They're separate loops.
- **Don't use `Math.random()` for terrain features** — they'll jitter every frame. Use `seededRandom()`.
- **Don't change the `getElevation()` function signature.** Everything depends on it returning a float for integer tile coords.
- **Don't hardcode island shape parameters.** Everything should derive from `seedOffset` so New Map works.

## Known Architecture Issues

These are documented in TECHNICAL.md but worth flagging here:

1. **Coastline rendering** has edge cases with irregular island shapes — water tiles sometimes don't draw borders correctly
2. **Zoom transform** uses canvas `scale()` which means font sizes and line widths scale too — some UI elements may need inverse scaling
3. **No game state serialization** — there's no save/load yet
4. **Performance** — the full tile grid redraws every frame. Dirty-rect rendering would help but isn't implemented
5. **Mobile layout** — toolbar and info panels don't adapt to small screens

## Testing Approach

Since there's no test framework, verify changes by:

1. **New map generation**: Click "New Expedition" 5+ times, verify islands are different shapes with all landmarks/specimens placed
2. **Walk the coastline**: Walk the entire perimeter and verify the border draws consistently with no gaps
3. **Complete all quests**: Verify all four quest objectives can be completed (charting, position fix, specimens, landmarks)
4. **Zoom levels**: Test at minimum and maximum zoom — verify click-to-move works correctly at all zoom levels
5. **Mobile**: Test touch input, verify no overlapping UI elements

## Running Locally

Just open `index.html` in a browser. No server needed unless testing audio (which requires HTTP due to CORS):

```bash
# Simple local server for audio testing
python3 -m http.server 8000
# Then open http://localhost:8000
```
