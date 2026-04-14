# Murmur — Claude Code Handoff
**Audio Choose-Your-Own-Adventure Platform**
*Single-file HTML prototype → Production Vercel App*

---

## What This Is

Murmur is a mobile-first audio storytelling platform built around the choose-your-own-adventure format. Stories are told through recorded narration — not text — with full-screen cinematic visuals, a character portrait that reflects emotional state, and choice buttons that surface while audio is still playing so the experience never goes silent.

There are two modes in one app:
- **Player** — the audience-facing experience for listening to and navigating stories
- **Creator** — a visual node graph editor for building stories, wiring scenes together, and managing audio assets

The working prototype (`murmur.html`) is a complete single-file HTML/JS implementation. The job now is to take that design and turn it into a proper deployable project.

---

## Current State of the Prototype

The file `murmur.html` contains a fully working prototype with:

- Snap-scroll story library with Ken Burns zoom effect and scroll-position dots
- Story detail page (slides up from card)
- Full player: crossfading scene backgrounds, emotion-glow portrait ring, animated waveform indicator, staggered choice reveal
- **Timed choice reveal** — choices surface while narration is still playing, N seconds before the clip ends (not after it finishes)
- **Default choice with countdown** — one choice per scene is marked as default; a gold bar depletes across the bottom of that button; if the player doesn't pick, the default fires automatically and the story continues without an audio gap
- **Smart shuffle** — scenes can have multiple audio clips for the same moment; they rotate without repeating until all have been heard, then reshuffle
- Flash transition between scenes (brief blackout → crossfade to new background)
- Resume modal — returning to a story mid-progress offers Continue or Start Over
- Save state in localStorage (keyed to story ID)
- **Creator mode** — toggled from the nav; shows a draggable node graph with SVG bezier edges, a scene list sidebar, and a right-panel editor for all scene fields
- Export story as JSON

**What the prototype does NOT have yet (build these):**
- Real audio playback (currently uses `setTimeout` to simulate; swap explained below)
- Real image/GIF backgrounds (currently uses CSS gradients as placeholders)
- CSV story importer
- Ambient audio layer (intro sound + loop)
- Story import from JSON file
- Mobile touch drag support in the creator
- Zoom/pan in the creator canvas
- Any backend or authentication

---

## Agreed Terminology

| Term | Meaning |
|---|---|
| **Story** | Top-level adventure that lives in the library |
| **Scene** | One narrative moment — has narration audio, background, portrait, choices |
| **Choice** | A selectable option at the end of / during a scene, pointing to another scene |
| **Clip** | A single audio file. One scene can have multiple clips (variants) |
| **Variant** | Multiple clips for the same scene; smart shuffled |
| **Ambient Layer** | Background audio: an intro clip that plays once, then a loop clip that sustains |
| **Smart Shuffle** | Rotate through all clips before repeating any |
| **Default Choice** | The choice that auto-fires via countdown if player doesn't pick |

---

## Recommended Tech Stack

- **Framework:** React (Vite)
- **Styling:** Tailwind CSS (core utilities only) + CSS custom properties for the design tokens
- **Audio:** Web Audio API (for volume ramping/crossfades) + HTMLAudioElement
- **State:** Zustand or React context — nothing complex needed
- **Storage:** localStorage for save state; no backend required for v1
- **Deployment:** Vercel
- **Assets:** GitHub raw CDN (`https://raw.githubusercontent.com/[user]/[repo]/main/stories/[id]/...`)

### Suggested Folder Structure

```
murmur/
├── public/
│   └── stories/                  ← local story assets during dev
│       └── the-black-door/
│           ├── story.json
│           ├── audio/
│           │   ├── discovery-a.mp3
│           │   └── discovery-b.mp3
│           └── images/
│               ├── discovery.jpg   (or .gif)
│               └── portraits/
│                   ├── curious.png
│                   ├── afraid.png
│                   └── ...
├── src/
│   ├── components/
│   │   ├── Library/
│   │   ├── Detail/
│   │   ├── Player/
│   │   │   ├── Background.jsx
│   │   │   ├── Portrait.jsx
│   │   │   ├── Choices.jsx
│   │   │   └── Waveform.jsx
│   │   └── Creator/
│   │       ├── NodeGraph.jsx
│   │       ├── SceneNode.jsx
│   │       ├── EdgeSVG.jsx
│   │       └── EditPanel.jsx
│   ├── engine/
│   │   ├── AudioEngine.js        ← handles playback, fades, ambient layer
│   │   └── SmartShuffle.js
│   ├── store/
│   │   └── index.js
│   └── App.jsx
└── stories/                      ← story JSON files committed to repo
    └── the-black-door.json
```

---

## Full Data Schema

This is the canonical JSON structure for a story. The prototype already uses this shape. The creator exports it. The player reads it.

