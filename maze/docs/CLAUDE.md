# The Maze — read this first

<!-- reviewed: v0.76.0 — the routing, the layout facts and the working rules re-read against the game; the per-version sections below are a dated log and stay as written -->

**The game is the source of truth.** `../maze-topdown.html` outranks every
document here, including this one. When a doc and the game disagree, the game
is right and the doc is history. Fix the doc; never change the game to match a
doc.

**How Joe and I work** is below — where the backlog lives, which parts of it to
touch, what ships with a change, and the method mistakes worth not repeating.
Read it before taking a task from the doc.

Read in this order: `HANDOFF.md`, then `PROGRESSION.md`. `labyrinth/` is a
different project — reference only.

## The path into the text, under the line (v0.103.0)

Joe approved this back at the writer's-page discussion — *"Love the line ids
idea. Let's do that."* — and it did not get built. Two versions of writer
tooling shipped around it. He caught it: *"Weren't you supposed to add in a debug
element that would show the ID of every string when I played? I don't see the
feature in the debug option to turn it on."* He was right.

`Show me → Line IDs on text`. Under every line the game shows, in small dim
monospace, the path that line lives at in `data/text.js`:
`SELF_LINES["The Child"][3]`, `MOMENTS.exitLocked._`,
`ROOM_LINES["The Cartographer"].basin[2]`. The same id
`tools/text-index.mjs` prints and `writer.html` is keyed by, so a screenshot
off the phone maps straight onto the line to rewrite.

**The lookup runs backwards, words → path.** Every surface —
`narrate()`, the journal page, the helper card, the water, the statues, the
blank map, the pages you have found — is handed a *finished string*, never an
id. Threading an id through all of them means a second argument at every call
site, and one forgotten call site is a line with no id and no sign that it is
missing. So the map is built once from `TEXT_BLOCKS` and searched by text. Two
consequences worth knowing:

- **Duplicates are named, not hidden.** `You` says *"I wrote these."* in all
  three shelf slots. The tag reads `ROOM_LINES["You"].shelf[0] ×3` — rewriting
  one of three and leaving the other two is the mistake that would otherwise be
  invisible.
- **`{braces}` still resolve.** A `MOMENTS` line is substituted before it
  reaches the screen, so the exact-text map misses it; those lines also go in as
  regexes, and *"A key. Its head is a circle."* finds `MOMENTS.keyFound._`.

A line the game shows that is **not** in `data/text.js` tags itself
`not in text.js` rather than going quiet. That is the other half of what the
view is for.

`TEXT_BLOCKS` at the foot of `data/text.js` exists because these are
`const` in the shared script scope and there is no way to enumerate them.
Hand-written, therefore guarded: smoke asserts it lists every `^const [A-Z_]+`
in the file, and `text-index.mjs` skips it so the writer's page does not index
the index. A second guard round-trips **every** line in the file — look it up by
its words, evaluate the path that comes back, and the words must match. That is
the check that catches a walker that numbers arrays wrong or mangles a quoted
key, which is the failure that sends a writer to the wrong slot.

One real edit fell out of it. The statue's unasked question used to do
`o.textContent = o.textContent + ' ' + SHRINE_LINES.unasked`, which would have
swallowed the id badge along with everything else in the button. It inserts a
text node before the badge now.

## The maze is built to a contract now, and says when it cannot be (v0.97.0)

`data/phases.js` grew a `MUST` row per chapter — keys buried, exit guarded, key
detour, rooms apart, thresholds — and `generate()` builds against it.
`js/contract.js` measures and grades; `tuner.html` draws a block of mazes with
every miss called out. The full account is `docs/QUALITY.md`.

**The headline is a negative result, and it is the useful part.** Enforcing the
contract did not improve the keys at all: every-key-buried stayed at 3% for The
Soldier, 0% for The Archivist and The Criminal. The old retry loop was already
ranking builds by keys-in-nests as a tiebreaker, so writing that preference down
as a requirement gave it nothing new to find. A maze with both keys buried turns
up in about 3% of builds and five tries cannot reliably find one. **Insisting on
a requirement does not make it reachable.** What would fix it is placement — put
the key in a nest instead of building mazes until one lands there — and that is
its own batch.

What the contract did buy: the shortfall is visible for the first time
(`contractMiss`, and a "fell short" column in `tools/quality.mjs`), every chapter
but The Child misses its row in 100% of mazes, and a later change that makes any
of it worse now has somewhere to go red.

Three things worth not relearning:

- **Equal clause weights are not neutral.** The first cut scored every clause the
  same and 20 of 20 Soldier mazes shipped with a loose key, because a build could
  win by gaining a threshold while dropping a key into a hall. `keysVaulted`
  outweighs the rest together now.
- **Patience is spent on tier one only.** Letting a gained threshold reset the
  retry counter ran 9.6 builds a maze at xl. It waits on keys, which is what more
  tries can actually buy. Build counts now match v0.93.0 exactly; the only added
  cost is 8/17/38ms of measuring at md/lg/xl. An xl level load was already ~760ms
  before any of this.
- **The room-gap numbers in the first printing of QUALITY.md were wrong**, and so
  was the copy of the measurement in `tools/quality.mjs` that produced them: its
  flood could start at a well but never finish at one, and 17% of landmarks are
  wells standing in the wall. One measurement now, in `contract.js`, checked
  against a pairwise reference over 88 mazes. Rooms are closer together than that
  doc first said. Two of them can even land on the same tile — 1 maze in 30 for
  The Archivist — which is a placement bug still open.
## The writer's page, in the repo (v0.98.0)

Joe: *"My expectations that you would make this writer.HTML page in the GitHub. I don't
see it there."* Fair — the generator was committed and the artifact published, but the
page itself never landed in the repo, which is where he went looking.

`maze/writer.html` is committed now, so it opens from
`gamedesignerjoe.github.io/maze/writer.html` like the game does. Three things had to be
true first, and the third was a real bug:

- **It had to save somewhere.** There is no `window.claude` on GitHub Pages, so that copy
  keeps the work in `localStorage` and offers **Copy changes**, which puts every edit on
  the clipboard to paste into the chat. The claude.ai copy still saves to the store I can
  read directly. Both now say which one you are in, rather than one silently doing nothing.
- **It had to be reproducible.** The page carried `built: new Date()`, so every build
  differed from the last and *"is the committed page stale?"* was unanswerable. It carries
  a fingerprint of the text instead. Two builds are byte-identical.
- **Mojibake.** No `<meta charset>`: the artifact wrapper supplies one, GitHub Pages does
  not, so every em-dash came through as `â€"` and the page laid out at desktop width on a
  phone. Both metas are in the generated file now; the wrapper ignores them.

**A generated file in the repo rots**, which is this session's recurring lesson, so smoke
fails when `writer.html` and `data/text.js` disagree and names the command to fix it. The
republish is not checked and stays a human step — it is in the skill's ship section.

## Adding a line, per event rather than per block (v0.96.0)

Joe, on the first cut of the writer's page: *"I might want to write a new line for the
basin, or for when he is walking through the maze, or standing at a bookshelf. These
don't have add lines. It's only the whole section for all SELF LINES."*

Right, and the page was worse than he thought. It grouped by **block**, so the basin and
the shelf — two different moments — were one group, and the single add button attached a
line to a block rather than to the list the game actually picks from. The page groups by
**the list** now: 192 groups where there were 17.

**The interesting part is that "add a line" is not always possible**, and it depends on
how the engine picks, not on the shape of the data. Read off the pick sites:

- **Takes a new line** (42 lists): `SELF_LINES` (shuffled and played through), `EMPTY_SHELF`
  / `FIGURE_LINES` / `SECRET_LINES` (random), `SHELF_LINES` (each once), `CAST[i].pages`,
  `POOLS[i].approach`.
- **Cannot** (70): `LIGHTER` is one line per stone and there are seven, so an eighth could
  never fire. `POOLS[i].ex[j].choices`/`.reply` and `EXCHANGES[who].steps[i].q`/`.a` are
  paired by position — adding one needs the other, which is a code change.
- **Single slots** (137 lines): a tutorial card, a moment, a page's wake line. Rewritable,
  not extendable.

**The basin was the interesting case, and it needed a code change.** It was picked with
`L[t >= 0.8 ? 2 : t >= 0.4 ? 1 : 0]` — hard-wired to exactly three, keyed to how far
through the chapter's pages you are. A fourth line could never have fired, so offering
"add a line" would have been a lie. It spreads across however many lines there are now
(`L[Math.min(L.length - 1, Math.floor(t * L.length))]`), so a fourth just makes the run
through the chapter finer. Shelf and basin both.

**The rule table defaults to "no".** `POOL_RULES` in `tools/text-index.mjs` is
hand-maintained because it encodes engine behaviour, which is exactly the kind of thing
that rots — so an unrecognised list is *not* addable and says "I have not checked how the
game picks from it". That default earned itself immediately: it caught four lists I had
missed (`SELF_LINES.You` and `ROOM_LINES.You.*`, whose keys are dot-notation rather than
bracketed, and the paired `EXCHANGES` question/answer arrays).

### A 220KB pipe, truncated at 145KB

`writer-page.mjs` shelled out to `text-index.mjs --json` and parsed the result. The index
grew past what the pipe delivered and `JSON.parse` failed on an unterminated string 4,700
lines from the cause. It imports the module now. Worth remembering: a syntax error in
data you generated yourself usually means the data was cut, not malformed.

## The writer's page (v0.95.0)

Joe writes here, not in `data/text.js`: *"I don't see myself being able to do this on
my phone... I don't want to try and edit a GitHub file through the git editor, that
doesn't sound enjoyable."*

**The page:** https://claude.ai/code/artifact/5fbf4ae2-7bad-4f14-aa23-10fd5eed1ee2

**The loop.** He edits → the page saves to its own store → he says there is new text (or
check at the start of a session) → read it, apply to `data/text.js`, run the suites,
commit. The push stays here: a page holding a GitHub token would hand that token to
anyone who opened it, and text changes should go through the suites anyway.

    Artifact  action:read_db  db_op:get  collection:writer  doc_id:edits

Comes back as `{ edits: { "<line id>": {text, note, deleted} }, added: [...] }`. The id
is the path into `data/text.js` — `SELF_LINES["The Child"][3]` — so applying an edit is
writing to that path. **Verify before writing:** the page also keeps what the line said
when he started. If that no longer matches the file, the line moved under him; flag it
rather than clobber.

**Two tools, both generated, never hand-kept:**

- `tools/text-index.mjs` — every line with the context a writer needs: who speaks it,
  where it appears, when it fires, how often, how much room, and whether anything fires
  it at all. Walks `data/text.js` generically, so a block added tomorrow is indexed
  without anyone remembering to teach it. `--json`, `--dead`, or a readable report.
  Tutorial chapters are derived from `PHASES`, because a hand-written chapter number is
  wrong the moment a feature moves phase.
- `tools/writer-page.mjs` — builds the page with the index baked in. **Regenerate and
  republish whenever the text changes**, or Joe is editing against a stale copy.

**Why no line IDs in the data.** The tempting move was `{id, text}` per line, but that
touches 32 call sites and the nested shapes in `CAST` and `POOLS`, in a working game.
Path IDs plus that original-text check give the same safety at apply time for none of
the risk. The restructure stays available if the page proves it needs it.

**What the page cannot do:** wire a genuinely new moment. Adding a line to an existing
pool is text; a line that fires when something new happens is code. The page marks those
"new — I will wire this in" rather than pretending.

## The docs

| File | What it is |
| --- | --- |
| **`HANDOFF.md`** | **Start here.** Why things are the way they are, what was tried and rejected, and what the close camera cost. Current as of v0.76.0. §6 is a list of settled decisions — don't re-propose them without new reasons — and it ends with the three that have *changed*, so the old rejections can't be cited against them. |
| **`PROGRESSION.md`** | The arc: eight selves, seven stones, the pools, and why each stone maps to the knob it does. §1–§7 are the design and still stand; §8 is what is actually built, current as of v0.76.0. |
| **`ROOMS.md`** | The rooms that are places — what each of the seven landmark kinds is, and ten pitches for more. |
| **`NOTES.md`** | Joe's *standing* notes: story thinking, themes, canon. **Not the backlog** — see below. |
| **`QUALITY.md`** | **What the mazes are actually like**, measured: keys in nests, what guards the exit, time to finish, thresholds, how far apart the rooms are. The baseline for Joe's five standing complaints, and the note that the harness only ever proved a maze *playable*, never good. Current as of v0.93.0. |
| **`LABYRINTH.md`** | The labyrinth prototype's shape, from the debug Prototype menu. |
| `labyrinth/01`–`06` | The **other** project: first-person, hex-grid, Three.js, React/Vite/TypeScript on Vercel. Reference and inspiration. |

**The backlog is not in this repo.** It is the list at the top of Joe's Google
Doc, under his "Rules for Claude", and it is read fresh with the Drive tools
every time. `NOTES.md` used to carry a snapshot of it and went stale in three
days, showing shipped work as open. It no longer does, and nothing should copy
it back in.

**Order of authority: the game, then Drive, then these docs.** All of the docs
here are maintained by hand and drift; when one disagrees with the code, the
code is right and the doc is the thing to fix.

### Keeping them honest

Each doc carries a stamp near the top meaning *last read against the game*:

```
<!-- reviewed: v0.76.0 — and a note on what was and wasn't checked -->
```

`node maze/tools/docs-check.mjs` prints how far behind each one is and warns past
ten minor versions. The pre-commit hook passes on its verdict when the suite is
green — **as advice, never as a block**, because staleness is a judgement and a
gate that misfires gets switched off. **Bump a stamp only when you have actually
re-read that doc**; bumping it because you edited a line makes the whole thing
theatre.

Two rules that stop the rot starting, both learned the hard way:

- **Never copy a source of truth into a doc.** `NOTES.md` mirrored Joe's Drive
  backlog and was wrong within three days. Point at the original instead.
- **Name a knob; do not quote its value.** `squeezePinch`, not
  `squeezePinch: 0.55`. Joe retunes by feel on his phone, and a number copied
  into a doc is wrong by the next evening.

What to check before a commit is in the `maze-task` skill, § Ship: it is one
question about two sections, not a pass over everything.

## Layout

```
maze/
├── maze-topdown.html   the shell — markup and tags only
├── tuner.html          the contract, and a block of mazes built to it
├── css/style.css       the whole look, 170 rules
├── data/               tuning and text; see data/README.md
│   ├── config.js         SIZES, CONFIG
│   ├── phases.js         PHASES, STONES, MUST
│   ├── text.js           every line the player reads
│   └── music.js          MUSIC
├── js/                 the engine, in run order; see js/README.md
│   ├── core.js           version, save file, seed
│   ├── generate.js       the maze itself (the big one)
│   ├── proto.js          prototype levels, from the Prototype debug menu
│   ├── contract.js       what a maze must hold, measured and graded
│   ├── audio.js  state.js  input.js  stories.js  run-save.js
│   ├── tutorials.js  pool.js  map.js
│   ├── movement.js       the glide, turns, sliders, pickups
│   ├── render.js         every frame
│   └── boot.js           frame loop, resume-or-reset, go
├── docs/               this folder
└── tools/              the verification pass; see tools/README.md
```

Everything loads as plain `<script src>`, data first, then the engine in the
order it used to run. **No build step, no modules, no bundler, no fetch** — the
game still opens straight off the filesystem. Data files are `.js` and not
`.json` because `CONFIG`'s comments are design intent and JSON cannot hold them.

**Load order is load-bearing.** The pieces share one global scope and 52
statements run at parse time, so a statement cannot reach forward to something
not yet defined. The tag order in the shell matches the old top-to-bottom order;
`tools/smoke.mjs` asserts it. Add a new file where its code would have gone.

Data came out in v0.32.0, the engine in v0.33.0, the stylesheet in v0.34.0.
Generation is bit-identical across all three — the harness finds the same 10
soft-locked seeds each time — and the CSS move was verified against the
browser's parsed CSSOM and a pixel-identical render, not just by eye.

**`tuner.html` is a second page on the same engine**, not a second engine. It
loads `data/` and `js/` exactly as the shell does and calls `generate()`; there
is no copy of the generator in it and there must never be one, or it stops
showing what the game makes. Both pages load `js/contract.js`; nothing in the
running game calls it yet and nothing reads `MUST`, so the contract is inert to
play for now. See `docs/QUALITY.md`.

**The markup stays in the shell**, and should. Moving it out would need `fetch`
(which breaks `file://`) or JS string injection (worse to edit, and the DOM
would no longer exist when the early scripts run). 144 lines of shell *is*
thin.

## What the game is — read from the source

A top-down maze for mobile web. Canvas, no build step, no dependencies,
deployed from a phone. `VERSION` (title bar and menu) says which build is
running; bump it on every hand-off.

- **Eight selves, one maze each.** `PHASES` — The Child, The Cartographer, The
  Soldier, The Archivist, The Priest, The Criminal, The One Who Stayed, You.
  Each sets a size and which features exist (`f: {…}`): signs, charcoal,
  compass, thread, scraps, lamp, darkness, gate, tunnels, pockets, path
  sliders, doors (1–3), crawl gaps, swings, hopscotch, the figure.
- **Five sizes.** `SIZES` — xs 7×10, sm 10×14, md 14×20, lg 20×28, xl 28×40.
  Each step doubles area; feature counts scale with area, except doors.
- **Seven stones, the burdens.** `STONES` — Sight, Pace, Memory, Fear,
  Direction, Shame, Scale. Each is a restriction the player has felt all along;
  setting one down at a pool lifts it permanently, through `B`.
- **The pools, between phases.** `POOLS` — the Caretaker hosts; one person who
  loves him per stone: Father (Sight), Wife (Pace), Brother (Memory), Daughter
  (Fear), Father again (Direction), Oldest friend (Shame), Wife again (Scale).
  Approach lines, an opening, two branching exchanges, a close.
- **A narrator per self**, in that self's voice. The Child's lines are lowercase
  and misspelled on purpose ("the man said wait here." / "but i didnt.").
- **The figure** (`figure: true`, Child phase) is the father — abandonment made
  visible. Placed at generation, six per maze, at vantage spots.
- **Progress persists** in `SAVE` → `localStorage['maze.save.v1']`: phase,
  stones, collected pages, played narration, UI prefs. Runs resume in place;
  reload is never a way out. **"Update app" is the exception** — it calls
  `parkRunAtHome()`, which keeps everything done and drops only your position,
  so you come back on the mat with the title up. Parking has to freeze
  `saveRun`, because `pagehide` and the 6s autosave both fire during the
  reload and would write the live position straight back over it.
- **Audio starts on the first gesture.** `AUDIO.begin()` used to be called only
  from `wake()`, the title tap — and `restoreRun` goes straight into the maze
  with no title, so every resumed run came back permanently silent. A one-shot
  `pointerdown` listener in `js/input.js` now starts the bed; `begin()` is
  idempotent so the fresh-run path is unaffected.
- **`CONFIG`** in `data/config.js` is every tunable, commented. Its comments are
  design intent — read them before changing values. `?seed=1234` replays a maze.
- **All player-facing text lives in `data/text.js`**: CAST, SELF_LINES,
  ROOM_LINES, SHELF_LINES, EMPTY_SHELF, LIGHTER, NARRATOR, FIGURE_LINES, POOLS,
  TUTORIALS. Engine code holds no prose. Joe rewrites text without touching
  logic — keep it that way, and put new text in `data/text.js`, never inline.

## How Joe and I work

### Joe's rules live in his doc, not here

The top of the Google Doc has a **Rules for Claude** block: how to prioritise,
how much to take on, what to report. **That is the authority — read it every time
you open the doc, and follow it over anything in this file.** It is not copied
here on purpose: two copies drift, and his is the one he edits.

