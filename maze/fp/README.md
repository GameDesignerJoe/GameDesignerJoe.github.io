# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`) unchanged, then these three:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code, as three looks: **office** (the default — yellow wallpaper, damp carpet, a drop ceiling with fluorescent panels, an EXIT sign), **bleached** (lime plaster with a meander frieze, marble, pilasters, travertine, white haze, a doorway onto the sea) and **dusk** (brick, flagstones, stars) |
| `fp.js` | the raycaster, the walk (a stick like the top-down's, plus tap/swipe/key steps), the debug map, the panel |

- **A seed is the same maze in both views.** `?seed=1234` works here as it does top-down.
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`.
- **Two ways to move, one position.** The stick, by default, is the top-down's model: *rails in halls*
  (centred, facing one of four ways; a lean is a buffered turn taken at the next opening; bends with one
  way on are followed; walls stop you mid-tile) and *free in rooms* (a round body that slides off corners).
  Taps, swipes and keys glide you to the next tile centre or quarter turn from wherever you are.
- **A look can have a ceiling instead of a sky** (`ceils`/`ceilPick` in its theme). Corner shadows
  (`ao`) are laid on from the maze by the renderer, on floors, ceilings and walls, so they need no art.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into a theme in `TEX.themes` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, crawl gaps (a low timber lintel you walk
  under), the exit, which glows through the fog, and a ceiling where the look has one. Not yet: sliders, doors and keys, pages,
  chalk, darkness, the charcoal map.
