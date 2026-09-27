# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`, and `audio.js` for the music) unchanged, then these:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code, as four looks: **office** (the default — yellow wallpaper, damp carpet, a drop ceiling with fluorescent panels, an EXIT sign), **school** (after hours: painted cinderblock, cream over a green band and a red stripe; lockers and locked classroom doors — tap one and it rattles — along the halls, cork boards and chalkboards in the rooms, chalked with `CHALKBOARD` from data/text.js; vinyl tile, the drop ceiling; kids' desks with their chairs, the teacher's desk with an apple, bookcases), **bleached** (lime plaster with a meander frieze, marble, pilasters, travertine, white haze, a doorway onto the sea) and **dusk** (brick, flagstones, stars) |
| `sound.js` | what a body in a room makes: picking things up (its own, louder than the top-down's cues), footsteps per look (carpet, stone), room tone, lamp hum and flicker crackle, the squeeze's rub (the first couple of seconds of each one), doors, a closet's muffle. The music is the top-down's own `AUDIO`, loaded unchanged |
| `fp.js` | the raycaster, the walk (the stick, or WASD), things in the world and tapping them, chalk and words on walls, the debug map, the panel |

- **The opening.** Each time the game is opened, a line on black first (`FP_OPENING` in data/text.js; a tap or a key
  skips it), then the waking.
- **Waking.** A maze starts with you lying on a mat on the floor of the start room, a pillow under your head, the camera
  down at the floor; then you get up, swaying, to standing height (`WAKE_LIE`, `WAKE_RISE`). No control until you're up; the
  mat stays where it was. `wakeScene` turns it off.
- **A seed is the same maze in both views.** `?seed=1234` works here as it does top-down.
- **Nothing here writes to the top-down's save.** Knobs live under `maze.fp.v1`. The ☰ panel is in
  sections — Look, Stick, Glide help, Lighting, Sound, Maze, Debug — each slider's range and section in `FP_RANGES`.
  A tap outside the open panel closes it, and does nothing else.
  The Maze section is the top-down's own debug (level, stones, prototype, size, branching, turns, districts,
  loops), written into `SAVE` in memory before each build and never persisted. Sound can pin the music to any self's track (or the pool's) instead of following the chapter.
  Debug adds infinite chalk,
  the way out marked on the floor, and an arrow to it — all three on by default for now — (on a floor above the first, both point to the door marked down).
  The map can be a corner mini map, or **Full screen: tap to go**: a map button opens the whole floor, tap an open
  tile and you're there, tap a wall to close it. Both say which floor, and show the up door in blue and the down in red. Floors are drawn light and walls dark. **Stick in landscape** puts the stick on the left (the default) or the right.
- **Two ways to move, one position.** The stick has three modes. **Glide** (the default) is free
  steering with quiet help, each with its own knob under Glide help on the panel, never a snap: it settles you square to
  an open way when you ease off the turn, drifts you to the middle of a one-wide hall, and two
  "whiskers" slip you sideways past a corner one of them touches. **Rails** is the top-down's model
  (buffered quarter turns, centred in halls). **Free** is no help at all. Keys are a stick too; Space (or X) is the hand — whatever is straight ahead: take it, open it,
  chalk it, step into or out of the closet, put the page down. **Full screen** on the panel, for a PC.
  A tap on the view no longer moves you: it touches what is within reach.
- **Training** (`FP_TRAINING` in `data/text.js`). Nothing is said up front. Stand 5 seconds without touching the stick or
  WASD and the stick glows, with a quiet line under the view; stand a few seconds facing a wall you could chalk, a shut
  door, a closet, a light switch or a squeeze's mouth and the line says what to press — "tap" on a touch screen, Space or W
  on a keyboard, by whichever you used last. Each is taught once ever: shown, or done before it had to be. What's learnt is
  kept in its own store (`maze.fp.training`), apart from the knobs; **Reset training** on the Debug panel forgets it.
  The old always-on hint line is gone.
