# Murmur — Agent Handbook

**Audio Choose-Your-Own-Adventure Platform**
React/Vite app deployed to GitHub Pages at `/murmur/`

---

## What Murmur Is

Murmur is a mobile-first audio storytelling platform. Stories are told through recorded narration — not text — with full-screen cinematic visuals, a character portrait that reflects emotional state, and choice buttons that surface *while audio is still playing* so the experience never goes silent.

There are two modes:
- **Player** — the audience-facing experience for listening to and navigating stories
- **Creator** — a visual node graph editor for building stories, wiring scenes together, generating audio/images with AI, and managing assets

The app ships as a static site (no backend, no auth). All persistence uses localStorage and IndexedDB in the browser, plus the File System Access API for saving project files to disk.

---

## Running Locally

```bash
cd murmur/app
npm install    # first time only
npm run dev    # Vite dev server at http://localhost:5173/murmur/
```

Build and deploy to GitHub Pages:
```bash
npm run deploy   # vite build + copy dist/ to /murmur/ root
cd ../../..
git add murmur && git commit && git push
```

---

## Directory Structure

```
murmur/
├── app/                          # Source project (this is where you work)
│   ├── src/
│   │   ├── App.jsx               # Root — bootstraps manifest, restores images
│   │   ├── main.jsx              # React entry point
│   │   ├── index.css             # Global styles, design tokens, Tailwind
│   │   ├── components/
│   │   │   ├── Library/
│   │   │   │   └── Library.jsx   # Snap-scroll story cards
│   │   │   ├── Detail/
│   │   │   │   └── Detail.jsx    # Story detail page (hero, metadata, CTA)
│   │   │   ├── Player/
│   │   │   │   ├── Player.jsx    # Main playback orchestrator
│   │   │   │   ├── Portrait.jsx  # Circular portrait with emotion glow + video
│   │   │   │   ├── Choices.jsx   # Choice buttons with countdown timer
│   │   │   │   ├── Background.jsx# Dual-layer crossfading backgrounds
│   │   │   │   ├── Waveform.jsx  # (unused / minimal)
│   │   │   │   └── ResumeModal.jsx # "Continue" or "Start over" prompt
│   │   │   ├── Creator/
│   │   │   │   ├── Creator.jsx   # Editor shell (~1500 lines), StorySettingsModal
│   │   │   │   ├── EditPanel.jsx # Right sidebar scene editor
│   │   │   │   ├── NodeGraph.jsx # SVG node graph with pan/zoom/drag
│   │   │   │   ├── CsvImporter.jsx         # CSV → story import
│   │   │   │   ├── ImageStudioModal.jsx    # AI image gen + local file pick
│   │   │   │   └── ImageInputWithGenerate.jsx # Thumbnail + input + sparkle btn
│   │   │   └── Nav/
│   │   │       └── Nav.jsx       # Bottom nav bar + settings modal
│   │   ├── engine/
│   │   │   ├── AudioEngine.js    # Singleton: narration, ambient, fades, ducking
│   │   │   ├── AudioStore.js     # IndexedDB for audio blobs
│   │   │   ├── ImageStore.js     # IndexedDB for image blobs
│   │   │   ├── ProjectFolderStore.js  # File System Access API handles
│   │   │   ├── ImageGen.js       # Google Imagen 4.0 API wrapper
│   │   │   ├── SmartShuffle.js   # Clip rotation without repeats
│   │   │   └── assetPath.js      # Resolves paths to BASE_URL
│   │   └── store/
│   │       └── index.js          # Zustand store (all app state)
│   ├── public/
│   │   └── stories/              # Story assets served statically
│   │       ├── manifest.json     # Auto-generated at build time by Vite plugin
│   │       ├── lighthouse/       # Demo story
│   │       └── the-black-door/   # Primary test story
│   ├── scripts/
│   │   └── deploy.cjs            # Copies dist/ → repo-root /murmur/
│   ├── vite.config.js            # Base: /murmur/, stories manifest plugin
│   └── package.json
├── assets/                       # Built JS/CSS (output of deploy)
├── stories/                      # Built story data (output of deploy)
├── index.html                    # Built entry point (output of deploy)
└── ref/                          # Reference docs (not deployed)
    ├── Murmur-DESIGN.md          # Original design spec (historical)
    ├── murmur_todo.md            # Active todo list
    └── the_black_door.csv        # Source CSV for test story
```

---

