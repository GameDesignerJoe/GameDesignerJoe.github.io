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
| `stage` | 1 Spark, 2 Playable, 3 Finding the fun, 4 Shareable, 5 Polished, 6 Tested in public, 7 Google Play, 8 Apple App Store. Tools stop at 5, tabletop at 6. |
| `tag` | One line saying what it is. |
| `status` | Where it stands now, two sentences at most. |
| `left` | Where Joe left off: the last thing that changed. |
| `love` | What Joe loves about it, in his words. Only change it when he says so. |
| `dream` | `{ "text": "...", "dest": <stage number> }` or `null`. Only Joe sets this. `dreamHint` is a suggestion shown before he has answered. |
| `star`, `hidden` | At most two projects are starred. |
| `steps` | Small steps, fifteen minutes or less, that Joe does himself. These feed the "one thing right now" pane, so keep two or three good ones here. |
| `todos` | Real work, in plain words. |
| `ideas` | Cool ideas, not commitments. |
| `done` | `[{ "t": "the task text", "on": "YYYY-MM-DD" }]`, oldest first. |
| `basics` | Corrections to the basics audit, e.g. `{ "offline": true }`. Set one when you add or remove that basic. Keys are in `config.js`. |
| `docs` | Where the project's own notes live. |

## Doing a Trailhead task

1. Read the project's entry first. `love` and `dream` say what matters; don't build
   against them.
2. Do the task in the project's folder. Check that it works.
3. Commit to `main` and push (see the repo's CLAUDE.md).
4. Update the entry in the same push:
   - move the task from `steps` or `todos` into `done` with today's date
   - rewrite `left` to say what just changed
   - refresh `status` if it's now out of date, and `stage` if it earned a move
   - set `last` to today, add to `commits`, set the top-level `updated`
   - if the work added one of the basics, record it in `basics`
   - leave one or two new `steps` so there is an obvious next small thing
5. If the task needs Joe (playing it, deciding, recording, an account or a payment),
   don't fake it. Say exactly what you need and leave the task where it is.

## Applying a "Trailhead sync" prompt

The prompt carries a JSON list of changes per project. `set` replaces those fields
(`basics` merges), `add` appends to those lists, `complete` moves items into `done`
with today's date, `remove` deletes them. Apply exactly those, set `updated`, commit
and push. Don't tidy anything else in the same commit.

## Writing style

Entries are read on a phone, in a hurry. Plain words, short sentences, no jargon.
Describe the project the way Joe would to a friend.
