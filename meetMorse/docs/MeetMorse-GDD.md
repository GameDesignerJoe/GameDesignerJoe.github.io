# Meet Morse — Game Design Document

## Concept

**Meet Morse** is a mobile-first web app that teaches Morse code by pairing a single-button input (like a real telegraph key) with a visual "code tree" that makes each letter's pattern learnable at a glance. The tree acts as both a reference and a mnemonic: every letter has a physical position in the tree that IS its code.

The core pedagogical idea is borrowed from a physical learning tool (Nux Gadgets' Morse Code board): **the shape of the tree teaches you the code.** Circles are dots, rectangles are dashes, and walking the tree from the antenna to any letter IS that letter's Morse code. "E" is one circle to the right of the antenna. "A" is a circle then a rectangle. "Q" is rectangle-rectangle-circle-rectangle. You stop thinking in abstract codes and start thinking in paths.

Meet Morse takes that idea and wraps it in a telegraph-operator theme — a wooden desk, a brass-hardware key — and adds a progression system: free play, guided words, timed challenges, listening, and memory modes.

---

## Core Loop

1. User presses the wooden telegraph key button.
2. A short tap (< 150ms) is a **dot**. A long press (≥ 150ms) is a **dash**.
3. The tree lights up in green, showing the user's current position as they navigate letter-by-letter.
4. When a letter is committed (after a pause, or explicit confirm depending on settings), the letter appears.
5. Depending on the mode, the user is either freely exploring, completing a target word, or decoding a played-back signal.

The loop teaches in layers:
- **Visual:** shapes on the tree literally spell out the code.
- **Auditory:** every dot/dash plays the real Morse tone.
- **Muscular:** the tap-vs-hold feel trains real Morse timing, not just pattern memory.

---

## Morse Tree Structure

The tree is a binary tree rooted at the antenna icon. From any node, a **dot branches right-ish** (toward E), a **dash branches left-ish** (toward T). The reference image layout is preserved. Full mapping of the 26 letters:

| Letter | Code | Tree Path from Antenna |
|--------|------|------------------------|
| E | `.` | dot |
| T | `-` | dash |
| I | `..` | dot, dot |
| A | `.-` | dot, dash |
| N | `-.` | dash, dot |
| M | `--` | dash, dash |
| S | `...` | dot, dot, dot |
| U | `..-` | dot, dot, dash |
| R | `.-.` | dot, dash, dot |
| W | `.--` | dot, dash, dash |
| D | `-..` | dash, dot, dot |
| K | `-.-` | dash, dot, dash |
| G | `--.` | dash, dash, dot |
| O | `---` | dash, dash, dash |
| H | `....` | dot × 4 |
| V | `...-` | dot, dot, dot, dash |
| F | `..-.` | dot, dot, dash, dot |
| L | `.-..` | dot, dash, dot, dot |
| P | `.--.` | dot, dash, dash, dot |
| J | `.---` | dot, dash, dash, dash |
| B | `-...` | dash, dot, dot, dot |
| X | `-..-` | dash, dot, dot, dash |
| C | `-.-.` | dash, dot, dash, dot |
| Y | `-.--` | dash, dot, dash, dash |
| Z | `--..` | dash, dash, dot, dot |
| Q | `--.-` | dash, dash, dot, dash |

Tree positions reserved for numbers/punctuation extend beyond H, O, and the deepest corners, but are hidden in the MVP.

---

## Input Model

**Single button.** One big wooden key. Press and hold for dash, quick tap for dot.

- **Tap / hold threshold:** 150ms (fixed for MVP).
- **Letter commit mode:** Default is forgiving — letter auto-commits after 600ms of inactivity. Users can switch to strict mode in settings, which requires a longer pause (matching standard 3-unit inter-letter gap at 12 WPM ≈ 300ms but also ignores accidental double taps).
- **Word boundary:** A longer pause (≥ 1200ms in forgiving mode) commits a word.
- **Keyboard fallback on desktop:** Spacebar acts as the key. (Tap = press and release quickly; hold = press and release slowly.)

The wooden key gives tactile visual feedback on every press — it depresses slightly, the brass fittings catch light. Every press plays a 600Hz sine tone for the duration of the press (matching real Morse).

---

## Visual Design

### Theme: Telegraph Operator's Desk

The whole app feels like a single telegraph station:

- **Background:** Warm, dark wood grain (walnut or mahogany), subtle texture. This is the desk surface.
- **Top of screen:** A narrow brass nameplate with the mode name, or in guided mode, the target word (see Word Display below).
- **Middle:** The **code tree** — kept faithful to the reference. Dark navy board, white silkscreen lines, glowing green nodes for the current path, red flash for errors. The PCB aesthetic stays because it IS the learning tool. (We're not losing the circles-for-dots, rectangles-for-dashes mnemonic.)
- **Bottom:** The wooden telegraph key. A large rounded wooden button with brass base and hinge details. Tappable area is generous (thumb-friendly on phones). It depresses visibly on press.
- **Accents:** Warm amber for UI chrome (buttons, settings icons), brass for borders, green for correct state, red for errors.

### The Tree — Visual States

Each node (circle = dot, rectangle = dash) has these states:

- **Idle:** Dim silkscreen outline, unlit.
- **On path (current trail):** Filled with a solid green glow.
- **Current position:** Brighter green, subtle pulsing halo.
- **Error:** Flashes red once, then clears.
- **Hint (glowing path):** A soft amber trail lights up from the antenna along the correct route to the target letter, one segment at a time.

Letter labels stay always-visible as subtle silkscreen text.

### Word Display (Guided Modes)

The target word appears in the top brass plate area:

- **Uncompleted letters:** Dim (low opacity, maybe 30%).
- **Completed letters:** Full opacity.
- No pulsing or explicit "current letter" indicator — the user reads left-to-right naturally.

### Free Play Display

A rolling strip above the tree shows recent letters as they're committed, like a telegram paper tape. Oldest letters scroll off the left edge. Purely for fun and feedback.

---

## Modes

All modes are available from start. **Free Play is the default**. A "Modes" button in the UI opens a selector grid with each mode as a card.

### 1. Free Play (default)
- No target word, no timer, no scoring.
- User taps out letters; the tree lights up; committed letters scroll across the paper tape up top.
- Teaches the tree. The entry point for all users.
- After 5 seconds of inactivity, the paper tape clears itself.

### 1b. Practice (calibration)
- No tree, no word, no scoring. Just a single huge "DOT" or "DASH" prompt.
- A horizontal visualizer below the prompt fills as the user holds the key. A vertical bar marks the dot/dash threshold (live-tied to the user's `dotDashThresholdMs` setting). Target zone (left of threshold for DOT, right for DASH) is highlighted in amber.
- Press release classifies dot vs. dash and reports ✓ or ✗ next to a streak counter.
- Designed as a calibration tool: tap a few rounds, watch where your natural press lands relative to the threshold marker, adjust the threshold in Settings if your dots are flirting with dash territory.

### 2. Alphabet
- Walks the user through every letter from A to Z, one at a time.
- Single letter shown up top. User taps the code; on commit, advances to the next letter.
- Path-divergence error handling identical to Guided Word.
- After Z, loops back to A. Endless.
- The "intro" mode for total beginners — narrower scope than Guided Word, easier to track progress.

### 3. Guided Word
- A word from the word list appears up top (dim).
- User taps it out letter-by-letter. Each correct letter brightens.
- **Error handling:** If the user diverges from the target letter's path (e.g., target is "A" = `.-` and they input `.`, `.`), the tree flashes red at the wrong node, the current letter input resets to the antenna, and they try that letter again. The word does NOT reset.
- **Tree focus:** every letter in the current word is highlighted with a brighter brass label, and every other letter is dimmed heavily — the user's eye goes straight to where they need to aim. This dim-non-target behavior applies in any mode that sets a target word (Alphabet, Drill, etc.).
- **Hints:** idle-triggered amber trail from the antenna to the next target letter. Default OFF; toggle in Settings (`hintsOn`). Delay configurable in Settings (2 / 3 / 5 / 8 s).
- On word complete, next word appears. No timer. Endless.

### 4. Drill (reinforcement)
- Picks a curated cluster of words that share many letters, so the same codes get hit many times in close succession.
- Goal: spaced-repetition reinforcement of letters that haven't stuck yet.
- Cluster selection is algorithmic (e.g., "all 3-letter words containing M, E, A, N" or "words heavy in level-4 letters Q/Z/J/Y").
- Could later be extended to track which letters the user trips on most and bias the drill toward them.
- See MILESTONES §M-Drill for build plan.

### 5. Timed WPM
- Same flow as Guided Word, but with a timer.
- Score is **Words Per Minute** using the standard Morse convention: 1 word = 5 characters; WPM = (characters typed / 5) / (minutes elapsed).
- A fixed challenge length: complete 10 words. Live clock + `word N of 10` shown above the word display.
- Timer starts on the user's first symbol press (not on entering the screen), so settling-in time doesn't count against you.
- Errors (path divergence + wrong-letter commits) are tallied and shown on the results screen.
- Result screen shows WPM headline, time, errors, and current best. Animated "★ New High Score ★" badge when the run beats the saved best.
- High score persisted in localStorage at `meetmorse:scores`. Mode card shows `Best: X WPM` when a score exists.

### 6. Listening
- A word from the word list is played as Morse audio (no visual on the tree — just tones at 12 WPM).
- User types what they hear. Tree lights up as they go. The target word is shown up top but blanked (underscores or dimmed blocks) until they attempt it.
- **Replay button** available.
- Score tracked: correct words / total, streak of correct in a row.

### 7. Memory
- The tree is hidden (or shown as dim outline only, no labels).
- Same flow as Guided Word. The user must remember the codes.
- For users who've graduated from the tree.

---

## Settings

Accessible via a brass gear icon in the top-right of Home. All settings persist in localStorage under `meetmorse:settings`.

Built (M3 / M4 polish):

- **Sound** — on / off. Default: on. When off, the audio engine short-circuits all tone calls.
- **Haptics** — on / off. Default: on. No-op on iOS regardless.
- **Hints** — on / off. Default: off. When on, an amber trail from the antenna to the next target letter appears after the configured idle delay.
- **Hint delay** — 2s / 3s / 5s / 8s. Default: 3s.
- **Auto-commit delay** — 400ms / 600ms / 900ms. Default: 600ms.
- **Dot / Dash threshold** — 120ms / 150ms / 200ms / 250ms. Default: 150ms (standard Morse). Press shorter than this is a dot; longer is a dash. Use Practice mode to find your sweet spot.
- **Debug Timing** — on / off. Default: off. When on, a small panel below the key lists the last 6 presses with duration and how far each was from the threshold. Color-coded: green for clearly classified, amber for mild margin, red for borderline.
- **About / Credits** — small footer thanking Nux Gadgets for the inspiration.

Locked placeholders (functional toggles, but no content yet):

- **Include numbers** — locked. Tree extension + digit words TBD.
- **Include punctuation** — locked. Same.

Deferred (called out in the original spec, parking for now):

- **Letter commit mode** (forgiving vs strict) — strict mode's "ignore double tap" behavior needs more design before implementing. Forgiving is the only mode currently.
- **Reset high scores** — no scores yet (M4 ships timed WPM scoring).

---

## Word List

200 words, bucketed roughly by difficulty. Difficulty = a combination of word length and the complexity of the Morse codes in its letters (E, T, I, A, N, M are simple; J, Q, X, Y, Z, P are complex).

### Tier 1 — Easy (80 words)
Short words using common-letter alphabet (E, T, A, N, I, M, O, S, R, H, D, L, U).

```
IT, IS, AT, AN, AS, AM, ON, OR, IN, TO, SO, NO, ME, BE, WE, HE, US, UP,
OH, AH, IF, OF, HI, SEA, TEN, TEA, ATE, EAT, ICE, AGE, ARM, ART, EAR, EYE,
END, INK, HAT, HIT, OAT, NET, NOT, NOW, ONE, OUR, OUT, MAN, MEN, MAP, MAT,
SUN, RUN, RED, RAT, RID, RIM, SIT, SET, SON, SIR, SAT, SAD, SEA, SAW, SEE,
SIN, STAR, MOON, SOON, HEAT, EAST, NEST, STEM, MEAN, NAME, SALT, HEAD,
LAND, HAND, LAST, TEAM, LETTER
```

### Tier 2 — Medium (70 words)
Add W, G, K, C, F, B.

```
DOG, CAT, CAR, BIG, BAD, BOX, BUG, BUS, BED, BEG, BET, BIT, GUM, GAS, GOD,
GOT, GAP, GAB, CUP, COW, CAN, CAB, COD, COG, CUE, FUN, FED, FAN, FIG, FAT,
FIT, FAR, FEW, KID, KIT, KEY, KING, DUCK, CAKE, BAKE, LAKE, MAKE, TAKE,
RIDE, WIDE, SIDE, HIDE, HOME, GAME, FAME, NAME, ROOM, FOOD, GOOD, WOOD,
WORK, WORD, BIRD, FACT, FAST, CAST, COST, COLD, GOLD, BOLD, SAND, BAND,
STAR, SHIP, FISH, FIRE, CLOCK, CHAIR, BREAD
```

### Tier 3 — Hard (50 words)
Add V, P, Y, X, Q, J, Z.

```
YES, WHY, YOU, SKY, JAR, JAM, JOY, JOB, JET, ZIP, ZOO, BOY, TOY, KEY, PIE,
PAY, PAL, PEN, PUT, POT, PIT, PET, PAN, PUP, VAN, VET, VIA, FOX, BOX, TAX,
WAX, SIX, JUICE, JAZZ, BUZZ, ZEBRA, VIVID, FUZZY, PUZZLE, QUICK, QUEEN,
QUIET, EXACT, EQUIP, EXTRA, MAYBE, HAPPY, PUPPY, JACKET, PYRAMID
```

(Exact list can be tuned during implementation — what matters is the progression from short/simple to long/letter-complex.)

Word presentation order: shuffled within the tier of the currently active difficulty, or a mixed shuffle across all 200 (settings option). Default: mixed shuffle so users see variety.

---

## Scoring & Progression

- **High scores** kept per mode where relevant:
  - Timed WPM: best WPM ever recorded.
  - Listening: longest streak of correct words.
  - Memory: best WPM in memory mode (separate leaderboard from Timed).
- **No XP, no levels, no unlocks** (aside from numbers/punctuation toggle). Keeping MVP simple. Progression is self-directed through the mode list.
- **Session stats** shown at end of each Timed/Listening run.

---

## Audio

- **Tone frequency:** 600 Hz sine wave with short attack/decay envelope (5ms ramp) to prevent clicks.
- **Tone duration during input:** Matches the user's actual button press duration. The tone starts on `pointerdown` and stops on `pointerup`.
- **Tone duration during playback (listening mode):** Standard 12 WPM = 100ms dit, 300ms dah, 100ms inter-element, 300ms inter-letter, 700ms inter-word.
- **No speech synthesis, no sound files.** All tones generated live via Web Audio API.

---

## Haptics

- On supported devices (Android Chrome), each press fires a short vibration (~30ms for dot press, ~80ms for sustained dash) via `navigator.vibrate()`.
- Silently no-ops on iOS (including DuckDuckGo on iOS, which uses WebKit). Not worth pursuing iOS haptics — would require a native wrapper.
- Setting available to disable globally.

---

## Out of Scope for MVP

Deferred but worth keeping in mind:

- Tappable tree nodes (tap a letter to hear its code without typing).
- Accounts / cloud sync of scores.
- Social features / leaderboards across users.
- Numbers / punctuation word lists (toggle exists but content comes later).
- Themed word packs (animals, cities, etc.).
- Accessibility audit (screen reader labels, reduced-motion mode) — should be added in polish phase.
- PWA / installable app — likely low-effort add post-MVP.

---

## Success Criteria

A user who knows zero Morse code should be able to:
1. Open the app, tap the key a few times in Free Play, and understand the tree within a minute.
2. Complete their first Guided Word with hints on within 5 minutes.
3. Return daily and track their own WPM improvement.

The app is "working" when using it genuinely teaches the user Morse — i.e., a user who's spent a few hours in the app can read back simple Morse signals without looking at the tree.
