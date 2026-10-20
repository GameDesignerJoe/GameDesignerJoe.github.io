# The Maze — Handoff: Decisions, Rejections, and Where This Is Going

<!-- reviewed: v0.76.0 — rewritten against the game -->

*Rewritten 2026-09-12 against **v0.76.0**. Written for whoever picks this up
next — a Claude Code session, most likely. The code is self-documenting for
**what** exists. This doc is for **why**, for what we deliberately did not do,
and for where the game is meant to go.*

> **The game is the source of truth.** `../maze-topdown.html` and the files it
> loads outrank this document. Where they disagree, the game is right and this
> is history — fix the doc, never the game. Companions: `CLAUDE.md` (how the
> repo works and what each version changed), `PROGRESSION.md` (the arc),
> `ROOMS.md` (the rooms), `labyrinth/` (a different project).

## 0. What this is

A top-down maze game for mobile web. One page, canvas, **no build step, no
modules, no bundler, no dependencies** — it still opens straight off the
filesystem. Joe edits and deploys from his phone.

Two things in the old version of this doc were wrong and cost a session each:

- **It is no longer a single HTML file.** It was until v0.32.0. It is now a
  thin 144-line shell plus `data/`, `js/` and `css/`, loaded as plain
  `<script src>` tags sharing one global scope. The no-build-step principle
  survived; the single-file *form* did not. See `CLAUDE.md` § Layout — and note
  that **load order is load-bearing** and asserted by `tools/smoke.mjs`.
- **It deploys to GitHub Pages, not Vercel.** Commits go straight to `main` and
  the live URL is `gamedesignerjoe.github.io/maze/maze-topdown.html`. Vercel is
  only for Joe's projects that need an API key. There is nothing to test on
  Vercel.

It began as a cheap way to prove out gameplay for **Labyrinth**, a first-person
3D maze game whose four prior builds died on geometry. It has since become its
own thing. The 3D version remains a long-term possibility; nothing here assumes
it.

The story: a man wakes in a maze he put himself in. Every traveller whose pages
he finds is himself at another stage of life. Each is a wound that drove him
from the people who loved him. The maze is where he goes when he isn't ready to
go back. The game is the process of becoming ready.

## 1. Working principles

- **Joe's rules for a work session live in his Drive doc**, at the top, under
  "Rules for Claude" — not here, because two copies drift and his is the one he
  edits. `CLAUDE.md` § How Joe and I work has the mechanics; `/maze-task` is the
  procedure as a skill.
- **Build the tool, not the content.** Every kind of text — pages, wake lines,
  narrator lines, shelf/basin lines, pool exchanges, helper cards, music presets
  — lives in `data/text.js` so Joe can rewrite it without touching engine code.
  Keep it that way. All of my text is first-pass; Joe edits later.
- **Everything tunable is a `CONFIG` knob**, commented, in `data/config.js`. Its
  comments are design intent, not description — read them before changing a
  value. When adding a feature, add its knobs. Joe tunes by feel on the phone.
  **Name knobs here; do not quote their values.** Joe retunes them on his phone,
  and a number copied into a doc is wrong by the next evening. The name stays
  true and `data/config.js` is one file away.
- **Any new generation feature needs its own RNG stream** (`rng(seed + <prime>)`).
  Drawing from the shared `R()` redeals every maze in the game, and the harness
  will tell you so in a way that looks like your feature broke something else.
- **Honest reporting.** Say what broke and why. Joe does not want silent fixes,
  and he does not want a passing verdict he cannot check.
- **Bump `VERSION`** (in `js/core.js`, shown on the title bar and in the menu) on
  every hand-off. Joe uses it to confirm what he's running.
- **Nothing new is assumed.** When Joe says "hold off on new features," he means
  it. Propose; don't presume.

## 2. The world's rules (aesthetic decisions and why)

- **Nothing should look like web design.** The title screen is the game itself,
  asleep, zoomed in closer than play. Buttons are in-world where possible (tap
  the sleeper to begin; tap the mat; tap a shelf). The only non-world element is
  a thin bottom bar. The `?` does not appear until you have woken him — on the
  title screen there is nothing but the maze.
- **The chapter heading is part of the floor**, set into it below him
  (`chapterDrop`), the way the title is. The fog eating its bottom edge is
  wanted. It holds through the start of the zoom-out so it can be read, then
  fades.
