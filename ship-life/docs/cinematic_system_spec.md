# Ship Life: Cinematic System Implementation Guide

## Overview

This document specifies a **PowerPoint-style cinematic system** for Ship Life that supports narrative sequences with backgrounds, portraits, dialogue, and text overlays. The system is **data-driven via JSON files** and integrates seamlessly with the existing mission and room systems.

---

## Core Principles

1. **Timeline-Based**: Events trigger at relative delays (hybrid approach with duration support)
2. **Layer Architecture**: Visual elements organized in z-index layers for predictable rendering
3. **Implicit Replacement**: New elements automatically replace old elements on the same layer
4. **Data-Driven**: All scenes defined in JSON - zero code changes for new cinematics
5. **Skip Support**: Players can skip cinematics, but important state changes still occur

---

## File Structure

```
/ship-life/
├── /data/
│   └── scenes.json          # All cinematic definitions
├── /js/
│   └── cinematics.js        # NEW: Cinematic player system
├── /css/
│   └── cinematics.css       # NEW: Cinematic styling
└── /assets/
    └── /scenes/             # Background images for scenes
```

---

## JSON Scene Format

### Complete Scene Structure

```json
{
  "scenes": [
    {
      "scene_id": "mission_1_intro",
      "default_fade_duration": 1.0,
      "events": [
        {
          "delay": 0.0,
          "type": "background",
          "action": "fade_in",
          "color": "black",
          "duration": 0.5
        },
        {
          "delay": 1.5,
          "type": "narrator",
          "action": "fade_in",
          "text": "In a galaxy, far far away...",
          "align": "center",
          "size": "large",
          "style": "italic",
          "duration": 3.0
        },
        {
          "delay": 2.5,
          "type": "narrator",
          "action": "fade_out",
          "duration": 1.5
        },
        {
          "delay": 1.0,
          "type": "background",
          "action": "fade_in",
          "asset": "starship_bridge.jpg",
          "duration": 2.0
        },
        {
          "delay": 1.0,
          "type": "caption",
          "action": "fade_in",
          "text": "Star date: 39320",
          "size": "small",
          "duration": 3.0
        },
        {
          "delay": 2.5,
          "type": "caption",
          "action": "fade_out",
          "duration": 1.0
        },
        {
          "delay": 0.5,
          "type": "portrait",
          "action": "slide_in",
          "character": "stella",
          "side": "left",
          "duration": 0.5
        },
        {
          "delay": 0.3,
          "type": "dialogue",
          "action": "show",
          "character": "stella",
          "text": "All systems ready. Let's move out.",
          "duration": 0.0
        },
        {
          "delay": 3.0,
          "type": "all",
          "action": "fade_out",
          "duration": 1.5
        }
      ]
    }
  ]
}
```

### Timing System

- **`delay`**: Time in seconds to wait AFTER the previous event started (relative timing)
- **`duration`**: How long this action takes to complete
  - `0.0` = persist indefinitely until explicitly cleared or replaced
  - `> 0` = action completes after X seconds
- **First event's delay is from scene start**

**Example Timeline:**
```
0.0s  → Background fade starts (takes 0.5s)
1.5s  → Narrator fade starts (takes 3.0s)
4.0s  → Narrator fade out starts (takes 1.5s)
5.5s  → New background fade starts
```

---

## Element Specifications

### Layer Order (Back to Front)

1. **background** - Images or solid colors
2. **caption** - Bottom-left context text
3. **narrator** - Center-screen narrative text
4. **portrait_left** - Character portrait on left side
5. **portrait_right** - Character portrait on right side
6. **dialogue** - Character dialogue box (center-bottom)
7. **effects** - Future: visual effects layer

### Element Type: `background`

**Supports:** Images or solid colors

```json
{
  "type": "background",
  "action": "fade_in",
  "asset": "space_station_exterior.jpg",
  "duration": 2.0
}
```

```json
{
  "type": "background",
  "action": "fade_in",
  "color": "black",
  "duration": 1.0
}
```

**Actions:**
- `fade_in` - Fade from transparent to opaque
- `fade_out` - Fade to transparent
- `cut_in` - Appear instantly

**Color Shortcuts:**
- `"black"` → `#000000`
- `"white"` → `#FFFFFF`
- `"space_blue"` → `#0a1128` (or your theme color)
- `"deep_space"` → `#05080f`
- Hex codes: `"#1a2332"`