## Views & Navigation

The app has four views, controlled by `store.view`:

| View | Component | When |
|---|---|---|
| `library` | Library.jsx | Default. Horizontal snap-scroll story cards. |
| `detail` | Detail.jsx | Tap a story card. Shows metadata + "Begin Your Journey" CTA. |
| `player` | Player.jsx | Playing a story. Full-screen immersive audio experience. |
| `creator` | Creator.jsx | Editing a story. Node graph + scene editor. Creator mode only. |

**Nav bar** (Nav.jsx) appears at bottom of Library only. Contains:
- Library button (always)
- Edit / Create buttons (creator mode only)
- Settings gear (opens modal)

**Settings modal** has a hidden tab (tap invisible area next to "Settings" header) with:
- Creator Mode toggle — gates the entire editor, AI generation, TTS
- Show Hidden Stories toggle

---

## The Player (How Playback Works)

This is the core of the app. The flow:

1. **Launch**: `store.launchStory(story, sceneId)` loads the story, restores audio/image blobs from IndexedDB, creates a `SmartShuffle` instance per scene, and switches view to `player`.

2. **Scene plays**: `audioEngine.playScene(scene, clipSrc, callbacks)` fades out previous narration, ducks ambient, loads the new clip, and starts playback.

3. **Choice reveal**: The audio engine fires `onRevealChoices` when remaining time <= `scene.secondsBeforeEnd`. Choice buttons animate in with staggered delays.

4. **Default choice countdown**: If a scene has `defaultChoice` set, that button shows a gold countdown bar. If the timer expires, it auto-selects. Countdown pauses when audio is paused.

5. **Scene transition**: User picks a choice (or it auto-fires). If narration is still playing, the choice is *queued* — the transition waits for narration to end. Then: 240ms flash overlay → load next scene → fade out.

6. **Save state**: Every `goToScene()` writes `{ sceneId, history }` to localStorage. Returning later shows a ResumeModal.

### Player Components

- **Player.jsx** — orchestrator. Manages `isPlaying`, `paused`, `choicesRevealed`, `queuedChoice`, fallback timer (3s if audio fails to load).
- **Portrait.jsx** — 336px circle. Supports static images and video (.mp4/.webm). Video auto-pauses when narration pauses. Emotion-based colored border glow. Ripple rings animate outward when narration is playing. Pop scale animation on emotion change.
- **Choices.jsx** — staggered reveal. Default choice has countdown bar + auto-select. Pauses countdown when `paused` prop is true.
- **Background.jsx** — dual layers (A/B) crossfade between scenes. Supports CSS gradients or images. Radial vignette overlay on top.
- **ScrubBar** (inside Player.jsx) — timeline with playhead thumb, choice-reveal marker dot, time readout. Draggable for seeking.

### Audio Engine (engine/AudioEngine.js)

Singleton with three audio elements: `narrator`, `ambientIntro`, `ambientLoop`.

Key methods:
- `playScene(scene, clipSrc, { onPlayStarted, onRevealChoices, onNarrationEnd })`
- `startAmbient(ambient)` / `switchAmbient(ambient)` — intro plays once, then loop
- `pause()` / `resume()` / `seek(seconds)` / `stop()`
- `ramp(audioEl, fromVol, toVol, durationMs)` — smooth volume transitions via rAF

---

## The Creator (How Editing Works)

Creator mode is gated behind `store.creatorMode` (hidden toggle in settings).

### Layout
- **Left sidebar**: Story dropdown + scrollable scene list
- **Center**: NodeGraph — SVG canvas with draggable scene nodes and bezier edges
- **Right panel**: EditPanel — all fields for the selected scene
- **Header**: + Scene, Save to Project, Play, Story Settings, TTS, CSV Import buttons

### Key Editing Features

**Scene editing** (EditPanel.jsx):
- Title, emotion (10 states), background key (a/b/c/d), background image
- Script textarea (source text for TTS — not shown to player)
- Audio clips list (add/remove/play)
- Choices editor (text, target scene dropdown, mark as default, countdown seconds)

**Story Settings** (modal in Creator.jsx — `StorySettingsModal`):
- Project Folder (File System Access API)
- Title, Tagline, Description
- Narrator name + per-emotion portrait URLs
- Cover image, Default scene background image (with AI generation)
- Default timing for new scenes
- Hidden toggle

