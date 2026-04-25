# Meet Morse — Claude Code README

Start here.

This is the entry-point doc for anyone (or any AI coding assistant) picking up this project. Read this first, then the GDD, TDD, and Milestones.

---

## What is Meet Morse?

A mobile-first web app for learning Morse code by feel. A single wooden telegraph key button drives all input — tap for dot, hold for dash — and a visual "code tree" lights up to show the user's position in real time. Short words, timed challenges, listening mode, and a tree-hidden memory mode layer in progressively more skill.

**Inspired by** a physical learning tool (Nux Gadgets' Morse Code board) that makes the Morse alphabet learnable at a glance: the tree's shape IS the code. Circles are dots, rectangles are dashes, walking from antenna to letter is the letter's Morse code.

**This build extends that idea** with word challenges, WPM scoring, audio listening practice, and a themed "telegraph operator's desk" aesthetic.

---

## Docs in This Folder

Read in this order:

1. **`MeetMorse-README.md`** — this file. Conventions, setup, how to run.
2. **`MeetMorse-GDD.md`** — Game Design Document. What the app is, the modes, the word list, the UX.
3. **`MeetMorse-TDD.md`** — Technical Design Document. Stack, architecture, state, data models, gotchas.
4. **`MeetMorse-MILESTONES.md`** — Phased build plan. What to build in what order.

If something in one of these contradicts another, the more-recent conversation with Joe wins; flag it and ask.

---

## Stack

- Vanilla ES modules — no build step, no bundler
- Plain HTML + CSS (CSS custom properties for theme tokens)
- Web Audio API (built-in, no keys)
- Vibration API (built-in, no-ops on iOS)
- localStorage for persistence
- GitHub Pages for deployment (served as a subpath of the portfolio repo)

No backend. No API keys. No third-party libraries. No npm dependencies. Edit a file, save, refresh — that's the dev loop.

---

## Getting Started

The app is static: any HTTP server works. From the repo root:

```bash
python -m http.server 8000
# open http://localhost:8000/meetMorse/
```

For phone testing on the same LAN, find your machine's IP and visit `http://<lan-ip>:8000/meetMorse/`.

For deployment to GitHub Pages:

```bash
git add meetMorse/
git commit -m "update meetMorse"
git push
```

GitHub Pages serves `https://gamedesignerjoe.github.io/meetMorse/` directly from the source files on the `main` branch — no build step, push = deploy.

---

## Project Conventions

### Code Style

- ES modules (`import` / `export`), no CommonJS.
- Single shared mutable `state` object (`js/state.js`); modules mutate it directly. No diffing layer — UI modules expose `render*()` functions that read state and update DOM, called explicitly after state changes.
- Keep modules small and single-purpose; split when they grow past ~150 lines.
- No build step, ever. If a feature seems to need one, push back first.

### File Layout

See the TDD for full detail. Summary:

- `index.html` — single entry, sections shown/hidden via the `hidden` class
- `css/style.css` — all styling; theme tokens as CSS custom properties on `:root`
- `js/main.js` — bootstrap
- `js/state.js` — shared mutable state object
- `js/input.js` — state-mutating actions (`pressDown`, `pressUp`, `commitLetter`, `resetTape`)
- `js/data/` — static data (Morse tree, words)
- `js/engines/` — audio, haptics, input timing — DOM-free
- `js/ui/` — DOM building + render functions (tree, tape, key, views)

### Styling

- Plain CSS. Theme tokens (`--wood`, `--brass`, etc.) on `:root`.
- SVG for the tree and the key. No icon libraries.
- Animations via CSS `transition` and `@keyframes`. Web Animations API for anything custom.

### Naming

- Module file names: camelCase (`morseTree.js`, `audioEngine.js`).
- Functions: camelCase. Render functions: `render*` (e.g. `renderTree`, `renderTape`).
- Constants: SCREAMING_SNAKE (`DOT_DASH_THRESHOLD_MS`).
- Morse code strings use `.` and `-` literally (no unicode dots).

---

## Critical Implementation Notes

Pulled out of the TDD for visibility — these are the things that'll bite you if you skip them:

1. **Initialize `AudioContext` from a user gesture.** On iOS Safari, creating an `AudioContext` outside of a user gesture handler results in a silent (or suspended) context. Lazy-init in the first `pointerdown` on the telegraph key.

2. **Use pointer events, not touch/mouse.** `pointerdown` / `pointerup` give unified behavior. Also handle `pointercancel` and `pointerleave` as releases.

3. **Call `setPointerCapture` on press.** Fingers drift during a held dash; pointer capture ensures the release fires on the right element.

4. **`touch-action: none` on the key.** Prevents scroll-while-holding. Without this, holding for a dash on a phone can scroll the page.

5. **`user-select: none` + `-webkit-touch-callout: none`** on the key and the tree. Prevents long-press text selection and context menus.

6. **Vibration API is silent on iOS.** Not a bug, not worth fixing. Ship it anyway; it works on Android.

7. **DuckDuckGo on iOS is WebKit** (Apple requirement). Same limitations as Safari. Joe tests on DDG; do the same during manual QA.

8. **Use `100dvh`, not `100vh`, for full-screen layouts.** `100vh` doesn't account for iOS browser toolbar. Have a fallback for older browsers. Respect `env(safe-area-inset-bottom)`.

9. **Suppress keyboard repeat events** on spacebar-as-key (desktop fallback). A held spacebar fires keydown repeatedly — only the first one counts.

10. **The tree's visual layout must match the reference image.** Don't re-derive it from scratch. Positions in `TREE_NODES` are normalized 0–100 in both axes and should visually mirror the photo in the GDD reference.

---

## What to Build First

Follow the milestone plan. **M1 (the key + the tree + free play) is where 80% of the "feel" of the app lives.** Don't rush past it. Get on a phone, tap it until it feels right. Tune `DOT_DASH_THRESHOLD_MS` and `autoCommitDelayMs` with real use.

---

## Collaboration Style

Joe's working style on this project:

- Iterative. Push a working version, he tries it on his phone, gives directional notes, you adjust.
- Prefers concise, high-signal responses. Don't pad.
- He fills in aesthetic/creative direction; you fill in the implementation details.
- If a design decision is ambiguous and important, ask — don't guess on the things that matter.
- If it's ambiguous and minor, make a reasonable call and note it.
- Named projects get short, evocative names (Meet Morse fits the pattern: Murmur, Nudge, Focal).

---

## Open Questions (if any come up during build)

Track them here. Examples of things that might warrant a check-in:

- Word-shuffle behavior (per-tier vs. fully mixed) — default to fully mixed for MVP unless it feels wrong in play.
- Exact amber color for the hint trail — pick something warm that doesn't clash with the green path; adjust on review.
- Whether to show mode descriptions on the cards or on tap — try showing them on tap (tooltip/expand) to keep the grid clean.

---

## Out of Scope

Listed in the GDD, but worth reiterating:

- No accounts, no backend, no cloud sync.
- No ads, no tracking, no analytics.
- No native app — web only.
- No numbers/punctuation content at MVP (the setting exists but the data does not).
- No tappable tree at MVP (reference mode).

---

## Attribution

Inspiration credit to the physical Morse code tool that sparked this build — Nux Gadgets (`nuxgadgets` / `nuxmodellbau`). Reference in Settings → About.
