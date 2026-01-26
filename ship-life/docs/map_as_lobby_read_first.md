# Ship Life: Location-Based Exploration - Implementation Primer for Cline

## READ THIS FIRST BEFORE STARTING IMPLEMENTATION

---

## Overview

You are implementing a major redesign of Ship Life's core gameplay loop. The game is transitioning from **mission-based selection** to **location-based exploration** with dynamic activities, player choices, and inventory management.

**Critical Context:**
- This is a working game with existing systems
- We are EXTENDING, not replacing most systems
- Missions are deprecated but keep the code for reference
- All new content must be JSON-driven (no hardcoding)

---

## What You're Building

### Old System → New System

| Before | After |
|--------|-------|
| Pick a specific mission | Pick a large location zone |
| Select up to 4 Guardians | Select exactly 1 Guardian |
| Complete single mission | Encounter 2-4 dynamic activities |
| Text loading bar | Interactive text chain with choices |
| Fixed mission rewards | Inventory fills up over time |

### The Player Experience

1. **Ship** → Click "Map" button
2. **Map Room** → View planet, click location hotspot, read sidebar, click "Drop Here"
3. **Planetfall Room** → Select 1 Guardian, equip loadout, click "Launch"
4. **Text Chain** → Watch story unfold, make choices (Engage/Avoid/Flee)
5. **Activities** → Complete 2-4 activities, collect loot
6. **Extraction** → Extract when inventory full/downed/rare item/max activities
7. **Loot Screen** → See all collected resources (4x typical mission)
8. **Ship** → Spend resources at workstations, repeat

---

## Project Structure You Need to Know

```
ship-life/
├── data/                    # JSON files (you'll add planets, locations, activities)
│   ├── guardians.json      # Character stats (EXISTING - DON'T MODIFY)
│   ├── items.json          # Resources, equipment (EXISTING - DON'T MODIFY)
│   ├── missions.json       # Old system (DEPRECATED - KEEP FOR REFERENCE)
│   └── ...
├── js/
│   ├── main.js             # Entry point, loads all data
│   ├── rooms.js            # Room navigation, Planetfall Portal
│   ├── loadout.js          # Success rate calculations (USE THIS)
│   ├── inventory.js        # Inventory management (USE THIS)
│   ├── state.js            # Save/load system (USE THIS)
│   └── ...
├── css/
│   └── ...
└── assets/
    └── images/
```

---

## Critical Technical Details

### 1. Guardian Selection Limit

**Current Code (rooms.js):**
```javascript
if (window.selectedGuardians.length < 4) {
    window.selectedGuardians.push(guardianId);
}
```

**Your Change:**
```javascript
if (window.selectedGuardians.length < 1) {
    window.selectedGuardians.push(guardianId);
} else {
    // Replace selection
    window.selectedGuardians = [guardianId];
}
```

### 2. Success Rate Calculation

**DO NOT REWRITE THIS.** Use the existing function:
```javascript
// From loadout.js - already implemented
calculateMissionSuccessRate(gameState, [guardianId], activityObject)
```

Activities use the same stat structure as missions:
```javascript
{
  "stat_requirements": {
    "primary": {"stat": "attack", "value": 7},
    "secondary": {"stat": "defense", "value": 5}
  }
}
```

### 3. Inventory Management

**DO NOT REWRITE THIS.** Use existing functions:
```javascript
// From inventory.js
addToInventory(gameState, itemId, quantity);
```

**New Constraint:**
- 20 slots total
- 3 items stack per slot
- Track: `current_slots_used = total_unique_items`

### 4. Blueprint Detection

Items already have `type: "blueprint"` field:
```javascript
function containsBlueprint(lootArray) {
  return lootArray.some(item => {
    const itemData = window.itemsData.find(i => i.id === item.resource_id);
    return itemData && itemData.type === 'blueprint';
  });
}
```

### 5. Save State Updates

**Add these to existing save structure:**
```javascript
{
  "progression": {
    "total_drops": 0,
    "successful_drops": 0,
    "failed_drops": 0,
    "activities_completed": {
      "_total": 0,
      "giant_robot_combat": 0,
      // ... per activity tracking
    }
  },
  "last_selected_guardian": "stella",
  "current_drop": {
    "location": null,
    "activities": [],
    "guardian": null,
    "loot": []
  }
}
```

---

## Console Logging Requirements

**EVERY system must log detailed info.** Examples:

