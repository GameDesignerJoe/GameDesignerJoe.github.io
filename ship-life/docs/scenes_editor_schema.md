# Scenes Editor: Schema Configuration & Integration Guide

## Overview

This document specifies the **complete editor integration** for `scenes.json`, enabling visual editing of cinematic sequences through the existing JSON editor interface. The schema defines dropdowns, array management, field ordering, tooltips, and validation rules.

---

## File: `editor/client/src/config/schemas.ts`

Add this complete schema to the `FILE_SCHEMAS` object:

```typescript
'scenes.json': {
  name: 'Scenes',
  dropdowns: {
    // Background fields
    'background.type': ['image', 'color'],
    'background.action': ['fade_in', 'fade_out', 'cut_in'],
    'color': ['black', 'white', 'space_blue', 'deep_space'],
    
    // Caption fields
    'caption.action': ['fade_in', 'fade_out', 'show', 'hide'],
    'caption.size': ['small', 'normal', 'large'],
    'caption.style': ['normal', 'italic', 'bold'],
    
    // Narrator fields
    'narrator.action': ['fade_in', 'fade_out', 'show', 'hide'],
    'narrator.align': ['left', 'center', 'right', 'justify'],
    'narrator.size': ['small', 'normal', 'large'],
    'narrator.style': ['normal', 'italic', 'bold'],
    
    // Portrait fields
    'portrait.action': ['slide_in', 'slide_out', 'fade_in', 'fade_out', 'cut_in'],
    'portrait.side': ['left', 'right'],
    'character': { source: 'guardians' },
    
    // Dialogue fields
    'dialogue.action': ['show', 'hide'],
    
    // All fields
    'all.action': ['fade_out', 'clear'],
    
    // Event type dropdown
    'type': ['background', 'caption', 'narrator', 'portrait', 'dialogue', 'all']
  },
  
  arrayFields: {
    'events': {
      canAdd: true,
      canRemove: true,
      canReorder: true,
      template: {
        delay: 0.0,
        type: 'narrator',
        action: 'fade_in',
        text: '',
        duration: 1.0
      }
    }
  },
  
  optionalFields: {
    // Background optional fields
    'events.asset': '',
    'events.color': 'black',
    
    // Text optional fields
    'events.text': '',
    'events.align': 'center',
    'events.size': 'normal',
    'events.style': 'normal',
    
    // Portrait optional fields
    'events.character': '',
    'events.side': 'left'
  },
  
  tooltips: {
    'scene_id': 'Unique identifier for this scene (referenced in missions.json)',
    'default_fade_duration': 'Default fade duration in seconds (can be overridden per event)',
    'events': 'Timeline of events that make up this cinematic sequence',
    'events.delay': 'Seconds to wait AFTER the previous event started (relative timing)',
    'events.duration': 'How long this action takes (0.0 = persist until cleared)',
    'events.type': 'Type of element to display',
    'events.action': 'What action to perform on this element',
    'events.asset': 'Background image filename (from assets/scenes/)',
    'events.color': 'Background color (use shortcuts or hex codes)',
    'events.text': 'Text content to display',
    'events.align': 'Text alignment (narrator only)',
    'events.size': 'Text size variant',
    'events.style': 'Text style variant',
    'events.character': 'Guardian ID for portrait/dialogue',
    'events.side': 'Which side to show portrait (left/right)'
  },
  
  fieldOrder: [
    'scene_id',
    'default_fade_duration',
    'events',
    'events.delay',
    'events.type',
    'events.action',
    'events.duration',
    // Optional fields appear conditionally based on type
    'events.asset',
    'events.color',
    'events.text',
    'events.align',
    'events.size',
    'events.style',
    'events.character',
    'events.side'
  ]
}
```

---

## Enhanced Schema: Conditional Field Display

To make the editor smarter about which fields to show based on the event `type`, we need to enhance the schema system. Add this to the schema:

