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
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`. The ☰ panel is in
  sections — Look, Stick, Glide help, Taps/swipes/keys, Debug — each slider's range and section in `FP_RANGES`.
- **Two ways to move, one position.** The stick has three modes. **Glide** (the default) is free
  steering with quiet help, each with its own knob under Glide help on the panel, never a snap: it settles you square to
  an open way when you ease off the turn, drifts you to the middle of a one-wide hall, and two
  "whiskers" slip you sideways past a corner one of them touches. **Rails** is the top-down's model
  (buffered quarter turns, centred in halls). **Free** is no help at all. Taps, swipes and keys
  glide you to the next tile centre or quarter turn from wherever you are.
- **A look can have a ceiling instead of a sky** (`ceils`/`ceilPick` in its theme). Corner shadows
  (`ao`) are laid on from the maze by the renderer, on floors, ceilings and walls, so they need no art.
- **Light.** Every tile has a brightness: ceiling lamps flood out through open floor (`reach`), flickering
  ones take their pools with them, and a look with a sky is lit evenly. Dark halls (the generator's
  darkness plus this view's own, `darkHalls`) sit at `darkLevel`, very dim, the far end showing. Squeezes
  are dimmed and slow you. All of it blended at tile corners; knobs in the Lighting section.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into a theme in `TEX.themes` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, squeezes (a narrow full-height slot
  cut through the tile, `gapW` wide, that the collision uses too), the exit, which glows through the fog, and a ceiling where the look has one. Not yet: sliders, doors and keys, pages,
  chalk, light switches, the charcoal map.
