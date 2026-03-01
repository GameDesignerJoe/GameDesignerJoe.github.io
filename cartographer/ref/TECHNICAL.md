# Cartographer — Technical Design Document

## Architecture Overview

Cartographer is a single-file HTML5 Canvas game with two independent loops:
- **Update loop** (`update()` via `requestAnimationFrame`): Game logic, movement, input processing
- **Render loop** (`render()` via `requestAnimationFrame`): All drawing

There is no ECS, no scene graph, no framework. State lives in module-level variables. Rendering is immediate-mode (full redraw every frame).

## System Breakdown

### 1. Terrain Generation

**Source of truth**: `getElevation(tx, ty) → float`

The elevation function combines:
- **Island mask**: Noise-warped radial falloff creating irregular coastlines
- **Shape deformation**: Random stretch angle + aspect ratio per seed
- **Lobe system**: 2-4 sinusoidal lobes for peninsulas/bays
- **Fjord cut**: One deep angular cut per island
- **Noise octaves**: 3 layers of smooth noise (scales 8, 4, 2)
- **Peak injection**: 2 randomly positioned peaks per seed

**Terrain classification**: `getTerrain(tx, ty)` maps elevation ranges to biome strings.

**Critical invariant**: `isLand()` and `isWalkable()` must always use `getTerrain()`, never raw elevation. This prevents mismatches where a tile renders as water but tests as walkable.

**Seed system**: `seedOffset` (random int) feeds into `seededRandom()` which is used by all terrain noise. Changing `seedOffset` creates a completely different island.

### 2. Rendering Pipeline

Each frame, `render()` executes:

```
1. Clear canvas with parchment color
2. Draw paper texture (subtle random dots)
3. Begin zoom transform (ctx.save → translate → scale → translate)
4. Calculate visible tile range (adjusted for zoom)
5. Draw coordinate grid (if sextant readings taken)
6. For each visible tile:
   a. Water tiles: parchment + wave lines + coastline-from-water-side
   b. Fog tiles: fog color + coastline-bleed-from-neighbors
   c. Revealed tiles: terrain color + coastline
   d. Surveyed tiles: terrain color + features + contour lines + coastline
7. Draw landmarks
8. Draw measurement trails
9. Draw sextant fix markers
10. Draw specimens
11. Draw player
12. Draw tool animations
13. End zoom transform (ctx.restore)
14. Draw HUD elements (not affected by zoom)
```

**Known issue — Rendering performance**: Every tile redraws every frame. For a 29×29 grid, that's 841 tiles per frame. This is fine at 60fps on desktop but may struggle on low-end mobile. Future optimization: dirty-rect rendering or offscreen canvas caching for static tiles.

**Known issue — Line jitter**: `wobblyLine()` uses `Math.random()`, causing frame-to-frame jitter on all decorative lines (trees, grass, rocks). This is visually noisy. The fix: replace `Math.random()` calls in drawing functions with `seededRandom()` based on tile/feature position, same as `coastLine()` already does.

### 3. Coastline System

Coastline rendering is the most complex visual system because it must handle three cases:

1. **Land tile → water neighbor**: Draw ink line on the shared edge
2. **Water tile → visible land neighbor**: Draw ink line on the shared edge (ensures coast draws even if the land tile is offscreen or unprocessed)
3. **Fog tile → water + has visible neighbor**: Draw faint coastline to prevent gaps at exploration boundary

Uses `coastLine()` function with deterministic wobble (seeded by position) and round line caps for clean joins between tile edges.

**Known bug**: Coastline still has gaps on some irregular island shapes, particularly on long straight runs. Root causes:
- The tile-by-tile edge approach can miss corners where coastline turns
- Diagonal adjacency is not checked (only cardinal neighbors)
- Potential fix: post-process coastline as a continuous path rather than per-tile edges

### 4. Camera & Zoom

**Camera follow**: Lerp-based (`camera += (target - camera) * 0.08`)

**Zoom**: Canvas transform approach — `ctx.translate(W/2) → ctx.scale(zoom) → ctx.translate(-W/2)`. This means ALL world drawing is automatically zoomed without changing any drawing code.

**Input conversion**: `screenToWorld()` reverses the zoom transform for mouse/touch input.

**Known issue**: Font sizes and line widths scale with zoom. At high zoom, text may look oversized. Fix: inverse-scale critical text/line elements or use fixed-size overlays.

**Planned change**: Dynamic zoom range based on map completion percentage. See DESIGN.md for the progression curve.

### 5. Movement System

**Click-to-move**: Sets `moveTarget`, player walks toward it each frame at `MOVE_SPEED`.

**Keyboard**: WASD/arrows call `tryMove(dx, dy)` directly.

**Boundary check**: `tryMove()` checks walkability at a margin ahead of the player (0.15 tiles) to prevent creeping past tile boundaries into water.

**Known bug**: Player can still sometimes reach water-adjacent positions where the coastline should block them. The margin check helps but isn't perfect for all approach angles. A more robust fix would use continuous collision detection against tile boundaries.

### 6. Tool Systems

#### Theodolite (Survey)
- Surveys tiles in radius around player
- Sets tiles in `surveyedTiles` Set
- Currently instant — needs cooldown/animation to prevent spam

