# Inkwell — Design Document
*A PWA for scanning handwritten notebooks into digital text using AI vision*

---

## Overview

Inkwell is a Progressive Web App for transcribing handwritten pages into digital text using AI vision APIs. It works on both mobile (phone mounted on a desk stand) and desktop (webcam or document camera). The user points the camera at a page, taps Scan, and gets a clean transcription they can copy, save, or build up across multiple pages.

**Core philosophy:** The scan session should feel like a darkroom — the app works quietly, you just feed it pages.

---

## Tech Stack

- **Framework:** Vanilla HTML/CSS/JS, ES modules (no build step, no bundler)
- **OCR Providers:** Pluggable — supports Claude, Gemini, and Google Cloud Vision via server-side API routes
- **Camera:** `getUserMedia` with rear-camera preference, 1920x1080 ideal, zoom locked to 1x
- **Deployment:** Vercel (serverless API routes) / GitHub Pages (static shell)

---

## PWA Requirements

- `manifest.json` with:
  - `display: "fullscreen"` — no browser chrome
  - `orientation: "portrait"` — locked
  - App name: "Inkwell"
  - Theme color: `#0d0d0d`
  - Icons at 192x192 and 512x512
- `service-worker.js` for offline shell caching (app loads without network; OCR calls still need connectivity)
- **Screen Wake Lock API** — keeps the screen on during scanning sessions

---

## File Structure

```
inkwell/
├── index.html
├── manifest.json
├── service-worker.js
├── icon-192.png
├── icon-512.png
├── css/
│   └── styles.css
├── js/
│   ├── app.js           ← Entry point, init, navigation, event wiring
│   ├── camera.js         ← getUserMedia, zoom lock, autofocus, refocus
│   ├── capture.js        ← Scan logic: crop, canvas capture, contrast, API call
│   ├── api.js            ← Fetch to server-side transcription endpoints
│   ├── transcript.js     ← Page array, render, view saved entries
│   ├── ui.js             ← Status pill, page counter, error bar
│   ├── feedback.js       ← Beep (Web Audio) and green flash
│   ├── library.js        ← Save/load/delete transcripts in localStorage
│   └── settings.js       ← API key + provider management, settings modal
├── api/                  ← Vercel serverless functions
│   ├── transcribe.js     ← Claude Vision endpoint
│   ├── transcribe-gemini.js
│   └── transcribe-gcv.js
└── design/
    └── Inkwell-DESIGN.md
```

---

## App Flow

### Boot
- Camera starts immediately on load
- If no API key is stored, the settings modal opens automatically
- Wake lock is requested to prevent screen sleep

### Navigation
Three views accessible via tab bar or swipe (mobile):
1. **Scan** — camera feed + scan button
2. **Text** — accumulated transcript
3. **Library** — saved transcripts

On desktop (>=900px), Scan and Text are shown side-by-side. Library overlays both when active.

---

## Scan View

- Live camera feed filling the viewport (`object-fit: cover`)
- **Crop guide overlay** — white-bordered rounded rectangle with corner brackets showing the capture zone
- **Status pill** at top center cycling through: Ready, Scanning, Done, Error
- **Page counter** in top corner with a **+ New Doc** button
- **Scan button** — large circular button at bottom center; animates during scan
- **Rescan button** — appears after first page; removes last page and re-scans
- Tapping the camera feed triggers a refocus cycle

### Scan Process
1. User taps **Scan**
2. Crop guide bounds are mapped from screen space to video pixel space (accounting for `object-fit: cover` scaling)
3. Cropped region is drawn to an off-screen canvas
4. Basic contrast enhancement (histogram stretch) is applied
5. Canvas is converted to JPEG base64
6. Image is sent to the selected OCR provider via server-side API route
7. On success: text is appended to transcript, beep plays, crop guide flashes green
8. On error: error bar appears with Retry and Skip options

### Feedback
- **Visual:** Green flash overlay on crop guide (~300ms)
- **Audio:** 880Hz sine wave beep via Web Audio API (~100ms, gentle envelope)
- **Mobile toast:** Brief preview of scanned text overlays the scan view (auto-dismisses after 4s)

---

## Text View

- Scrollable transcript area with page dividers (`— Page 1 —`)
- Text rendered with `white-space: pre-wrap` preserving original line breaks
- **Copy All** — copies full transcript to clipboard
- **Save** — opens modal to name and save to library
- **Clear** — clears current transcript (with confirmation)
- Also supports viewing saved entries from the library (with a "Back to scan" banner)

---

## Library View

- List of saved transcripts (name, date, page count)
- Each entry has: **View** (loads into Text view), **Copy**, **Delete**
- Data stored in `localStorage` as JSON array

---

## Settings

- Accessed via gear icon in top bar
- **OCR Provider selector:** Claude / Gemini / Google Cloud Vision (tab-style toggle)
- Per-provider API key input (stored in `localStorage` under `inkwell_api_keys`)
- Keys are sent to server-side API routes (not called client-side)

---

## API Architecture

Client sends `{ image: base64, apiKey: key }` to server-side endpoints:
- `/api/transcribe` — Claude Vision
- `/api/transcribe-gemini` — Gemini
- `/api/transcribe-gcv` — Google Cloud Vision

Server-side routes handle the provider-specific API call and return `{ text }` or `{ error }`.

---

## Visual Design

**Aesthetic:** Utilitarian darkroom. Dark UI so the camera feed is the hero.

**Color Palette:**
- Background: `#0d0d0d`
- Surface: `#1a1a1a`
- Crop guide border: `rgba(255, 255, 255, 0.5)`
- Status pill: `#222` bg, `#aaa` text (neutral) / `#4ade80` (success) / `#facc15` (processing) / `#f87171` (error)
- Accent: `#f5f0e8` — warm off-white for primary text and buttons
- Scan flash: `rgba(74, 222, 128, 0.4)`

**Typography:**
- UI labels: `IBM Plex Mono` — monospace, technical feel
- Transcript body: `Lora` — warm serif, feels like paper and ink

**Layout:**
- Mobile: 3-view horizontal carousel with swipe + CSS `translateX` transitions
- Desktop: CSS Grid `1fr 1fr` side-by-side (scan | text), library overlays full width

---

## Key Technical Details

- **Camera zoom lock:** On start, applies `zoom: min` constraint to prevent digital zoom
- **Autofocus:** Continuous autofocus enabled; tap-to-refocus cycles manual→continuous
- **Object-fit mapping:** Crop guide screen coordinates are mapped to video pixel space accounting for `object-fit: cover` scaling and cropping
- **Contrast enhancement:** Histogram stretch with 5% tail clipping to improve pencil/ink legibility
- **Overflow containment:** View screens use `overflow: hidden` to prevent content from expanding the layout; transcript body clips horizontal overflow

---

## Out of Scope

- Auto-capture (change detection / stillness detection) — removed in favor of manual Scan button
- Google Docs API integration (manual copy/paste)
- Voice trigger
- Offline OCR
- Native app wrapping
