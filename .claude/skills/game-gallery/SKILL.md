---
name: game-gallery
description: Take a set of about ten varied screenshots of one of Joe's games by playing through it in a headless browser, and save them to that game's media/ folder, which Ship It! shows as the game's gallery. Use when Joe asks for gallery shots, screenshots or "a gallery" for a named game, asks to refresh a game's shots, or when a game's Beta checklist item "Gallery shots taken" is being worked. Only for the games he names, never all of them at once.
---

# Game gallery

The goal is a gallery Joe could show someone, like the screenshots on a store page:
about ten shots that are **as different from each other as possible** and that show
the game's real features. A title screen and nine near-identical gameplay frames is a
failure.

Ship It! reads whatever is in `<game folder>/media/` and shows it as a swipeable
gallery, in filename order. There is no index to update.

## Rules for the media folder

- Shots you take are named `auto-NN-short-name.webp` (for example
  `auto-03-summer-day.webp`). On a refresh, replace only `auto-*` files.
- **Never delete or rename a file that doesn't start with `auto-`.** Joe adds his own
  screenshots and videos (`.png`, `.jpg`, `.webp`, `.mp4`) and removes ones he doesn't
  like. If he has deleted an auto shot, don't bring that same moment back unless he asks.
- `videos.txt`, if present, is his: one YouTube link per line.
- Keep each image under about 150 KB (WebP, quality around 72).

## How to take them

1. **Read the game first.** Find its screens, modes and states, and any way to jump
   between them: a debug object on `window`, URL hashes, a save object you can edit,
   level or seed parameters. Most of Joe's games have one. Write down the ten moments
   you intend to capture before capturing anything. Aim across these kinds:
   the title, core play early on, core play late (harder, busier, different look),
   each special mode, a win or reveal moment, a lose moment, the shop or meta screen,
   progression or achievements, and settings only if nothing better is left.
2. **Drive it with Playwright** (already installed; `chromium.launch()` needs no
   options). Serve the repo root with `python3 -m http.server` and open the game at
   phone size: viewport 390 x 844, `device_scale_factor` 2. For a game played sideways
   (its Ship It! entry has `"shot": "landscape"`), use 844 x 390.
3. Reach each moment through the game's own hooks where they exist, and by real taps
   and key presses where they don't. Wait for animations to settle before each shot.
   Catch action moments mid-motion on purpose (a reveal, a hit, an explosion).
4. **Look at every shot.** Throw out loading screens, blank frames, error text,
   tutorial overlays covering the play field, and anything close to a shot you already
   have. If two shots look alike, keep the better one and go find something different.
5. If part of the game can't be reached headlessly (needs a network service, a second
   player, a microphone), say which moments you couldn't get. Don't pad with
   duplicates to reach ten.
6. Save to `<game folder>/media/`, then also refresh the single Ship It! shot:
   `python3 shipit/tools/shoot.py <project id>`.
7. In `shipit/projects.json`, tick "Gallery shots taken" on the game's checklist if
   it has that item. Commit to `main` and push.

## Report

List the shots by what each shows, name anything you couldn't reach, and remind Joe he
can delete any he doesn't like or drop his own files into the same folder.

## Worked example

Catch the Wolf exposes `window.ctw` (`ctw.go('play')`, `ctw.go('shop')`,
`ctw.go('bonus')`) and a save object (`ctw.save.data.streak`, `.pelts`). Setting the
streak before `ctw.go('play')` moves the round to a different season, time of day and
difficulty, which gave spring dawn, summer noon, autumn sunset and winter night from
one screen. The wolf's position is on `ctw.scene.sheep`, so a tap there captured the
reveal. That produced ten clearly different shots.