#### Measure
- Toggle-based path recording
- Stores trail as array of `{x, y}` positions
- Calculates running distance
- Completed measurements persist on map as red dashed lines
- **Missing**: Erase/undo functionality. Design intent: walking backward over trail points should remove them

#### Sextant
- Records position as a "fix"
- Checks distance from nearest previous fix
- Required distance scales: `MIN_DISTANCE_BASE + (revealed_count × DISTANCE_SCALE)`
- Reveals 2 coordinate digits per successful fix (alternating lat/lng)
- **Known issue**: Distance scaling doesn't account for island size variation. Fix: base the scale on actual island diameter, not a fixed constant.

#### Naturalist Kit
- Proximity check (distance < 2 tiles) to nearest uncollected specimen
- Triggers collection animation + toast notification
- Updates specimen panel UI

### 7. Quest System

Current: 4 fixed categories tracked via `updateQuestTracker()`.

Planned: Randomized measurement quests from a pool. Each quest needs:
- A description string
- A validation function (how to check if the measurement matches)
- An acceptable margin of error
- A celebration trigger

### 8. Fog of War

Two-tier system:
- **Revealed** (`revealedTiles`): Terrain color visible, coastline drawn, but no interior detail
- **Surveyed** (`surveyedTiles`): Full detail — trees, rocks, grass, contour lines, heavy ink coastline

Reveal radius: currently a fixed square around the player. Future: could be circular, affected by elevation (see further from hilltops), reduced at night.

### 9. UI/HUD

All HUD elements are HTML overlays positioned with CSS (`position: fixed`), not canvas-drawn. This means they:
- Don't scale with zoom (good)
- Can use standard HTML/CSS styling (good)
- May overlap on small screens (needs responsive design)

### 10. Audio System (Planned)

```
AudioManager
├── MusicPlayer        — Background music with crossfade
├── AmbiencePlayer     — Biome-based ambient loops with crossfade
├── SFXPlayer          — One-shot sound effects
│   ├── Footsteps      — Terrain-dependent, synced to movement
│   ├── ToolSounds     — Survey, measure, sextant, collect
│   └── UIFeedback     — Button clicks, quest completion
└── JournalPlayer      — Voice-over playback for found journals
```

All audio files loaded from `/audio/` directory. No procedural audio — all assets provided by developer.

Footstep system: detect current terrain type, play appropriate sound at movement intervals (not every frame — use a distance accumulator).

Ambience crossfade: when player moves between biomes, crossfade between ambient loops over ~2 seconds.

### 11. AI Journal Generation (Planned)

Use Anthropic API to generate journal entries per playthrough:
- On island generation, call API with: character archetype, island description (terrain types, landmarks present), number of entries needed
- Cache generated entries in session (no persistence needed — new journals each playthrough)
- Each entry: 2-4 sentences, first-person, period-appropriate language
- Display in a styled overlay when player interacts with found journal page

**API key handling**: Player provides their own API key (stored in localStorage) or uses a proxy endpoint.

## Known Bugs (with root causes)

| Bug | Root Cause | Severity |
|-----|-----------|----------|
| Player walks on water | `tryMove()` margin check insufficient for diagonal approach | High |
| Coastline gaps on straight edges | Per-tile edge drawing misses some configurations | High |
| All drawing lines jitter | `wobblyLine()` uses `Math.random()` instead of seeded random | Medium |
| Sextant impossible to complete on small islands | Distance scaling is absolute, not relative to island size | Medium |
| Mobile layout broken | No responsive CSS, fixed pixel positions | Medium |
| Fonts scale with zoom | Canvas transform scales everything including text | Low |
| No save/load | No serialization implemented | Low (for now) |

## Performance Considerations

- **Tile rendering**: 841 tiles × 60fps = ~50,000 tile draws/sec. Each tile draws 3-8 features. Optimize with offscreen canvas for static surveyed tiles.
- **Coastline**: `coastLine()` function is called per-edge per-frame. Consider caching coastline paths.
- **Noise functions**: `getElevation()` is called frequently (movement, rendering, terrain checks). It's relatively expensive (trig + multiple noise octaves). Consider caching elevation values in a grid array.
- **Mobile**: Reduce render resolution on low-DPI screens. Consider halving the update rate.

## Data Structures

```javascript
// Core terrain
seedOffset: number          // Drives all procedural generation
GRID: number               // 29 (ISLAND_R * 2 + 1)
TILE: number               // 40 (pixels per tile at 1x zoom)

// Visibility
revealedTiles: Set<string>  // "tx,ty" keys
surveyedTiles: Set<string>  // "tx,ty" keys

// Game objects
player: { x: float, y: float }
camera: { x: float, y: float }
zoom: float

landmarks: [{ name, type, tx, ty, icon, desc }]
specimens: [{ name, emoji, terrain, tx, ty, collected }]
sextantReadings: [{ x, y, time }]

// Measurement
measuring: boolean
measureTrail: [{ x, y }]
measureDistance: float
completedMeasures: [{ trail, distance }]

// Coordinates
coordDigitsLat: [{ char, revealed, fresh }]
coordDigitsLng: [{ char, revealed, fresh }]
revealedDigitCount: number

// Discovery
discoveredLandmarks: Set<string>
collectedSpecimens: []
```
