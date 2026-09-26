# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`, and `audio.js` for the music) unchanged, then these:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code, as three looks: **office** (the default — yellow wallpaper, damp carpet, a drop ceiling with fluorescent panels, an EXIT sign), **bleached** (lime plaster with a meander frieze, marble, pilasters, travertine, white haze, a doorway onto the sea) and **dusk** (brick, flagstones, stars) |
| `sound.js` | what a body in a room makes: picking things up (its own, louder than the top-down's cues), footsteps per look (carpet, stone), room tone, lamp hum and flicker crackle, the squeeze's rub, doors, a closet's muffle. The music is the top-down's own `AUDIO`, loaded unchanged |
| `fp.js` | the raycaster, the walk (the stick, or WASD), things in the world and tapping them, chalk and words on walls, the debug map, the panel |

- **A seed is the same maze in both views.** `?seed=1234` works here as it does top-down.
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`. The ☰ panel is in
  sections — Look, Stick, Glide help, Lighting, Sound, Maze, Debug — each slider's range and section in `FP_RANGES`.
  A tap outside the open panel closes it, and does nothing else.
  The Maze section is the top-down's own debug (level, stones, prototype, size, branching, turns, districts,
  loops), written into `SAVE` in memory before each build and never persisted. Sound can pin the music to any self's track (or the pool's) instead of following the chapter.
  Debug adds infinite chalk,
  the way out marked on the floor, and an arrow to it (on a floor above the first, both point to the door marked down).
  The map can be a corner mini map, or **Full screen: tap to go**: a map button opens the whole floor, tap an open
  tile and you're there, tap a wall to close it. Both say which floor, and show the up door in blue and the down in red.
- **Two ways to move, one position.** The stick has three modes. **Glide** (the default) is free
  steering with quiet help, each with its own knob under Glide help on the panel, never a snap: it settles you square to
  an open way when you ease off the turn, drifts you to the middle of a one-wide hall, and two
  "whiskers" slip you sideways past a corner one of them touches. **Rails** is the top-down's model
  (buffered quarter turns, centred in halls). **Free** is no help at all. Keys are a stick too.
  A tap on the view no longer moves you: it touches what is within reach.
- **Things in the world and tapping them.** The maze's pages, chalk and charcoal are drawn as flat
  pictures facing you, depth-tested against the walls. Walk over one or tap it to take it; a page
  shows its text. Tap a wall within reach to chalk it (an X early on, the sign picker once signs
  open). Dead ends carry words from `WALL_WORDS` in `data/text.js`. A chapter can open with two walls (`WALL_START`): the first across the
  start room, and you wake facing it; the second ahead of you as you step out of that room. The Child's are Joe's:
  "stay here." and "but I didn't." A page opens as a torn sheet of ruled notebook paper in a hand
  (Caveat, SIL OFL, kept in `fp/caveat-latin.woff2` so it reads the same offline). Found things are kept for the run
  only — nothing is written to the top-down's save yet.
- **The maze is not empty.** Pushing through a squeeze toward its far end, now and then (`squeezeScare`, once a
  squeeze at most, 90s apart) a black figure whips across the opening and is gone, with a scuffle of feet — drawn
  over the squeeze's veil, since it's the one thing past it you're meant to see. And somewhere else in the building,
  about once a minute (`ambience`, on the Sound panel), something happens: a door slams, feet run, three knocks, a
  ball bouncing to rest, a chair scraping, something metal. Muffled and off to one side, never anywhere near you.
- **Doors and closets.** Doors go where the maze is already open — one-wide passages between two cells,
  mostly room mouths (`doorRoom`, `doorHall`) — so every door is a real way through and the maze under
  them is unchanged. A door sits in a thin plate (`PLATE`) on the tile's edge toward the room: jambs
  either side of a `DOOR_W` opening, a header over it from `DOOR_H`. Tap one within reach to open or shut it; it swings away from you and stays that way,
  so an open door says which way someone went. `doorsOpen` start open, swung out into the room. Shut, the leaf laps
  into both jambs so no light shows round it, and the squeeze veil stops at it. A leaf is a segment each column is tested against, and the collision pushes off.
  Closets (`closets`, 6 a maze: "closets everywhere") are narrow pale doors on solid walls: tap to step in and look out through the slats,
  **Step out** to leave. The office's old wallpapered door, which went nowhere, is out of its walls.
- **The being** (`being`; floor 1). The old notes' Caretaker, and Joe's twist: it helps. Past `beingOff` steps off the
  way out for `beingWait` seconds, the signs — tubes round you stutter, a low swell — and if you turn back to the way
  out it never comes. Otherwise it's there eight steps off, somewhere you're not looking: tall as the ceiling, thin,
  arms past its knees, two pale eyes (all you see of it in the dark). It comes at 1.25× your walk (time to run for a closet), through doors but never through a squeeze; if
  you're somewhere it can't get to, it waits a while and goes. If it
  reaches you: static, and you're on the way out a few steps further along than you left it, facing on. Back on the
  way out yourself, it lets you be. In a closet: it runs up and past the door, back and forth, stops once square in
  front of the slats to look in, and is gone. **Being now** on the panel calls it.
- **The turn.** A maze starts calm (`calm`: no dark halls of this view's own, switched rooms lit). Each page read and
  story room walked into is a find; at `turnAfter` (3) the building turns — every tube stutters, something big goes
  off far away, the music drops to `The Turn`. After it, a room you walk into stutters out and goes dark, and on its
  walls, in paint that shows only in the dark, `TURN_LINES` ("you shouldnt be here!", "leave", "he left. do the
  same."); and now and then (`turnHalls`) a hall's lamps go out one after another from its far end toward you, a word
  glowing on the wall at the end. Every lamp is live now (`flickLamps`), so any can go out. The kid's room is spared.
- **Story rooms** (`storyRooms`; the Child, floor 1; words in `STORY_ROOMS` in data/text.js). Two ages of not looking:
  **the waiting room** — every wall written over low in pencil and crayon, lines crossed out and written again, tallies,
  a clock drawn stopped at five past, WAIT HERE; ceiling dead, one floor lamp by a single chair turned to face the way in,
  a packed bag, a note on the seat; the Child's tune winding down (`The Waiting Room` in data/music.js). **The wall** —
  painted over white and written floor to ceiling in one tight hand, "im fine | it doesnt matter", staggered like
  brickwork, with one chipped patch where the wallpaper and the old pencil show ("come back"); every panel lit, steady;
  almost no music (`The Wall`); a ring of stacked boxes round a shoebox with the watch on it, out of reach but not out of
  sight or tap. Notes are read where they lie (a tap, or the first time you walk to them), never taken. **To a story
  room** on the panel. Sprites can stand off the floor now (`z`), for the note on the seat.
- **Stairs** (`floors`, 2 by default; 1 is none). Floor 1 is the chapter's maze; each floor above is a maze of its own
  from its own seed off the first, so it's always the same floor. Going up is a door marked up at the end of a far
  dead end (the painted flight read wrong, so it's gone). Walk into it or tap it: black, feet on stairs, "floor 2",
  and you're standing out from a door marked down in the dead end nearest where that floor begins; it takes you back
  to the door marked up. Each floor remembers itself while you're away (what you took, your chalk, open doors,
  lights, what you've seen). The way out is only on floor 1; chalk and charcoal go with you; pages count per floor.
  **To the stairs** on the panel puts you in front of them; Restart goes back to floor 1.
- **The kid's room** (the Child's secret room, which the generator already carves behind a squeeze). Pitch black
  (`PITCH`, darker than a dark hall) until you flip its switch, just inside the squeeze; the amber pilot is all you see.
  Lit (five lamps of its own), every wall is covered in a kid's chalk — noughts and crosses, "dad?", balls, suns, a
  house, tallies, stick figures, a big one and a small one holding hands, and on the far wall a man walking away. A
  pile of chalk (worth four finds) in the corner farthest from the way in. No furniture, no random switch.
- **Furniture** (the office look, `furnish` in its theme). Desks with a dead beige CRT and a chair pulled out,
  couches, filing cabinets, water coolers, plants, boxes, bins, and floor lamps that give a small warm pool (only in
  rooms whose lights are always on). Each piece is a few real boxes (`FURN` in fp.js: a couch is a base, a seat, a
  back and two arms), drawn per column like short walls with a top you look down on, textured from `TEX.furn`
  (materials that tile, and `fronts` stretched over the face that looks into the room — drawers, the CRT, the taps),
  lit by the light where each face is, with the walls' fog and a shadow where it meets the floor. Anything behind a
  piece is hidden by it pixel by pixel (`ovDep`). Rooms only, against their walls, never beside a way in or out, never
  on a page, never in front of a switch, closet or words, and each piece is checked to leave every way into its room
  reaching every other. You bump into them; a tap on one does nothing (and doesn't chalk the wall behind). `furniture`
  scales it.
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
- **The way out** ends the maze when you're up against its door (`EXIT_REACH` from the face), not on first
  setting foot on the exit tile, which was a tile short.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into a theme in `TEX.themes` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, squeezes (a narrow full-height slot
  cut through the tile, `gapW` wide, that the collision uses too), the exit, which glows through the fog, and a ceiling where the look has one. Not yet: sliders, keys on doors,
  the thread and pointer, the charcoal map.
