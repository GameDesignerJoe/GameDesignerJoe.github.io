Perfect! I have everything I need. Let me search the project files to check on those two specific items you mentioned, then I'll write up the complete design document.Perfect! I found the information I need. Now I have everything to write the complete design document. Let me create a comprehensive document that covers all systems, phases, and implementation details.

---

# **Ship Life: Location-Based Exploration System**
## **Complete Design Document**

**Version:** 1.0  
**Date:** January 25, 2026  
**Purpose:** Transition from mission-based to location-based exploration gameplay

---

## **Table of Contents**

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Data Structures](#3-data-structures)
4. [Core Systems](#4-core-systems)
5. [User Interface](#5-user-interface)
6. [Implementation Phases](#6-implementation-phases)
7. [Technical Specifications](#7-technical-specifications)
8. [Testing & Validation](#8-testing--validation)

---

## **1. Executive Summary**

### **1.1 Design Philosophy**

Ship Life is transitioning from structured mission selection to open-ended location exploration. Players will drop into large planetary zones, encounter dynamic activities, gather resources, and extract when ready - creating a more emergent, player-driven experience.

**Core Principles:**
- **Maximum Extensibility:** All content authored via JSON/CSV without code changes
- **Player Agency:** Meaningful choices with visible consequences
- **Risk/Reward Balance:** Strategic decision-making over predetermined outcomes
- **Scalable Complexity:** Simple core with room for future expansion

### **1.2 Major Changes**

| **Old System (Missions)** | **New System (Locations)** |
|---------------------------|----------------------------|
| Pick specific mission | Pick large location zone |
| Pre-selected objectives | Dynamic activity spawning |
| 4 Guardians deploy | 1 Guardian deploys |
| Single mission completion | Multiple activities per drop |
| Fixed rewards | Inventory-based collection |
| Text loading bar | Interactive text chain with choices |

### **1.3 Key Features**

✅ **Map-Based Location Selection** - Click planetary hotspots to view location details  
✅ **Dynamic Activity Spawning** - 2-4 random activities per drop with rarity tiers  
✅ **Player Choice System** - Engage, avoid, flee, or extract at critical moments  
✅ **Inventory Management** - 20-slot capacity with 3-item stacking  
✅ **Detection & Flee Mechanics** - Risk-based avoidance with percentage chances  
✅ **Character-Specific Dialogue** - Guardian responses at 5 key moments  
✅ **Multiple Extraction Conditions** - Inventory full, downed, rare item, max activities  

---

## **2. System Architecture Overview**

### **2.1 High-Level Flow**

```
Ship → Map Room → Select Location → Planetfall Room → Select Guardian & Loadout 
→ Drop (Text Chain) → Encounter Activities (Choices) → Extract → Loot Screen → Ship
```

### **2.2 Core Systems**

1. **Planet/Location System** - Hierarchical map structure with unlock progression
2. **Activity System** - Dynamic encounter generation with types and rarity
3. **Text Chain System** - Scrolling narrative feed with player choices
4. **Engagement System** - Detection, flee, success/fail mechanics
5. **Inventory System** - Capacity limits and extraction triggers
6. **Progression System** - Drop counts and activity completion tracking

### **2.3 Integration with Existing Systems**

**Retained Systems:**
- Guardian stats and loadout calculations (`loadout.js`)
- Inventory management (`inventory.js`)
- Save/load system (`state.js`)
- Workstation crafting (`workstations.js`)
- JSON editor (`editor/`)

**Modified Systems:**
- Mission Computer → Map Room (UI transformation)
- Planetfall Portal → Single Guardian selection
- Loading bar → Interactive text chain
- Loot distribution → Larger inventory cashouts

**Deprecated Systems:**
- `missions.json` structure (kept for reference, not actively used)
- Mission chains (paused for future consideration)

---

## **3. Data Structures**

### **3.1 Planets JSON**

**File:** `data/planets.json`

```json
[
  {
    "id": "earth",
    "name": "Earth",
    "subtitle": "Humanity's Homeworld",
    "map_image": "assets/images/maps/earth_map.png"
  }
]
```

**Fields:**
- `id` (string): Unique identifier
- `name` (string): Display name
- `subtitle` (string): Flavor text
- `map_image` (string): Path to planetary map image

### **3.2 Locations JSON**

**File:** `data/locations.json`

```json
[
  {
    "id": "frozen_wastes",
    "planet_id": "earth",
    "name": "Frozen Wastes",
    "description": "A harsh arctic region with limited visibility and extreme cold. Ruins of ancient structures dot the landscape.",
    "location_image": "assets/images/locations/frozen_wastes.png",
    
    "hotspot_position": {
      "x": 25.5,
      "y": 40.0
    },
    
    "locked": false,
    "unlock_requirements": {
      "drop_count": 0,
      "activities_completed": 0,
      "specific_activities": []
    },
    
    "activity_spawn_range": {
      "min": 2,
      "max": 4
    },
    
    "max_activities": 5,
    
    "activity_type_distribution": {
      "combat": 60,
      "resource_gathering": 20,
      "investigating": 15,
      "puzzle": 5
    },
    
    "possible_resources": ["ice_crystals", "frozen_metal", "cryo_cells"]
  }
]
```

**Fields:**
- `id`: Unique location identifier
- `planet_id`: Reference to parent planet
- `name`: Location display name
- `description`: Narrative description with difficulty hints
- `location_image`: Preview image for sidebar
- `hotspot_position`: Coordinates on planet map (percentages for responsive scaling)
  - `x`: Percentage from left edge (0-100)
  - `y`: Percentage from top edge (0-100)
- `locked`: Boolean unlock state
- `unlock_requirements`: Progression gates
  - `drop_count`: Successful drops needed
  - `activities_completed`: Total activities needed
  - `specific_activities`: Array of activity IDs that must be completed
- `activity_spawn_range`: Min/max activities per drop
- `max_activities`: Total encounters before forced extraction
- `activity_type_distribution`: Percentage breakdown (must total 100, warns if not)
- `possible_resources`: Resource types findable in this location

### **3.3 Activities JSON**

**File:** `data/activities.json`

```json
[
  {
    "id": "giant_robot_combat",
    "name": "Giant Robot",
    "description": "A massive combat robot patrols the area. It looks large and very well armored, but doesn't seem to have a lot of weapons on it.",
    "type": "combat",
    "rarity": "uncommon",
    "difficulty": 5,
    
    "stat_requirements": {
      "primary": {"stat": "attack", "value": 7},
      "secondary": {"stat": "defense", "value": 5},
      "tertiary": {"stat": "movement", "value": 3}
    },
    
    "detection_risk": 30,
    "flee_chance": 50,
    "down_risk": 70,
    
    "loot_table": [
      {"resource_id": "metal_scraps", "min": 3, "max": 8, "drop_chance": 100},
      {"resource_id": "energy_cells", "min": 1, "max": 3, "drop_chance": 50}
    ],
    
    "dialogue": {
      "stella": {
        "initiate": "Big one ahead!",
        "engage": "Let's scrap this thing!",
        "success": "Another pile of junk!",
        "fail": "It's too strong!",
        "downed": "It got me. I'm downed."
      },
      "vawn": {
        "initiate": "Analyzing... that's a big target.",
        "engage": "Engaging combat protocols.",
        "success": "Target neutralized.",
        "fail": "Tactical retreat advised.",
        "downed": "Systems failing... I'm down."
      },
      "default": {
        "initiate": "The guardian spots a giant robot.",
        "engage": "The guardian engages the robot.",
        "success": "The guardian defeats the robot.",
        "fail": "The guardian is overwhelmed.",
        "downed": "The guardian has been downed."
      }
    }
  }
]
```

**Fields:**
- `id`: Unique activity identifier
- `name`: Short display name
- `description`: Narrative description with embedded difficulty hints
- `type`: Activity category (combat, resource_gathering, investigating, puzzle)
- `rarity`: Spawn frequency (common, uncommon, rare)
- `difficulty`: Numeric difficulty (1-10)
- `stat_requirements`: Same structure as missions
  - `primary`: 50% weight in success calculation
  - `secondary`: 30% weight
  - `tertiary`: 20% weight
- `detection_risk`: Percentage chance (0-100) of being spotted when avoiding
- `flee_chance`: Percentage chance (0-100) of successful escape when detected
- `down_risk`: Percentage chance (0-100) of being downed on failure
- `loot_table`: Rewards array
  - `resource_id`: Item ID from items.json
  - `min`/`max`: Quantity range
  - `drop_chance`: Percentage (0-100)
- `dialogue`: Character-specific lines
  - Character keys (stella, vawn, etc.) map to guardian IDs
  - `default`: Fallback narration if no character-specific dialogue
  - Five moments: `initiate`, `engage`, `success`, `fail`, `downed`

### **3.4 Game Config JSON**

**File:** `data/game_config.json`

```json
{
  "activity_types": [
    "combat",
    "resource_gathering",
    "investigating",
    "puzzle"
  ]
}
```

**Note:** Check if `game_config.json` already exists or if there is something like it that is already doing that job in repo. If so, add `activity_types` array to existing structure.

### **3.5 Save State Additions**

**Additions to existing save structure:**

```json
{
  "progression": {
    "total_drops": 15,
    "successful_drops": 12,
    "failed_drops": 3,
    "activities_completed": {
      "giant_robot_combat": 3,
      "crashed_ship_investigation": 5,
      "_total": 8
    },
    "location_drops": {
      "frozen_wastes": 7,
      "burning_plains": 5
    }
  },
  
  "last_selected_guardian": "stella",
  
  "inventory_capacity": 20,
  "inventory_stack_limit": 3
}
```

---

## **4. Core Systems**

### **4.1 Activity Spawning System**

**Spawning Algorithm:**

1. **Determine Activity Count**
   - Roll random number between location's `activity_spawn_range.min` and `max`
   - Example: If range is [2,4], roll 2, 3, or 4

2. **Calculate Rarity Distribution**
   - Use MTG booster pack model
   - Formula: For every 2 commons, add 1 rare/uncommon
   
   | Total Activities | Commons | Rare/Uncommon |
   |-----------------|---------|---------------|
   | 2 | 1 | 1 |
   | 3 | 2 | 1 |
   | 4 | 3 | 1 |
   | 5 | 3 | 2 |
   | 6 | 4 | 2 |

3. **Assign Activity Types**
   - For each slot, roll against location's `activity_type_distribution`
   - Example: 60% combat, 20% resource, 15% investigating, 5% puzzle
   - Roll d100, assign type based on ranges:
     - 1-60: combat
     - 61-80: resource_gathering
     - 81-95: investigating
     - 96-100: puzzle

4. **Select Specific Activities**
   - Filter activities by: assigned type AND assigned rarity
   - Randomly pick one from filtered pool
   - If no activities match filters, log warning and pick any activity

5. **Validation**
   - Ensure activity_type_distribution totals 100 (warn in console if not)
   - Log spawned activities to console

**Console Output Example:**
```
=== ACTIVITY SPAWNING ===
Location: Frozen Wastes
Activity Count: 3 (2-4 range)
Rarity Distribution: 2 common, 1 rare/uncommon
Type Rolls: combat (45), investigating (82), combat (12)
Spawned Activities:
  1. Patrol Encounter (combat, common)
  2. Crashed Ship (investigating, uncommon)
  3. Enemy Outpost (combat, common)
```

### **4.2 Activity Engagement System**

**Decision Tree:**

```
Player Encounters Activity
│
├─ CHOICE: "Engage" or "Avoid"
│
├─ IF "Engage"
│  ├─ Roll Success/Fail (using existing mission stat calculation)
│  │  ├─ Success → Award loot, continue
│  │  └─ Fail → Roll down_risk %
│  │     ├─ Downed → Extract (failed drop)
│  │     └─ Not Downed → No loot, continue
│
└─ IF "Avoid"
   ├─ Roll detection_risk %
   │  ├─ Not Detected → Continue (doesn't count toward activity limit)
   │  └─ Detected → CHOICE: "Engage" or "Flee"
   │     ├─ "Engage" → [Same as above]
   │     └─ "Flee" → Roll flee_chance %
   │        ├─ Flee Success → Escape, no loot, continue
   │        └─ Flee Fail → Forced to engage [Same as Engage above]
```

**Activity Counter Logic:**
- Max activities limit (default 5, configurable per location)
- Counts: Completed activities + Avoided activities (including detected)
- Does NOT count: Successfully avoided (not detected) activities
- If player skips an activity via successful avoid, spawn replacement activity
- When counter reaches max_activities, trigger extraction ("Completed exploration")

**Percentage Roll Implementation:**
```javascript
function rollPercentage(chance) {
  return Math.random() * 100 <= chance;
}

// Example usage:
if (rollPercentage(activity.detection_risk)) {
  // Player was detected!
}
```

### **4.3 Text Chain System**

**Architecture:**

**Text Chain Entry Types:**

1. **Narration**
   - Plain text, no portrait
   - Example: "The dropship descends through heavy cloud cover..."

2. **Guardian Dialogue**
   - Character portrait + name + text
   - Different background/bubble styling
   - Example: [Stella Portrait] "Big one ahead!"

3. **Player Choice**
   - Special styling (blue background)
   - Records player decision
   - Example: "[You chose] Avoid the robot"

4. **System Event**
   - Italic or different color
   - Game state changes
   - Example: "The robot's sensors lock onto you!"

5. **Extraction Reason**
   - **Special bold/colored styling**
   - Indicates why extraction occurred
   - Example: "INVENTORY FULL - Extraction Required"

**Visual Layout:**
- Chat-style scrolling feed (like iMessage/Slack)
- New entries appear at bottom, scroll up
- Keep last 10 entries visible (or entire log, whichever is easier)
- Flush on extraction (no persistent history)

**Auto-Advance Timing:**
- 3-4 seconds per entry
- Pauses when choice popup appears
- Resumes after player makes choice

**Choice Popup Structure:**
```html
<div class="choice-popup">
  <h3>You've spotted a Giant Robot</h3>
  <p>It looks large and very well armored, but doesn't seem to have a lot of weapons on it.</p>
  <div class="choice-buttons">
    <button class="choice-engage">Engage</button>
    <button class="choice-avoid">Avoid</button>
  </div>
</div>
```

**Text Chain Flow Example:**
```
1. [Narration] "You drop into the frozen wastes. Ice crunches beneath your boots."
2. [Dialogue - Stella] "Sensors picking up movement ahead."
3. [Narration] "You spot a giant robot in the distance."
   → [Choice Popup appears, text chain pauses]
4. [Player Choice] "You chose to Avoid"
5. [System Event] "The robot's sensors lock onto you!"
   → [Detection Popup appears]
6. [Player Choice] "You chose to Flee"
7. [Narration] "You successfully escape and continue your search."
8. ...more entries...
9. [Extraction] "INVENTORY FULL - Extraction Required"
   → [Extract button appears]
```

### **4.4 Dialogue System**

**Dialogue Trigger Moments:**

| Moment | Trigger Point | Example |
|--------|--------------|---------|
| **Initiate** | Activity encounter (in text chain before choice popup) | "Scanners picking up something..." |
| **Engage** | After player chooses to engage, before success roll | "Let's take this down!" |
| **Success** | After successful completion | "Target eliminated!" |
| **Fail** | After failed attempt (but not downed) | "We need to fall back!" |
| **Downed** | After failed attempt results in being downed | "It got me. I'm downed." |

**Selection Logic:**
```javascript
function getDialogue(activity, guardianId, moment) {
  // Try character-specific dialogue
  if (activity.dialogue[guardianId] && activity.dialogue[guardianId][moment]) {
    return {
      type: 'dialogue',
      speaker: guardianId,
      text: activity.dialogue[guardianId][moment]
    };
  }
  
  // Try default dialogue
  if (activity.dialogue.default && activity.dialogue.default[moment]) {
    return {
      type: 'narration',
      text: activity.dialogue.default[moment]
    };
  }
  
  // Skip if no dialogue exists
  return null;
}
```

### **4.5 Extraction System**

**Extraction Conditions (Priority Order):**

1. **Downed** (highest priority - forced)
   - Guardian's down_risk roll succeeded after failed activity
   - No loot collected
   - Displays "Downed" on results screen

2. **Found Rare Item** (player choice)
   - Any blueprint drops from activity loot
   - Prompt: "You found a rare blueprint! Extract now or continue?"
   - If continue, can extract later if another blueprint drops

3. **Inventory Full** (automatic)
   - Inventory reaches 20/20 slots (60 items with 3-stack limit)
   - Extraction occurs after current activity completes
   - If activity triggers mid-extraction route, notify: "Inventory full - heading to extraction"

4. **Max Activities Reached** (automatic)
   - Activity counter (completed + avoided) reaches `max_activities`
   - Extraction reason: "Completed Exploration"

5. **Timer Expired** (future feature - not implemented yet)

**Extraction Button:**
- Single centered button: "Extract and Return to Ship"
- Above button: Extraction reason in special styling
- Click immediately transitions to loot screen

**Loot Screen Changes:**
- Replace "Success/Failure" banner with "Survived/Downed"
- **Survived:** Pleasant, rewarding color (green/gold)
- **Downed:** Somber, muted color (gray/red)
- **Downed shows 0 items** (no loot collected)
- Increase loot display to show **4x typical mission rewards**

### **4.6 Inventory System**

**Capacity:**
- 20 slots total
- 3 items stack per slot
- Maximum: 60 items total

**Blueprint Detection:**
```javascript
function containsBlueprint(lootArray) {
  return lootArray.some(item => {
    const itemData = window.itemsData.find(i => i.id === item.resource_id);
    return itemData && itemData.type === 'blueprint';
  });
}
```

**Note:** Items already have `type: "blueprint"` field in `items.json`, verified in codebase.

---

## **5. User Interface**

### **5.1 Map Room**

**Layout:**
- Full-screen background: Planet map image
- Clickable hotspot pins overlaid at defined coordinates
- Sidebar (initially hidden) on right side

**Hotspot Pin Design:**
- Circle (60px diameter) with short line extending down (20px)
- Line endpoint = `hotspot_position` coordinates
- Circle accepts image or color (like character portraits)
- **Unlocked:** Full color/opacity, glowing hover effect
- **Locked:** Grayscale, 50% opacity, clickable to show requirements
- Hover tooltip shows location name

**Hotspot Positioning Math:**
```javascript
function positionHotspot(hotspotData, mapElement) {
  const pin = document.createElement('div');
  pin.className = 'hotspot-pin';
  pin.style.left = `${hotspotData.x}%`;
  pin.style.top = `${hotspotData.y}%`;
  // Position is where the pin point touches the map
  pin.style.transform = 'translate(-50%, -100%)'; // Center horizontally, anchor at bottom
  mapElement.appendChild(pin);
}
```

**Sidebar Content (Unlocked Location):**
```html
<div class="location-sidebar">
  <img src="{location.location_image}" alt="{location.name}" />
  <h2>{location.name}</h2>
  <p>{location.description}</p>
  <div class="resources-section">
    <h3>Possible Resources</h3>
    <ul>
      {location.possible_resources.map(r => <li>{r}</li>)}
    </ul>
  </div>
  <button class="drop-button">Drop Here</button>
</div>
```

**Sidebar Content (Locked Location):**
```html
<div class="location-sidebar locked">
  <img src="{location.location_image}" alt="{location.name}" class="grayscale" />
  <h2>{location.name}</h2>
  <div class="unlock-requirements">
    <h3>Unlock Requirements</h3>
    <p>Complete {unlock_requirements.drop_count} successful drops</p>
    <p>Complete {unlock_requirements.activities_completed} total activities</p>
  </div>
</div>
```

### **5.2 Planetfall Room**

**Changes from Current System:**

**Current System:**
- Shows 4 guardians (verified in `rooms.js`, see line: `if (window.selectedGuardians.length < 4)`)
- Allows selecting up to 4 for mission
- Toggle selection on click

**New System:**
- Shows all 6 guardians (Stella, Vawn, Tiberius, Maestra, Nyx, Shadow)
- **Allow selecting exactly 1 guardian**
- Persist selection between drops (save to `gameState.last_selected_guardian`)
- Can still modify all loadouts while in planetfall room (gear management)

**Implementation Change:**
```javascript
// In toggleGuardianSelection function (rooms.js)
// OLD:
if (window.selectedGuardians.length < 4) {
    window.selectedGuardians.push(guardianId);
}

// NEW:
if (window.selectedGuardians.length < 1) {
    window.selectedGuardians.push(guardianId);
} else {
    // Replace current selection
    window.selectedGuardians = [guardianId];
}
```

**Launch Button:**
- Only enabled when exactly 1 Guardian selected
- Clicking "Launch" → Start text chain sequence

### **5.3 Text Chain Interface**

**Layout:**
```html
<div class="text-chain-container">
  <div class="text-chain-feed" id="textChainFeed">
    <!-- Entries populate here, auto-scroll to bottom -->
  </div>
</div>
```

**Entry Templates:**

**Narration:**
```html
<div class="text-entry narration">
  <p>The dropship descends through heavy cloud cover...</p>
</div>
```

**Guardian Dialogue:**
```html
<div class="text-entry dialogue">
  <img src="{guardian.portrait}" class="dialogue-portrait" />
  <div class="dialogue-bubble">
    <span class="speaker-name">{guardian.name}</span>
    <p>{dialogue.text}</p>
  </div>
</div>
```

**Player Choice:**
```html
<div class="text-entry player-choice">
  <p>[You chose] Avoid the robot</p>
</div>
```

**System Event:**
```html
<div class="text-entry system-event">
  <p><em>The robot's sensors lock onto you!</em></p>
</div>
```

**Extraction Reason:**
```html
<div class="text-entry extraction-reason">
  <p><strong>INVENTORY FULL - Extraction Required</strong></p>
</div>
```

**Choice Popup Overlay:**
```html
<div class="choice-popup-overlay">
  <div class="choice-popup">
    <h3>{activity.name}</h3>
    <p>{activity.description}</p>
    <div class="choice-buttons">
      <button class="btn-engage">Engage</button>
      <button class="btn-avoid">Avoid</button>
    </div>
  </div>
</div>
```

**Detection Popup:**
```html
<div class="choice-popup-overlay">
  <div class="choice-popup">
    <h3>Detected!</h3>
    <p>The {activity.name} has spotted you!</p>
    <div class="choice-buttons">
      <button class="btn-engage">Engage</button>
      <button class="btn-flee">Flee</button>
    </div>
  </div>
</div>
```

**Extract Button:**
```html
<div class="extract-button-container">
  <button class="btn-extract">Extract and Return to Ship</button>
</div>
```

### **5.4 Loot Screen Updates**

**Existing Screen Modified:**
- Replace "Mission Success" / "Mission Failure" banner
- New banners:
  - **"Survived"** - Green/gold styling
  - **"Downed"** - Gray/red styling
- If downed: Show 0 items with message "Lost all collected resources"
- If survived: Show all collected loot (expect 4x typical amount)

---

## **6. Implementation Phases**

### **Phase 1: Foundation (Map & Location System)**

**Goal:** Get basic location selection working with simple activity spawning.

**Tasks:**

1. **Data Setup**
   - Create `data/planets.json` with Earth
   - Create `data/locations.json` with 3 locations (1 unlocked, 2 locked)
   - Create `data/activities.json` with 6-8 sample activities (mix of types/rarities)
   - Add/update `activity_types` array in `data/game_config.json`

2. **Map Room UI**
   - Transform Mission Computer into Map Room
   - Implement planet map background display
   - Create hotspot pin component (circle + line)
   - Implement percentage-based positioning
   - Add locked/unlocked visual states
   - Create sidebar component
   - Wire up sidebar content display on hotspot click
   - Implement "Drop Here" button → navigate to Planetfall

3. **Activity Spawning**
   - Implement basic random spawning (ignore rarity/type distribution for now)
   - Roll activity count from location's spawn range
   - Randomly select X activities from all available
   - Store spawned activities in session state

4. **Planetfall Room Update**
   - Modify guardian selection limit from 4 to 1
   - Update selection UI to show single selection clearly
   - Persist last selected guardian in save state
   - Keep loadout management functional

5. **Testing with Old Loading Bar**
   - Wire "Launch" button to use old loading bar temporarily
   - Calculate loot from spawned activities (all guaranteed success for now)
   - Show 4x loot on results screen
   - Increment drop counter in save state

**Acceptance Criteria:**
- ✅ Map displays with 3 clickable hotspots
- ✅ Sidebar shows correct location info
- ✅ Locked locations show unlock requirements
- ✅ Can select exactly 1 Guardian
- ✅ Launch → Old loading bar → Loot screen with 4x rewards
- ✅ Drop counter increments

**Phase 1 Duration Estimate:** 2-3 days

---

### **Phase 2: Text Chain & Activity Choices**

**Goal:** Replace loading bar with interactive text chain system.

**Tasks:**

1. **Text Chain UI**
   - Create scrolling text feed component
   - Implement 4 entry types (narration, dialogue, player choice, system event)
   - Add auto-advance timing (3-4 seconds per entry)
   - Implement smooth scrolling to bottom on new entries
   - Add entry history limit (last 10 entries)

2. **Choice Popup System**
   - Create modal popup component
   - Implement text chain pause on popup display
   - Wire up button click handlers
   - Resume text chain after choice
   - Log choice to text chain

3. **Activity Encounter Flow**
   - Generate text chain sequence from spawned activities
   - Show activity initiate dialogue (if exists)
   - Display choice popup for each activity
   - Implement "Engage" choice → success/fail roll → show outcome
   - Implement "Avoid" choice → detection roll → appropriate outcome

4. **Detection & Flee Mechanics**
   - Roll detection_risk when player chooses "Avoid"
   - Show detection popup if detected
   - Implement flee_chance roll for flee attempts
   - Handle flee success (escape) vs flee fail (forced engage)

5. **Success/Fail/Down System**
   - Use existing `calculateMissionSuccessRate()` for activity success
   - Roll down_risk on activity failure
   - Show Guardian's "downed" dialogue if downed
   - Trigger extraction if downed

6. **Extraction Triggers**
   - Implement "Downed" extraction
   - Implement "Inventory Full" check after each activity
   - Show extraction reason in text chain
   - Display "Extract" button
   - Transition to loot screen on click

**Acceptance Criteria:**
- ✅ Text chain displays and auto-advances
- ✅ Choice popups pause text chain
- ✅ Can engage or avoid activities
- ✅ Detection system works (rolls vs detection_risk)
- ✅ Flee system works (rolls vs flee_chance)
- ✅ Success/fail determined by stat calculations
- ✅ Down risk triggers extraction
- ✅ Loot awarded on success, none on fail/down
- ✅ Extract button appears and functions

**Phase 2 Duration Estimate:** 3-5 days

---

### **Phase 3: Dialogue System**

**Goal:** Add character-specific dialogue at key moments.

**Tasks:**

1. **Dialogue Data Structure**
   - Verify all sample activities have dialogue objects
   - Include at least 2 characters + default per activity
   - Cover all 5 moments (initiate, engage, success, fail, downed)

2. **Dialogue Selection Logic**
   - Implement character-specific dialogue lookup
   - Fall back to default if character not defined
   - Skip if no default exists

3. **Dialogue Display**
   - Add Guardian portrait to dialogue entries
   - Style dialogue bubbles differently from narration
   - Test with all 6 Guardians

4. **Dialogue Timing Integration**
   - Show initiate dialogue when activity encountered (before choice popup)
   - Show engage dialogue after player chooses engage (before success roll)
   - Show success/fail dialogue after outcome determined
   - Show downed dialogue if downed occurs

**Acceptance Criteria:**
- ✅ Dialogue appears at correct moments
- ✅ Character-specific lines display for selected Guardian
- ✅ Default fallback works if character not defined
- ✅ All 5 dialogue moments functional
- ✅ Portrait displays correctly in text chain

**Phase 3 Duration Estimate:** 1-2 days

---

### **Phase 4: Rarity & Type Distribution**

**Goal:** Implement MTG-style rarity distribution and activity type balancing.

**Tasks:**

1. **Rarity Distribution Algorithm**
   - Implement rarity slot calculation (2 commons = 1 rare/uncommon added)
   - Roll rare vs uncommon (50/50)
   - Filter activities by assigned rarity

2. **Type Distribution System**
   - Read location's `activity_type_distribution`
   - Roll d100 for each activity slot
   - Assign type based on percentage ranges
   - Filter activities by: assigned type AND assigned rarity

3. **Validation & Warnings**
   - Warn if type distribution doesn't total 100
   - Warn if no activities match type+rarity filters
   - Log detailed spawn breakdown to console

4. **Activity Counter & Max Activities**
   - Track completed + avoided activities
   - Spawn replacement if player successfully avoids (not detected)
   - Trigger extraction at `max_activities` limit
   - Add "Completed Exploration" extraction reason

5. **Testing**
   - Verify rarity distribution across multiple drops
   - Verify type distribution matches percentages over time
   - Test max activities limit (set to 3 for testing, confirm extraction)

**Acceptance Criteria:**
- ✅ Rarity distribution follows MTG model
- ✅ Type distribution matches location percentages
- ✅ Activity counter works correctly
- ✅ Max activities triggers extraction
- ✅ Replacement activities spawn when avoided
- ✅ Console logs detailed spawn info

**Phase 4 Duration Estimate:** 2-3 days

---

### **Phase 5: Editor Extensions**

**Goal:** Add Location and Activity editors to JSON GUI.

**Tasks:**

1. **Schema Definitions**
   - Add `planets.json` schema to `editor/client/src/config/schemas.ts`
   - Add `locations.json` schema
   - Add `activities.json` schema
   - Define dropdown sources and array field templates

2. **Planets Editor**
   - Simple fields: id, name, subtitle, map_image
   - Image file picker for map_image

3. **Locations Editor**
   - Dropdown for `planet_id` (populated from planets.json)
   - Percentage inputs for hotspot_position (0-100 validation)
   - Dropdown for `activity_type_distribution` keys (from game_config)
   - Array management for `possible_resources`
   - Nested unlock_requirements object editing

4. **Activities Editor**
   - Dropdown for `type` (from game_config.activity_types)
   - Dropdown for `rarity` (common, uncommon, rare)
   - Stat requirements section (primary/secondary/tertiary dropdowns)
   - Percentage inputs for detection_risk, flee_chance, down_risk (0-100 validation)
   - Loot table array management
   - **Complex:** Dialogue object editor
     - Add/remove character entries
     - Dropdown for character selection (from guardians.json)
     - 5 text fields per character (initiate, engage, success, fail, downed)
     - Default dialogue section

5. **Dropdown Population**
   - `planet_id`: Load from planets.json
   - `type`: Load from game_config.activity_types
   - `stat` fields: [health, attack, defense, movement, mind]
   - `resource_id`: Load from items.json (type: resource)
   - Character names: Load from guardians.json

6. **Validation**
   - Percentage fields: 0-100 range
   - Type distribution: Warn if doesn't total 100
   - Required fields: Highlight if missing

**Acceptance Criteria:**
- ✅ Planets tab functional in editor
- ✅ Locations tab functional with all features
- ✅ Activities tab functional with dialogue editor
- ✅ Dropdowns populate from data files
- ✅ Can create/edit/delete entries
- ✅ Preview system works for visuals
- ✅ Validation warnings display

**Phase 5 Duration Estimate:** 4-6 days

---

### **Phase 6: Polish & Balance**

**Goal:** Refine UX, fix bugs, balance progression.

**Tasks:**

1. **Visual Polish**
   - Smooth transitions between map → planetfall → text chain
   - Animations for choice popups
   - Extraction button effects
   - Hotspot hover states refinement

2. **Audio Integration**
   - Choice click sounds
   - Success/fail/downed sounds
   - Extraction sound
   - Background music for text chain sequence

3. **Balance Testing**
   - Test activity difficulty curves
   - Verify loot amounts feel appropriate (4x missions)
   - Test inventory capacity (feels right to hit 20/20?)
   - Adjust detection_risk, flee_chance, down_risk percentages

4. **Bug Fixes**
   - Edge case testing (what if all activities are avoided?)
   - Save/load persistence testing
   - Multiple blueprint drops handling
   - Guardian selection persistence

5. **Performance**
   - Text chain scrolling optimization
   - Large loot table display optimization

**Acceptance Criteria:**
- ✅ No critical bugs
- ✅ Smooth UX throughout flow
- ✅ Balance feels good across 3-5 test drops
- ✅ Audio integrated (if applicable)
- ✅ Save/load works reliably

**Phase 6 Duration Estimate:** 2-4 days

---

### **Total Implementation Estimate:** 14-23 days (3-5 weeks)

---

## **7. Technical Specifications**

### **7.1 File Structure**

```
ship-life/
├── data/
│   ├── planets.json          [NEW]
│   ├── locations.json         [NEW]
│   ├── activities.json        [NEW]
│   ├── game_config.json       [NEW or UPDATE]
│   ├── guardians.json         [EXISTING]
│   ├── items.json             [EXISTING]
│   ├── missions.json          [DEPRECATED - keep for reference]
│   └── ...
├── js/
│   ├── map.js                 [NEW - Map room logic]
│   ├── activities.js          [NEW - Activity spawning/engagement]
│   ├── text_chain.js          [NEW - Text chain system]
│   ├── rooms.js               [UPDATE - Planetfall changes]
│   ├── loadout.js             [EXISTING - use for success calc]
│   ├── inventory.js           [EXISTING - use for loot]
│   ├── state.js               [UPDATE - add progression tracking]
│   └── ...
├── css/
│   ├── map.css                [NEW]
│   ├── text_chain.css         [NEW]
│   └── ...
└── assets/
    └── images/
        ├── maps/              [NEW - planet map images]
        │   └── earth_map.png
        └── locations/         [NEW - location preview images]
            ├── frozen_wastes.png
            └── ...
```

### **7.2 Key Functions**

**map.js:**
```javascript
function loadPlanetMap(planetId)
function positionHotspots(locations)
function showLocationSidebar(locationId)
function checkLocationUnlock(location, gameState)
```

**activities.js:**
```javascript
function spawnActivities(location)
function calculateRarityDistribution(activityCount)
function rollActivityType(typeDistribution)
function selectActivity(type, rarity)
function rollDetection(detectionRisk)
function rollFlee(fleeChance)
function rollDown(downRisk)
function checkActivitySuccess(guardian, loadout, activity)
function awardActivityLoot(activity)
```

**text_chain.js:**
```javascript
function initTextChain()
function addEntry(type, content)
function showChoicePopup(activity)
function handlePlayerChoice(choice)
function autoAdvance()
function pauseChain()
function resumeChain()
function showExtractionButton(reason)
```

### **7.3 Console Logging Requirements**

**Activity Spawning:**
```
=== ACTIVITY SPAWNING ===
Location: {location.name}
Activity Count: {count} ({min}-{max} range)
Rarity Distribution: {common_count} common, {rare_uncommon_count} rare/uncommon
Type Rolls:
  Slot 1: combat (roll: 45 vs [1-60])
  Slot 2: investigating (roll: 82 vs [81-95])
  Slot 3: combat (roll: 12 vs [1-60])
Spawned Activities:
  1. {activity.name} ({type}, {rarity})
  2. {activity.name} ({type}, {rarity})
  3. {activity.name} ({type}, {rarity})
```

**Success Calculations:**
```
=== ACTIVITY SUCCESS CALCULATION ===
Activity: {activity.name}
Guardian: {guardian.name}
Guardian Stats: Attack={stats.attack}, Defense={stats.defense}, etc.
Required Stats: Primary=attack(7), Secondary=defense(5)
Loadout Bonus: +{bonus}
Total Points: {points}
Difficulty Multiplier: {multiplier}
Success Rate: {base}% + {loadoutBonus}% = {final}%
Roll: {roll} vs {final}% → {SUCCESS/FAILURE}
```

**Player Choices:**
```
=== PLAYER CHOICE ===
Activity: {activity.name}
Choice: {Engage/Avoid/Flee}
Detection Roll: {roll} vs {detection_risk}% → {DETECTED/NOT DETECTED}
Flee Roll: {roll} vs {flee_chance}% → {SUCCESS/FAILURE}
Down Roll: {roll} vs {down_risk}% → {DOWNED/NOT DOWNED}
```

**Loot Rolls:**
```
=== LOOT AWARDED ===
Activity: {activity.name}
Drops:
  - {item.name} x{quantity} (rolled {min}-{max}, drop chance {chance}%)
  - {item.name} x{quantity}
Total Items: {total_count}
Inventory: {current}/{max} slots used
```

### **7.4 Integration Points**

**With Existing Mission System:**
- Use `calculateMissionSuccessRate(gameState, [guardianId], activity)` from `loadout.js`
- Treat activities like missions for success calculation
- Same stat requirements structure (primary/secondary/tertiary)

**With Inventory System:**
- Use `addToInventory(gameState, itemId, quantity)` from `inventory.js`
- Track inventory slot usage (20 slots, 3 stack limit)
- Check inventory full condition after each activity

**With Save System:**
- Add `progression` object to gameState
- Track `total_drops`, `successful_drops`, `failed_drops`
- Track `activities_completed` (aggregate + per-activity)
- Track `location_drops` (per-location counts)
- Save `last_selected_guardian`
- Auto-save after extraction

**With Editor:**
- Extend `editor/client/src/config/schemas.ts` with new schemas
- Use existing dropdown population system
- Follow existing validation patterns

---

## **8. Testing & Validation**

### **8.1 Unit Test Scenarios**

**Activity Spawning:**
- [ ] Roll 100 drops, verify rarity distribution averages match MTG model
- [ ] Verify type distribution averages match location percentages over 100 drops
- [ ] Test with activity_type_distribution totaling ≠100, verify console warning
- [ ] Test with no activities matching type+rarity filters, verify fallback

**Engagement System:**
- [ ] Test detection rolls across range of detection_risk values (0%, 50%, 100%)
- [ ] Test flee rolls across range of flee_chance values
- [ ] Test down rolls across range of down_risk values
- [ ] Verify activity counter increments correctly (completed + avoided)
- [ ] Verify max_activities triggers extraction

**Text Chain:**
- [ ] Verify all 5 entry types display correctly
- [ ] Verify auto-advance timing (measure time between entries)
- [ ] Verify pause/resume on choice popups
- [ ] Verify scrolling to bottom on new entries
- [ ] Verify history limit (add 20 entries, check only last 10 visible)

**Dialogue System:**
- [ ] Test with character-specific dialogue defined
- [ ] Test with missing character dialogue, verify default fallback
- [ ] Test with missing default dialogue, verify skip
- [ ] Test all 5 dialogue moments trigger at correct times

**Extraction:**
- [ ] Test downed extraction (force down_risk = 100%)
- [ ] Test inventory full extraction (fill inventory during drop)
- [ ] Test blueprint extraction prompt (drop blueprint, verify prompt)
- [ ] Test max activities extraction (set max_activities = 2 for testing)

### **8.2 Integration Test Scenarios**

**Full Drop Sequence:**
1. Select location → Verify sidebar displays
2. Click "Drop Here" → Navigate to Planetfall
3. Select Guardian → Verify exactly 1 selectable
4. Click "Launch" → Text chain begins
5. Encounter activity → Verify choice popup
6. Choose "Avoid" → Roll detection
7. If detected → Flee choice appears
8. Complete 2-3 activities → Verify loot accumulation
9. Hit extraction condition → Verify correct reason
10. Click "Extract" → Verify loot screen shows correct amount
11. Return to ship → Verify drop counter incremented

**Unlock Progression:**
1. Start with 1 unlocked location, 2 locked
2. Complete 5 drops in location 1
3. Verify location 2 unlocks (if requirements met)
4. Verify location 3 still locked

**Save/Load:**
1. Complete drop, extract
2. Refresh page
3. Verify progression numbers persist
4. Verify last selected guardian persists
5. Verify unlocked locations persist

### **8.3 Balance Validation**

**Activity Difficulty:**
- [ ] Difficulty 1 activities: ~80%+ success with matching stats
- [ ] Difficulty 5 activities: ~50-70% success with matching stats
- [ ] Difficulty 10 activities: ~30-50% success with optimized loadout

**Loot Amounts:**
- [ ] Average drop yields 4x single mission rewards
- [ ] Inventory full typically occurs after 3-4 activities
- [ ] Rare item drops feel appropriately rare (~10-20% of drops)

**Progression Pacing:**
- [ ] Location 2 unlocks after reasonable playtime (~1 hour)
- [ ] Location 3 unlocks after extended playtime (~2-3 hours)
- [ ] Activity completion rate encourages repeat drops to same location

**Risk/Reward:**
- [ ] Avoiding high-difficulty activities feels like smart choice
- [ ] Engaging risky activities offers meaningful loot rewards
- [ ] Detection system creates tension without feeling punishing
- [ ] Flee system provides escape valve without trivializing encounters

### **8.4 Edge Cases**

- [ ] Player avoids all activities (hits max_activities without completing any)
- [ ] Player gets downed on first activity
- [ ] Player finds blueprint on first activity, extracts immediately
- [ ] Multiple blueprints drop in single activity
- [ ] Location type distribution is invalid (doesn't total 100)
- [ ] No activities match spawn filters (log warning, pick random activity)
- [ ] Player refreshes during text chain (session lost, acceptable)
- [ ] Inventory exactly fills on last activity (extraction triggers correctly)

---

## **Appendix A: Sample Data**

### **Sample Planets.json**

```json
[
  {
    "id": "earth",
    "name": "Earth",
    "subtitle": "Humanity's Homeworld",
    "map_image": "assets/images/maps/earth_map.png"
  }
]
```

### **Sample Locations.json**

```json
[
  {
    "id": "frozen_wastes",
    "planet_id": "earth",
    "name": "Frozen Wastes",
    "description": "A harsh arctic region with limited visibility and extreme cold. Ruins of ancient structures dot the landscape.",
    "location_image": "assets/images/locations/frozen_wastes.png",
    "hotspot_position": {"x": 25.5, "y": 40.0},
    "locked": false,
    "unlock_requirements": {
      "drop_count": 0,
      "activities_completed": 0,
      "specific_activities": []
    },
    "activity_spawn_range": {"min": 2, "max": 4},
    "max_activities": 5,
    "activity_type_distribution": {
      "combat": 60,
      "resource_gathering": 20,
      "investigating": 15,
      "puzzle": 5
    },
    "possible_resources": ["ice_crystals", "frozen_metal", "cryo_cells"]
  },
  {
    "id": "burning_plains",
    "planet_id": "earth",
    "name": "Burning Plains",
    "description": "Volcanic wastelands with rivers of lava and ash storms. High danger, high reward.",
    "location_image": "assets/images/locations/burning_plains.png",
    "hotspot_position": {"x": 65.0, "y": 55.0},
    "locked": true,
    "unlock_requirements": {
      "drop_count": 5,
      "activities_completed": 10,
      "specific_activities": []
    },
    "activity_spawn_range": {"min": 3, "max": 4},
    "max_activities": 6,
    "activity_type_distribution": {
      "combat": 70,
      "resource_gathering": 15,
      "investigating": 10,
      "puzzle": 5
    },
    "possible_resources": ["lava_core", "heat_cells", "obsidian_shards"]
  },
  {
    "id": "crystal_caves",
    "planet_id": "earth",
    "name": "Crystal Caves",
    "description": "Underground cavern systems filled with luminescent crystals and strange echoes.",
    "location_image": "assets/images/locations/crystal_caves.png",
    "hotspot_position": {"x": 45.0, "y": 25.0},
    "locked": true,
    "unlock_requirements": {
      "drop_count": 10,
      "activities_completed": 20,
      "specific_activities": []
    },
    "activity_spawn_range": {"min": 2, "max": 3},
    "max_activities": 5,
    "activity_type_distribution": {
      "combat": 40,
      "resource_gathering": 30,
      "investigating": 20,
      "puzzle": 10
    },
    "possible_resources": ["crystal_shards", "resonance_cores", "rare_minerals"]
  }
]
```

### **Sample Activities.json**

```json
[
  {
    "id": "patrol_encounter",
    "name": "Enemy Patrol",
    "description": "A small patrol of hostiles moving through the area. They look alert but not heavily armed.",
    "type": "combat",
    "rarity": "common",
    "difficulty": 2,
    "stat_requirements": {
      "primary": {"stat": "attack", "value": 4},
      "secondary": {"stat": "movement", "value": 3}
    },
    "detection_risk": 40,
    "flee_chance": 60,
    "down_risk": 20,
    "loot_table": [
      {"resource_id": "metal_scraps", "min": 2, "max": 5, "drop_chance": 100},
      {"resource_id": "energy_cells", "min": 1, "max": 2, "drop_chance": 50}
    ],
    "dialogue": {
      "stella": {
        "initiate": "Contact ahead. Looks like a patrol.",
        "engage": "Taking them down!",
        "success": "Patrol neutralized.",
        "fail": "They're tougher than they look!",
        "downed": "I'm hit... going down."
      },
      "default": {
        "initiate": "The guardian spots an enemy patrol.",
        "engage": "The guardian engages the patrol.",
        "success": "The guardian defeats the patrol.",
        "fail": "The guardian is pushed back.",
        "downed": "The guardian has been downed."
      }
    }
  },
  {
    "id": "crashed_ship",
    "name": "Crashed Ship",
    "description": "The wreckage of a Republic transport. Looks like it went down recently.",
    "type": "investigating",
    "rarity": "uncommon",
    "difficulty": 3,
    "stat_requirements": {
      "primary": {"stat": "mind", "value": 5},
      "secondary": {"stat": "defense", "value": 3}
    },
    "detection_risk": 10,
    "flee_chance": 80,
    "down_risk": 30,
    "loot_table": [
      {"resource_id": "tech_components", "min": 3, "max": 7, "drop_chance": 100},
      {"resource_id": "data_core", "min": 1, "max": 1, "drop_chance": 30},
      {"resource_id": "weapon_blueprint", "min": 1, "max": 1, "drop_chance": 10}
    ],
    "dialogue": {
      "vawn": {
        "initiate": "Wreckage detected. Running scans.",
        "engage": "Investigating the crash site.",
        "success": "Salvage acquired.",
        "fail": "Structural collapse! Moving out.",
        "downed": "Systems damaged... can't continue."
      },
      "default": {
        "initiate": "The guardian discovers a crashed ship.",
        "engage": "The guardian searches the wreckage.",
        "success": "The guardian finds valuable salvage.",
        "fail": "The guardian triggers a collapse.",
        "downed": "The guardian is trapped in the debris."
      }
    }
  },
  {
    "id": "giant_robot_combat",
    "name": "Giant Robot",
    "description": "A massive combat robot patrols the area. It looks large and very well armored, but doesn't seem to have a lot of weapons on it.",
    "type": "combat",
    "rarity": "rare",
    "difficulty": 7,
    "stat_requirements": {
      "primary": {"stat": "attack", "value": 9},
      "secondary": {"stat": "defense", "value": 7},
      "tertiary": {"stat": "movement", "value": 4}
    },
    "detection_risk": 30,
    "flee_chance": 40,
    "down_risk": 70,
    "loot_table": [
      {"resource_id": "metal_scraps", "min": 8, "max": 15, "drop_chance": 100},
      {"resource_id": "energy_cells", "min": 3, "max": 6, "drop_chance": 100},
      {"resource_id": "tech_components", "min": 2, "max": 4, "drop_chance": 80},
      {"resource_id": "armor_blueprint", "min": 1, "max": 1, "drop_chance": 20}
    ],
    "dialogue": {
      "stella": {
        "initiate": "Big one ahead!",
        "engage": "Let's scrap this thing!",
        "success": "Another pile of junk!",
        "fail": "It's too strong!",
        "downed": "It got me. I'm downed."
      },
      "tiberius": {
        "initiate": "Impressive construction.",
        "engage": "Analyzing weak points... engaging!",
        "success": "Target dismantled.",
        "fail": "Tactical withdrawal required.",
        "downed": "Critical damage sustained. Going dark."
      },
      "default": {
        "initiate": "The guardian spots a giant robot.",
        "engage": "The guardian engages the robot.",
        "success": "The guardian defeats the robot.",
        "fail": "The guardian is overwhelmed.",
        "downed": "The guardian has been downed."
      }
    }
  },
  {
    "id": "resource_node",
    "name": "Resource Node",
    "description": "A natural deposit of valuable minerals. Scanning shows high concentrations.",
    "type": "resource_gathering",
    "rarity": "common",
    "difficulty": 1,
    "stat_requirements": {
      "primary": {"stat": "mind", "value": 2}
    },
    "detection_risk": 0,
    "flee_chance": 90,
    "down_risk": 5,
    "loot_table": [
      {"resource_id": "metal_scraps", "min": 5, "max": 10, "drop_chance": 100},
      {"resource_id": "rare_minerals", "min": 1, "max": 3, "drop_chance": 40}
    ],
    "dialogue": {
      "default": {
        "initiate": "The guardian discovers a resource node.",
        "engage": "The guardian extracts resources.",
        "success": "Resources gathered successfully.",
        "fail": "The node collapses before extraction completes.",
        "downed": "A cave-in occurs during extraction."
      }
    }
  },
  {
    "id": "puzzle_terminal",
    "name": "Ancient Terminal",
    "description": "A pre-war computer terminal. The interface is complex but potentially valuable.",
    "type": "puzzle",
    "rarity": "uncommon",
    "difficulty": 4,
    "stat_requirements": {
      "primary": {"stat": "mind", "value": 6},
      "secondary": {"stat": "defense", "value": 3}
    },
    "detection_risk": 5,
    "flee_chance": 85,
    "down_risk": 15,
    "loot_table": [
      {"resource_id": "data_core", "min": 2, "max": 4, "drop_chance": 100},
      {"resource_id": "tech_components", "min": 1, "max": 3, "drop_chance": 60},
      {"resource_id": "tech_blueprint", "min": 1, "max": 1, "drop_chance": 15}
    ],
    "dialogue": {
      "maestra": {
        "initiate": "Fascinating. Pre-war technology.",
        "engage": "Interfacing with the system.",
        "success": "Data retrieved successfully.",
        "fail": "Encryption too complex. Locked out.",
        "downed": "Security countermeasure triggered!"
      },
      "default": {
        "initiate": "The guardian finds an ancient terminal.",
        "engage": "The guardian attempts to access the terminal.",
        "success": "The guardian extracts valuable data.",
        "fail": "The guardian is locked out of the system.",
        "downed": "A security system activates."
      }
    }
  },
  {
    "id": "ambush_site",
    "name": "Hostile Ambush",
    "description": "You've walked into a trap! Enemies are closing in from multiple directions.",
    "type": "combat",
    "rarity": "rare",
    "difficulty": 6,
    "stat_requirements": {
      "primary": {"stat": "attack", "value": 8},
      "secondary": {"stat": "health", "value": 6},
      "tertiary": {"stat": "defense", "value": 5}
    },
    "detection_risk": 80,
    "flee_chance": 30,
    "down_risk": 60,
    "loot_table": [
      {"resource_id": "metal_scraps", "min": 6, "max": 12, "drop_chance": 100},
      {"resource_id": "energy_cells", "min": 2, "max": 5, "drop_chance": 100},
      {"resource_id": "weapon_blueprint", "min": 1, "max": 1, "drop_chance": 25}
    ],
    "dialogue": {
      "stella": {
        "initiate": "Wait... something's wrong.",
        "engage": "It's a trap! Fight your way out!",
        "success": "They didn't expect us to be this tough!",
        "fail": "Too many of them!",
        "downed": "Can't... hold them off..."
      },
      "default": {
        "initiate": "The guardian senses danger.",
        "engage": "The guardian fights off the ambush.",
        "success": "The guardian survives the ambush.",
        "fail": "The guardian is surrounded.",
        "downed": "The guardian is overwhelmed by numbers."
      }
    }
  },
  {
    "id": "abandoned_outpost",
    "name": "Abandoned Outpost",
    "description": "An old Republic outpost, long since abandoned. Signs of a hasty evacuation.",
    "type": "investigating",
    "rarity": "common",
    "difficulty": 2,
    "stat_requirements": {
      "primary": {"stat": "mind", "value": 3},
      "secondary": {"stat": "movement", "value": 2}
    },
    "detection_risk": 15,
    "flee_chance": 75,
    "down_risk": 10,
    "loot_table": [
      {"resource_id": "tech_components", "min": 2, "max": 5, "drop_chance": 100},
      {"resource_id": "medical_supplies", "min": 1, "max": 3, "drop_chance": 60}
    ],
    "dialogue": {
      "default": {
        "initiate": "The guardian discovers an abandoned outpost.",
        "engage": "The guardian searches the outpost.",
        "success": "The guardian finds useful supplies.",
        "fail": "The outpost is empty.",
        "downed": "A structural collapse occurs."
      }
    }
  },
  {
    "id": "encrypted_cache",
    "name": "Encrypted Cache",
    "description": "A locked storage container with complex security protocols. Valuable, but risky.",
    "type": "puzzle",
    "rarity": "rare",
    "difficulty": 8,
    "stat_requirements": {
      "primary": {"stat": "mind", "value": 10},
      "secondary": {"stat": "defense", "value": 5}
    },
    "detection_risk": 0,
    "flee_chance": 95,
    "down_risk": 40,
    "loot_table": [
      {"resource_id": "data_core", "min": 3, "max": 6, "drop_chance": 100},
      {"resource_id": "rare_minerals", "min": 2, "max": 4, "drop_chance": 80},
      {"resource_id": "aspect_blueprint", "min": 1, "max": 1, "drop_chance": 30}
    ],
    "dialogue": {
      "maestra": {
        "initiate": "Encrypted cache detected. High-value target.",
        "engage": "Beginning decryption sequence.",
        "success": "Access granted. Cache contents secured.",
        "fail": "Encryption algorithm too advanced.",
        "downed": "Security countermeasure! Systems offline!"
      },
      "default": {
        "initiate": "The guardian finds an encrypted cache.",
        "engage": "The guardian attempts to decrypt the cache.",
        "success": "The guardian opens the cache.",
        "fail": "The guardian fails to crack the encryption.",
        "downed": "A security system activates and shocks the guardian."
      }
    }
  }
]
```

### **Sample Game Config (Addition)**

```json
{
  "activity_types": [
    "combat",
    "resource_gathering",
    "investigating",
    "puzzle"
  ]
}
```

---

## **Appendix B: Cline Implementation Instructions**

This section contains step-by-step instructions for Cline to implement each phase. Follow these carefully and verify each step before proceeding to the next.

### **Phase 1 Implementation Guide**

**Step 1: Create Data Files**

1. Create `data/planets.json`:
   - Copy sample structure from Appendix A
   - Verify JSON is valid

2. Create `data/locations.json`:
   - Copy sample structure with 3 locations
   - Ensure 1 is unlocked (`"locked": false`), 2 are locked

3. Create `data/activities.json`:
   - Copy 8 sample activities from Appendix A
   - Mix of types and rarities

4. Update or create `data/game_config.json`:
   - Add `"activity_types"` array
   - Preserve any existing config

**Step 2: Create Map Room UI**

1. Create `js/map.js`:
   ```javascript
   async function loadMapRoom() {
     const planets = await loadJSON('data/planets.json');
     const locations = await loadJSON('data/locations.json');
     renderPlanetMap(planets[0], locations.filter(l => l.planet_id === planets[0].id));
   }
   
   function renderPlanetMap(planet, locations) {
     // Display planet.map_image as background
     // Create hotspots for each location
     // Wire up click handlers
   }
   
   function renderHotspot(location) {
     // Create pin element
     // Position at location.hotspot_position
     // Apply locked/unlocked styling
     // Add hover tooltip
   }
   
   function showSidebar(location) {
     // Display location info
     // Show "Drop Here" button if unlocked
     // Show unlock requirements if locked
   }
   ```

2. Create `css/map.css`:
   - Style for planet background container
   - Hotspot pin styling (circle + line)
   - Locked vs unlocked states
   - Sidebar styling
   - Responsive positioning

3. Update `js/rooms.js`:
   - Change mission_computer case to call `loadMapRoom()`
   - Keep navigation intact

**Step 3: Update Planetfall Room**

1. In `js/rooms.js`, find `toggleGuardianSelection()`:
   - Change max selection from 4 to 1
   - Update logic to replace selection instead of adding

2. Update UI to show single selection clearly:
   - Add visual emphasis to selected Guardian
   - Update success rate display for single Guardian

3. Add to save state:
   - `last_selected_guardian` field
   - Save on selection, load on planetfall room entry

**Step 4: Basic Activity Spawning**

1. Create `js/activities.js`:
   ```javascript
   function spawnActivities(location) {
     const count = randomInt(location.activity_spawn_range.min, location.activity_spawn_range.max);
     const allActivities = window.activitiesData; // Loaded from activities.json
     
     const spawned = [];
     for (let i = 0; i < count; i++) {
       const activity = allActivities[randomInt(0, allActivities.length - 1)];
       spawned.push(activity);
     }
     
     console.log('=== ACTIVITY SPAWNING ===');
     console.log(`Location: ${location.name}`);
     console.log(`Activity Count: ${count}`);
     console.log('Spawned Activities:', spawned.map(a => a.name));
     
     return spawned;
   }
   ```

2. Update `js/main.js`:
   - Load activities.json on init
   - Store in `window.activitiesData`

3. Store spawned activities in session:
   - Add to gameState: `current_drop = { location, activities, guardian }`

**Step 5: Use Old Loading Bar Temporarily**

1. On "Launch" click:
   - Spawn activities
   - Calculate total loot (all activities successful for now)
   - Show old loading bar
   - Award 4x loot on completion

2. Update loot screen:
   - Show "Survived" banner
   - Display loot (should be ~4x typical mission)

3. Increment drop counter:
   - `gameState.progression.total_drops++`
   - `gameState.progression.successful_drops++`
   - Auto-save

**Verification Checklist:**
- [ ] Map displays with planet image
- [ ] 3 hotspots visible and clickable
- [ ] Sidebar shows correct info
- [ ] Locked locations show requirements
- [ ] Can select exactly 1 Guardian
- [ ] Launch triggers loading bar
- [ ] Loot screen shows 4x rewards
- [ ] Drop counter increments
- [ ] Save/load persists selected Guardian

---

**END OF DESIGN DOCUMENT**
