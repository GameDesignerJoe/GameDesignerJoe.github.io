# LABYRINTH — Game Design Document

*Systems, mechanics, and player experience. Companion to 01 · Vision & Narrative.*

## Core Pillars

- **The Maze is Alive with Time.** Every environment, symbol, and remnant says others came before. The maze does not care about you specifically.
- **Navigation is Cognitive Work.** Tools are externalized memory. Running out of chalk means being more alone with your own judgment.
- **Tragedy is Optional.** Rush and you find a maze. Stop and read and you find a world.
- **Tools over Content.** The game is built as data-driven systems so Joe can author content (rooms, characters, symbols, config) without touching engine code.

## View & Movement — Decided

**First-person, node-based, real 3D (Three.js).** Discrete hex-to-hex movement with a smooth camera glide (~270ms). Free look-around within the current hex via mouse drag / touch drag. No free walking. Rationale: the manual map, orientation puzzles, and mobile controls all depend on discrete state; deliberateness *is* the atmosphere.

**No death state.** Failure is only wandering longer. There is no entrance — it closes behind you shortly after arrival.

## Hex Grid

Six exits per junction instead of four. Corridors curve at 60°, junctions branch at angles, rooms form as natural hex clusters (7-hex chamber). Players cannot build a clean mental map as easily. Navigation directions: Forward, Forward-Left, Forward-Right, Back-Left, Back-Right, Back. From first person you see up to three exits: one centered, two at ~30°.

## Vertical Dimension

Three levels is enough. Center is on the middle level; some paths require going down before going up. Connectors:

- **Slopes** — gradual, walkable, floor angles away, footsteps and echo shift.
- **Shafts** — ladder / rope / handholds; discrete level jump; brief climb transition.
- **Bridges** — elevated hex above a lower passage; you can see (and hear) what's below.

**Room types:** Chamber (multi-hex, pillars), Crypt (low, long, single width), Atrium (multi-level open), Pit Room (hexes ringing a void), Sanctum (enclosed, puzzle-locked), Slope Gallery (long descent shifting biome as you go).

Corridor width and height are per-room-type config values, not global constants.

## Biomes

| Biome | Feel | Ambient | Dither character (future) |
| --- | --- | --- | --- |
| White Marble | Classical, cool grandeur | Distant drip, hall reverb | Fine, regular, clean |
| Rough Stone | Medieval, heavy | Wind through cracks | Coarse, irregular |
| Dirt & Root | Organic, wrong | Soil settle, creak | Organic noise |
| Flooded | Shallow water, reflections | Lapping, hollow echo | Horizontal ripple |
| Overgrown | Vines, impossible daylight | Birdsong | — |
| Ash & Char | Burned long ago | Near silence | — |
| Carved Obsidian | Older, deliberate | Low resonant hum | Near-black, sparse specks |
| Domestic | Backrooms — wallpaper, carpet | Fluorescent hum, HVAC | Too regular, grid-like |

Biomes cluster; transitions are liminal (stone floor meeting grass in a doorway). Distribution is config-driven.

## Tools (consumables with charges)

| Tool | Use | Charges |
| --- | --- | --- |
| Ball of Twine | Leaves a thread marking your path back | ~40 tiles |
| Chalk | Mark walls at junctions (preset glyph legend) | ~20 |
| Charcoal | Draw segments and nodes on your map | ~15 |
| Pencil | Record observed symbols onto the map | ~10 |
| Pointed Rock | Scratch a simple mark on stone only | ~60 |
| Oil Lamp | Reveals hidden symbols / full detail | ~8 |
| Compass | Cardinal direction only | passive |
| Parchment | Extra map space | 1 |

Inheriting a dead explorer's chalk is meaningful — they may have already marked things wrong.

## Chalk Legend (preset, no free-draw)

↑ ↓ ← → ↖ ↗ · ✕ (dead end) · ? · ! · ◉ (you are here) · ∅ (nothing) · ★ (remnant) · dot. The legend deliberately shares vocabulary with the maze's own carved symbols so player marks start to rhyme with the walls.

