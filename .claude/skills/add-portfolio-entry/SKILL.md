---
name: add-portfolio-entry
description: Add a new app to the top of the GameDesignerJoe.github.io portfolio grid in index.html — screenshots the app with headless Chrome, saves art/<slug>.png, and inserts the tile with title, description, and link. Use when the user says they finished an app and want it on the main page / front page / portfolio, or asks to add, list, feature, or re-order an entry on index.html.
---

# Add a portfolio entry

Puts a new app at the **front** of the `.grid` in [index.html](../../../index.html) — the newest work shows first.

## What you need

| Input | How to get it |
|---|---|
| **Where the app lives** | A repo folder (`tidy-adventures`) or an external URL (`https://myflickpick.vercel.app/`) |
| **Grid title** | Uppercase, short. See the length limit below. |
| **Overlay title** | Normal case — the real product name |
| **Description** | One line, ~8 words, what the app does |
| **Screenshot** | Captured for you — see step 2 |

Ask only for what the user hasn't already given. If they named the folder, read the app's own `index.html` `<title>`, headings, and README to draft the title and description yourself, then show your draft for approval rather than asking cold.

## Step 1 — Work out the slug and href

The **slug** is kebab-case, used for the image filename: `art/<slug>.png`.

The **href** depends on hosting:

- **In this repo** → relative, no `target`: `href="tidy-adventures/index.html"`
  (use the real entry file if the app's index isn't at the folder root)
- **External host** (Vercel, etc.) → absolute, always `target="_blank"`:
  `href="https://myflickpick.vercel.app/" target="_blank"`

If the app folder is in this repo but the user wants the GitHub Pages URL instead, that's fine too — several existing entries do that. Relative is the default.

## Step 2 — Capture the screenshot

```bash
# app folder in this repo
node .claude/skills/add-portfolio-entry/capture.mjs --path tidy-adventures --out art/tidy-adventures.png

# externally hosted
node .claude/skills/add-portfolio-entry/capture.mjs --url https://myflickpick.vercel.app/ --out art/flickpick.png
```

The script starts a throwaway static server rooted at the repo (so ES modules and `fetch` work), shoots a square 1024×1024 viewport with headless Chrome, and cleans up. Options: `--size`, `--wait` (ms of virtual time before the shot), `--chrome`.

**Then Read the PNG and actually look at it.** The tile is small and `object-fit: cover`, so the shot must read at ~250px. Reshoot with a longer `--wait` if it caught a loading state.

Headless Chrome cannot click, so it always lands on whatever the page shows first. When that's a title screen, that's usually the *best* tile art. When it's a blank canvas, an empty menu, or an "insert coin" gate, don't fight it:

- Try `--wait 6000` first — some apps animate in.
- Otherwise ask the user to take the screenshot themselves and give you the path, then just copy it to `art/<slug>.png`. Don't ship a bad tile.

If the user supplies their own image from the start, skip the capture entirely and copy it into `art/`.

**Overwriting an existing image?** Add a cache-buster to the `src`, since GitHub Pages caches hard: `src="art/killcode.png?v=2"`.

## Step 3 — Insert the tile

Insert directly after the `<div class="grid">` line so it becomes the first child. Indentation is 8 spaces on the outer `<div>` — match the surrounding entries exactly.

```html
        <div>
            <div class="game-title">GRID TITLE</div>
            <div class="box">
                <a href="HREF">
                    <img src="art/SLUG.png" alt="Overlay Title">
                    <div class="overlay">
                        <h3>Overlay Title</h3>
                        <p>One line about what it does</p>
                    </div>
                </a>
            </div>
        </div>
```

Rules that the CSS enforces, so don't break them:

- **`.game-title` is `white-space: nowrap` inside a 250px box** — it clips silently. Keep it to roughly 18 characters. That's why the tile reads `NOT ALL SURVIVE` while the overlay says `NOT ALL WILL SURVIVE`. Shorten the grid title, never the overlay one.
- **`alt` matches the overlay `<h3>`.**
- **`<p>` is one short sentence** — the overlay is a thin strip that slides up on hover.
- **External links get `target="_blank"`; internal links don't.**
- An inline `<svg>` may replace the `<img>` (see `COLOR MATCH`), but a screenshot is the norm.
- If the screenshot's subject sits off-center, nudge it with `style="object-position: top left;"` on the `<img>` (see `PLAYBACK`) rather than re-cropping.

## Step 4 — Confirm

Report the title, description, href, and image path you used. Leave the change uncommitted unless the user asks — then commit `index.html` and the new `art/` file together.

## Updating an app that's already listed

Same flow, but delete the existing `<div>` block for that app first and re-insert it at the top. Refresh the screenshot too if the app has changed, remembering the `?v=N` bump.
