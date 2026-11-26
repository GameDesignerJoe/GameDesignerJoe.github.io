---
name: trailhead
description: Keep Trailhead (the trailhead/ folder, Joe's side-project tracker) in step with the repo. Use when a prompt starts with "Trailhead task", "Trailhead sync", "Trailhead chat", "Trailhead notes pass" or "Trailhead doc pass", when Joe says there are new notes in a project's Google Doc (any project except The Maze), when a prompt starts with "Trailhead:", when Joe asks to tick off or change a checklist item, gate, star or status for any project, or after finishing work on any app in this repo so its entry in trailhead/projects.json stays current.
---

# Trailhead

Read `trailhead/README.md` first. It has the gates, the `projects.json` fields and the
rules.

- **"Trailhead: let's work on X"**: follow "Working on a project". Do the named
  checklist item, verify it, then update X's entry in the same push.
- **"Trailhead: X has everything ticked for <gate>"**: follow "Moving through a gate".
  Check it honestly before moving anything.
- **"Trailhead notes pass for X"** (or "doc pass"), or Joe saying there are new notes
  for X: follow "Working a project's notes". The Maze uses the `maze-task` skill.
- **"Trailhead sync"**: follow "Applying a Trailhead sync prompt". Apply exactly the
  listed changes and nothing else.
- **Joe asks in conversation** ("star Buzzers", "add multiplayer testing to Buzzers'
  checklist", "mark Deck Text not for publish"): edit `trailhead/projects.json`
  directly, then commit and push.
- **After any other work on an app in this repo**: update that app's entry (`left`,
  `last`, `status` if stale, tick what's now true). A new app gets a new entry at
  Incubation.
- **Gallery shots for a game**: use the `game-gallery` skill.

Always validate the file still parses (`node -e "JSON.parse(require('fs').readFileSync('trailhead/projects.json','utf8'))"`)
before committing. The live page breaks if it doesn't.
