# CLAUDE.md — Labyrinth Build Handoff

*Drop this into the repo root as CLAUDE.md for Claude Code / Cline. Read docs 01–05 in the Drive folder for full context.*

## Project

Labyrinth (working title): first-person, node-based, hex-grid 3D maze exploration game with hand-drawn mapping, finite tools, and a remnant-based narrative where every past traveler is a prior life of the player. Web-first, playable on PC and mobile via URL.

## Stack

- React 18 + Vite + TypeScript
- Three.js (r160+; React Three Fiber acceptable if it stays simple)
- Zustand for game state (one slice per system)
- Tailwind for UI chrome only; game view is a full-bleed canvas
- Vercel deploy; GitHub GameDesignerJoe
- localStorage persistence in Phase 1

## Non-Negotiables

1. **Node-based movement.** Camera glides hex-to-hex (~270ms ease-in-out). Free look within a hex only. Never free walking.
2. **Dumb explicit geometry.** Passages = floor + ceiling + two walls. Closed faces = one panel. Openings = jamb-split panels. Rotate boxes by atan2(dx,dz) for hex angles. Do not write a "clever" generalized corridor mesher.
3. **No tone mapping.** renderer.toneMapping = THREE.NoToneMapping.
4. **Distinct surface values.** Floor lightest, walls mid, ceiling darkest.
5. **Everything reads from labyrinth.config.json.** Joe edits the JSON, refreshes, gets a different maze. Never hardcode a tunable.
6. **Data-driven content.** Characters, fragments, symbols, biomes, room types live in JSON under /content. Engine code never contains narrative text.
7. **Mobile is a first-class target.** Test in iOS WebKit. Tap zones, not joysticks. Canvas resizes with container.
8. **Ask before building** when a spec is ambiguous. Make reasonable calls on minor details and say what you assumed.
9. **Own bugs openly.** Say what broke and why; don't silently patch.

## Locked Values

```
camera:   fov 68 · eyeHeight 2.0 · nearClip 0.08 · farClip 200
movement: stepSize 4.5 · moveDurationMs 270
corridor: width 4.1 · height 4.0 · wallThickness 0.18 · doorHeight 3.3
fog:      FogExp2 · #080808 · density 0.036
```

## Suggested Layout

```
/src
  /engine
    mazeGen.ts        hex graph from seed+config
    navEngine.ts      legal moves, entrance closing
    renderer/         scene build from graph, materials, lights, post
    puzzleEngine.ts
    narrativeEngine.ts
    audioEngine.ts
    entitySystem.ts   (stub; back-burnered)
  /state              zustand slices (player, inventory, map, journal, puzzles, session)
  /ui                 HUD, Map, Inventory, Journal, Examine, DevPanel
  /content
    characters/*.json
    symbols.json
    biomes.json
    roomTypes.json
/public
  /textures/{biome}_{surface}_{nn}.png
  /audio/ambient, /audio/sfx, /audio/vo/{character}_fragment_{nn}.mp3
labyrinth.config.json
```

## Milestone 1 (do this first)

Port the working hub-loop prototype into the Vite/TS project, reading all values from the config file. Add the dev panel (backtick). Confirm it runs on Vercel and on an iPhone in WebKit with tap controls. Stop and show Joe before Milestone 2.

## Milestone 2

Hex maze generator + geometry builder from graph. Seeded. Debug top-down map view. Biome color assignment with clustering.

## Milestone 3

Textures (four slots), entrance-closing tile, first slope connector.

## Definition of "Playable" per milestone

Joe can open a URL on phone and laptop, move through the space, and evaluate feel. Every milestone ends in a deployed URL.

## Testing notes

- iOS WebKit: Vibration API is a no-op; don't rely on haptics.
- Prefer FogExp2; linear fog starting near the camera flattened depth in prototypes.
- Keep a seed in the URL query for repro: ?seed=1234.