## Symbol System

Carved at junctions, not corridors. Environmental — you must notice them. A partial language decoded through play: some universal (spiral = water nearby, cross = dead end), some personal to a past traveler (find their key later), some warnings understood too late, some just prayers. Fixed set per run, never all present.

## Zoom / Examine

Tap anything in the scene — a carving, a corner, an object. Camera pushes in and holds with corner brackets. Tap the object within the zoom to interact. Tap elsewhere to pull back. Using chalk in zoom mode opens the glyph picker. Looking closely is itself the reward.

## The Map (manual cartography)

- Aged parchment overlay, hex grid.
- Draw corridor segment between adjacent nodes: 1 charcoal. Node marker: 1 charcoal. Annotation glyph: 1 charcoal.
- Record an observed symbol at a node: 1 pencil.
- No auto-reveal. No auto-position. A free "mark where I think I am" dot — often wrong.
- Out of charcoal = exploring on memory alone. Finding charcoal in a remnant cache is exciting.

## Puzzles

Archaeology, not game design. Four base types feeding into **Thresholds**:

- **Receptacle** — a shaped hollow; place the object that fits (found far away, possibly referenced in a remnant). Object is consumed.
- **Orientation** — rotate a dial/stone/mirror, or stand in a specific hex facing a specific way.
- **Sequence** — activate symbols in an order hinted by remnants or observed on entry.
- **Compound** — chains of the above; these are the Thresholds.

**Thresholds:** Surface (exits first biome cluster; teaches the language), Deep (enters lowest level), Inner (final gate before center; requires remnant knowledge). Feedback on solve: stone-on-stone sound and a visible nearby passage reveal. Nothing more.

**Burden mechanic** (see 01 · Vision): Threshold locks are ultimately burdens, not keys. The basin at each threshold remembers what you left there in prior runs.

Puzzle data: trigger_type · required · effect · hint_remnant · state. Structural roles are fixed per run; puzzle types shuffle.

## Entities (back-burnered)

Harmless "skittles" that flee into wall cracks; a rare Watcher that doesn't flee. Parked until core systems exist.

## UI

- **HUD** — hotbar (top inventory row), compass, position, tool charges with low-charge warning.
- **Map (M / Tab)** — parchment overlay with manual draw tools.
- **Inventory (I)** — grid; tap to inspect/read/rotate; drag to reorder; top row is the hotbar. Two categories: Tools (consumables) and Objects (found things, burdens).
- **Journal (J)** — one page per character; fragments appear in order as found; audio replay per fragment; blank pages for characters not yet met. Obra Dinn logbook reference.

## Controls

**PC:** W/↑ forward · S/↓ back · A/← turn left · D/→ turn right · Q/E strafe to angled exits · Space/F interact · M map · I inventory · J journal · ` dev panel · mouse drag to look.

**Mobile:** No joystick. Tap upper-center = forward; tap lower-left/right = turn; swipe down = back; swipe left/right = strafe; tap object in scene = examine; drag = look; bottom bar = Map · Interact · Inv. Long-press = radial context menu.

## Audio

- **Ambient** — one 60–90s loop per biome, 2–3s crossfade on transition.
- **SFX** — footsteps per surface (4–6 variants each), chalk scrape, charcoal on paper, twine unspool, lamp strike, rock scratch, remnant "breath" (no chime), symbol tone (biome-tinted), stone-on-stone door. Entrance closing: barely audible.
- **Narrative VO** — ElevenLabs, one voice per character; same voice with different settings across their arc. Ducks ambient to ~20%. Files: soldier_fragment_02.mp3.
- **Threat channel** — subsonic texture that grows during Caretaker Signs phase.

## Session Length

15×15 tiles was too small: at one tile/second the whole grid is ~4 minutes. Size is a config value to iterate rapidly. Real length comes from levels, thresholds, and reading — not tile count.