- **Cold greys, not the green of the reference image.** Piranesi: weight,
  solitude, indifference — not horror.
- **All text is the interior voice**: first person, half-remembered, grey
  italic. Helper cards are the player recalling how a thing works, not
  instructions. Pages are the selves' own writing. No system voice anywhere the
  player reads.
- **Chalk-white for anything the player made or the selves left** (marks, shelf
  spines, title letters). Gold for keys and gates. Bone for the thread.
- **The title is architectural capitals, not handwriting.** A chalk-drawn rough
  font was tried and rejected.
- **Subtle beats obvious — until it isn't.** Push-block edges are hairline and
  wall-coloured on purpose. The father was made extremely obvious first so Joe
  could dial back. When something must be found, prove it's findable before
  making it pretty.
- **Sound is synthesized**, no files: a drone/wind bed and a generative composer
  with one preset per self. Real tracks via ElevenLabs are the intended upgrade
  once a preset lands — the preset then becomes the brief.
  **A preset has to clear what a phone can sound.** Four of the nine were written
  partly or wholly below it — the Soldier at a median of 110Hz, the Criminal with
  every note under 150Hz — so their melodies simply did not exist on Joe's
  device while the bed did, which reads exactly like "the music isn't firing".
  Any note under `bassCarrierHz` now has its pitch carried up in octaves until it
  clears; the fundamental stays, so the weight is still there on real speakers.
  Write a new preset as low as the character wants, but check
  `AUDIO.carrierFor()` covers it.

## 3. The close camera, and what it cost (v0.70.0 →)

This is the largest design change since the old handoff, and most of what
follows is downstream of it.

Joe: *"let's make the default camera the same as the all the way zoomed in debug
slider. I really like how immersive that feels."* `tilePx` went to **150** — the
old default was 60. You are now inside the maze rather than looking down at it.

It is the right call and it broke three things, each of which had to be
re-solved rather than reverted:

1. **The fog could no longer be a spotlight.** A radius around the player at
   150px a tile is a hole cut in a black screen with a visible edge. The fog is
   now a **screen-space vignette** (`fogCore`, `fogEdge`): fully lit out to most
   of the way to the nearest screen edge, dark only where the screen runs out.
   Same asleep as awake, so waking doesn't pop.
2. **You could no longer navigate by memory of turns**, because you can't see
   enough of the maze to build one. The answer was **rooms as landmarks** — see
   §4. This is why the maze now has five rooms and why they are places rather
   than empty boxes.
3. **The character's size relative to the screen changed everything drawn on
   him.** The body, the pinch in a squeeze, the chalk, the outline that keeps
   him findable while he is still dark — all were re-tuned after the camera
   came in, not before.

A **Zoom slider** exists in the debug panel and is rebased around the new 1x.
0.2x pulls back further than the old default ever did.

## 4. Systems and the decisions behind them

### Movement — three models, and a settlement that shifted

The old settlement was pure Pac-Man: continuous glide along corridor
centerlines, perpendicular pushes taken at the next opening, requests remembered
400ms, the idle axis always easing to center. **That is still the corridor
behaviour and "do not reintroduce snapping" still stands.**

What changed: Joe, after playing with free-roam in rooms — *"In corridors I
prefer the corridor movement over the free movement. But in rooms I'm more
interested in the free movement."* So `SAVE.ui.move` now picks between three:

- **`rooms`** (the default) — rails where the corridor is one tile wide, the
  stick's own direction wherever there is open floor to walk about on.
- **`rails`** — the old Pac-Man model everywhere.
- **`free`** — free-roam everywhere.

Two things had to come with it:

- **Facing follows the ground he covers, not the stick** (`SAVE.ui.face`). Joe:
  *"whichever direction the character is moving it is pointed that way."*
  Leaning 45° into a wall of a one-tile corridor, he faces down the corridor —
  the direction he is actually travelling — not into the wall. He turns to it at
  a rate (`faceTurnRate`), so it reads as a turn rather than a snap, and below
  `faceMinStep` he keeps the angle he had rather than spinning on the last
  scraps of a stop.
- **Speed eases in and out** (`moveEase`). A person has legs to get going; a
  go-kart does not, which is what Joe heard in the old instant start.