What is here instead is the mechanical stuff his rules assume, and the mistakes
worth not repeating.

### There is a skill for this

`.claude/skills/maze-task/SKILL.md` is the procedure — read the doc, group, build,
verify, ship, report. Joe can type `/maze-task`. This file stays the reference: what
the game is, why it is that way, and what has already been decided.

And a **pre-commit hook** (`.claude/hooks/maze-smoke.sh`) runs the smoke suite on any
commit touching `maze/` and blocks it if the suite is red — or if it never reaches a
verdict, which is what an errored run looks like and is exactly how "Smoke 55" once
got written into a commit message on the strength of a run that had done neither. It
starts the static server itself if it is down, and it lets the commit through with a
warning rather than blocking when node or python is missing: a gate that misfires
gets switched off.

### Where the work comes from

He says "new tasks in the doc" when he has added some. Read it with the Drive
tool: file id `14pOj9HLuiGyPlaTVYo7sLt7xNAokqSFCk1d7hOKDqrs` (a snapshot lives in
`NOTES.md`, but Drive is always newer).

- **The live backlog is the list at the very top**, above the first `DONE?`.
- **Skip anything already shipped** unless he has added something under it. His
  rule: *"refer to the list and skip the ones you've already done until I add a
  note to them."* Re-listing an item **is** a note — it means it is still wrong.
- **Leave `THOUGHTS`, `IDEAS`, `NOTES TO REMEMBER`, `Kid stuff` and
  `Abandonment` alone** unless he asks. *"Don't do the thoughts or ideas section.
  Just the list off the top."*
- He dictates from his phone, so expect transcription slips — *"the Wesson
  number"* is the version number, *"keep some of them clothes"* is closed. Read
  for intent, and say which reading you took.
- A bare `-` bullet under an item is **a screenshot you cannot see**. Say so
  rather than guessing what is in it.

### The repo

- **His personal repo only**: `GameDesignerJoe/GameDesignerJoe.github.io`. Never
  the Believer repo.
- **Commits go straight to `main`.** GitHub Pages serves it. No Vercel, no Vite,
  no build step — see *Running it* below.
