# Rooms

<!-- reviewed: v0.76.0 — the room table checked against LANDMARK_KINDS -->

The seven that exist, and a pitch list for more. Joe: *"I'd love to have you pitch to me a list of
other possible odd, interesting, thematically on point room pitches."*

The bar a room has to clear is in his earlier note, and it is the one worth keeping in front of us:
a room is **something you navigate by**. Not decoration — a thing you can say to yourself, *"the key
was two lefts past the room with the pool in it."* So every pitch below is graded on whether you
could describe it to someone else in six words, and on what it costs.

## What is in already

| Room | What it is | Does anything? |
|---|---|---|
| **pool** | the floor is water, with a rim you walk round | no — pure landmark |
| **statues** | six of them round the walls, facing in | no |
| **spiral** | one spiral chalked across the whole floor | no |
| **columns** | four pillars you cannot walk through; they take light as you pass | **yes** — real geometry, and the flames |
| **dais** | a stepped platform filling the middle | no |
| **well** | a mouth in the floor, flagstones round it | no |
| **balls** | a pit of them, and they get out of your way | **yes** — they part as you wade |
| **vault** | nested rings, one gap each, a key at the heart | **yes** — this is where keys hide now |

Five of the eight are still *pictures*. The pitches worth most are the ones that give a room
something to **do**, because that is what makes you remember where it was.

## The pitches

Ordered by what I would build first. The cheap column is honest: "cheap" means it reuses machinery
that already exists.

### 1. The room that is already mapped — *cheap*
Chalked on the floor, in someone else's hand, is a **map of a different part of this maze** — a real
fragment, drawn from the actual tile data, of somewhere twenty tiles away. Walk in, see it, and you
have a piece of ground you have not stood on yet. Reuses `drawChalkWord`/the map renderer and the
`scraps` reveal. *Why it is on point:* somebody came before you and wrote it down. That is the whole
game.

### 2. The counting room — *cheap*
A corridor of **hopscotch squares with numbers scratched in them**, and a door at the end that opens
only if you step them in the right order. The numbers are elsewhere in the room, small and easy to
miss. This is Joe's own note, and the hopscotch code is already there. *On point:* the Child's game
turned into a lock.

### 3. The room with one chair — *cheap*
Empty, big, swept clean, and a single chair in the middle facing a wall. Nothing happens. The
narrator says nothing. It is the most memorable room in the game precisely because it refuses to
pay off.

### 4. The room that is the same room — *medium*
Two rooms, far apart, **identical down to the chalk marks and the scuffs**. The second time you walk
in you are certain you have gone in a circle. One line of narration the second time: *"i have been
here."* Cheap to build (draw the same room twice, seeded the same), and it does real damage to your
confidence in your own map, which is the "getting lost" Joe keeps asking for.

### 5. The flooded room — *medium*
Ankle-deep water across the whole floor. You walk slower in it, you make noise, and **your footprints
stay** for a while — so you can see where you have already been, but only here. A memory aid that
works in exactly one room is a reason to come back to that room.

### 6. The room of doors — *medium*
Joe's note, worth restating: a room whose only exits are **three or four identical doors**, and they
must be taken in an order. Wrong one and you are back at the entrance. The combination is hidden in
the room. This is the first thing in the game that would be a *puzzle* rather than a maze.

### 7. The library that is all one book — *medium*
Shelves on every wall, hundreds of spines, and every single one is a copy of the same journal — the
one you already have. Reuses the shelf code. *On point:* he wrote the same thing down for years.

### 8. The room with the light in it — *medium*
A hole in the ceiling, and a column of daylight coming down. It is the only warm colour in the game.
You cannot reach it and it does not lead anywhere. Standing in it, the narrator stops talking.

### 9. The room where you are followed — *expensive*
The figure system already exists (a man who walks away and is gone). Here, instead, **a second arrow
enters the room behind you and leaves by a different door** — on its own path, ignoring you. Once a
maze at most. The machinery is the figures; the work is making it not feel like a bug.

### 10. The room you have to leave dark — *expensive*
Lit, it is a plain room. With the lamp **off**, chalk on the floor shows a way through the wall that
is not there in the light. Needs the darkness system to run inverted, which is why it is last — but
it is the single most "the maze is in your head" idea on this list.

## Two I would not build

- **A room with a dead body** (from the notes). It names a thing the rest of the game is careful not
  to name. The maze is more frightening for having nobody in it.
- **Bug-light creatures that scurry into the corners.** Lovely, but it puts living things in the
  maze, and everything else here says the place is empty. Worth revisiting if we ever want the maze
  to feel inhabited — that is a biome decision, not a room decision.