**Save to Project** (big async flow in Creator.jsx):
1. Gets/prompts for folder handle via File System Access API
2. Writes images from IndexedDB → `images/` folder (versioned filenames)
3. Rewrites blob URLs to disk paths in the JSON
4. Writes story JSON to root of project folder
5. Writes audio from IndexedDB → `audio/` folder
6. Syncs paths back to in-memory state

**Image Studio** (ImageStudioModal.jsx):
- Pick a local file OR generate with Google Imagen 4.0 API
- Local files already in the project folder are reused (not duplicated)
- AI-generated images get versioned filenames (never overwrite)
- Supports slots: cover, default-bg, scene/{id}, portrait/{emotion}

---

## Data Model

### Story Object

```javascript
{
  id: "the-black-door",           // Unique slug
  title: "The Black Door",
  tagline: "Short hook line",      // Italic subtitle on library card + detail
  description: "Full description", // Shown on detail page
  tags: ["horror", "lovecraftian"],
  coverImage: "the-black-door/images/cover.jpg",  // or blob: URL
  defaultBgImage: "the-black-door/images/bg.jpg",
  bg: "linear-gradient(...)",      // Fallback gradient for library card
  bgs: {                           // Named gradients scenes can reference
    a: "linear-gradient(...)",
    b: "linear-gradient(...)",
    c: "linear-gradient(...)",
    d: "linear-gradient(...)"
  },
  narrator: {
    name: "Gregory",
    emoji: "🎭",                   // Fallback if no portrait image
    portraits: {                   // One image/video per emotion
      default: "the-black-door/images/portraits/default.mp4",
      curious: "the-black-door/images/portraits/curious.jpg",
      // ... (10 emotion states)
    }
  },
  ambient: {                       // Story-wide ambient audio
    default: {
      intro: "the-black-door/audio/ambient-intro.mp3",
      loop: "the-black-door/audio/ambient-loop.mp3"
    }
  },
  duration: "~19 min",             // Display only
  paths: 1,                        // Display only
  startScene: "discovery",         // Entry point scene ID
  scenes: { /* see below */ },
  defaults: {                      // Defaults for new scenes in creator
    secondsBeforeEnd: 7,
    countdown: 6
  },
  hidden: false,                   // Hide from library
  updatedAt: 1713200000000         // Timestamp
}
```

### Scene Object

```javascript
{
  id: "discovery",
  title: "The Black Door",
  emotion: "curious",              // One of 10 emotion states
  bgKey: "a",                      // Key into story.bgs
  bgImage: null,                   // Overrides bgKey if set
  script: "Narration text...",     // TTS source (not shown to player)
  clips: [                         // Audio files, smart-shuffled
    "the-black-door/audio/the-black-door-gregory-discovery-a.mp3"
  ],
  secondsBeforeEnd: 7,             // Reveal choices N seconds before clip ends
  defaultChoice: 0,                // Index of auto-select choice (or null)
  countdown: 6,                    // Seconds before default fires
  choices: [
    { text: "Touch the door...", target: "first_touch" },
    { text: "Walk away...", target: "return_home" }
  ],
  ambient: null                    // Scene-specific override (same shape as story.ambient.default)
}
```

### 10 Emotion States

`default`, `curious`, `happy`, `sad`, `afraid`, `determined`, `unsettled`, `dissociated`, `hollow`, `controlled`

Each emotion maps to a distinct glow color on the portrait ring.

---

## Persistence Architecture

### localStorage
| Key | Value |
|---|---|
| `murmur_stories` | Full stories array (blob URLs stripped on save) |
| `murmur_{storyId}` | Save progress: `{ sceneId, history }` |
| `murmur_creator_mode` | `"1"` or `"0"` |
| `murmur_show_hidden` | `"1"` or `"0"` |
| `google_ai_api_key` | Google AI Studio API key |
| `elevenlabs_api_key` | ElevenLabs TTS API key |

### IndexedDB
| Database | Store | Key Format | Contents |
|---|---|---|---|
| `murmur_audio` | `clips` | `"{storyId}/{sceneId}"` | Audio blobs |
| `murmur_images` | `images` | `"{storyId}/{slot}"` | Image blobs |
| `murmur_project_folders` | `handles` | `"{storyId}"` | FileSystemDirectoryHandle |

### File System Access API
Used by "Save to Project" in the Creator. Stores the directory handle in IndexedDB so it persists across sessions. On save, writes:
- `{storyId}.json` — story data with paths (not blob URLs)
- `images/` — all image assets with versioned filenames
- `audio/` — all audio clips