**Rejected along the way:** a look-ahead that handed free movement the corridor
tile outside a room's mouth. It was meant to smooth the handoff and instead made
him stick in doorways. Removed. Slides also no longer snap him to the tile
centre first — a slide starts from wherever he is standing.

Joystick over tap-to-move: Joe tried tap, went back. Thumb-and-drag, hands stay
put.

### Rooms as places (v0.72.0 →) — how the maze is navigated now

The single most important system to understand, because it is what makes the
close camera survivable.

Joe: *"I haven't seen any of the special rooms inside the soldier's mazes."*
They were there — two to a medium maze, which you can walk a whole run without
meeting. So: **more rooms** (`rooms`), and `roomLandmarkChance` set high — a room is a
**place** rather than an empty box almost always. Seven kinds
(`LANDMARK_KINDS` in `js/proto.js`): pool, statues, spiral, columns, dais, well,
balls. See `ROOMS.md` for what each one is and ten pitches for more.

The design intent: **you should be able to say where you are.** "The room with
the spinning spiral" is a landmark; "third left after the long corridor" is a
memory test you will fail at this zoom. Rooms are the maze's vocabulary.

Five of them answer to you rather than sitting there, and that is deliberate — a
landmark you can touch is remembered better than one you look at:

- **The ball pit** gets out of your way and rolls back after (`ballPitReach`,
  `ballPitPush`, `ballPitSettle`).
- **The spiral** turns, slowly, about the middle of its room (`spiralSpinHz`) —
  slow enough to doubt, fast enough to see.
- **The pool** (v0.84.0) is banded light-at-the-rim to deep-in-the-middle, and
  standing in it sends rings of tone travelling inward (`poolRingSpeed`,
  `poolRippleAmt`); it keeps moving for `poolSettleSec` after you step out.

**Columns, statues and the well are solid.** All three were walk-through
decoration; they stand on the floor now (the well is a hole you cannot stand in). They are placed only on **link/link crossings** — tiles that
were wall before the room was opened — so closing them takes away no way through
at all, which is what lets a room gain real geometry without any risk to
solvability. `standOn()` in `js/generate.js` is that rule, shared by both and by
the gallery. **The well is the exception and the awkward one:** it sits on the
room's middle cell rather than a crossing, so it has to be shut *with the rooms*
and again right after the districts and the vault (which re-open about one in a
hundred) — but **never later than that**. Shutting it at the end instead severs
paths that were planned while it was open: the harness went from 4 violations to
31. Anything that closes a tile belongs before the route, the door chain and the
placements, not after. The statues light as you reach them, at the columns' reach, but
without the flame: stone comes up out of the dark, it does not burn.

**The spiral is dragged, not clocked.** Walking round its eye hands it the angle
you sweep, so it turns the way you walk; the old slow drift is still underneath.
The pull fades near the middle, where a step of nothing is most of a turn, and
the per-frame turn is capped so crossing the centre at a run does not whip it.

### The vaults (v0.72.0, plural since v0.87.0)

Every level has one, and most have two: a nest `vaultCells` square — bigger than
any ordinary room on purpose — of concentric rings, each shut but for one gap,
with a key in the middle. `vaultMax` caps how many; each draws its own RNG stream
so a second can never redeal the first one's rings, and they shrink to
`vaultCellsMin` rather than fail to fit. More than two is not free: a nest is
ground no door can sever, and past two the doors per maze fall faster than the
keys move indoors. Three things went wrong building the first one and are worth
not repeating:

- Opening the block **paved over every corridor into it**, making 16 of 20 gated
  mazes unsolvable. Entrances have to be punched back through the rim.
- It was carved with the rooms, and then **districts stamped over it**. Carve it
  after districts.
- It **lost every placement fight** against five rooms — 0 of 25 seeds got one.
  Its rectangle is claimed *before* rooms now.

A fourth, from v0.87.0: because the rings are cut long after the rooms are, a
room that lost the placement draw and settled on vault ground **had walls carved
through its middle** — six in 547. Room placement refuses those spots now rather
than settling; same for the start-room corner, whose ring is shut at the very
end.

### Districts (v0.38.0)