**Asset Path:** `assets/scenes/{asset}` (relative to project root)

---

### Element Type: `caption`

**Purpose:** Location/time context text (bottom-left)

```json
{
  "type": "caption",
  "action": "fade_in",
  "text": "Star date: 39320\nAboard the Starship Destiny",
  "size": "normal",
  "style": "normal",
  "duration": 3.0
}
```

**Actions:**
- `fade_in` - Fade in text
- `fade_out` - Fade out text
- `show` - Appear instantly
- `hide` - Disappear instantly

**Text Options:**
- `size`: `"small"` | `"normal"` | `"large"` (default: `"normal"`)
- `style`: `"normal"` | `"italic"` | `"bold"` (default: `"normal"`)
- Supports `\n` for line breaks

**CSS Position:**
- Bottom-left corner
- 20px padding from edges
- Semi-transparent background

---

### Element Type: `narrator`

**Purpose:** Center-screen narrative text (like opening crawls)

```json
{
  "type": "narrator",
  "action": "fade_in",
  "text": "In a galaxy, far far away...",
  "align": "center",
  "size": "large",
  "style": "italic",
  "duration": 4.0
}
```

**Actions:**
- `fade_in` - Fade in text
- `fade_out` - Fade out text
- `show` - Appear instantly
- `hide` - Disappear instantly

**Text Options:**
- `align`: `"left"` | `"center"` | `"right"` | `"justify"` (default: `"center"`)
- `size`: `"small"` | `"normal"` | `"large"` (default: `"normal"`)
- `style`: `"normal"` | `"italic"` | `"bold"` (default: `"normal"`)
- Supports `\n` for multi-line text

**CSS Position:**
- Vertically and horizontally centered
- Max width: 70% of screen

---

### Element Type: `portrait`

**Purpose:** Character portraits sliding in from sides

```json
{
  "type": "portrait",
  "action": "slide_in",
  "character": "stella",
  "side": "left",
  "duration": 0.5
}
```

**Actions:**
- `slide_in` - Slide from off-screen (requires `side`)
- `slide_out` - Slide off-screen
- `fade_in` - Fade in at position
- `fade_out` - Fade out
- `cut_in` - Appear instantly

**Parameters:**
- `character`: Guardian ID (must match `guardians.json`)
- `side`: `"left"` | `"right"` (required for slide actions)

**Portrait Source:**
- Uses guardian's `portrait.value` from `guardians.json`
- Falls back to guardian name if no portrait available

**CSS Positioning:**
- Left side: 10% from left edge
- Right side: 10% from right edge
- Vertically: 20% from bottom
- Size: 300px wide (adjust as needed)

---

### Element Type: `dialogue`

**Purpose:** Character speech with name display

```json
{
  "type": "dialogue",
  "action": "show",
  "character": "stella",
  "text": "Ready for launch, team?",
  "duration": 0.0
}
```

**Actions:**
- `show` - Display dialogue box
- `hide` - Hide dialogue box

**Parameters:**
- `character`: Guardian ID (for name display)
- `text`: Dialogue content
- `duration`: `0.0` = persist until replaced/cleared

**Visual Design:**
- Center-bottom of screen
- Semi-transparent background
- Character name in header
- Standard dialogue box styling (reuse existing UI patterns)

---

### Element Type: `all`

**Purpose:** Clear or fade out all elements simultaneously

```json
{
  "type": "all",
  "action": "fade_out",
  "duration": 1.5
}
```

**Actions:**
- `fade_out` - Fade all elements out together
- `clear` - Instantly remove all elements

---

## Integration Points

### Triggering Scenes from Missions

**In `missions.json`:**

```json
{
  "mission_id": "mission_1",
  "name": "First Contact",
  "intro_scene": "mission_1_intro",
  "outro_scene": "mission_1_complete",
  "outro_scene_success": "mission_1_success",
  "outro_scene_failure": "mission_1_failure"
}
```

**Fields:**
- `intro_scene` (optional): Scene ID to play when mission is launched
- `outro_scene` (optional): Scene ID to play after mission results (success or failure)
- `outro_scene_success` (optional): Scene ID to play only on success
- `outro_scene_failure` (optional): Scene ID to play only on failure