- End every commit message with:

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: <the session URL>
  ```

### Standing decisions

- **The game is the source of truth** — the rule at the top of this file.
- **The door-key soft lock is fixed (v0.85.0), and the harness is clean.** It was
  deferred from v0.75.0 to v0.84.0 on Joe's *"don't worry about the soft lock for
  right now"*; he came back to it and it turned out to be one line in the planning
  model. **A harness that is not clean is now a real failure, not the known one** —
  read what it says rather than assuming it is this.

### Shipping a change

On top of *Verifying a change* below:

- **Look at it before claiming it works.** A Playwright shot at 430×900,
  `deviceScaleFactor: 2` — the size he plays at. Landscape too if the change
  touches layout; the version number collided with the title there and nowhere
  else.
- **Every new behaviour gets a smoke check**, and **verify the check fails when
  the feature is reverted.** A check that cannot fail is worse than no check: it
  reads as reassurance. Two checks in this file passed with their feature
  deleted before that rule was applied to them.
- Run smoke, selftest and harness; bump `VERSION`; write the change up here;
  commit; push. **Confirm the suites passed before writing the commit message** —
  a run that errors because the static server stopped looks nothing like a run
  that fails, and "Smoke 55" went into a commit message once on the strength of
  a run that had done neither.

### Method — what goes wrong when it goes wrong

Hard-won, mostly in v0.75.0, which took far more thrash than it should have.

- **Group by what the items touch, not by how many there are.** v0.74.0 was five
  items and went cleanly because they barely met each other. v0.75.0 was seven
  where **five changed maze generation**, and each change shifts the geometry and
  quietly invalidates the measurement you took a minute ago. Three interlocking
  generation changes is a bad batch; five unrelated ones is a fine one.
- **Check that the edit landed.** A scripted edit whose `assert` throws writes
  nothing, and the command after it may still run: numbers then get read as if
  they reflect a change that was never made. That happened, and it sent several
  rounds down a wrong path.
- **Name the metric before measuring.** Key-to-door distance was measured twice
  with the wrong one — straight-line first, then walking *through* the very door
  being measured from — and both times the conclusion was wrong.
- **Instrument by the second hypothesis, not the sixth.** A stuck swing took six
  guesses and one probe; the probe took two minutes and answered it outright.
- **One background job at a time**, and never one that edits files a foreground
  job is editing. Two runs of the same breakage test raced and left two files in
  their deliberately-broken state.
- **When a check goes red after an unrelated change, suspect the check.** Four
  did in v0.75.0 and all four were brittle, not broken code: a frame count that
  the speed ramp invalidated, a five-seed search, an averaged pixel sample that
  buried its own signal, and a probe that parked the player in the path of the
  swing it was watching. Fix the probe to measure the thing it is named for.
- **A trade-off between two things he has asked for is his call, not yours.**
  Hiding keys better cost doors per maze. That should have gone to him as a
  choice with the numbers attached, not been settled quietly and reported after.

## Working rules

From `HANDOFF.md` §1, and they are not optional:

- **Build the tool, not the content.** New text goes in a data block, never
  inline.
- **Everything tunable is a `CONFIG` knob**, commented. Add knobs with features.
- **Ask before building when the design is ambiguous.** Joe prefers 2–3
  tappable options over open questions. Otherwise build and list the calls you
  made.
- **Own bugs openly.** Say what broke and why. No silent fixes.
- **Bump `VERSION`** on every hand-off.
- **Nothing new is assumed.** Things are missing for reasons. Propose; don't
  presume.
- **Test behaviour, not just render.** The movement recentering was silently
  broken for two versions because an insert anchor moved. `HANDOFF.md` §9 has
  the verification habit and the generation order — read it before editing
  `generate()`.
- **Joe tests on his phone.** A change isn't done until it works there.

## Running it

```
python3 -m http.server 8000
```
→ http://localhost:8000/maze/maze-topdown.html

Deployed straight from GitHub Pages — no Vercel, no build step, no Vite. The
live URL is `gamedesignerjoe.github.io/maze/maze-topdown.html`.

## Verifying a change

`HANDOFF.md` §9 says to run the verification pass after every change. It lives
in `../tools/` (it was missing from the repo; rebuilt 2026-09-09):

```
python3 -m http.server 8765          # in another terminal
node maze/tools/harness.mjs          # generation invariants across 576 mazes
node maze/tools/smoke.mjs            # boot, walk, mark, save/reload, pool
node maze/tools/selftest.mjs         # proves the invariants can fail
```

None of it touches `maze-topdown.html`. See `../tools/README.md`.

**Sound carries by walking distance** since v0.35.0. `earshot()` in
`js/audio.js` fades a sound in the world from full volume at `sfxNearTiles` to
silence at `sfxRangeTiles`, measured in tiles walked rather than line of sight.
Only `AUDIO.swing()` uses it — every other sound is triggered by the player and
so is always at their feet. Give any new autonomous sound its tile.

**The Turns debug menu (v0.37.0, Sparse added in v0.38.0)** — Auto / Fewer / Sparse / Least — is an experiment
in whether longer halls with fewer forks make players reach for chalk. Two new
`CONFIG` knobs drive it, both off in Auto so generation there is bit-identical
to v0.36.0: `hallStraightness` biases the carver to carry on in the direction it
arrived from instead of turning, and `hallFill` carves the whole grid and then
prunes dead-end leaves back until only that share is corridor, leaving the rest
solid wall. `turnsPresets` holds the menu presets (Fewer 0.85 / 1.0, Sparse
0.65 / 0.65, Least 0.95 / 0.55); each also sets a branchiness used when
Branching is Auto, so Least no longer needs Long halls to be picked alongside
it. **Sparse is the one to reach for.** Least made the halls long enough to
want chalk but too long to enjoy walking; Sparse keeps its dead space and
halves the run length, so the corridors bend about twice as often. It also
leaves 40 dead ends per X-Large map against Least's 12, which matters because
dead ends are where chalk spawns — Least quietly starves the map of the very
thing it makes you want. Pruning never
touches the start block and its ring or the three exit corners, and rooms are
re-rolled until they touch corridor, so the invariants hold — the harness runs
with `--turns least` to prove it. The chosen mode is part of the run signature,
so switching it starts a fresh maze. `tools/hall-metrics.mjs` measures the
result: on X-Large, Least uses about 59% of the grid, cuts turns-plus-junctions
from ~700 to ~180 and dead ends from ~170 to ~12, and the mean straight run
goes from 3 cells to about 7.

## The Child's maze (v0.41.0–v0.43.0)

Worked through the list at the top of `NOTES.md`. The Child phase changed most:

- **The way out is a tree of squeezes.** `CONFIG.exitGauntlet` takes the last
  stretch of the route and turns it into one: a single mouth in, forks along
  the way, one branch that goes on and the rest that end in nothing. Pass-
  through cells are marked as `crawlCells` so they draw narrow and read as
  tunnel rather than a room you step into; the forks stay as chambers. About
  18 cells and 3 places to choose per tree.

  The wrong branches are not invented. Lift the trunk out of the maze and what
  is left falls into pieces: one big one, the maze you came from, and small
  ones hanging off the trunk. Those are already dead ends — that is what makes
  them small — so absorbing one whole costs nothing and cuts nothing. Only the
  trunk's links back to the big piece are shut, one at a time and only while
  every floor tile stays walkable. Every trunk length is built, measured and
  unbuilt, and the best kept: it must be the only way to the exit, and among
  those the one that makes you choose most often wins. **`the squeeze tree is
  the only way to the exit`** is an invariant — shut the mouth and the exit
  must be gone. 1920 for 1920.
- **The floor moves on the way out** (v0.57.0). `CONFIG.exitGauntletSwings` puts
  two cells of the trunk on a clock: they slide sideways into the dead wall
  beside them and back, so the way on is a hole half the time and finding the
  right branch is not the whole of it. Joe asked for "auto moving floor tiles"
  in the gauntlet, and a hole that comes and goes is what makes you stand still
  long enough to think about the choice.

  Nothing is carved for them. The cell is trunk floor already and the alcove is
  dead wall until the tile gets there, so the tree is still the only way out and
  there is no new ground to stand on. They are chosen before the squeezes go in,
  so `busy()` keeps the squeeze passes off the swing's own cell. Only
  straight-through cells qualify — a hole in a junction would be a hole in three
  ways at once — and the alcove must be wall two tiles deep, or sliding into it
  would join the trunk to whatever is on the other side. 87 Child mazes in 120
  get both, 26 get one. **`a gauntlet swing opens no new ground`** is an
  invariant. You can ride one into its alcove and ride it back out; there is no
  way to be left there.
- **A squeeze you cannot go round.** `CONFIG.crawlOnPath` puts one crawl gap on
  the solution route whose sealing would cut start from exit, so getting out
  means getting down. The tile was already open, so nothing about the maze
  changes except how you pass it. Two of them now, and it runs after the
  gauntlet so the severing test sees the final grid. 29 Child mazes in 30 get
  at least one, 2.5 on average; a very loopy maze can get none, and there the
  warren carries it instead.
- **The kid's room.** A square of cells is reserved before anything is carved
  and marked visited, so the maze grows around it. What is left is a solid
  block of wall in the middle of the map, and at the end it is cut open whole:
  5×5 tiles of floor with nothing in the middle of it, and one crawl gap into
  it. That is the only way to get a room that is actually a room rather than a
  winding piece of corridor with the walls taken out. Every Child maze gets
  one, 25 tiles, about 11 drawings. Rooms and districts keep off the reserve.
  If there is somehow no way to open it onto a corridor, it falls back to
  finding where the maze pinches instead.

  Inside it is dark. `CONFIG.secretDark` paints the floor out until you find
  `secretSwitch`, a light in the floor breathing until you stand on it; then
  the lights stutter on over `secretMarks` and `secretFather`, a man from
  behind, mid-stride, going away.

  Three things about that dark changed in v0.56.0, all Joe's notes. The paint
  is `colors.wall`, not `colors.bg` — painted-out floor should read as more
  wall, not as a hole in the picture. The breathing light is a quarter as
  bright and half as wide (`secretGlow`, `secretGlowTiles`, `secretGlowCore`);
  it was reading as a lamp. And it does not show at all until you are standing
  on a tile of the room, so from the squeeze there is nothing to see: the
  switch sits `secretSwitchIn` = 2 tiles in from the way in, never on it, so
  you have to commit to the dark before it shows you anything.
- **A squeeze is drawn from where it actually goes** (v0.56.0). `drawSqueeze()`
  fills the tile with wall, cuts a hub in the middle of it and reaches one arm
  toward each side you can walk to. It used to assume every squeeze ran
  straight through — one strip, its axis guessed from the two side neighbours.
  32 squeezes in 925 are tees or crosses, nearly all of them in the exit
  gauntlet, and those showed a single strip and then let you walk out of a side
  with nothing drawn on it at all. Joe: "I'm able to push into the squeeze
  though here even though there's no path. Maybe because the whole tile is a
  squeeze and we don't look at what direction you are coming from?" For a
  straight-through squeeze the drawing is pixel-for-pixel what it was.
- **The hopscotch is one court, not a box per tile** (v0.56.0). The cells touch,
  the way a kid chalks them: two rails down the run, a line between each cell,
  and a small wobbly number in each. It was a 0.6-tile box per tile with a gap
  between each, twice the size it should be and the numbers far apart.
  `chalkLine()` draws in three wobbly bits with the wobble fixed by tile
  position, so it never shimmers as you walk; `CHALK_DIGITS` holds 1–8 as
  strokes rather than a typeface. The mechanic is untouched — still one tile
  per number, stepped in order.
- **The Child's map is medium and sparse** as of v0.50.0 — `f.turns` lets a
  phase name a Turns preset, and the Child names `sparse`. Twice the area, a
  quarter of it wall. It needs the room, and it suits the level.
- **An arrow painted on the start-room floor** the first time you meet a block
  you have to push (`startArrow`). It is the only thing in that room that says
  the wall moves. `SAVE.pushLearned` retires it for good once you have leaned
  on one.
- **Both are Child-only**, gated on `F.crawl`. For every phase after, a crawl
  gap is drawn shut, so either would wall something away for good.
- **No push blocks.** A shifting district used to ask for extra sliders on any
  phase with pockets *or* swings, and on a swing-only phase the surplus came
  out pushable. Shifting now needs real pockets.
- **One father at a time**, and he leaves: seen, he waits `figureLingerSec`,
  then walks straight away from you and fades, through whatever is in the way.

**The character fills in as the burdens go down.** `drawPlayerBody()` in
`js/render.js` clips the arrow and paints seven bands tail to nose, one per
stone: `colors.playerBurdened` while still carried, `colors.player` once put
down. `CONFIG.playerOutline` keeps a pale edge on him — carrying everything he
is nearly black, and on a dark floor that edge is the only thing that keeps him
findable. Set it to 0 for Joe's literal "completely black".

Two invariants came out of this: **a swing-only phase carries no pushable
blocks**, and **the secret place is behind a squeeze, and behind nothing else**
— walkable, and not walkable once crawling is off the table. That second one
caught something geometry could not: a room opens its corner tiles, and one of
those can touch a corridor running alongside, so hiddenness is settled with a
flood rather than by counting doorways.

**The floor (v0.46.0).** A separate **Floor** debug menu from the screen
overlay, because these are marks in the concrete rather than effects on the
glass: fixed by the seed and by the shape of the maze, so they are in the same
place every time you come back. That is the point — the Child has lived here
his whole life, and the room should show it.

| Option | What it is |
| --- | --- |
| **Worn paths** | The floor polishes along the ways people actually walk. Traffic is distance out from the route (`floorWearReach`). A corridor gets a stroked track; an open floor gets a flat wash instead, because everybody walks everywhere in a room — and because stroking a plus on every tile of one leaves the diagonals bare and prints a lattice of rings across it. |
| **Grime** | Dirt along the foot of every wall, twice over in a corner, with a per-tile roll so it is not uniform. |
| **Flickering lights** | Ceiling fixtures every `floorLightSpacing` cells pooling light on the floor. `floorLightBad` of them have something wrong and stutter, always, not in response to anything. |
| **All three** | Which is probably the answer. |

Off by default. The distinction worth keeping: grime and decay are the texture
of an abandoned *building*, nobody here for years. The Child was left in a
corridor somebody still mops. Worn paths carry that better than dirt does —
they are evidence of other people, and of their absence.

**Texture (v0.45.0).** Three overlays behind a **Texture** debug menu, off by
default. Grain and Dust draw **under the fog**, so they only ever show where the
maze is lit; over the top they carried on across the black surround and the
empty space below, which reads as dirt on the screen rather than anything in the
room. Grain has its own amount, `textureGrain`, at half the rest, because it
covers every pixel. The three are: **Grain** lays film-and-paper noise over the whole picture, **Damp**
puts seeded blotches on the floor under the fog, so a stain stays where it is
in the room, and **Dust** drifts motes across the glass. Which one the maze
wants is a look to be chosen by eye, so all three are built and none is picked.
Texture is pure paint: changing it does not reset the maze, so you can flick
between them on the same corridor and look. `CONFIG.textureAmount` sets how
strong whichever is on.

## Sounds a phone can play, and a clock that stops (v0.107.0)

Three items from Joe's doc, all sound. *"It doesn't appear to be a sound effect when you
picked up a key. Or it might've just been very delayed. Yeah, really delayed. I restarted to
see if that fixed it. Makes me think there's a memory leak because I was playing for
awhile."* — *"The sound for the push block needs to be a little bit louder."* — *"There's
no sound for when the gates open."* Seed 51406072.

**Measured for a leak first, and there isn't one — in Chrome.** Headless Chrome ran the
game for 3.7 minutes with a footstep every 400ms, a pickup and a key every 3s, a push every
6s and a gate every 10s, sampling the audio thread through the DevTools protocol: render
capacity 3–7% and flat, callback interval steady, JS heap 5–8MB and flat. The audio graph
stops and drops every node it makes, and the composer runs one timer chain. Nothing grows.

**What Safari does is stop the clock.** A lock screen, a notification, a switch of apps, and
the AudioContext comes back `suspended` or `interrupted` and stays so — the game only woke it
on the *first* touch. Every sound after that was scheduled into a clock that was not running;
they queued, and when a later gesture finally resumed it they all fired together, late. That
is "really delayed", and a restart clears the queue, which is what he saw. Three changes: a
sound that cannot play now is dropped, not queued (`live()` in `tone` and `noise`); every
touch and every return to the foreground nudges the context awake, not just the first; and
the composer skips a bar it cannot sound rather than piling notes into the stopped clock. I
cannot reproduce Safari's interruption here, so this is the fix for the mechanism the
symptoms describe, and the report stays open until Joe plays a long session on it.

**The gate had a sound and the push block had a weight, both under 100Hz.** A 90Hz triangle
and a 48Hz one: a phone speaker cannot reproduce either, which is the lesson the music
learned as `bassCarrierHz`. The gate is a grind you can hear, a tone up where the phone
lives, and the leaves knocking home at the end; the push block's hiss is louder and its
weight moved up to 220Hz. No sound effect in the game now has a voice under the floor.

**Tests.** Sound, so smoke alone: 105 checks, two new. One plays the gate and the push and
reads every oscillator's pitch off the audio probe, wanting none under `bassCarrierHz`. The
other suspends the context, asks for a pickup and a key, wants no voices made, then sends a
touch and wants the context running and the next pickup heard. Both proven red against the
old code. Joe's ear is the third test, and the one that counts.

**And the pool ripple probe, finally.** Red in 7 of 17 runs over two days with the water
visibly working. It read each later frame's shift against frame zero — and the ring pattern
repeats every few bands, so once the rings had travelled half a period a later frame matched
an earlier shift as well as the true one, and 2,2,2 or 1,2,1 came back for real inward
motion. Frame to frame the travel is under a band and rounds to nothing (0 in 19 steps, on
the first try at this). A quarter-second apart it is about one band, enough to register and
under half the period, so the sign cannot alias: the probe sums those steps and wants two
bands of travel with at most one step outward. Two lessons for the file: a correlation
against a fixed reference aliases on anything periodic, and a check that fails half the
time with nothing changed is measuring its own timing, not the game.

## The HUD after a night's play, and a map that keeps its secrets (v0.106.0)

Four items from Joe's doc, all HUD or map. *"Locked, charcoal states gold, even after all
of the charcoal is gone."* — *"Please slow down the pulsing of the charcoal icon. It's too
crazy. Make it pulse like half as much."* — *"The map icon only has to flash the first
time it appears, not every time."* — *"Need to stop drawing the important locations on
the map so that players can put chalk down for them instead. If we don't draw the statue
or the gates, then they have a reason to use chalk."*

**The gold ring** now reads only while there is charcoal to be locked on to. The lock
itself stays armed — the next piece he finds lights on its own, which is what lock-on is
for — but a gold ring round an empty pill said something was on when nothing was.

**The heartbeat, half as much**, both ways: every other tile logged (`charcoalBeatEvery`)
and half the swell (1.11, was 1.2). v0.100.0 made it visible; this makes it company
rather than a metronome. The smoke bar is now a band, over 1.05 and under 1.15, so
neither the invisible beat nor the crazy one passes.

**The map button beckons once per save** (`SAVE.mapBeckoned`), set the first time the map
is opened. It used to beckon every time a maze started.

**The map draws no gates, statues or stones.** Keys, pages and charcoal still show: those
are things you pick up and are gone. A gate, a statue, a stone are places to come back to,
and the chalk is for that. `mapDrawsPlaces` puts them back for looking. Reading taken:
"the statue or the gates" as the item names them, plus the stones, which are the
statues' other half. Pages stay because the writer's page and the Stories screen already
make them the one thing the map has always been for; that is a judgement, and Joe can
overturn it with the knob or a word.

**Tests.** HUD and map, so smoke alone: 103 checks. The heartbeat check now wants one beat
over two fresh tiles and none after the first; a new check wants the gold gone on an empty
locked pill with the lock still armed; a new check runs a save twice and wants the beckon
on the first run only, then charts a gate, a statue and a stone and counts what the map
draws of them: nothing. Proven red against the committed code.

## A crawl gap is never a plus (v0.104.0)

Joe, asked whether a crawl gap should ever be open on both axes: *"No a crawl gap should
never be also a push gap."* Read as *plus* gap, the shape in his screenshot — dictated
from a phone. v0.94.0 made the plus walkable; this makes it not exist.

**How common it was.** Over 120 Child mazes, 506 of 3,215 crawl gaps had a third open
side and 418 of 834 crawl cells a third way out. The extra sides were rooms and courts
carved before the gaps were laid (the gap placer never looked sideways), the exit tree's
holes beside room floor, and L-shaped squeezes whose far cell kept its own corridor link
— a T by construction, every time.

**One question, asked everywhere.** `gapFits(x, y)`: floor on one axis, wall on the other.
The gap placer asks it of every candidate; the L continuation asks it of the new hole and
only makes the L where the far cell would end up with its two holes and nothing else; the
secret room's way in prefers a hole that reads so once the room is floor; the exit tree
asks it of every hole it makes; the hole on the route asks it too. And a sweep at the end
of the build removes any gap or crawl cell that a later carve — a vault's rings, the start
room's ring, a statue — has given a third side, counted in `plusSwept` so the probes can
see the sources doing their part. After: 0 of 2,703 gaps and 0 of 787 cells over the same
120 mazes, with the sweep removing 24 across 21 of them. The Child's mazes carry about
four fewer gaps each — the plus-shaped ones were never good holes.

**Tests.** Generation, so all three. Harness PASS 576 with a new invariant that reads the
shape and no knob; `crawlGaps` and `crawlCells` join the snapshot. Selftest 19 of 19 with a
flank opened beside a gap. Smoke 101 after the merge with main: a new statistic over 60 Child mazes, and the v0.94.0
movement check now passes on finding nothing plus-shaped, keeping its rule for the day one
slips.

## Rooms spread out (v0.102.0)

Joe, with a screenshot I could not see: *"All the rooms are pushed into the same
space. These should be more spread out."* QUALITY.md had already measured the sharp
end of it — two rooms on one tile in 1 Archivist maze of 30, seven of 30 with two
rooms within four tiles — and left the note *"fewer rooms or a spread rule, not a
retry."*

**Why they clumped.** The placer took the *first* spot not too close to another room,
and after twenty misses settled for wherever it happened to be. So spread was what
it settled for when the dice were kind, and where there were most rooms the dice
were least kind.

**The spread rule.** Each room now draws `roomSpreadTries` legal spots and takes the
one farthest (in tiles, by the larger axis) from every room already placed. Spread is
chosen, not settled for. A best spot that would still touch another room means the
maze has no ground for this room and it goes without: a room on a room is not two
rooms. Measured on the same 60 seeds per chapter, before → after:

| chapter | rooms | closest pair | median gap |
|---|---|---|---|
| The Child | 4.3 → 4.6 | 6 → 10 | 14 → 14 |
| The Cartographer | 3.4 → 3.5 | 6 → 8 | 18 → 20 |
| The Soldier | 3.3 → 3.0 | 2 → 8 | 12 → 18 |
| The Archivist | 11.2 → 10.3 | **0 → 8** | 8 → 10 |
| The Priest | 7.2 → 7.6 | 6 → 10 | 12 → 16 |
| The Criminal | 7.3 → 7.5 | 6 → 10 | 12 → 16 |
| The One Who Stayed | 14.7 → 14.2 | 6 → 10 | 10 → 14 |
| You | 1.6 → 1.6 | **0 → 8** | 18 → 22 |

Gaps are the contract's own measurement (`contract.js`, walking distance between the
closest two rooms). No maze puts two rooms on one tile any more, and the closest pair
is eight tiles or better everywhere. The Archivist's median of ten is still a few
seconds' walk: eleven rooms in a lg maze is the cause, and fewer rooms is the lever
left, which is Joe's to pull (`rooms: 1.6` on its phase).

**A bug the spread rule shook out, in the exit gauntlet.** The first harness run went
red on one seed, 32676 in The Child, twice over: a route tile at 22,5 had become wall,
and the exit could be reached without going through the squeeze tree. Toggling features
on that seed pinned it: the gauntlet. It shuts the tree's side links to the rest of the
maze, one at a time, keeping any that would strand floor — but the trunk is read off the
*cell lattice*, and where the way out crosses a room it leaves the lattice, so a link the
lattice reads as "off the tree" can be the route's own next step. Nothing was stranded
because there was another way round, which is the bypass the second invariant caught.
Two fixes, both small: the gauntlet never shuts a tile of the route, and a tree that is
not the only way to the exit is not built at all rather than kept as a decoration with a
bypass. The Child's gauntlet is the same size on average (17 tiles over 60 seeds) and
the maze at 32676 gets a shorter tree that is the only way. Latent since v0.4x; the
rooms moving is what made the route cross one beside the tree.

**Tests.** Generation, so all three. Harness PASS 576 with a new invariant, *no two
rooms share ground*, which reads the rooms' rects and no knob. Selftest 18 of 18 with
its breakage. Smoke 97 with a new statistic over 60 Child and Archivist mazes: no two
rooms within four tiles, proven red against the committed generator (one pair 0 apart).
Two probes went red on the new geometry and both were the probe: the spiral read its
turn before the spiral had ever been drawn (`spin` undefined), and the ball pit stood on
the exact middle of the first pit it found, which now had no ball within reach. The
spiral waits a frame; the pit probe walks about the pit as a player would.

## Hopscotch stops at four (v0.101.0)

Joe: *"Hopscotch should stop at four. It's too long otherwise."* The court took up to
eight squares of any straight run of five or more. `hopscotchSquares` is the knob, four,
and a run has to be at least that long to take a court, so no court comes up short.
Own batch, on purpose: it is a generation change, and the room-spacing work behind it
needs a clean measurement that a hopscotch change would not disturb but might be
blamed for.

**Tests.** Generation, so all three. Harness PASS 576, selftest 17 of 17, smoke 96 with
one new statistic: every court over 60 Child mazes is exactly four squares. The bar is
Joe's number written into the check, not read from the knob, and it was red at eight.

## The charcoal heartbeat, the lock, and the compass on the floor (v0.100.0)

Three HUD items from the doc. Joe: *"The charcoal icon on the hud/screen should have a
little pulse to it every time a tile is logged. Like a little heart beat as the player
is walking."* — *"The press and hold for the charcoal lock needs a stronger visual to
show it's locked, maybe a bolder outline."* — *"The pickup for the compass should look
different than the main character as well. Make it look like the icon that shows up
when you collect it."*

**The heartbeat was there and could not be seen.** `beat()` fired on every tile logged,
as it has since it was added, and swelled the pill 8% over 440ms. At walking pace a tile
lands every ~430ms, so the animation never came back to rest between tiles and read as
a faint continuous wobble, which is to say nothing. A re-listed item is a still-wrong
item. Now: a 20% swell with the ring flashing, 360ms (`charcoalBeatMs`), so it beats and
rests, beats and rests, as he walks.

**Lock-on** is a 2px gold border on the pill itself, a wider halo, and the stick inside
goes solid gold. The resting pill's border is 1px and dim.

**The compass pickup was his own arrowhead lying on the floor** — the very confusion
that had the compass beside him redrawn as an instrument in v0.7x. It is the same
compass now, small: the case, the north tick, and the needle already turned toward the
way out. The tutorial card's icon matches.

**The version.** Main was at v0.98.0 from the other session when the statue batch
merged as v0.99.0, so this is v0.100.0. Not v1.0.0: that number says something about
the game that is Joe's to say.

**Tests.** HUD and render, so smoke alone: 95 checks, three new. The heartbeat check
reads the stylesheet's own keyframe for its peak (bar 1.15) and the beat's length
against a walking step, and watches the class land on a fresh tile. The lock check
compares computed border and shadow, locked against resting. The compass check samples
the canvas on the case's ring at right angles to the needle: brighter than the face
inside it and than the floor beside it. All three proven red with the old CSS and the
arrowhead back.

**Still red, and not this batch's:** *the pool is light at its rim and deep in the middle,
and the rings travel inward* failed three of seven smoke runs today, passing the other
four with nothing changed between them. It matches frames by index at 60ms naps and
asks the last shift to exceed the first; under load the frames land unevenly and the
shifts come back 2, 2, 2 or 2, 1, 1. Main's change to `pool.js` since v0.94.0 is text
only, so this is the check's timing, not the water. Raised with Joe rather than
loosened here.

## One person to a chapter, and the Teen (v0.99.0)

Four items from the doc, all statues. Joe, with screenshots I could not see: *"I don't
think this is how it's supposed to look for the statues. The grey oval is out in
darkness. The symbol above the bowl doesn't match the one I was carrying."* — *"When
you don't have a stone but you collide with the statue, it should say something."* —
*"The Child section at the start of the game is the main character as a child, not
their child. We might call their child The Teen. Please correct the questions in these
two sections."* — *"We need to lock in each person to each chapter. So child chapter
has statues of the father. The mom gets another one, and the friend and so on to the
Teen getting the last one."*

**Two children, not one.** The Child is the chapter: the man himself, small. The Teen
is the man's own kid. The person's id is `teen` everywhere now (`child` was the id
before, and a save's `asked.child` count carries over), and their card says *my kid*,
which is what a father calls them. The father's four exchanges are read in two
chapters, so the first two are asked in the Child's maze and are written in the boy's
voice — lowercase, *are you coming back?* — and the last two in the Priest's, a man
asking a dead one. That is the reading I took of "correct the questions in these two
sections": the Child's chapter speaks as a child, and the Teen is named as the Teen.

**One person to a chapter.** `shrines` in `data/phases.js` names them: father in the
Child's, mother in the Cartographer's, friend, spouse, then father and mother again
for their last two questions, spouse's last two in The One Who Stayed, and the Teen in
*You*, where the make-believe is stripped away. Both statues in a maze are theirs, so
both stones carry their mark, and the bowl's symbol always matches the stone in your
hand — that was Joe's mismatch: two of five people dealt at random. Either bowl takes
the stone now, so a stone is placed far from *every* step, not just its own; measured
from one step it could lie at the other statue's feet. Five people, four questions,
two statues a maze, eight chapters: friend and Teen get one chapter each. Joe's to
reassign by changing a word per line.

**The niche.** The statue's tile is wall, so it was a grey egg with a dot floating in
black. Now the tile is a recess of dim floor with the wall's lip round it, a plinth,
and a figure with head and shoulders in the stone's pale colour. Seen before believed,
at the step and two tiles out.

**Empty-handed.** Step up to a statue with nothing in your hands and he says the bowl
is waiting for something he has not found. Once per visit, like a spent statue's line.

**Tests.** Generation changed, so all three. Harness PASS 576 with a rewritten
invariant (*each statue has its stone, and the stone lies well away from it* now
counts a person's stones against their statues and walks to the nearest) and a new
one, *every statue and every stone in a maze is the chapter's person*, with
`shrineWho` in the snapshot. Selftest 17 of 17 with a new breakage. Smoke 88: a new
statistic over 240 mazes (every statue and stone the chapter's), and the stone walk
rewritten for either bowl and the empty-handed line.

## The plus-shaped squeeze (v0.94.0)

Joe, with the seed the new tag gave him — 5855848, The Child, tiles 123 and 124:
*"anytime there's a 'plus' shape for a squeeze it doesn't let you cross through one
of the sides. This one won't let me go up or down. Only left to right. Also, the tile
next to it blocks my path to the rest of the maze."*

**Reproduced on the first try, once there was a seed.** Tile 123 is a crawl gap and
124 the crawl cell beside it, and both are open on all four sides — a room carved
next to them after the gaps were laid. Pushing up or down from either moved him 0.14
of a tile and held him there. A T-shaped gap elsewhere in the same maze blocked its
one sideways arm the same way. So the v0.93.0 "could not reproduce" was true of
the T shape I built by hand, and wrong about the game: the shape that fails is a
squeeze with arms on both axes, which the probe never made.

**The cause is the squeeze clamp choosing its axis from the tile's shape.** It held
him on y if the tiles left and right were open, else on x — right for a gap between
two cells, which has arms on one axis only. In a plus or a T the clamp picked one
axis and pulled every step along the other straight back to centre. Now, where a
gap has an arm on both axes, the channel is whichever way he is walking, and with
the stick idle it keeps its last answer; a one-axis gap behaves as before. Movement
only; nothing about the maze changed. Whether a crawl gap should ever *be* a plus
is a generation question left for Joe — the drawing reads oddly but he crosses it.

**Why the tile numbers moved between his two screenshots (523 → 524).** A sliding
tile is floor that moves. While it is in flight, its old spot and its new spot both
read as wall, so the count of open tiles drops by one and every number past it
shifts down until it lands. Not the maze changing under him: a tile mid-slide.

**Tests.** Movement change, so smoke alone: 87 checks, one new — *a squeeze open on
both axes lets him through every one of its arms* — which scans seeds for every gap
or crawl cell with three or more open arms and walks each arm from the tile's
centre, failing on any that moves less than 0.3 of a tile (the clamp held at 0.14).
Proven red with the old axis rule.

## The seed on the picture, and the T he could not pass (v0.93.0)

Joe, with two screenshots of a T junction: *"I've seen this issue a couple times
where we have these t intersections where I can't move through them. Here's the
navmesh. For some reason the tiles are changing up and down in numbers. Is that
because of moving tiles? Also, the nav mesh isn't showing the seed for it to be
easy for you to reproduce."*

**The seed was there — where no phone screenshot reaches.** Bottom left, under the
joystick and the home bar. It now sits at the top of the picture, under the HUD
row and below the narrator's line, and reads *The Child · seed 57 · tile 89 of
494*: which self, which maze, which tile he stands on. Its height is `navTagTop`;
the first cut at 96px sat exactly on the narrator's line, seen in the screenshot
before believed. Canvas text is not in the DOM, so the string drawn is kept in
`navTagText` for the smoke suite.

**The numbers are not moving tiles.** The nav view numbers every open tile in
reading order, left to right then top to bottom, once, when the maze is built.
Walking down a column the number jumps by however many open tiles lie in the rows
between, so 60 → 78 → 89 is a maze with about a dozen open tiles per row, not a
maze changing under him. Sliders are open tiles like any other and get a number.

**The T itself did not reproduce.** Eighty runs through his exact shape — a 1-wide
stem meeting a 1-wide bar, approached from every arm, at stick angles across the
full quarter — and every one crossed. Two false positives on the way: a "stop" at
0.56 tiles that was `squeezeSlow` (0.4) through a crawl gap, honest slowness that
reads as stuck on a phone; and one true stop that was a pushable block sitting at
the corridor's end. The squeeze does not bleed: 0 of 14,281 tiles outside a gap's
reach reported it. The tag exists so his next screenshot carries the seed and the
tile, and I can stand exactly where he stood.

**Tests.** Render/UI change, so smoke alone: 86 checks, one new — *the nav view tag
names chapter, seed and tile, and sits below the narrator line*. The bar for
"below" is the narrator element's own bottom edge, read from the DOM with a line
showing, not the knob. Proven red with `navTagTop` back at 96: tag top 96px,
narrator bottom 120px.

## The book in the water (v0.92.0)

Joe, with the first screenshot I have ever been able to see: *"Floating book in
blackness. Something happened with the placement of one of the books in the first
level for the child. It's floating out in an open space."* Two other items came in
with it — Reset save leaving charcoal, the map and his colour grade behind, and
charcoal appearing in the Child's mazes.

**Measured, four ways, and the first three were wrong.** The harness had every
page on floor and reachable, the Child included. A count of floor round each page
said three-quarters of Child rooms were "damaged" — until `roomCells: [2, 3]`
showed 3×3 rooms exist and the metric was reading room *size*. Switching off the
Child's `sparse` prune changed nothing; switching off districts made it slightly
worse. A paint probe found black on three sides of 25 pages — and every one turned
out to be a landmark's own dark furniture on the floor. All four are recorded so
nobody walks them again.

**The fifth found it: 69 of 598 Child pages lay in a pool room, and 68 of those
under the water.** A page goes at its room's centre, and a pool room's centre is
the deepest, near-black water; the book is painted after the pool. A pale book on
black water with the rings round it, at the top of a screen whose lit floor is the
rim — that is the screenshot. Not a placement bug in the model's terms: the tile
is open and walkable. A render collision.

**The fix is one pass at the source.** Every consumer of a room's page spot — both
page assignments, the route-nearest reorder, the hopscotch — reads `roomCenters`
*after* the landmarks are built. So once they are, **any** room centre that falls
inside a pool's water moves to that pool's nearest rim tile, and all of them
follow. The rim is the floor you walk round; the disc covers everything inside it.

"Any room's", not "the pool room's" — the first cut only moved the pool's own
centre, and smoke found one page still wet in 200 mazes: room spacing is a soft
rule that settles after twenty tries, so a second room had overlapped the pool
and dropped its own centre in the water. The general rule catches both.

**Reset save and the Child's charcoal did not reproduce.** End to end on v0.91.0 —
a run at phase 3 with charcoal in hand and 249 tiles charted, Reset, wait past the
six-second autosave, reload the page — comes back at phase 0, The Child, charcoal
0, map at the 49 home-room tiles, no run, nothing collected; the same from inside
a Child run. And the Child's mazes place no charcoal at all: none on the floor and
none in the home room, over 80 mazes. Both reports match v0.90.0 exactly, where
Reset left you in the old maze and the autosave wrote the old run straight back.
The likeliest reading is a phone that had not yet picked up v0.91.0. Joe is asked
to confirm the version in the panel's corner before either is chased further.

**Tests.** Harness PASS 576 with a new invariant — *no page lies in a pool's water*,
which reads no knob: a page in a pool room must be on the room's border ring.
Selftest 16 of 16, a page dropped at a pool's centre as the new breakage. Smoke 85:
one new statistic over 200 mazes across all eight selves, zero pages in the water.

## Reset save restarts the game (v0.91.0)

Joe: *"When I reset my save it should just restart the game as well."* It erased
the save and left you standing in the old maze with the old HUD — the one control
in the debug panel that did not restart. Every other option there already ends
with the same three calls: a fresh maze at phase 0, asleep on the mat, panel
closed. Reset save now does the same. UI only, so by the verification dial: smoke
and a look, no harness. Smoke 84, one new check that resets from a run at phase 3
and finds the save gone, the panel closed, and him asleep on the mat over a new
maze; it goes red with the restart line removed.

## The exchange (v0.90.0)

Joe: *"You drop the thing in. You are then allowed to ask a question, maybe two are
offered. These questions are about the burden/trauma/person who hurt you or you
hurt, etc. you then get an answer."* And, after the first batch: *"There are five
right now, not four."* And: *"Not sure why we don't have one in the first child
chapter. Seems like it would be a good idea."*

**Five people now** (`PEOPLE`), from his CHARACTERS notes: the father who left and
is dead; the **mother** he carried as a boy and walked away from as a man, who
resents him still; the wife who sees past the shell; the friend he was too rigid
with, or pulled down; his child, fifteen, who does not understand why he will not
just get help. The mother's mark is a chevron. **The Child's chapter has statues
too** — I had kept them out to protect that chapter's theme; Joe's read is that
the abandoned boy has as much to ask as anyone, and he is right.

**The exchange.** Set the right stone in the bowl and a folded card opens — the
same fold as a tutorial — with the person's name and two questions. Ask one and
its answer appears beneath; the other stays on the card greyed, *"— I didn't
ask."* For a man who spent his life not asking, the unasked question is a
character note, not a penalty. Close is not offered until a question is.

**Progress is per person and per game**, not per maze: `SAVE.asked[who]` is how
far down their steps you have come, and every statue of theirs anywhere in the
game continues from there. Each person has four steps — eight questions and eight
answers — and when they are spent the statue has **one line left and says it
every time**, on the floor, with no card. That is the goal state Joe described,
not a fallback: a statue with nothing left to say to you. Step up to a statue you
have already satisfied and it says so, once per visit.

**The writing, first pass.** The maze is written vague; these are the only voices
in the game that belong to real people, so they are written the other way —
small, specific, and each with an arc across their four steps. The father moves
from *I meant to* to *I'm just what happened.* The mother from present-tense anger
to *You were right to go. I'll never say so to your face.* The wife from *I've seen
you the whole time* to *Come out. Not all the way. A hand.* The friend from *Yes, I
was already going, you made it lonelier* to *The hand's still out.* The child from
*Are you going to do anything about it or is this another one of the talks* to
Joe's own line, *Stop being stubborn and love me.* Joe rewrites; the shape is
what this pass is for.

**One bug from v0.89.0 fixed.** `tutorial('offering')` referenced an icon that did
not exist. Smoke never fired it because the probe pre-seeds every tutorial as
seen; a player's first stone would have thrown. Icon added.

**Tests.** Harness PASS 576 (the Child's mazes now carry statues, under every
existing invariant). Selftest 15 of 15. Smoke 83, two new checks — one walks the
whole exchange (card, two questions, one asked and answered, the other unasked,
progress advanced once, a second tap ignored, close and unpause) and one spends a
person entirely and confirms the statue takes the stone, opens no card and says
its finished line.

**Not in this batch.** The pool level is the same exchange at a larger scale and
should draw on the same CHARACTERS notes; Joe flagged it, and it is its own
batch. Real objects instead of stones remain the version after.

## The statues, and the stones they wait for (v0.89.0)

Joe, from THOUGHTS: *"a sort of mini quest where you find something in the maze
that needs to go someplace else in order for you to deal with some part of the
burden or trauma of that character. This means that you'll have to backtrack
around the maze and therefore mapping and chalk might be more useful. This is the
statue idea."* And, deciding it: *"a man surrounded by loved ones, too lost in his
own maze to see it. He's hurt those around him, been hurt as well. We need the
full picture of it."*

**What this batch is.** Deliveries exist. A carried thing with an identity, and a
place that accepts it — statues are the first client, and the rose to the
restaurant table is the second, for free. No words yet; that is the next pass.

**The four people** (`PEOPLE`, `data/text.js`): the father, the child, the wife,
the friend. Each has a mark — a bar, an arc, a cross, a wave — and none of the
marks is a key's shape, so a stone never reads as a key. Two statues a maze from
the Cartographer on, never the Child's: her chapter is already about waiting for
a man who does not come, and statues would dilute it.

**Where they stand.** A statue takes a dead end: the tile itself becomes stone you
can see and not cross, and the one tile before it is the step with the bowl.
Claimed *before* the loot rolls, for the reason v0.88.0 measured — what claims
its ground first gets placed. Its stone lies as far away as the dead ends allow,
by walking (`offeringMinTiles`, the same bar as a key from its door), so finding
one means remembering the other. Own RNG stream (`seed + 4001`).

**You carry one.** Find the second stone while holding the first and you cannot
take it — you have to remember where it was and come back. That single rule
manufactures the backtracking Joe wants, and it is the first thing in the game
that makes the map matter for something other than the exit. `carryMax` is the
number to test.

**What a statue does.** Nothing gates on them — the journals are the game's only
gate. Set the right stone in the bowl and the statue goes white and points its
thread at the **nearest page you have not found**, for `shrineThreadSec`. Not the
exit: by the time you have done an errand you have usually found the exit. The
last page is the thing you are still hunting, so that is what the reward points
at. If no page is left, it says so and points at nothing.

**Two things measured wrong and fixed before shipping.**

*A statue cut the maze in half.* Three small "You" mazes in 576: the statue took a
cell beside a pushable block. To `isOpen()` that cell is a dead end — the block is
wall until it is shoved — but in play it is a through-passage, and turning it to
stone cut 26 tiles adrift and the exit with them. The same planner-versus-player
mismatch as the v0.85.0 soft lock and the v0.87.0 fragments. Nothing that touches
a slider, the route or the exit alley gets a statue now.

*The statue was invisible two tiles away.* Sampled: `27,31,33`, which is wall. The
ring of six goes dark until you are beside it and reads fine because it stands in
a lit room; a lone figure at the end of a corridor did not. `shrineRestLight`
keeps the figure lit and leaves only the glow to proximity. (The first screenshot
that "proved" this actually had the statue one tile out of frame — check the
framing before believing a rendering bug.)

**Placement measured** over 320 mazes: 2.00 statues and 2.00 stones in every phase
from the Cartographer on, 0 for the Child. Mean walk from statue to stone 53–116
tiles by phase; the few under `offeringMinTiles` are stones behind a pushable
block, which the plain walk cannot see and the player can shove.

**Tests.** Harness PASS 576 with a new invariant — *each statue has its stone, and
the stone lies well away from it* (bar eight tiles, reads no knob) — and the
floor and reachability invariants extended to stones and steps. Selftest 15 of
15, with a stone dropped at its statue's feet as the new breakage. Smoke 81, two
new checks: one for placement across 210 mazes and one that walks it — picks a stone
up, fails to take the second, is refused by the wrong bowl, is taken by the
right one and lights a thread that ends on a page.

**Not in this batch, on purpose.** The exchange — the question you are allowed to
ask, the answer, the finished state that says its one line — and every word the
four of them say. Real objects instead of stones (his watch, their drawing) are
the version after that; Joe: *"that's the right answer. Let's do that for the
second version."*

## The maze gets what the phase asked for (v0.88.0)

From Joe's THOUGHTS list, and the first step of it: *"I think we're gonna have to
rethink how we generate our mazes... Ideally working backwards. Deciding how many
things we want in the maze to requirements and then building the maze around those
things. This gets away from a maze that is x by x size and instead focuses on the
content of the maze."*

**Measured before touching anything**, across 1400 mazes:

| | asked for | placed |
|---|---|---|
| vaults | 2400 | **100%** |
| map fragments | 4200 | **100%** |
| **locked doors** | 3000 | **46%** |

343 mazes — near a quarter — had **no locked door at all** in phases that call for
one to three. The two rows at 100% are the two that **claim their ground before
anything is carved**. Doors had to find a legal spot in finished geometry, and
usually could not. That is Joe's whole point, in one table.

**Where the doors actually died was not placement.** Instrumented on the three-door
phases: 2.59 door *positions* were found per maze and only **1.21 survived**. The
rest were thrown away because there was nowhere in their section to hide the key —
72% of the losses report *no free cell in section* — and one failure breaks the
chain for every door behind it. The failing sections hold **6.3 tiles, 2.4 cells,
0.8 of them off the route**. There is nothing there.

**Two fixes that did not work, recorded so nobody tries them twice.** Giving each
door a minimum stretch of route for its section: byte-identical up to 0.15 of
`keyDoorMinTiles` and worse above it, so door *spacing* is not the constraint.
Raising `vaultMax` once the doors were guaranteed: no effect at all, 2 through 4.

**What does work is refusing to ship short.** `generate()` is now a wrapper that
builds, counts, and re-rolls the seed when the phase's manifest is not met —
exactly what `buildProto` has always done for prototypes. It scores a build by its
doors first and then by how many keys lie in a nest, because the loop is running
either way and taking the first adequate maze throws away the better one two seeds
later. `manifestSettle` only applies once the doors are in, which matters: the
first cut let it stop hunting while a door was still missing and sat at 94%.

| over 1400 mazes | before | after |
|---|---|---|
| locked doors placed | 46% | **99%** |
| mazes with no door at all | 343 | **0** |
| doors per maze | 0.98 | **1.70** |
| keys in a nest | 59% | 55%, on 73% more keys |

A seed still maps to one maze — the variant is derived from the seed — so run
signatures are unchanged. Generation costs about **300ms** now against 40ms for a
single build, paid behind the title screen.

**The three-door phases now ask for two.** Every seed measured reaches two doors;
almost none reaches three, however many re-rolls it is given. That is the
architecture, not the dice. Three is what the rewrite buys.

**Four smoke checks went red and none of them was a regression** — re-rolling gives
every seed different geometry, and four checks were leaning on the old one. A probe
that walked into a locked door and reported "never turned" (there are nearly twice
as many doors now, and every junction on that route had one on an arm); a charcoal
count quietly topped back up by pickups the probe walked over; and two that passed
on `--seed 777`. Each is fixed to ask the maze for what it needs rather than take
the first thing that looks close. **Run it again, and on another seed, before
believing a red check unrelated to your change.**

**Tests.** Harness PASS 576 with a new invariant — *a phase that wants locked doors
gets at least one* — and a new selftest breakage for it, 14 of 14. Smoke 79, with
*a maze gets the locked doors its phase asked for* at 99% against a 90% bar.

## Keys in nests, because the doors went to them (v0.87.0)

Joe: *"Getting keys should be an adventure! We may even add additional story to
them. All keys should be in vaults kind of like this. Some sort of cool challenge
to get to them. If you can't think of one then just mirror the one you have. We
need to get away from just finding keys in the hall."*

**Measured first.** Every maze already had a vault, and it was barely used: **58
of 270 door keys lay in it, 212 were loose in a dead end** — one key in five.

**The obvious build was the wrong one.** Mirroring the nest, one per key, is what
he suggested and it is what I did first: `vaultRect` became `vaultRects[]`,
`keyVault` became `keyVaults[]`, each nest drawing its own RNG stream so a second
can never redeal the first one's rings (`rng(seed + 31337 + vi * 101)`), sized
down through `vaultCellsMin` when several must fit, spread by taking the legal
spot furthest from those already claimed. Behaviour-preserving: `vaultMax: 1`
reproduced v0.85.0 exactly, which is how I know every number below is the nests
and nothing else.

It went from 21% to about 39% and stopped dead there, and it cost a quarter of
the doors per maze. More nests did not help; they only ate ground a door needs.
That was the point to stop, and it went to Joe with the numbers, because his own
rule says so: *"if it's a trade-off I should be making instead of you."* He chose
the third option — **place the doors to suit the nests** rather than hope a nest
lands where a door needs one.

**Why it was stuck at 39%.** A key may only lie in the ground its own door opens.
The nests are staked out before the rooms, long before there is a route or a
door, so a nest usually sits in the wrong section for the key that needs it and
the key falls back to a dead end. No number of nests fixes an ordering problem.

**What actually fixed it was one bound.** Doors were picked from a window of the
route `L / (2 * (n + 1))` either side of their even-spread mark. Instrumented,
that window held **4.6 candidate tiles on average, and none at all a third of the
time** — so a door had almost no choice about where to stand, and no room at all
to be steered. Searching the **whole route** instead, still in order of distance
from the even mark, and taking the first tile that both severs the route and
leaves an unclaimed nest in the section it closes:

| over 2100 mazes | doors per maze | keys in a nest |
|---|---|---|
| v0.86.0 as it stood | 1.023 | 23% |
| one nest, whole-route search | 1.077 | 41% |
| **two nests, whole-route search (shipped)** | **0.995** | **57%** |
| three nests | 0.942 | 61% |
| four nests | 0.933 | 62% |

The widened search *gains* doors — it finds severing tiles the window could not
reach. Nests spend them. Two is where the curve turns: 57% for 3% of the doors,
which is inside the run-to-run noise. Three and four buy four more points for
five times the price, so `vaultMax` ships at 2.

**What I did not do.** `vaultGrow` grew the maze to fit the nests, on Joe's
standing rule that a maze too small for what it holds should get bigger. Once the
doors could move, the maze was not too small: growing it bought back half of a 3%
door dip for **15% more ground to walk**, which he did not ask for. The lever
stays, off, for a day it is really needed.

Two passes over the door positions — placing them provisionally, then again
knowing where the rest landed, so each section is modelled exactly — is correct
and changed **not one maze in 840**. It is not in the code; the comment says why.

**Three bugs found while verifying, none of them reported.**

*Fragments that a shove puts side by side.* The v0.86.0 spacing rule walked the
maze as it stands. A player can shove a block: two fragments either side of one
measured two dozen tiles apart and stood **four** apart in play. The same
mismatch between the planner's model and the player's that put a door key on the
wrong side of its own gate in v0.85.0, and the same one-line shape of fix — the
walk now counts slider tiles and the squares those blocks move into. Two mazes in
576. Settling also has a floor now: rather than place a fragment inside another's
patch, that maze goes without.

*Rooms carved through by a vault.* Room placement tries twenty spots and then
settles for wherever it landed. Fine for keeping rooms apart, but a vault's rings
are cut long afterwards, straight through whatever is standing there — **six
rooms in 547** ended up with walls across the middle and a landmark you cannot
walk around, once there were two nests to lose to.

*One well the start room walled in.* Same fallback, older bug: a room that
settles on the start-room corner gets its floor taken by the seal that shuts that
ring at the very end. This could always have happened and finally did.

Both are now refusals rather than fallbacks — a room the vault or the start room
would carve through is not a room, so the maze goes without. It costs four rooms
in 538 and takes the landmark check to a clean 534 of 534.

**Tests.** Harness PASS 576. Selftest 13 of 13. Smoke 78 checks, one new: *most
door keys are found in a nest, not loose in a dead end* — bar fixed at 45%, which
reads no knob, because this suite has twice shipped a check that computed its
expectation from the thing it was testing and therefore could not fail. 45% sits
above every way of reverting this (one nest reaches 41%, the narrow window with
two nests 37%, the game as it stood 23%) and well under the 59% it ships at.
Proved by reverting the search bound and watching it go red at 37%.

## Fragments worth finding, and charcoal that knows about them (v0.86.0)

Both items are the pickup allocator, which is why they are one batch.

**Fragments were landing on top of each other.** Joe: *"I had three map fragments
all right next to each other, which means that the last two were basically
useless."* True, and measurable: a fragment charts a patch about **eleven tiles
across**, and the closest pairs were landing **four to ten tiles apart** — the
second one sitting inside the first one's patch, charting ground already charted.
Scraps were placed with a bare `pickFree()`, which is a uniform pick over dead
ends and knows nothing about the others.

They are held apart by their own reach now (`mapScrapApart`, in patch-radii), and
by **walking** distance rather than a straight line, because walking is how you
get to the second one. Each new one goes as far from those already down as the
dead ends allow, and settles for the farthest available only when nothing clears
the bar — short of the rule beats none placed at all.

Closest pair, before and after: **4–10 tiles → 22–24**, with **zero** pairs under
twenty on any of the four selves that have fragments.

**And the charcoal knows about them.** *"If there are map fragments on the map we
can spawn less charcoal since the fragments supersede the charcoal."* The budget
covers the floor the fragments will not chart. Both numbers are known at the
point the budget is worked out even though the scraps are placed later, so
`scrapPatch()` is shared between the two.

**38–39% less charcoal** on the selves that carry fragments; **0% on the ones
that do not** (the Cartographer and the Soldier have no scraps, and their budget
is untouched).

### The assumption this makes, which is Joe's to keep or drop

"Enough charcoal to map the whole maze" — a standing agreement since v0.79.0 with
a check behind it — now means **enough together with the fragments**. A run that
never finds a fragment is short.

That is capped rather than open-ended: `mapScrapCharcoalFloor` holds the budget at
**60% of what it would be with no fragments at all**, so the worst case is mapping
three fifths of the floor rather than falling off a cliff. At the current numbers
the cap is what is binding — the fragments chart about 40% of the floor and the
drop lands at 38–39%, right against it. **Raising the cap is one number if he
wants more margin; lowering it takes the credit further.** The check's name
changed to say what it now checks, rather than quietly meaning something else
under the old words.

The spacing rule is a **harness** invariant, not a smoke check — it is a property
of every maze generated, not of a frame.

### Two checks that read the knob they were policing

Both written, both green, and **both unable to fail** — found by reverting, not by
running.

The spacing check computed its bar as `radius * mapScrapApart * 0.5`. Setting
`mapScrapApart: 0` to test it therefore set the **bar** to zero too, and it sailed
through with the spacing rule switched off. The charcoal check had the same shape:
it worked out what it expected from `mapScrapCharcoalFloor`, so moving that knob
moved the expectation with it.

The bar is **one patch radius** now, and reads no knob at all: *a fragment must not
sit inside another fragment's patch*, whatever the tuning says. generate() aims for
twice that and settles for less only where the ground offers nothing better, so
there is room between the aim and the bar for an awkward maze. And the charcoal
check is reverted against **the code** — the budget ignoring the fragments — rather
than against its own knob.

The general form is worth keeping in mind: **a check whose expected value is
derived from the thing under test cannot fail.** Both of these looked like
perfectly ordinary checks until something tried to break them.

## The gate in a doorway, and the soft lock, finally (v0.85.0)

Two items about gates and keys, and the second one has been sitting in this file
as *deferred* since v0.75.0.

**A gate belongs in a doorway, not at a junction.** Joe: *"found another hot gate
that was at a T intersection and didn't make any sense."* He is right, and it is
worth being precise about what was wrong: **nothing was ever unwinnable.** A door
seals its own tile, so a door at a T still cuts the route. It just looks like
nonsense — a gate is two jambs and two leaves, and on a tile with three open
sides one jamb stands in open floor while a leaf swings across an arm that stays
open. **39 of 287 doors were landing on a T or a crossroads.**

`okGap` only ever asked for a *link* tile, which is a passage but not necessarily
a doorway. It also asks `doorway()` now: exactly two open sides, opposite each
other. **282 of 282 doors stand in a doorway**, and it cost 5 doors in 280 mazes.

**And the soft lock, which was one line.** Joe: *"found one of those soft locks
where the key was on the wrong side of the gate. I think with the key fixes I
mention below, we should be able to fix this."* His instinct was that it was
bound up with hiding keys, and it was — but not in the way either of us expected.

Planning treats what you can slide through as open. It used to treat **every
sealed gap** that way, and most sealed gaps are not blocks you can shove: they
are wall, and no amount of pushing opens them. So the planner would walk into a
sealed pocket through a gap that never opens, conclude the cell sat *before* the
door, and hide the key there. In play it sat behind it.

Only the gaps a block can actually come to rest in are reopened now — the slider
tiles and the squares those blocks move into. **The harness is clean at 576 for
the first time since v0.75.0.** It costs 4 more doors, because some tiles stop
severing the route once the ground behind them is honestly unreachable: 287
doors before this version, 278 after, across 280 mazes. 3% for a maze that cannot
be made unwinnable.

### How it was found

Reading, then one probe, then one experiment — and the first probe was wrong.

Counting doors by the shape of the tile they stand on gave the T number
immediately, and `horiz = isOpen(x-1,y) && isOpen(x+1,y)` in the renderer
explains the rest: at a T both are open, so it draws horizontal regardless.

The soft lock took a wrong turn first. A hand-rolled reachability probe said
**246 of ~300 keys were unreachable** against a known two bad mazes — because it
modelled a player who never pushes a block, and the whole maze is built on
pushing. Throwing it away and reading the harness's own `openTiles` (which treats
every slider tile *and its destination* as open) is what showed the real gap:
generation and the harness disagreed about which sealed gaps ever open.

**Two docs were saying the opposite of the truth** and both are fixed here, not
later: this file's Standing Decisions said *do not go after it*, and
`HANDOFF.md` §Doors and keys said *do not report the harness as clean, either*.
A rejection that has been reversed will stop work Joe has since asked for, which
is exactly the failure mode those two sections exist to prevent. The dated
per-version sections below still say "deferred" and stay as written — they are a
log of what was true then.

The doorway invariant is a **harness** check, not a smoke one — it is a property
of every generated maze, not of a frame. It has a deliberate breakage in
`selftest.mjs` (13 now), which opens a third side of a door's tile and confirms
the right check catches it. The soft-lock fix needs no new check: `maze is
finishable` and `doors chain` have been reporting it for ten versions, and they
go green.

## The basin you can count, and water that moves (v0.84.0)

Three items about the pool, and only two of them were bugs. The third was
already true, and the useful thing to do with it was write it down as a check.

**The basin: his report was right, his reason was not.** Joe: *"the rocks in the
basin, in the pool level always have the same count until you pick up a rock."*
The count **was** changing — seven down to zero across the seven pools, straight
off `SAVE.stones`. What was wrong is that you could not *read* it: seven ellipses
at 0.22 of a 45px circle, at offsets that overlapped, merge into one pale clump,
and **six of them look exactly like three**. Screenshotting stones=6 beside
stones=3 is what settled it; they are near enough identical.

So they are laid out to be counted: one in the middle, a ring of six around it,
none of them touching (`basinTiles`, `basinStoneR`, `basinRing`).

**And the other half was real.** In a pool level the stone you carry to the water
sits on the basin's own tile, and was drawn *again* on top of the heap — while
the heap itself was pre-decremented, so taking the pebble changed nothing about
the pile underneath it. The basin draws that stone now, as the pale one at the
middle, and the pile is full until you take it and one fewer after. Seven to six,
four to three, one to none — counted off the canvas, not off the variables.

**A bug I put in on the way.** Skipping the old separate draw by failing its
`if` fell through to the `else if (keySpot)` below it and painted a **door key**
on the basin — in a level that has no doors. Caught by looking at the screenshot,
which is the entire argument for looking at the screenshot. The `poolMode` test
belongs on the outer branch.

**The pool room is water now.** *"It should change shades of blue as the player
walks over it going light to darker from the out in... when you step into it it
begins to shift in tone in small rings from out to in."* It was three flat discs
and three static scratches. It is `poolBands` concentric bands drawn rim inward,
shallow blue at the edge to deep in the middle, and while he is standing in it
the tone travels **inward** through them (`poolRingFreq`, `poolRingSpeed`,
`poolRippleAmt`). It keeps moving for `poolSettleSec` after he steps out, because
water does not stop when you do. `wetAt` lives on the landmark, so two pools in a
maze each keep their own.

**Getting round a landmark: already true, so it is a check, not a change.**
*"There should be enough space around the pool room, or any room that we have
points of interest in for players to get around them."* Measured before building
anything: **1075 landmark rooms across five selves, and the pool never blocks the
way round — 187 of 187 clear.** One room in 1075 failed, a ball pit, and ball pits
roll out of your way. Nothing needed fixing. What the item is really asking for is
that this keeps being true when the mazes get bigger, which he has said he wants
— so it is an invariant now, with ball pits excluded and the reason written down.

### Two probes that were measuring the wrong thing

Both found by the numbers looking wrong, not by the check going red.

- **The basin counter read zero everywhere** on its first run while the
  screenshots plainly showed stones. A fixed brightness threshold: the basin sits
  low on the screen, deep in the fog vignette, and everything in it is dimmed by
  how far down it is. Stone reads ~56 and water ~21 there. It calibrates against
  **this basin's own water**, sampled between two ring slots.
- **The ripple probe was standing on the thing it watched.** Parked in the middle
  of the pool, the player's own pale arrow covered the inner samples and the
  "ripple" came back bigger than the entire light-to-dark ramp — 157 against 83,
  which is what gave it away. He stands off to one side now and the ray is
  sampled away from him.

And the correlation needed the ramp removed before it meant anything: 83 units of
standing gradient against 40 units of ripple pins every correlation at no shift
at all, which is exactly what it reported while the water was visibly moving.

One more, this time in the assertion rather than the probe: the first cut
demanded the inward shift rise strictly across three gaps. It is a whole number
of samples, so adjacent gaps tie as often as not — 1,2,2 as readily as 1,2,3 —
and a working pool failed. It asserts inward at every gap, never backwards, and
further by the last one.

Three new checks, each reddened by its own reversion in its own run: the basin
pre-decremented again, the water stilled (`poolRippleAmt: 0`), and the rim set to
the same blue as the middle. 77 behaviour checks.

## The thread you have to reach, and a compass that is a compass (v0.83.0)

Both of these are the same complaint in two places: a timer that starts before
you can use what it is timing.

**The thread waits to be found.** Joe: *"the thread pickup should last longer
until you find the thread. I'd go so far as to say it stays up bright and strong
until you find it, then it gives a pulse and starts a 15 second timer. The issue
we have right now is the bigger the maze the less likely you are to see it before
it goes away."*

The thread is the way out, drawn on the floor. Picking it up in a dead end used
to start its fifteen seconds immediately — and at the close camera you can be
twenty tiles from the route, so on a large maze the whole thing could burn down
before a single lit tile came on screen. So there are **two beats now**:
`pathArmed` after the pickup, held bright and steady with no clock at all, and
`pathUntil` once he is *standing on the route*, which is his own definition of
finding it: *"just leave it visible until the player walks on a tile that has the
thread."* The moment he reaches it, it flares (`pathPulseSec`, `pathPulseGain`)
and then the fifteen seconds run as before.

`solutionKeys` is the route as a Set beside `solutionPath`, because this asks
"am I on it" on every tile change. **Every place that assigns `solutionPath`
calls `syncSolution()`** — the three in `js/proto.js` included, or a prototype
would answer with the previous maze's route.

**The compass is an instrument now.** *"The compass pointer looks too much like
the character. Perhaps we make it look more like an actual compass."* It was
literally his shape — the same arrowhead, riding a tile away from him. It is a
case with a needle in it now: **the case holds still and only the needle turns**,
which is the whole of what makes it read as a thing he is carrying rather than a
second player. Half the size, as asked (`compassTiles`, against the old 0.22).

*"It shouldn't have a number. It should just do a fade like the thread. When it
gets down to five seconds it starts to blink in and out like a light bulb about
to die."* The countdown chip is gone from the HUD — `#fx` keeps its box but
nothing is written in it — and the compass says how long it has by going out. The
stutter is **two sine beats that do not share a period** (`compassFlickA`,
`compassFlickB`), because a single clean sine reads as a pulse, which is a
different thing from a bulb failing.

