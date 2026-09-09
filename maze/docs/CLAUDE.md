# The Maze — orientation

Read this first. It tells you what is actually in this folder, how it relates
to the design docs beside it, and where the two disagree.

## Two things share this folder

**`../maze-topdown.html` — the playable prototype.** A 2D, top-down maze in a
single self-contained HTML file: canvas rendering, no build step, no
dependencies. Mobile-first (safe-area insets, standalone PWA meta, a
swappable-side virtual stick). Title screen reads "THE MAZE". Roughly thirty
commits of steady feature layering: push blocks, map, darkness, progression,
doors and locks, keys.

**`01`–`06` — the Labyrinth design docs.** The larger game this prototype is
exploring toward: first-person, node-based, hex-grid, real 3D (Three.js), with
a remnant-based narrative where every past traveler is a prior life of the
player. Imported from Joe's Drive folder on 2026-09-09. They are the design
record; they are not a description of the file above.

The prototype and the docs share a vocabulary — chalk, charcoal, signs, dead-end
pickups, darkness and the lamp, "the only way out is through" — but they are
different artifacts at different stages. Do not assume a feature in the docs
exists in the prototype, or vice versa.

## What's not here

The 3D work the docs describe (the slider hallway, the hub-loop prototype) is
**not in this repository**. It lived in a separate chat and on Vercel. Don't go
looking for a Three.js scene in this repo; there isn't one.

## The docs

| File | What it is |
| --- | --- |
| `01-vision-and-narrative.md` | Why the game exists. The cast, the Caretaker, burdens, tone. Read this before touching anything narrative. |
| `02-game-design.md` | Systems: hex grid, biomes, tools and charges, chalk legend, manual map, puzzles, UI, controls, audio. |
| `03-technical-design.md` | Stack, architecture, the dumb-box geometry rule, `labyrinth.config.json`, asset pipeline. |
| `04-prototype-log.md` | What was tried and what failed. **Read this before proposing an approach** — several dead ends are documented so they aren't repeated. |
| `05-roadmap.md` | Phased milestones, standalone tools, parking lot, naming candidates. |
| `06-build-handoff.md` | The other chat's CLAUDE.md for the 3D production build. Kept verbatim. See the note below about why it lives here and not at the repo root. |

## About `06-build-handoff.md`

It opens with "Drop this into the repo root as CLAUDE.md." Don't. That doc
describes a React + Vite + TypeScript + Three.js project deployed to Vercel.
This repository is a flat static GitHub Pages site — many small projects, no
build step, `main` is what's served. A root-level CLAUDE.md written for a
Vite/TS game would mislead every session that touches the portfolio or any
other project here. Project docs in this repo live in `<project>/docs/`
(see `cartographer/docs/`, `killcode/docs/`, `tidy-adventures/docs/`), so
that is where it sits.

Its stack section is specific to the 3D build. Its working rules are not, and
they apply to work on the prototype too:

- Everything tunable lives in config, never hardcoded. The prototype already
  does this — see the `CONFIG` block near the top of `maze-topdown.html`; the
  comments there are design intent, not just values.
- Ask before building when a spec is ambiguous; make reasonable calls on minor
  details and say what you assumed.
- Own bugs openly. Say what broke and why.

## Where the prototype and the docs disagree

Flagged, not resolved — these are Joe's calls.

- **Input.** The docs say "tap zones, not joysticks" for mobile. The prototype
  uses a virtual stick with glide-and-turn-at-the-next-opening steering, and a
  lot of tuning has gone into it (`speed`, `turnBufferMs`, `turnForgiveness`,
  `stickDeadzone`). Which wins for the 2D game is open.
- **Grid.** Docs: hex, six exits. Prototype: square grid, four directions.
- **Map.** Docs: manual cartography, nothing auto-revealed. Prototype: charcoal
  draws the map *as you walk* while it lasts — a different tradeoff.

## Running the prototype

```
python -m http.server 8000
```
→ http://localhost:8000/maze/maze-topdown.html

It works over `file://` too (no modules, no fetch), but the server matches how
the rest of the repo is run. `?seed=1234` replays a specific maze.

## Repo facts that bite

- **GitHub Pages serves `main`.** A commit on any other branch is on GitHub
  but not on the live site.
- **`../Index.html` is a one-byte stub with a capital I.** Pages looks for
  lowercase `index.html`, so `/maze/` does not resolve to the game. Link to
  `maze/maze-topdown.html` by its full name (the front-page tile does).
- The root `service-worker.js` is network-first as of 2026-09-09. Before that
  it served `index.html` cache-first forever, which is why the front page
  looked permanently stale on phones. If the portfolio page ever looks stale
  again, start there.

## Source of truth

The Drive folder is where Joe edits these docs. This copy is a snapshot so a
session can read them without Drive access. If the two drift, Drive wins;
re-import rather than editing the design docs here.