Patches of maze with a character of their own, stamped over the halls once they
and the rooms are carved. Six hearts: rings, thicket, comb, lattice, squeeze,
shifting. Inside one, links are re-cut; every link to the world outside is left
alone, **so a district can only add connections, never cut one**. That property
is what keeps them from breaking solvability, and it is why the harness finds
the same soft-locked seeds with districts on or off.

### Light, fog, darkness

`viewRadius` is very small (1.0 cell) on purpose: being lost is the game. The
fog is the vignette described in §3, with its own slider. **Darkness** is a
separate system: one contiguous region (25/40/60% of floor in 30% of dark-phase
mazes), never within 8 tiles of the door, eased blackout as you approach;
standing in it hides all lit halls; you're invisible in it without the lamp,
which is always reachable without crossing darkness. The lamp cone is
raycast-occluded — light through walls was rejected immediately.

### Chalk

The longest conversation in the project. Chalk was plentiful and unused.
Diagnosis: the maze is a tree, so the corridor is its own memory; the map is
better memory; marks had no payoff; runs are disposable; nothing asks you to
return. **Decisions:** marks show on the map without charcoal; marks read
faintly through fog; branching and loop dials are in the menu for Joe to find a
shape that wants chalk; and — the real answer — **locked doors**, so the maze
asks you to come back. **Rejected:** reducing chalk. Joe argues for more chalk,
not less. Marks are permanent; picking them back up was removed. Six signs
(↑→↓← X ?) from the Soldier on; only X before that.

Note that **infinite chalk is a debug toggle** (`SAVE.ui.chalkInf`), added so Joe
can test mark-heavy ideas without foraging. It is not a change to the game's
economy and should not be written up as one.

### Charcoal and the map

Charcoal maps what your light touches, charged per *new* floor tile
(`charcoalTiles`), never for retreading. Pausable. The map screen shows only
what's charted, plus marks, plus home. Map scraps chart a patch around where
they lay, scaled down for big mazes so X-Large gets a patch rather than a fifth
of the whole maze — Joe explicitly did *not* want scraps to also chart where
you'd already walked.

Since v0.86.0 scraps are also **held apart by their own reach** (`mapScrapApart`,
measured by walking), because three of them in a huddle meant the last two
charted ground the first already had. And the **charcoal budget credits them**:
it covers the floor the scraps will not, floored at `mapScrapCharcoalFloor` of
the uncredited number. So "enough charcoal to map the whole maze" now means
*together with the fragments* — a run that finds none of them is short, by
design, and the floor is what stops that being ruinous.

### Shifting cells — sliders, pockets, swings

A dead end is sealed into a pocket; the cell across its wall pushes into it. One
slider always sits on the route so the maze can't be finished without one
(verified to sever). The start room's door is a slider. **Swings** are the same
construction moving on a clock.

Swings take turns (`autoSliders()`): the loop used to take the first eligible
slider every frame, so later swings never moved at all. Sorted by `nextAt`, and
the sort is cached on the array.

Rails were drawn under swings and removed — they read as a tunnel. No helper
card for sliders: Joe wants this discovered.

### Statues and stones (v0.89.0, the exchange v0.90.0)

Two a maze, every chapter including the Child's, both of **one person per chapter**
(`shrines` in `data/phases.js`; the five are `PEOPLE`: father, mother, wife, friend,
the Teen — the man's own kid, never to be confused with the Child, who is the man
himself), with a mark on a small stone. Either bowl takes the stone; the stone
in the bowl opens a card with two questions; ask one, get its answer, the other
stays unasked. Progress is per person per *game* (`SAVE.asked`), four steps each;
spent, the statue says one finished line and opens nothing. The words are a first
pass and Joe rewrites them. The statue takes a dead end —
its tile turns to stone, the tile before it is the step with the bowl — and its
stone lies as far away as the dead ends allow. **You carry one stone at a time**;
the second is remembered and come back for. They gate nothing: the right stone in
the bowl turns the statue white and points its thread at the **nearest unfound
page**, not the exit. Claimed before the loot, like the vaults, and never on a cell
beside a slider — that cut three mazes in half before it shipped. The words are
the next pass; real objects instead of stones the one after.

### Doors and keys