The fade **bottoms out at `compassFadeFloor` rather than at nothing.** The first
cut faded to zero and then applied the blink on top, which left the last five
seconds too faint for the blink to be visible at all; raising it only inside the
window fixed that but made the compass get *brighter* as it started dying. Easing
down to a floor does both, with no pop.

### The check that passed with the feature deleted

Worth writing down, because it is the fourth time this shape has come up.

The compass check gave the compass **900ms of life and then sampled it for
1200ms**. The last third of every sample set was therefore the compass *expired*,
which pinned the low reading at bare floor — so `dyingLo` was measuring the timer
running out, not the bulb blinking. Deleting the blink entirely left the check
**green**. Reverting the feature is the only thing that found it.

It now starts half a second inside the dying window, samples 1.2s, and **returns
`aliveAtEnd` so the check can assert it never expired mid-sample** and the detail
line says so out loud. Reverted, the compass reads a flat 0.66–0.69 instead of
stuttering 0.00–0.59, and it fails.

The first cut also counted pixels over a fixed brightness threshold, which almost
nothing cleared at the alphas the blink actually uses. It measures the brightest
pixel in the compass's box against **the same box with the compass switched off**,
and every claim is stated as a share of that floor-to-full span.

Five reversion runs for this version, one at a time: the thread's clock, the HUD
number, and the blink each redden their own check, and the blink took two goes.
74 behaviour checks.

