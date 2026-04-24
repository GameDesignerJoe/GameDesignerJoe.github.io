# Meet Morse — Technical Design Document

## Stack

- **React 18** + **TypeScript** via **Vite** (familiar, fast iteration, good mobile build).
- **Tailwind CSS** for styling. Custom theme for the wood/brass/PCB palette.
- **Zustand** for state management. Three slices: input, game, settings + scores (can be merged if it stays simple).
- **Web Audio API** (built into browsers — no package, no keys) for Morse tones.
- **Navigator Vibration API** (built-in; no-ops on iOS) for haptics.
- **localStorage** for settings and high scores.
- **No backend.** Purely client-side.
- **Deployment:** GitHub Pages (served at `/meetMorse/` on the portfolio site).

Target browsers: mobile Safari, mobile Chrome, DuckDuckGo on iOS/Android, and desktop evergreen browsers. Note that DuckDuckGo on iOS uses WebKit → Vibration API will be a no-op there.

---

## Directory Structure

```
meet-morse/
├── public/
│   ├── favicon.ico
│   └── wood-texture.jpg              # optional if we can't do it in CSS
├── src/
│   ├── components/
│   │   ├── TelegraphKey.tsx          # the wooden button
│   │   ├── MorseTree.tsx             # the SVG PCB tree
│   │   ├── WordDisplay.tsx           # target word, dim→bright
│   │   ├── PaperTape.tsx             # free-play rolling letter strip
│   │   ├── ModeCard.tsx              # a single mode tile
│   │   ├── SettingsPanel.tsx         # slide-in settings
│   │   ├── HighScoreBadge.tsx
│   │   └── Button.tsx                # brass-accent reusable button
│   ├── screens/
│   │   ├── HomeScreen.tsx            # mode selector + settings gear
│   │   ├── GameScreen.tsx            # hosts any mode
│   │   └── ResultsScreen.tsx         # end-of-timed-run WPM display
│   ├── modes/
│   │   ├── freePlay.ts
│   │   ├── guidedWord.ts
│   │   ├── timedWpm.ts
│   │   ├── listening.ts
│   │   ├── memory.ts
│   │   └── types.ts                  # Mode interface
│   ├── engines/
│   │   ├── audioEngine.ts            # Web Audio tone generation
│   │   ├── hapticsEngine.ts          # Vibration wrapper
│   │   └── inputEngine.ts            # press-duration → dot/dash, letter commit
│   ├── data/
│   │   ├── morseTree.ts              # tree structure + letter-to-code map
│   │   └── words.ts                  # the 200-word list, tiered
│   ├── stores/
│   │   ├── inputStore.ts             # current buffer, tree position, pressing state
│   │   ├── gameStore.ts              # active mode, word, progress, timer
│   │   └── settingsStore.ts          # persisted user settings + scores
│   ├── lib/
│   │   ├── morse.ts                  # code↔letter helpers
│   │   ├── timing.ts                 # ms→WPM, etc.
│   │   └── storage.ts                # localStorage wrapper
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                     # Tailwind directives + theme
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Data Model

### The Morse Tree

Stored as a flat map from code string to letter. The tree is traversed by building up the code string (`"."`, `".-"`, `".-."`, etc.) and looking up the current node.

```ts
// src/data/morseTree.ts
export const CODE_TO_LETTER: Record<string, string> = {
  '.': 'E',    '-': 'T',
  '..': 'I',   '.-': 'A',   '-.': 'N',   '--': 'M',
  '...': 'S',  '..-': 'U',  '.-.': 'R',  '.--': 'W',
  '-..': 'D',  '-.-': 'K',  '--.': 'G',  '---': 'O',
  '....': 'H', '...-': 'V', '..-.': 'F', '.-..': 'L',
  '.--.': 'P', '.---': 'J', '-...': 'B', '-..-': 'X',
  '-.-.': 'C', '-.--': 'Y', '--..': 'Z', '--.-': 'Q',
};

