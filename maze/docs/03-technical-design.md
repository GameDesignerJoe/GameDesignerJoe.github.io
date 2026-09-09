# LABYRINTH — Technical Design & Stack

## Stack — Decided

- **Prototype:** Single HTML file, Three.js r128 via CDN, vanilla JS. Fast iteration, shareable.
- **Production:** React 18 + Vite + TypeScript + Three.js (React Three Fiber optional). Zustand for state. Tailwind for UI chrome.
- **Hosting:** Vercel (needed for API-key security and dynamic routing). GitHub: GameDesignerJoe.
- **Persistence:** localStorage Phase 1; cross-run persistence (basins, chrysalis remnants) will need a small backend or Vercel KV later.
- **Voice:** ElevenLabs (API key in hand). **LLM (if any):** Groq.

## Why 3D, not 2D canvas

2D canvas faking perspective required manual polygon math, z-ordering, and layering that compounded errors — three attempts all read as "a rectangle floating in dark." Three.js handles perspective, occlusion, and lighting correctly by construction. Node-based movement is preserved: the world is static geometry; only the camera moves.

## Locked Camera & Corridor Values (from slider session)

| Parameter | Value |
| --- | --- |
| FOV | 68 |
| Eye height | 2.0 |
| Near clip | 0.08 |
| Corridor width | 4.1 |
| Corridor height | 4.0 |
| Step size | 4.5 |
| Move duration | ~270 ms, ease-in-out quad |
| Fog | FogExp2, #080808, density ~0.036 |
| Tone mapping | None (ACES made everything brown) |

These are baselines. Width/height will vary per room type via config.

## Systems Architecture

Independent modules communicating only through a shared, serializable **Game State**. No module reaches into another's internals.

- **Maze Gen** — runs once per session from seed + config. Outputs a 3D hex graph: per-node biome, connections, level, symbol slots, remnant slots, puzzle cluster tags. Sealed after generation.
- **Nav Engine** — validates moves against the graph; updates position/facing/level; handles entrance-tile reclassification to wall.
- **Renderer** — Three.js scene built from the graph: floor/ceiling/wall panels per node and per passage, torches, fog, later textures and post-process dither.
- **Puzzle Engine** — tracks cluster states, validates solve conditions, emits effects (open passage, reveal tile, spawn remnant, consume burden).
- **Narrative Engine** — remnant discovery, soft ordering of fragments per character, VO trigger, journal population, cross-run chrysalis placement.
- **Map System** — player-drawn hex canvas; charges charcoal/pencil; never auto-reveals.
- **Audio Engine** — ambient / SFX / narrative / threat channels with ducking and crossfade.
- **Entity System** — creatures and Caretaker state machines, ticked per player move. (Back-burnered.)
- **Game State** — position, facing, level, inventory, burdens, map data, encountered remnants, puzzle states, session flags. Saved on every meaningful action.

## Geometry Construction Rule

Keep it dumb and explicit. Each passage = floor slab + ceiling slab + two side walls. Each closed face = one wall panel. Each junction = wall panels split into jambs around the opening. Dedupe passages with an edge-key set. Hex-angled corridors are just the same boxes rotated by atan2(dx, dz). Clever math failed twice; boxes worked first time.

## Config File — labyrinth.config.json

```json
{
  "maze": {
    "width": 15, "height": 15, "levels": 3, "seed": null,
    "biome_distribution": {
      "marble": 0.25, "stone": 0.25, "dirt": 0.15, "flooded": 0.10,
      "overgrown": 0.10, "ash": 0.08, "obsidian": 0.05, "domestic": 0.02
    }
  },
  "camera":   { "fov": 68, "eyeHeight": 2.0, "nearClip": 0.08, "farClip": 200 },
  "movement": { "stepSize": 4.5, "moveDurationMs": 270 },
  "corridor": { "width": 4.1, "height": 4.0, "wallThickness": 0.18, "doorHeight": 3.3 },
  "fog":      { "type": "exp2", "color": "#080808", "density": 0.036 },
  "textures": { "floor": null, "wall": null, "ceiling": null, "doorframe": null },
  "biomes": {
    "marble":   { "floorColor": "#706860", "wallColor": "#454340", "ceilColor": "#101018" },
    "stone":    { "floorColor": "#5a5650", "wallColor": "#3a3835", "ceilColor": "#0e0e12" },
    "dirt":     { "floorColor": "#6b5a48", "wallColor": "#4a3c30", "ceilColor": "#181410" },
    "domestic": { "floorColor": "#787060", "wallColor": "#504e48", "ceilColor": "#181816" }
  },
  "tools":     { "starting_inventory": ["twine", "chalk"], "spawn_rate": 0.08 },
  "narrative": { "characters_per_run": 3, "fragments_per_character": 4 },
  "threat":    { "enabled": true, "dormancy_moves": 40 },
  "debug":     { "show_full_map": false, "show_tile_coords": false,
                 "infinite_tools": false, "force_seed": null }
}
```

seed: null = random each run; set a number to lock the maze for repro and comparison. The debug block is the iteration toolkit. A collapsible dev panel (backtick) shows position, tile type, biome, move count.

## Asset Pipeline (no 3D art skills required)

- **Geometry:** 100% procedural — boxes, cylinders, arches from code.
- **Textures:** Poly Haven (free PBR sets: color/normal/roughness). Four slots: floor, wall, ceiling, doorframe. Also AI-generated seamless tiles (Imagen 4 / Firefly) or the planned Python texture tool.
- **Lighting:** Cool dim ambient + directional fill so surfaces read, plus warm point-light torches. Lighting is the biggest visual lever.
- **Symbols:** canvas-drawn textures on wall planes.
- **Props:** primitives, Kenney.nl low-poly packs, Sketchfab free models.
- **The Obra Dinn look:** post-process ordered-Bayer dither ShaderPass over the correct 3D render. ~40 lines of GLSL. Apply only after geometry and lighting feel right. Palette: whites/greys/blacks, optionally one warm tone.

## Python Tile-Art Tool (future, standalone)

Pillow + numpy (or cairo) script / small Flask UI that outputs tileable texture PNGs per biome and mood. Naming: {biome}_{surface}_{variant}.png, e.g. marble_wall_02.png. Multiple variants per surface so the renderer can vary them.

## Mobile Notes

Test target: DuckDuckGo on iOS (WebKit). Vibration API is a no-op there. Canvas must size to container on rotate/resize. Touch: single-finger drag = look; taps by zone for movement.

## Cross-Run Persistence (needed for the core idea)

Chrysalis remnants, basin contents, and chalk marks must survive between runs and be placed into new mazes. Phase 1 can be localStorage keyed per device. Long-term: Vercel KV or a small Postgres so the same soul persists across devices.
