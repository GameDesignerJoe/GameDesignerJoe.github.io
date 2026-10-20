# GameDesignerJoe.github.io

Joe's personal portfolio site, served by GitHub Pages from `main`. Each app is a
self-contained folder at the repo root (`maze/`, `killcode/`, `meetMorse/`, …), and
`index.html` is the portfolio grid that links to them.

## Branching

**Work on `main` and push to `main`.** `main` *is* the live site — there is no build
or deploy step, so anything left on a feature branch simply isn't published. Don't
open pull requests for ordinary work here.

This holds even when a session is started with a feature branch pre-assigned (Claude
Code on the web does this by default): commit to `main` instead and say so. The only
reason to use a branch is if Joe asks for one by name in that conversation.

Before pushing, `git pull origin main` — Joe works from more than one machine.

## Portfolio grid

Adding or re-ordering an app on `index.html` has its own skill:
`.claude/skills/add-portfolio-entry/`. Use it rather than hand-editing the grid; it
covers the screenshot capture, the tile markup, and the CSS constraints that clip
silently (the 18-character grid title, most notably).
