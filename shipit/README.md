# Ship It!

(Called Trailhead until Nov 25, 2026. Older prompts that say "Trailhead" mean this. The
folder moved from `trailhead/` to `shipit/`; the old address redirects.)

Joe's tracker for his side projects. Live at https://gamedesignerjoe.github.io/shipit/

The point of it is getting back in, and getting things across the finish line. Joe
gets deep into a project and then drifts to the next one, so every entry is written to
make returning easy and to say plainly what stands between the project and its next
gate.

What it's all for, in his words, is the one line in `goals` at the top of `projects.json`. The page shows it as the quote under the title.

## How it fits together

- `projects.json` is the source of truth. The page reads it on every load, so every
  device shows the same thing.
- Notes are written in each project's Google Doc (or a notes file in the repo), not in
  Ship It!. The page only shows them.
- The page cannot write to the repo. A tick, a star, the razor line or a notes link
  changed on a device waits in that browser until Joe presses **Send to repo**, which
  opens Claude Code with the changes as a prompt.
- Every button that does work opens Claude Code with a short prompt. Claude Code does
  the work and then updates `projects.json`. Keeping the file current is part of
  finishing, not a separate chore.

Files: `index.html` (shell), `app.js`, `app.css`, `config.js` (the gates and their
starting checklists, and the list of skills the page can launch), `icons.js` (generated thumbnails and header colours), `shots.js`
and `shots/` (one current screenshot per project, from `tools/shoot.py`),
`projects.json`. No build step.

## The dev plan: nine gates

| # | Gate | Through it when |
|---|---|---|
| 1 | Incubation | There's a razor line and a toy you can touch |
| 2 | Prototype | The fun is found, he knows what game this becomes, and it has a Google Doc |
| 3 | Preproduction | Everything it needs is listed and the feature list is locked |
| 4 | Production | Everything on the locked list is built |
| 5 | Alpha | Whole and playable on a phone, other people have played it, it has a feedback button, and the money plan is written |
| 6 | Beta | Fixes only. Cleaned up, store-ready, money plan built in |
| 7 | Release I: itch.io | It's public and strangers are playing it |
| 8 | Release II: Google Play | It's on the first store |
| 9 | Release III: App Store | The goal |

**Prototype** is its own phase, in Joe's words: there are bits of gameplay and
prototypes, but the full idea of the game isn't there yet. It is also where he builds a
simple version of the game loop on purpose, as the launching-off point for a more
ambitious project. The Maze (the top-down one, then the first-person one),
Cartographer and Terrible Parent are all this: prototypes made in order to go and
build a bigger, better version. Prototype is where you find the fun. **Preproduction**
comes after the fun is found, and is where you figure out all the things you're going
to need to make for this to be a real game. A polished, playable prototype is still a
prototype: how finished it looks does not move it up.

**A Google Doc is the ticket out of Prototype.** A game with no doc (or notes file) in
`notes` should not move to Preproduction. If one is already past Prototype without a
doc, the page shows a red "No doc linked" flag and the first item on its checklist is
to link one.

**The feedback button** is an Alpha item: a button in the game that opens a Google
Form whose answers reach Joe. The Maze and Not All Will Survive already have one;
copy how they do it.