## The charcoal, in the hand and on the icon (v0.82.0)

Four asks about one widget, plus a speed he wanted back. Nothing here touches
generation except where the first piece lies, and that was made to cost the maze
a piece rather than add one.

**A piece waiting in the home room.** Joe: *"we should add a starting piece of
charcoal into the home room. Just make sure it's not going to be on any text and
don't give it out until it's unlocked."* It lies on his own row, one tile to his
right. The text is the two things set into the floor around him — the name in the
tile above, the chapter in the tile below — so the middle column of the room is
the part that had to stay clear, and that is what the check asserts rather than
the coordinate. *"Unlocked"* is read as the phase feature: the Child's maze has no
charcoal and gets none.

It is subtracted from the maze's budget, not added to it. **"Enough to map the
whole maze and no more" is a standing agreement** (v0.79.0) with a check behind
it, and a free extra piece would have quietly broken it — the budget block now
scatters one fewer and places the home piece itself.

**A heartbeat per tile logged.** Joe: *"the charcoal icon should have a little
pulse to it every time a tile is logged. Like a little heart beat."* Two knocks,
the second smaller, deliberately far quieter than the pickup flash — it fires
every couple of steps for as long as you walk with it lit, so it has to register
without nagging. `charcoalBeatMs`.

**And a loud one when a piece is spent**, which is the moment you can do
something about: *"we should do a big pulse of the icon to get the attention of
the player. This way they can turn on the next one if they want."*
`charcoalSpentMs`.

**Press and hold to lock it on.** *"It will continue to use the next piece of
coal if you have it."* A tap still pauses and resumes the piece in hand; the hold
arms the hand-off, and arming it with nothing lit lights one on the spot, because
*"honestly, if I have it, I turn it on."* A second hold disarms it. `charcoalLock`
rides in the run save, so it survives a reload like everything else.

The tap **moved from `pointerdown` to `pointerup`** to make room for the hold —
the hold fires on its own clock while your thumb is still down, and the release
after it must not also count as a tap. That is the only regression risk in the
batch, so the check taps as well as holds.

**The walk off the mat, back to 0.35.** *"Yeah, I don't like the slowness they
walk off the mat now. Take it back to what it was, like .35 or something."* And
0.35 is literally what it was: v0.77.0 left it there on purpose (see that
section — the real bug was the debug Speed slider multiplying a scripted beat),
then a later reading of *"half"* took it to 0.175. He has now played both. The
0.175 reading was not wrong on the words; it reads as a limp on a phone. The
existing check only asserts the beat ignores the slider, which is still true at
either speed, so nothing there had to move.

**Three checks, all three proven to fail reverted** — separately, one run each,
because two of them share the spent pulse and would otherwise have covered for
each other: `startRoomCharcoal: 0` reddens the home-room check alone; deleting
`beat()` and `spentPulse()` reddens both icon checks; gutting the hold and the
hand-off reddens the lock check alone. 72 behaviour checks now.

The first cut of the icon check **sat in the home room counting zero beats**.
Lighting a piece maps where you stand *and everything around it*, which is the
whole of a five-tile room — nothing in there can ever be logged a second time. It
walks the maze's longest straight corridor now. Ten minutes of probe beat an hour
of staring at the animation code.

## The tile that carried his angle, the well, and the charcoal (v0.81.0)

**The push, settled properly.** Joe sent a screenshot of the start-room block set
off at an angle and diagnosed it himself: *"since you can approach it from any
angle it carries that angle to the tile, snaps it to the player and then moves to
where it needs to go. Instead the tile should stay fixed in the line that it has
and the player should get gently pulled into alignment as the tile moves."*

Exactly right, and it was **the previous fix's fault**. v0.73.0 stopped the slide
snapping him to the centreline by lerping him from where he stood — but the tile
was drawn at `player.x/y`, so the tile then inherited his off-axis position and
set off crabbed. Two complaints, one line, opposite directions.

The settlement is `slidePos()` in `js/core.js`: the tile goes centre to centre
along its own line, and *nothing* reads the player to decide where it is. He
keeps the offset he pushed from and is eased out of it over `slideAlign` of the
travel — square well before it lands. Measured: the tile never leaves its line
(0.0000), he starts 0.34 off and is at 0.000 by two thirds across.

**The check for it was wrong first.** It recomputed the tile's position from
`slidePos()` and passed happily with the drawing still reverted — the same
model-the-fix trap as the music. `render.js` publishes `slideDrawnAt` now, so the
check reads the picture. Reverted, it fails at 0.2455 off the line.

**The well is shut, and the book was never the well's fault.** Joe: *"I think the
dark well should have collision on it so you can't actually walk over it."* True,
but the book floating over it was a **general** bug: journals go to a room's
middle and so does its landmark, so in every landmark room the page sat *on* the
landmark — in the well's mouth, on the dais, in the pool. Shutting the well made
that page unreachable. Pages are now repaired to the nearest floor tile as the
last thing generation does, because districts, the vault and the well itself all
take tiles away after the rooms are cut.

**Where a tile is closed matters more than that it is closed.** Three attempts:
- shut with the rooms → **6** violations
- shut after the districts and the vault as well → **6**, and all 112 wells shut
- shut at the end, after the route → **31**. It severed paths planned while it
  was open, stranded a secret room and a key, and broke 20 stored solution paths.

So: with the rooms, and again immediately after the vault — both before the
route, the door chain and every placement, all of which then plan around a wall
for free.

**The cost, and it is his call.** Shutting the well takes the harness from 4
violations to **6** — one more maze in 576 where a key ends up behind the door it
opens. That is the deferred door-key soft lock, now 3 mazes rather than 2. The
collision is what he asked for; reversing it is one line if he would rather have
the two back.

**Charcoal is metered to the maze.** Joe: *"we should always have enough charcoal
to map the whole maze. We don't need more than that."* It was on a spawn rate, and
measuring the old behaviour showed how badly that failed: **19 of 20 mazes short,
by up to 18 pieces at X-Large** — you could not finish a map however hard you
looked. The rate now decides only *where* it lies; how much comes from the floor
count divided by `B.charcoal()`, so the Memory stone making pieces go further
means fewer of them rather than a surplus.

### The "one run in ten" flake was not a flake

The labyrinth check had been failing about one run in ten since v0.80.0 and I had
written it up as timing. The flag diagnostics added last version caught it:
`plainRooms=false`. It asserts every landmark's heart is floor — which the solid
well breaks, and only when the Off maze happens to roll a well. Not timing at
all. Five clean runs since. Worth remembering that "intermittent" and "timing" are
not the same word, and that the cheapest way to tell them apart is to make the
failure say what it was.

## Collision, the squeeze line, and a nav view (v0.80.0)

**The pool gate held you out for its whole slide.** Joe: *"there's collision when
the pool level gate opens that stops me from walking through it until it's all
the way open."* True, and the cause is that the leaves ease out — `1-(1-t)^3` —
so a third of the way through the clock they are **70% across**, while
`poolDoorShut()` was reading the raw fraction and staying shut for all 4.8s. The
easing is `gateEase()` in `js/core.js` now, shared by the drawing and the
collision so the two cannot drift, and the tile opens once the leaves have swung
`poolDoorPassAt`. Geometry says he needs about 0.3 of the swing to fit; 0.62 is
comfortable clearance.

This broke an existing check — *"the pool gate waits to be shoved with the stone,
**and grinds the whole way**"* — which had encoded the old behaviour as correct.
It now asserts what we actually want: shut until shoved, still shut just after
the shove, through by halfway.

**The squeeze line only fires when he means it.** Joe: *"we should only give this
pop-up text... when the character's directly hitting or pointing towards the
squeeze through."* It used to fire on entering any tile with a crawl gap
anywhere beside it, so you got it in passing, facing the other way. It now wants
him pressing into the gap or turned to within `crawlSayArc` of it — and it is
asked every frame rather than only on a tile change, because turning to face
something is not a tile change.

**A nav view, to his spec.** Joe: *"some sort of visual debug draw that shows how
we are mapping what can or can't be walked on... I would be asking to visualize
the nav mesh"*, and *"number each tile from 1-n and display it on the tile. This
way I can give you the seed and the tile number in a screenshot."*

`Show me → Nav mesh + tile numbers`. Green where `passable()` says he may stand,
red where the floor is open but something holds it shut — a locked door, a gate
mid-swing, the exit before its key. It reads `passable()` and `isOpen()` rather
than keeping its own idea of the rules, so what it paints is what the game
thinks, which is the whole point. Numbers run 1..n over **walkable tiles only**
in reading order; numbering the wall would treble the count and none of those is
ever what he is pointing at. The seed, the walkable count and the tile he is
standing on are drawn along the bottom, so one screenshot carries everything
needed to stand where he stood.

Two things it taught: it has to be drawn **over** the fog (underneath, the
vignette ate the far half of the grid — exactly the half you want numbered when
something is unreachable), and `navNumberAt()` had to go to **module scope**, the
same nesting mistake as `standOn()` last version. Two in two versions; the tell
both times was a `ReferenceError` at a call site that looked perfectly ordinary.

### The static server, finally diagnosed

It had been dying mid-session for days and getting blamed on flakiness. The cause
is mundane: `nohup python3 -m http.server &` from a tool call stays in that
call's process group and dies with it. `(setsid nohup ... < /dev/null &)`
survives. Recorded in HANDOFF §9.

### One thing not fixed, and visible now

*"The labyrinth prototype builds, and Off puts the maze back"* fails about **one
run in ten**, and did so before this version's changes. Eleven runs while working
on this batch produced one failure, and six deliberate reproduction runs
afterwards produced none. Its detail line listed a dozen things that were all
fine and never said which flag went, so it now prints every flag it tests. Not
fixed — made diagnosable, so the next failure says what it was.

## Two rooms that answer to you (v0.79.0)

