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
├── maze-topdown.html   the engine — canvas, input, generation, render
├── data/               tuning and text; see data/README.md
│   ├── config.js         SIZES, CONFIG
│   ├── phases.js         PHASES, STONES
│   ├── text.js           every line the player reads
│   └── music.js          MUSIC
├── docs/               this folder
└── tools/              the verification pass; see tools/README.md
```

The data files load as plain `<script src>` before the engine, so they are the
same consts the game has always had. **No build step, no modules, no fetch** —
the game still opens straight off the filesystem. They are `.js` and not
`.json` because `CONFIG`'s comments are design intent and JSON cannot hold
them.

Split in v0.32.0. Generation is bit-identical across it: the harness finds the
same 10 soft-locked seeds before and after.

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
  reload is never a way out.
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

**Known open bug:** roughly 1.4% of mazes with locked doors are unfinishable —
a door's key can land in a sealed pocket behind that same door. Reproduce with
`node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7`.

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
