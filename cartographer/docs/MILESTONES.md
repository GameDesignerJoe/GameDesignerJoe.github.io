# Cartographer — Milestone Plan

## Philosophy

Each milestone should produce a playable, testable build. No milestone should take more than a few focused sessions. We ship working software at every step.

---

## Milestone 0: Stabilize the Prototype
**Goal**: Fix all known bugs so the current game works reliably.

### Deliverables
- [ ] **Fix water walking**: Implement proper tile-boundary collision that prevents player from entering any water tile from any angle
- [ ] **Fix coastline rendering**: Rewrite coastline as a continuous path system rather than per-tile-edge detection. Walk the entire coast of 10+ generated islands to verify no gaps.
- [ ] **Fix line jitter**: Replace all `Math.random()` calls in drawing functions (`drawTree`, `drawRock`, `drawGrass`, `wobblyLine`) with `seededRandom()` so features are stable frame-to-frame
- [ ] **Fix sextant distance scaling**: Base required distance on actual island diameter (count land tiles), not a fixed constant. Verify completable on 10+ islands of varying shapes.
- [ ] **Fix specimen visibility**: Ensure specimen emoji always renders on top of terrain features (z-order verified at all zoom levels)

### Acceptance Criteria
- Player cannot walk on water from any direction
- Coastline draws as a continuous, unbroken line around the entire island
- Map is visually stable (no shimmering/jittering on static elements)
- All four quest objectives are completable on every generated island
- Test: Generate 20 random islands, complete all quests on at least 5

---

## Milestone 1: Mobile & Responsive
**Goal**: Game works correctly on phone screens.

