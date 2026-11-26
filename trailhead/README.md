# Trailhead

Joe's tracker for his side projects. Live at https://gamedesignerjoe.github.io/trailhead/

The point of it is getting back in, and getting things across the finish line. Joe
gets deep into a project and then drifts to the next one, so every entry is written to
make returning easy and to say plainly what stands between the project and its next
gate.

His goals, in his words, are at the top of `projects.json`.

## How it fits together

- `projects.json` is the source of truth. The page reads it on every load, so every
  device shows the same thing.
- Notes are written in each project's Google Doc (or a notes file in the repo), not in
  Trailhead. The page only shows them.
- The page cannot write to the repo. A tick, a star, the razor line or a notes link
  changed on a device waits in that browser until Joe presses **Send to repo**, which
  opens Claude Code with the changes as a prompt.
- Every button that does work opens Claude Code with a short prompt. Claude Code does
  the work and then updates `projects.json`. Keeping the file current is part of
  finishing, not a separate chore.

Files: `index.html` (shell), `app.js`, `app.css`, `config.js` (the gates and their
starting checklists), `icons.js` (generated thumbnails and header colours), `shots.js`
and `shots/` (one current screenshot per project, from `tools/shoot.py`),
`projects.json`. No build step.

## The dev plan: nine gates

| # | Gate | Through it when |
|---|---|---|
| 1 | Incubation | There's a razor line and a toy you can touch |
| 2 | Preproduction | The core loop is fun and the feature list is locked |
| 3 | Production | Everything on the locked list is built |
| 4 | Alpha | Whole and playable on a phone, and other people have played it |
| 5 | Beta | Fixes only. Cleaned up and store-ready |
| 6 | Release I: itch.io | It's public and strangers are playing it |
| 7 | Release II: Money plan | He has decided how it earns, and that's built in |
| 8 | Release III: Google Play | It's on the first store |
| 9 | Release IV: App Store | The goal |

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
| `checklist` | What this project needs to get through its current gate: `[{ "t": "...", "done": false }]`. **At most 20 items.** Specific beats generic: write them for this game. Items that came from the gate's template carry a `k`; keep it. The first unticked item is what "Let's do it!" offers, so put the easiest way back in first. |
| `backlog` | Bigger work and ideas, as one list. Joe doesn't separate the two until a gate forces a choice (see Preproduction). Not shown as to-dos. |
| `nfp` | `true` if this is not for publish. |
| `tag` | One line saying what it is. |
| `love` | **The razor**: the one line Joe would say in an elevator about why this is cool. Shown as the quote at the top of the project's page. Only change it when he says so. |
| `status` | Where it stands now, two sentences at most. |
| `left` | Where Joe left off, as one plain sentence. Shown beside the next item. |
| `star`, `hidden` | At most two projects are starred. |
| `done` | Shipped work: `[{ "t": "...", "on": "YYYY-MM-DD" }]`, oldest first. |
| `notes` | Where Joe's notes live: a Google Doc link, or the path of a notes file in this repo. See "Working a project's notes". |
| `docOpen`, `docSeen` | How many open notes there were when a session last read them, and the date. |
| `shot` | `"landscape"` for a game played sideways, so screenshots are taken that way. |
| `docs` | Where the project's own design notes live. |

## Working on a project ("Trailhead: let's work on X")

1. Read the project's entry first. The razor says what matters; don't build against it.
2. Do the named checklist item in the project's folder. Check that it works.
3. If it needs Joe (playing it, deciding, recording, an account or a payment), don't
   fake it. Walk him through it, and leave the item unticked until he says it's done.
4. Commit to `main` and push (see the repo's CLAUDE.md). In the same push, update the
   entry: tick the item, rewrite `left`, refresh `status`, set `last` and the top-level
   `updated`, add what shipped to `done`, and retake the screenshot if the app looks
   different (see Screenshots).
5. Tell him what's next on the checklist.

## Moving through a gate

When every item is ticked, Joe presses "Move it to <next gate>".

1. **Check it honestly.** Open the game and confirm the gate's "through it when" line
   is really true. If it isn't, say what's missing, add it to the checklist, and stop.
2. If it holds, set `stage` to the next gate and write the new `checklist`: start from
   that gate's items in `config.js`, tick the ones already true, reword them for this
   game, and add the game's own items from `backlog` and its notes. Stay under 20.
3. **Entering Preproduction or leaving it** is where the feature list gets locked. Go
   through `backlog` with Joe and sort each item into in, out, or later. What's in
   becomes checklist items; what's out is deleted or kept under a cut list in `status`.
4. A `nfp` project stops at Beta.

## Working a project's notes ("Trailhead notes pass", or "doc pass")

Joe's normal way of working: he plays the game, writes notes in that project's Google
Doc from his phone, then says "new things in the doc for you" and goes back to
playing. The doc is where he thinks. Don't copy its running notes into the checklist.

**The Maze is the exception: use the `maze-task` skill for it.** For every other
project:

1. **Read the notes** with the Google Docs or Google Drive connector, or from the repo
   if `notes` is a file path. If you can't read them, say so and stop.
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

## Applying a "Trailhead sync" prompt

The prompt carries a JSON list of changes per project. `set` replaces those fields,
`check` marks those checklist items done, `uncheck` marks them not done. Apply exactly
those, set `updated`, commit and push. Don't tidy anything else in the same commit.

## Screenshots and the gallery

- **One current shot per project** lives in `shots/<id>.webp`, listed in `shots.js`.
  After you change how an app looks, retake it in the same push:
  `python3 trailhead/tools/shoot.py <project id>`. Look at the result; if it caught a
  loading screen or a blank page, delete that shot and its line in `shots.js`.
- **The gallery** is whatever is in `<game folder>/media/`: images, short videos, and
  `videos.txt` with one YouTube link per line. The page lists the folder itself, so
  adding or deleting a file is all it takes. Use the `game-gallery` skill to take a
  set of varied shots for a game Joe names. Never touch files there that don't start
  with `auto-`; those are his.

## Writing style

Entries are read on a phone, in a hurry. Plain words, short sentences, no jargon.
Describe the project the way Joe would to a friend.
