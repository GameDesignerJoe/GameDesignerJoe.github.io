# The Maze — Handoff: Decisions, Rejections, and Where This Is Going

*September 2026. Written for whoever picks up maze-topdown.html (v0.31.2) next — a Claude Code session, most likely. The file is self-documenting for **what** exists. This doc is for **why**, for what we deliberately did not do, and for where the game is meant to go. Companion docs: "The Maze — Progression, Burdens & Arc", "Labyrinth 01 · Vision & Narrative", and Joe's running notes doc.*

## 0. What this is

A single self-contained HTML file: a top-down maze game for mobile web, deployed from an iPhone via GitHub web editor → Vercel. It began as a cheap way to prove out gameplay for **Labyrinth**, a first-person 3D maze game whose four prior builds died on geometry. It has since become its own thing. The 3D version remains a long-term possibility; nothing here assumes it.

The story: a man wakes in a maze he put himself in. Every traveller whose pages he finds is himself at another stage of life. Each is a wound that drove him from the people who loved him. The maze is where he goes when he isn't ready to go back. The game is the process of becoming ready.

## 1. Working principles (Joe's, learned over three days)

- **Build the tool, not the content.** Every kind of text — pages, wake lines, narrator lines, shelf/basin lines, pool exchanges, helper cards, music presets — lives in a data block at the top of the file so Joe can rewrite it without touching engine code. Keep it that way. Joe has said all of my text is first-pass and he will edit later.
- **Single HTML file** is the delivery format. No build step. .jsx can't be opened on a phone.
- **Everything tunable is a CONFIG knob**, commented. When adding a feature, add its knobs. Joe tunes by feel on the phone.
- **Ask before building when the design is ambiguous**; otherwise build and list the calls you made. Joe prefers 2–3 tappable options over open questions.
- **Honest bug acknowledgment.** Say what broke and why. Joe does not want silent fixes.
- **Bump VERSION on every hand-off** (shown on title bar and in menu). Joe uses it to confirm what he's running.
- **Nothing new is assumed.** When Joe says "hold off on new features," he means it — he has spent two days making this and there are reasons things aren't in yet. Propose; don't presume.

## 2. The world's rules (aesthetic decisions and why)

- **Nothing should look like web design.** The title screen is the game itself, asleep, zoomed in. Buttons are in-world where possible (tap the sleeper to begin; tap the mat; tap a shelf). The only non-world element is a thin bottom bar (version · ? · refresh). Menus that exist (debug, Stories) are utility and accepted as such.
- **Cold greys, not the green of the reference image.** Piranesi: weight, solitude, indifference — not horror. The Labyrinth docs' palette carried over.
- **All text is the interior voice**: first person, half-remembered, grey italic. Helper cards are written as the player recalling how a thing works, not as instructions. Pages are the selves' own writing. No system voice anywhere the player reads.
- **Chalk-white for anything the player made or the selves left** (marks, shelf spines, title letters). Gold for keys/gates/compass. Bone for the thread.
- **The title is architectural capitals, not handwriting.** We tried a chalk-drawn rough font; Joe rejected it. Futura/Avenir stack, white, set into one floor tile.
- **Subtle beats obvious** — until it isn't. Push-block edges are hairline and wall-coloured on purpose. The father was made "extremely obvious" first so Joe could dial back. When something must be found, prove it's findable before making it pretty.
- **Sound is synthesized**, no files: a drone/wind bed and a generative composer with one preset per self (MUSIC block). Real tracks via ElevenLabs are the intended upgrade once a preset "lands" — the preset then becomes the brief.

## 3. Movement — a hard-won settlement

We tried: free-roam joystick with wall-slide physics (drifted into darkness), tap-to-point (sent the block flying), discrete tile steps (turns impossible), joystick → tile steps (turns still missed). The settlement is **Pac-Man movement**: continuous glide along corridor centerlines; a perpendicular push is a request taken at the next opening; requests are remembered 400ms; the axis you're not moving on always eases to center (rounded corners, no pops); a stop settles only the travel axis. Pushing a slider requires a 260ms lean so stepping off doesn't trigger it. **Do not reintroduce snapping.** The recentering ease was silently missing for two versions because an insertion anchor moved; that taught us to test behaviour, not just render (see §9).

Joystick over tap-to-move: Joe tried tap, went back. Thumb-and-drag, hands stay put. In landscape the stick and tools go on opposite sides; side is a preference.

## 4. Systems and the decisions behind them

### Light

Very small (viewRadius 1.0 cell) on purpose: being lost is the game. The Child sees only 60% of that; the first stone restores it. The lamp cone is raycast-occluded (72 rays) — Joe rejected light through walls immediately.

