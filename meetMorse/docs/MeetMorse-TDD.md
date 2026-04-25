# Meet Morse — Technical Design Document

## Stack

- **Vanilla ES modules.** No build step, no bundler, no compile.
- **Plain HTML + CSS.** Theme tokens live as CSS custom properties on `:root`. SVG (inline, built dynamically) for the code tree.
- **Web Audio API** (built into browsers — no package, no keys) for Morse tones.
- **Navigator Vibration API** (built-in; no-ops on iOS) for haptics.
- **localStorage** for settings and high scores.
- **No backend.** Purely client-side.
- **Deployment:** GitHub Pages (served at `/meetMorse/` on the portfolio site). Push = deploy.

Target browsers: mobile Safari, mobile Chrome, DuckDuckGo on iOS/Android, and desktop evergreen browsers. Note that DuckDuckGo on iOS uses WebKit → Vibration API will be a no-op there.

---

## Directory Structure

```
meetMorse/
├── docs/                          # design docs
├── css/
│   └── style.css                  # all styling, theme tokens on :root
├── js/
│   ├── main.js                    # bootstrap
│   ├── state.js                   # shared mutable state object
│   ├── input.js                   # state-mutating actions
│   ├── data/
│   │   ├── morseTree.js           # code↔letter map, tree nodes/edges
│   │   └── words.js               # word list, tiered (M2)
│   ├── engines/
│   │   ├── audioEngine.js         # Web Audio tone generation
│   │   ├── hapticsEngine.js       # Vibration wrapper
│   │   └── inputEngine.js         # press-duration → dot/dash, constants
│   └── ui/
│       ├── tree.js                # builds + updates SVG tree
│       ├── tape.js                # paper tape strip
│       ├── key.js                 # telegraph key event wiring
│       └── views.js               # show/hide screens
└── index.html                     # single entry; sections shown/hidden
```

Empty subdirectories (`js/modes/`, `js/lib/` per future milestones) are added when their first file lands. No need to scaffold empty folders.

---

## Data Model

### The Morse Tree

A flat map from code string to letter. The tree is traversed by building up the code string (`"."`, `".-"`, `".-."`, etc.) and looking up the current node.

```js
// js/data/morseTree.js
export const CODE_TO_LETTER = {
  '.': 'E',    '-': 'T',
  '..': 'I',   '.-': 'A',   '-.': 'N',   '--': 'M',
  '...': 'S',  '..-': 'U',  '.-.': 'R',  '.--': 'W',
  '-..': 'D',  '-.-': 'K',  '--.': 'G',  '---': 'O',
  '....': 'H', '...-': 'V', '..-.': 'F', '.-..': 'L',
  '.--.': 'P', '.---': 'J', '-...': 'B', '-..-': 'X',
  '-.-.': 'C', '-.--': 'Y', '--..': 'Z', '--.-': 'Q',
};

export const LETTER_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_LETTER).map(([code, letter]) => [letter, code]),
);
```

Tree node positions are computed from the code string itself (dot moves x right by step/2^level, dash moves left). `TREE_NODES` is `{ code, letter, x, y, shape }[]` and `TREE_EDGES` is `{ from, to }[]`. ViewBox is `0 0 100 140` (portrait).

### Words (M2+)

```js
// js/data/words.js
export const WORDS_TIER_1 = ['IT', 'IS', 'AT', /* ... */];
export const WORDS_TIER_2 = [/* ... */];
export const WORDS_TIER_3 = [/* ... */];
export const ALL_WORDS = [...WORDS_TIER_1, ...WORDS_TIER_2, ...WORDS_TIER_3];
```

### Settings + Scores (Persisted)

Plain objects, JSON-stringified into localStorage. Keys: `meetmorse:settings`, `meetmorse:scores`. A small wrapper in `js/lib/storage.js` (added in M3) handles parse errors and a `version` field for future migrations.

```js
// shape of persisted settings
{
  soundOn: true,
  hintsOn: true,
  hintDelayMs: 3000,                  // 2000 / 3000 / 5000 / 8000
  letterCommitMode: 'forgiving',      // 'forgiving' | 'strict'
  autoCommitDelayMs: 600,             // 400 / 600 / 900
  hapticsOn: true,
  numbersUnlocked: false,
  punctuationUnlocked: false,
}

// shape of persisted scores
{
  timedWpmBest: 0,
  listeningStreak: 0,
  memoryWpmBest: 0,
}
```

---

## State Architecture

A single shared mutable object lives in `js/state.js`. Every module imports it and reads/writes directly. No diffing layer. UI modules export `render*()` functions that read state and update DOM; state-mutating actions in `js/input.js` (and future controllers) call the relevant `render*()` after mutating.

