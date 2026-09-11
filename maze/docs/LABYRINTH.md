# The labyrinth

Joe, planning: *"the maze has to be learnable, and for that to happen there
needs to be unique things they come across that tell them where they are. The
maze also has to demand the players circle back or return to different locations
multiple times. And finally, it needs to be big enough for all of this to exist
and for players to be a little desperate to use the tools we give them."*

This is the plan for that, the measurements it is based on, and the order to do
it in. Measured with `tools/shape.mjs` and `tools/bots.mjs`.

## What the maze is today, measured

The Child's maze, 12 seeds a size. A **threshold** is a run of tiles whose
removal splits the floor into two pieces, the smaller of which is at least 15%
of it — that is what "leaving one place and entering another" is, said as a
graph. A **junction** is a tile with three or more ways out.

| | sm 25×33 | md 33×45 | lg 45×61 | xl 61×85 |
|---|---|---|---|---|
| floor tiles | 229 | 456 | 899 | 1789 |
| thresholds | 2.5 | 2.5 | 1.6 | 2.6 |
| longest threshold run | 16 tiles | 19 | 22 | 17 |
| biggest split | 36% of the floor | 37% | 27% | 21% |
| corridor forks | 16 | 28 | 56 | 115 |
| corridor tiles between forks | 10.0 | 12.5 | 13.0 | 12.8 |
| dead ends | 9 | 14 | 29 | 53 |
| room tiles | 81 | 126 | 184 | 330 |

**A correction, because the first pass of this was wrong.** The junction count
originally read 84 at sm and 137 at md — a fork every 3.4 tiles — and that was a
bug in the measurement, not a fact about the game. It counted every tile in an
open room as a junction, and a room has three ways out of every tile in it while
asking you nothing, because you can see all of it. Counting only forks in
corridor, the maze asks a question every 10–13 tiles, which is about five
seconds of walking. **So "too many branches" is not what makes the maze
illegible, and it is not why chalk goes unused.** Whatever is wrong with chalk
is something else — most likely that there is nothing worth marking, which is
the same problem as everything else here.

What does survive the correction, and it is the important half:

**There are no thresholds.** Two or three per maze, and the biggest one only
divides the floor 37/63 at md. A maze with two divisions has three places in it.
Everything else is one continuous mesh, which is why it all feels the same.

**It gets worse as the maze gets bigger.** From sm to xl the floor grows eight
times and the biggest split falls from 36% of the floor to 21%. Size today
multiplies the muddle. **Making the maps bigger without structure would make
this worse, and that is the most important number here.**

## Why the districts did not fix this

They were built to. What they lack is a boundary. `generate.js` says it plainly:

> A district can add floor and add connections. It can never take a connection
> away.

A district is a rectangle of strange carving inside one continuous maze. It has
a texture but no edge and no door, so there is no moment of entering it. The
machinery is right — pick a region, give it a heart of its own, carve it its own
way — and it is most of a section already. What has to change is that rule.

## What we are building instead

A **section** is a district that owns its ground: it seals its border and keeps
one or two ways in. A **threshold** is the corridor between two sections, long
and clean, with nothing branching off it. A **landmark** is the one thing in a
section that tells you which section you are in.

Starting spec, to be argued with:

| | today (lg) | target | **the prototype** |
|---|---|---|---|
| sections | — | 8–12 | **10** |
| thresholds | 1.6 | 4+ | **3.8** |
| longest threshold run | 22 tiles | 20+ | **34** |
| biggest split | 27% | 40%+ | **43%** |
| room tiles | 184 | more | **475** |
| landmarks | — | one a section | **one a section, 6 kinds** |
| section graph | — | a tree | **a tree** |

**A tree at the section level, loops inside sections.** One way between any two
places is what makes a mental map possible and chalk worth carrying; loops
inside a section are what make the section itself confusing to be in. Lost
locally, clear globally — which is what a labyrinth is, and what the Backrooms
feel like. It is also the one decision here that is genuinely arguable: a tree
punishes a wrong turn with a full walk back.

## Built: the Labyrinth prototype (v0.64.0)

In the Prototype menu next to Two-way blocks. `buildLabyrinth()` in `js/proto.js`.

- **Sections.** A BSP cuts the cell grid into 8–12 rooms-worth of ground, each
  eating one cell as a seam so no two ever touch. Each is carved its own way —
  a **warren** that loops back on itself, a **hall** of long straight runs, a
  **court** built round a bigger room — so being in one does not feel like being
  in another.
- **A room at the heart of every one.** `labyHeart` cells of open floor, corners
  included. A landmark standing in a corridor is decoration; a landmark standing
  in a room is a place you can name.
- **Thresholds.** For every branch of the section tree, a hall is carved through
  the dead seam: out of one section, along the seam a few cells, into the next.
  Nothing ever branches off it, because nothing else is carved out there. The
  longest runs 34 tiles.
- **A tree, so there is one way between any two sections.** The loops are inside
  sections, where being lost is the point. Lost locally, clear globally.
- **Landmarks.** Pool, statues, spiral, columns, dais, well — one a section, and
  never the same as a neighbour's. There are more sections than kinds on
  purpose: Joe, *"this statue looks the same as another place I've been, but the
  floor texture is different."* Each section also carries a `tone` for that, not
  yet used in the drawing.
- **Chalk on the floor**, because the whole question is whether you reach for it.

What it costs to walk, against an lg maze of the same 45×61 grid:

| | lg today | labyrinth |
|---|---|---|
| floor (perfect play) | 1m 06s | 1m 09s |
| explore, median | 6m 42s | 8m 52s |
| explore p10 – p90 | 2m 36 – 11m 20 | 4m 28 – 12m 02 |
| sweep | 14m 04s | 16m 53s |

The median goes up by a third, and **the bottom of the range goes up by nearly
two minutes**: the lucky run through a labyrinth is much less lucky than the
lucky run through a mesh, because there is no cutting across. That is structure
doing its job.

**Still to do in it**, in the order of the plan below: the section tone is
carried but not drawn; there are no offerings yet; and the sections read as
rectangles on the map, which is honest for a prototype but wants softening if
this becomes the real generator.

## The order

Not all at once. One of these is load-bearing and the rest are dressing on it.

**1 & 2 together — sections, thresholds, and one landmark each.** They ship in
one build because a section with nothing in it is invisible: you cannot tell
whether the structure worked until something in the room tells you which room it
is. This is the big one and it is a change to the carve itself.

**3 — offerings.** Statues you have to bring something to. This is the return
trip, and it is the thing that actually kills brute-forcing, because walking
every corridor no longer tells you what you need. It needs landmarks first: an
offering you cannot remember the way back to is a fetch quest with a map, not a
labyrinth.

**4 — size, last.** Turn it up once there is structure to multiply. The table
above is the argument: today size makes the maze less legible, not more.

Branching and turns get tuned inside step 1 — "fewer junctions" is a per-section
setting, not a separate job.

## How we will know it worked

`shape.mjs` and `bots.mjs` are the before-and-after instruments, and the table at
the top is the baseline. After step 1 we should see, at md: thresholds 5–12
rather than 2.6, tiles between junctions 8–15 rather than 3.4, and the biggest
split near 50% rather than 40%.

The one to add is **learnability**: the explorer bot run twice on the same maze,
the second time remembering which sections it has been through. Today that is
worth nothing, because there is nothing to remember. When it is worth a lot, the
maze is learnable.

New invariants for the harness, so this cannot rot:

- every section has one or two ways in, and no more
- a threshold corridor has no side passages along its length
- the section graph is connected, and it is a tree (plus at most one loop)
- every landmark is reachable, and unique in the maze