### Chalk

The longest conversation. Chalk was plentiful and unused. Diagnosis: the maze is a tree, so the corridor is its own memory; the map is better memory; marks had no payoff; runs are disposable; nothing asks you to return. **Decisions:** marks show on the map without charcoal; marks read faintly through fog and darkness; branching and loop dials are in the menu for Joe to find a shape that wants chalk; and — the real answer — **locked doors** (§4, below) so the maze asks you to come back. **Rejected:** reducing chalk. Joe argues for more chalk, not less. Marks are permanent; picking them back up was removed. Six signs (↑→↓← X ?) from the Soldier on; only X before that. Tap-the-character-to-mark was removed after a child tester did it by accident.

### Charcoal & map

Charcoal maps what your light touches, charged per *new floor tile* (50 per piece), never for retreading. Pausable. The map screen shows only what's charted, plus marks, plus home (always). No cap on charcoal spawns. Map scraps chart ~20% around where they lay — Joe explicitly did *not* want them to also chart where you'd walked.

### Shifting cells (sliders / pockets / swings)

A dead end is sealed into a pocket; the cell across its wall pushes into it. One slider always on the route so the maze can't be finished without one (verified to sever). The start room's door is a slider from the Cartographer on — the sealed 5×5 room teaches the mechanic. **Swings** are the same construction moving on its own (Child phase), preferring corridor positions so they bridge a hall. Rails were drawn and removed (read as a tunnel). No helper card for sliders: Joe wants this discovered.

### Darkness

One contiguous region (25/40/60% of floor in 30% of dark-phase mazes), never within 8 tiles of the door, two fringe rings, eased blackout as you approach; standing in it hides all lit halls; you're invisible in it without the lamp. The lamp is always reachable without crossing darkness.

### Doors and keys (the newest system, v0.31)