- **Things in the world and tapping them.** The maze's pages, chalk and charcoal are drawn as flat
  pictures facing you, depth-tested against the walls. Walk over one or tap it to take it; a page
  shows its text. Tap a wall within reach to chalk it (an X early on, the sign picker once signs
  open). Dead ends carry words from `WALL_WORDS` in `data/text.js` (`words`, ten a maze). A wall of the start room has an X on it
  already, with `WALL_TEACH` ("draw an x") over it. A chapter can open with two walls (`WALL_START`): the first across the
  start room, and you wake facing it; the second ahead of you as you step out of that room. The Child's are Joe's:
  "stay here." and "but I didn't." A page (or a note) stays up until you tap off it (two picked up at once are read one after the other) — or Esc/Enter/Space — and while it's up you're reading: you don't move, the HUD steps away, the being holds still. It opens as a torn sheet of ruled notebook paper in a hand
  (Caveat, SIL OFL, kept in `fp/caveat-latin.woff2` so it reads the same offline). A door's jambs and the sides of a squeeze take chalk like any wall (each a face of its own,
  keyed to its open tile). Found things are kept for the run
  only — nothing is written to the top-down's save yet.
- **Pages have places** (`FP_PAGES` in data/text.js, per chapter). The Child's five: beside the mat you wake on, in the
  waiting room, in the wall, in the kid's chalk room, and in the heart (the letter he never sent). Each is twice the length
  of the old ones and says what its room is. They replace the generator's pages; the floors above have none. A place a maze
  didn't make keeps one of the generator's spots, so the count is always the chapter's.
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
  Closets (`closets`, 30 a maze: "closets everywhere"; never in a pocket that squeezes shut off from the rest) are narrow pale doors on solid walls: tap to step in and look out through the slats,
  **Step out** to leave. The office's old wallpapered door, which went nowhere, is out of its walls.
- **The being** (`being`; floor 1; only after the turn). The old notes' Caretaker, and Joe's twist: it helps. Each time you
  go more than `beingOff` steps off the way out, `beingChance` that it comes (rolled once a trip; come back within it and
  the next trip is a new roll); and `beingDead` that it comes when you walk into the end of a dead end, when it's
  back up the way you came, waiting for you to turn round. The signs first — tubes round you stutter, a low swell — and if you turn back to the way
  out it never comes. Then it's standing at the far end of what you can see (`BEING_VIEW` tiles at most), looking at you:
  tall as the ceiling, thin, arms past its knees, two pale eyes (all you see of it in the dark). It waits. Come within
  `BEING_NEAR` and it comes for you at your own walking pace, round by the halls — never through a squeeze or a shut door; if
  you're somewhere it can't get to, or out of its sight long enough, it goes. It takes you only once you've seen it. If
  it reaches you: static, and you're on the way out a few steps further along than you left it, facing on. Back on the
  way out yourself, it lets you be. In a closet: it runs up and past the door, back and forth, stops once square in
  front of the slats to look in, and is gone. In a squeeze: it comes to the mouth of it (the one you're facing, if it
  can), looks in at you for `BEING_PEER`, and goes. **Being now** on the panel calls it (after the turn or not).