**Priority Logic:**
- If success: Use `outro_scene_success` if present, else `outro_scene`
- If failure: Use `outro_scene_failure` if present, else `outro_scene`

### Calling Cinematics from Code

**From Mission Launch:**

```javascript
// In missions.js - launchMission()
async function launchMission(mission, gameState) {
    // Check for intro scene
    if (mission.intro_scene) {
        await playCinematic(mission.intro_scene);
    }
    
    // Continue with normal mission flow
    // ... existing planetfall portal code
}
```

**From Mission Results:**

```javascript
// In missions.js - dismissResults()
async function dismissResults(mission, success, gameState) {
    // Determine which outro scene to play
    let sceneId = null;
    if (success && mission.outro_scene_success) {
        sceneId = mission.outro_scene_success;
    } else if (!success && mission.outro_scene_failure) {
        sceneId = mission.outro_scene_failure;
    } else if (mission.outro_scene) {
        sceneId = mission.outro_scene;
    }
    
    // Play scene if defined
    if (sceneId) {
        await playCinematic(sceneId);
    }
    
    // Continue with normal flow
    // ... existing mission completion code
}
```

**Manual Trigger:**

```javascript
// Can be called from any room/system
await playCinematic('cutscene_id');
```

---

## Technical Implementation

### File: `cinematics.js`

