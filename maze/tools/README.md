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
node maze/tools/harness.mjs --turns least          # with a Turns debug preset
node maze/tools/harness.mjs --clusters lattice    # every district forced to one heart
node maze/tools/harness.mjs --clusters off        # districts off: the v0.37.0 baseline
```

`--turns fewer|sparse|least` sets `SAVE.ui.turns` before generating, exactly as
the Turns menu does, so the pruned, straightened carver is swept by the same
checks. `--clusters` does the same for the Districts menu, and the sweep prints
a tally of which hearts got stamped. With `--clusters off` the sweep must still
find the same 10 soft-locked seeds, which is how v0.38.0 proved that districts
are the only thing it changed about generation.

Every failure prints the phase, stone count and seed, plus the exact command to
reproduce it.

As of v0.48.0 the sweep runs **20 checks** and `smoke.mjs` **29**.

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

**`no corridor is cut off`** is the invariant that guards districts: every floor
tile must be walkable from the mat, so a re-carve that cut a link it did not own
would show up as orphaned corridor rather than as a maze that merely looks odd.
It passes on the v0.37.0 baseline too, so it is a real invariant and not a
description of the new code — and it immediately caught a latent one: `braid`
would join two pruned cells and leave a floor tile walled in on both sides, in
5 of 576 Sparse mazes. Auto never had it, because a full grid has no pruned
cells to join.

`smoke.mjs` also covers the Full map debug view since v0.39.0: that a tap
stands you where you tapped and brings the camera with it, that a drag pans
instead of teleporting, that zoom holds its anchor point and stops at both
ends, and that with Full map off a tap on the maze does nothing at all. Telling
a tap from a drag is the part that would rot silently.

v0.40.0 added four more: that a debug option applied with Full map ticked
leaves a title screen you can actually tap, that the map returns once you are
awake, that **New maze** rerolls the seed while keeping phase, stones and
pages, and that a run saved by a different build is discarded rather than
restored onto a maze that build never carved.

**`selftest.mjs`** breaks a known-good maze eleven ways and asserts the right
check notices each one. A check that can never fail is worse than no check, so
run this after editing `checks.mjs`.

**`diagnose.mjs`** prints one maze's door and key chain in detail, and works out
whether it is finishable at all. For investigating a harness failure.

```
node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7
```

## Known failure

`harness.mjs` reports **40 unfinishable mazes in 1920** as shipped, and **11 in
1920** with `--clusters off`. The key for a door is sometimes placed in a sealed
pocket that lies behind that same door, so the door can never be opened and the
exit can never be reached.

Districts quadrupled it, and not by adding pockets or loops — `comb` adds
neither and still doubles it. Re-carving near the route leaves the door placer
fewer gaps that truly sever it, so doors crowd into choke points and the
section behind a door more often holds nothing but its own pocket. Forcing one
heart everywhere, over 1920 mazes each:

```
off 10    rings 14    comb 23    lattice 23    shifting 30    (auto mix) 40
```

The Child has no locked doors, so that level cannot soft-lock whatever the
districts do.

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

## After the v0.32.0, v0.33.0 and v0.34.0 splits

Data moved to `maze/data/` and the engine to `maze/js/`, all as plain scripts
loaded in order. The harness needed no changes at all: the pieces still declare
the same names in the same global lexical scope, so `page.evaluate()` reaches
`CONFIG`, `generate`, `tiles` and the rest exactly as before.

Both splits were verified by re-running the sweep and confirming it finds the
same 10 soft-locked seeds — generation is bit-identical across each.

`smoke.mjs` gained two checks for the new shape: the script tags must load data
first and then the engine in the exact expected order, and every referenced file
must exist with none left on disk unloaded. Order is load-bearing now, and a
reordered tag is not something a glance at the page would reveal.

v0.34.0 moved the stylesheet to `css/style.css`. That one could not be checked
byte-for-byte, because the rules were dedented on the way out of the `<style>`
block, so it was verified two better ways instead: every rule the browser parses
(`cssText`, in order) and the computed style of all 65 elements with an id, plus
a pixel-identical screenshot of the rendered page. `smoke.mjs` gained a check
that the sheet is attached and full — a 404 on it would leave the game unstyled
while every other check still passed.

One wrinkle worth knowing: `#fade` computes a different opacity on every run,
because it is the fade-in overlay mid-animation. Capturing the same build twice
shows the same difference, which is how it was ruled out.

`split-data.mjs`, `split-engine.mjs`, `split-css.mjs` and `analyze-engine.mjs`
are the tools that did the splits and surveyed the file. Kept because they
record exactly what was moved and how it was checked.

## Corridor shape

`hall-metrics.mjs` measures what the Turns presets actually do to the maze at
cell level — share of the grid used, turns and junctions, dead ends, mean and
longest straight run, route length — averaged over seeds, for Auto, Fewer,
Sparse and Least side by side. `--shot sparse out.png` also captures the game's
own Full map view of one seed, so a number can be checked against the picture.

Districts are **off** in this tool by default, so the table compares the carver
alone; `--clusters auto` or `--clusters <heart>` includes them.

```
node maze/tools/hall-metrics.mjs --size xl --seeds 8
node maze/tools/hall-metrics.mjs --size xl --clusters lattice --shot sparse out.png
```

X-Large, Child phase, districts off, mean of 8 seeds:

```
                        Auto      Fewer     Sparse    Least
  grid used             100%      100%      68%       59%
  turns + junctions     702       383       345       182
  dead ends             171       73        40        12
  mean straight run     2.9       4.8       3.9       6.7   cells
  longest straight run  11        28        17        36    cells
```

## Audio tools

`audio-probe.mjs` wraps Web Audio before any page script runs and logs every
node, gain and start, so two builds can be compared. `audio-ab.mjs` counts
`AUDIO.*` calls on a scripted run without disabling the autoplay policy, which
is what a phone does.

```
node maze/tools/audio-ab.mjs --port 8765 --phase 0
```

Together they settled a report that the sound had regressed after the splits.
It had not — `AUDIO` and `MUSIC` were byte-identical and both builds produced
the same call profile. What the probes found instead was that
`AUDIO.swing()` played at full volume regardless of where the player stood: on
the Child level, a low boom every 1.6s from a swing 25 tiles of walking away,
about nine times a musicbox note, burying the music. Fixed in v0.35.0 with
`earshot()` and the `sfxNearTiles` / `sfxRangeTiles` knobs; `smoke.mjs` now
asserts the falloff curve.