```json
{
  "id": "the-black-door",
  "title": "The Black Door",
  "tagline": "He found it. He hid it. It didn't let him go.",
  "description": "A modern explorer discovers a massive black door in the wilderness...",
  "tags": ["horror", "lovecraftian", "solo"],
  "coverImage": "stories/the-black-door/images/cover.jpg",
  "duration": "~18 min",
  "paths": 4,
  "startScene": "discovery",

  "narrator": {
    "name": "The Explorer",
    "portraits": {
      "curious":    "stories/the-black-door/images/portraits/curious.png",
      "happy":      "stories/the-black-door/images/portraits/happy.png",
      "sad":        "stories/the-black-door/images/portraits/sad.png",
      "afraid":     "stories/the-black-door/images/portraits/afraid.png",
      "determined": "stories/the-black-door/images/portraits/determined.png"
    }
  },

  "bgs": {
    "a": "linear-gradient(160deg, #0a0a0a, #1a1208)",
    "b": "linear-gradient(160deg, #080808, #100c04)",
    "c": "linear-gradient(160deg, #0d0405, #1a0808)",
    "d": "linear-gradient(160deg, #050505, #080808)"
  },

  "ambient": {
    "default": {
      "intro": "stories/the-black-door/audio/ambient-intro.mp3",
      "loop":  "stories/the-black-door/audio/ambient-loop.mp3"
    }
  },

  "scenes": {
    "discovery": {
      "id": "discovery",
      "title": "The Black Door",
      "emotion": "curious",
      "bgKey": "a",
      "bgImage": null,
      "clips": [
        "stories/the-black-door/audio/discovery-a.mp3",
        "stories/the-black-door/audio/discovery-b.mp3"
      ],
      "secondsBeforeEnd": 7,
      "defaultChoice": 0,
      "countdown": 6,
      "ambient": null,
      "choices": [
        {
          "text": "Mark the coordinates and leave immediately…",
          "target": "return_home"
        },
        {
          "text": "Reach out and touch the surface of the door…",
          "target": "first_touch"
        }
      ]
    }
  }
}
```

### Scene fields reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `title` | string | Displayed in scene chip during playback |
| `emotion` | string | `curious` `happy` `sad` `afraid` `determined` |
| `bgKey` | string | Key into `story.bgs` gradient map (CSS fallback) |
| `bgImage` | string \| null | URL to image or GIF — overrides `bgKey`. GIFs loop natively. |
| `clips` | string[] | Audio file paths. Smart shuffled — no repeat until all played. |
| `secondsBeforeEnd` | number | Reveal choices this many seconds before the clip ends |
| `defaultChoice` | number \| null | Index of the choice that auto-fires when countdown hits zero |
| `countdown` | number | Seconds player has to choose before default fires |
| `ambient` | object \| null | Override story-level ambient for this specific scene. Same shape: `{intro, loop}` |
| `choices` | array | `[{ text: string, target: string }]` |

---

## Audio Engine Spec

This is the most important piece to get right. The entire "silk" feel of the experience depends on it.

### Narration playback

```javascript
// Pseudocode for the production audio flow
class AudioEngine {
  playScene(scene, shuffler) {
    const clip = shuffler.next()

    // Fade out current narration over 300ms
    this.fadeOut(this.narrator, 300)

    // Load and fade in new clip
    this.narrator.src = clip
    this.narrator.play()
    this.fadeIn(this.narrator, 400)

    // Hook into timeupdate to reveal choices at the right moment
    this.narrator.addEventListener('timeupdate', () => {
      const remaining = this.narrator.duration - this.narrator.currentTime
      if (remaining <= scene.secondsBeforeEnd && !this.choicesRevealed) {
        this.choicesRevealed = true
        onRevealChoices()
      }
    })
  }
}
```

**Critical:** In the prototype, choices are triggered by `setTimeout` using `scene.simDuration`. In production, replace all `simDuration` references with the `timeupdate` listener pattern above. Remove the `simDuration` field from the schema entirely once real audio is wired.

### Ambient audio layer

Each story has a default ambient track. Individual scenes can override it. Behavior:

1. When a story starts, play the ambient intro clip once
2. When the intro ends, crossfade into the ambient loop (which loops indefinitely)
3. When moving to a scene with a different ambient, crossfade between loops
4. The ambient layer sits behind narration at a lower volume (around 0.3)
5. When narration plays, ambient ducks slightly. When narration ends, ambient comes back up.

### Volume ramp utility

```javascript
function ramp(audioEl, fromVol, toVol, durationMs) {
  return new Promise(resolve => {
    audioEl.volume = fromVol
    const steps = durationMs / 16
    const delta = (toVol - fromVol) / steps
    let n = 0
    const tick = () => {
      n++
      audioEl.volume = Math.min(1, Math.max(0, fromVol + delta * n))
      if (n < steps) requestAnimationFrame(tick)
      else { audioEl.volume = toVol; resolve() }
    }
    requestAnimationFrame(tick)
  })
}
```