```js
// js/state.js
export const state = {
  view: 'home',           // 'home' | 'game'
  pressing: false,
  currentCode: '',        // ".-" being built up
  tape: [],               // committed letters
  errorCode: null,        // briefly set on invalid commit
  committedCode: null,    // briefly set right after a valid commit

  // ephemeral input timing
  pressStartMs: null,
  autoCommitTimer: null,
  errorTimer: null,
  committedTimer: null,
};
```

Future milestones add fields here (active mode, current word, completed letters, timer state, settings cache). Keep it flat — the state object is small, and a flat object is easier to reason about than nested slices.

State-mutating actions (`pressDown`, `pressUp`, `commitLetter`, `resetTape`) live in `js/input.js`. Mode-specific actions (start word, advance letter, finish run) will live in `js/modes/<mode>.js` per milestone.

---

## Input Engine

```js
// js/engines/inputEngine.js
export const DOT_DASH_THRESHOLD_MS = 150;
export const AUTO_COMMIT_DELAY_MS = 600;

export function detectSymbol(durationMs) {
  return durationMs < DOT_DASH_THRESHOLD_MS ? '.' : '-';
}
```

The engine itself is just constants + pure utilities. The press lifecycle is in `js/input.js`:

- On `pointerdown`: lazy-init audio, start tone, record `pressStartMs`, set `pressing = true`, `renderKey()`.
- On `pointerup`: stop tone, compute duration, classify dot/dash, fire haptic, append to `currentCode`, schedule auto-commit, `renderKey() + renderTree() + renderTape()`.
- Auto-commit timer fires after `AUTO_COMMIT_DELAY_MS` of inactivity: look up `currentCode` in `CODE_TO_LETTER`. If found, append to `tape`, briefly flash via `committedCode`. If not found, briefly flash via `errorCode`. Either way, clear `currentCode`.

In guided modes (M2+), we additionally compare `currentCode` against the prefix of `LETTER_TO_CODE[targetLetter]`. If `currentCode` is not a valid prefix of the target code, flash error and clear immediately.

**Pointer events, not touch/mouse:** `pointerdown` / `pointerup` / `pointercancel` / `pointerleave` — handle all four as press/release for unified mobile + desktop support. `touch-action: none` on the key prevents scroll-while-holding.