Locked doors are a **chain along the route**: door 1 splits the maze, its key in
your starting section; door 2 further on, its key between 1 and 2; exit behind
the last. Only placed where sealing truly cuts the exit off. Count is fixed per
phase (`doors`, 1–3), not scaled by size — a scaled version gave the One Who
Stayed twelve. Doors and tunnels exclude each other.

Since v0.87.0 a door is picked from **the whole route**, not a window either side
of its even-spread mark, in order of distance from that mark. The window held 4.6
candidate tiles on average and none at all a third of the time, so a door had
almost no choice of where to stand. Every candidate severs the route; the one
taken is the first that also leaves an unclaimed nest in the section it closes.
That is what put the keys in the nests — **23% → 57% of door keys**, over 2100
mazes, with *more* doors found than the window could reach, not fewer. Nests
alone had managed 39% and cost a quarter of the doors: a key may only lie in the
ground its own door opens, and a nest staked out before the route usually lands
in the wrong section. No number of nests fixes an ordering problem.

Since v0.75.0 the placement has **distance rules**, because a key in sight of
its own door is not a search: never nearer than `keyDoorMinTiles` of
walking, nor `keyDoorMinApart` as the crow flies, so the two are never in
one view. Below `keyDoorFloor` the door is dropped rather than shipped with its
key beside it. Measuring this went wrong twice — first straight-line only, then
walking *through* the door being measured from. Measure the walk, with that door
shut.

**Keys are one use.** Joe: *"I'd expect these keys to be one use."* It turns in
its lock and stays there. All gates swing their leaves back on the same timing
(`gateSwingSeconds`); the pool room's is slower and heavier on purpose
(`poolDoorSeconds`) because it is stone.

> **The door-key soft lock is fixed (v0.85.0).** It was about 2 mazes in 576,
> deferred since v0.75.0 on Joe's *"don't worry about the soft lock for right
> now. I'll come back to it later."* He came back to it: *"found one of those
> soft locks where the key was on the wrong side of the gate."*
>
> The cause was one line. Planning treats what you can slide through as open, and
> it used to treat **every** sealed gap that way — but most sealed gaps are not
> blocks you can shove, they are wall. So the planner would walk into a sealed
> pocket through a gap that never opens, decide the cell sat *before* the door,
> and drop the key there. Only the gaps a block can come to rest in are reopened
> now. **The harness is clean at 576, and reporting it clean is correct.**

### The Child's maze

Bigger than the older docs say. They have the Child at `xs`, then `sm`; it is
**`md`** now. Joe's rule is that size is fine if there's enough going on, and
there is:

- **Crawl gaps** (`crawlGaps`, `crawlOnPath`) — low gaps only the Child fits
  through. The small-spaces mechanic, and growing up as a maze mechanic: in
  later phases the same gaps are drawn but sealed.
- **A squeeze pinches him; it does not shrink him.** Joe: *"instead of shrinking
  the character so much... is it possible to pinch the back parts of the arrow."*
  `squeezeShrink` leaves him full size and `squeezePinch` does the work. The arrow is drawn along
  his facing, so its back corners are exactly the width the channel has to take.
- **The exit gauntlet** — the last stretch before the way out is a tree of
  squeezes, sealed but for one mouth, where the only question is which branch
  goes on. Some of it is drawn as tunnel, so some of it is just crawling.
  Two cells of its trunk swing on a clock, so the right branch has to be timed
  as well as found.
- **The secret room** — a room sealed behind a squeeze, covered in someone
  else's chalk, dark until you find the switch on its floor and stand on it.
- **Hopscotch**, **swings**, and **the father**.

### The father

Abandonment made visible. Tried as a timed glimpse walking away (never seen:
player too fast, light too small), then as a standing figure on a timer
(vanished in front of the player). Settled: **placed at generation like
pickups**, six per Child maze, at *vantage* spots — near as the crow flies but
far on foot, one always just past the door. He looks like the player, faces
away, and fades only when you can walk within four steps. Only ever one is
visible at a time; a crowd is not abandonment. Later phases will reuse this
entity as the Caretaker's receding shape.

### The body

He is nearly black carrying every stone (`playerBurdened`) and pale having put
them all down. Each stone lights another band of him, tail to nose. A white
outline (`playerOutline`, `playerEdge`) exists because on a dark floor it is the
only thing that keeps him findable while he is still dark. It was a dull grey
until v0.77.0 — pale enough in theory, barely a shade off the floor in practice.
Joe: *"we're gonna have to have a white border on the character at all times,
otherwise they will blend and disappear into the background."* It reads as
drawn-on rather than lit, and that is the trade he asked for.