---

## Player UX Spec

### Library screen
- Vertical snap-scroll, one story per viewport height (100dvh)
- Background fills card; subtle Ken Burns zoom on the in-view card (scale 1.07 → 1.0 over 7s)
- Dark vignette gradient over bottom 40% of card
- Story title in large italic serif (Cormorant Garamond), tagline below, tags above
- Position indicator dots on right edge — active dot elongates
- Tap anywhere on card → Detail screen

### Detail screen
- Slides up from the card (translateY transition)
- Hero image at top (52dvh), dark vignette fading to solid background
- Back button top-left
- Tags, title, tagline, metadata row (duration, paths, narrator name), long description
- "Begin Your Journey →" CTA button — gold, full width, large border radius

### Player screen
- No nav bar (hidden during playback)
- Two background layers (A/B) for crossfading — opacity transition 1.1s
- Dark vignette overlay
- Top bar: close button (left), scene title chip (center), progress dots (right)
- Portrait centered in the upper-middle of the screen
  - Circular, 112px
  - Colored glow ring that changes per emotion:
    - `curious` → blue glow
    - `afraid` → red glow
    - `happy` → gold glow
    - `sad` → purple glow
    - `determined` → white glow
  - When emotion changes, ring color transitions and portrait does a brief scale pulse
  - Supports PNG image per emotion state, or falls back to emoji
- Animated waveform below portrait (5 bars, staggered wave animation) — visible while narration plays
- Choices pinned to bottom of screen
  - Appear while audio is still playing (N seconds before end)
  - Stagger in from bottom: opacity + translateY, 85ms between each
  - Prompt label ("What will you do?") fades in first
  - Standard choice: frosted glass, large italic serif text, left-aligned
  - Default choice: same but with gold border, a small "Auto-selecting if no choice" label, a seconds countdown, and a gold bar across the bottom that depletes
  - On tap: brief scale-down (0.978), then flash transition
- Flash transition: whole screen goes to background color over 240ms, then fades back out over 500ms while new scene renders behind it

### Resume modal
- Bottom sheet, slides up with spring easing
- Appears when returning to a story that has save state beyond the start scene
- Two options: "Continue where I left off" (gold) and "Start from the beginning"

---

## Creator UX Spec

### Layout
- Header: story selector dropdown, "+ Scene" button, "Export JSON" button
- Left sidebar: scrollable scene list with name, emotion, clip count, timing metadata
- Main area: pannable/zoomable canvas with dot-grid background
- Right panel (appears when a node is selected): full scene editor

### Node graph
- Each scene is a draggable card node (desktop: mouse drag; mobile: touch drag)
- Nodes show: title, emotion, clip count, choice labels (truncated), timing fields
- Start scene has a distinct border color (green)
- Selected node has gold border + subtle glow
- SVG bezier curves connect nodes, arrowhead dots at the target end
- Default choice edges are slightly thicker/brighter than regular edges
- Edges update live as nodes are dragged

### Edit panel fields per scene
- Scene title (text input)
- Emotion (select: curious / happy / sad / afraid / determined)
- Background image/GIF URL (text input) + gradient slot fallback (select from story.bgs keys)
- **Choice timing:** two number inputs — "Reveal N seconds before end" and "Player countdown seconds"
- **Audio clips** — list with delete buttons, add via text input + Enter key
- **Portrait images** — one URL input per emotion state (5 inputs)
- **Choices** — list of choice rows, each with: choice text input, target scene dropdown, radio button to mark as default, remove button
- "+ Add Choice" button
- "Set as Start Scene" action
- "Delete Scene" danger action

### Export
- Exports clean JSON (no internal layout positions)
- Filename: `[story-id].json`

---

## CSV Story Import

Build a CSV importer so stories authored in the CSV format can be loaded into the creator. The CSV format is documented below and a full example story (`the_black_door.csv`) is included in this handoff.

### CSV columns

```
scene_id, title, narration_script, choice_1_text, choice_1_target,
choice_2_text, choice_2_target, emotion, is_start, default_choice,
seconds_before_end, countdown_seconds, notes
```

- `narration_script` = the text of what gets recorded for that scene's audio. Not displayed in-game — it's the recording script.
- `is_start` = TRUE/FALSE, marks the starting scene
- `default_choice` = 0-indexed number (0 = first choice, 1 = second)
- `notes` = internal authoring notes, ignored by the player

### Import behavior
1. Parse CSV
2. Create a new story object with a generated ID
3. Populate all scenes from rows
4. Set `startScene` from the `is_start = TRUE` row
5. Load the story into the creator for the user to add audio paths and image URLs

---

## Test Story: The Black Door

