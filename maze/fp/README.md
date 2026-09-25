# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`) unchanged, then these three:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code from a fixed palette: six walls, four floors, the lit exit, the crawl-gap timber, a 1536-wide dusk sky |
| `fp.js` | the raycaster, the tile-step walk, touch and keys, the debug map, the panel |

- **A seed is the same maze in both views.** `?seed=1234` works here as it does top-down.
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into `TEX` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, crawl gaps (a low timber lintel you walk
  under), and the exit, which glows through the fog. Not yet: sliders, doors and keys, pages,
  chalk, darkness, the charcoal map.