```javascript
// Ship Life - Cinematic System

let scenesData = null;
let cinematicState = {
    isPlaying: false,
    currentScene: null,
    eventQueue: [],
    elapsedTime: 0,
    elements: {
        background: null,
        caption: null,
        narrator: null,
        portrait_left: null,
        portrait_right: null,
        dialogue: null
    },
    skipRequested: false
};

/**
 * Load scenes data
 */
async function loadScenes() {
    if (!scenesData) {
        const response = await fetch('data/scenes.json');
        scenesData = await response.json();
    }
    return scenesData;
}

/**
 * Play a cinematic scene
 */
async function playCinematic(sceneId) {
    const data = await loadScenes();
    const scene = data.scenes.find(s => s.scene_id === sceneId);
    
    if (!scene) {
        console.error(`Scene not found: ${sceneId}`);
        return;
    }
    
    console.log(`Playing cinematic: ${sceneId}`);
    
    // Lock navigation
    lockNavigation();
    
    // Show cinematic container
    const container = createCinematicContainer();
    
    // Initialize state
    cinematicState.isPlaying = true;
    cinematicState.currentScene = scene;
    cinematicState.skipRequested = false;
    cinematicState.eventQueue = buildEventQueue(scene.events);
    cinematicState.elapsedTime = 0;
    
    // Play the scene
    await playSceneTimeline(scene, container);
    
    // Cleanup
    removeCinematicContainer(container);
    unlockNavigation();
    cinematicState.isPlaying = false;
    
    console.log(`Cinematic complete: ${sceneId}`);
}

/**
 * Build event queue with absolute timestamps
 */
function buildEventQueue(events) {
    const queue = [];
    let absoluteTime = 0;
    
    events.forEach(event => {
        absoluteTime += event.delay;
        queue.push({
            ...event,
            triggerTime: absoluteTime
        });
    });
    
    return queue;
}

/**
 * Play scene timeline
 */
async function playSceneTimeline(scene, container) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        function tick() {
            if (cinematicState.skipRequested) {
                // Fast-forward: apply all remaining events instantly
                fastForwardScene(container);
                resolve();
                return;
            }
            
            const elapsed = (Date.now() - startTime) / 1000;
            cinematicState.elapsedTime = elapsed;
            
            // Process events that should trigger now
            while (cinematicState.eventQueue.length > 0) {
                const nextEvent = cinematicState.eventQueue[0];
                
                if (nextEvent.triggerTime <= elapsed) {
                    cinematicState.eventQueue.shift();
                    processEvent(nextEvent, container);
                } else {
                    break;
                }
            }
            
            // Continue or finish
            if (cinematicState.eventQueue.length > 0) {
                requestAnimationFrame(tick);
            } else {
                // Check if any animations are still running
                const hasActiveAnimations = checkActiveAnimations(container);
                if (hasActiveAnimations) {
                    requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            }
        }
        
        tick();
    });
}

/**
 * Process a single event
 */
function processEvent(event, container) {
    console.log(`[Cinematic] Event: ${event.type} - ${event.action}`);
    
    switch (event.type) {
        case 'background':
            processBackgroundEvent(event, container);
            break;
        case 'caption':
            processCaptionEvent(event, container);
            break;
        case 'narrator':
            processNarratorEvent(event, container);
            break;
        case 'portrait':
            processPortraitEvent(event, container);
            break;
        case 'dialogue':
            processDialogueEvent(event, container);
            break;
        case 'all':
            processAllEvent(event, container);
            break;
        default:
            console.warn(`Unknown event type: ${event.type}`);
    }
}

/**
 * Process background event
 */
function processBackgroundEvent(event, container) {
    const layer = container.querySelector('.cinematic-background');
    
    if (event.action === 'fade_in' || event.action === 'cut_in') {
        // Set background
        if (event.asset) {
            layer.style.backgroundImage = `url('assets/scenes/${event.asset}')`;
        } else if (event.color) {
            layer.style.backgroundColor = resolveColor(event.color);
            layer.style.backgroundImage = 'none';
        }
        
        if (event.action === 'fade_in') {
            fadeIn(layer, event.duration);
        } else {
            layer.style.opacity = '1';
        }
    } else if (event.action === 'fade_out') {
        fadeOut(layer, event.duration);
    }
}

/**
 * Process caption event
 */
function processCaptionEvent(event, container) {
    const layer = container.querySelector('.cinematic-caption');
    
    if (event.action === 'fade_in' || event.action === 'show') {
        layer.textContent = event.text;
        layer.className = 'cinematic-caption';
        
        if (event.size) layer.classList.add(`size-${event.size}`);
        if (event.style) layer.classList.add(`style-${event.style}`);
        
        if (event.action === 'fade_in') {
            fadeIn(layer, event.duration);
        } else {
            layer.style.opacity = '1';
        }
    } else if (event.action === 'fade_out') {
        fadeOut(layer, event.duration, () => layer.textContent = '');
    } else if (event.action === 'hide') {
        layer.style.opacity = '0';
        layer.textContent = '';
    }
}

/**
 * Process narrator event
 */
function processNarratorEvent(event, container) {
    const layer = container.querySelector('.cinematic-narrator');
    
    if (event.action === 'fade_in' || event.action === 'show') {
        layer.textContent = event.text;
        layer.className = 'cinematic-narrator';
        
        if (event.align) layer.style.textAlign = event.align;
        if (event.size) layer.classList.add(`size-${event.size}`);
        if (event.style) layer.classList.add(`style-${event.style}`);
        
        if (event.action === 'fade_in') {
            fadeIn(layer, event.duration);
        } else {
            layer.style.opacity = '1';
        }
    } else if (event.action === 'fade_out') {
        fadeOut(layer, event.duration, () => layer.textContent = '');
    } else if (event.action === 'hide') {
        layer.style.opacity = '0';
        layer.textContent = '';
    }
}

/**
 * Process portrait event
 */
function processPortraitEvent(event, container) {
    const layerClass = event.side === 'left' ? '.cinematic-portrait-left' : '.cinematic-portrait-right';
    const layer = container.querySelector(layerClass);
    
    if (event.action === 'slide_in' || event.action === 'fade_in' || event.action === 'cut_in') {
        // Get guardian portrait
        const guardian = getGuardianById(event.character);
        if (guardian && guardian.portrait) {
            renderVisual(guardian.portrait, layer);
        } else {
            layer.textContent = event.character;
        }
        
        if (event.action === 'slide_in') {
            slideIn(layer, event.side, event.duration);
        } else if (event.action === 'fade_in') {
            fadeIn(layer, event.duration);
        } else {
            layer.style.opacity = '1';
            layer.style.transform = 'translateX(0)';
        }
    } else if (event.action === 'slide_out') {
        slideOut(layer, event.side, event.duration, () => layer.innerHTML = '');
    } else if (event.action === 'fade_out') {
        fadeOut(layer, event.duration, () => layer.innerHTML = '');
    }
}

/**
 * Process dialogue event
 */
function processDialogueEvent(event, container) {
    const layer = container.querySelector('.cinematic-dialogue');
    
    if (event.action === 'show') {
        const guardian = getGuardianById(event.character);
        const characterName = guardian ? guardian.name : event.character;
        
        layer.innerHTML = `
            <div class="dialogue-name">${characterName}</div>
            <div class="dialogue-text">${event.text}</div>
        `;
        
        fadeIn(layer, 0.3);
    } else if (event.action === 'hide') {
        fadeOut(layer, 0.3, () => layer.innerHTML = '');
    }
}

/**
 * Process "all" event (clear/fade all elements)
 */
function processAllEvent(event, container) {
    const layers = [
        '.cinematic-background',
        '.cinematic-caption',
        '.cinematic-narrator',
        '.cinematic-portrait-left',
        '.cinematic-portrait-right',
        '.cinematic-dialogue'
    ];
    
    layers.forEach(selector => {
        const layer = container.querySelector(selector);
        if (event.action === 'fade_out') {
            fadeOut(layer, event.duration, () => {
                if (selector !== '.cinematic-background') {
                    layer.innerHTML = '';
                    layer.textContent = '';
                }
            });
        } else if (event.action === 'clear') {
            layer.style.opacity = '0';
            if (selector !== '.cinematic-background') {
                layer.innerHTML = '';
                layer.textContent = '';
            }
        }
    });
}

/**
 * Fast-forward scene (skip functionality)
 */
function fastForwardScene(container) {
    // Apply all remaining events instantly
    cinematicState.eventQueue.forEach(event => {
        // Set duration to 0 for instant application
        event.duration = 0;
        processEvent(event, container);
    });
    
    cinematicState.eventQueue = [];
}

/**
 * Create cinematic container
 */
function createCinematicContainer() {
    const container = document.createElement('div');
    container.id = 'cinematic-container';
    container.className = 'cinematic-container';
    
    container.innerHTML = `
        <div class="cinematic-background"></div>
        <div class="cinematic-caption"></div>
        <div class="cinematic-narrator"></div>
        <div class="cinematic-portrait-left"></div>
        <div class="cinematic-portrait-right"></div>
        <div class="cinematic-dialogue"></div>
        <button class="cinematic-skip">Skip</button>
    `;
    
    // Wire skip button
    const skipBtn = container.querySelector('.cinematic-skip');
    skipBtn.onclick = () => {
        cinematicState.skipRequested = true;
    };
    
    document.body.appendChild(container);
    return container;
}

/**
 * Remove cinematic container
 */
function removeCinematicContainer(container) {
    if (container && container.parentNode) {
        container.parentNode.removeChild(container);
    }
}

/**
 * Check if any animations are still running
 */
function checkActiveAnimations(container) {
    const layers = container.querySelectorAll('[style*="transition"]');
    // Simplified: assume animations complete based on duration
    // Could be enhanced with transitionend listeners
    return false;
}

/**
 * Resolve color shortcuts
 */
function resolveColor(color) {
    const colorMap = {
        'black': '#000000',
        'white': '#FFFFFF',
        'space_blue': '#0a1128',
        'deep_space': '#05080f'
    };
    
    return colorMap[color] || color;
}

/**
 * Animation utilities
 */
function fadeIn(element, duration) {
    element.style.transition = `opacity ${duration}s ease-in-out`;
    element.style.opacity = '0';
    
    requestAnimationFrame(() => {
        element.style.opacity = '1';
    });
}

function fadeOut(element, duration, callback) {
    element.style.transition = `opacity ${duration}s ease-in-out`;
    element.style.opacity = '1';
    
    requestAnimationFrame(() => {
        element.style.opacity = '0';
    });
    
    if (callback) {
        setTimeout(callback, duration * 1000);
    }
}

function slideIn(element, side, duration) {
    const startPos = side === 'left' ? '-100%' : '100%';
    element.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;
    element.style.transform = `translateX(${startPos})`;
    element.style.opacity = '0';
    
    requestAnimationFrame(() => {
        element.style.transform = 'translateX(0)';
        element.style.opacity = '1';
    });
}

function slideOut(element, side, duration, callback) {
    const endPos = side === 'left' ? '-100%' : '100%';
    element.style.transition = `transform ${duration}s ease-in, opacity ${duration}s ease-in`;
    element.style.transform = 'translateX(0)';
    element.style.opacity = '1';
    
    requestAnimationFrame(() => {
        element.style.transform = `translateX(${endPos})`;
        element.style.opacity = '0';
    });
    
    if (callback) {
        setTimeout(callback, duration * 1000);
    }
}

console.log('Cinematic system loaded.');
```

