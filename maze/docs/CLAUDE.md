# The Maze — read this first

**The game is the source of truth.** `../maze-topdown.html` outranks every
document in this folder, including this one. When a doc and the game disagree,
the game is right and the doc is history or inspiration. Fix the doc to match
the game; never change the game to match a doc.

## What the game is — from the source, not the docs

A 2D, top-down maze in one self-contained HTML file: canvas rendering, no build
step, no dependencies. Mobile-first and shipped as a PWA. Everything below is
read from the code.

- **Eight selves, one maze each.** `PHASES` — The Child, The Cartographer, The
  Soldier, The Archivist, The Priest, The Criminal, The One Who Stayed, You.
  Each phase sets the maze size and which tools and hazards exist (`f: {…}`):
  signs, charcoal, compass, thread, scraps, lamp, darkness, gate, tunnels,
  pockets, path sliders, doors, crawl gaps, the swing, hopscotch, the figure.
- **Seven stones, the burdens.** `STONES` — Sight, Pace, Memory, Fear,
  Direction, Shame, Scale. Setting one down permanently lifts a restriction,
  through `B` (burden-adjusted values): view radius, speed, charcoal length,
  darkness, pointer time, key chance.
- **The pools, between phases.** `POOLS` — the Caretaker hosts; one person who
  loves you per stone: Father (Sight), Wife (Pace), Brother (Memory), Daughter
  (Fear), Father again (Direction), Oldest friend (Shame), Wife again (Scale). Written branching dialogue: they speak, you choose, they
  answer; then you set the stone in the water.
- **A narrator per self**, in that self's voice. The Child's lines are lowercase
  and misspelled on purpose ("the man said wait here." / "but i didnt.").
- **The figure** (`figure: true` on the Child) is the man walking away — the
  Dad spawns in Joe's notes.
- **Progress persists** in `SAVE`, written to `localStorage` under
  `maze.save.v1` (`phase`, `stones`, collected books, played narration…), so a
  run carries across sessions on the same device.
- **`VERSION`** (a constant near the top, shown on the title bar) is how to
  tell which build is on the phone.
- **`CONFIG`** near the top is every tunable. Its comments are design intent,
  not just values — read them before changing anything. `?seed=1234` replays a
  maze.

## The docs in this folder

**`NOTES.md` — Joe's working notes.** The list at the top is the real backlog.
The rest is thoughts, ideas, and the narrative spine. This is a snapshot; the
Drive doc is live and Joe edits it from his phone. When they differ, Drive is
newer — but the game still wins over both.

**`01`–`06` — the Labyrinth docs.** Written for a *different project*: a
first-person, hex-grid, Three.js game meant for a React/Vite/TypeScript build
on Vercel. Keep them for reference and inspiration; that is what they are for.

The narrative frame was carried from those docs into this game wholesale — the
cast in `01` is the `PHASES` array, burdens became the stones, the Caretaker
hosts the pools, "the tall shape that recedes" is the figure. So `01` is the
best account of *why* the game is shaped the way it is.

The mechanics and stack in those docs were **not** carried over and should not
be: hex grid, first-person camera, tap zones instead of a stick, Three.js,
Vite. Do not port anything into the maze because a Labyrinth doc says so.
`06` asks to be placed at the repo root as CLAUDE.md; it describes that other
stack, so it stays here.

## Working rules

- Every tunable lives in `CONFIG`. Never hardcode a value that a designer would
  want to change. The game already does this — keep it so.
- Ask before building when a spec is ambiguous. Make reasonable calls on minor
  details and say what you assumed.
- Own bugs openly. Say what broke and why; don't silently patch.
- Joe tests on his phone. A change isn't done until it works there.

## Running it

```
python -m http.server 8000
```
→ http://localhost:8000/maze/maze-topdown.html

## Repo facts that bite

- **GitHub Pages serves `main`.** A commit on another branch is on GitHub but
  not on the live site.
- **`../Index.html` is a one-byte stub with a capital I**, so `/maze/` does not
  resolve to the game. Link to `maze/maze-topdown.html` by its full name (the
  front-page tile does).
- The root `service-worker.js` is network-first as of 2026-09-09. Before that
  it served `index.html` cache-first forever, which is why the front page looked
  permanently stale on phones. If that ever recurs, start there.
- Other projects in this repo keep their docs in `<project>/docs/` too
  (`cartographer/`, `killcode/`, `tidy-adventures/`). Same convention here.
