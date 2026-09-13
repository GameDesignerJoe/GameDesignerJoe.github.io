---
name: maze-task
description: Work the backlog for The Maze (the maze/ folder) from Joe's Google Doc — read the doc, group the items, build one group, verify it, ship it, report. Use when Joe says there are new tasks in the doc, names a fix for the maze, or asks to carry on with the maze backlog.
---

# Working a maze task

Joe's game lives in `maze/`. Read **`maze/docs/CLAUDE.md`** before touching anything —
it holds the standing agreements, the architecture, and a long list of decisions
already settled.

## 1. Read the rules, then the list

The backlog is a Google Doc, id `14pOj9HLuiGyPlaTVYo7sLt7xNAokqSFCk1d7hOKDqrs`.
Read it with `mcp__Google_Drive__read_file_content` (load via ToolSearch first).

- The **Rules for Claude** block at the top of that doc is the authority on how he
  wants to be worked with. It can change without anyone telling you. Follow it over
  anything in this skill.
- The **live backlog is the list above the first `DONE?`**. Nothing below it.
- **Skip items already shipped** unless he has added something underneath. A
  re-listed item is not done — it means it is still wrong.
- Never work `THOUGHTS`, `IDEAS`, `NOTES TO REMEMBER`, `Kid stuff` or
  `Abandonment` unless he asks.
- He dictates from his phone. *"The Wesson number"* is the version number; *"keep
  them clothes"* is closed. Read for intent and say which reading you took.
- A bare `-` bullet under an item is a **screenshot you cannot see**. Say so. Do not
  guess what is in it and quietly build the wrong thing.

## 2. Group, and say the order out loud

Group by **what the items touch**, not how many there are.

Five unrelated items is a fine batch. **Three that all change maze generation is
not** — each one shifts the geometry and silently invalidates the measurement you
took a minute ago. That is what made v0.75.0 thrash. Generation, movement, render
and UI are four different batches.

Tell him the grouping and the order before you start.

## 3. Confirm the report before you fix it

If an item is a bug report, **measure it first**. Two of Joe's reports turned out to
be true but not for the reason stated, and one thing he thought was missing was
present but too rare to meet. A ten-line probe in the scratchpad that prints the
real numbers per phase is worth an hour of guessing.

Name the metric before you measure it. Key-to-door distance got measured twice with
the wrong one — straight-line, then walking *through* the door being measured from.

### Measuring without burning an hour

Generation is the slow thing in this project, and nothing changes that: **about
40ms a maze**, so 840 mazes is ~35s and 2100 is ~90s. It is the same in a headless
browser and in bare Node — the browser is *not* the overhead, so do not go looking
for a faster runtime. Going wide costs what it costs; the savings are all in going
wide fewer times.

- **Sweep inside one run. Never `sed` a knob and re-run.** The probe already runs
  in the page: set `CONFIG.<knob>` between passes and loop the values in a single
  script. Eight `sed`-and-re-run cycles for one `vaultMax` sweep cost about five
  minutes and should have been one 35-second run. It also removes the risk of a
  run measuring a config you already edited back.
- **Explore at 120 seeds per self, confirm the winner at 300.** 840 mazes ranks
  options perfectly well; only the final two candidates are worth 2100. Differences
  under about 5% are noise at the smaller size — say so rather than reading them.
- **Measure in the page, with `SAVE` stated.** A bare Node bundle of the data and
  `generate.js` loads and runs, but gives *different numbers on the same seeds*,
  because generation reads `SAVE.ui` and `SAVE.collected` that other scripts set.
  Set every `SAVE` field your metric depends on explicitly, in the probe.
- **Stop when the data has answered.** One cycle this batch built a two-pass door
  placer to fix an over-counting model the instrumentation had already shown was
  not the dominant failure. It changed nothing in 840 mazes and was deleted.

## 4. Build one group

- New tuning goes in a `CONFIG` knob in `maze/data/config.js`, commented.
- New text goes in `maze/data/text.js`. Never inline.
- Comment **why**, with his words where they explain it. The codebase is written to
  be read a year later.
- A new generation feature needs **its own RNG stream** (`rng(seed + <a prime>)`).
  Drawing from `generate()`'s own `R` shifts every decision downstream and redeals
  every seed in the game.

## 5. Verify — this is the part that gets skipped

```
python3 -m http.server 8765          # must be up, or every run errors
node maze/tools/smoke.mjs            # behaviour, ~4 min
node maze/tools/selftest.mjs         # proves the invariants can fail, ~90s
node maze/tools/harness.mjs          # generation invariants across 576 mazes, ~90s
```