---

## Asset Path Resolution (engine/assetPath.js)

All asset references (images, audio) go through `resolveAssetPath(p)`:

| Input | Output |
|---|---|
| `blob:...` | Pass through (in-memory) |
| `http://...` or `https://...` | Pass through |
| `data:...` | Pass through |
| `/stories/...` | `BASE_URL + "stories/..."` |
| `the-black-door/images/foo.jpg` | `BASE_URL + "stories/the-black-door/images/foo.jpg"` |

`BASE_URL` = `/` in dev, `/murmur/` in production.

---

## Build System

**Vite** with:
- React plugin
- Tailwind CSS plugin
- Custom `storiesManifestPlugin` — scans `public/stories/` at build time and generates `stories/manifest.json` listing all story IDs

**Deploy script** (`scripts/deploy.cjs`):
1. Cleans previous build artifacts in repo-root `/murmur/` (preserves `app/` and `ref/`)
2. Copies `dist/` output to `/murmur/`
3. Prints file count and next steps

**GitHub Pages** serves from the repo root. The built files land at `/murmur/index.html`, `/murmur/assets/`, `/murmur/stories/`, etc.

---

## Bootstrap Flow (App.jsx)

On app load:
1. Unregister old service workers (cleanup from portfolio)
2. Fetch `stories/manifest.json` to discover available stories
3. For each story in manifest, fetch its JSON and merge into the store
4. Restore image blobs from IndexedDB → blob URLs for all stories

---

## Design System

### Colors
```css
--bg:     #07070f    /* Main background */
--s1:     #0f0f1c    /* Surface 1 */
--s2:     #181828    /* Surface 2 */
--s3:     #222236    /* Surface 3 / borders */
--text:   #f0ede6    /* Primary text */
--sub:    #928faa    /* Secondary text */
--mute:   #484660    /* Muted text */
--gold:   #c9a96e    /* Primary accent (buttons, highlights) */
```

### Typography
- **Display / titles**: `EB Garamond` (italic serif) — story titles, choice text, taglines
- **UI / body**: `DM Sans` (sans-serif) — labels, metadata, buttons
- **Monospace / code**: `Public Sans` — fallback body

### Animation Tokens
- `--silk`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` — smooth easing
- `--spring`: `cubic-bezier(0.34, 1.56, 0.64, 1)` — bouncy/pop easing

### Naming Conventions
- Story IDs: `lowercase-with-hyphens` (e.g., `the-black-door`)
- Scene IDs: `lowercase_with_underscores` (e.g., `the_arrival`)
- Audio files: `{story-slug}-{narrator}-{scene-id}-{variant}.mp3`
- Image files: `{story-slug}-{type}.{ext}` (versioned: `-02`, `-03`, etc.)

---

## Common Tasks for AI Agents

### Adding a new field to stories
1. Add default value in `store/index.js` (demo stories + `Nav.jsx` new story template)
2. Add input in `Creator.jsx` `StorySettingsModal` (story-level) or `EditPanel.jsx` (scene-level)
3. Render it in the appropriate view component (Library, Detail, or Player)
4. Include it in `CsvImporter.jsx` if CSV-importable
5. Ensure it's preserved in the save/load cycle (localStorage serialization in store)

### Adding a new view/screen
1. Add the view name to the `view` state in `store/index.js`
2. Create component in `src/components/YourView/`
3. Render it conditionally in `App.jsx`
4. Add navigation trigger in `Nav.jsx` or wherever appropriate

### Modifying playback behavior
- Audio timing/fading: `engine/AudioEngine.js`
- Choice reveal timing: `Player.jsx` (the `onRevealChoices` callback)
- Countdown timer: `Choices.jsx` (`ChoiceButton` component)
- Portrait animation: `Portrait.jsx`

### Working with images
- Display: goes through `resolveAssetPath()` → `<img>` or CSS
- Storage: `ImageStore.js` (IndexedDB) for blobs, `ProjectFolderStore.js` for disk
- Generation: `ImageGen.js` → `ImageStudioModal.jsx`
- Selection: `ImageInputWithGenerate.jsx` (input) + `ImageStudioModal.jsx` (picker/generator)

### Build and deploy
```bash
cd murmur/app && npm run deploy
cd ../../.. && git add murmur && git commit -m "deploy murmur" && git push
```