Locked doors are a **chain along the route**: door 1 splits the maze, its key is in your starting section; door 2 further on, its key between doors 1 and 2; exit behind the last. Only placed where sealing truly cuts the exit off (loops can't bypass). Keys are **hidden by score**: far off route, far from their door, sealed pockets best of all. **Rejected:** doors guarding optional side pockets (ignorable — Joe finished a maze with two keys and no door used) and keys near their doors. Count is fixed per phase, not scaled by size (a scaled version gave the One Who Stayed twelve). Doors and tunnels exclude each other (a door under a tunnel roof stranded Joe once).

### The father

Abandonment made visible. Tried as a timed glimpse walking away (never seen: player too fast, light too small). Then as a standing figure on a timer (vanished in front of the player). Settled: **placed at generation like pickups**, six per Child maze, at *vantage* spots — within ~2.5 tiles as the crow flies but 10+ steps on foot, one always across the room's wall so he's seen before you leave. He looks like the player, full-sized, faces away, and **fades only when walkable within 4 steps** (line-of-sight checks slipped through diagonal corners). Later phases will reuse this entity as the Caretaker's receding shape.

### Sizes

xs 7×10 · sm 10×14 · md 14×20 · lg 20×28 · xl 28×40 cells. Each step doubles area. Feature counts scale with area (except doors). The Child moved xs → sm once her maze had things in it; Joe's rule: size is fine if there's enough going on.

## 5. Progression — what's built and what's decided

See the Progression doc for the full arc. In short: eight phases (Child → Cartographer → Soldier → Archivist → Priest → Criminal → One Who Stayed → You), features released per phase via the PHASES table, seven stones lifting restrictions (viewRadius, speed, charcoal, darkness, compass/thread time, gate chance, size cap), pool levels between phases (room → straight hall → water; stone from the basin opens a thin grey door; exchange with someone who loves him; Caretaker hosts). The pool level was made *trivially short* on purpose after Joe found an early version hard. The Child's pool is the Father, with anger available as a choice. Page counts follow the arc, not a rule.

**Decided:** shelves and basin exist from run one; the Archivist's notes reveal he built the shelves (Joe rejected withholding the visualization). The Caretaker is a host, not a phase. "You" adds nothing and removes the veil; the basin/stone idea for the ending is liked but not settled — Joe is unsure about basins and stones as the final mechanic.

**Persistence:** runs save continuously and resume exactly in place (position, marks, map, inventory, timers, slider states, doors, father spots). Reload is never a way out. Pages, phase, stones, seen lines, helper cards, UI prefs persist per browser.

## 6. Things we chose not to do (and why) — don't re-propose without new reasons

- Hex grid / node-based movement (the Labyrinth design) — square grid and free glide won on feel.
- Tap-to-move — removed; joystick returned.
- Chalk pick-up, chalk cost reductions, fewer chalk spawns — Joe wants chalk abundant.
- Rough hand-drawn title font — rejected for architectural capitals.
- Stories button on the title screen — removed; title is world only.
- Page-count text in the in-maze popup ("2 of 5 · 3 collected") — removed; the shelves are the counter.
- The page helper card — removed; flow didn't work. Text is still in the file.
- Slider helper card — removed on purpose.
- Generic Piranesi narrator lines — replaced with per-self lines; the Child must never speak in an adult voice.
- Pointer/path pickups in the Child phase — a pocket-loot roll leaked one; all loot is phase-gated now.
- Gate bars at the pool — replaced with a thin door at the room; bars looked out of place early.
- Swing rails, black squeeze bands spilling into corridors, squeeze shrink of the character — all removed.
- A large Child maze — she needs density, not space.
- Ladder/slide onto wall tops — proposed, deferred until cheaper Child mechanics prove the phase.
- New map/character features beyond the docs — parked at Joe's explicit request. Ideas in the Roadmap's parking lot (Skittles, twine, pencil, symbol language, remnant caches, basins, the closing entrance, cross-run persistence) exist and were mapped to phases in conversation, but **none are approved to build**.

## 7. Where this wants to go

- Play-tune branching and loops per phase and bake into PHASES.
- Watch whether doors make chalk happen. If not, the next lever is seeding a pocket into every door section so keys are always behind a trick.
- The Child's remaining themes: more kid stuff if the phase needs it (ladder/slide), more father.
- Pools: real scripts from Joe; the Caretaker's evolving presence; possibly the "mirror" alternative for the seventh.
- The "You" phase ending: written pages from the player's own run; an open exit; possibly the player writes one line. Basin/stone mechanics still open.
- Music: commission ElevenLabs tracks per self once presets land; keep the procedural layer as bed/fallback.
- Labyrinth (3D) remains the long dream; this game is now proving the design it would inherit.

## 8. Player-test learnings

- Joe's kid never opened the map or used charcoal; tapped the character and made an X without knowing why. Result: no starting tools; first-find helper cards; tools taught when found.
- Players brute-force branchy tree mazes. Long halls + loops is the hypothesis for chalk.
- Anything with a timer that depends on the player noticing will be missed. Place it, don't time it.
- Subtle edges (push blocks) work once taught by the start room. Untaught subtlety is invisible.

## 9. Engineering notes — how to not break it

- **Verification habit.** We keep a Node harness that extracts generate() and runs hundreds of seeds across phases/stones, checking: exit reachable in the right order; every pickup/page/key/lamp/pocket reachable; start room sealed (when it should be); darkness away from the door; lamp reachable lit; doors chained and severing; pool layout; father spots valid. Plus jsdom runs that boot the page, tap the sleeper, walk, mark, save/reload, play a pool, and — after the recentering incident — check movement values. **Run these after every change**; do not trust "the frame rendered."
- **Patch by anchor is fragile.** Twice a code block silently failed to insert because its anchor text had changed. Prefer editing with a viewer and confirming the result exists (grep for it).
- **CSS is one block; don't replace ranges.** A range replacement once clipped the helper-card and Stories styles; the game "paused" on an invisible card. The harness now checks every $('id') has a style rule.
- **Generation order matters.** Rough order in generate(): grid → braid → rooms → character/pages → pockets/sliders → start room (seal, bridge orphans, multi-pass) → crawl gaps/swings → pool override → exit alley → BFS route (door open) → first page nearest route → path slider (must sever) → reseal → distances → dead ends → key → pickups → doors chain → scraps → darkness/lamp → fringe → tunnels → hopscotch → tic-tac-toe → father spots. Insert new things where their dependencies already exist.
- **Game clock.** gameNow() freezes during helper cards. Timers must use it, not performance.now().
- **Sandbox quirks.** Artifact preview blocks history and localStorage; everything is try/caught. DuckDuckGo won't open file://; always test on Vercel.
- **Determinism.** Everything in generation uses the seeded R(), so a run can be rebuilt from seed + phase + stones + collected pages for resume. Don't use Math.random() in generate().

## 10. Where the text lives (for rewriting)

CAST (pages, wake/leave lines, summaries) · SELF_LINES (wandering narrator per self) · ROOM_LINES (shelf and basin, per self, by pages held) · EMPTY_SHELF, LIGHTER, FIGURE_LINES · POOLS (approach lines, opening, two exchanges, close) · TUTORIALS (helper cards, player's voice) · MUSIC (presets) · PHASES, STONES, B (burden multipliers) · the how-to rows in the HTML.

*Last word: the game is at its best when the maze is indifferent, the text is quiet, and the player is trusted to notice. When in doubt, take something off the screen.*
