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
node maze/tools/smoke.mjs            # behaviour
node maze/tools/selftest.mjs         # proves the invariants can fail
node maze/tools/harness.mjs          # generation invariants, ~90s
```

- **Look at it.** A Playwright shot at 430×900, `deviceScaleFactor: 2`. Landscape
  too if it touches layout.
- **Add a smoke check for the new behaviour, then verify the check fails when you
  revert the feature.** A check that cannot fail is worse than none — two in this
  repo passed with their feature deleted.
- **When a check goes red after an unrelated change, suspect the check.** Four did
  in v0.75.0 and all four were brittle: a frame count, a five-seed search, an
  averaged pixel sample, and a probe parked in the path of the swing it watched.
- The harness has **known deferred failures** (the door-key soft lock). Report the
  count; do not fix it.

## 6. Ship

Bump `VERSION` in `maze/js/core.js`, write the change up in `maze/docs/CLAUDE.md`,
commit, push to `main`. A pre-commit hook runs the smoke suite and blocks the
commit if it is red — if it blocks you, the suite is telling you something true.

Commit messages end with the attribution footer (see `maze/docs/CLAUDE.md`).

## 7. Report

What shipped, **the version number**, and what the suites say — including anything
still failing. If a trade-off came up between two things he has asked for, that is
his call: give him the numbers rather than settling it yourself.

## Method, in one line each

- Check the edit landed. A scripted edit whose `assert` throws writes nothing, and
  the next command may still run against stale numbers.
- Instrument by the second hypothesis, not the sixth.
- One background job at a time, never one editing files a foreground job is editing.
- Confirm a suite passed **before** writing it into a commit message. An errored run
  looks nothing like a failing one.
