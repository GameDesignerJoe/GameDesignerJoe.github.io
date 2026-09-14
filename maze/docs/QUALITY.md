# Is it worth walking? — the baseline

<!-- reviewed: v0.93.0 — measured against the game at v0.93.0, which is what this doc is -->

Joe, on the maze editor thread: *"I can say these words to you, but I don't see
you bringing the imagination to pull it off. I still find keys not in vaults
that I had to work my way to get to. I still find the exit easy to stumble into.
I still find myself finishing mazes in a couple minutes rather than 10-20. I'm
not seeing districts anymore. Rooms are not landing, there's not enough maze
hallways between rooms."*

Five complaints, all of them the same shape: a thing he asked for that the maze
does not do. This is what happens when you measure them instead of arguing about
them.

**The finding underneath all five: `harness.mjs` proves every maze is
*playable* — the exit is reachable, each door severs the route, every key is
winnable before its door — and not one of its invariants asks whether the maze
is worth walking.** Joe's five live entirely in the unmeasured half, which is
why they regress without anything going red.

## Reproducing this

```
python3 -m http.server 8765       # from the repo root, in another terminal

node maze/tools/quality.mjs       # the table below
node maze/tools/bots.mjs --phase N --size S    # time to finish
node maze/tools/shape.mjs --phase N --size S   # thresholds
```

`quality.mjs` sweeps every self at its own size. `bots.mjs` and `shape.mjs` take
one phase at a time, and default to the Child's size rather than the phase's, so
pass `--size` to match `PHASES`. 30 seeds a self throughout; differences under
about 5% at that count are noise.

## What a maze holds (v0.93.0, 30 seeds)

| self | size | floor | keys vaulted | **every key** | doors on route | exit at | beyond | locked | gauntlet | rooms | districts | room gap min/med |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| The Child | md | 502 | — | — | 0 | 0.72 | 22% | 0% | **16** | 4.6 | 0.4 | 14 / 21 |
| The Cartographer | md | 625 | 93% | **93%** | 1 | 0.76 | 22% | 0% | 0 | 3.4 | 0.9 | 20 / 24 |
| The Soldier | md | 641 | 43% | **3%** | 2 | 0.75 | 24% | 0% | 0 | 3.7 | 0.5 | 13 / 19 |
| The Archivist | lg | 1270 | 48% | **0%** | 2 | 0.81 | 14% | 0% | 0 | 11.1 | 1.1 | 6 / 13 |
| The Priest | lg | 1245 | 40% | **3%** | 2 | 0.79 | 16% | 0% | 0 | 7.2 | 1.9 | 12 / 20 |
| The Criminal | lg | 1242 | 33% | **0%** | 2 | 0.78 | 18% | 53% | 0 | 7.4 | 2.0 | 12 / 18 |
| The One Who Stayed | xl | 2456 | 50% | **0%** | 2 | 0.84 | 10% | 0% | 0 | 14.9 | 4.0 | 9 / 20 |
| You | sm | 315 | 77% | **77%** | 1 | 0.83 | 14% | 0% | 0 | 1.7 | 0.1 | 9 / 9 |

*every key* is the share of mazes where no key is loose. *exit at* is walking
distance to the exit over the maze's far point. *beyond* is how much floor lies
further out than the exit. *gauntlet* is squeeze-tree tiles guarding the way out.

## How long it takes (`bots.mjs`, 30 seeds, 200 explorer runs a maze)

| self | size | optimal route | explorer median | fastest 10% | key detour |
|---|---|---|---|---|---|
| The Child | md | 45s | 4m 11s | 1m 37s | — |
| The Cartographer | md | 57s | 7m 59s | 5m 10s | 27s |
| The Soldier | md | 40s | 6m 16s | 2m 51s | 13s |
| The Archivist | lg | 1m 02s | 12m 43s | 5m 46s | 19s |
| The Priest | lg | 60s | 11m 47s | 5m 18s | 16s |
| The Criminal | lg | 1m 13s | 16m 10s | 8m 10s | 31s |
| The One Who Stayed | xl | 1m 28s | 26m 30s | 12m 28s | 23s |
| You | sm | 35s | 3m 49s | 2m 19s | 12s |

## The shape of it (`shape.mjs`, 30 seeds)

| self | size | thresholds | biggest split | dead ends |
|---|---|---|---|---|
| The Child | md | 1.4 | 24% | 11 |
| The Cartographer | md | 0.2 | 3% | 38 |
| The Soldier | md | 0.1 | 3% | 31 |
| The Archivist | lg | 0.2 | 5% | 67 |
| The Priest | lg | 0.1 | 2% | 72 |
| The Criminal | lg | 0.1 | 2% | 73 |
| The One Who Stayed | xl | **0.0** | **0%** | 151 |
| You | sm | 0.8 | 17% | 21 |

