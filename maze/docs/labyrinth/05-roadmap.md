# LABYRINTH — Roadmap, Milestones & Future Ideas

*Milestones are scoped to ~30-minute testable chunks where possible. Each step is playable.*

## Phase 0 — Feel (mostly done)

1. ✅ Single hallway with camera sliders → values locked.
2. ✅ Hub-and-loop hand-built layout, node movement, look-around.
3. ☐ Drop in first Poly Haven stone texture set (floor/wall/ceiling/doorframe slots).
4. ☐ Move config out of the file into labyrinth.config.json; game reads it on load.
5. ☐ Fix mobile: canvas sizing, tap-zone controls, touch look.

## Phase 1 — Real Maze

1. ☐ Hex graph generator (recursive backtracker on hex grid) driven by width/height/seed.
2. ☐ Geometry builder from graph using the dumb-box rule; angled corridors via rotation.
3. ☐ Biome assignment with clustering; per-biome materials/colors.
4. ☐ Dev panel (backtick): position, biome, moves, seed, show-full-map toggle.
5. ☐ Entrance tile that closes after N moves / 45s.
6. ☐ Vertical connectors: slope first, shaft second, bridge third.

## Phase 2 — Player Systems

1. ☐ Tools with charges; hotbar HUD; low-charge warning.
2. ☐ Zoom/Examine mode with corner brackets; tap-to-interact.
3. ☐ Chalk glyph picker; marks persist on walls in 3D.
4. ☐ Manual hex map overlay with charcoal/pencil costs.
5. ☐ Inventory grid (top row = hotbar); inspect/read/rotate objects.

## Phase 3 — Narrative

1. ☐ Remnant placement from character JSON; soft fragment ordering.
2. ☐ Journal UI (one page per character, blank pages for unmet).
3. ☐ ElevenLabs VO pipeline: {character}_fragment_{nn}.mp3; ducking.
4. ☐ Write two characters end to end (4–6 fragments each) as the test set — suggest The Child and The Cartographer.

## Phase 4 — Puzzles & Thresholds

1. ☐ Puzzle Engine with the four types; stone-on-stone reveal.
2. ☐ Burden inventory objects; basin/altar threshold interaction; consumption.
3. ☐ Surface / Deep / Inner thresholds gating levels.

## Phase 5 — Cross-Run Persistence (the core idea)

1. ☐ Save chalk marks, solved puzzles, basin contents, and a "chrysalis" record per run.
2. ☐ Place prior-run artifacts into the next generated maze.
3. ☐ Veil-thinning: subtle recognition cues that increase per run.

## Phase 6 — Audio & Look

1. ☐ Ambient loops per biome with crossfade; footstep sets per surface.
2. ☐ Tool SFX; remnant "breath"; entrance-closing settle.
3. ☐ Caretaker threat channel.
4. ☐ Bayer dither post-process pass; palette tuning (whites/greys/blacks + optional warm tone).

## Phase 7 — Caretaker & Entities

1. ☐ Caretaker state machine: Dormant → Signs → Tracking → Manifest → Displacement.
2. ☐ Center encounter.
3. ☐ Skittles and the Watcher (only if time allows).

## Standalone Tools (build when needed)

- **Python texture generator** — Pillow/numpy, tileable PNGs per biome/surface, optional Flask UI.
- **Character/remnant editor** — JSON authoring for fragments, voices, hints. Could be a small web tool so Joe authors without touching code.
- **Maze viewer** — top-down debug render of any seed to evaluate generation quality without playing.

## Future / Parking Lot

- Trailer-first validation: a short AI-generated trailer of the maze to test whether the mood lands before deep build (Joe's standard practice).
- Variable corridor dimensions per room type (crypts low and narrow, marble halls tall and wide).
- Bridges with visible lower passages and movement below.
- Player-written text at the center (answering "the Caretaker's one sentence" question).
- Symbol key documents found in remnant caches that unlock reading a past self's private notation.
- Seed sharing between players — same maze, different burdens.
- Multi-session runs with save-and-resume inside a maze.
- Localization of remnant text and VO.

## Naming

"Labyrinth" is a placeholder. Joe's naming aesthetic is short, single-word, layered (Murmur, Wayward, Nudge). Candidates worth exploring given the veil/rebirth theme: *Veil, Chrysalis, Threshold, Errant, Between, Sojourn, Hollow, Caretaker*. Check domain and store availability before committing.