- **The turn.** A maze starts calm (`calm`: no dark halls of this view's own, switched rooms lit). Each page read is a
  find (a room walked into no longer is); at `turnAfter` (3) the building turns — every tube stutters, something big goes
  off far away, the music drops to `The Turn`. After it, a room you walk into may stutter out and go dark (`turnRooms` of them, each room decided the first time you
  walk in), and on its
  walls, in paint that shows only in the dark, `TURN_LINES` ("you shouldnt be here!", "leave", "he left. do the
  same."); and now and then (`turnHalls`) a hall's lamps go out one after another from its far end toward you, a word
  glowing on the wall at the end. Every lamp is live now (`flickLamps`), so any can go out. The kid's room is spared.
- **Story rooms** (`storyRooms`; the Child, floor 1; words in `STORY_ROOMS` in data/text.js). Two ages of not looking:
  **the waiting room** — every wall written over low in pencil and crayon, lines crossed out and written again, tallies,
  a clock drawn stopped at five past, WAIT HERE; ceiling dead, one floor lamp by a single chair turned to face the way in,
  a packed bag, a note on the seat; the Child's tune winding down (`The Waiting Room` in data/music.js). **The wall** —
  painted over white and written floor to ceiling in one tight hand, "im fine | it doesnt matter", staggered like
  brickwork, with one chipped patch where the wallpaper and the old pencil show ("come back"); every panel lit, steady;
  almost no music (`The Wall`); in the middle, a shoebox on a couple of boxes with the watch on it — the one thing here you
  take: tap it and you carry it (`carried`, shown on the HUD, up and down the stairs; perhaps an offering, once the statues
  come back). Notes are read where they lie (a tap, or the first time you walk to them), never taken. **To a story
  room** on the panel. Sprites can stand off the floor now (`z`), for the note on the seat.
- **Crossing out the lies.** The waiting room and the wall are what he told himself. Chalk a face of either and every
  line on it is struck through, and what's true is written clear over them in red (`truths` in `STORY_ROOMS`). `liesToUndo`
  faces and the room is undone — its music stops. Both undone and somewhere a wall gives: the heart's way in, walled up
  until then, opens, and its heartbeat carries twice as far so you can follow it. Kept for the run, stairs and all. The
  turn leaves both rooms alone now (its words would cover theirs). **Cross out the lies** on the panel does it for you.
- **The way out has to be earned** (a chapter with placed pages; lines in `FP_ENDING`). The exit is shut and chalked
  "not yet" — walk up to it and the handle rattles. It opens once you've been to the heart and then left the watch on the
  chair he saved in the waiting room — on the little table beside it, where a ring in the dust shows where the watch used to
  sit (tap it: "something goes here."; with the watch: "he always had this right next to him …"): he says goodbye to it, and somewhere a door
  unlatches. The being is standing in front of the exit then, waiting; come close and it comes down to the kid's size,
  and fades, and goes. Out, under the Exit: "it's time to come home now." After the watch is left the being doesn't hunt
  any more. The debug arrow points at the next thing to do. **Leave the watch** on the panel skips to it.
- **The heart** (`heart`; the Child, floor 1; words in `STORY_ROOMS` → `heart`). The third story room, and the hidden one:
  what's under the waiting and under the wall. A room the shape of a heart, carved after the generator (on its own stream)
  where its way in is furthest from both the start and the exit, clear of the big rooms the other two are made from. You
  reach it through a little maze made only of squeezes — nine cells, a dead end or two, tight and dark — and come in at
  its point. Deep red walls written over in crayon ("i miss you", "was it me", "come home", "i wear the watch when nobody
  can see"), on the far wall "i miss you dad" over the two of them holding hands, a letter he never sent lying on the floor
  (drawn as a journal; read where it lies). Deep red plush underfoot, padded and buttoned overhead (`TEX.heart`).
  One warm pink lamp, beating (`HEART_BPM`); its own music (`The Heart`: a tune he knew, slowed); and, once it's open, a heartbeat you
  can hear through the walls from `HEART_HEAR_OPEN` steps off. Until the lies are crossed out its way in is wall. The turn leaves it alone, nothing else is
  placed in it, and the being can't follow you in. **To the heart** on the panel stands you outside its way in.
- **Stairs** (`floors`, 1 by default for now — one floor, every room on it; set it higher on the panel to have them). Floor 1 is the chapter's maze; each floor above is a maze of its own
  from its own seed off the first, so it's always the same floor. Going up is a door marked up at the end of a far
  dead end (the painted flight read wrong, so it's gone). Walk into it or tap it: black, feet on stairs, "floor 2",
  and you're standing out from a door marked down in the dead end nearest where that floor begins; it takes you back
  to the door marked up. Each floor remembers itself while you're away (what you took, your chalk, open doors,
  lights, what you've seen), and is rebuilt as it was first built, calm or turned, so its closets stay behind their
  doors (after the turn they used to move, and a tap on one chalked it). The way out is only on floor 1; chalk and charcoal go with you, and so does the page count:
  the chapter's pages are spread across its floors (dealt round: page 1 on floor 1, page 2 on floor 2, …), so the count is out of
  all of them.
  **To the stairs** on the panel puts you in front of them; Restart starts the same maze over: floor 1, every page back, before the turn.
- **The kid's room** — a kid's bed along a wall, a little chair, a picture book on the floor by the bed, and in the corner
  nearest the way in a baseball and one glove, only one: him playing at having a father (`furnishKidRoom`). (Floor 1 only; the Child's secret room, which the generator already carves behind a squeeze). Pitch black
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
- **Fewer squeezes** (`squeezeChains`, `squeezeSingles`). Of the generator's squeezes (about 17 a maze, three of them
  chains), the first person keeps the longest chain and half the single ones, and opens the rest to plain floor — which only
  adds ways through. The kid's room keeps its squeeze. About 9 a maze now.
- **The district prototype** (Maze → Prototype → Districts on the panel) now loads here too: content first, halls last, a
  much bigger map. The Child's story rooms don't fit it yet — only the heart is placed on it.
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