```typescript
'scenes.json': {
  name: 'Scenes',
  
  // ... existing dropdowns ...
  
  conditionalFields: {
    // When type === 'background', show these fields
    'events': {
      when: { type: 'background' },
      showFields: ['asset', 'color', 'action', 'duration'],
      hideFields: ['text', 'align', 'size', 'style', 'character', 'side']
    },
    
    // When type === 'caption', show these fields
    'events_caption': {
      when: { type: 'caption' },
      showFields: ['text', 'size', 'style', 'action', 'duration'],
      hideFields: ['asset', 'color', 'align', 'character', 'side']
    },
    
    // When type === 'narrator', show these fields
    'events_narrator': {
      when: { type: 'narrator' },
      showFields: ['text', 'align', 'size', 'style', 'action', 'duration'],
      hideFields: ['asset', 'color', 'character', 'side']
    },
    
    // When type === 'portrait', show these fields
    'events_portrait': {
      when: { type: 'portrait' },
      showFields: ['character', 'side', 'action', 'duration'],
      hideFields: ['asset', 'color', 'text', 'align', 'size', 'style']
    },
    
    // When type === 'dialogue', show these fields
    'events_dialogue': {
      when: { type: 'dialogue' },
      showFields: ['character', 'text', 'action', 'duration'],
      hideFields: ['asset', 'color', 'align', 'size', 'style', 'side']
    },
    
    // When type === 'all', show these fields
    'events_all': {
      when: { type: 'all' },
      showFields: ['action', 'duration'],
      hideFields: ['asset', 'color', 'text', 'align', 'size', 'style', 'character', 'side']
    }
  }
}
```

---

## Example `scenes.json` Structure

This is what the editor will be editing:

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
          "duration": 1.0
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
        }
      ]
    },
    {
      "scene_id": "character_briefing",
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
        }
      ]
    }
  ]
}
```

---

## Editor UI Behavior

### Scene List Sidebar

**What displays:**
- Scene ID as the item name
- Count of events in subtitle (e.g., "8 events")
- Search filters by `scene_id`

**Example sidebar item:**
```
mission_1_intro
8 events
```

### Main Editor Panel

**Scene-level fields:**
- `scene_id` - Text input with tooltip
- `default_fade_duration` - Number input
- `events` - Array manager with reorder buttons

**Event array management:**
- Green "+ Add Event" button at bottom
- Each event has:
  - Event # indicator (e.g., "Event #1")
  - ↑↓ reorder buttons (enabled via `canReorder: true`)
  - ✕ delete button
- Collapsible event cards

### Event Fields (Conditional Display)

**Always visible:**
- `delay` - Number input
- `type` - Dropdown (background, caption, narrator, portrait, dialogue, all)
- `action` - Dropdown (options change based on type)
- `duration` - Number input

**Conditionally visible (based on `type`):**

| Type | Shows | Hides |
|------|-------|-------|
| `background` | `asset`, `color` | `text`, `align`, `size`, `style`, `character`, `side` |
| `caption` | `text`, `size`, `style` | `asset`, `color`, `align`, `character`, `side` |
| `narrator` | `text`, `align`, `size`, `style` | `asset`, `color`, `character`, `side` |
| `portrait` | `character`, `side` | `asset`, `color`, `text`, `align`, `size`, `style` |
| `dialogue` | `character`, `text` | `asset`, `color`, `align`, `size`, `style`, `side` |
| `all` | (none) | all optional fields |

---

## Dropdown Sources

### Guardian Characters
- **Source:** `guardians.json`
- **Field mapping:** `character` → guardians
- **Display:** Guardian name (e.g., "Stella", "Vawn")

### Scene Assets
- **Source:** File system scan of `assets/scenes/`
- **Field mapping:** `asset` → scene images
- **Display:** Filename (e.g., "starship_bridge.jpg")

### Color Shortcuts
- **Hardcoded list:** `['black', 'white', 'space_blue', 'deep_space']`
- **Field mapping:** `color` → predefined colors
- **Also supports:** Hex codes (user can type `#1a2332`)

---

## Server-Side Changes

### File: `editor/server/utils/dataCache.js`

Add scene asset scanning:

```javascript
// Add to buildCache function
function buildCache() {
  const cache = {
    guardians: [],
    items: [],
    missions: [],
    rooms: [],
    workstations: [],
    anomalies: [],
    trophies: [],
    blueprints: [],
    // ADD THESE:
    sceneAssets: [],
    // ... existing image scans
  };

  // Scan scene assets
  const scenesPath = path.join(__dirname, '../../assets/scenes');
  if (fs.existsSync(scenesPath)) {
    cache.sceneAssets = fs.readdirSync(scenesPath)
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
  }

  // ... rest of cache building
  
  return cache;
}
```

### File: `editor/client/src/types.ts`

Add to `DropdownOptions`:

