# The Maze — read this first

**The game is the source of truth.** `../maze-topdown.html` outranks every
document here, including this one. When a doc and the game disagree, the game
is right and the doc is history. Fix the doc; never change the game to match a
doc.

Read in this order: `HANDOFF.md`, then `PROGRESSION.md`, then `NOTES.md`.
`labyrinth/` is a different project — reference only.

## The docs

| File | What it is |
| --- | --- |
| **`HANDOFF.md`** | **Start here.** Written for whoever picks up the file next, against v0.31.2 — the current build. Why things are the way they are, what was tried and rejected, engineering habits that keep it from breaking. §6 is a list of settled decisions: don't re-propose them without new reasons. |
| **`PROGRESSION.md`** | The arc: eight phases, seven stones, the pool levels, and why each stone maps to the knob it does. Written against v0.20, so parts are behind; the file ends with a list of exactly where. |
| **`NOTES.md`** | Joe's running notes. The list at the top is the live backlog. |
| `labyrinth/01`–`06` | The **other** project: first-person, hex-grid, Three.js, React/Vite/TypeScript on Vercel. Reference and inspiration. |

All three Maze docs are snapshots of live Google Docs that Joe edits from his
phone. Drive is newer than these copies; the game is newer than Drive.

## Layout

```
maze/
├── maze-topdown.html   the shell — markup and tags only
├── css/style.css       the whole look, 170 rules
├── data/               tuning and text; see data/README.md
│   ├── config.js         SIZES, CONFIG
│   ├── phases.js         PHASES, STONES
│   ├── text.js           every line the player reads
│   └── music.js          MUSIC
├── js/                 the engine, in run order; see js/README.md
│   ├── core.js           version, save file, seed
│   ├── generate.js       the maze itself (the big one)
│   ├── proto.js          prototype levels, from the Prototype debug menu
│   ├── audio.js  state.js  input.js  stories.js  run-save.js
│   ├── tutorials.js  pool.js  map.js
│   ├── movement.js       the glide, turns, sliders, pickups
│   ├── render.js         every frame
│   └── boot.js           frame loop, resume-or-reset, go
├── docs/               this folder
└── tools/              the verification pass; see tools/README.md
```

Everything loads as plain `<script src>`, data first, then the engine in the
order it used to run. **No build step, no modules, no bundler, no fetch** — the
game still opens straight off the filesystem. Data files are `.js` and not
`.json` because `CONFIG`'s comments are design intent and JSON cannot hold them.

**Load order is load-bearing.** The pieces share one global scope and 52
statements run at parse time, so a statement cannot reach forward to something
not yet defined. The tag order in the shell matches the old top-to-bottom order;
`tools/smoke.mjs` asserts it. Add a new file where its code would have gone.

Data came out in v0.32.0, the engine in v0.33.0, the stylesheet in v0.34.0.
Generation is bit-identical across all three — the harness finds the same 10
soft-locked seeds each time — and the CSS move was verified against the
browser's parsed CSSOM and a pixel-identical render, not just by eye.

**The markup stays in the shell**, and should. Moving it out would need `fetch`
(which breaks `file://`) or JS string injection (worse to edit, and the DOM
would no longer exist when the early scripts run). 102 lines of markup *is* the
thin shell.

## What the game is — read from the source

A top-down maze for mobile web. Canvas, no build step, no dependencies,
deployed from a phone. `VERSION` (title bar and menu) says which build is
running; bump it on every hand-off.

- **Eight selves, one maze each.** `PHASES` — The Child, The Cartographer, The
  Soldier, The Archivist, The Priest, The Criminal, The One Who Stayed, You.
  Each sets a size and which features exist (`f: {…}`): signs, charcoal,
  compass, thread, scraps, lamp, darkness, gate, tunnels, pockets, path
  sliders, doors (1–3), crawl gaps, swings, hopscotch, the figure.
- **Five sizes.** `SIZES` — xs 7×10, sm 10×14, md 14×20, lg 20×28, xl 28×40.
  Each step doubles area; feature counts scale with area, except doors.
- **Seven stones, the burdens.** `STONES` — Sight, Pace, Memory, Fear,
  Direction, Shame, Scale. Each is a restriction the player has felt all along;
  setting one down at a pool lifts it permanently, through `B`.
- **The pools, between phases.** `POOLS` — the Caretaker hosts; one person who
  loves him per stone: Father (Sight), Wife (Pace), Brother (Memory), Daughter
  (Fear), Father again (Direction), Oldest friend (Shame), Wife again (Scale).
  Approach lines, an opening, two branching exchanges, a close.
- **A narrator per self**, in that self's voice. The Child's lines are lowercase
  and misspelled on purpose ("the man said wait here." / "but i didnt.").
- **The figure** (`figure: true`, Child phase) is the father — abandonment made
  visible. Placed at generation, six per maze, at vantage spots.
- **Progress persists** in `SAVE` → `localStorage['maze.save.v1']`: phase,
  stones, collected pages, played narration, UI prefs. Runs resume in place;
  reload is never a way out. **"Update app" is the exception** — it calls
  `parkRunAtHome()`, which keeps everything done and drops only your position,
  so you come back on the mat with the title up. Parking has to freeze
  `saveRun`, because `pagehide` and the 6s autosave both fire during the
  reload and would write the live position straight back over it.
- **Audio starts on the first gesture.** `AUDIO.begin()` used to be called only
  from `wake()`, the title tap — and `restoreRun` goes straight into the maze
  with no title, so every resumed run came back permanently silent. A one-shot
  `pointerdown` listener in `js/input.js` now starts the bed; `begin()` is
  idempotent so the fresh-run path is unaffected.