---

### File: `cinematics.css`

```css
/* Cinematic System Styles */

.cinematic-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    overflow: hidden;
}

/* Background Layer */
.cinematic-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0;
    z-index: 1;
}

/* Caption Layer (bottom-left) */
.cinematic-caption {
    position: absolute;
    bottom: 20px;
    left: 20px;
    max-width: 400px;
    padding: 15px 20px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-secondary);
    opacity: 0;
    z-index: 2;
    white-space: pre-line;
}

/* Narrator Layer (center) */
.cinematic-narrator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 70%;
    padding: 30px;
    color: var(--text);
    font-family: var(--font-secondary);
    text-align: center;
    opacity: 0;
    z-index: 3;
    white-space: pre-line;
}

/* Portrait Layers */
.cinematic-portrait-left,
.cinematic-portrait-right {
    position: absolute;
    bottom: 20%;
    width: 300px;
    height: 400px;
    opacity: 0;
    z-index: 4;
}

.cinematic-portrait-left {
    left: 10%;
}

.cinematic-portrait-right {
    right: 10%;
}

/* Dialogue Layer */
.cinematic-dialogue {
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 800px;
    width: 90%;
    padding: 20px 30px;
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid var(--primary);
    border-radius: 12px;
    opacity: 0;
    z-index: 5;
}

.dialogue-name {
    font-family: var(--font-primary);
    font-size: 18px;
    font-weight: 600;
    color: var(--primary);
    margin-bottom: 8px;
}

.dialogue-text {
    font-family: var(--font-secondary);
    font-size: 16px;
    color: var(--text);
    line-height: 1.6;
}

/* Skip Button */
.cinematic-skip {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    color: white;
    font-family: var(--font-secondary);
    font-size: 14px;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
}

.cinematic-skip:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
}

/* Text Size Variants */
.size-small {
    font-size: 14px;
}

.size-normal {
    font-size: 16px;
}

.size-large {
    font-size: 24px;
}

/* Text Style Variants */
.style-normal {
    font-style: normal;
    font-weight: 400;
}

.style-italic {
    font-style: italic;
}

.style-bold {
    font-weight: 600;
}
```

