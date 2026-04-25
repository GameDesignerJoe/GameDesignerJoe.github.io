# Meet Morse — Milestone Plan

Build order optimized for getting to a playable, feel-good prototype as fast as possible, then layering in modes. Each milestone should end in a state Joe can actually use and playtest on his phone.

---

## M0 — Scaffold

**Goal:** Empty app deployed, nothing interactive. Baseline stack wired up.

- Initialize Vite + React + TypeScript project.
- Install Tailwind, configure with custom theme tokens (wood/brass/PCB palette, fonts).
- Install Zustand.
- Create empty store files and engine stubs (no logic yet).
- Set up folder structure per TDD.
- Add a basic `<App />` that renders "Meet Morse" in the themed style (wood background, brass nameplate).
- Deploy to Vercel. Confirm it loads on iPhone.

**Exit criteria:** Vercel URL shows the themed landing text, nothing else.

---

## M1 — The Key and the Tree (Free Play)

**Goal:** The core interaction works. You can tap out letters and see the tree respond.

- Build `<TelegraphKey />` component. Pointer events for press/release, visual depress animation, spacebar fallback.
- Build `<MorseTree />` as SVG with all 26 nodes and edges laid out per the reference image. Static for now.
- Implement `audioEngine`: tone starts on key press, stops on release. Lazy-init `AudioContext` on first press.
- Implement `inputEngine`: convert press duration → dot/dash, track `currentCode`, auto-commit on inactivity.
- Wire the input engine to the tree: current path and current node glow green; committed letters cause a brief flash.
- Implement `<PaperTape />` at the top: committed letters scroll in from the right.
- Add minimal `HomeScreen` / `GameScreen` routing — home has a "Play" button that starts Free Play.
- Add haptics on press release.

**Exit criteria:** Joe can open the app on his phone, tap the key, hear tones, watch the tree glow, and see committed letters appear in the paper tape.

This is the hardest milestone. Get the feel right before moving on. Tune the `DOT_DASH_THRESHOLD_MS` and `autoCommitDelayMs` defaults based on real phone use.

---

## M2 — Guided Word Mode

**Goal:** Structured learning with hints.

- Add word list data (200 words, tiered).
- Build `<WordDisplay />` component: dim letters, bright on complete.
- Implement `guidedWord` mode controller: pick a word, compare input prefix against target letter's code, advance on letter match, red-flash + clear on path divergence.
- Implement hint system: idle timer + amber trail rendering in `<MorseTree />`.
- Add Home Screen "Modes" button opening a mode selector grid.
- Add a basic "Modes" grid (for now with cards for all 5 modes, though some link to placeholders).

**Exit criteria:** User can choose Guided Word from Modes, see a word, spell it out, get hints when idle, see letters light up, and advance through words endlessly.

---

## M3 — Settings ✅ Built

- `js/lib/storage.js` — `loadSettings`, `saveSettings`, `DEFAULT_SETTINGS`. localStorage key: `meetmorse:settings`. Stored values merge over defaults so adding new keys later doesn't break older saves.
- `js/settings.js` — `updateSetting(key, value)` mutates state, persists, applies side-effects. `applyAllSettings()` runs once on boot.
- `js/ui/settings.js` — declarative ROWS array drives the screen build. Toggle, segmented, and locked placeholder rows render from one descriptor pattern.
- Settings screen is a top-level view (`home` / `modes` / `settings` / `game`), reached via a brass gear in the home screen's top-right corner.
- `state.settings.soundOn` flips audio engine enabled at the source. `hapticsOn`, `autoCommitDelayMs`, `hintsOn`, `hintDelayMs` are read at the call site (input.js, guidedWord.js) so changes apply on the next keystroke.
- Numbers / punctuation render as locked rows with 🔒 — keys exist on `state.settings` but no behavior wired up yet.

**Deferred from the original spec:**

- Letter commit mode (forgiving / strict) — strict mode's "ignore double tap" needs more design before implementing. Forgiving is the only mode now.
- Reset high scores — no scores yet (M4 brings timed WPM scoring).

---

## M4 — Timed WPM Mode ✅ Built

- `js/modes/timedWpm.js` — 10-word challenge. Timer starts on the first symbol press, runs at 250 ms ticks via setInterval, and stops on finish/exit. Word picker uses the same shuffled-`ALL_WORDS` pool as guidedWord.
- WPM = `(charactersTyped / 5) / minutes`. Helpers in `js/lib/timing.js`: `calculateWpm`, `formatWpm` (1 decimal under 20, integer at 20+), `formatElapsed` (`m:ss`).
- Live status row above the word display (`#timed-status`) shows current clock + `word N of 10`. Visibility driven by a `mode.showTimer` flag — stays hidden in every other mode.
- New top-level view: `results`. The screen shows WPM headline, an animated "★ New High Score ★" badge when applicable, and Time / Errors / Best stats. Buttons: PLAY AGAIN (restarts the same mode, preserves `gameBackTarget`) and back-to-modes.
- Scoring persisted via `loadScores` / `saveScores` in `js/lib/storage.js` (key `meetmorse:scores`, separate from settings). `state.scores.timedWpmBest` is the canonical high. Beats are detected before saving, so the new-high badge fires exactly once.
- Mode card on the modes screen shows `Best: X WPM` when a score exists. `renderModesScreen()` is called whenever the user lands on the modes view so a fresh PB shows up immediately.