- **`CONFIG`** in `data/config.js` is every tunable, commented. Its comments are
  design intent — read them before changing values. `?seed=1234` replays a maze.
- **All player-facing text lives in `data/text.js`**: CAST, SELF_LINES,
  ROOM_LINES, SHELF_LINES, EMPTY_SHELF, LIGHTER, NARRATOR, FIGURE_LINES, POOLS,
  TUTORIALS. Engine code holds no prose. Joe rewrites text without touching
  logic — keep it that way, and put new text in `data/text.js`, never inline.

## Working rules

From `HANDOFF.md` §1, and they are not optional:

- **Build the tool, not the content.** New text goes in a data block, never
  inline.
- **Everything tunable is a `CONFIG` knob**, commented. Add knobs with features.
- **Ask before building when the design is ambiguous.** Joe prefers 2–3
  tappable options over open questions. Otherwise build and list the calls you
  made.
- **Own bugs openly.** Say what broke and why. No silent fixes.
- **Bump `VERSION`** on every hand-off.
- **Nothing new is assumed.** Things are missing for reasons. Propose; don't
  presume.
- **Test behaviour, not just render.** The movement recentering was silently
  broken for two versions because an insert anchor moved. `HANDOFF.md` §9 has
  the verification habit and the generation order — read it before editing
  `generate()`.
- **Joe tests on his phone.** A change isn't done until it works there.

## Running it

```
python3 -m http.server 8000
```
→ http://localhost:8000/maze/maze-topdown.html

Deployed straight from GitHub Pages — no Vercel, no build step, no Vite. The
live URL is `gamedesignerjoe.github.io/maze/maze-topdown.html`.

## Verifying a change

`HANDOFF.md` §9 says to run the verification pass after every change. It lives
in `../tools/` (it was missing from the repo; rebuilt 2026-09-09):

```
python3 -m http.server 8765          # in another terminal
node maze/tools/harness.mjs          # generation invariants across ~1900 mazes
node maze/tools/smoke.mjs            # boot, walk, mark, save/reload, pool
node maze/tools/selftest.mjs         # proves the invariants can fail
```

None of it touches `maze-topdown.html`. See `../tools/README.md`.

**Sound carries by walking distance** since v0.35.0. `earshot()` in
`js/audio.js` fades a sound in the world from full volume at `sfxNearTiles` to
silence at `sfxRangeTiles`, measured in tiles walked rather than line of sight.
Only `AUDIO.swing()` uses it — every other sound is triggered by the player and
so is always at their feet. Give any new autonomous sound its tile.

**The Turns debug menu (v0.37.0, Sparse added in v0.38.0)** — Auto / Fewer / Sparse / Least — is an experiment
in whether longer halls with fewer forks make players reach for chalk. Two new
`CONFIG` knobs drive it, both off in Auto so generation there is bit-identical
to v0.36.0: `hallStraightness` biases the carver to carry on in the direction it
arrived from instead of turning, and `hallFill` carves the whole grid and then
prunes dead-end leaves back until only that share is corridor, leaving the rest
solid wall. `turnsPresets` holds the menu presets (Fewer 0.85 / 1.0, Sparse
0.65 / 0.65, Least 0.95 / 0.55); each also sets a branchiness used when
Branching is Auto, so Least no longer needs Long halls to be picked alongside
it. **Sparse is the one to reach for.** Least made the halls long enough to
want chalk but too long to enjoy walking; Sparse keeps its dead space and
halves the run length, so the corridors bend about twice as often. It also
leaves 40 dead ends per X-Large map against Least's 12, which matters because
dead ends are where chalk spawns — Least quietly starves the map of the very
thing it makes you want. Pruning never
touches the start block and its ring or the three exit corners, and rooms are
re-rolled until they touch corridor, so the invariants hold — the harness runs
with `--turns least` to prove it. The chosen mode is part of the run signature,
so switching it starts a fresh maze. `tools/hall-metrics.mjs` measures the
result: on X-Large, Least uses about 59% of the grid, cuts turns-plus-junctions
from ~700 to ~180 and dead ends from ~170 to ~12, and the mean straight run
goes from 3 cells to about 7.

## The Child's maze (v0.41.0–v0.43.0)

Worked through the list at the top of `NOTES.md`. The Child phase changed most:

- **The way out is a tree of squeezes.** `CONFIG.exitGauntlet` takes the last
  stretch of the route and turns it into one: a single mouth in, forks along
  the way, one branch that goes on and the rest that end in nothing. Pass-
  through cells are marked as `crawlCells` so they draw narrow and read as
  tunnel rather than a room you step into; the forks stay as chambers. About
  18 cells and 3 places to choose per tree.

  The wrong branches are not invented. Lift the trunk out of the maze and what
  is left falls into pieces: one big one, the maze you came from, and small
  ones hanging off the trunk. Those are already dead ends — that is what makes
  them small — so absorbing one whole costs nothing and cuts nothing. Only the
  trunk's links back to the big piece are shut, one at a time and only while
  every floor tile stays walkable. Every trunk length is built, measured and
  unbuilt, and the best kept: it must be the only way to the exit, and among
  those the one that makes you choose most often wins. **`the squeeze tree is
  the only way to the exit`** is an invariant — shut the mouth and the exit
  must be gone. 1920 for 1920.