**Money is not its own gate.** The plan (how this earns, or that it stays free) is
written to get from Alpha to Beta. It is built in during Beta, or at the latest
during Release I. Then every release has its own money check, because the plan
changes by platform: itch.io (free with donations, pay what you want, or a minimum
price), Google Play and the App Store (ads, a one-time purchase, or paid up front,
through that store's own billing).

**Kept as a prototype** (`proto: true`): Joe marks a project this way under More when
it has done its job and he is not taking it further. The page shows it on the
Prototype gate, stops offering next steps for it, and hides its checklist. Don't
push it, don't gate-check it, and leave it out of "check them all".

`config.js` holds each gate's starting checklist. A project marked **not for publish**
(`nfp`) stays in the group and moves through the gates up to Beta, but is never pushed
toward release. Tabletop games release as a print-and-play on itch.io.

## projects.json

Top level: `updated` (YYYY-MM-DD, change it whenever you edit the file), `goals`,
`lead` (id of the game headed to the stores first), `projects`.

Each project:

| Field | Meaning |
|---|---|
| `id`, `name`, `emoji`, `kind`, `folder`, `url` | Identity. `kind` is `game`, `tabletop` or `tool`. `url` is relative to the site, a full URL, or empty. Don't change `id`. |
| `first`, `last`, `commits` | Dates and commit count for the folder. Set `last` to today when you work on it. |
| `stage` | Which gate it is in, 1 to 9. |
| `checklist` | What this project needs to get through its current gate: `[{ "t": "...", "done": false }]`. **In order of importance, most important first.** No cap: if it's real work for this gate, it's on the list. The page shows the first ten and folds the rest. Specific beats generic: write them for this game. Items that came from the gate's template carry a `k`; keep it. The first unticked item is what "Let's do it!" offers. |
| `backlog` | Bigger work and ideas, as one list. Joe doesn't separate the two until a gate forces a choice (see Preproduction). Not shown as to-dos. |
| `nfp` | `true` if this is not for publish. |
| `proto` | `true` if Joe is keeping it as a prototype. When a sync sets it, also set `stage` to 2. When a sync clears it, leave `stage` at 2 and offer a gate check. |
| `iconOf` | Another project's id whose icon and colour this one borrows (The Maze: Top-Down uses The Maze's). |
| `tag` | One line saying what it is. |
| `love` | **The razor**: the one line Joe would say in an elevator about why this is cool. Shown as the quote at the top of the project's page. Only change it when he says so. |
| `status` | Where it stands now, two sentences at most. |
| `left` | Where Joe left off, as one plain sentence. Shown beside the next item. |
| `star`, `hidden` | At most two projects are starred. |
| `done` | Shipped work: `[{ "t": "...", "on": "YYYY-MM-DD" }]`, oldest first. |
| `notes` | A list of the project's docs: Google Doc links, or paths of files in this repo. **The first one is the running notes**, the fix-it list that a notes pass works. The rest are reference (design docs, plans, lore): read them for context, never work them as a to-do list unless Joe asks. See "Working a project's notes". |
| `videos` | Trailers and clips to show first in the gallery: repo paths or YouTube links. |
| `docOpen`, `docSeen` | How many open notes there were when a session last read them, and the date. |
| `shot` | `"landscape"` for a game played sideways, so screenshots are taken that way. |
| `checked` | Date of the last gate check, when the checklist was written from the game itself (the `gate-check` skill). Missing means the list is still a first draft. |
| `docs` | Where the project's own design notes live. |

## New folders, adding a project, and the ignore list

The page asks GitHub for the repo's top-level folders (a few times a day, and whenever
Joe presses "Check GitHub now"). Any folder that is not some project's `folder` and
is not on the ignore list shows up as "New in your repo" with two buttons.

**Ignore.** The top-level `ignored` list in `projects.json` is every folder Joe has
said not to track: `{ "folder": "...", "why": "..." }`. A sync prompt can add to it.
Never add a project for a folder on this list, and never take a folder off it unless
Joe asks.

**Adding a project** (the "Add it" button, or Joe naming a folder):

1. Read the folder: its README, the page title, the code, its commit history.
2. Add an entry at the top of `projects`: `id` (short, lowercase, no dashes), `name`,
   `emoji`, `kind`, `folder`, `url`, `first` and `last` from git, `commits`, `tag`
   (about six words), `love` (the razor, taken from Joe's own words where there are
   any), `status`, `left`, `notes` (its Google Doc if one is mentioned, else empty),
   `shot: "landscape"` if it is played sideways, `star`/`hidden`/`nfp` false.
3. Place it on a gate and write its checklist the way the gate-check skill does. A
   brand new game is almost always Incubation or Prototype.
4. If the app has an icon file, add a 96px webp data URI for it to `ICONS` in
   `icons.js` and a header colour to `COLORS`. Otherwise the emoji is used.
5. Take its screenshot with `python3 shipit/tools/shoot.py <id>` and look at it.
6. Tell Joe what you wrote, then commit to `main` and push. Don't add it to the
   portfolio grid; that is a separate ask.

## Working on a project ("Ship It: let's work on X")

1. Read the project's entry first. The razor says what matters; don't build against it.
2. Do the named checklist item in the project's folder. Check that it works.
3. If it needs Joe (playing it, deciding, recording, an account or a payment), don't
   fake it. Walk him through it, and leave the item unticked until he says it's done.
