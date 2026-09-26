# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`, and `audio.js` for the music) unchanged, then these:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code, as three looks: **office** (the default — yellow wallpaper, damp carpet, a drop ceiling with fluorescent panels, an EXIT sign), **bleached** (lime plaster with a meander frieze, marble, pilasters, travertine, white haze, a doorway onto the sea) and **dusk** (brick, flagstones, stars) |
| `sound.js` | what a body in a room makes: footsteps per look (carpet, stone), room tone, lamp hum and flicker crackle, the squeeze's rub, doors, a closet's muffle. The music is the top-down's own `AUDIO`, loaded unchanged |
| `fp.js` | the raycaster, the walk (the stick, or WASD), things in the world and tapping them, chalk and words on walls, the debug map, the panel |

- **A seed is the same maze in both views.** `?seed=1234` works here as it does top-down.
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`. The ☰ panel is in
  sections — Look, Stick, Glide help, Lighting, Sound, Maze, Debug — each slider's range and section in `FP_RANGES`.
  The Maze section is the top-down's own debug (level, stones, prototype, size, branching, turns, districts,
  loops), written into `SAVE` in memory before each build and never persisted. Sound can pin the music to any self's track (or the pool's) instead of following the chapter.
  Debug adds infinite chalk,
  the way out marked on the floor, and an arrow to it.
- **Two ways to move, one position.** The stick has three modes. **Glide** (the default) is free
  steering with quiet help, each with its own knob under Glide help on the panel, never a snap: it settles you square to
  an open way when you ease off the turn, drifts you to the middle of a one-wide hall, and two
  "whiskers" slip you sideways past a corner one of them touches. **Rails** is the top-down's model
  (buffered quarter turns, centred in halls). **Free** is no help at all. Keys are a stick too.
  A tap on the view no longer moves you: it touches what is within reach.
- **Things in the world and tapping them.** The maze's pages, chalk and charcoal are drawn as flat
  pictures facing you, depth-tested against the walls. Walk over one or tap it to take it; a page
  shows its text. Tap a wall within reach to chalk it (an X early on, the sign picker once signs
  open). Dead ends carry words from `WALL_WORDS` in `data/text.js`. Found things are kept for the run
  only — nothing is written to the top-down's save yet.
- **Doors and closets.** Doors go where the maze is already open — one-wide passages between two cells,
  mostly room mouths (`doorRoom`, `doorHall`) — so every door is a real way through and the maze under
  them is unchanged. A door sits in a thin plate (`PLATE`) on the tile's edge toward the room: jambs
  either side of a `DOOR_W` opening, a header over it from `DOOR_H`. Tap one within reach to open or shut it; it swings away from you and stays that way,
  so an open door says which way someone went. `doorsOpen` start open, swung out into the room. Shut, the leaf laps
  into both jambs so no light shows round it, and the squeeze veil stops at it. A leaf is a segment each column is tested against, and the collision pushes off.
  Closets (`closets`) are narrow pale doors on solid walls: tap to step in and look out through the slats,
  **Step out** to leave. The office's old wallpapered door, which went nowhere, is out of its walls.
- **Light switches.** `switches` rooms a maze (office look: rooms with lamps) get a plate beside the way in, on the
  inside wall. Tap it: the room's lamps go out, or come back with a fluorescent stutter. `switchOff` of them are dark
  when you arrive, at `darkLevel`; off, the toggle's amber pilot glows so you can find it. In a dark room a page
  doesn't catch the light, so what's in there is found by switching it on. A switch's face never takes chalk.
- **The father.** Not placed; he happens (`father` a maze, a minute apart at least). Looking straight down a hall
  at a lit opening 3–7 tiles off, nothing shut or squeezed between, he walks through it at your pace: across a
  crossing from one side hall to the other, or out of a side opening and away from you down the hall, seen from
  behind, off at the next junction. He always walks in from out of sight, and the walls hide him again. Come near and
  he thins out and is gone. Likelier just after you take something. **Father next** on the panel calls him at the
  next good view. Every chapter, for now.
- **A look can have a ceiling instead of a sky** (`ceils`/`ceilPick` in its theme). Corner shadows
  (`ao`) are laid on from the maze by the renderer, on floors, ceilings and walls, so they need no art.
- **Light.** Every tile has a brightness: ceiling lamps flood out through open floor (`reach`), flickering
  ones take their pools with them, and a look with a sky is lit evenly. Dark halls (the generator's
  darkness plus this view's own, `darkHalls`) sit at `darkLevel`, very dim, the far end showing. Squeezes
  are dimmed, slow you, and hide what is past them (`squeezeVeil`). All of it blended at tile corners; knobs in the Lighting section.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into a theme in `TEX.themes` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, squeezes (a narrow full-height slot
  cut through the tile, `gapW` wide, that the collision uses too), the exit, which glows through the fog, and a ceiling where the look has one. Not yet: sliders, keys on doors,
  the thread and pointer, the charcoal map.