- **The floor moves on the way out** (v0.57.0). `CONFIG.exitGauntletSwings` puts
  two cells of the trunk on a clock: they slide sideways into the dead wall
  beside them and back, so the way on is a hole half the time and finding the
  right branch is not the whole of it. Joe asked for "auto moving floor tiles"
  in the gauntlet, and a hole that comes and goes is what makes you stand still
  long enough to think about the choice.

  Nothing is carved for them. The cell is trunk floor already and the alcove is
  dead wall until the tile gets there, so the tree is still the only way out and
  there is no new ground to stand on. They are chosen before the squeezes go in,
  so `busy()` keeps the squeeze passes off the swing's own cell. Only
  straight-through cells qualify — a hole in a junction would be a hole in three
  ways at once — and the alcove must be wall two tiles deep, or sliding into it
  would join the trunk to whatever is on the other side. 87 Child mazes in 120
  get both, 26 get one. **`a gauntlet swing opens no new ground`** is an
  invariant. You can ride one into its alcove and ride it back out; there is no
  way to be left there.
- **A squeeze you cannot go round.** `CONFIG.crawlOnPath` puts one crawl gap on
  the solution route whose sealing would cut start from exit, so getting out
  means getting down. The tile was already open, so nothing about the maze
  changes except how you pass it. Two of them now, and it runs after the
  gauntlet so the severing test sees the final grid. 29 Child mazes in 30 get
  at least one, 2.5 on average; a very loopy maze can get none, and there the
  warren carries it instead.
- **The kid's room.** A square of cells is reserved before anything is carved
  and marked visited, so the maze grows around it. What is left is a solid
  block of wall in the middle of the map, and at the end it is cut open whole:
  5×5 tiles of floor with nothing in the middle of it, and one crawl gap into
  it. That is the only way to get a room that is actually a room rather than a
  winding piece of corridor with the walls taken out. Every Child maze gets
  one, 25 tiles, about 11 drawings. Rooms and districts keep off the reserve.
  If there is somehow no way to open it onto a corridor, it falls back to
  finding where the maze pinches instead.

  Inside it is dark. `CONFIG.secretDark` paints the floor out until you find
  `secretSwitch`, a light in the floor breathing until you stand on it; then
  the lights stutter on over `secretMarks` and `secretFather`, a man from
  behind, mid-stride, going away.

  Three things about that dark changed in v0.56.0, all Joe's notes. The paint
  is `colors.wall`, not `colors.bg` — painted-out floor should read as more
  wall, not as a hole in the picture. The breathing light is a quarter as
  bright and half as wide (`secretGlow`, `secretGlowTiles`, `secretGlowCore`);
  it was reading as a lamp. And it does not show at all until you are standing
  on a tile of the room, so from the squeeze there is nothing to see: the
  switch sits `secretSwitchIn` = 2 tiles in from the way in, never on it, so
  you have to commit to the dark before it shows you anything.
- **A squeeze is drawn from where it actually goes** (v0.56.0). `drawSqueeze()`
  fills the tile with wall, cuts a hub in the middle of it and reaches one arm
  toward each side you can walk to. It used to assume every squeeze ran
  straight through — one strip, its axis guessed from the two side neighbours.
  32 squeezes in 925 are tees or crosses, nearly all of them in the exit
  gauntlet, and those showed a single strip and then let you walk out of a side
  with nothing drawn on it at all. Joe: "I'm able to push into the squeeze
  though here even though there's no path. Maybe because the whole tile is a
  squeeze and we don't look at what direction you are coming from?" For a
  straight-through squeeze the drawing is pixel-for-pixel what it was.
- **The hopscotch is one court, not a box per tile** (v0.56.0). The cells touch,
  the way a kid chalks them: two rails down the run, a line between each cell,
  and a small wobbly number in each. It was a 0.6-tile box per tile with a gap
  between each, twice the size it should be and the numbers far apart.
  `chalkLine()` draws in three wobbly bits with the wobble fixed by tile
  position, so it never shimmers as you walk; `CHALK_DIGITS` holds 1–8 as
  strokes rather than a typeface. The mechanic is untouched — still one tile
  per number, stepped in order.
- **The Child's map is medium and sparse** as of v0.50.0 — `f.turns` lets a
  phase name a Turns preset, and the Child names `sparse`. Twice the area, a
  quarter of it wall. It needs the room, and it suits the level.
- **An arrow painted on the start-room floor** the first time you meet a block
  you have to push (`startArrow`). It is the only thing in that room that says
  the wall moves. `SAVE.pushLearned` retires it for good once you have leaned
  on one.
- **Both are Child-only**, gated on `F.crawl`. For every phase after, a crawl
  gap is drawn shut, so either would wall something away for good.
- **No push blocks.** A shifting district used to ask for extra sliders on any
  phase with pockets *or* swings, and on a swing-only phase the surplus came
  out pushable. Shifting now needs real pockets.
- **One father at a time**, and he leaves: seen, he waits `figureLingerSec`,
  then walks straight away from you and fades, through whatever is in the way.

**The character fills in as the burdens go down.** `drawPlayerBody()` in
`js/render.js` clips the arrow and paints seven bands tail to nose, one per
stone: `colors.playerBurdened` while still carried, `colors.player` once put
down. `CONFIG.playerOutline` keeps a pale edge on him — carrying everything he
is nearly black, and on a dark floor that edge is the only thing that keeps him
findable. Set it to 0 for Joe's literal "completely black".

Two invariants came out of this: **a swing-only phase carries no pushable
blocks**, and **the secret place is behind a squeeze, and behind nothing else**
— walkable, and not walkable once crawling is off the table. That second one
caught something geometry could not: a room opens its corner tiles, and one of
those can touch a corridor running alongside, so hiddenness is settled with a
flood rather than by counting doorways.

**The floor (v0.46.0).** A separate **Floor** debug menu from the screen
overlay, because these are marks in the concrete rather than effects on the
glass: fixed by the seed and by the shape of the maze, so they are in the same
place every time you come back. That is the point — the Child has lived here
his whole life, and the room should show it.