**The statues stand on the floor now.** Joe: *"room two in the prototype should
also be columns that light up. They should be off until the player's right next
to them and then they light up."* Room two of the gallery is the **statues**, and
his earlier note about them said the same thing — *"make these more like columns
that you can't walk over"* — so the reading taken is that the statues get the
columns' treatment, not that bay two becomes a second columns room. Two identical
bays in a gallery whose whole job is showing one of each would be pointless.

They stand on **link/link crossings** — the tiles that were wall before the room
was opened — which is the trick the columns already used: closing them takes away
no way through at all. That rule is `standOn()` now, shared by the columns, the
statues and the gallery, and it picks positions round the outside of the room
spread by angle so they read as a ring you walk between. Harness unchanged at 4,
so nothing got cut off.

They light at the columns' reach but **without the flame** — stone comes up out
of the dark, it does not burn.

**The spiral is dragged rather than clocked.** Joe: *"the spiral in the spiral
room should move and rotate whatever direction the player is moving."* Walking
round its eye hands it the angle you sweep. The old slow drift is still
underneath, so it is never quite still. Two guards, both found by watching it:
the pull fades within `spiralFollowFade` of the middle, where a step of nothing
is most of a turn and it would spin on the spot, and `spiralFollowMax` caps the
per-frame turn so crossing the centre at a run does not whip it round.

### A bug he did not report: `reset()` never cleared `moveVel`

A new maze inherited the last one's momentum and eased down from it, so the
scripted walk off the mat began too fast — which is the very beat he had called
*"too quickly"*. One word in `js/state.js`. Found because the mat-walk check went
red for no reason after the speed dropped to 0.175.

### Three self-inflicted wounds worth remembering

- **A parse check does not prove structure.** Moving `standOn()` out of
  `generate()` with a script whose brace-matching stopped at the first `}` ate
  its `return out; }`, which left `generate` *nested inside it*. The file still
  parsed — `node -e "new Function(src)"` was perfectly happy — and the game died
  at load with `generate is not defined`. Boot the page after a structural move,
  do not just parse it.
- **Scope is not location.** The first cut put `standOn()` inside `generate()`,
  where `js/proto.js` could not see it. Module scope on purpose now, and the
  comment says why.
- **A check that skips is a check that passes.** The statues check called
  `buildProto('gallery')` — wrong signature, silently no gallery — and reported
  *"no statue bay in the gallery"* as an **ok**. It calls `buildGallery()` and
  treats a missing bay as the failure it would be.

The mat-walk check also moved from **peak speed to average**. Peak was reading
the noise: the walk is short, the ease ramp is a good fraction of it, and at 0.4
tiles/s it drifted far enough to fail about one run in three. Averaged over the
whole beat it now runs 2–8% apart across four runs against a 40% band.

## The music nobody could hear (v0.78.0)

Joe: *"the music for the soldier is not really firing as much as expected. Just
picking up the ambient noise, not the actual soldier melody. Check and confirm
all characters have their music tracks playing correctly."*

**The report was true and the reason was not the one given.** The Soldier's
melody fires exactly as written — measured, twelve notes in eleven seconds. It
plays at a median of **110Hz with a floor of 55Hz**, and a phone speaker has
nothing to reproduce that with. He was hearing the bed because the tune was
below his speaker, not because it wasn't playing.

The audit he asked for found three more of the same: **the Criminal** with every
note under 150Hz (median 82, floor 41), **the Priest's organ** bottoming at
123Hz, and **the pad** for The One Who Stayed at 175Hz. Four of nine selves,
worst at the phases he has not reached yet.

**The fix is a rule, not a special case.** Any note written below
`bassCarrierHz` has its pitch doubled up in octaves until it clears the band,
at `bassLift` of the note's volume. The fundamental is left where it is, so on
anything with a woofer the bottom is still down there — this is how a bass is
mixed for small speakers, and octave doubling is what an organ's stops are, so
it sits honestly on those voices too. Soldier median 110 → 220, Criminal 82 →
330.

**The sound toggle now restarts the audio** rather than muting it, which is what
Joe asked for. It used to ride the master gain to 0 and back while the bed and
the composer ran on in silence, so switching back on dropped you in mid-bar.
`stopDrone()` tears it down; the next switch-on builds it again from nothing.

Three checks (61 now), each confirmed red with its fix removed. Two things
learned building them:

- **A test that models the fix passes with the fix deleted.** The first coverage
  check carried its own table of which instrument stacks which partials, got the
  organ wrong, and would have gone on passing if the carrier were deleted. It
  asks `AUDIO.carrierFor()` now — the engine's own rule — which is also why that
  function is exposed.
- **Tearing the drone down broke a check three sections earlier.** The debug
  panel walk toggles every control, `optSound` included. That used to be
  harmless because the composer kept running through the mute; now it stops, so
  the music checks were measuring a silent game about one run in four. They set
  their own preconditions now, and they **wait for a motif bar** rather than
  assume a window — a motif bar ignores density and rests, so it always plays,
  which turns the sparsest selves in the game from a coin flip into a certainty.

## The screen, after he played it on his phone (v0.77.0)

Five items off the doc, none of them touching maze generation, so they could go
in one batch.

**The ? was sitting on the map's close button.** Joe: *"if you open the map, you
can't actually leave because it opens up the how to play."* True as described and
purely a stacking order: `#map` is `z-index:3` and its close button rides inside
it, while `#howBtn` is `z-index:4`. A tap in that corner reached the ? every
time. `body.map-open` now hides it, set in `openMap()`/`closeMap()`. Stories does
not have the bug — its own close button is `z-index:7`, already above the ?.

**The chapter heading had walked off the bottom of the screen.** `chapterDrop`
was 1.42 tiles, set when a tile was 60px. At 150px that is most of the way down a
phone, which is where the vignette had it. The mat's own bottom edge is 0.40
tiles below him, so 0.62 puts the heading just clear of it, which is what Joe
asked for.

**A white edge on him at all times.** `playerEdge` was `#8b867a` against a
`#6e6a62` floor — about a shade apart, and at four stones he is dark enough to
vanish into it. It is `#ece7da` now. The old comment argued it should be *"dull
enough not to look freshly painted"*; Joe has overruled that, and findable beats
subtle.

**The stick and the tools, 20px lower.** `#stick`, `#tools` and `#glyphs` all
move together or the row lands on the stick.

**The walk off the mat — measured, not taken at face value.** Joe asked for it at
half the player's normal speed because it was *"too quickly"*. It was already
**0.35x**, so his number would have made it 43% *faster*. What explains the
report is that the beat was `B.speed() * 0.35`, and `B.speed()` includes the
debug **Speed slider** — so turning himself up turned the intro up with him. At
1.8x the walk ran 1.95 tiles/s. It is `CONFIG.speed * introWalkSpeed` now, a
scripted beat with no business inheriting a debug knob, and it holds still at
either end of the slider. **The fraction is left at 0.35 and the value is his
call** — see the report; changing it to the number he named would make the thing
he called too quick quicker still.

Three smoke checks came with this (58 now), and each was confirmed to go red with
its feature reverted. The mat-walk one took three passes to get honest: it first
ran out before `introWalk` was even set, then read the *previous* run's pending
timer as this run's walk, then counted the recentre slide as forward speed, then
sampled across the frame where the beat ends and he leans into his own pace. It
measures along the axis of travel, only across intervals that were the scripted
walk at both ends, against a deliberately wide 40% band — run-to-run drift is
about 20%, and the regression it watches for is 117%.

## Rooms that are places, in every maze (v0.72.0)

Joe: *"love all these prototype rooms you've made. Please add them into the general mix of possible
rooms in the mazes."* They were the labyrinth prototype's; an ordinary maze deals them out too now,
one to a room at `roomLandmarkChance`, never the same kind twice running.

**They draw from their own RNG stream** (`rng(seed + 104729)`), and that is not fussiness. Drawing
from `generate()`'s own `R` shifts every decision downstream of it and silently redeals every seed in
the game — three unrelated smoke checks went red within a minute of the first attempt. Same rule
applies to the vault (`rng(seed + 7757)`). **Any new generation feature needs its own stream.**

**Columns are really there** (v0.72.0). Joe: *"make these more like columns that you can't walk over.
When the player walks next to them they light up with a flickering flame on the top of them."* They
stand on the **link/link crossings** — the tiles that were wall before the room was opened — so
shutting them provably takes away no way through: every cell and every link lane is untouched. They
are shut before the route is planned, so the route plans around them for free. `L.cols` is where
`generate()` actually shut them, and the renderer reads that rather than guessing.

**The ball pit parts as you wade** (v0.72.0). Joe: *"can we make the ball pit reactive to the
player's movement? Don't crash the server."* No physics and no ball-to-ball collisions: each ball
carries one shove vector that eases back to nothing, and the shove is only computed while he is
inside the pit's tiles. Two things worth keeping: the push is `(reach - d) * ballPitPush` and it is
**easy to make too strong** — at the first value he ploughed a perfect empty circle through the pit
instead of wading; and a culled landmark is not drawn, so nothing eases, so the pit has to
`shove.fill(0)` when it goes off screen or it keeps the hole you left in it.

## The vault (v0.72.0)

Joe: *"we need to really hide the keys. This is a case where I'd say break out of the sizing
constraints and just go make an area that buries a key inside it somewhere."*

One per maze where the phase has doors or a gate: `vaultCells` (7) square, bigger than any room,
carved as **nested rings with a single gap each**, never two gaps on the same side, and the key at
the heart. The exit key always takes it. A door key takes it only when the vault's heart is in
`cellsIn` — that is the section the previous door opened, and the doors chain only works if each key
lies in ground you can already reach, so a key dropped into a vault behind its own door is a soft
lock. Asking `cellsIn` *is* the whole check.

**Two ways it was broken before it worked, both found by flooding the maze rather than by looking:**

1. It was carved **with the rooms**, and the districts step runs after that. Districts keep clear of
   `roomRects` and knew nothing about the vault, so they re-cut the whole nest and walled the key in
   where nothing could reach it. It is carved after the districts now.
2. Opening a 13×13 block **paves over every corridor that used to run through that ground**, so the
   vault became an island: the nest inside walked perfectly, and nothing outside could reach its rim.
   16 of 20 gated mazes were unsolvable. Every entrance the block covered is punched back through
   afterwards; they all land on the rim, which runs the whole way round, so the maze stays as
   connected as it was and the key is still three gapped rings deeper in.

Harness went from 30 violations to **18** — the same two checks, 9 mazes instead of 15. The vault
halved the known door-key soft lock as a side effect. That is not a fix and was not aimed at; the
soft lock is still deferred.

**The way out is never a circle, including its middle** (v0.72.0). Joe: *"I meant the oval of the
center circle black dot as well."* The dark at the centre takes the ring's own eccentricity and
angle, because a round hole inside a warping ring reads as a decal laid over it.

See `ROOMS.md` for what each room is and a pitch list for more.

## Rails until you are actually in the room (v0.75.0)

Joe: *"the tile right before rooms lets your character move freely and it ends up getting stuck on
things and moves oddly. We should not do that. The character should stay on rails until they're in
the room."* He is describing the look-ahead I added in v0.70 (`freeNext`) to stop him snapping onto
the rails on a room's last tile. It hands free movement the **corridor** tile outside a room's mouth,
which is one tile wide, so he wanders off the line and catches the jamb. Gone; `openFloor()` is asked
about where he is standing and nothing else. The mouth funnel is what the look-ahead was reaching for
and it is still there.

**No more snap into a push** (v0.75.0). Joe: *"in the starting room, when we transition from free
movement to pushing the block, there's a definite snap and pop of the character to get into
position."* The ride started at `from + 0.5` — the tile's centre — so anyone who had walked up to the
block off-centre, which is everyone in a room, was teleported onto the centreline on the push's first
frame. It starts from where he actually stands now (`sliding.px/py`).

**Swings take turns** (v0.75.0). Only one thing slides at a time, and the loop took the first
eligible slider in the array every frame, so on a maze with four swings the ones later in the list
**never moved at all** — the gauntlet swing was last on one seed and did not budge in four seconds.
Most overdue first now. This is pre-existing and was found by the smoke check failing after
generation changed which maze it landed on, which is the entire argument for having it.

## Rooms, vaults and keys (v0.75.0)

- **More rooms.** Joe: *"I haven't seen any of the special rooms inside the soldier's mazes."* They
  were there — **two** to a medium maze, which you can walk a whole run without meeting. `rooms` is 5
  now and `roomLandmarkChance` 0.85, so the Soldier gets about four.
- **A vault in every level.** Joe: *"I thought we had set up a whole vault hiding area for the keys.
  Is that not in every level? I think it should be."* It was gated on the phase having doors or a
  gate, and then it lost every fight for space with the rooms — the Child got one in **0 of 25**
  seeds. Its ground is claimed **before** the rooms now (`vaultRect`), rooms and districts keep clear
  of it, and it comes down a size rather than not existing on a small maze. 100% of levels, measured.
- **A key is never within reach of its own door**, per Joe's *"perhaps we should set up a rule for
  how many tiles away from the door the key has to be."* Two rules, because they catch different
  things: `keyDoorMinTiles` of **walking inside that section** (you cannot go through the door to
  fetch its own key, so that is the honest distance), and `keyDoorMinApart` as the crow flies, so the
  two are never in one eyeful. Measured worst case went from 2 tiles apart to 5, and 3 tiles of
  walking to 7.

**The cost, stated plainly:** doors per maze fell from about 1–1.8 to about 0.4–1.7. The first door's
section — the only ground its key may lie in — is often a dozen cells all beside it, and no rule can
hide a key in ground that small, so `keyDoorFloor` drops that door rather than shipping it with its
key in view. Things I tried that were worse: pushing doors later along the route (bigger sections,
but a door must sever the route and there are far fewer places late on that do — it cost half the
doors); and softer fallbacks, which all still placed keys three tiles from their lock because the
pick is random within whatever is left.

**The start room's ring is shut after everything else** (v0.75.0). Rooms, districts and crawl gaps
are all placed before the seal and none of them knows it is coming, so any of them can leave a hole
in its wall. With five rooms to a maze instead of three, one finally did — `start room is sealed when
it should be` went red on one maze in 576. The ring is now closed explicitly after all of them, save
the one gap the block sits in.

Harness: **4** violations across 576, from 18 at the start of this work and 30 before that. The only
ones left are the deferred door-key soft lock, now 2 mazes rather than 15. Still deferred, still not
aimed at — it keeps falling out of hiding keys better.

**Infinite chalk** on the debug panel, and a **Room gallery** prototype — one bay per landmark kind
off a single spine, per Joe's *"a prototype room with each of the major rooms we have connected to
each other... so we can easily test and debug and look at them."*

## The fog is a vignette now (v0.74.0)

Joe: *"it's not there at the start of the game. Then you hit the character and it pops in after a
second. Feels jank. At this point I'd like just a 'light dusting' around the edges to give it a
vignette style feel to it."*

**The pop was mine.** v0.71's cap was four times looser while he slept and tightened over the intro,
so the dark rushed in a second after the tap. There is no ramp now and no title-screen special case —
**the same fog the whole time is what takes the jank out**, and the smoke check measures exactly
that: the corner reads 50 asleep and 61 in play, where a pop would be fifty levels.

The fog is drawn in **screen** terms rather than tiles: `fogCore` (0.86) of the way to the nearest
edge stays lit, and the fade runs to `fogEdge` (1.12) of the far corner. The burdens and the darkness
still shrink it, and `Fog` on the debug panel scales the lot.

`CONFIG.fogSoftness` is gone with the old drawing. Anything that needs to ask *"can he see that?"*
calls **`litTiles()`** now — the lit core plus the fade, in tiles. Two places did (`tutorials.js` and
a smoke check) and both would have silently read a stale knob.

**Speed and Fog sliders** (v0.74.0), per Joe's *"please give me a slider that lets me set the speed of
the character"* and *"this fog of war is too tight. Can you give me another slider."* Both are plain
multipliers (`speedMul()`, `fogMul()`) on what the game would otherwise do, so neither can turn into
a different game by accident.

**The debug panel folds up** (v0.74.0). Joe: *"we have a lot of things in the debug menu perhaps we
want to put them into collapsible sections."* Five `<details>` — Play, Feel, Maze, Look, Show me —
and which ones you left open is remembered under `SAVE.ui['sec:*']`. The check asserts every control
still lives inside one of them, so a new knob added outside a section fails rather than hiding.

**The spiral turns** (v0.74.0) — Joe: *"the spiral room needs to move so the spiral is spinning in the
center."* It rotates about the middle of its room at `spiralSpinHz` (0.022, a turn in three quarters
of a minute), driven by `gameNow()` so it stops with the game rather than with the clock.

## Rails in the halls, free in the rooms (v0.73.0)

Joe, after playing the all-free build: *"in corridors I prefer the corridor movement over the free
movement. But in rooms I'm more interested in the free movement."* So the hybrid is the default, and
it is a **three-way** now rather than a boolean — `SAVE.ui.move`:

| `move` | corridors | rooms |
|---|---|---|
| `rooms` *(default)* | rails: one axis, held to the line, and the glide | the stick's own direction |
| `rails` | rails | rails |
| `free` | the corridor's walls are all that hold you | the stick's own direction |

The glide (hold a direction, keep walking after you let go) comes back with the rails, because that
is part of what he means by "the corridor movement". Only `free` clears `dir` when you let go.

**He points the way he is actually going** (v0.73.0). Joe: *"can you make a toggle that makes it so
whichever direction the character is moving it is pointed that way? Try and smoothly move to it as
much as possible... right now when he's moving he only points up, down, left, right."* `SAVE.ui.face`
(on by default) takes the angle from **the ground he covered this frame** rather than from `dir` or
from the stick.

Worth being straight about what that does and does not buy, because the first check I wrote for it
passed with the feature deleted:

- **In an open room it changes nothing.** The stick's angle *is* the angle he travels, so both
  sources give the same number. The 360 degrees were already there.
- **Everywhere the ground argues with the stick, it changes everything.** Lean 45 degrees into the
  wall of a one-tile corridor: he travels straight along it, so pointed at the ground he covers he
  faces down the corridor, and pointed at the stick he faces into a wall he is only scraping. Same
  for the mouth funnel and the corner ease. The check measures exactly that difference — 0 degrees
  against 45 — because that is the only place the two can be told apart.

`faceMinStep` keeps the last angle when he is barely moving, so he does not spin on the last scraps
of a stop; `faceTurnRate` is 11, down from the old 18, because there is further to turn now.



Joe, three separate times, ending with *"movement is a little slide-y in general. Feels more like
I'm in a go cart than a person walking around. How do we fix that."* and *"if this means we need to
make all of it free roaming we could talk about that."*

So it is all free roaming now, and **the rails are behind the debug `Corridor rails` toggle** rather
than deleted — this is a feel question, and the only way to have the conversation is with both in
his thumbs. `SAVE.ui.rails` picks; the smoke check exercises both.

What actually made it a go-kart was two things, and free roam fixes one of them outright:

- **Nothing coasts.** On the rails, `dir` survived letting go of the stick and he kept walking until
  a wall. That is a kart with no brakes. Under free movement, releasing stops him.
- **He leans into it.** `moveVel` eases toward the stick's speed over `CONFIG.moveEase` (0.11s)
  instead of switching between 0 and full tilt. A person has legs to get going.

A corridor is one tile wide and he is most of one, so **the walls hold him to the line without any
rail doing it** — lean at an angle and he rides the wall instead of being yanked to the centre. The
check now asserts what actually matters (he gets down the corridor, and never ends up inside a wall)
rather than the old "held to the centreline", which was the rails talking.

**Two things nearly went wrong here, both worth knowing:**