4. Commit to `main` and push (see the repo's CLAUDE.md). In the same push, update the
   entry: tick the item, rewrite `left`, refresh `status`, set `last` and the top-level
   `updated`, add what shipped to `done`, and retake the screenshot if the app looks
   different (see Screenshots).
5. Tell him what's next on the checklist.

## Gate check

The `gate-check` skill works out which gate a game is really in and writes its
checklist from the code and the notes. For one game it shows Joe the result and waits
for his yes before writing. For "check them all" it does not stop or ask: it writes
each game as it goes and reports once at the end. A checklist goes
stale as the game changes, so keep it true in the same push as any work: tick what is
now true, add what the work revealed, remove what no longer applies.

## Moving through a gate

When every item is ticked, Joe presses "Move it to <next gate>".

1. **Check it honestly.** Open the game and confirm the gate's "through it when" line
   is really true. If it isn't, say what's missing, add it to the checklist, and stop.
2. If it holds, set `stage` to the next gate and write the new `checklist`: start from
   that gate's items in `config.js`, tick the ones already true, reword them for this
   game, and add the game's own items from `backlog` and its notes, most important first.
3. **Entering Preproduction or leaving it** is where the feature list gets locked. Go
   through `backlog` with Joe and sort each item into in, out, or later. What's in
   becomes checklist items; what's out is deleted or kept under a cut list in `status`.
4. A `nfp` project stops at Beta.

## Working a project's notes ("Ship It notes pass", or "doc pass")

Joe's normal way of working: he plays the game, writes notes in that project's Google
Doc from his phone, then says "new things in the doc for you" and goes back to
playing. The doc is where he thinks. Don't copy its running notes into the checklist.

**The Maze is the exception: use the `maze-task` skill for it.** For every other
project:

1. **Read the running notes**, the first entry in `notes`, with the Google Docs or
   Google Drive connector, or from the repo if it is a file path. Skim the other
   docs listed there for context. If you can't read them, say so and stop.
2. **The live list is everything above the first `Old Notes` or `DONE?` heading.**
3. If the doc opens with a rules block for Claude, it wins over anything here.
4. A section or tab called **Bigger work**, Ideas or Thoughts is not the fix-it list.
   Don't build from it. Do copy anything new there into the project's `backlog`.
5. He dictates from his phone, so read for intent and say which reading you took. A
   bare bullet or an image bullet is a screenshot you cannot see. Say so; don't guess.
6. Skip anything already shipped unless he has added to it. A note listed again is
   not done, it is still wrong.
7. **Group by what the notes touch and say the order before you start.** If a note is
   a question or a design worry and not a request, answer it; don't build something.
8. Build one group, check it works, commit to `main`, push. Then the next group.
9. **Report at the end:** what you did for each note, what you skipped and why, and
   which notes he can now move under `Old Notes`. Don't edit the doc unless he asks.
10. If the notes are a repo file: the open list is its top-level bullets, leaving out
    anything ticked or marked done and any section headed ideas, long-term, research
    or done. Mark finished items done in the file the way it already does.
11. Update the entry: `left`, `status`, `last`, `done`, `docOpen`, `docSeen`.

## Applying a "Ship It sync" prompt

The prompt carries a JSON list of changes per project. `set` replaces those fields,
`check` marks those checklist items done, `uncheck` marks them not done. Apply exactly
those, set `updated`, commit and push. Don't tidy anything else in the same commit.

## Screenshots and the gallery

- **One current shot per project** lives in `shots/<id>.webp`, listed in `shots.js`.
  After you change how an app looks, retake it in the same push:
  `python3 shipit/tools/shoot.py <project id>`. Look at the result; if it caught a
  loading screen or a blank page, delete that shot and its line in `shots.js`.
- **The gallery** is whatever is in `<game folder>/media/`: images, short videos, and
  `videos.txt` with one YouTube link per line. The page lists the folder itself, so
  adding or deleting a file is all it takes. Use the `game-gallery` skill to take a
  set of varied shots for a game Joe names. Never touch files there that don't start
  with `auto-`; those are his.

## Skills

`config.js` has a `SKILLS` list. The page shows it in its menu, and shows the
per-project ones under More on each project's page. When you add a skill to
`.claude/skills` that Joe would run from here, add it to that list too.

## Writing style

Entries are read on a phone, in a hurry. Plain words, short sentences, no jargon.
Describe the project the way Joe would to a friend.