---

## Integration Checklist

### Step 1: Add Files

- [ ] Create `data/scenes.json` with example scenes
- [ ] Create `js/cinematics.js`
- [ ] Create `css/cinematics.css`
- [ ] Create `assets/scenes/` folder for backgrounds

### Step 2: Update HTML

**In `game.html`:**

```html
<!-- Add to CSS imports -->
<link rel="stylesheet" href="css/cinematics.css">

<!-- Add to JS imports (before main.js) -->
<script src="js/cinematics.js"></script>
```

### Step 3: Update Missions

**In `missions.json`:**

```json
{
  "mission_id": "mission_1",
  "intro_scene": "mission_1_intro",
  "outro_scene": "mission_1_complete"
}
```

### Step 4: Hook Up Mission System

**In `missions.js` - `launchMission()`:**

```javascript
async function launchMission(mission, gameState) {
    // Play intro scene if defined
    if (mission.intro_scene) {
        await playCinematic(mission.intro_scene);
    }
    
    // Continue with existing planetfall logic...
}
```

**In `missions.js` - `dismissResults()`:**

```javascript
function dismissResults() {
    const mission = window.selectedMission;
    const success = window.lastMissionSuccess;
    
    // Determine outro scene
    let sceneId = null;
    if (success && mission.outro_scene_success) {
        sceneId = mission.outro_scene_success;
    } else if (!success && mission.outro_scene_failure) {
        sceneId = mission.outro_scene_failure;
    } else if (mission.outro_scene) {
        sceneId = mission.outro_scene;
    }
    
    // Play scene if defined
    if (sceneId) {
        playCinematic(sceneId).then(() => {
            // Continue with existing logic after scene
            completePostMissionFlow();
        });
        return;
    }
    
    // No scene - continue normally
    completePostMissionFlow();
}

function completePostMissionFlow() {
    // Existing post-mission code here
    unlockNavigation();
    switchRoom('mission_computer');
}
```