1. `if (freeRoam && !aim) dir = null` also killed **`introWalk`**, the scripted first step off the
   mat — the one thing in the game that walks him with no stick, steering along `dir`. It could then
   never change tile, and `introWalk` only clears when he does, so the stick stayed dead for the rest
   of the run. That is the exact failure its own comment warns about. The guard now spares it.
2. The **squeeze channel clamp** lived inside the rails' corner ease, so free movement had nothing to
   hang it off and he would have drifted out of a gap into the black. It is lifted out and keyed off
   `squeezeAxis`, which the squeeze scan now derives from the gap's own geometry rather than from
   `dir`.

**The squeeze pinches harder** (v0.71.0) — `squeezeShrink` is 1 and `squeezePinch` 0.55, so he draws
full size and the narrowing is the whole of the effect, which is what Joe asked for twice.

## The fog has to close before the screen does (v0.71.0)

Joe: *"looks like we lost the fog of war... yeah looks like it's the zoom and now with the upgrade
for this character it goes away. Let's bring it back to still hit the edges."*

The light is measured in **tiles**, and v0.70.0 made a tile 150px. `viewRadius` 1.0 became a 300px
lit core with a 210px fade — past the edge of a 430px phone, and a burden coming off pushed it
further. So the fog is now capped in **screen** terms: `fogScreenMax` (0.92) of the way to the
nearest edge, and only ever pulled *in*, so zoomed out the tile count still rules.

The catch: the title screen is a composed picture — the name above him, the chapter written into the
floor below — and the cap swallowed all of it. So the cap ramps in as the camera settles
(`fogTitleOpen` 4 while asleep, down to 1 by the end of the intro). The maze closing around you *is*
the waking.

**The burdens are a scale of values, not a ramp along his body** (v0.71.0). Joe, correcting my first
reading: *"what I meant by gradient was that we would take the whole character from dark to light. So
stage one is full black, stage two is near black, stage three is dark gray and so on."* `burdenTone()`
puts the whole man at one value per stage, eight rungs from `playerBurdened` through `playerLifting`
to `player`. Worth watching: the middle rungs sit close to the floor's own `#6e6a62`, and it is the
outline that keeps him readable there.

**The exit is never a circle** (v0.71.0). Joe: *"now make the circle go oval, in and out from
different angles over time as well."* The ring is squeezed along an axis that itself wanders round
(`exitOval`, `exitSpinHz`), and the two do not share a period with the arc warp, so the shape never
repeats anywhere you would notice. The halo leans with it.

## The camera comes in close (v0.70.0)

Joe: *"for now, let's make the default camera the same as the all the way zoomed in debug slider. I
really like how immersive that feels."* That was 60px a tile at the slider's old 2.5x, so
`tilePx` is **150** now and the slider is rebased around it: `zoomMul()` clamps to 0.2–1.5 and the
range input matches, so 0.4x is the old default and 0.2x pulls back further than the old slider ever
could.

Two things fell out of it and are worth knowing before touching either:

- **The title screen has to stay ahead of play, or waking pulls back nothing.** `titleTilePx` is 210
  — close, but not the 375 that would keep the old 2.5x ratio, because at that size the chapter
  heading (1.55 tiles below him) falls off the bottom of a phone. So the wake is a gentler pull-back
  than it was. That is the cost of the close camera, not a bug.
- **Type set into the floor can no longer ride the tile size.** `titleScale(S)` caps the name and
  the chapter at `innerWidth * 0.35`, so a closer zoom shows more floor rather than bigger letters.
  On a 430px phone it lands on exactly the old 150, which is why the title looks untouched.

**Text had to come up off the floor** (v0.70.0). Joe: *"we're gonna need to slightly change the font
colour of these book pickups and likely any other text so that it reads over the top of the
grayscale background now that we have the camera zoomed in."* `#narr` now sits at `#f2eee2` and the
journal hand at `#d6cfbc` — the old journal colour `#9a968c` was within 45 of the floor's own
`#6e6a62` and simply disappeared. The shadow is a tight dark halo rather than a wide soft one, which
is what actually holds an edge against grey.

## Gates, keys and the way out (v0.70.0)

**One gate drawing, three gates.** Joe: *"all of the gates in the game should open like the pool
level gate"*, and *"can you make the gate look more like a structure and less like a curved line?
The fact that the edges are curved completely pulls out the fact that it's a gate."* `drawGate()`
draws two leaves hinged at the jambs that swing apart down the middle and lie back against the
walls — and each leaf is a framed panel with **square** ends, a recessed field and a mullion, with
the jamb posts drawn in the wall line. The pool gate, the inner locked doors and the exit's own gate
all call it. Doors carry an `openAt` so they swing over `gateSwingSeconds` instead of blinking out,
and they are still drawn once open, because a gate you shoved open does not vanish.

**A key is one use.** Joe: *"when you use a gold key, it doesn't disappear from the inventory... I'd
expect these keys to be one use."* Stepping onto a door with its key now spends it. This is only
safe because of how mazes are dealt: one key per door, shapes taken as `KEY_SHAPES[i % 3]` with at
most three doors, so no two doors in a maze ever share a shape and no key can be the wrong one. The
smoke check asserts that uniqueness rather than trusting it.

**The way out shimmers** (v0.70.0). Joe: *"we need to make this exit more interesting. Can you add a
shimmer or a warping to it? Something that gives it an otherworldly quality."* The ring is drawn as
`exitArcs` short arcs whose radii breathe by `exitWarp` at `exitShimmerHz`, each on its own phase, so
the circle never quite closes or holds still, inside a halo that pulses with it.

## Movement, again (v0.70.0)

**The mouth funnels you in.** Joe: *"when I try and push into the cell the movement fights me, and
stops the character from moving. I have to like jiggle it to get him to move in."* Free movement in a
room plus a body with width means an off-centre approach to a one-tile corridor mouth catches the
jamb and stops dead. Now, when the axis he is leaning on is blocked but the tile past the jamb is
passable, he walks onto that tile's centreline at walking speed. The jiggle *was* the fix; now the
game does it.

**Room-ness is about where you are going, not only where you stand.** `openFloor()` is checked at the
tile ahead as well as the tile under him, so the last tile of a room no longer snaps him onto the
rails mid-stride. Joe's *"it is still fighting, trying to be in the middle of the cells"* is partly
this. He also offered *"if this means we need to make all of it free roaming we could talk about
that"* — that conversation is still open: the glide (hold a direction, keep walking after you let go)
is what the rails buy, and free-roam everywhere would cost it.

## The body (v0.70.0)

**A squeeze pinches him, it does not shrink him.** Joe: *"instead of shrinking the character so much
when going through a squeeze, is it possible to pinch the back parts of the arrow to squeeze them
together?"* `drawPlayerBody(c, r, pinch)` brings the two back corners in to `squeezePinch` of their
width. The arrow is drawn along the way he is facing, so its back corners are exactly the width the
channel has to take: pinched to 0.72 at a near-full 0.92 size he draws 0.096 half-wide against a
0.14 channel, where the old 0.62 shrink gave 0.090. Same fit, and it reads as squeezing.

**The burdens are a gradient, not seven blocks.** Joe: *"instead of doing segments... we need to do a
gradient going from black to white and seven stages."* One ramp, `playerBurdened` → `playerLifting` →
`player`, spanning `burdenBlend` of his length, and what the seven stages move is *where along the
body the ramp sits*. A burden coming off walks that edge forward one seventh, through the grey, so
there is a change to watch rather than a block flicking colour.

**The version sits centred along the very bottom** (v0.72.1). Joe: *"need to move the version number
down. Might as well center it too."* It was bottom-left at +18px, which in landscape put it straight
over the canvas title. Now `left:0; right:0; text-align:center` at +6px, clear of everything in both
orientations.

**The corner check measures ground, not frames** (v0.72.1). It asserted "more than 20 frames moved
faster than 0.2x walking speed", which was a fine proxy until `moveEase` (v0.71.0) made the speed
ramp in: how many frames clear a rate threshold now depends on where the ramp happens to fall, so it
went red on a run where nothing had changed. Distance covered does not care. **A frame count is
almost always the wrong assertion.**

**Floor-set text shrinks to fit** (v0.70.2). Joe: *"text is bleeding out of the frame. We can just
shrink the text a bit."* All caps plus a space between every letter makes a long name wide — "T H E
O N E   W H O   S T A Y E D" wanted 439px of a 430px phone, and "The Cartographer" 406px. `fitFont()`
measures first and scales down only when it would overrun `innerWidth - 32`, so the short names keep
their size and the long ones land exactly in the gutter. Both lines of the chapter and the name above
them go through it. The smoke check measures all eight strings at the drawn size, so a new character
with a long name cannot quietly reintroduce it.

**On the camera being "off"**: Joe reported it zoomed in far too much after v0.70.0. That was a
**stale `SAVE.ui.zoom`** — his slider was still saved at the old scale's maximum, which the new
`zoomMul()` clamps to 1.5 and multiplies against the new 150px base, so he was at 225px a tile. Not
the default, and he asked for it to be left alone. `tilePx` stays 150. Worth remembering if anyone
else reports the same thing: reset the Zoom slider before touching `tilePx`.

**The chapter is all caps** (v0.70.1), per Joe's *"have the text for the chapter title be in all
caps."* The lettering rule lives in `spaced()` beside `titleScale()` — uppercase, then a space
between every letter, because `ctx.letterSpacing` is Safari 17.4 and up. The smoke check asserts
`spaced()` rather than trying to read the canvas.

**Clearing the run log takes two taps** (v0.70.1). Joe: *"swap the clear and close buttons here, move
the clear one down so it can[not] accidentally be hit. Add an 'are you sure' to the clear button?"*
Copy CSV and Close sit in the first row with Close as the solid primary where Clear used to be;
Clear is small, quiet and in its own row well below, and says *"Clear every run? Tap again"* before
it does anything. It is the only thing in the game you cannot undo, and it is not in `SAVE`, so
Reset save does not touch it either.

**Books stand on a shelf** (v0.70.0) — `#books i` is 4x15 with varied heights and a shelf rule under
them, per Joe's *"make these indicators for the books go vertically so they look like books on a
shelf."*

**The ? belongs to the game, not the title** (v0.70.0). Joe: *"the question should not be visible at
the start of the game, but then once you touch the character to get to gameplay, then we add the ? to
the top right."* `#howBtn` and `#howPanel` moved out of `#title` and the button is a `.hud-el`, so it
rides in with the rest of the HUD on `body.pre` coming off instead of fading out with the name.

## The title screen (v0.69.1)

Joe, from a screenshot: *"get rid of the black section at the bottom... move the
question up to the top right... get rid of the tile count too... change the colour
of the version count so that it is readable with the grey background of the floor.
Then when we fade into gameplay, you can fade out the version number... add a
chapter heading that behaves just like the maze title, but at the bottom."*

`#titleBar` is gone — that was the black strip. `#verTitle` and `#howBtn` are now
fixed to the corners of `#title` itself: the version bottom-left in
`rgba(236,231,218,.42)` over a dark text-shadow, which reads on the floor grey
*and* on the black outside it; the `?` top-right where the tile count used to sit.
The tile count is gone outright, from the DOM and from every writer
(`grep stepLbl` returns nothing) — `#hud` is `flex-start` now and carries chalk
alone. Both fade out on `#title.leaving` with the rest of the title.

**The chapter is painted into the floor**, not laid over it (v0.69.1). I built it
in DOM first, reasoning that the fog would swallow anything drawn that far from
him. Joe, on seeing it: *"I prefer the chapter to look like it's a part of the
floor like we have with the maze title. Move it up a bit so it's a bit out of the
shadow for the fog of war. But otherwise I'm fine if the fog of war eats the
bottom of it, that would actually look kind of cool."* So the fog eating it is the
point, not the problem — the whole heading is canvas now, drawn in the same pass
as the name and **before** the darkness pass, so the vignette takes its lower edge
as the camera pulls back.

It sits `CONFIG.chapterDrop` (1.55) tiles below him, mirroring the name one tile
above: `Chapter I` at `S*0.08` over `The Child` at `S*0.18`, tracked out with the
name's own trick of joining the letters with spaces rather than `ctx.letterSpacing`
(which Safari only learned in 17.4). A pool is *between* chapters and a prototype
is not one at all, so neither draws it.

**The two fades are one pair of functions**, `nameFade()` and `chapterFade()`,
declared together above `draw()` so the one outliving the other is visible in one
place. Joe: *"we can just hold the chapter title a little longer as we zoom out so
it's readable and then fade out."* The name goes over 0.9s flat; the chapter holds
at full for `chapterHoldSec` (1.4) and then fades over `chapterFadeSec` (0.9), out
at 2.3s — inside the 2.8s `introSeconds` zoom, so it never survives into play.

Smoke check: *"the title screen: the chapter set into the floor, the ? top right,
no tile count."* Canvas text can only be proven by its pixels, so it reads the
brightest red in the band of floor the chapter occupies — 165 with the heading
written into it against 82/117 on a prototype and a pool, which get none — and
then checks the two fade functions directly rather than racing the zoom.

## Walking about a room (v0.68.0)

Joe: *"my character only walks in the middle of floors not across them. So
there's this strange robotic feeling to how they always have to move up/down
right/left."* He is right, and it only showed up once the labyrinth gave rooms
worth walking about in.

A corridor is one tile wide, so one axis at a time held to the centreline is the
only thing that fits — that stays exactly as it was. But where there is actually
room, `openFloor()` (a tile in any 2×2 block of floor, which is only ever true in
a room or a court) hands movement over to the stick's **real** direction:
`stickAim`, the raw vector, alongside the squared-off `held` the corridors use.
Per-axis collision with the body's own width, so you slide along a wall and
cannot cut the corner off one. The rails pick you up again at the corridor mouth,
and the centreline ease is what brings you back onto the line.

The thing that went wrong first, and what the smoke check is really for: the
clearance test has to be **`passable()`, not `isOpen()`**. A shut gate and a
locked door are open floor underneath, and walking free is not permission to walk
through them. The pool-gate check caught it immediately.

**Landmarks fill their room** (v0.68.0). Joe: *"imagine the spiral covering the
whole floor rather than just one part of it... the pool takes up the whole room.
Or there's a giant ball pit in one."* Each landmark carries its heart room's tile
bounds and is drawn across all of it — the pool is the room, the spiral is the
floor, the statues stand round the walls — and there is a ball pit now, which
there was not before.

**The map draws the same man the game does** (v0.68.0) — `drawPlayerBody()`,
burdens and all. It used to be a plain arrowhead, so the map showed somebody
else.

**A Zoom slider in the debug panel** (v0.68.0). `zoomMul()` scales
`CONFIG.tilePx`: 2.5× is the three tiles around you, 1× is the game's own scale,
0.5× is twice the ground. Pure view — no reset, so you can drag it while you
walk.

## The app icon (v0.67.0)

A **meander** — the oldest mark for a labyrinth there is — in the game's own
floor grey on its own wall dark, with him at the very middle of it, facing the
way out. The innermost run of the corridor is (4,5)–(6,5), so the centre of the
icon is also a point on the path: he is not going in, he is already turned round
and on his way back, which is the game. He is rimmed in the wall's own dark
rather than his usual pale edge, because here he stands on the corridor rather
than on the black and pale-on-grey disappears at forty pixels.
`tools/make-icon.mjs` draws every size from the one drawing, so there is nothing
to keep in step by hand:

    node maze/tools/make-icon.mjs      # writes icons/icon-32|180|192|512|1024.png

The artwork is full-bleed and square: iOS masks the corners into a squircle
itself and paints no background of its own. Everything is drawn inside a 5.5%
margin so the mask cannot bite the arrowhead. `manifest.webmanifest` gives it a
name, standalone display and the dark background, so Add to Home Screen installs
it properly instead of grabbing a screenshot — which is what it did before,
because there was no icon at all. A smoke check makes sure all of it resolves,
since a missing icon fails silently on a phone and just looks like nothing.

## The labyrinth prototype (v0.64.0)

`docs/LABYRINTH.md` is the plan; `buildLabyrinth()` in `js/proto.js` is the
first build of it, in the Prototype menu next to Two-way blocks. Ground cut into
8–12 sections that own their edges, a hall through the dead seam between each
pair, an open room at the heart of every section with a landmark in it, and a
section graph that is a tree so there is exactly one way between any two of
them. `tools/shape.mjs --proto laby` and `tools/bots.mjs --proto laby` measure
it against the maze it is meant to replace.

One thing to know before reading the numbers in that doc: **the first junction
count in it was wrong** and is corrected there. It counted every tile of an open
room as a junction, and a room asks you nothing — you can see all of it. The
maze forks every 10–13 tiles of corridor, not every 3.4. The threshold finding,
which is what the plan rests on, is unaffected.

## How long a maze takes (v0.63.0)

`tools/bots.mjs` answers the three questions Joe asked — the fastest a maze can
be finished, the longest it can honestly take, and what to assume in between —
by running three bots over the real generated maze and pricing every step in
seconds from the game's own constants.

| | sm 25×33 | md 33×45 | lg 45×61 | xl 61×85 |
|---|---|---|---|---|
| floor (perfect play) | 37s | 50s | 1m 06s | 1m 29s |
| explore (median) | 2m 09s | 3m 33s | 6m 42s | 13m 28s |
| explore p10 – p90 | 1m 03 – 3m 11 | 1m 39 – 6m 03 | 2m 36 – 11m 20 | 4m 46 – 22m 03 |
| sweep (every tile) | 4m 22s | 7m 45s | 14m 04s | 26m 59s |
| floor tiles | 228 | 450 | 892 | 1772 |