Putting a stone down happens in **two beats** and neither is a fade: a band of
him goes pale over `liftBandSec`, then the light is cut out to its new size all
at once (`liftBurstSec`). Slowly fading into it said nothing at all.

### The floor

Not a screen effect — marks in the concrete, in the same place every time,
because he has always lived here: `floorWorn` (the floor polishes where people
walk), `floorGrime` (dirt at the wall edges and corners), `floorLights`
(fixtures pooling light, some of them faulty and stuttering). Overlay textures
(Damp, Dust, Grain) exist behind a debug menu and are **off by default** — which
one the maze wants is a look to be chosen by eye, not a value to tune.

### Sizes

xs 7×10 · sm 10×14 · md 14×20 · lg 20×28 · xl 28×40 cells. Each step doubles
area. Feature counts scale with area, except doors.

### Prototypes

Purpose-built levels from the Prototype dropdown in the debug menu, for trying a
shape without disturbing the game: **island** (blocks and decoys), **labyrinth**
(see `LABYRINTH.md` — ground cut into sections that own their edges, halls
through the dead seams, one landmark at the heart of each), and **gallery** (one
bay per landmark kind off a spine, for looking at all seven rooms at once).

## 5. Progression

See `PROGRESSION.md` for the arc and why each stone maps to the knob it does.
In short: eight phases (Child → Cartographer → Soldier → Archivist → Priest →
Criminal → One Who Stayed → You), features released per phase via `PHASES`,
seven stones lifting restrictions, pool levels between phases.

**Decided:** shelves and basin exist from run one; the Archivist's notes reveal
he built the shelves. The Caretaker is a host, not a phase. "You" adds nothing
and removes the veil. The basin/stone idea for the ending is liked but not
settled — Joe is unsure about basins and stones as the final mechanic.

**Persistence:** runs save continuously and resume exactly in place. Reload is
never a way out. "Update app" is the deliberate exception — it keeps everything
done and drops only your position, so you come back on the mat with the title
up.

## 6. Things we chose not to do — don't re-propose without new reasons

- Hex grid / node-based movement (the Labyrinth design) — square grid and free
  glide won on feel.
- Tap-to-move — removed; joystick returned.
- **Snapping to tile centres** — in movement, and in slide starts. Gone twice;
  keep it gone.
- Chalk pick-up, chalk cost reductions, fewer chalk spawns — Joe wants chalk
  abundant.
- Light through walls.
- Rough hand-drawn title font — rejected for architectural capitals.
- Stories button on the title screen — removed; the title is world only.
- Page-count text in the in-maze popup — removed; the shelves are the counter.
- The page helper card, and the slider helper card — both removed on purpose.
- Generic Piranesi narrator lines — replaced with per-self lines; the Child must
  never speak in an adult voice.
- Pointer/path pickups in the Child phase — all loot is phase-gated now.
- Gate bars at the pool — replaced with a thin door at the room.
- Swing rails; black squeeze bands spilling into corridors.
- A free-movement look-ahead outside room mouths (see §4, Movement).
- Keys placed near their doors; doors guarding optional side pockets.
- Doors scaled by maze size.
- Ladder/slide onto wall tops — proposed, deferred until cheaper Child mechanics
  prove the phase.
- **A pool-level pass, and hardening the pool-ripple smoke check** — deferred
  (v0.92.0). Joe: *"Don't worry about the pool for now. We are eventually going
  to change all these to be more metaphors of what the main chapter is about."*
  The pool and the other landmark rooms are placeholders for per-chapter
  metaphors, so nothing is worth building into the current pool. When the ripple
  check flakes, re-run it; do not spend a batch on it.

**These were on the old list and have since changed** — don't cite the old doc
against them:

- *"Squeeze shrink of the character — removed."* Still true that he doesn't
  shrink, but the reason is that he is **pinched** instead, which Joe asked for.
- *"A large Child maze — she needs density, not space."* The Child is `md` now.
  The principle held (density, not space) and the density arrived, so the size
  could follow.