### Step 5: Test

- [ ] Create test scene in `scenes.json`
- [ ] Add `intro_scene` to a mission
- [ ] Launch mission and verify scene plays
- [ ] Test skip button
- [ ] Test all element types
- [ ] Verify navigation locks during playback

---

## Example Scenes

### Simple Intro

```json
{
  "scene_id": "simple_intro",
  "default_fade_duration": 1.0,
  "events": [
    {
      "delay": 0.0,
      "type": "background",
      "action": "fade_in",
      "color": "black",
      "duration": 1.0
    },
    {
      "delay": 1.0,
      "type": "narrator",
      "action": "fade_in",
      "text": "The adventure begins...",
      "align": "center",
      "size": "large",
      "duration": 3.0
    },
    {
      "delay": 2.5,
      "type": "all",
      "action": "fade_out",
      "duration": 1.0
    }
  ]
}
```

### Character Dialogue Scene

```json
{
  "scene_id": "mission_briefing",
  "default_fade_duration": 1.0,
  "events": [
    {
      "delay": 0.0,
      "type": "background",
      "action": "fade_in",
      "asset": "starship_bridge.jpg",
      "duration": 1.5
    },
    {
      "delay": 1.0,
      "type": "caption",
      "action": "fade_in",
      "text": "Mission Control",
      "size": "small",
      "duration": 0.0
    },
    {
      "delay": 0.5,
      "type": "portrait",
      "action": "slide_in",
      "character": "stella",
      "side": "left",
      "duration": 0.5
    },
    {
      "delay": 0.3,
      "type": "dialogue",
      "action": "show",
      "character": "stella",
      "text": "Team, we have incoming anomaly readings.",
      "duration": 3.0
    },
    {
      "delay": 2.5,
      "type": "portrait",
      "action": "slide_in",
      "character": "vawn",
      "side": "right",
      "duration": 0.5
    },
    {
      "delay": 0.3,
      "type": "dialogue",
      "action": "show",
      "character": "vawn",
      "text": "I'm detecting energy signatures. Let's check it out.",
      "duration": 3.0
    },
    {
      "delay": 2.5,
      "type": "all",
      "action": "fade_out",
      "duration": 1.0
    }
  ]
}
```

---

## Debug Commands

Add to `debug.js`:

```javascript
// Play any scene by ID
case 'play_scene':
    const sceneId = parts[1];
    if (sceneId) {
        playCinematic(sceneId);
        return `Playing scene: ${sceneId}`;
    } else {
        return 'Usage: play_scene <scene_id>';
    }
```

---

## Future Enhancements (Not in MVP)

- Camera effects (zoom, pan, shake)
- Background music/SFX integration
- Character-by-character text reveal
- Branching/choices in cinematics
- Looping background animations
- Particle effects
- Voice-over audio support

---

## Implementation Priority

1. **Core playback engine** (timeline, event queue)
2. **Background and narrator** (simplest elements)
3. **Portrait system** (requires guardian data integration)
4. **Dialogue boxes** (reuse existing UI patterns)
5. **Caption system**
6. **Skip functionality**
7. **Mission integration hooks**
8. **Polish and testing**

---

## Success Criteria

✅ Scenes play from JSON without code changes  
✅ All element types render correctly  
✅ Timing system works with relative delays  
✅ Skip button fast-forwards properly  
✅ Navigation locks during playback  
✅ Missions can trigger intro/outro scenes  
✅ No console errors during playback  
✅ System integrates cleanly with existing codebase

---

## Notes for Cline

- This system is **self-contained** - it doesn't modify existing systems
- Uses existing `getGuardianById()` and `renderVisual()` functions
- Follows project patterns: data-driven, auto-save where needed
- CSS uses existing CSS variables (`--primary`, `--text`, etc.)
- All async operations use `async/await` for clarity
- Skip button applies all remaining events instantly (no state is lost)

**Testing approach:**
1. Create one simple test scene
2. Verify playback works end-to-end
3. Add one mission integration
4. Iterate from there

**Key integration points:**
- `missions.js` needs `await playCinematic()` calls
- `game.html` needs CSS/JS includes
- `missions.json` needs scene ID fields
- `data/scenes.json` needs to be created

This is a **Phase 2 feature** - don't implement until Phase 1 core loop is working perfectly!