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
| floor tiles | 227 | 455 | 896 | 1777 |
| thresholds | 2.5 | 2.6 | 1.5 | 1.9 |
| longest threshold run | 23 tiles | 18 | 19 | 13 |
| biggest split | 38% of the floor | 40% | 27% | 18% |
| junctions | 84 | 137 | 226 | 407 |
| **tiles between junctions** | **2.7** | **3.4** | **4.0** | **4.4** |
| dead ends | 9 | 14 | 29 | 55 |

Three things fall out of this, and they are the whole diagnosis.

**There are no thresholds.** Two per maze, and the biggest one only divides the
floor 40/60 at md. A maze with two divisions has three places in it. Everything
else is one continuous mesh, which is exactly why it all feels the same.

**It gets worse as the maze gets bigger, not better.** From sm to xl the floor
grows eight times, the thresholds fall from 2.5 to 1.9, and the biggest split
falls from 38% of the floor to 18%. Size today multiplies the muddle. **Making
the maps bigger without structure would make this worse, and that is the single
most important number here.**

**The maze asks a question every three tiles.** 137 junctions at md, one every
3.4 tiles — a decision every 1.5 seconds of walking. Nobody can hold a map of
that in their head, and it is why chalk does not pay: you would have to mark
every third tile. This is the same thing Joe noticed as "excessive branches make
it not ideal to use chalk".

Two more numbers from `bots.mjs` that bear on the plan:

- **Perfect play barely changes with size.** 50s at md, 1m 29s at xl — eight
  times the area for 39 extra seconds, because the exit sits in the opposite
  corner and the shortest route is roughly the diagonal. Even moving the exit to
  the furthest tile in the maze only takes xl to 1m 45s.
- **Brute force works.** Walking every reachable tile is 7m 45s at md and 27m at
  xl. Tedious, but it is a winning strategy, and no amount of area stops it.
  What stops it is a route that is a *tour* rather than a path — somewhere you
  have to go and come back from. That is the offerings, not the size.

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

| | today (md) | target (md) |
|---|---|---|
| sections | — | 6–10, of 60–150 floor tiles each |
| thresholds | 2.6 | one per boundary: 5–12 |
| threshold corridor | — | 6–12 tiles, nothing branching off it |
| tiles between junctions | 3.4 | 8–15 (a question every 3–6 seconds) |
| landmarks | — | one a section, unique in the maze |
| section graph | — | a tree, plus at most one loop |

**A tree at the section level, loops inside sections.** One way between any two
places is what makes a mental map possible and chalk worth carrying; loops
inside a section are what make the section itself confusing to be in. Lost
locally, clear globally — which is what a labyrinth is, and what the Backrooms
feel like. It is also the one decision here that is genuinely arguable: a tree
punishes a wrong turn with a full walk back.

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