### Deliverables
- [ ] Responsive canvas sizing (fill viewport)
- [ ] Toolbar repositioned/resized for touch (larger tap targets, bottom of screen)
- [ ] Quest panel repositioned for mobile (collapsible, doesn't block gameplay)
- [ ] Specimen panel repositioned for mobile
- [ ] Coordinate display repositioned for mobile
- [ ] Touch-to-move works reliably (no accidental tool activations)
- [ ] Pinch-to-zoom works smoothly
- [ ] Viewport meta tags correct for no-bounce, no-zoom on the page itself

### Acceptance Criteria
- Playable on iPhone SE through iPad
- Playable on common Android screen sizes
- No UI elements overlap at any screen size
- All tools accessible via touch

---

## Milestone 2: UI Polish
**Goal**: Clean up all UI elements into a cohesive, polished interface.

### Deliverables
- [ ] **Collapsible quest panel**: Top-left info panel with expand/collapse toggle
  - Collapsed: small progress indicator (radial or percentage badge)
  - Expanded: full quest list with checkboxes
  - Brown translucent panel treatment (consistent style)
- [ ] **Map Charted as checkbox**: Convert percentage display to a quest item with checkbox (e.g., "Map Charted ☐ 67%")
- [ ] **Consolidate Position Fix**: Move coordinate display into the quest panel instead of separate bottom-right panel
- [ ] **Remove specimen parchment backing**: Clean up specimen emoji display — use subtle border or floating style
- [ ] **Consistent panel styling**: All UI panels use the same brown translucent treatment
- [ ] **Zoom level indicator**: Subtle indicator showing current zoom level

### Acceptance Criteria
- All information accessible from one collapsible panel
- Panel collapse/expand is smooth and doesn't disrupt gameplay
- Visual consistency across all UI elements

---

## Milestone 3: Gameplay Depth
**Goal**: Make the core loop more engaging with pacing, quests, and variety.

### Deliverables
- [ ] **Tool cooldowns**: Add animation + cooldown to theodolite survey (prevent spam). ~2 second survey animation, can't survey again until complete.
- [ ] **Measurement quests**: Implement randomized measurement objectives per island
  - Pool of quest types: circumference, landmark-to-landmark distance, peak height, lake perimeter
  - Pick 1-2 per island
  - Validation with acceptable margin
  - Celebration animation + sound on completion
- [ ] **Expanded specimen pool**: Increase to 15-20 specimen types, randomly select 6 per island. New specimens: Coral Fragment 🪸, Amber Insect 🪲, Bird Feather 🪶, Starfish ⭐, Hermit Crab 🦀, Wild Berries 🫐, Ancient Coin 🪙, Volcanic Glass 🪨, etc.
- [ ] **Measure tool erase**: Walking backward over existing trail points removes them from the path
- [ ] **Dynamic zoom range**: Zoom-out capability tied to map completion percentage
  - Start: locked at 1.8x (close, intimate)
  - Unlock progressively as charting increases
  - At 100%: full zoom range 0.7x–3.0x
- [ ] **Celebration on completion**: Full-screen celebration when all quests done — ink flourish animation, completion card with stats

### Acceptance Criteria
- Can't spam survey button — must wait for cooldown
- Measurement quests appear in quest panel, completable, celebrate on success
- Different specimens appear on different islands
- Zoom feels intentionally paced — close at start, reveals scope over time
- Clear, satisfying moment when island is 100% complete

---

## Milestone 4: Arrival Sequence & Ship
**Goal**: Give the game a proper opening that sets the mood.

### Deliverables
- [ ] **Ship sprite**: Small sailing vessel drawn in the ink/parchment style
- [ ] **Arrival animation sequence**:
  1. Fade up from black/parchment
  2. Ship visible on water, approaching the island
  3. Ship reaches beach tile, anchors
  4. Player character steps off onto beach
  5. Brief "island name" title card with decorative flourish
  6. Player gains control
- [ ] **Ship persists on map**: Remains at landing beach as a visual landmark
- [ ] **Departure on completion**: After celebration, player walks back to ship → fade out → New Expedition

### Acceptance Criteria
- Opening sequence plays on every new island (including "New Expedition")
- Ship is visible on the map throughout gameplay
- Sequence is skippable (tap/click/key to skip)
- Sets the mood without being tediously long (~5-8 seconds)

---

## Milestone 5: Audio
**Goal**: Sound design that reinforces the atmosphere.

### Deliverables
- [ ] **Audio manager**: Central system for loading, playing, crossfading audio files
- [ ] **Footsteps**: Terrain-dependent footstep sounds synced to player movement
  - Sand (beach), leaf crunch (forest), grass swish (lowland), rock click (highland/peak)
  - Distance-based trigger (not every frame — every ~0.5 tiles of movement)
- [ ] **Ambience**: Biome-based ambient loops
  - Coastal: waves + seagulls
  - Forest: birds + insects
  - Highland: wind
  - Peak: quiet wind
  - Crossfade between biomes as player moves (~2 sec transition)
- [ ] **Background music**: Support for loading and playing music tracks
  - Fade in on arrival, loop during exploration
  - Different intensity or track for key moments (optional)
- [ ] **UI sounds**: Tool select click, survey complete, specimen collected, quest complete fanfare
- [ ] **Settings**: Volume sliders (master, music, SFX, ambience) — persist in localStorage
- [ ] **Mute toggle**: Quick mute button in toolbar area

### Acceptance Criteria
- Walking through different biomes plays appropriate sounds
- No audio glitches (popping, overlapping footsteps, sudden volume changes)
- Audio works on both desktop and mobile (note: mobile requires user interaction before audio plays)
- Can play the game silently with no errors

---

## Milestone 6: Found Journals
**Goal**: Add narrative depth through discoverable stories.

### Deliverables
- [ ] **Journal page collectible**: New item type scattered across island (5-6 per island)
  - Visual: aged paper/scroll icon on map
  - Collectible like specimens (proximity + naturalist tool or dedicated interaction)
- [ ] **AI-generated content**: On island generation, call Anthropic API to generate journal entries
  - Character archetypes: shipwreck survivor, escaped prisoner, marooned merchant, retired explorer, naturalist predecessor, fleeing lover
  - Randomly select one archetype per island
  - Generate 5-6 short entries (2-4 sentences each)
  - Period-appropriate language, first-person
  - Entries reference island features (landmarks, terrain) when possible
- [ ] **Journal reader UI**: Overlay/modal when viewing collected journal pages
  - Aged paper aesthetic
  - Handwriting-style font (Caveat)
  - Page navigation for multiple entries
  - Shows which pages are collected vs. missing
- [ ] **Audio playback**: Play voice-over audio file when viewing a journal page (if audio file exists)
- [ ] **Quest integration**: "Journals Found (X/Y)" added to quest tracker

### Acceptance Criteria
- Journal entries are unique per playthrough
- Entries form a coherent narrative when read in order
- Journal reader is easy to open/close, doesn't disrupt gameplay
- Works without API key (graceful fallback — journal pages exist but contain placeholder text)
- Audio plays on interaction, stops on close

---

## Milestone 7: Day/Night Cycle
**Goal**: Add atmospheric time progression.

### Deliverables
- [ ] **Time system**: Time advances based on player actions/movement, not real-time
  - One full day/night cycle = approximately one full island exploration
  - Time visible as sun/moon position or clock in UI
- [ ] **Visual darkening**: Gradual overlay that darkens the screen
  - Dawn → full daylight → dusk → night → dawn
  - Stars appear at night (small dots on fog/water areas)
  - Warm golden tint at dawn/dusk
- [ ] **Gameplay effects at night**:
  - Fog reveal radius reduced (~50%)
  - Player movement speed reduced (~70%)
  - Survey radius reduced
- [ ] **Camp tool**: New tool (6th button, or replaces a tool at night)
  - Creates a campsite at player position
  - Small campfire icon drawn on map
  - Advances time to morning
  - Brief animation of fire/stars
- [ ] **Audio integration**: Night ambient sounds differ from day (crickets, owls vs birds)

### Acceptance Criteria
- Day/night transitions feel natural, not jarring
- Night creates a distinct mood without being frustrating
- Camp mechanic is intuitive
- Campsites persist on map as landmarks

---

## Future Considerations (Not Milestoned)

These are ideas to revisit after the core milestones:

- **Save/Load**: Serialize game state to localStorage for resuming expeditions
- **Map Export**: Screenshot/save the completed map as an image
- **Statistics**: Track cumulative stats across expeditions (islands mapped, distance walked, specimens collected)
- **Island Difficulty**: Larger islands, multiple islands in an archipelago, islands with hazards
- **Weather**: Rain, fog, storms that affect visibility and movement
- **Equipment Upgrades**: Better tools that survey faster, reveal more, etc.
- **Leaderboard**: Compare completion times on same seed (shareable seed codes)