```typescript
export interface DropdownOptions {
  guardians: string[];
  items: string[];
  missions: string[];
  rooms: string[];
  workstations: string[];
  anomalies: string[];
  trophies: string[];
  blueprints: string[];
  // ADD THIS:
  sceneAssets: string[];
  // ... existing image types
}
```

---

## Field Helper Updates

### File: `editor/client/src/utils/fieldHelpers.ts`

Add scene-specific field mapping:

```typescript
const mapping: Record<string, keyof DropdownOptions> = {
  'actor': 'guardians',
  'character': 'guardians',
  'asset': 'sceneAssets', // ADD THIS
  // ... rest of existing mappings
};
```

---

## Validation Rules

### Required Fields

**Scene level:**
- `scene_id` - Must be unique, no spaces, snake_case recommended
- `events` - Must have at least 1 event

**Event level:**
- `delay` - Must be >= 0
- `type` - Must be valid type
- `action` - Must be valid action for that type
- `duration` - Must be >= 0

### Type-Specific Required Fields

**background:**
- Must have either `asset` OR `color` (at least one)

**caption, narrator:**
- Must have `text`

**portrait, dialogue:**
- Must have `character`

**portrait:**
- Must have `side` (when action is `slide_in` or `slide_out`)

### Validation Warnings

Show yellow border + warning icon for:
- Missing required conditional fields
- `scene_id` contains spaces
- `asset` references non-existent file
- `character` references non-existent guardian
- `duration` is 0 for fade/slide actions (might be intentional but unusual)

---

## UI Enhancements

### Event Type Icons

Add visual indicators next to event type:

```typescript
const eventTypeIcons = {
  background: '🖼️',
  caption: '📝',
  narrator: '📖',
  portrait: '👤',
  dialogue: '💬',
  all: '🔄'
};
```

Display in event header: `Event #1 🖼️ Background`

### Timeline Preview

Add a simple timeline visualization at the top of the events array:

```
Timeline: [■───■─■──■────■] 8.5s total
          0   1.5 2 2.5   8.5
```

Each `■` represents an event, positioned by its absolute trigger time.

### Event Templates

Add quick-add buttons above the events array:

```
Quick Add: [Background] [Character Speech] [Fade All]
```

Each button adds a pre-filled event:
- **Background:** type=background, action=fade_in, color=black
- **Character Speech:** type=dialogue, action=show, character=stella
- **Fade All:** type=all, action=fade_out

---

## Collapsible Sections

### Event Collapsing

Each event should be collapsible to keep long scenes manageable:

```
▼ Event #1 🖼️ Background (fade_in, 1.0s)
  delay: 0.0
  type: background
  action: fade_in
  color: black
  duration: 1.0

▶ Event #2 📖 Narrator (fade_in, 3.0s)

▶ Event #3 💬 Dialogue (show, stella)
```

**Collapsed state shows:**
- Event number + icon + type
- Action in parentheses
- Key details (duration, character name if applicable)

---

## Search & Filter

### Scene Search
- Filter by `scene_id` (existing functionality)

### Event Filtering (Enhancement)
Add dropdown filter above events array:
```
Filter events by type: [All Types ▾]
```

Options: All Types, Background, Caption, Narrator, Portrait, Dialogue, All

---

## Copy/Paste Events

### Functionality
- Add "📋 Copy" button to each event
- Add "📋 Paste Event" button at top of events array
- Stores event JSON in clipboard
- Allows duplicating events quickly

### Implementation
```typescript
const copyEvent = (event: any) => {
  navigator.clipboard.writeText(JSON.stringify(event, null, 2));
  showNotification('Event copied to clipboard');
};

const pasteEvent = async () => {
  const text = await navigator.clipboard.readText();
  try {
    const event = JSON.parse(text);
    addArrayItem(['events'], event);
  } catch (e) {
    showNotification('Invalid event data in clipboard', 'error');
  }
};
```

---

## Keyboard Shortcuts

Enhance editor with cinematic-specific shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl+D` | Duplicate current event |
| `Ctrl+Shift+↑` | Move event up |
| `Ctrl+Shift+↓` | Move event down |
| `Ctrl+Delete` | Delete current event |
| `Ctrl+Shift+P` | Preview scene (calls cinematic player) |

---

## Preview Integration

### Add Preview Button

Add to scene header:
```tsx
<button 
  onClick={() => previewScene(currentScene)}
  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
>
  ▶ Preview Scene