export const LETTER_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_LETTER).map(([code, letter]) => [letter, code])
);

// Tree position data for rendering (x/y coords normalized 0-100)
// Used by MorseTree.tsx to draw the SVG board.
export interface TreeNode {
  letter: string;
  code: string;
  x: number;            // normalized 0-100
  y: number;
  shape: 'dot' | 'dash' | 'antenna';
}

export const TREE_NODES: TreeNode[] = [
  // laid out to mirror the reference image
  { letter: 'E', code: '.',   x: 55,  y: 12, shape: 'dot' },
  { letter: 'I', code: '..',  x: 68,  y: 12, shape: 'dot' },
  // ...fill out all 26 + antenna
];

export const TREE_EDGES: Array<{ from: string; to: string }> = [
  // pairs of codes connected in the tree
  // root ('') → '.' (E), root → '-' (T), etc.
];
```

### Words

```ts
// src/data/words.ts
export const WORDS_TIER_1: string[] = ['IT', 'IS', 'AT', /* ... */];
export const WORDS_TIER_2: string[] = [/* ... */];
export const WORDS_TIER_3: string[] = [/* ... */];
export const ALL_WORDS = [...WORDS_TIER_1, ...WORDS_TIER_2, ...WORDS_TIER_3];
```

### Settings + Scores (Persisted)

```ts
interface Settings {
  soundOn: boolean;
  hintsOn: boolean;
  hintDelayMs: number;             // 2000 / 3000 / 5000 / 8000
  letterCommitMode: 'forgiving' | 'strict';
  autoCommitDelayMs: number;       // 400 / 600 / 900
  hapticsOn: boolean;
  numbersUnlocked: boolean;
  punctuationUnlocked: boolean;
}

interface Scores {
  timedWpmBest: number;
  listeningStreak: number;
  memoryWpmBest: number;
}
```

localStorage keys: `meetmorse:settings`, `meetmorse:scores`. JSON-stringified. Wrapped in `lib/storage.ts` with try/catch and schema-version field for future migrations.

---

## State Architecture

### inputStore

Tracks everything about the user currently typing:

```ts
interface InputState {
  isPressed: boolean;
  pressStartMs: number | null;
  currentCode: string;              // e.g. ".-" as the user builds a letter
  lastInputAtMs: number | null;     // for auto-commit timer
  
  // actions
  onPressDown: () => void;
  onPressUp: () => void;
  commitLetter: () => string | null;  // returns letter or null if invalid
  clearCurrentCode: () => void;       // on error
}
```

Exposed events (via callbacks or a simple event emitter pattern) for the GameScreen to react to: `onDotDash`, `onLetterCommit`, `onInvalidPath`.

### gameStore

Tracks the active mode and its progress:

```ts
interface GameState {
  mode: Mode;
  currentWord: string | null;
  completedLetters: number;         // how many letters in currentWord are done
  wordsCompleted: number;
  startedAtMs: number | null;
  elapsedMs: number;
  errors: number;
  
  // actions
  setMode: (mode: Mode) => void;
  nextWord: () => void;
  onLetterInput: (letter: string) => void;  // main dispatch
  reset: () => void;
  finish: () => void;                       // compute WPM, save score
}
```

### settingsStore

Read/write settings and scores; auto-persists on change.

---

## Input Engine

The heart of the feel. Detailed logic:

```ts
// engines/inputEngine.ts
const DOT_DASH_THRESHOLD_MS = 150;

export function detectDotOrDash(durationMs: number): '.' | '-' {
  return durationMs < DOT_DASH_THRESHOLD_MS ? '.' : '-';
}