(The Child's maze, 24 seeds a size, 250 explorer runs a maze.)

**The floor barely moves with size.** Eight times the area buys 52 extra
seconds of perfect play, because the exit sits in the opposite corner and the
shortest route is roughly the diagonal — the side of a maze grows like the
square root of its area. Moving the exit to the *farthest tile in the maze* only
takes xl from 1m 29s to 1m 45s. Size is a weak lever on the floor and a very
strong one on being lost: the sweep grows with the area, 4m to 27m.

**Locked doors are worth 8–13 seconds** of the floor, measured as the route with
every door open subtracted from the route as generated. They add variance for
somebody exploring, not length for somebody who knows the way.

**Validated against the real game.** `--validate` puts a real player on the
oracle's route, at real speed, through the real input path: 45.0s against 46.8s
predicted at sm, 50.9s against 55.4s at md, 47.5s against 49.4s at lg, 58.5s
against 1m 08s on a phase-3 md with doors and push blocks. The model reads 4–15%
slow because a real player cuts corners. It is a slightly slow clock, not a
wrong one, and the bias is the same for all three bots.

Two things the bots taught us about the model itself, both fixed in it: a pushed
block stays where you put it, so the sealed gap is floor from then on and you
ride it back out to leave a pocket (the first version could shove a block in and
never come back, which made every maze with a key in a pocket look unsolvable);
and a tutorial card pauses the game until it is tapped, which a bot never does.

**A block is a sliver again (v0.62.0).** Back to what it was before v0.54: the
tile is floor, with a thick sliver of wall down each side it can still be
shoved. Joe on the outlined slab: "the entire thing is outlined and it doesn't
even look like it's part of the map. It just looks like a block... there was
just a little bit of a hint of what you were supposed to be able to push." The
slab was solving a problem he does not have — a two-way block changing apparent
size — and that only shows in the prototype. `blockSlivers()` in `js/render.js`.
The arrow that teaches the first push is now painted **on the block**, not two
tiles back on the floor: "the arrow should be on the same block that you push."

**Cornering costs you ground, not speed (v0.62.0).** The slide back onto a
corridor's centreline used to be its own movement at 1.6× walking, applied on
top of the step, so turning a corner off-centre you crabbed diagonally at 1.89×
walking speed — Joe: "they have this almost like race car cornering thing to
them." Walking and centring now share one `budget` per frame: the ease takes at
most `CONFIG.cornerEase` of it, and the forward step takes
`sqrt(budget² − perp²)`, so the total is exactly the walking step and a hard
correction simply costs you ground forward while it lasts. Measured inside the
frame loop: every frame is 1.00× the budget, where it used to hit 1.887×.

**The run log (v0.62.0).** Joe: "how do we go about keeping a stats log that
showed how long it took to complete mazes and some other information?" Every
maze you walk out of writes a line — when, build, who, phase, stones, seed,
size, milliseconds, tiles walked, the shortest route, dead ends, chalk and
charcoal used and found, pointers, paths, pages, tiles mapped. It lives under
its own `maze.log.v1` key, **not** in `SAVE`, so **Reset save** does not throw
away the record of what you have already tested. Capped at 300, newest last.
**Run log** in the debug panel shows the total, the best time per character and
the last 40 runs; **Copy CSV** puts the lot on the clipboard. And time reads as
hours, minutes and seconds everywhere (`fmtTime()`): "42.3s", "4m 14s",
"1h 16m 09s".

**The kid's room, and the game nobody finished (v0.61.0).** The secret room's
floor used to be chalked with `x`, `?` and the four arrows. Joe: "don't draw the
arrows in the child's secret room. It just looks like a code they will need to
know." It is a child's room, so it now holds a child's things — one game of
noughts and crosses, the word `Dad?`, two to four balls, and the rest x's, dealt
by `secretRoomChalkOn()` from `generate()`'s own seeded rng so a room is the
same room every time you come back to it. `secretFather`, the drawing as far
from the switch as it gets, is now `drawChalkPair()`: the man from behind
mid-stride, and the smaller figure standing beside him, not walking.

**Every board is winnable, and the move is always the middle** (v0.61.0). A
tic-tac-toe is dealt with two crosses, no noughts at all, and the middle open —
the two crosses are always two thirds of a line through it. Chalk your own X on
its tile and `drawTicTacToe()` fills the middle and strikes the line through;
the narrator says so once. Boards in the kid's room work the same way. 80 in 80
across seeds: no noughts, middle open, middle wins. Chalk is what gates it —
the Child starts with none, so you have to find some first.

**The shelves and the basin went quiet (fixed in v0.60.0).** Standing on a
shelf or on the basin for a beat says something about it. Two separate faults
had it barely working, and Joe caught it as "standing on top of the stones or
next to the bookshelves and a new game does not fire off the dialogue anymore".

- `shelfShown` is the latch that stops a line repeating every frame while you
  stand there. It belongs to *that stand*, but nothing ever cleared it — not
  stepping off, not `reset()`. So a line played once per page load and never
  again, and since a debug level change is a `reset()` rather than a reload,
  every maze after the first was silent. It now clears whenever you leave the
  spot, and in `reset()` with the rest of the run's state.
- "Standing still" was `!dir && !sliding`, and `sliding` is true for any swing
  anywhere in the maze while it moves. Each one reset the dwell timer, so with
  five auto-sliders on the Child level (three, plus the two the exit gauntlet
  got in v0.57.0) you rarely accumulated the second the shelves want. It is now
  `!(sliding && sliding.carry !== false)` — the same test the stick uses for
  "this slide is moving *me*" — so a swing across the maze is none of your
  business.

Both are covered by **the shelves and the basin speak every time you stand at
them** in `smoke.mjs`, which fails against either old line.

**Getting through a squeeze (v0.66.0).** Joe: *"the character leaves the
squeeze space and drifts out into the black portion of the map."* Two separate
things did that, and only one of them was the drift.

- The slide onto the centreline is gentle since v0.62.0, and in a channel a
  third of a tile wide it carried you out of it. Inside a squeeze the ease now
  gets the whole frame's budget and the off-axis is **clamped to
  `CONFIG.squeezeChannel / 2`**, so there is nowhere to drift to.
- The body is most of a tile across and the channel is `squeezeChannel` = 0.28
  of one, so squared up he hung over both walls however centred he was. He now
  draws at `squeezeShrink` while he is in one — he turns sideways to fit, which
  is what a squeeze is. That is what the old 0.7 alpha was covering up, and the
  alpha is gone, as asked.
- No camera kick going in or out (`squeezeBump` is gone), and the sound is the
  same knock as a shoulder on a wall rather than a scrape of its own.

`CONFIG.squeezeChannel` is read by the drawing *and* by the hold on your
footing, so the two cannot drift apart.

**The pool gate swings (v0.66.0).** Joe wanted it moved back off the room's
wall, white, with the smaller filled circle off the stone, and *"opening down
the middle and both sides swing to the wall. I want them to stay there though,
not disappear."* So it is two leaves hinged at the jambs: closed they meet in the
middle with the stone on the seam, and they swing apart into the hall over
`poolDoorSeconds` and stay lying against the walls. `poolGateInset` is how far
back from the room it sits; flush with the wall it read as part of the wall.

**The burden coming off holds longer (v0.66.0).** `liftBandSec` 1.1 → 2.4, and
the band goes **black → grey → pale** through `colors.playerLifting` rather than
straight to pale, holding on the grey for the first 55% of it. Joe: *"right now
we just see a tiny bit of white and it's not that rewarding."*

**The pool room's gate (v0.58.0).** Four of Joe's notes, all about weight.

- It sits on the edge of its tile nearest the room, flush with the wall the
  doorway is cut through, and grinds sideways into that wall. Drawn in the
  middle of the tile it floated in the passage.
- It opens when you *shove* it, not when you pick the stone up. Lean into it
  with the stone for `CONFIG.pushHoldMs` — the same lean a push block wants —
  and it starts to give. Empty-handed it still says "It won't move. Not without
  a stone."
- `poolDoorSeconds` is 4.8, twice what it was, and `passable()` keeps the
  doorway shut for the whole grind rather than only until the stone is in hand
  (`poolDoorShut()`), so the wait is real and the sound has time to finish.
- Carrying a stone costs 30% of your speed: `B.speed()` multiplies by
  `CONFIG.stoneSlow` when `poolMode && hasKey`. Only in a pool level — outside
  one `hasKey` is the exit key, which is small enough to pocket.

**The waking after a pool (v0.44.0, rebuilt in v0.50.0).** Putting a burden
down makes the maze easier — the first one nearly doubles your light — and
nothing used to say so. It now happens in two beats. You wake in the light you
had *before*: `reset()` sets `liftGlow` to `liftGlowFrom` when `SAVE.lifted` is
set, so the title screen is still the old dark. Tap, and first one band of him
goes pale over `liftBandSec` with nothing else moving at all. Then the dark is
cut back to its new size over `liftBurstSec`, fast, and the camera goes with
it. Fading slowly into the new light said nothing; the cut is the beat that
reads. `liftBand` and `liftBandAmt` carry the band; `liftGlow` multiplies
`B.viewRadius()` and is 1 at every other moment.

**Texture (v0.45.0).** Three overlays behind a **Texture** debug menu, off by
default. Grain and Dust draw **under the fog**, so they only ever show where the
maze is lit; over the top they carried on across the black surround and the
empty space below, which reads as dirt on the screen rather than anything in the
room. Grain has its own amount, `textureGrain`, at half the rest, because it
covers every pixel. The three are: **Grain** lays film-and-paper noise over the whole picture, **Damp**
puts seeded blotches on the floor under the fog, so a stain stays where it is
in the room, and **Dust** drifts motes across the glass. Which one the maze
wants is a look to be chosen by eye, so all three are built and none is picked.
Texture is pure paint: changing it does not reset the maze, so you can flick
between them on the same corridor and look. `CONFIG.textureAmount` sets how
strong whichever is on.

**The waking after a pool (v0.44.0).** Putting a burden down makes the maze
easier — the first one doubles your light — and nothing used to say so; you
simply played on. `poolDrop()` now records `SAVE.lifted`, and the next `wake()`
runs a longer pull-out (`liftIntroSeconds`) with the light opening from
`liftGlowFrom` to full as it goes, over a major figure (`AUDIO.lifted()`).
`liftGlow` multiplies `B.viewRadius()` and is 1 at every other moment. An
ordinary waking is untouched.

## Prototypes (v0.52.0)

`js/proto.js` and a **Prototype** dropdown in the debug menu. A prototype
replaces the maze outright: `buildProto()` sets every global `generate()` would
have set and `generate()` returns, so nothing downstream needs to know one is
running. `protoMode` widens the light so the whole idea is visible.

**Two-way blocks.** A block is the floor you stand on; shove it and it slides
one step into the wall beside you, bridging to the next island, and stays there
once you have ridden across. A plain slider has one way to go. These have two —
in line (a square either side) or round an elbow (two at right angles) — so
three squares in all. From home it takes either; once it has gone one way it can
only come back, so a wrong turn costs the walk back rather than the level.
`blockAt()` and `blockWays()` in `js/movement.js` generalise the one-way slider;
a slider without `ways` behaves exactly as it always did.

**A block is drawn as a slab** — `blockSlab()` in `js/render.js` — a whole tile
of face a shade paler than the floor (`colors.block`), with a groove round it.
Two earlier tries failed. Drawing a thick edge only on the sides a block could
move made it change apparent size: a two-way block was a narrow bar at home and
a full tile once it had gone one way. Drawing that edge inset all the way round
fixed the size but left a notch on each movable side, and two blocks side by
side showed a doubled dark band between them. The groove is now *stroked on the
tile boundary itself*, so neighbours share one groove instead of stacking two,
and the block is the same tile-sized slab wherever it is.

Nothing on a block says which way it goes. Joe's call: "if we didn't give the
hint at all but in the first block, I'd be fine with that. The rest the player
has to learn by doing." The only hint left is the glint on the first block,
which pulses its groove in the hint colour after you have stood still a while.

**What a level holds**, per prototype: about 8 blocks and 55 fixed islands.
Of the blocks, roughly 3 one-way, 1 straight (up/down or left/right) and 4
elbow. Straight ones need the square behind the block to be free and often it
is not, which is why `protoStraightBias` is 1 and they are still the minority.

The level is a grid of islands with **no bridges at all**. A line of blocks runs
from where you wake to the way out, and most of them also offer a way that goes
nowhere: which of the two goes on is the whole question.

**Two bugs the prototype flushed out**, both in the main game as well:

- The scripted first step off the mat (`introWalk`) outranks the stick in
  `want` and only clears when you change tile. Facing a wall it never cleared,
  so the stick stayed dead for the whole run. It now gives up if the step is
  not possible.
- The glint that hints at the start block redraws that block's outline in the
  hint colour. When the outline became a loop over `blockWays()`, the glint was
  left referencing the loop variable — a `ReferenceError` inside `draw()`,
  every frame, and a throw there never re-queues `requestAnimationFrame`, so
  the game froze. It hit the Cartographer onward after 2.5s of standing still.
  Both now have smoke checks, because both only bite after a delay.

`protoSolvable()` is the test Joe asked for. It walks every state the level can
be in — where you are standing, and where each block has got to — and looks for
the way out. Generation tries up to `protoTries` layouts and keeps the first
that passes. It has teeth: leave every block only one way and it reports the
level cannot be done.

## The end of a level (v0.48.0–v0.51.0)

Every phase should have to earn the way out, using whatever mechanic that
phase brought in.

- **The Child squeezes.** `CONFIG.exitGauntlet` — see above.
- **Everyone who pushes, pushes.** `CONFIG.exitPushBlocks` puts a run of load-
  bearing push blocks along the end of the route on any phase with pockets. A
  block only counts if sealing its gap really does cut start from exit, and the
  blocks already placed are treated as *passable* while testing the next one,
  because you can push those too — so each has to be load-bearing on its own.
  About 2.5 per maze on the Cartographer, 3.2 on the Archivist, every one of
  them required. `exitPushTail` biases them to the last stretch, but topology
  has the final say: a maze with no single passage whose sealing severs the
  route has nowhere to put one, and about one in five gets none.

Not built, and Joe called it out as worth prototyping: the *grid* of push
blocks where you work out which ones go where, and a block that can be pushed
two ways. Both are new mechanics rather than new arrangements of this one —
today a "push block" is a tile of floor that slides into a sealed pocket, not
a crate you shove around a room.

## Getting a different maze (v0.40.0)

The seed is shown in the debug panel next to the version, and `?seed=1234`
replays a particular maze. Three ways to change it:

- **New maze** in the debug panel rerolls the seed and changes nothing else —
  same phase, same stones, same pages found. This is the one for reviewing
  generation.
- **Any debug dropdown** already rerolls as a side effect of applying itself.
- **Update app** keeps your maze, unless the build changed.
- **The Level menu** (v0.56.0 as two menus, one since v0.59.0) lists all fifteen
  levels in story order: the eight characters with the pool that comes after
  each of them between them. A character entry is entered with the stones you
  would have put down by then; a pool with the next one still in your arms —
  both are the phase index, which is what makes the interleave work. The talk at
  the water is chosen by the stone count (`POOLS[stones]`), the level itself by
  `poolPending`.

  It is one menu because two could disagree. Phase and Pool room each set part
  of the state, so a character picked while `poolPending` was still set from
  somewhere else put you at the water instead — Joe: "when I select a character
  level now it just keeps putting me in the pool level". Every pick now sets
  phase, stones, pool-or-not and Prototype-off together, and `syncLevel()` re-
  reads the menu from `SAVE` each time the panel is opened, because the game
  moves on by itself after a pool and a menu showing the wrong level makes the
  next pick a silent no-op.

That last one is new. A run stores only its seed and what you did; the maze is
rebuilt by `generate()` on load. So a run can only be resumed by the build that
made it — restoring marks, sliders and doors by index onto a maze a different
version carved is nonsense, and quietly wrong rather than loudly broken.
`js/boot.js` now requires `run.v === VERSION` alongside the rest of the
signature, so **updating to a new build starts a fresh maze**. Phase, stones
and collected pages live outside the run and are kept. An ordinary reload on
the same build still resumes exactly where you stood.

## The Full map debug view (v0.39.0)

With **Full map** ticked in the debug menu, the whole maze is drawn fitted to
the screen. It is now something you can work in rather than only look at:

- **Tap a spot to stand there.** Tap a wall and it takes the nearest floor
  within `CONFIG.debugTapReach` tiles, because at the fitted scale a tile is a
  few pixels wide and a fingertip is not. The exit tile is never a target — a
  stray tap should not end the run — so tapping it puts you beside it instead.
  Arriving fires the normal tile-entry logic, so pickups and pages are
  collected exactly as they would be on foot and the run stays one you could
  have walked. It will happily drop you behind a locked door; tap your way back
  out.
- **Pinch, scroll or drag** to zoom and pan, between `debugMapMinZoom` (a
  multiple of the fitted scale) and `debugMapMaxZoom` pixels per tile. Zoom
  holds the point under your fingers still.
- **It only draws once the run is going.** Fixed in v0.40.0: it used to cover
  the title screen too, and since the HUD is hidden there and the sleeper was a
  few pixels wide, changing Size with Full map ticked left you looking at a map
  with no way back to the menu. Reloading was the only way out.

`dbgView` is null until you pan or zoom, and null means fitted, which is what
the view has always been. Untick and tick Full map, or start a new maze, to
refit. `render.js` asks `dbgFrame()` in `js/map.js` for the camera so both the
drawing and the hit-testing agree exactly; hit-testing off the last frame's
numbers would drift during a pinch.

One wrinkle worth knowing: the debug panel closes on a tap outside itself, in a
capture-phase listener that runs before the canvas sees the tap. `dbgClosedAt`
records that, so the tap that dismisses the panel does not also teleport you.

## Districts (v0.38.0)

Patches of maze with a character of their own, so a map does not feel the same
all the way through. They are stamped after the halls and the rooms are carved,
over the patches that already twist the most, and the **Districts** debug menu
picks between Auto, Off, and forcing every district to one heart.

A district is filled in first — dead space inside it comes back as floor — then
its interior links are re-cut to its heart. Six hearts, in
`CONFIG.clusterHearts`:

| Heart | What it is |
| --- | --- |
| `rings` | Nested rectangular loops, joined to each other in one place only. You keep coming round to where you were. |
| `thicket` | A knot of short branching paths and junctions, with no long sight lines. |
| `comb` | A spine with long dead-end teeth off alternating sides. |
| `lattice` | Every link open — a field of single-tile pillars with no landmarks at all. |
| `squeeze` | Sparse halls where most of the walls between them are crawl gaps. Child phase only, since only the Child fits through. |
| `shifting` | A dense double comb where nearly every stub is a moving block. Needs a phase with pockets or swings. |

`squeeze` and `shifting` do not carve their furniture themselves. They mark
their ground, and the crawl-gap and slider steps further down `generate()`
serve those districts first and are allowed `clusterCrawlGaps` /
`clusterSliders` extra each, so a district does not eat the map's usual quota.

**Why they cannot break a maze.** Only links with both ends inside the patch
are ever cut, so every way in and out survives untouched; afterwards the whole
patch is spanned by a random tree, so nothing inside is stranded. A district
can add floor and add connections; it can never take a connection away. That
argument is now enforced by a new invariant, `no corridor is cut off`, which
asserts every floor tile in the maze is walkable from the mat.

Districts keep clear of the start room and its ring, all three candidate exit
corners, each other, and the rooms — a district overlapping a room would wall
the room back up.

**They are on by default**, one per medium maze and scaling with area, so
X-Large gets four and Small gets one. `Districts → Off` in the debug menu turns
them off, and with them off generation is bit-identical to v0.37.0 — the sweep
finds the same 10 soft-locked seeds. Turning them on consumes from the random
stream, so every seed produces a different maze.

**Known open bug, and districts made it four times more likely.** A door's key
can land in a sealed pocket behind that same door, and the maze is then
unfinishable. Districts raise the count from **10 unfinishable mazes in 1920 to
40**. Forcing one heart everywhere, per 1920: rings 14, comb 23, lattice 23,
shifting 30. Comb adds neither loops nor pockets and still doubles it, so this
is not a mechanism belonging to any one heart — it is that re-carving near the
route leaves the door placer fewer gaps that truly sever it, so doors crowd
into choke points and the section behind a door more often holds nothing but
its own pocket.

The fix still belongs in the key scorer in `generate()`, which does not check
which side of the door a pocket lies on. Deferred at Joe's request, and not
touched here. Two things make it liveable in the meantime: **The Child has no
locked doors at all**, so the level Joe is testing chalk on cannot soft-lock;
and `Districts → Off`, or `CONFIG.clusters: 0`, returns the rate to 10 in 1920
exactly. Reproduce the original with
`node maze/tools/diagnose.mjs --phase 1 --seed 301922 --stones 7`.

**A bug the new invariant caught on the way in.** `braid` opened a gap from any
cell with exactly one open neighbour toward any in-bounds cell, checking
neither end was actually floor. On a full grid both always are, so Auto was
never affected — but Sparse and Least prune cells away, and braid would join
two pruned cells and leave a floor tile walled in on both sides that nobody can
ever stand on. Five mazes in 576 under Sparse. Fixed in v0.38.0 by requiring
both ends open, which changes no Auto seed and reshuffles Sparse and Least.

## Repo facts that bite

- **GitHub Pages serves `main`.** A commit on another branch is on GitHub but
  not on the live site.
- **`../Index.html` is a one-byte stub with a capital I**, so `/maze/` does not
  resolve to the game. Link to `maze/maze-topdown.html` by its full name (the
  front-page tile does).
- The root `service-worker.js` is network-first as of 2026-09-09. Before that it
  served `index.html` cache-first forever, which is why the front page looked
  permanently stale on phones. If that recurs, start there.
- Other projects here keep docs in `<project>/docs/` too (`cartographer/`,
  `killcode/`, `tidy-adventures/`). Same convention.
