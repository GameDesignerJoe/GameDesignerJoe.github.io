# Trailhead

Joe's tracker for his side projects: where each one stands, what he loves about it,
his dream for it, and what to do next. Live at
https://gamedesignerjoe.github.io/trailhead/

The point of it is getting back in. Joe gets deep into a project and then drifts to
the next one, so every entry is written to make returning easy.

## How it fits together

- `projects.json` is the source of truth. The page reads it on every load, so every
  device shows the same thing.
- The page cannot write to the repo. Changes Joe makes on a device (stars, dreams,
  to-dos, ticks) wait in that browser until he presses **Send to repo**, which opens
  Claude Code with the changes as a prompt.
- Each to-do has an arrow that opens Claude Code with that task as a prompt.
- Claude Code does the work and then updates `projects.json`. Keeping the file
  current is part of finishing a task, not a separate chore.

Files: `index.html` (shell), `app.js`, `app.css`, `config.js` (the path's stops, the
basics list), `icons.js` (generated thumbnails and the basics audit), `projects.json`.
No build step.

## projects.json

Top level: `updated` (YYYY-MM-DD, change it whenever you edit the file), `goals`
(Joe's three goals, in his words), `lead` (id of the game headed to the stores first),
`projects`.

Each project:

| Field | Meaning |
|---|---|
| `id`, `name`, `emoji`, `kind`, `folder`, `url` | Identity. `kind` is `game`, `tabletop` or `tool`. `url` is relative to the site, a full URL, or empty. Don't change `id`. |
| `first`, `last`, `commits` | Dates and commit count for the folder. Set `last` to today when you work on it. |
| `stage` | 1 Spark, 2 Playable, 3 Finding the fun, 4 Shareable, 5 Polished, 6 On itch.io, 7 Money plan, 8 Google Play, 9 Apple App Store. Tools stop at 5, tabletop at 6. What each stop takes is in `config.js`. |
| `tag` | One line saying what it is. |
| `status` | Where it stands now, two sentences at most. |
| `left` | Where Joe left off: the last thing that changed. |
| `love` | What Joe loves about it, in his words. Only change it when he says so. |
| `dream` | Joe's dream for it, as plain text, or `null`. Only Joe sets this. `dreamHint` is a suggestion shown before he has answered. |
| `star`, `hidden` | At most two projects are starred. |
| `todos` | One ordered list. The first three are "right now": small things, fifteen minutes or less, that Joe can do himself. They feed the "one thing right now" pane, so keep three good ones at the top. Everything after is later work, in plain words. |
| `ideas` | Cool ideas, not commitments. |
| `done` | `[{ "t": "the task text", "on": "YYYY-MM-DD" }]`, oldest first. |
| `basics` | Corrections to the basics audit, e.g. `{ "offline": true }`. Set one when you add or remove that basic. Keys are in `config.js`. |
| `notes` | Link to the project's Google Doc of notes, if it has one. See "Working a project's doc". |
| `docOpen`, `docSeen` | How many open notes the doc had when a session last read it, and the date. Update both whenever you read the doc. |
| `docs` | Where the project's own notes live. |

## Doing a Trailhead task

1. Read the project's entry first. `love` and `dream` say what matters; don't build
   against them.
2. Do the task in the project's folder. Check that it works.
3. Commit to `main` and push (see the repo's CLAUDE.md).
4. Update the entry in the same push:
   - move the task from `todos` into `done` with today's date
   - rewrite `left` to say what just changed
   - refresh `status` if it's now out of date, and `stage` if it earned a move
   - set `last` to today, add to `commits`, set the top-level `updated`
   - if the work added one of the basics, record it in `basics`
   - make sure the top three `todos` are still small, obvious next things
5. If the task needs Joe (playing it, deciding, recording, an account or a payment),
   don't fake it. Say exactly what you need and leave the task where it is.

## Working a project's doc

Joe's normal way of working: he plays the game, writes notes in that project's Google
Doc from his phone, then says "new things in the doc for you" and goes back to
playing. A "Trailhead doc pass" prompt is that message. The doc is where he thinks;
it stays the backlog. Don't copy its notes into `todos`.

**The Maze is the exception: use the `maze-task` skill for it.** For every other
project:

1. **Read the doc.** If it is shared by link, fetch
   `https://docs.google.com/document/d/<id>/export?format=txt`. Otherwise use the
   Google Drive connector. If you can't read it, say so and stop.
2. **The live list is everything above the first `Old Notes` or `DONE?` heading.**
   Nothing below it. Those are notes he has already moved out of the way.
3. If the doc opens with a rules block for Claude, it wins over anything here.
4. Never work sections headed Thoughts, Ideas or Notes to Remember unless he asks.
5. He dictates from his phone, so read for intent and say which reading you took. A
   bare bullet or an image bullet is a screenshot you cannot see. Say so; don't guess.
6. Skip anything already shipped unless he has added to it. A note that is listed
   again is not done, it is still wrong.
7. **Group by what the notes touch and say the order before you start.** Rules
   changes, feel and animation, UI, and bugs are different batches. If a note is a
   question or a design worry and not a request, answer it; don't build something.
8. Build one group, check it works, commit to `main`, push. Then the next group.
9. **Report at the end:** what you did for each note, what you skipped and why, and
   which notes he can now move under `Old Notes`. Don't edit the doc yourself unless
   he asks.
10. Update the project's entry: `left`, `status`, `last`, add the finished notes to
    `done`, and set `docOpen` (notes still open) and `docSeen` (today).

## Applying a "Trailhead sync" prompt

The prompt carries a JSON list of changes per project. `set` replaces those fields
(`basics` merges; a `todos` list there is the whole list in its new order), `add` appends to those lists, `complete` moves items into `done`
with today's date, `remove` deletes them. Apply exactly those, set `updated`, commit
and push. Don't tidy anything else in the same commit.

## Getting a game store-ready

Moving a game to stage 5 (Polished) includes cleaning out what was left in from
building it: debug text, test fields, dev shortcuts, placeholder copy. When that is
done, set `"clean": true` in its `basics`. Stage 7 (Money plan) means Joe has picked
how the game earns; record his choice in `status`.

## Writing style

Entries are read on a phone, in a hurry. Plain words, short sentences, no jargon.
Describe the project the way Joe would to a friend.