**Exit criteria met:** A user can run a full timed challenge, see their WPM, and see their best persist across reloads.

---

## M5 — Listening Mode

**Goal:** Train ear recognition.

- Extend `audioEngine` with `playCode` and `playWord` methods (sequenced dits/dahs with proper gaps at 12 WPM).
- Implement `listening` mode controller: plays a word, shows blanked placeholders, user types, reveal + score.
- Add "Replay" button.
- Track correct streak, save best.

**Exit criteria:** Plays a word, user can attempt it, correct/incorrect feedback, streak tracking.

---

## M6 — Memory Mode

**Goal:** Tree-hidden endgame.

- Add `hidden` prop behavior to `<MorseTree />` (render as dim silhouette without labels, or fully hide — playtest both).
- Implement `memory` mode controller: reuses guided/timed logic but with tree hidden.
- Separate high score.

**Exit criteria:** Fully playable without the tree. This mode should feel earned.

---

## M-Drill — Reinforcement Mode

**Goal:** Repetition-based learning. The user practices clusters of words that share letters so the same codes get hammered until they stick.

Conceptually this is "spaced repetition" applied to letter recognition rather than full SRS. The user picks Drill from the modes screen and gets a sequence of words selected from a cluster, not the full mixed-shuffle pool.

### What to build

- **Cluster definitions** in `js/data/drillClusters.js`. Each cluster is `{ id, name, description, words: [...] }`. Hand-curated to start. Examples:
  - "ETIA Starter" — words built from only E, T, I, A, N, M (the simplest codes): IT, AT, AN, IN, AM, ME, ON, NO, NET, MAT, etc.
  - "Stubborn Letters" — words heavy in Q, Z, J, Y, X (the level-4 letters most users miss): JAZZ, QUIZ, FUZZY, JAZZY, ZEBRA, etc.
  - "Vowel Drill" — A, E, I, O, U pairs: SEA, OUR, EAT, ICE, etc.
- **Mode controller** in `js/modes/drill.js`. Reuses guidedWord-style prefix-validation; word picker reads from the active cluster's word list (shuffled).
- **Cluster picker UI**. When the user taps Drill from the modes screen, show a sub-screen listing the available clusters as cards. Tap one → enter game with that cluster active.
- **Optional, M-Drill+1**: track per-letter error rates from any guided/drill session in localStorage. Bias future drill word selection toward letters with high error rates.

### Exit criteria

A user who's tripping on Q can pick "Stubborn Letters", get a word stream that hammers Q ten times in two minutes, and feel the difference next time Q comes up in Guided Word.

---

## M-Alphabet — Alphabet Mode

**Goal:** Walk a brand-new user through every letter A–Z, one at a time. The "training wheels" mode.

### What to build

- `js/modes/alphabet.js` — single-letter target, A through Z, advances on correct commit, loops at Z. Reuses the guidedWord prefix-validation pattern.
- Slot the card on the modes screen between Free Play and Guided Word.

### Exit criteria

A user who has never used the app can tap Alphabet and successfully tap out every letter once, end-to-end, in one sitting.

**Status:** Built (lives at `js/modes/alphabet.js`).

---

## M7 — Polish

**Goal:** Take it from working to good.

- Refine wood/brass textures and shadows. Grain direction, key hinge shading, nameplate engraving detail.
- Animation polish: tree glow transitions, paper tape motion, key depression, mode transitions.
- Typography pass: serif for nameplate, mono for letters on tape.
- Safe-area-inset handling for iOS notches/home bar.
- Loading states and empty states.
- Small delight moments: a morse-code chirp on mode transitions, a "." animation on the splash.
- Meta tags: title, description, social preview.
- Lighthouse pass, fix any red/yellow flags.
- Add credits line to Settings → About (thank Nux Gadgets for the inspiration).

**Exit criteria:** Joe is happy sharing the link.

---

## Post-MVP Backlog

Not on the critical path. Pick up any of these as they become interesting:

- Numbers and punctuation (tree extension + word list content).
- Themed word packs (animals, cities, famous messages).
- Tappable tree nodes for reference mode.
- Daily word challenge.
- PWA manifest + icon, installable to home screen.
- Accessibility pass (screen reader support, reduced-motion, high-contrast option).
- Sharing a score as an image.
- Morse code translator utility (type English, hear/see Morse).

---

## Rough Time Estimate

For Claude Code building this with Joe reviewing and directing:

- M0 → half a day
- M1 → 1–2 days (most of the real work)
- M2 → 1 day
- M3 → half a day
- M4 → half a day
- M5 → 1 day
- M6 → half a day
- M-Alphabet → done (built alongside M2)
- M-Drill → 1 day for hand-curated clusters; +1 day if we add error-rate tracking
- M7 → ongoing

Total: roughly a week of focused work to a shareable MVP. M1 is where to spend the time.
