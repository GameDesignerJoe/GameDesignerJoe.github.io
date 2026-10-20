# The Maze — engine

The game, in the order it runs. These are plain `<script src>` files sharing one
global scope — the same code that used to be one long `<script>` block in
`maze-topdown.html`, cut along the section dividers that were already in it.

**Load order is load-bearing.** 52 statements run at parse time, and a statement
cannot reach forward to something not yet defined. The order below is the order
the code used to appear in, so every statement sees exactly what it always saw.
`tools/smoke.mjs` asserts the sequence; don't reorder the tags in the shell, and
add a new file where its code would have gone.

| File | | What's in it |
| --- | ---: | --- |
| `core.js` | 1.8 KB | `VERSION`, the save file, the seed. `phase()`, `has()`, `B` |
| `generate.js` | 34 KB | the maze itself — grid, rooms, pockets and sliders, the start room, crawl gaps, the route, doors and keys, darkness, every placement. **Read HANDOFF §9 before editing: generation order matters** |
| `audio.js` | 11.5 KB | the drone bed and the generative composer, one preset per self |
| `state.js` | 8.1 KB | run state, the debug panel, hard refresh |
| `input.js` | 5.4 KB | the stick, chalk, charcoal, lamp, gear |
| `stories.js` | 2.3 KB | the reader for pages already found |
| `run-save.js` | 4.3 KB | a run in progress, restored exactly where you left it |
| `tutorials.js` | 4.1 KB | the first-find helper cards |
| `pool.js` | 1.7 KB | the water between phases |
| `map.js` | 9.9 KB | the charcoal map, panning and zooming |
| `movement.js` | 17 KB | the Pac-Man glide, buffered turns, sliders, pickups. **Do not reintroduce snapping** (HANDOFF §3) |
| `render.js` | 25.6 KB | every frame: floor, walls, fog, the lamp cone, marks, HUD |
| `boot.js` | 0.6 KB | the frame loop, resume-or-reset, and go |

Tuning and text are not here — they're in `../data/`, loaded first.
`maze-topdown.html` is now just the CSS, the markup and the script tags.

## Working on this

- No build step, no modules, no bundler. Edit a file, refresh.
- It still opens straight off the filesystem; nothing here uses `fetch` or
  `import`.
- New tunables go in `data/config.js`, new player-facing text in
  `data/text.js` — never inline. That rule is why the data files exist.
- After any change: `node maze/tools/harness.mjs` and
  `node maze/tools/smoke.mjs`. HANDOFF §9 is emphatic about this, and it caught
  a real soft-lock the first time it ran.