// On `pointerdown`:
//   - record pressStartMs
//   - start tone (audioEngine.startTone)
//   - visual: depress the key, light up current tree node "in progress"
// 
// On `pointerup`:
//   - compute duration = now - pressStartMs
//   - stop tone
//   - symbol = detectDotOrDash(duration)
//   - fire haptic (30ms for dot, 80ms for dash)
//   - append symbol to currentCode
//   - advance tree position / detect invalid path
//   - reset auto-commit timer to autoCommitDelayMs
// 
// When auto-commit timer fires:
//   - look up currentCode in CODE_TO_LETTER
//   - if found: emit onLetterCommit(letter), clear buffer
//   - if not found: treat as error (flash red, clear buffer)
// 
// In guided modes: additionally compare currentCode against the prefix of
// LETTER_TO_CODE[targetLetter]. If currentCode is not a valid prefix of the
// target code, emit onError and clear buffer immediately.
```

**Pointer events, not touch/mouse:** use `onPointerDown`/`onPointerUp` for unified mobile + desktop support. Prevent default to stop scrolling / text selection while holding.

**Keyboard support (desktop):** attach keydown/keyup on spacebar to the same handlers. Ignore repeat events.

---

## Audio Engine

```ts
// engines/audioEngine.ts
class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private currentGain: GainNode | null = null;

  init() {
    // Lazy init — must be called from a user gesture on mobile Safari
    if (!this.ctx) this.ctx = new AudioContext();
  }

  startTone(freq = 600) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.005); // 5ms attack
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this.currentOscillator = osc;
    this.currentGain = gain;
  }

  stopTone() {
    if (!this.ctx || !this.currentGain || !this.currentOscillator) return;
    const now = this.ctx.currentTime;
    this.currentGain.gain.linearRampToValueAtTime(0, now + 0.005); // 5ms decay
    this.currentOscillator.stop(now + 0.01);
    this.currentOscillator = null;
    this.currentGain = null;
  }

  async playCode(code: string, ditMs = 100): Promise<void> {
    // For listening mode. Play a full code string with proper gaps.
    // dit = ditMs, dah = 3*ditMs, inter-element gap = ditMs, inter-letter = 3*ditMs
  }

  async playWord(word: string, ditMs = 100): Promise<void> {
    // Joins letters with inter-letter gaps, words with 7*ditMs.
  }
}

