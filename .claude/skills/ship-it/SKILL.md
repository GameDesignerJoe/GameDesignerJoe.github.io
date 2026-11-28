---
name: ship-it
description: Keep Ship It! (the shipit/ folder, Joe's side-project tracker, formerly called Trailhead) in step with the repo. Use when a prompt starts with "Ship It" or "Trailhead" (sync, notes pass, doc pass, gate check, "let's work on"), when Joe says there are new notes in a project's Google Doc (any project except The Maze), when Joe asks to tick off or change a checklist item, gate, star or status for any project, or after finishing work on any app in this repo so its entry in shipit/projects.json stays current.
---

# Ship It!

Read `shipit/README.md` first. It has the gates, the `projects.json` fields and the
rules.

- **"Ship It: let's work on X"**: follow "Working on a project". Do the named
  checklist item, verify it, then update X's entry in the same push.
- **"Ship It: X has everything ticked for <gate>"**: follow "Moving through a gate".
  Check it honestly before moving anything.
- **"Ship It notes pass for X"** (or "doc pass"), or Joe saying there are new notes
  for X: follow "Working a project's notes". The Maze uses the `maze-task` skill.
- **"Ship It sync"**: follow "Applying a Ship It sync prompt". Apply exactly the
  listed changes and nothing else.
- **Joe asks in conversation** ("star Buzzers", "add multiplayer testing to Buzzers'
  checklist", "mark Deck Text not for publish"): edit `shipit/projects.json`
  directly, then commit and push.
- **After any other work on an app in this repo**: update that app's entry (`left`,
  `last`, `status` if stale, tick what's now true). A new app gets a new entry:
  follow "Adding a project" in `shipit/README.md`. Never add one for a folder on the
  `ignored` list in `projects.json`.
- **Gallery shots for a game**: use the `game-gallery` skill.
- **"Ship It gate check"**, or Joe asking where a game really stands or to redo its
  checklist: use the `gate-check` skill.

Always validate the file still parses (`node -e "JSON.parse(require('fs').readFileSync('shipit/projects.json','utf8'))"`)
before committing. The live page breaks if it doesn't.