| Option | What it is |
| --- | --- |
| **Worn paths** | The floor polishes along the ways people actually walk. Traffic is distance out from the route (`floorWearReach`). A corridor gets a stroked track; an open floor gets a flat wash instead, because everybody walks everywhere in a room — and because stroking a plus on every tile of one leaves the diagonals bare and prints a lattice of rings across it. |
| **Grime** | Dirt along the foot of every wall, twice over in a corner, with a per-tile roll so it is not uniform. |
| **Flickering lights** | Ceiling fixtures every `floorLightSpacing` cells pooling light on the floor. `floorLightBad` of them have something wrong and stutter, always, not in response to anything. |
| **All three** | Which is probably the answer. |

Off by default. The distinction worth keeping: grime and decay are the texture
of an abandoned *building*, nobody here for years. The Child was left in a
corridor somebody still mops. Worn paths carry that better than dirt does —
they are evidence of other people, and of their absence.

**Texture (v0.45.0).** Three overlays behind a **Texture** debug menu, off by
default. Grain and Dust draw **under the fog**, so they only ever show where the
maze is lit; over the top they carried on across the black surround and the
empty space below, which reads as dirt on the screen rather than anything in the
room. Grain has its own amount, `textureGrain`, at half the rest, because it
covers every pixel. The three are: **Grain** lays film-and-paper noise over the whole picture, **Damp**
puts seeded blotches on the floor under the fog, so a stain stays where it is
in the room, and **Dust** drifts motes across the glass. Which one the maze
wants is a look to be chosen by eye, so all three are built and none is picked.
Texture is pure paint: changing it does not reset the maze, so you can flick
between them on the same corridor and look. `CONFIG.textureAmount` sets how
strong whichever is on.

## Walking about a room (v0.68.0)

Joe: *"my character only walks in the middle of floors not across them. So
there's this strange robotic feeling to how they always have to move up/down
right/left."* He is right, and it only showed up once the labyrinth gave rooms
worth walking about in.

A corridor is one tile wide, so one axis at a time held to the centreline is the
only thing that fits — that stays exactly as it was. But where there is actually
room, `openFloor()` (a tile in any 2×2 block of floor, which is only ever true in
a room or a court) hands movement over to the stick's **real** direction:
`stickAim`, the raw vector, alongside the squared-off `held` the corridors use.
Per-axis collision with the body's own width, so you slide along a wall and
cannot cut the corner off one. The rails pick you up again at the corridor mouth,
and the centreline ease is what brings you back onto the line.

The thing that went wrong first, and what the smoke check is really for: the
clearance test has to be **`passable()`, not `isOpen()`**. A shut gate and a
locked door are open floor underneath, and walking free is not permission to walk
through them. The pool-gate check caught it immediately.

**Landmarks fill their room** (v0.68.0). Joe: *"imagine the spiral covering the
whole floor rather than just one part of it... the pool takes up the whole room.
Or there's a giant ball pit in one."* Each landmark carries its heart room's tile
bounds and is drawn across all of it — the pool is the room, the spiral is the
floor, the statues stand round the walls — and there is a ball pit now, which
there was not before.

**The map draws the same man the game does** (v0.68.0) — `drawPlayerBody()`,
burdens and all. It used to be a plain arrowhead, so the map showed somebody
else.

**A Zoom slider in the debug panel** (v0.68.0). `zoomMul()` scales
`CONFIG.tilePx`: 2.5× is the three tiles around you, 1× is the game's own scale,
0.5× is twice the ground. Pure view — no reset, so you can drag it while you
walk.

## The app icon (v0.67.0)

A **meander** — the oldest mark for a labyrinth there is — in the game's own
floor grey on its own wall dark, with the player's arrowhead at the mouth of it.
`tools/make-icon.mjs` draws every size from the one drawing, so there is nothing
to keep in step by hand:

    node maze/tools/make-icon.mjs      # writes icons/icon-32|180|192|512|1024.png

The artwork is full-bleed and square: iOS masks the corners into a squircle
itself and paints no background of its own. Everything is drawn inside a 5.5%
margin so the mask cannot bite the arrowhead. `manifest.webmanifest` gives it a
name, standalone display and the dark background, so Add to Home Screen installs
it properly instead of grabbing a screenshot — which is what it did before,
because there was no icon at all. A smoke check makes sure all of it resolves,
since a missing icon fails silently on a phone and just looks like nothing.

## The labyrinth prototype (v0.64.0)

`docs/LABYRINTH.md` is the plan; `buildLabyrinth()` in `js/proto.js` is the
first build of it, in the Prototype menu next to Two-way blocks. Ground cut into
8–12 sections that own their edges, a hall through the dead seam between each
pair, an open room at the heart of every section with a landmark in it, and a
section graph that is a tree so there is exactly one way between any two of
them. `tools/shape.mjs --proto laby` and `tools/bots.mjs --proto laby` measure
it against the maze it is meant to replace.

One thing to know before reading the numbers in that doc: **the first junction
count in it was wrong** and is corrected there. It counted every tile of an open
room as a junction, and a room asks you nothing — you can see all of it. The
maze forks every 10–13 tiles of corridor, not every 3.4. The threshold finding,
which is what the plan rests on, is unaffected.

## How long a maze takes (v0.63.0)

`tools/bots.mjs` answers the three questions Joe asked — the fastest a maze can
be finished, the longest it can honestly take, and what to assume in between —
by running three bots over the real generated maze and pricing every step in
seconds from the game's own constants.

