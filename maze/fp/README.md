# The Maze — first person

`maze/maze-fp.html`. A prototype: walk the top-down's own mazes from inside them.

It loads the top-down's `data/` and generator scripts (`core.js`, `generate.js`, `proto.js`,
`contract.js`, and `audio.js` for the music) unchanged, then these:

| File | What's in it |
| --- | --- |
| `config.js` | the defaults for every knob on the gear panel |
| `textures.js` | all the pixel art, drawn in code, as four looks: **office** (the default — yellow wallpaper, damp carpet, a drop ceiling with fluorescent panels, an EXIT sign), **school** (after hours: painted cinderblock, cream over a green band and a red stripe; lockers and locked classroom doors — tap one and it rattles — along the halls, cork boards and chalkboards in the rooms, chalked with `CHALKBOARD` from data/text.js; vinyl tile, the drop ceiling; kids' desks with their chairs, the teacher's desk with an apple, bookcases), **bleached** (lime plaster with a meander frieze, marble, pilasters, travertine, white haze, a doorway onto the sea) and **dusk** (brick, flagstones, stars) |
| `sound.js` | what a body in a room makes: picking things up (its own, louder than the top-down's cues), footsteps per look (carpet, stone), room tone, lamp hum and flicker crackle, the squeeze's rub (the first couple of seconds of each one), doors, a closet's muffle. The music is the top-down's own `AUDIO`, loaded unchanged. A phone that stops either context gets it woken again by any part of a touch, by coming back to the page, and by a check every 2s (walking is one long touch); on an iPhone the page asks to count as playback, so the ringer switch doesn't mute it. The panel's readout line says whether sound and music are running |
| `fp.js` | the raycaster, the walk (the stick, or WASD), things in the world and tapping them, chalk and words on walls, the debug map, the panel |

- **The opening.** Each time the game is opened, a quote on black first — one at random from Joe's source-checked list, with who said it (`FP_OPENING.quotes` in data/text.js; the long ones stay up longer; a tap or a key
  skips it), then the waking.
- **Waking.** A maze starts with you lying on a mat on the floor of the start room, a pillow under your head, the camera
  down at the floor; then you get up, swaying, to standing height (`WAKE_LIE`, `WAKE_RISE`). No control until you're up; the
  mat stays where it was. `wakeScene` turns it off. Before it, the quote on black (`FP_OPENING`) is black from the page's
  first paint, and you are already lying down as it fades, so no frame of the game standing ever shows first.
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
  (buffered quarter turns, centred in halls). **Free** is no help at all. Keys are a stick too (the numpad as well: 8 4 6 2 to walk and turn); Space (or X, or 0) is the hand — whatever is straight ahead: take it, open it,
  chalk it, step into or out of the closet, put the page down. **Full screen** on the panel, for a PC.
  A tap on the view no longer moves you: it touches what is within reach.
  Once the panel is shut, nothing on it keeps the keyboard: a slider touched there used to swallow WASD until you went back.
- **Training** (`FP_TRAINING` in `data/text.js`). Nothing is said up front. Stand 5 seconds without touching the stick or
  WASD and the stick glows, with a quiet line under the view; stand a few seconds facing a wall you could chalk, a shut
  door, a closet, a light switch or a squeeze's mouth and the line says what to press — "tap" on a touch screen, Space or W
  on a keyboard, by whichever you used last. Each is taught once ever: shown, or done before it had to be. What's learnt is
  kept in its own store (`maze.fp.training`), apart from the knobs; **Reset training** on the Debug panel forgets it.
  The old always-on hint line is gone.
- **Things in the world and tapping them.** The maze's pages, chalk and charcoal are drawn as flat
  pictures facing you, depth-tested against the walls. Walk over one or tap it to take it; a page
  shows its text. Tap a wall within reach to chalk it (an X early on, the sign picker once signs
  open). Dead ends carry words from `WALL_WORDS` in `data/text.js` (`words`, ten a maze), at three-quarter size so a long word stays on its wall. A wall of the start room has an X on it
  already, with `WALL_TEACH` ("draw an x") over it. A chapter can open with two walls (`WALL_START`): the first across the
  start room, and you wake facing it; the second ahead of you as you step out of that room. The Child's are Joe's:
  "He said stay here." and "but I didn't.", in white chalk, bold, catching what light the start room has (a decal pixel marked 0xfd) A page (or a note) stays up until you tap off it (two picked up at once are read one after the other) — or Esc/Enter/Space — and while it's up you're reading: you don't move, the HUD steps away, the being holds still. It opens as a torn sheet of ruled notebook paper in a hand
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
  `BEING_NEAR` and it comes for you at `BEING_PACE` (0.8) of your walk (Joe: "The Being needs to move about 20% slower"), round by the halls — never through a squeeze or a shut door; if
  you're somewhere it can't get to, or out of its sight long enough, it goes. It takes you only once you've seen it. If
  it reaches you: static, and you're on the way out a few steps further along than you left it, facing on. Back on the
  way out yourself, it lets you be. In a closet: it runs up and past the door, back and forth, stops once square in
  front of the slats to look in, and is gone. In a squeeze: it comes to the mouth of it (the one you're facing, if it
  can), looks in at you for `BEING_PEER`, and goes. **Being now** on the panel calls it (after the turn or not).