**Keyboard support (desktop):** spacebar acts as the key. `keydown` / `keyup` with `e.repeat` filtered out (held spacebar fires repeating keydowns we don't want).

---

## Audio Engine

```js
// js/engines/audioEngine.js (sketch)
class AudioEngine {
  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) this.ctx = new Ctor();
  }

  startTone(freq = 600) { /* sine osc + gain envelope, 5 ms attack */ }
  stopTone() { /* 5 ms decay then osc.stop */ }

  // M5: listening-mode playback
  async playCode(code, ditMs = 100) { /* dit/dah with proper gaps */ }
  async playWord(word, ditMs = 100) { /* letters joined with inter-letter gaps */ }
}

export const audioEngine = new AudioEngine();
```

**Critical:** `AudioContext` must be created from within a user gesture on mobile Safari. Lazy-init from the first `pointerdown` on the telegraph key — never on module load.

When `soundOn` is false, all tone methods short-circuit (settings store flips an `enabled` flag).

---

## Haptics Engine

```js
// js/engines/hapticsEngine.js
export const HAPTIC_DOT_MS = 30;
export const HAPTIC_DASH_MS = 80;

export function vibrate(ms, enabled = true) {
  if (!enabled) return;
  if (typeof navigator?.vibrate !== 'function') return;
  navigator.vibrate(ms);
}
```

Called with 30 ms on dot release, 80 ms on dash release. Silent no-op on iOS (WebKit) — not a bug.

---

## Morse Tree (js/ui/tree.js)

The most visually complex part. Built once, updated by class toggles thereafter.

- ViewBox `0 0 100 140` (portrait).
- `<defs>` includes a `feGaussianBlur` glow filter and brass linear gradients (`brass-fill`, `brass-fill-bright`).
- Edges are `<line>` elements drawn first so they sit behind nodes.
- Nodes are `<circle>` (dot) or `<rect>` with rounded corners (dash).
- Labels are `<text>` on top of small dark rectangle "engraved plates" — the plate masks the edge passing behind the letter.
- Antenna at the root: a small brass square + connector line + bulb.

`initTree()` builds the SVG once, storing references to each edge `<line>` and each node shape + label `<text>` in two `Map`s keyed by code (or `from->to` for edges). `renderTree()` walks state and toggles classes:

- `tree-edge.on-path` — edge is on the current path
- `tree-node.on-path` — node is on the current path (any ancestor of currentCode)
- `tree-node.current` — node code === currentCode
- `tree-node.error` — flash red for ~400 ms
- `tree-node.committed` — flash bright for ~400 ms after a successful commit
- `tree-label-text.on-path` — label text brightens

All visual transitions are CSS — no JS animation loops.

---

## Telegraph Key (js/ui/key.js)

A `<button>` styled as a wooden brass-banded knob. A sibling `<div>` is the brass base strip beneath it.

- `pointerdown` → `setPointerCapture` (so release fires here even if the finger drifts off) → `pressDown()`.
- `pointerup` / `pointercancel` / `pointerleave` → `pressUp()`.
- `contextmenu` blocked.
- `touch-action: none` on the key element.
- `user-select: none` and `-webkit-touch-callout: none` to suppress long-press selection.
- Spacebar listener at `window` level for the desktop fallback (with `e.repeat` filtering).

`renderKey()` toggles the `pressing` class to drive the depress animation (`translateY(4px)` + shadow swap).

---

## Mode Controllers (M2+)

Each mode is a small module under `js/modes/`. A mode has metadata + behavior:

```js
// js/modes/freePlay.js
export const freePlay = {
  id: 'freePlay',
  name: 'Free Play',
  showTree: true,
  showWord: false,
  scored: false,
  onLetterCommit(letter) { /* no-op for free play */ },
};
```

`GameScreen` (a section in `index.html`) reads `state.mode` and shows/hides children based on the mode's flags (`showTree`, `showWord`, `showPaperTape`). `commitLetter()` in `js/input.js` calls `state.mode.onLetterCommit(letter)` after appending to the tape.

---

## Hint System (M2)

In guided modes, an idle timer resets every time `currentCode` changes (or the press starts). When idle for `hintDelayMs`, `state.hintTarget` is set to the next uncompleted letter's code; `renderTree()` adds a `hint-trail` class to each edge on the path to that letter. The hint clears the moment the user presses the key again.

---

## Timing / WPM Calculation (M4)

```js
// js/lib/timing.js
export function calculateWpm(charactersTyped, elapsedMs) {
  const minutes = elapsedMs / 60000;
  const standardWords = charactersTyped / 5;
  return Math.round(standardWords / minutes);
}
```

Standard Morse WPM convention (PARIS = 5 characters). Displayed with one decimal if < 20, integer if ≥ 20.

---

## Known Platform Caveats

- **iOS WebKit (Safari / DDG / Chrome-on-iOS):** Vibration API unavailable. `AudioContext` must be initialized from a user gesture (first key press), not on load.
- **iOS Safari bottom-bar:** address/toolbar can overlay the telegraph key. `100dvh` (dynamic viewport) for layout, with `100vh` fallback. Respect `env(safe-area-inset-bottom)`.
- **Long-press selection:** prevent via `user-select: none` and `-webkit-touch-callout: none` on the key (and ideally the body).
- **Pointer capture:** on `pointerdown`, call `setPointerCapture` so the release event fires on the right element even if the finger drifts off.
- **Screen sleep during listening playback:** acceptable — playback is short.

---

## Performance Notes

No noteworthy perf concerns. The tree is 26 nodes, the audio is a single oscillator, the DOM updates are class-toggle scope. Bundle size at MVP is well under 30 KB unminified (no framework runtime). Lighthouse should score 95+ trivially.

---

## Testing Approach

- Manual QA on iOS Safari, Android Chrome, desktop Chrome, and DuckDuckGo on iOS — the four target browsers.
- Pure functions (`detectSymbol`, `calculateWpm`, `morseTree` lookups) can be exercised from the browser console. No Vitest, no Jest, no test runner — overkill for this scope. If unit testing later proves valuable, add a small `tests.html` that imports the modules and runs assertions.
- A dev-only debug overlay (toggleable via a query param like `?debug=1`) can show `currentCode`, last duration, and remaining auto-commit time. Add when tuning feel; remove or hide for ship.

---

## Deployment

Served as a subpath of the portfolio repo at `https://gamedesignerjoe.github.io/meetMorse/`.

There is no build step. GitHub Pages serves the source files directly:

```bash
git add meetMorse/
git commit -m "update meetMorse"
git push
```

That's the entire deploy flow. No env variables, no custom domain config, no asset paths to rewrite. All in-app paths in `index.html`, `css/style.css`, and ES module imports use relative paths so the subpath just works.
