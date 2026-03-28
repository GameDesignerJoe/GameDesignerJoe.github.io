# Inkwell — Design Document
*A PWA for scanning handwritten notebooks into digital text using AI vision*

---

## Overview

Inkwell is a mobile-first Progressive Web App designed for a very specific workflow: a phone mounted overhead on a desk stand, scanning handwritten notebook pages one by one, with zero-touch automation. The user names a story, slides pages under the camera, and ends up with a clean transcription they can copy to clipboard.

**Core philosophy:** The scan session should feel like a darkroom — the app works quietly in the background, you just feed it pages.

---

## Tech Stack

- **Framework:** Vanilla HTML/CSS/JS, single-file structure (or minimal file count)
- **OCR Engine:** Claude Vision API (claude-sonnet-4-20250514) via `fetch` to `https://api.anthropic.com/v1/messages`
- **Camera:** `getUserMedia` with `facingMode: environment` (rear camera, high resolution)
- **Deployment:** Vercel / GitHub

---

## PWA Requirements

- `manifest.json` with:
  - `display: "fullscreen"` — no browser chrome
  - `orientation: "portrait"` — locked
  - App name: "Inkwell"
  - Theme color: dark (see UI section)
  - Icons at 192x192 and 512x512
- `service-worker.js` for offline shell caching (app loads without network; OCR calls still need connectivity)
- **Screen Wake Lock API** — request wake lock on session start so the phone never sleeps while mounted

---

## App Flow

### 1. Home Screen
- App name and a single prompt: **"Story title:"** with a text input
- A **"Start Scanning"** button — disabled until a title is entered
- No other UI clutter

### 2. Scan View (default after starting)
- Full-screen live camera feed (rear camera, portrait)
- A **crop guide overlay** — a white-bordered rectangle showing the capture zone (slightly inset from screen edges). This tells the user where to position pages.
- A **status pill** at the top center — cycling through states:
  - `Waiting for page…` (dim, neutral)
  - `Page detected` (brightens)
  - `Scanning…` (animated pulse)
  - `✓ Done` (brief green flash, then back to Waiting)
- A **page counter** in the top corner: `Pages: 4`
- No other controls visible during scanning. The UI should feel like a viewfinder.

### 3. Text View (swipe left/right to toggle)
- Story title at top
- Scrollable transcript area
- Each page separated by a faint horizontal rule and a small label: `— Page 1 —`
- **"Copy All"** button pinned at the bottom — taps copies the full transcript to clipboard, shows a brief "Copied!" confirmation
- **"New Story"** button — prompts confirmation, then returns to Home Screen (clears current transcript)

---

## Navigation

- **Swipe left/right** to toggle between Scan View and Text View
- A subtle **swipe indicator** — two small dots at the bottom (like a carousel), showing which view is active
- The swipe gesture should feel native and responsive (CSS `transform` + touch events, not a library)

---

## Auto-Capture Logic

The app runs a continuous camera analysis loop using a hidden `<canvas>` element. No user interaction required after session start.

### Stage 1: Change Detection
- Sample a frame every **500ms**
- Compare to the last *captured* frame using pixel diff (downsample to ~100x100 for performance)
- If diff exceeds **15% of pixels**, flag as "new page present"

### Stage 2: Stillness Detection
- Once a new page is flagged, monitor for movement using frame-to-frame diff
- If **two consecutive 250ms samples are < 2% different**, the page is considered still
- Trigger capture

### Capture Sequence
1. Grab full-resolution frame from video feed
2. Apply basic contrast enhancement (stretch histogram slightly to help with pencil)
3. Convert to JPEG base64
4. Status pill → `Scanning…`
5. Send to Claude Vision API
6. Append result to transcript
7. Status pill → `✓ Done` (500ms)
8. Play beep sound + screen flash (see Feedback section)
9. Update last-captured frame reference
10. Status pill → `Waiting for page…`

### Edge Cases
- If Claude API returns an error or empty string: status pill shows `⚠ Retry?` with a small manual retry button. Do not lose the page.
- Debounce: don't allow another capture within **3 seconds** of the last one (prevents double-firing)

---

## Claude Vision API Call

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64ImageData
            }
          },
          {
            type: "text",
            text: "This is a page from a handwritten notebook. Please transcribe all the handwritten text exactly as written, preserving paragraph breaks. Do not add any commentary, headings, or formatting — just the raw transcribed text. If a word is unclear, make your best guess and continue."
          }
        ]
      }
    ]
  })
});

const data = await response.json();
const transcribedText = data.content[0].text;
```

---

## Feedback on Successful Scan

### Visual Flash
- The crop guide overlay briefly flashes **bright green** (opacity pulse, ~300ms)
- The status pill shows `✓ Done` in green

### Audible Beep
- Use the Web Audio API to generate a short, clean tone — no audio file dependency
- A simple sine wave at ~880Hz for 80ms, gentle attack/release envelope
- Volume should be moderate — audible from arm's length but not jarring

```javascript
function playBeep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}
```

---

## Visual Design

**Aesthetic:** Utilitarian darkroom. Dark UI so the camera feed is the hero. Minimal chrome. Everything in service of the scanning workflow.

**Color Palette:**
- Background: `#0d0d0d`
- Surface: `#1a1a1a`
- Crop guide border: `rgba(255, 255, 255, 0.5)` — white, slightly transparent
- Status pill: `#222` background, `#aaa` text (neutral) / `#4ade80` (success) / `#facc15` (processing)
- Accent: `#f5f0e8` — warm off-white, used for story title and primary text
- Scan flash: `rgba(74, 222, 128, 0.4)` — green overlay pulse

**Typography:**
- UI labels (status pill, page counter): `IBM Plex Mono` — monospace feels technical/scanner-appropriate
- Story title and transcript body: `Lora` — a warm serif that feels like paper and ink

**Crop Guide:**
- Rounded corners (`border-radius: 12px`)
- Corner accent marks (small L-shaped brackets at each corner, like a photo crop tool)
- Subtle animated border on "Page detected" state (slow pulse glow)

---

## File Structure

```
inkwell/
├── index.html          ← entire app (single file preferred, or minimal split)
├── manifest.json
├── service-worker.js
├── icon-192.png
├── icon-512.png
└── README.md
```

---

## API Key Handling

For local/personal use, the API key can be stored in `localStorage` and entered via a settings gear icon (hidden in the corner of the Home Screen). On first launch, prompt for key entry. This avoids hardcoding the key and keeps it out of the repo.

---

## Out of Scope for v1

- Google Docs API integration (manual copy/paste for now)
- Voice trigger ("scan" command)
- Multi-page story management / history
- Image preprocessing beyond basic contrast
- Offline OCR
- Android/iOS app wrapping

---

## Success Criteria

A successful v1 lets the user:
1. Open the PWA on their phone
2. Enter a story title
3. Mount the phone, slide pages under it
4. Walk away with a full transcript after the last page
5. Copy the text and paste it into Google Docs

The scan-to-transcription loop should feel **automatic and invisible**.
