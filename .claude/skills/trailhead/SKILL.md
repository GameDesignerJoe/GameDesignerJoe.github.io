---
name: trailhead
description: Keep Trailhead (the trailhead/ folder, Joe's side-project tracker) in step with the repo. Use when a prompt starts with "Trailhead task", "Trailhead sync", "Trailhead chat" or "Trailhead doc pass", when Joe says there are new notes in a project's Google Doc (any project except The Maze), when Joe asks to add, tick off or change a to-do, dream, star or status for any project, or after finishing work on any app in this repo so its entry in trailhead/projects.json stays current.
---

# Trailhead

Read `trailhead/README.md` first. It has the `projects.json` fields and the rules.

- **"Trailhead task for X"**: follow "Doing a Trailhead task" in the README. Do the
  work in X's folder, verify it, then update X's entry in `trailhead/projects.json`
  in the same push.
- **"Trailhead doc pass for X"**, or Joe saying there are new notes in X's doc: follow
  "Working a project's doc" in the README. The doc link is the project's `notes`
  field. The Maze uses the `maze-task` skill instead.
- **"Trailhead sync"**: follow "Applying a Trailhead sync prompt". Apply exactly the
  listed changes and nothing else.
- **Joe asks in conversation** ("add a daily mode to Catch the Wolf's to-dos",
  "star Buzzers", "my dream for Crunch is..."): edit `trailhead/projects.json`
  directly, then commit and push.
- **After any other work on an app in this repo**: update that app's entry (`left`,
  `last`, `status` if stale, move finished items to `done`). A new app gets a new
  entry.

Always validate the file still parses (`node -e "JSON.parse(require('fs').readFileSync('trailhead/projects.json','utf8'))"`)
before committing. The live page breaks if it doesn't.
