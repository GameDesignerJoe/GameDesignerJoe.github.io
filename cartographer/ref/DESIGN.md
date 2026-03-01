# Cartographer — Game Design Document

## Vision Statement

Cartographer is a meditative exploration game where you play as a Victorian-era naturalist arriving on an uncharted island. Your job is to map it. The game IS the map — as you explore, the parchment fills in with hand-drawn terrain, coastlines, landmarks, and specimens. Every island is procedurally generated, every expedition unique.

The tone is calm, curious, and unhurried. There's no combat, no timer, no death. The satisfaction comes from watching blank parchment transform into a detailed, beautiful map that you drew by exploring.

## Aesthetic Pillars

- **Darwin's Field Journal**: The visual language of 19th-century naturalist sketches. Ink on parchment. Wobbly hand-drawn lines. Serif typography. Specimen illustrations.
- **The Joy of Discovery**: Every fog-of-war reveal should feel like turning a corner and seeing something new. Landmarks, specimens, and journal pages reward curiosity.
- **Intimacy Then Scale**: The camera starts close — you feel lost, surrounded by fog. As you map the island, the camera pulls back, and you see your work. The final zoom-out is the reward.
- **Analog Warmth**: Everything should feel hand-made. No pixel-perfect grids, no clean vector lines. Wobble, texture, imperfection.

## Core Gameplay Loop

```
Arrive on island → Explore (walk + reveal fog) → Survey (theodolite for detail) →
Measure (paths + distances) → Fix Position (sextant) → Collect (specimens + journals) →
Discover (landmarks) → Complete Map → New Expedition
```

## Tools

The player has 5 tools, selected via toolbar or number keys 1-5:

### 1. Walk (Boot icon)
- Click/tap to set destination, player walks there automatically
- Keyboard WASD/arrows for direct control
- Clears fog-of-war in a radius around the player
- Reveals terrain type (color) but not details

### 2. Theodolite (Survey)
- Surveys tiles in a radius around the player
- Surveyed tiles show full detail: trees, rocks, grass, contour lines
- Should have a cooldown/animation to prevent spam
- Larger radius than walk reveal

### 3. Measure (Ruler)
- Toggle on/off — while active, walking leaves a red dashed trail
- Running distance counter shows in HUD
- Click again to "cut" and save the measurement on the map
- Quest system selects specific measurement tasks per island
- Need ability to erase/undo current trail (walk backward to retrace)

### 4. Sextant (Position Fix)
- Places a "reading" at current position
- Must travel away from previous readings to reveal coordinate digits
- 10 total digits to reveal (5 latitude, 5 longitude)
- Displays as a HUD element with mystery digits that reveal progressively
- Encourages full-island exploration to complete

### 5. Naturalist Kit (Specimen Collection)
- When near a specimen, click to collect it
- Specimens appear as emoji on the map with parchment backing
- Collected specimens fill slots in the specimen panel
- Green highlight ring when in range

## Quest System

Each island generates a randomized set of objectives:

### Always Present
- **Map Charted** — Reveal X% of the island (checkbox, replaces current percentage)
- **Position Fixed** — Complete all 10 sextant digits (0/10 progress)
- **Samples Collected** — Collect all specimens on this island (X/Y progress)
- **Landmarks Discovered** — Survey all landmarks (X/Y progress)

### Measurement Quests (Randomized — pick 1-2 per island)
- "Measure the island's circumference" — walk the full coastline with measure tool
- "Measure the distance from [Landmark A] to [Landmark B]"
- "Measure the height of Summit Peak" (walk from sea level to peak)
- "Map the shoreline of Mirror Lake"

Completing a measurement quest within an acceptable margin triggers a celebratory "pop" animation and sound.

## Island Generation

### Shape
- Islands are NOT circles — they use noise-warped coastlines with:
  - Random elongation/rotation (stretch one axis)
  - 2-4 major lobes (peninsulas and bays)
  - A deep fjord cut on one side
  - Fine-detail coastline wobble
- Every island is a unique silhouette
- Roughly consistent land area despite shape variation

### Terrain Biomes (by elevation)
- **Water** (< -0.02): Blue wave lines on parchment
- **Beach** (< 0.08): Sandy color, no features
- **Lowland** (< 0.25): Light green, grass tufts
- **Forest** (< 0.45): Green, hand-drawn trees
- **Highland** (< 0.65): Tan/brown, rocks, contour lines
- **Peak** (≥ 0.65): Light stone color, prominent rocks

