# Verification tools

The pass that `docs/HANDOFF.md` §9 says to run after every change. It went
missing — §9 describes it but it was not in the repo — so this is a rebuild.

Nothing here edits `maze-topdown.html`. The game's top-level `let`/`const` sit
in the page's global lexical scope, so a Playwright page can call `generate()`
and read `tiles`, `doors`, `pockets` and the rest by name. The game needs no
test hooks and carries no test code.

## Running them

Serve the repo, then run from the repo root:

```
python3 -m http.server 8765          # in another terminal

node maze/tools/harness.mjs          # generation invariants, ~1900 mazes
node maze/tools/smoke.mjs            # behaviour: boot, walk, mark, save, pool
node maze/tools/selftest.mjs         # proves the invariants can actually fail
```

Each exits non-zero on failure. `--port` overrides 8765 everywhere.

## What each one is for

**`harness.mjs`** sweeps `generate()` across every phase, three stone counts and
many seeds, in both normal and pool mode, and checks the invariants in
`checks.mjs`. About 30 seconds for 1920 mazes.

```
node maze/tools/harness.mjs --seeds 40             # bigger sweep
node maze/tools/harness.mjs --phase 2 --seed 1000  # reproduce one maze
node maze/tools/harness.mjs --pool                 # pool levels only
```

Every failure prints the phase, stone count and seed, plus the exact command to
reproduce it.

**`checks.mjs`** holds the invariants. They deliberately do not call the game's
own `isOpen()` or `walkable()` — a bug in those should not be able to hide
itself from the checks. The flood fills are ours.

The one modelling subtlety is sliders. A slider's home tile is open and the cell
it pushes into is closed, so a pocket behind one looks unreachable to a naive
flood. For *reachability* both tiles count as open, since the player can shift
it and shift it back. For *door severing* that would be wrong — no single game
state has both open, and union-opening every slider at once invents corridors —
so severing is tested on the grid as generated, then again with each slider
shifted on its own.

**`smoke.mjs`** drives the real game through real touch input: boots to the
title screen, taps the sleeper, walks with the stick, marks with chalk, saves,
reloads, and lays out a pool level. It asserts the movement *behaviour* —
continuity and staying on the corridor centreline — because §9's lesson was that
the recentering ease went missing for two versions while every frame still
rendered. It also checks every id the script reaches for still exists, after the
CSS range-replacement that once left the game paused on an invisible card.

**`selftest.mjs`** breaks a known-good maze eleven ways and asserts the right
check notices each one. A check that can never fail is worse than no check, so
run this after editing `checks.mjs`.

**`diagnose.mjs`** prints one maze's door and key chain in detail, and works out
whether it is finishable at all. For investigating a harness failure.

```
node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7
```

## Known failure

`harness.mjs` currently reports **10 unfinishable mazes in 1920** — about 1.4%
of the mazes that have locked doors. The key for a door is sometimes placed in a
sealed pocket that lies behind that same door, so the door can never be opened
and the exit can never be reached.

`docs/HANDOFF.md` §4 says keys are hidden by score, "sealed pockets best of
all". The scorer appears not to check that the pocket is on the near side of the
door the key opens.

Reproduce:

```
node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7
node maze/tools/diagnose.mjs --phase 3 --seed 175218 --stones 0
```

Not fixed — the fix belongs in `generate()`, and HANDOFF §1 says to propose
rather than presume.