- **The one at the exit** (`guard`; floor 1, whenever the exit is locked). Joe: "He should always be at the exit stopping you
  from leaving as well. The one that waits at the exit never chases you. He just stands there and if you collide with him he
  moves you someplace back on the golden path." The being's shape, from the start, standing just inside the locked way out;
  he never moves. Walk into him (`GUARD_TOUCH`) and it's the being's static, and you're `GUARD_BACK` steps back along the way
  out, facing back into the maze. Leave the watch and he's gone from there, and the being that stands in his place is the one
  that becomes the kid. And he warns you off (Joe: "We need to add some menace to the Being at the exit to scare people away.
  Waves arms, eyes pulse, maybe a yell (fake that for now)"): within `GUARD_WARN` his arms go up over his head and wave
  (`beingWave`), his eyes burn red and dim, and he yells (`beingYell`, faked: a swept noise shout over a growl) — once each time
  you come at him; back past `GUARD_CALM` and he stands still again.
- **The kid, into you.** Joe: "When the being shrinks down to a kid he should go white. He should also put his arms to either
  side and come and give you a hug then disappear into you." Near him at the open exit: down to the kid's size (`KID_SHRINK`),
  white in three steps (`kidPale`, `KID_PALE`), his arms out to either side (`KID_ARMS`), then he comes to you (`KID_PACE`) and
  there is gone into you — a white flash and a warm chord (`kidHug`).
- **The turn.** A maze starts calm (`calm`: no dark halls of this view's own, switched rooms lit). Each page read is a
  find (a room walked into no longer is); at `turnAfter` (3) the building turns — every tube stutters, something big goes
  off far away, the music drops to `The Turn`. After it, a room you walk into may stutter out and go dark (`turnRooms` of them, each room decided the first time you
  walk in), and on its
  walls, in paint that shows only in the dark, `TURN_LINES` ("you shouldnt be here!", "leave", "he left. do the
  same."); and now and then (`turnHalls`) a hall's lamps go out one after another from its far end toward you, a word
  glowing on the wall at the end. Every lamp is live now (`flickLamps`), so any can go out. The kid's room is spared.
- **The heart's dark** (`heartDark`). Joe: "When the heartbeat shows up we need to drop the lights down low and get them to
  slowly pulse with the heart beat … this is when we force the 'turn' as well. So you are following the red pulse while the
  walls are screaming at you to leave." Open the heart and the turn comes now if it hadn't; every light outside the heart
  comes down over `HEART_DARK_IN` to `HEART_DARK_LO` of itself and swells toward `HEART_DARK_HI` with each beat, slowly
  (`heartSwell`, the heart's lub-dub widened), and until the watch is left every room you walk into goes out at you.
- **The lights come back up** (`lightsUp`, when the watch is left). Joe: "bring all the lights back up and replace out all the
  text in the wall with things that talk about moving on and putting things down and not having to carry what isn't yours and
  maybe some thank yous", and "We should totally not have the dark walls with green text as you are approaching the ending."
  The dark lifts; every lamp out, every dark hall and every switched room comes back on (the chair's room too); the turn stops
  and its music with it; and every face the game wrote words on — the dead ends, the opening walls, the wall's lies, the turn's
  green (`turnFaces`) — is washed and written again in chalk with a line of `FP_ENDING` `after`.
- **Story rooms** (`storyRooms`; the Child, floor 1; words in `STORY_ROOMS` in data/text.js). Two ages of not looking:
  **the waiting room** — bare walls now (Joe: "the room with the chair doesn't need the words on the walls. It needs to be its
  own thing that just sits there in the center"); ceiling dead and the room held down to `CHAIR_DIM`, and in the middle of it
  (the tile nearest the middle with floor all round, diagonals too) his La-Z-Boy: a leather recliner, footrest out, turned to
  face the way in, up on a dais of two carpeted steps (`FURN.dais`, `DAIS_H`), the little table for the watch on the dais beside
  it, a packed bag at the foot of the steps. You can walk up them (Joe: "I should be able to walk up the few steps"): the dais's
  boxes are `step`s, in the way only if more than `STEP_UP` over what your feet are on (`standOn`), and your eye goes up with
  you (`lift`). Over it a can light in the ceiling and a spotlight: a soft pool (`spotLamps`,
  `spotAt`, added wherever light is looked up) and its beam in the air (`drawBeams`), a cone each pixel looking through is
  brightened by as much of it as its ray crosses. Joe: "make the chair the Dad sat on every night more grandiose … up on a
  couple steps like a dias. Have a spotlight shining down on it." The Child's tune winding down (`The Waiting Room` in data/music.js). **The wall** —
  painted over white and written floor to ceiling in one tight hand, "im fine | it doesnt matter", staggered like
  brickwork, with one chipped patch where the wallpaper and the old pencil show ("come back"); every panel lit, steady;
  almost no music (`The Wall`); nothing in it now but its writing (the watch is the heart's). **To a story room** on the panel.
- **Crossing out the lies.** The wall is what he told everyone, and the only room of lies now (Joe: "We should not make
  anything else required to complete the maze beyond crossing out the lies in the one room that has all the writing on the
  walls, collecting the watch from the heart room, and put it in on this table next to the La-Z-Boy chair. Everything else
  is incidental."). Chalk a face and every line on it is struck through, and what's true is written clear over them in red
  (`truths` in `STORY_ROOMS`). Every face of it (`liesToUndo` 0; Joe: "I didn't cross out all of the lies … and it gave me the
  heartbeat. Seems like I should have") and it's undone — its music stops, somewhere a wall gives, and a journal:
  "something is opening up inside of me. i dont want anyone to find it though." (`heart.opens`). The heart's way in, walled
  up until then, opens, and its heartbeat carries so you can follow it. A maze with no wall has its heart open from the start.
  **Cross out the lies** on the panel does it for you.
  The page that asks for it — the waiting room's, "Cross them out for me" — is in the wall's room, just inside the way in
  (Joe: "needs to go in the room you cross the words out"); the wall's own is at its far end.
- **The three that move you on are journals** (Joe: "any instance where you have to do a thing to get the game to progress,
  we should give you a journal for once you do it"): the heart opening, the watch taken (`heart.watch`, his chair's old note
  folded into it), the watch left (`leave`). Counted with the rest (`PROGRESS_PAGES`).
- **Memory rooms** (`FP_MEMORIES` in `data/text.js`, `memoryRooms`). Joe: "little activities you can do as the kid that
  trigger a core memory … play don't show." An ordinary furnished room with its middle kept clear, a thing to do in it,
  and a journal on the floor beside it (a page like the others: picked up, and counted in the HUD's total; nothing waits on the memories yet). Play
  it through and the memory comes (`after`). So far: **the phone** — on the wall you face coming in, "call dad to go
  visit" over it in crayon; tap it and it rings five times and nobody picks up (walk off and you've hung up) — and
  **catch**, in the kid's room: dad drawn on the wall with his glove up; pick up the ball, tap to throw, and it never
  goes where you threw it; three at him and the memory comes. **Cards** — a card table in the middle of a room, your
  chair and his, empty; tap the deck and you sit down — into your chair, lower, the view tilting down to frame the table
  (`SEAT_EYE`; further back on a wide screen than a tall one, `SEAT_WIDE`/`SEAT_TALL`, so both cards fit) — then each tap or Space turns your card, then his, by itself, flat on the table and the right
  way up to you, and his is always higher; three and the memory. **Get up** (or Esc, or a step) and you're back where you stood. **The fire** — a pile of crumpled drawings (twice the size it was: Joe, "The pile to light needs to be twice as big") in the
  middle of a room, and to one side his red toolbox on a little table. It won't open until you've read the room's page
  (`toolbox`, said if you try; Joe: "hide the matches until after you've read the journal"); then it opens on the matches, a
  tap puts them in your pocket (on the HUD), and a tap on the pile lights it (`openToolbox`, `pile`). The room shuts
  (`sealRoom`: its doors swung to and held, `d.locked`; you can't step out of it), the fire grows, smoke comes down from the
  ceiling (`#smoke`, over `SMOKE_FILL`) and you cough; at its thickest (`SMOKE_HOLD`) it's black (`SMOKE_BLACK`), and you
  wake as at the start, on the floor of the same room, facing a burn where the fire was (`scorch`), ash on it, and what he
  said on the walls in big dark letters (`shout`); then the memory, and the doors let go. Joe: "Smoke fills the room. You
  can't get out. Fade to black from smoke damage. Wake up a few seconds later on the ground … Then we see all the writing on
  the walls. There's a burned spot on the ground." The middle things are given a wider mark to tap, and nothing only looked at (`deco`) is ever what Space or a tap
  reaches for. **The picture book** — in the kid's room, by the bed: tap it and you sit at the head of the bed (`BED_EYE`),
  the view tilted down to it lying open on the blanket; each tap or Space turns a page, its words under the view (`book.pages`).
  Past the last you get up holding it (a book in the HUD), and it goes back in the gap on the shelf in the room (`placeShelf`).
  Incidental: it was needed for the way out for three versions, and isn't now. Get up before the end and it's put back where it lay. **Put the book away** on the Debug panel does it for you.
  **Hiding** — a room with a closet of its own on the far wall, and the journal just inside the way in:
  walk in and it's read ("when dad drinks he gets loud"), and then he's coming — HE_COMES of heavy uneven steps and the
  bottle, nearer and nearer, and he's in the doorway (the father's own figure). In a closet by then: he walks to it and
  stands there, and goes; the memory (`after`). Not: he walks straight past you, and the other one (`seen`). Each maze deals
  the four in its own order and gets as many as it has rooms for (about three in four mazes have any given one).
- **The way out has to be earned** (a chapter with placed pages; lines in `FP_ENDING`). The exit is shut and chalked
  "not yet" — walk up to it and the handle rattles. It opens once you've taken the watch from the middle of the heart and
  left it by the chair he saved in the waiting room — on the little table beside it, where a ring in the dust shows where the
  watch used to sit (tap it without: "something goes here."; with it: he says goodbye to it, and somewhere a door unlatches). The being is standing in front of the exit then, waiting; come close and it comes down to the kid's size,
  and fades, and goes. Out, under the Exit: "you have let go of what's been holding you back … it's time to come home now.", and the button says "Again?" (`again`; Joe: "Then the button can just say, Again?") After the watch is left the being doesn't hunt
  any more. The debug arrow points at the next thing to do. **Leave the watch** on the panel skips to it.
- **The heart** (`heart`; the Child, floor 1; words in `STORY_ROOMS` → `heart`). The third story room, and the hidden one:
  what's under the waiting and under the wall. A room the shape of a heart, carved after the generator (on its own stream)
  where its way in is furthest from both the start and the exit, clear of the big rooms the other two are made from. You
  reach it through a little maze made only of squeezes — nine cells grown to branch, with one more dead end than a plain crawl would have (`HEART_DEAD`), tight and dark — and come in at
  its point. Deep red walls written over in crayon ("i miss you", "was it me", "come home", "i wear the watch when nobody
  can see"), on the far wall "i miss you dad" over the two of them holding hands, a letter he never sent lying on the floor
  (one of the pages, off to the side), and in the middle, on a step of the same red plush under the lamp, the watch. Deep red plush underfoot, padded and buttoned overhead (`TEX.heart`).
  One warm pink lamp, beating (`HEART_BPM`); its own music (`The Heart`: a tune he knew, slowed); and, once it's open, a heartbeat you
  can hear through the walls from `HEART_HEAR_OPEN` steps off (doubled: Joe wanted it heard from further). Until the lies are crossed out its way in is wall. The turn leaves it alone, nothing else is
  placed in it, and the being can't follow you in. **To the heart** on the panel stands you outside its way in.
  **The vein** (Joe: "once the heart room opens, we should draw a line from the player to the entrance to the heart room …
  faint vein that pulses at the same rate of the heart"): once you've opened it (not when a maze starts with it open) and
  until you've been in, a thin wavering line of dark red along the floor, the walking way from the tile you're on down
  `heart.dist` to the gap in its wall (`heart.ring`) — not on through its squeeze maze, which is yours to find. Faint between
  beats, it comes up on each lub and dub (`heartPulse`), over the floor however dark it is. Worked out again each new tile.
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
- **A new maze each time.** Joe: "Feels like you are using the same seed over and over again." It was: every new maze wrote
  its seed into the address, and a page load plays the address's seed, so reopening the tab was the same maze again. A new maze
  clears the address now; a seed typed into a link (`?seed=`) still holds until then. The seed is on the panel.
- **The key rooms on the debug map** (`mapMarks`): W the wall, C his chair, ♥ the heart, K the kid's room, ☎ ♠ F H the phone,
  the cards, the fire, hiding — on the full map all of them, on the corner one those you've seen. Joe: "I can't find the War
  table on the map."
- **The log of journals.** A tap on the journal count on the HUD is every journal of the run on one long page, newest first
  (`journalLog`). Joe: "I want to tap on the journal count on the hud and get a log of the journals and their text with the most
  recent at the top."
- **The way out** ends the maze when you're up against its door (`EXIT_REACH` from the face), not on first
  setting foot on the exit tile, which was a tile short.
- **Replacing the art:** each texture is `{ w, h, px: Uint32Array }` (0xAABBGGRR). Decode a
  32×32 PNG into that shape and drop it into a theme in `TEX.themes` — the renderer doesn't care where it came from.
- **What it draws of the maze so far:** walls, floor, sky, squeezes (a narrow full-height slot
  cut through the tile, `gapW` wide, that the collision uses too), the exit, which glows through the fog, and a ceiling where the look has one. Not yet: sliders, keys on doors,
  the thread and pointer, the charcoal map.