export const audioEngine = new AudioEngine();
```

**Critical:** `AudioContext` must be created from within a user gesture on mobile Safari (the first tap). Initialize on the first `pointerdown` on the telegraph key, not on app mount.

When `soundOn` is false, all tone methods short-circuit.

---

## Haptics Engine

```ts
// engines/hapticsEngine.ts
export function vibrate(ms: number, enabled: boolean) {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
  // else: silently no-op (iOS WebKit)
}
```

Called with 30ms on dot release, 80ms on dash release.

---

## Morse Tree Component

Rendered as a single SVG. This is the most visually complex component.

- Fixed viewBox (e.g., `0 0 100 140` — portrait).
- Draws edges as thin white strokes (SVG `<line>` or `<path>` with rounded caps).
- Draws nodes as `<circle>` (dot) or `<rect>` with rounded corners (dash).
- Each node has two layers: an outline (dim silkscreen) and a fill (green glow), with opacity/filter animated via CSS transitions.
- Labels positioned offset from each node using `<text>`.
- Glow implemented via SVG `<filter>` with `feGaussianBlur` + `feMerge`, toggled by class.

Component props:

```ts
interface MorseTreeProps {
  currentCode: string;              // what letter is being built
  completedCode: string | null;     // flashes briefly on letter commit
  errorAt: string | null;           // flashes red at this code
  hintTarget: string | null;        // if set, shows amber trail to this letter's path
  hidden: boolean;                  // memory mode
}
```

Rendering logic walks from the root building up codes like `"."`, `".."` and checks against `currentCode` to determine which nodes/edges are "on path". Uses `useMemo` to compute node state only when inputs change.

---

## Telegraph Key Component

```tsx
interface TelegraphKeyProps {
  onPress: () => void;
  onRelease: () => void;
}
```

Rendered as:
- A wooden base (CSS gradient, subtle grain via SVG filter).
- Brass hinge on one side (SVG or CSS).
- A rounded wooden knob on top that translates down on press (`translateY(4px)` + shadow change).
- `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onPointerLeave` all trigger release if active.
- `touch-action: none` to prevent scroll on hold.
- Spacebar listener at the component level (keydown/keyup with repeat suppression).

---

## Mode Controllers

Each mode is a small module that wires up the game store's behavior:

```ts
// modes/types.ts
export interface Mode {
  id: 'freePlay' | 'guidedWord' | 'timedWpm' | 'listening' | 'memory';
  name: string;
  description: string;
  showTree: boolean;
  showWord: boolean;
  useWordList: boolean;
  scored: boolean;
}
```

The `GameScreen` looks up the active mode and composes the UI:

- `showTree` → render `<MorseTree />`
- `showWord` → render `<WordDisplay />`
- Else (free play) → render `<PaperTape />`

Mode-specific behavior (what to do on letter commit, when to finish) lives in each mode's controller as a reducer-like function called by `gameStore.onLetterInput`.

---

## Hint System

In guided modes, the GameScreen starts an idle timer every time `currentCode` changes or resets. If the user stays idle for `hintDelayMs`, the hint target is set to the next uncompleted letter in `currentWord`. The `MorseTree` component then draws the amber trail.

The hint clears the moment the user presses the key again.

---

## Timing / WPM Calculation

```ts
// lib/timing.ts
export function calculateWpm(charactersTyped: number, elapsedMs: number): number {
  const minutes = elapsedMs / 60000;
  const standardWords = charactersTyped / 5;
  return Math.round(standardWords / minutes);
}
```

Standard Morse WPM convention (PARIS = 5 characters). Displayed to the user with one decimal if < 20, integer if ≥ 20.

---

## Known Platform Caveats

- **iOS WebKit (Safari / DDG / Chrome-on-iOS):** Vibration API is unavailable. `AudioContext` must be initialized from a user gesture (first key press), not on mount.
- **iOS Safari bottom-bar:** address/toolbar can overlay the telegraph key. Use `100dvh` (dynamic viewport) for layout, with fallbacks, and respect `env(safe-area-inset-bottom)`.
- **Long-press selection:** prevent via `user-select: none` and `-webkit-touch-callout: none` on the key.
- **Pointer capture:** on pointer down, call `setPointerCapture` so release is detected even if the finger drifts off the button.
- **Screen sleep during listening playback:** acceptable — playback is short.

---

## Performance Notes

No noteworthy perf concerns for MVP. The tree is 26 nodes, the audio is a single oscillator. React re-renders should be scoped with `useMemo` / selective Zustand subscriptions. Lighthouse should score 95+ easily on a simple static Vite build.

---

## Testing Approach

- Unit tests (Vitest) for: `morseTree` code lookup, `inputEngine` dot/dash detection, `timing` WPM math.
- Manual QA checklist for each mode on iOS Safari, Android Chrome, desktop Chrome. No automated E2E needed at MVP.
- A dev-only debug panel (toggleable) shows `currentCode`, `lastDurationMs`, and `autoCommitRemainingMs` to help tune feel during development.

---

## Deployment

Served as a subpath of the portfolio repo at `https://gamedesignerjoe.github.io/meetMorse/`.

- `vite.config.ts` sets `base: '/meetMorse/'` so built assets reference the correct paths.
- `npm run build` produces `dist/`. GitHub Pages serves whatever files are committed at `meetMorse/`, so a deploy flow needs to land the built `index.html` and `assets/` at that path on the main branch.
- The exact deploy mechanism (commit `dist/` contents directly, use a deploy script, or a GitHub Action) is not prescribed here — pick what fits when ready to ship. Local development via `npm run dev` is unaffected.
- No env variables needed. No custom domain config at MVP.