**Run harness and selftest together; run smoke on its own.** They are read-only
processes over the same files and server, so nothing conflicts — but a dozen of
smoke's checks measure real time (walking speed, animation counts, ripple
travel), and the harness is heavy enough to starve them of frames. Three suites
at once produced three red timing checks in v0.88.0 that all passed the moment
smoke ran alone. Wait on each and read each: a suite that errored looks nothing
like one that failed.

**How much to run depends on what you touched**, and Joe set this dial:

| the change touches | run |
|---|---|
| generation (`generate.js`, `proto.js`, any `CONFIG` knob they read) | all three, every time |
| render, UI, text, audio, movement | smoke, plus look at it |

Generation is the one where a change 200 lines away silently invalidates an
invariant, which is the whole reason the harness exists. Nothing else in the game
has that property.

- **Look at it.** A Playwright shot at 430×900, `deviceScaleFactor: 2`. Landscape
  too if it touches layout.
- **Add a smoke check for the new behaviour, then verify the check fails when you
  revert the feature.** A check that cannot fail is worse than none — two in this
  repo passed with their feature deleted.
- **When a check goes red after an unrelated change, suspect the check.** Four did
  in v0.75.0 and all four were brittle: a frame count, a five-seed search, an
  averaged pixel sample, and a probe parked in the path of the swing it watched. Four
  more did in v0.88.0, when re-rolling the seed gave every maze different
  geometry: a probe that walked into a locked door and reported "never turned", a
  charcoal count topped back up by pickups it walked over, and two that passed on
  a different `--seed`. **Run it again, and run it on another seed, before you
  believe a red check that has nothing to do with what you changed** — and when a
  probe needs a feature of the maze, have it search for one that qualifies rather
  than taking the first thing that looks close.
- **The harness is clean and has been since v0.85.0.** Older notes said it carried
  a deferred door-key soft lock; that was fixed. PASS 576 is the expected result,
  so treat *any* red as this batch's until proven otherwise — and check whether
  `HEAD` is red too before you believe it is yours.

## 6. Ship

Bump `VERSION` in `maze/js/core.js`, write the change up in `maze/docs/CLAUDE.md`,
commit, push to `main`. A pre-commit hook runs the smoke suite and blocks the
commit if it is red — if it blocks you, the suite is telling you something true.

Commit messages end with the attribution footer (see `maze/docs/CLAUDE.md`).

### Before you commit, one question about the docs

Not "update the docs" — most of what is in them is *why*, and why does not rot.
The parts that rot are the ones that claim what is true **right now**, and there
are only two that do real harm when wrong:

- **`HANDOFF.md` §6**, the list of things not to re-propose. A rejection that has
  since been reversed will stop work that Joe already asked for.
- **`PROGRESSION.md` §8**, what exists today. Anything shipped and missing from it
  reads as not built.

So: **does what I just built contradict either of those?** Usually no, and then
there is nothing to do. When it does, fix those lines in the same commit — not
later, because later is how they ended up 45 versions behind.

Two habits that keep the rot from starting again:

- **Do not copy a source of truth into a doc.** `NOTES.md` was a copy of Joe's
  Drive backlog and was wrong within three days. Point at the original.
- **Name a knob, do not quote its value.** Write `squeezePinch`, not
  `squeezePinch: 0.55` — the name stays true when Joe retunes it on his phone,
  and the number is one `data/config.js` away for anyone who wants it.

Every doc carries a `<!-- reviewed: vX.Y.Z -->` stamp meaning *last read against
the game*. `node maze/tools/docs-check.mjs` reports how far behind each one is,
and the hook passes on its verdict when the suite is green. **Bump a stamp only
when you have actually re-read that doc** — bumping it because you edited one
line is how the whole thing becomes theatre.

## 7. Report

What shipped, **the version number**, and what the suites say — including anything
still failing. If a trade-off came up between two things he has asked for, that is
his call: give him the numbers rather than settling it yourself.

## Method, in one line each

- Check the edit landed. A scripted edit whose `assert` throws writes nothing, and
  the next command may still run against stale numbers.
- Instrument by the second hypothesis, not the sixth.
- One background job at a time **that writes**. Read-only jobs — the three suites,
  a probe — can run together freely; two jobs editing the same file cannot, and a
  `sed` on `config.js` while a measurement is loading it is exactly that.

- Confirm a suite passed **before** writing it into a commit message. An errored run
  looks nothing like a failing one.

### Working in parallel

Joe's call, and it is settled: **no subagents on this project.** Most of what looks
parallelisable here is not, because it shares one working tree and one
`config.js` — two jobs sweeping knobs will overwrite each other and both report
numbers for a config neither of them set. And an agent starts with none of the
context in these docs, so anything touching Joe's intent, a trade-off, or whether
a check is brittle was never safe to hand off anyway.

What does run at once, with plain background jobs: the three suites, and any set
of read-only probes. That is where the wall-clock actually is.