```javascript
// Activity spawning
console.log('=== ACTIVITY SPAWNING ===');
console.log(`Location: ${location.name}`);
console.log(`Activity Count: ${count} (${min}-${max} range)`);
console.log('Spawned:', activities.map(a => `${a.name} (${a.type}, ${a.rarity})`));

// Success calculations
console.log('=== ACTIVITY SUCCESS ===');
console.log(`Activity: ${activity.name}`);
console.log(`Guardian: ${guardian.name}`);
console.log(`Success Rate: ${rate}%`);
console.log(`Roll: ${roll} → ${success ? 'SUCCESS' : 'FAILURE'}`);

// Player choices
console.log('=== PLAYER CHOICE ===');
console.log(`Choice: ${choice}`);
console.log(`Detection Roll: ${roll} vs ${detectionRisk}% → ${detected ? 'DETECTED' : 'AVOIDED'}`);
```

---

## Implementation Phases

### Phase 1: Foundation (Start Here)
- Create planets.json, locations.json, activities.json
- Build map room UI with clickable hotspots
- Update Planetfall to allow only 1 Guardian
- Use old loading bar temporarily
- Verify drop flow works end-to-end

### Phase 2: Text Chain & Choices
- Replace loading bar with scrolling text chain
- Implement choice popups (Engage/Avoid/Flee)
- Add detection & flee mechanics
- Implement extraction conditions

### Phase 3: Dialogue System
- Load character-specific dialogue
- Display Guardian portrait + text
- Handle fallbacks (default dialogue)

### Phase 4: Rarity & Type Distribution
- Implement MTG-style rarity distribution
- Add activity type filtering
- Implement max activities counter
- Add replacement spawning

### Phase 5: Editor Extensions
- Add Location editor tab
- Add Activity editor tab
- Complex dialogue editor UI

---

## Common Pitfalls to Avoid

### ❌ DON'T:
- Rewrite existing success calculation logic
- Hardcode activity data in JavaScript
- Remove mission.json file or code
- Change Guardian stat structure
- Modify items.json blueprint types
- Create new save/load systems

### ✅ DO:
- Use existing `calculateMissionSuccessRate()` function
- Put all content in JSON files
- Keep mission code for reference
- Use existing inventory functions
- Check for `type: "blueprint"` in items
- Extend existing save structure

---

## Testing Strategy

After each phase:

1. **Manual Testing:**
   - Play through complete drop cycle
   - Test all button clicks
   - Verify console logs appear
   - Check save/load works

2. **Edge Cases:**
   - What if player avoids all activities?
   - What if player gets downed on first activity?
   - What if no activities match spawn filters?

3. **Data Validation:**
   - JSON files are valid
   - Percentages are 0-100
   - Required fields exist
   - IDs match between files

---

## When You Get Stuck

1. **Check the full Design Document** for detailed specifications
2. **Look at existing code patterns** in missions.js, rooms.js, loadout.js
3. **Verify JSON structure** matches examples in Appendix A
4. **Check console logs** for errors
5. **Test with minimal data** (1 location, 2 activities)

---

## Success Criteria for Phase 1

Before moving to Phase 2, verify:
- ✅ Map displays with 3 hotspots
- ✅ Clicking hotspot shows sidebar
- ✅ Locked locations show requirements
- ✅ Can select exactly 1 Guardian
- ✅ Launch → Loading bar → Loot screen
- ✅ Loot shows ~4x typical mission
- ✅ Drop counter increments
- ✅ Save/load persists Guardian selection
- ✅ Console logs all activity spawning

---

## File Locations Reference

**New Files You'll Create:**
- `data/planets.json`
- `data/locations.json`
- `data/activities.json`
- `data/game_config.json` (or update existing)
- `js/map.js`
- `js/activities.js`
- `js/text_chain.js` (Phase 2)
- `css/map.css`
- `css/text_chain.css` (Phase 2)

**Files You'll Modify:**
- `js/main.js` (load new JSON files)
- `js/rooms.js` (update Planetfall, add map room)
- `js/state.js` (add progression tracking)

**Files You'll Reference But Not Change:**
- `js/loadout.js` (use calculateMissionSuccessRate)
- `js/inventory.js` (use addToInventory)
- `data/guardians.json` (read Guardian stats)
- `data/items.json` (read item types)

---

## Quick Start Commands

```bash
# Verify JSON files are valid
node -e "console.log(JSON.parse(require('fs').readFileSync('data/planets.json')))"

# Start local server (if needed)
# Check START_SERVER.bat or use python -m http.server

# Open browser console to see logs
# F12 → Console tab
```

---

## Final Reminders

- **Read the full Design Document** before implementing
- **Work in small, testable chunks**
- **Verify each step before moving on**
- **Log everything to console**
- **Test with real gameplay after each phase**
- **Don't be clever - follow the spec**

Good luck! 🚀