</button>
```

### Preview Implementation

```typescript
const previewScene = (scene: any) => {
  // Open a new window
  const previewWindow = window.open(
    '/preview.html',
    'Scene Preview',
    'width=1280,height=720'
  );
  
  // Post scene data to preview window
  previewWindow.addEventListener('load', () => {
    previewWindow.postMessage({
      type: 'PLAY_SCENE',
      scene: scene
    }, '*');
  });
};
```

**Create `editor/client/public/preview.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Scene Preview</title>
  <link rel="stylesheet" href="../../../css/main.css">
  <link rel="stylesheet" href="../../../css/cinematics.css">
</head>
<body>
  <div id="preview-container"></div>
  <script src="../../../js/cinematics.js"></script>
  <script src="../../../js/guardians.js"></script>
  <script src="../../../js/ui.js"></script>
  <script>
    window.addEventListener('message', (event) => {
      if (event.data.type === 'PLAY_SCENE') {
        // Inject scene into scenesData
        window.scenesData = { scenes: [event.data.scene] };
        // Play the scene
        playCinematic(event.data.scene.scene_id);
      }
    });
  </script>
</body>
</html>
```

---

## Export Functionality

### Export Single Scene

Add button to export current scene:

```tsx
<button 
  onClick={() => exportScene(currentScene)}
  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm"
>
  📥 Export Scene
</button>
```

```typescript
const exportScene = (scene: any) => {
  const json = JSON.stringify(scene, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scene.scene_id}.json`;
  a.click();
};
```

### Import Scene

Add button to import scene:

```tsx
<input 
  type="file" 
  accept=".json" 
  onChange={(e) => importScene(e.target.files[0])}
  className="hidden"
  id="import-scene"
/>
<label 
  htmlFor="import-scene"
  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm cursor-pointer"
>
  📤 Import Scene
</label>
```

---

## Testing Checklist

### Editor Functionality
- [ ] Can create new scene
- [ ] Can add/remove/reorder events
- [ ] Dropdowns populate correctly
- [ ] Type changes show/hide correct fields
- [ ] Guardian dropdown shows all guardians
- [ ] Scene asset dropdown shows all images
- [ ] Color shortcuts work
- [ ] Validation warnings display
- [ ] Tooltips appear on hover
- [ ] Auto-save works (500ms debounce)
- [ ] Collapsible sections work
- [ ] Copy/paste events works

### Integration
- [ ] `scenes.json` appears in file list
- [ ] Changes persist on refresh
- [ ] Dropdown cache updates when guardians added
- [ ] Scene assets scan works
- [ ] Export scene creates valid JSON
- [ ] Import scene adds to file
- [ ] Preview button opens window
- [ ] Preview plays scene correctly

### Data Validation
- [ ] Required fields enforced
- [ ] Type-specific fields validated
- [ ] Unique scene_id enforced
- [ ] Invalid guardian names flagged
- [ ] Missing assets flagged
- [ ] Negative durations prevented

---

## Migration Guide

### For Existing Scenes

If you already have scene files outside the editor:

1. Place `scenes.json` in `data/` folder
2. Ensure structure matches schema
3. Open in editor
4. Validate all fields
5. Save to apply schema

### For New Scenes

1. Open editor
2. Load `scenes.json`
3. Click "Add New"
4. Fill in `scene_id`
5. Add events using "+ Add Event"
6. Set event types and configure
7. Auto-saves every 500ms

---

## Future Enhancements

- [ ] Drag-and-drop event reordering (in addition to buttons)
- [ ] Visual timeline editor (drag events on timeline)
- [ ] Real-time preview (updates as you type)
- [ ] Scene templates library
- [ ] Duplicate entire scene
- [ ] Scene validation on save
- [ ] Audio field support (when audio system added)
- [ ] Camera effects (when implemented)
- [ ] Branching/choices (when implemented)

---

## Summary

This editor integration provides:

✅ **Full CRUD operations** for scenes and events  
✅ **Smart conditional fields** based on event type  
✅ **Array management** with reordering for events  
✅ **Dropdown population** from guardians and assets  
✅ **Validation** for required fields and data integrity  
✅ **Preview functionality** to test scenes in-editor  
✅ **Export/import** for sharing scene files  
✅ **Auto-save** so no manual saves needed  
✅ **Tooltips** for all fields to guide authoring  

The editor makes creating cinematics as easy as filling out a form, with zero JSON syntax knowledge required!