A complete Lovecraftian horror story is ready to use as test content. The CSV file `the_black_door.csv` is included in this handoff.

**23 scenes.** The structure is a main linear spine with side branches that always converge back — intentionally. The horror of the story is the illusion of choice; every branch leads to the same end.

### Scene map (abbreviated)

```
discovery
  ├── first_touch → return_home
  └── return_home
        ├── confession_attempt → the_hiding
        └── the_hiding
              └── first_dream
                    ├── waking_resistance → deep_dream
                    └── deep_dream
                          └── the_seeing
                                ├── the_avoidance → the_recognition
                                └── the_recognition
                                      └── the_invitation
                                            ├── the_truth_attempt → the_journey
                                            └── the_journey
                                                  ├── the_turning → the_arrival
                                                  └── the_arrival
                                                        └── the_violence
                                                              ├── the_fighting → the_last
                                                              └── the_last
                                                                    └── the_awakening
                                                                          └── the_realization
                                                                                └── the_final_act
                                                                                      └── the_opening [END]
```

### Emotions per scene (for portrait planning)

| Scene | Emotion |
|---|---|
| discovery, return_home, the_invitation, first_touch | curious |
| first_dream, the_hiding, the_avoidance | sad |
| the_seeing, the_recognition | determined |
| hall, cottage, waking_resistance, deep_dream, the_journey, the_turning, the_arrival, the_violence, the_fighting, the_awakening | afraid |
| the_last, the_truth_attempt, the_opening | sad |
| the_realization, the_final_act | determined |

---

## Design Tokens

Keep these consistent across the React build. They're pulled directly from the prototype.

```css
:root {
  --bg:     #07070f;
  --s1:     #0f0f1c;
  --s2:     #181828;
  --s3:     #222236;
  --text:   #f0ede6;
  --sub:    #928faa;
  --mute:   #484660;
  --gold:   #c9a96e;
  --gold10: rgba(201, 169, 110, 0.10);
  --gold25: rgba(201, 169, 110, 0.25);
  --silk:   cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --r:      20px;
  --rl:     32px;
  --rxl:    48px;
}
```

**Typography:**
- Display / story titles: `Cormorant Garamond`, italic, weights 300/400/600
- UI / body: `DM Sans`, weights 200–500
- Choice buttons use Cormorant Garamond italic — this is intentional, it makes the choice text feel literary

**Portrait emotion glows:**
```css
curious:   border rgba(100,160,255,0.55)  box-shadow rgba(100,160,255,0.18)
afraid:    border rgba(255,75,75,0.55)    box-shadow rgba(255,75,75,0.18)
happy:     border rgba(201,169,110,0.65)  box-shadow rgba(201,169,110,0.22)
sad:       border rgba(140,100,210,0.55)  box-shadow rgba(140,100,210,0.18)
determined:border rgba(255,255,255,0.45)  box-shadow rgba(255,255,255,0.12)
```

---

## Implementation Order (Suggested)

1. **Scaffold the Vite/React project** — set up routing, design tokens, fonts
2. **Port the Library and Detail screens** — static, no audio needed
3. **Port the Player screen** — wire up real audio using the `timeupdate` pattern; test with a local MP3
4. **Add Smart Shuffle and AudioEngine** — narration only first, ambient layer second
5. **Add the countdown/default choice system** — confirm it fires correctly and cancels on manual pick
6. **Port the Creator** — node graph, drag, edit panel, export
7. **Build CSV importer** — parse and load The Black Door as first test story
8. **Wire GitHub asset paths** — confirm raw CDN loading works for audio and images
9. **Add GIF/image background support** — test with a looping GIF in a scene
10. **Resume / save state** — already designed, just port the localStorage logic
11. **Ambient audio layer** — intro + loop + scene-level overrides + ducking under narration
12. **Mobile polish** — touch drag in creator, safe area insets, tap targets

---

## Files in This Handoff

| File | Description |
|---|---|
| `murmur.html` | Complete working prototype. All UX is here. Read this first. |
| `the_black_door.csv` | Full 23-scene test story with narration scripts, choice structure, and metadata |
| `Murmur-DESIGN.md` | This document |

---

## Notes for Claude Code

- The prototype is the source of truth for all visual behavior. When in doubt, open `murmur.html` in a browser and observe.
- The `simDuration` field in scene data is prototype scaffolding only. Remove it and replace all `setTimeout`-based narration simulation with the `timeupdate` listener on real audio.
- GIF backgrounds require no special handling — CSS `background-image: url(...)` renders and loops GIFs natively.
- The creator is desktop-only for now. Don't spend time on mobile creator UX until the player is solid on mobile.
- Keep it a single Vercel deployment. No separate backend, no database, no auth in v1.
- The file `murmur.html` has a working `SmartShuffle` class and `ramp()` audio utility. Port these directly — they're already correct.