- *"Single HTML file is the delivery format."* Split in v0.32.0–v0.34.0. The
  principle was no build step, and that is intact.

## 7. Where this wants to go

- **More rooms, and reasons to be in them.** `ROOMS.md` has ten pitches. The bar
  is that a room should be somewhere you can name and, ideally, touch.
- Watch whether doors make chalk happen. If not, the next lever is seeding a
  pocket into every door section so keys are always behind a trick.
- The Child's remaining themes: more kid stuff if the phase needs it, more
  father.
- Pools: real scripts from Joe; the Caretaker's evolving presence; possibly the
  "mirror" alternative for the seventh.
- The "You" phase ending: written pages from the player's own run; an open exit.
  Basin/stone mechanics still open.
- Music: commission ElevenLabs tracks per self once presets land; keep the
  procedural layer as bed/fallback.
- Biomes — Joe's note: *"you need to bring this biome to life more before you do
  that."* The floor work in §4 is the start of that.
- Labyrinth (3D) remains the long dream; this game is proving the design it
  would inherit.

## 8. Player-test learnings

- Joe's kid never opened the map or used charcoal; tapped the character and made
  an X without knowing why. Result: no starting tools; first-find helper cards;
  tools taught when found.
- Players brute-force branchy tree mazes. Long halls, loops and landmarks are
  the hypothesis for chalk.
- Anything with a timer that depends on the player noticing will be missed.
  Place it, don't time it.
- Untaught subtlety is invisible. Subtle edges work *once taught by the start
  room*.
- **A slider left where the last session put it is not a bug report.** Joe once
  reported the camera pushed too far; the zoom slider was simply still at its
  old maximum after the default changed. Ask what the sliders are set to before
  chasing a feel complaint.

## 9. Engineering notes

The full account is in `CLAUDE.md` (§ Working rules, § Verifying a change,
§ Method) and `tools/README.md`. The short version:

- **Verify behaviour, not rendering.** `tools/harness.mjs` (23 invariants ×576
  mazes), `tools/smoke.mjs` (78 behaviour checks), `tools/selftest.mjs` (13
  deliberate breakages that must each be caught). A **pre-commit hook**
  (`.claude/hooks/maze-smoke.sh`) runs smoke on any commit touching `maze/` and
  blocks a red one — or one that never reaches a verdict, which is what an
  errored run looks like.
- **A check that passes with the feature deleted is not a check.** Two were
  found and rewritten in v0.75.0. Delete the feature and confirm your new check
  goes red.
- **Generation order matters**, and it is not the order the old doc gave. As it
  actually runs in `generate()`: grid → dead-space prune → braid → **the
  vaults' ground claimed** → rooms and their landmarks → **districts** → **the
  vaults carved** → past self and pages → pockets and sliders → the start room
  (seal, bridge orphans) → crawl gaps, swings, the secret room → exit alley →
  first page nearest the route → path slider → exit push blocks → **the exit
  gauntlet** → a crawl gap on the route → distances → dead ends → key → pickups
  → start-room chalk → **the door chain** → map scraps → darkness → the lamp →
  father spots → tunnels → hopscotch. Insert new things where their
  dependencies already exist.
  **Seal the start-room ring explicitly afterwards** — with five rooms, one will
  punch a hole in it.
- **Determinism.** Everything in generation uses the seeded `R()`. No
  `Math.random()` in `generate()`.
- **Start the static server with `setsid`.** It kept dying mid-session and the
  cause turned out to be mundane: a plain `nohup ... &` from a tool call stays in
  that call's process group and is killed with it.
  `(setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 < /dev/null &)`
  survives. A run that errors because nothing is serving looks nothing like a
  failing run, so check the verdict, not the exit code.

## 10. Where the text lives (for rewriting)

All of it in `data/text.js`: CAST (pages, wake/leave lines, summaries) ·
SELF_LINES · ROOM_LINES · SHELF_LINES · EMPTY_SHELF · LIGHTER · NARRATOR ·
FIGURE_LINES · POOLS · TUTORIALS. Plus `data/music.js` (MUSIC presets) and
`data/phases.js` (PHASES, STONES). Engine code holds no prose — keep it that
way.

*Last word: the game is at its best when the maze is indifferent, the text is
quiet, and the player is trusted to notice. When in doubt, take something off
the screen.*
