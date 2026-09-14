# Is it worth walking? — the baseline

<!-- reviewed: v0.97.0 — re-measured against the game at v0.97.0, which is what this doc is -->

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

open http://localhost:8765/maze/tuner.html    # look at it
node maze/tools/quality.mjs       # the table below
node maze/tools/bots.mjs --phase N --size S    # time to finish
node maze/tools/shape.mjs --phase N --size S   # thresholds
```

`quality.mjs` sweeps every self at its own size. `bots.mjs` and `shape.mjs` take
one phase at a time, and default to the Child's size rather than the phase's, so
pass `--size` to match `PHASES`. 30 seeds a self throughout; differences under
about 5% at that count are noise.

## What a maze holds (v0.97.0, 30 seeds)

| self | size | floor | keys vaulted | **every key** | exit at | beyond | locked | gauntlet | rooms | room gap min/med | divides | **fell short** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| The Child | md | 503 | — | — | 0.69 | 23% | 0% | **17** | 4.0 | 6 / 18 | 1.57 | 13% |
| The Cartographer | md | 624 | 93% | **93%** | 0.79 | 18% | 0% | 0 | 3.2 | 10 / 16 | 0.27 | 100% |
| The Soldier | md | 640 | 43% | **3%** | 0.76 | 24% | 0% | 0 | 3.5 | 2 / 12 | 0.10 | 100% |
| The Archivist | lg | 1269 | 48% | **0%** | 0.82 | 15% | 0% | 0 | 11.0 | **0** / 8 | 0.20 | 100% |
| The Priest | lg | 1246 | 40% | **3%** | 0.80 | 16% | 0% | 0 | 7.2 | 8 / 12 | 0.07 | 100% |
| The Criminal | lg | 1241 | 33% | **0%** | 0.79 | 16% | 50% | 0 | 7.2 | 6 / 10 | 0.10 | 100% |
| The One Who Stayed | xl | 2459 | 50% | **0%** | 0.85 | 10% | 0% | 0 | 15.0 | 6 / 10 | 0.03 | 100% |
| You | sm | 316 | 77% | **77%** | 0.85 | 12% | 0% | 0 | 1.7 | **0** / 14 | 0.87 | 100% |

*every key* is the share of mazes where no key is loose. *exit at* is walking
distance to the exit over the maze's far point. *beyond* is how much floor lies
further out than the exit. *gauntlet* is squeeze-tree tiles guarding the way out.
*fell short* is the share of mazes `generate()` could not build to the chapter's
`MUST` row — new in v0.97.0, and the number that was missing all along.

**The room gap column is lower than the v0.93.0 printing of this doc, and the
old numbers were wrong.** `quality.mjs` carried its own copy of the measurement
and it took a room's distance to another room from a flood that could *start* at
a well but never *finish* at one — and 17% of landmarks are wells, which stand
in the wall. So a well was invisible as a destination and the gap read high, by
up to 46 tiles on one Child maze. There is one measurement now, `js/contract.js`,
checked against a pairwise reference over 88 mazes with no mismatch. Rooms are
closer together than this doc first said, not further apart.

**Two rooms can land on the same tile.** 1 maze in 30 for The Archivist and 1 in
16 for You, with 7 of 30 Archivist mazes putting two rooms within 4 tiles. That
is a placement bug rather than a tuning one, and it is the sharp end of *"rooms
are not landing."*

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

Three of the five — keys not buried, the exit unguarded, rooms on top of each
other — are **contract failures, not tuning failures**. The vault code, the
gauntlet code and the room placer all exist; the generator does not insist on
them and never reports a miss. That is a small change, and no knob panel is
needed for it.

**A correction, because the first reading of this doc got it backwards.** The
key detour was listed here as a fourth failure, on the strength of its 12–31
seconds looking small. Measured against the route it is added to, it is the
opposite — at 2.31 tiles a second, those seconds are 54–90 tiles, and the key
**adds 36–93% to the optimal route**:

| self | unlocked | locked | the key adds |
|---|---|---|---|
| The Cartographer | 29.6s | 57.0s | 93% |
| The Soldier | 27.1s | 40.4s | 49% |
| The Archivist | 42.8s | 62.0s | 45% |
| The Priest | 43.8s | 59.9s | 37% |
| The Criminal | 41.8s | 73.0s | 75% |
| The One Who Stayed | 64.7s | 88.0s | 36% |
| You | 22.9s | 35.1s | 53% |

Keys are the single most effective thing in the game at lengthening a route, and
"a twenty-second errand" was the wrong way to read that column. So `keyDetour`
stays a clause in the contract, but as **a floor to defend rather than a gap to
close** — it is already good and should not be allowed to drift back.

What is wrong with keys is the other half of Joe's sentence. *"Getting a key
should be an adventure"* is not a complaint that the walk is short; it is that
the walk ends at a key lying in a corridor. That is `keysVaulted`, and that one
really is 0–3%.

The other two — districts, and a maze that takes 10–20 minutes — **cannot be
reached from the current config at all.** The best knob in the game tops out at
0.96 thresholds and costs a third of the maze. A tuning tool would find that
ceiling faster; it would not move it.

## What enforcing the contract did, and did not, do (v0.97.0)

`generate()` now builds against the chapter's `MUST` row and records what it
could not meet in `contractMiss`. The prediction when this was proposed was that
making the requirement hard would collect three of the five. **It did not. The
keys did not move at all:**

| self | every key, before | every key, after |
|---|---|---|
| The Cartographer | 93% | 93% |
| The Soldier | 3% | 3% |
| The Archivist | 0% | 0% |
| The Priest | 3% | 3% |
| The Criminal | 0% | 0% |
| The One Who Stayed | 0% | 0% |
| You | 77% | 77% |

The reason, in hindsight, is in the old code: the retry loop was *already*
ranking builds by keys-in-nests as a tiebreaker. It was doing its best the whole
time. Writing the same preference down as a requirement does not give the loop
anything new to find — a maze with both keys buried turns up in about 3% of
builds, and five or six tries cannot reliably find one. **A requirement the
generator cannot satisfy is not made satisfiable by insisting.**

So the lesson is the opposite of the one this doc started with. The three
"contract failures" are not fixed by a contract. What the contract bought is
narrower and still worth having:

- **The shortfall is now visible.** Every chapter but The Child fails its row in
  100% of mazes, and says which clauses. That number did not exist before, and
  its absence is exactly how "keys should be in vaults" stayed shipped-and-broken.
- **It holds a line.** A later change that makes any of this worse now has
  somewhere to go red.
- **It costs about what it did before.** Same number of builds a maze as
  v0.93.0 — 9.3 at md, 8.4 at lg, 9.2 at xl — plus 8ms (md), 17ms (lg) and 38ms
  (xl) of measuring. Worth knowing: an xl level load was *already* ~760ms of
  building before any of this, because the loop already ran nine builds.

One thing did move, and it moved because of a mistake worth recording. The first
cut weighted every clause equally, and 20 of 20 Soldier mazes then shipped with a
loose key, because a build could win by gaining a threshold while dropping a key
into a hall. Weighting `keysVaulted` above the rest together put it back. Equal
weights are not neutral; they are a claim that Joe's first complaint matters as
much as his last.

**What would actually fix the keys** is placement, not selection: put the key in
a nest rather than build mazes until one lands there. That is a change to how
keys are assigned, it is a generation change of its own, and it belongs in its
own batch.

## Where the targets live now

`data/phases.js` carries a `MUST` row per chapter — the contract: keys buried,
exit guarded, key detour, rooms apart, thresholds. `js/contract.js` measures a
maze against it and says which clauses it met; `tuner.html` shows a block of
mazes with every miss called out, and lets a number be tried before it is typed
back into the file. Nothing in the running game reads `MUST` yet, so a maze the
player walks is still built exactly as this doc measured it.

The first numbers in `MUST` were picked by a stated rule rather than by feel,
and the rule is written above the table there: hold a line where the game is
already good, reject roughly the worst quarter where it can improve, and leave
the clause red where the feature does not exist yet. `exitGuard` and
`thresholds` are red on purpose for almost every chapter — that is the missing
gauntlet and the missing structure, made visible in the place where the work
would happen.

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