### Landmarks (6 per island, biome-restricted, randomly placed)
- Summit Peak (highest point — always at actual peak)
- Mirror Lake (lowland)
- Whispering Cave (highland)
- The Elder Oak (forest)
- Neptune's Arch (coastal beach)
- Crystal Spring (highland)

### Specimens (randomized pool)
Current: Blue Orchid, Giant Beetle, Sea Shell, Fern Fossil, Butterfly, Wild Mushroom
Future: Expand to a larger pool (15-20 types), randomly select 6 per island so it's different each time. Each specimen has a biome it spawns in.

## Camera & Zoom

### Zoom Progression (Key Feature)
- Game starts at a close zoom level — player feels intimate with the terrain, slightly disoriented
- As map completion percentage increases, maximum zoom-out distance increases
- At 0% complete: Zoom range 1.5x–2.0x (very close)
- At 50% complete: Zoom range 1.0x–2.5x
- At 100% complete: Zoom range 0.5x–3.0x (full island visible)
- Zoom transitions should be smooth, not jarring
- Consider: automatic zoom-out as percentage increases (no manual zoom at all) vs. unlocking zoom range

### Camera Follow
- Camera smoothly follows player with lerp (currently 0.08)
- Camera never shows beyond the fog boundary (or at least doesn't show meaningful terrain)

## Arrival Sequence

When a new island loads:
1. Fade up from black
2. Show a small sailing ship on the water approaching the island
3. Ship arrives at a beach tile
4. Player character steps off the ship onto the beach
5. Ship remains visible on the beach as a landmark
6. Player gains control

## Completion Celebration

When all four quest categories are complete:
- Screen-wide celebratory animation (golden particles? Ink flourishes?)
- A completion summary card showing:
  - Island name
  - Time taken
  - Distance walked
  - Map quality rating
- "New Expedition" button appears
- The completed map could be "saved" as a screenshot/image

## Future Features

### Day/Night Cycle
- Time passes as you explore (not real-time — based on actions/movement)
- Gradual darkening with an overlay
- At night: visibility radius shrinks, movement speed decreases
- New tool: **Camp** — sets up a campsite, advances time to morning
- Campfire appears on map as a small icon
- Night ambience sounds replace day sounds

### Found Journals
- New collectible type: scattered journal pages (5-6 per island)
- Each set tells a short story of a previous visitor
- Character archetypes: shipwreck survivor, escaped prisoner, marooned merchant, retired explorer, fleeing lover, naturalist predecessor
- Content is AI-generated per playthrough via Anthropic API
- Each entry is ~1 short paragraph
- Collecting all pages for a character unlocks the complete story
- Audio voice-over plays when clicking a collected journal page
- Visual: aged paper icon with handwriting snippet

### Audio System
- **Footsteps**: Terrain-dependent (sand crunch, leaf rustle, rock click, grass swish)
- **Ambience**: Biome-dependent loops (waves for coast, birds for forest, wind for highlands, silence for peaks)
- **Music**: Background tracks that fade in/out at key moments (arrival, first landmark, completion)
- **UI sounds**: Tool selection clicks, survey animation, specimen collection chime, sextant reading tone
- **Journal audio**: Voice-over audio files play on journal page interaction
- All audio files provided by the developer, loaded from `/audio/` directory

## UI Layout

### Top-Left: Quest/Info Panel (Collapsible)
- **Collapsed state**: Small badge showing overall progress (e.g., "42%" or a radial progress indicator)
- **Expanded state**: Full quest tracker with checkboxes
  - Island name
  - Map Charted: ☐ (percentage)
  - Position Fixed: ☐ (0/10)
  - Samples Collected: ☐ (0/6)
  - Landmarks Discovered: ☐ (0/6)
  - Measure Quest 1: ☐ (description)
  - Measure Quest 2: ☐ (description)
- Brown translucent panel treatment (consistent with Position Fix panel)
- Click/tap to toggle collapsed/expanded

### Bottom-Center: Toolbar
- 5 tool buttons with icons and keyboard shortcuts
- Active tool highlighted
- Measure button pulses when measuring is active

### Bottom-Right: Position Fix Display
- Coordinate digits display (consolidate into the top-left panel in future)

### Top-Right: Compass Rose
- Decorative compass showing N/S/E/W

### Bottom-Left: Specimen Slots
- Emoji grid showing collected/uncollected specimens
- Remove parchment background — use subtle border or no background

### Center: Measure HUD (when active)
- Distance counter
- "Measuring..." indicator