| | sm 25×33 | md 33×45 | lg 45×61 | xl 61×85 |
|---|---|---|---|---|
| floor (perfect play) | 37s | 50s | 1m 06s | 1m 29s |
| explore (median) | 2m 09s | 3m 33s | 6m 42s | 13m 28s |
| explore p10 – p90 | 1m 03 – 3m 11 | 1m 39 – 6m 03 | 2m 36 – 11m 20 | 4m 46 – 22m 03 |
| sweep (every tile) | 4m 22s | 7m 45s | 14m 04s | 26m 59s |
| floor tiles | 228 | 450 | 892 | 1772 |

(The Child's maze, 24 seeds a size, 250 explorer runs a maze.)

**The floor barely moves with size.** Eight times the area buys 52 extra
seconds of perfect play, because the exit sits in the opposite corner and the
shortest route is roughly the diagonal — the side of a maze grows like the
square root of its area. Moving the exit to the *farthest tile in the maze* only
takes xl from 1m 29s to 1m 45s. Size is a weak lever on the floor and a very
strong one on being lost: the sweep grows with the area, 4m to 27m.

**Locked doors are worth 8–13 seconds** of the floor, measured as the route with
every door open subtracted from the route as generated. They add variance for
somebody exploring, not length for somebody who knows the way.

**Validated against the real game.** `--validate` puts a real player on the
oracle's route, at real speed, through the real input path: 45.0s against 46.8s
predicted at sm, 50.9s against 55.4s at md, 47.5s against 49.4s at lg, 58.5s
against 1m 08s on a phase-3 md with doors and push blocks. The model reads 4–15%
slow because a real player cuts corners. It is a slightly slow clock, not a
wrong one, and the bias is the same for all three bots.

Two things the bots taught us about the model itself, both fixed in it: a pushed
block stays where you put it, so the sealed gap is floor from then on and you
ride it back out to leave a pocket (the first version could shove a block in and
never come back, which made every maze with a key in a pocket look unsolvable);
and a tutorial card pauses the game until it is tapped, which a bot never does.

**A block is a sliver again (v0.62.0).** Back to what it was before v0.54: the
tile is floor, with a thick sliver of wall down each side it can still be
shoved. Joe on the outlined slab: "the entire thing is outlined and it doesn't
even look like it's part of the map. It just looks like a block... there was
just a little bit of a hint of what you were supposed to be able to push." The
slab was solving a problem he does not have — a two-way block changing apparent
size — and that only shows in the prototype. `blockSlivers()` in `js/render.js`.
The arrow that teaches the first push is now painted **on the block**, not two
tiles back on the floor: "the arrow should be on the same block that you push."

**Cornering costs you ground, not speed (v0.62.0).** The slide back onto a
corridor's centreline used to be its own movement at 1.6× walking, applied on
top of the step, so turning a corner off-centre you crabbed diagonally at 1.89×
walking speed — Joe: "they have this almost like race car cornering thing to
them." Walking and centring now share one `budget` per frame: the ease takes at
most `CONFIG.cornerEase` of it, and the forward step takes
`sqrt(budget² − perp²)`, so the total is exactly the walking step and a hard
correction simply costs you ground forward while it lasts. Measured inside the
frame loop: every frame is 1.00× the budget, where it used to hit 1.887×.

**The run log (v0.62.0).** Joe: "how do we go about keeping a stats log that
showed how long it took to complete mazes and some other information?" Every
maze you walk out of writes a line — when, build, who, phase, stones, seed,
size, milliseconds, tiles walked, the shortest route, dead ends, chalk and
charcoal used and found, pointers, paths, pages, tiles mapped. It lives under
its own `maze.log.v1` key, **not** in `SAVE`, so **Reset save** does not throw
away the record of what you have already tested. Capped at 300, newest last.
**Run log** in the debug panel shows the total, the best time per character and
the last 40 runs; **Copy CSV** puts the lot on the clipboard. And time reads as
hours, minutes and seconds everywhere (`fmtTime()`): "42.3s", "4m 14s",
"1h 16m 09s".

**The kid's room, and the game nobody finished (v0.61.0).** The secret room's
floor used to be chalked with `x`, `?` and the four arrows. Joe: "don't draw the
arrows in the child's secret room. It just looks like a code they will need to
know." It is a child's room, so it now holds a child's things — one game of
noughts and crosses, the word `Dad?`, two to four balls, and the rest x's, dealt
by `secretRoomChalkOn()` from `generate()`'s own seeded rng so a room is the
same room every time you come back to it. `secretFather`, the drawing as far
from the switch as it gets, is now `drawChalkPair()`: the man from behind
mid-stride, and the smaller figure standing beside him, not walking.

**Every board is winnable, and the move is always the middle** (v0.61.0). A
tic-tac-toe is dealt with two crosses, no noughts at all, and the middle open —
the two crosses are always two thirds of a line through it. Chalk your own X on
its tile and `drawTicTacToe()` fills the middle and strikes the line through;
the narrator says so once. Boards in the kid's room work the same way. 80 in 80
across seeds: no noughts, middle open, middle wins. Chalk is what gates it —
the Child starts with none, so you have to find some first.

**The shelves and the basin went quiet (fixed in v0.60.0).** Standing on a
shelf or on the basin for a beat says something about it. Two separate faults
had it barely working, and Joe caught it as "standing on top of the stones or
next to the bookshelves and a new game does not fire off the dialogue anymore".

- `shelfShown` is the latch that stops a line repeating every frame while you
  stand there. It belongs to *that stand*, but nothing ever cleared it — not
  stepping off, not `reset()`. So a line played once per page load and never
  again, and since a debug level change is a `reset()` rather than a reload,
  every maze after the first was silent. It now clears whenever you leave the
  spot, and in `reset()` with the rest of the run's state.
- "Standing still" was `!dir && !sliding`, and `sliding` is true for any swing
  anywhere in the maze while it moves. Each one reset the dwell timer, so with
  five auto-sliders on the Child level (three, plus the two the exit gauntlet
  got in v0.57.0) you rarely accumulated the second the shelves want. It is now
  `!(sliding && sliding.carry !== false)` — the same test the stick uses for
  "this slide is moving *me*" — so a swing across the maze is none of your
  business.

Both are covered by **the shelves and the basin speak every time you stand at
them** in `smoke.mjs`, which fails against either old line.

**Getting through a squeeze (v0.66.0).** Joe: *"the character leaves the
squeeze space and drifts out into the black portion of the map."* Two separate
things did that, and only one of them was the drift.

- The slide onto the centreline is gentle since v0.62.0, and in a channel a
  third of a tile wide it carried you out of it. Inside a squeeze the ease now
  gets the whole frame's budget and the off-axis is **clamped to
  `CONFIG.squeezeChannel / 2`**, so there is nowhere to drift to.
- The body is most of a tile across and the channel is `squeezeChannel` = 0.28
  of one, so squared up he hung over both walls however centred he was. He now
  draws at `squeezeShrink` while he is in one — he turns sideways to fit, which
  is what a squeeze is. That is what the old 0.7 alpha was covering up, and the
  alpha is gone, as asked.
- No camera kick going in or out (`squeezeBump` is gone), and the sound is the
  same knock as a shoulder on a wall rather than a scrape of its own.

`CONFIG.squeezeChannel` is read by the drawing *and* by the hold on your
footing, so the two cannot drift apart.

**The pool gate swings (v0.66.0).** Joe wanted it moved back off the room's
wall, white, with the smaller filled circle off the stone, and *"opening down
the middle and both sides swing to the wall. I want them to stay there though,
not disappear."* So it is two leaves hinged at the jambs: closed they meet in the
middle with the stone on the seam, and they swing apart into the hall over
`poolDoorSeconds` and stay lying against the walls. `poolGateInset` is how far
back from the room it sits; flush with the wall it read as part of the wall.

**The burden coming off holds longer (v0.66.0).** `liftBandSec` 1.1 → 2.4, and
the band goes **black → grey → pale** through `colors.playerLifting` rather than
straight to pale, holding on the grey for the first 55% of it. Joe: *"right now
we just see a tiny bit of white and it's not that rewarding."*

**The pool room's gate (v0.58.0).** Four of Joe's notes, all about weight.

- It sits on the edge of its tile nearest the room, flush with the wall the
  doorway is cut through, and grinds sideways into that wall. Drawn in the
  middle of the tile it floated in the passage.
- It opens when you *shove* it, not when you pick the stone up. Lean into it
  with the stone for `CONFIG.pushHoldMs` — the same lean a push block wants —
  and it starts to give. Empty-handed it still says "It won't move. Not without
  a stone."
- `poolDoorSeconds` is 4.8, twice what it was, and `passable()` keeps the
  doorway shut for the whole grind rather than only until the stone is in hand
  (`poolDoorShut()`), so the wait is real and the sound has time to finish.
- Carrying a stone costs 30% of your speed: `B.speed()` multiplies by
  `CONFIG.stoneSlow` when `poolMode && hasKey`. Only in a pool level — outside
  one `hasKey` is the exit key, which is small enough to pocket.

**The waking after a pool (v0.44.0, rebuilt in v0.50.0).** Putting a burden
down makes the maze easier — the first one nearly doubles your light — and
nothing used to say so. It now happens in two beats. You wake in the light you
had *before*: `reset()` sets `liftGlow` to `liftGlowFrom` when `SAVE.lifted` is
set, so the title screen is still the old dark. Tap, and first one band of him
goes pale over `liftBandSec` with nothing else moving at all. Then the dark is
cut back to its new size over `liftBurstSec`, fast, and the camera goes with
it. Fading slowly into the new light said nothing; the cut is the beat that
reads. `liftBand` and `liftBandAmt` carry the band; `liftGlow` multiplies
`B.viewRadius()` and is 1 at every other moment.

**Texture (v0.45.0).** Three overlays behind a **Texture** debug menu, off by
default. Grain and Dust draw **under the fog**, so they only ever show where the
maze is lit; over the top they carried on across the black surround and the
empty space below, which reads as dirt on the screen rather than anything in the
room. Grain has its own amount, `textureGrain`, at half the rest, because it
covers every pixel. The three are: **Grain** lays film-and-paper noise over the whole picture, **Damp**
puts seeded blotches on the floor under the fog, so a stain stays where it is
in the room, and **Dust** drifts motes across the glass. Which one the maze
wants is a look to be chosen by eye, so all three are built and none is picked.
Texture is pure paint: changing it does not reset the maze, so you can flick
between them on the same corridor and look. `CONFIG.textureAmount` sets how
strong whichever is on.

**The waking after a pool (v0.44.0).** Putting a burden down makes the maze
easier — the first one doubles your light — and nothing used to say so; you
simply played on. `poolDrop()` now records `SAVE.lifted`, and the next `wake()`
runs a longer pull-out (`liftIntroSeconds`) with the light opening from
`liftGlowFrom` to full as it goes, over a major figure (`AUDIO.lifted()`).
`liftGlow` multiplies `B.viewRadius()` and is 1 at every other moment. An
ordinary waking is untouched.

## Prototypes (v0.52.0)

`js/proto.js` and a **Prototype** dropdown in the debug menu. A prototype
replaces the maze outright: `buildProto()` sets every global `generate()` would
have set and `generate()` returns, so nothing downstream needs to know one is
running. `protoMode` widens the light so the whole idea is visible.

**Two-way blocks.** A block is the floor you stand on; shove it and it slides
one step into the wall beside you, bridging to the next island, and stays there
once you have ridden across. A plain slider has one way to go. These have two —
in line (a square either side) or round an elbow (two at right angles) — so
three squares in all. From home it takes either; once it has gone one way it can
only come back, so a wrong turn costs the walk back rather than the level.
`blockAt()` and `blockWays()` in `js/movement.js` generalise the one-way slider;
a slider without `ways` behaves exactly as it always did.

**A block is drawn as a slab** — `blockSlab()` in `js/render.js` — a whole tile
of face a shade paler than the floor (`colors.block`), with a groove round it.
Two earlier tries failed. Drawing a thick edge only on the sides a block could
move made it change apparent size: a two-way block was a narrow bar at home and
a full tile once it had gone one way. Drawing that edge inset all the way round
fixed the size but left a notch on each movable side, and two blocks side by
side showed a doubled dark band between them. The groove is now *stroked on the
tile boundary itself*, so neighbours share one groove instead of stacking two,
and the block is the same tile-sized slab wherever it is.

Nothing on a block says which way it goes. Joe's call: "if we didn't give the
hint at all but in the first block, I'd be fine with that. The rest the player
has to learn by doing." The only hint left is the glint on the first block,
which pulses its groove in the hint colour after you have stood still a while.

**What a level holds**, per prototype: about 8 blocks and 55 fixed islands.
Of the blocks, roughly 3 one-way, 1 straight (up/down or left/right) and 4
elbow. Straight ones need the square behind the block to be free and often it
is not, which is why `protoStraightBias` is 1 and they are still the minority.

The level is a grid of islands with **no bridges at all**. A line of blocks runs
from where you wake to the way out, and most of them also offer a way that goes
nowhere: which of the two goes on is the whole question.

**Two bugs the prototype flushed out**, both in the main game as well:

- The scripted first step off the mat (`introWalk`) outranks the stick in
  `want` and only clears when you change tile. Facing a wall it never cleared,
  so the stick stayed dead for the whole run. It now gives up if the step is
  not possible.
- The glint that hints at the start block redraws that block's outline in the
  hint colour. When the outline became a loop over `blockWays()`, the glint was
  left referencing the loop variable — a `ReferenceError` inside `draw()`,
  every frame, and a throw there never re-queues `requestAnimationFrame`, so
  the game froze. It hit the Cartographer onward after 2.5s of standing still.
  Both now have smoke checks, because both only bite after a delay.

`protoSolvable()` is the test Joe asked for. It walks every state the level can
be in — where you are standing, and where each block has got to — and looks for
the way out. Generation tries up to `protoTries` layouts and keeps the first
that passes. It has teeth: leave every block only one way and it reports the
level cannot be done.

## The end of a level (v0.48.0–v0.51.0)

Every phase should have to earn the way out, using whatever mechanic that
phase brought in.

- **The Child squeezes.** `CONFIG.exitGauntlet` — see above.
- **Everyone who pushes, pushes.** `CONFIG.exitPushBlocks` puts a run of load-
  bearing push blocks along the end of the route on any phase with pockets. A
  block only counts if sealing its gap really does cut start from exit, and the
  blocks already placed are treated as *passable* while testing the next one,
  because you can push those too — so each has to be load-bearing on its own.
  About 2.5 per maze on the Cartographer, 3.2 on the Archivist, every one of
  them required. `exitPushTail` biases them to the last stretch, but topology
  has the final say: a maze with no single passage whose sealing severs the
  route has nowhere to put one, and about one in five gets none.

Not built, and Joe called it out as worth prototyping: the *grid* of push
blocks where you work out which ones go where, and a block that can be pushed
two ways. Both are new mechanics rather than new arrangements of this one —
today a "push block" is a tile of floor that slides into a sealed pocket, not
a crate you shove around a room.

## Getting a different maze (v0.40.0)

The seed is shown in the debug panel next to the version, and `?seed=1234`
replays a particular maze. Three ways to change it:

- **New maze** in the debug panel rerolls the seed and changes nothing else —
  same phase, same stones, same pages found. This is the one for reviewing
  generation.
- **Any debug dropdown** already rerolls as a side effect of applying itself.
- **Update app** keeps your maze, unless the build changed.
- **The Level menu** (v0.56.0 as two menus, one since v0.59.0) lists all fifteen
  levels in story order: the eight characters with the pool that comes after
  each of them between them. A character entry is entered with the stones you
  would have put down by then; a pool with the next one still in your arms —
  both are the phase index, which is what makes the interleave work. The talk at
  the water is chosen by the stone count (`POOLS[stones]`), the level itself by
  `poolPending`.

  It is one menu because two could disagree. Phase and Pool room each set part
  of the state, so a character picked while `poolPending` was still set from
  somewhere else put you at the water instead — Joe: "when I select a character
  level now it just keeps putting me in the pool level". Every pick now sets
  phase, stones, pool-or-not and Prototype-off together, and `syncLevel()` re-
  reads the menu from `SAVE` each time the panel is opened, because the game
  moves on by itself after a pool and a menu showing the wrong level makes the
  next pick a silent no-op.

That last one is new. A run stores only its seed and what you did; the maze is
rebuilt by `generate()` on load. So a run can only be resumed by the build that
made it — restoring marks, sliders and doors by index onto a maze a different
version carved is nonsense, and quietly wrong rather than loudly broken.
`js/boot.js` now requires `run.v === VERSION` alongside the rest of the
signature, so **updating to a new build starts a fresh maze**. Phase, stones
and collected pages live outside the run and are kept. An ordinary reload on
the same build still resumes exactly where you stood.

## The Full map debug view (v0.39.0)

With **Full map** ticked in the debug menu, the whole maze is drawn fitted to
the screen. It is now something you can work in rather than only look at:

- **Tap a spot to stand there.** Tap a wall and it takes the nearest floor
  within `CONFIG.debugTapReach` tiles, because at the fitted scale a tile is a
  few pixels wide and a fingertip is not. The exit tile is never a target — a
  stray tap should not end the run — so tapping it puts you beside it instead.
  Arriving fires the normal tile-entry logic, so pickups and pages are
  collected exactly as they would be on foot and the run stays one you could
  have walked. It will happily drop you behind a locked door; tap your way back
  out.
- **Pinch, scroll or drag** to zoom and pan, between `debugMapMinZoom` (a
  multiple of the fitted scale) and `debugMapMaxZoom` pixels per tile. Zoom
  holds the point under your fingers still.
- **It only draws once the run is going.** Fixed in v0.40.0: it used to cover
  the title screen too, and since the HUD is hidden there and the sleeper was a
  few pixels wide, changing Size with Full map ticked left you looking at a map
  with no way back to the menu. Reloading was the only way out.

`dbgView` is null until you pan or zoom, and null means fitted, which is what
the view has always been. Untick and tick Full map, or start a new maze, to
refit. `render.js` asks `dbgFrame()` in `js/map.js` for the camera so both the
drawing and the hit-testing agree exactly; hit-testing off the last frame's
numbers would drift during a pinch.

One wrinkle worth knowing: the debug panel closes on a tap outside itself, in a
capture-phase listener that runs before the canvas sees the tap. `dbgClosedAt`
records that, so the tap that dismisses the panel does not also teleport you.

## Districts (v0.38.0)

Patches of maze with a character of their own, so a map does not feel the same
all the way through. They are stamped after the halls and the rooms are carved,
over the patches that already twist the most, and the **Districts** debug menu
picks between Auto, Off, and forcing every district to one heart.

A district is filled in first — dead space inside it comes back as floor — then
its interior links are re-cut to its heart. Six hearts, in
`CONFIG.clusterHearts`:

| Heart | What it is |
| --- | --- |
| `rings` | Nested rectangular loops, joined to each other in one place only. You keep coming round to where you were. |
| `thicket` | A knot of short branching paths and junctions, with no long sight lines. |
| `comb` | A spine with long dead-end teeth off alternating sides. |
| `lattice` | Every link open — a field of single-tile pillars with no landmarks at all. |
| `squeeze` | Sparse halls where most of the walls between them are crawl gaps. Child phase only, since only the Child fits through. |
| `shifting` | A dense double comb where nearly every stub is a moving block. Needs a phase with pockets or swings. |

`squeeze` and `shifting` do not carve their furniture themselves. They mark
their ground, and the crawl-gap and slider steps further down `generate()`
serve those districts first and are allowed `clusterCrawlGaps` /
`clusterSliders` extra each, so a district does not eat the map's usual quota.

**Why they cannot break a maze.** Only links with both ends inside the patch
are ever cut, so every way in and out survives untouched; afterwards the whole
patch is spanned by a random tree, so nothing inside is stranded. A district
can add floor and add connections; it can never take a connection away. That
argument is now enforced by a new invariant, `no corridor is cut off`, which
asserts every floor tile in the maze is walkable from the mat.

Districts keep clear of the start room and its ring, all three candidate exit
corners, each other, and the rooms — a district overlapping a room would wall
the room back up.

**They are on by default**, one per medium maze and scaling with area, so
X-Large gets four and Small gets one. `Districts → Off` in the debug menu turns
them off, and with them off generation is bit-identical to v0.37.0 — the sweep
finds the same 10 soft-locked seeds. Turning them on consumes from the random
stream, so every seed produces a different maze.

**Known open bug, and districts made it four times more likely.** A door's key
can land in a sealed pocket behind that same door, and the maze is then
unfinishable. Districts raise the count from **10 unfinishable mazes in 1920 to
40**. Forcing one heart everywhere, per 1920: rings 14, comb 23, lattice 23,
shifting 30. Comb adds neither loops nor pockets and still doubles it, so this
is not a mechanism belonging to any one heart — it is that re-carving near the
route leaves the door placer fewer gaps that truly sever it, so doors crowd
into choke points and the section behind a door more often holds nothing but
its own pocket.

The fix still belongs in the key scorer in `generate()`, which does not check
which side of the door a pocket lies on. Deferred at Joe's request, and not
touched here. Two things make it liveable in the meantime: **The Child has no
locked doors at all**, so the level Joe is testing chalk on cannot soft-lock;
and `Districts → Off`, or `CONFIG.clusters: 0`, returns the rate to 10 in 1920
exactly. Reproduce the original with
`node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7`.

**A bug the new invariant caught on the way in.** `braid` opened a gap from any
cell with exactly one open neighbour toward any in-bounds cell, checking
neither end was actually floor. On a full grid both always are, so Auto was
never affected — but Sparse and Least prune cells away, and braid would join
two pruned cells and leave a floor tile walled in on both sides that nobody can
ever stand on. Five mazes in 576 under Sparse. Fixed in v0.38.0 by requiring
both ends open, which changes no Auto seed and reshuffles Sparse and Least.

## Repo facts that bite

- **GitHub Pages serves `main`.** A commit on another branch is on GitHub but
  not on the live site.
- **`../Index.html` is a one-byte stub with a capital I**, so `/maze/` does not
  resolve to the game. Link to `maze/maze-topdown.html` by its full name (the
  front-page tile does).
- The root `service-worker.js` is network-first as of 2026-09-09. Before that it
  served `index.html` cache-first forever, which is why the front page looked
  permanently stale on phones. If that recurs, start there.
- Other projects here keep docs in `<project>/docs/` too (`cartographer/`,
  `killcode/`, `tidy-adventures/`). Same convention.
