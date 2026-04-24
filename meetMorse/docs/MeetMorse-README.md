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

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand
- Web Audio API (built-in, no keys)
- Vibration API (built-in, no-ops on iOS)
- localStorage for persistence
- GitHub Pages for deployment (served as a subpath of the portfolio repo)

No backend. No API keys. No third-party services.

---

## Getting Started

```bash
git clone <repo>
cd meet-morse
npm install
npm run dev
```

Open `http://localhost:5173` on desktop, or — to test the real thing — connect your phone to the same network and visit `http://<your-lan-ip>:5173`.

For deployment to GitHub Pages:

```bash
npm run deploy
# then:
git add meetMorse/index.html meetMorse/assets meetMorse/index.src.html meetMorse/scripts
git commit -m "deploy meetMorse"
git push
```

`npm run deploy` runs the Vite build, copies `dist/index.html` over `meetMorse/index.html` (the file GH Pages serves at `/meetMorse/`), replaces `meetMorse/assets/`, and removes `dist/`. It restores the source `index.html` from the committed `index.src.html` template before building, so local `npm run dev` keeps working between deploys.

---

## Project Conventions

### Code Style

- TypeScript strict mode on.
- Functional components only.
- Named exports for components; default export only for pages/screens.
- Zustand stores export a hook (`useInputStore`) and selectors; avoid subscribing to whole stores when a slice will do.
- Keep components under ~150 lines; split when they grow.

### File Layout

See the TDD for the full directory structure. Summary:

- `components/` — reusable UI pieces
- `screens/` — top-level page-equivalents (Home, Game, Results)
- `modes/` — mode-specific behavior controllers
- `engines/` — audio, haptics, input logic (no React)
- `stores/` — Zustand state
- `data/` — static data (tree, words)
- `lib/` — pure utility functions

### Styling

- Tailwind utility classes for everything routine.
- Custom theme tokens (wood, brass, board-navy, dot-green, dash-amber, error-red) defined in `tailwind.config.ts`.
- SVG for the tree and the key. No icon libraries needed.
- Animations via Tailwind's `transition-*` utilities and keyframes defined in the config.

### Naming

- Components: PascalCase (`TelegraphKey.tsx`).
- Hooks: camelCase starting with `use` (`useMorseInput`).
- Stores: `useXStore` pattern.
- Constants: SCREAMING_SNAKE (`DOT_DASH_THRESHOLD_MS`).
- Morse code strings use `.` and `-` literally (no unicode dots).

---

## Critical Implementation Notes

Pulled out of the TDD for visibility — these are the things that'll bite you if you skip them:

1. **Initialize `AudioContext` from a user gesture.** On iOS Safari, creating an `AudioContext` outside of a user gesture handler results in a silent (or suspended) context. Lazy-init in the first `pointerdown` on the telegraph key.

2. **Use pointer events, not touch/mouse.** `onPointerDown`/`onPointerUp` give unified behavior. Also handle `onPointerCancel` and `onPointerLeave` as releases.

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