## What the numbers say

**1. The content is 45–90 seconds long.** Knowing the maze, every level in the
game is that much walking, and going from md to xl — four times the floor — adds
thirty seconds of route. So the 10–20 minutes Joe wants is made entirely of
being lost, and being lost is the one thing a player burns off as they learn.
That is why he finishes in two minutes and the explorer bot does not: he is near
the oracle and it is blundering. Raising the ceiling means more *required*
route, not more floor.

**2. Keys: the average was hiding it.** `config.js` has long said, on
`manifestSettle`, that about 55% of keys get a nest, and that number was treated
as acceptable. Per maze it is not: in **every two-door self, 0–3% of mazes have
all their keys vaulted.** One-door selves are fine (77–93%). So from the Soldier
on, nearly every maze Joe plays has a key lying in a hall, and he was not
finding the unlucky 45% — he was finding the 97%.

The cause is in `generate()`: the retry loop scores a build as doors first, keys
in nests second, and stops once the *doors* are in and `manifestSettle` more
tries fail to better the keys. The vault is a tiebreaker that loses to door
placement, and nothing reports the shortfall. **A design requirement entered the
code as a preference.** That pattern, not a failure of imagination, is what
produced three of the five.

**3. Nothing guards the exit past the Child.** The squeeze gauntlet exists in
the Child's maze (16 tiles) and in no other self. The exit is locked only for
the Criminal, and only half the time. The exit is not badly placed — 0.72–0.84
of the way out, with 10–24% of the floor beyond it — it is simply unguarded.

**4. Districts are gone, and size makes it worse.** The xl maze, the biggest in
the game, has **zero thresholds**: 2,456 tiles with no interior boundary
anywhere. Note it against the districts column — The One Who Stayed has 4
districts and 0 thresholds. `generate.js` says why in its own comment: a district
can add floor and add connections, never take one away. Four districts you cannot
perceive is the same as none. `LABYRINTH.md` predicted exactly this before any of
it was built.

**5. Rooms clump.** The Archivist puts 11 landmarks in a lg maze with a 6-tile
minimum gap and a 13-tile median — a couple of seconds of walking between
places that are supposed to be different places. Compare the Cartographer, 3.4
rooms at 20/24. This is Joe's *"all the rooms are pushed into the same space"*,
and it is worst where there are most rooms.

## Two sweeps, one dead end and one real lever

**Braid is not what removed the thresholds.** The Child is the only self with
thresholds and the only one with braid off, which made it the obvious suspect.
It is not: with braid forced to zero, the Soldier's md maze goes 0.08 → 0.21
thresholds and the xl maze 0.00 → 0.04. Nothing. **No braid setting brings
structure back**, so don't spend a batch there.

**Dead space is the lever, and it does not reach.** The `fill` term in
`turnsPresets` — the dead-space preset the Child alone uses, via its phase's
`turns` — is the only knob in the game that moves thresholds:

| preset | md thresholds | xl thresholds | floor cost |
|---|---|---|---|
| auto (seven of eight selves) | 0.08 | 0.00 | — |
| `fewer` | 0.17 | 0.13 | none |
| `sparse` (the Child's) | 0.63 | 0.71 | −24% / −32% |
| `least` | 0.67 | 0.96 | −24% / −32% |

Eight to twelve times better, and **still under one threshold per maze** when a
maze with districts you can feel wants four or five. It also buys that by
deleting a third of the floor, which runs straight into Joe wanting bigger
mazes. So: a real lever, switched off for seven of eight selves, that cannot on
its own reach the target.

## What follows from this

Three of the five — keys, exit, key detour — are **contract failures, not tuning
failures**. The vault code, the gauntlet code and the door code all exist; the
generator does not insist on them and never reports a miss. That is a small
change, and no knob panel is needed for it.

The other two — districts, and a maze that takes 10–20 minutes — **cannot be
reached from the current config at all.** The best knob in the game tops out at
0.96 thresholds and costs a third of the maze. A tuning tool would find that
ceiling faster; it would not move it.

**No targets are set here on purpose.** What a good number is for any row above
is a design decision and Joe's to make. The point of this doc is that the
numbers exist, so that a change which quietly undoes one of them has somewhere
to show up.

## What this does not measure

- **The explorer bot is naive** — no map, no compass, no thread, no memory of
  the layout beyond where it has been. Its medians are a ceiling for a competent
  player, not a target. The oracle row is the floor. A real player is somewhere
  between, and Joe is near the bottom.
- Doors are ignored in the walking distances here; `bots.mjs` prices the locks.
- Nothing here looks at whether a room is *good*, only at where it is and how
  far it is from the next one.
- Prototypes and pool levels are out of scope.
