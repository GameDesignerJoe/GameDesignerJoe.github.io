# Scene Trigger System - Implementation Summary

## Overview
Implemented a comprehensive scene trigger system that allows scenes to automatically play based on game events. Scenes are now data-driven and can be configured entirely in `scenes.json` without code changes.

---

## ✅ What Was Implemented

### 1. Core Trigger System (cinematics.js)
Added new functions to handle automatic scene triggering:

- `checkSceneTriggers(triggerType, context)` - Main function to check and play matching scenes
- `meetsSceneConditions(scene, context)` - Validates trigger conditions
- `hasScenePlayed(sceneId)` / `markScenePlayed(sceneId)` - Track play history
- `hasSceneFlag(flag)` / `setSceneFlag(flag)` - Manage scene flags for complex triggers

### 2. Six Trigger Types

| Trigger Type | When It Fires | Hook Location |
|-------------|---------------|---------------|
| **game_start** | After clicking PLAY button (before character select) | `rooms.js` - renderLandingPage() |
| **before_drop** | Before "Drop Here" → planetfall | `map.js` - selectLocation() |
| **after_extraction** | After successful extraction | `text_chain.js` - handleExtraction() |
| **location_first_visited** | First time at specific location | `map.js` - selectLocation() |
| **activity_encountered** | Before activity text chain shows | `text_chain.js` - processNextActivity() |
| **activity_completed** | After successful activity resolution | `text_chain.js` - handleActivitySuccess() |

### 3. Game State Additions

Two new properties track scene playback:

```javascript
gameState.scenes_played = {
  "intro_story": { played: true, times: 1 }
};

gameState.scene_flags = {
  "seen_frozen_wastes_intro": true,
  "tutorial_completed": true
};
```

### 4. Editor Schema Update

Added comprehensive trigger configuration support to scenes.json editor:
- Dropdown for trigger types
- Dropdown for location_id (pulls from locations.json)
- Dropdown for activity_id (pulls from activities.json)
- Optional fields for all trigger conditions
- Helpful tooltips explaining each field

---

## 📊 Data Structure

### scenes.json - Add `trigger` Object

```json
{
  "scene_id": "intro_story",
  "name": "Opening Story",
  "trigger": {
    "type": "game_start",
    "play_once": true
  },
  "default_fade_duration": 1.0,
  "events": [...]
}
```

### Trigger Conditions Reference

#### Common Conditions (All Types)
- `type` (required): Trigger type string
- `play_once` (optional): Boolean - only play once ever

#### Specific Conditions by Type

**game_start**
```json
{
  "type": "game_start",
  "play_once": true
}
```

**before_drop**
```json
{
  "type": "before_drop",
  "drop_count": 0,           // Play before 1st drop (editor displays as "1", stores as 0)
  "location_id": "frozen_wastes",  // Optional: specific location
  "play_once": true
}
```

**after_extraction**
```json
{
  "type": "after_extraction",
  "successful_drops": 4,     // After 5th successful extraction (editor displays as "5", stores as 4)
  "play_once": true
}
```

**location_first_visited**
```json
{
  "type": "location_first_visited",
  "location_id": "frozen_wastes",  // Required
  "flag": "visited_frozen_wastes"  // Flag to set/check
}
```

**activity_encountered**
```json
{
  "type": "activity_encountered",
  "activity_id": "ancient_ruins",  // Specific activity
  "play_once": true
}
```

**activity_completed**
```json
{
  "type": "activity_completed",
  "activity_id": "boss_fight",
  "play_once": true
}
```

---

## ⚠️ Conflict Handling

If multiple scenes match the same trigger:
1. Console warning is logged: `⚠️ SCENE TRIGGER CONFLICT`
2. Lists all matching scene IDs
3. Randomly selects one to play
4. **User must fix** by adjusting trigger conditions

---

## 🎮 Usage Examples

### Example 1: Game Opening Cinematic
```json
{
  "scene_id": "game_intro",
  "name": "Welcome to FellowDivers",
  "trigger": {
    "type": "game_start",
    "play_once": true
  },
  "events": [...]
}
```

### Example 2: Tutorial on First Drop
```json
{
  "scene_id": "first_drop_tutorial",
  "name": "How to Drop",
  "trigger": {
    "type": "before_drop",
    "drop_count": 0,
    "play_once": true
  },
  "events": [...]
}
```

### Example 3: Location Discovery
```json
{
  "scene_id": "discover_frozen_wastes",
  "name": "Northern Precipice Discovery",
  "trigger": {
    "type": "location_first_visited",
    "location_id": "frozen_wastes",
    "flag": "discovered_northern_precipice"
  },
  "events": [...]
}
```

### Example 4: Boss Encounter
```json
{
  "scene_id": "boss_intro",
  "name": "Ancient Guardian Awakens",
  "trigger": {
    "type": "activity_encountered",
    "activity_id": "ancient_guardian_boss",
    "play_once": true
  },
  "events": [...]
}
```

### Example 5: Victory Celebration
```json
{
  "scene_id": "first_victory",
  "name": "First Successful Extraction",
  "trigger": {
    "type": "after_extraction",
    "successful_drops": 1,
    "play_once": true
  },
  "events": [...]
}
```

---

## 🔧 Technical Details

### Modified Files
1. **ship-life/js/cinematics.js** - Added ~150 lines of trigger system code
2. **ship-life/js/main.js** - Hooked game_start trigger
3. **ship-life/js/map.js** - Hooked before_drop and location_first_visit triggers
4. **ship-life/js/text_chain.js** - Hooked activity_encountered, activity_completed, and after_extraction triggers
5. **ship-life/editor/client/src/config/schemas.ts** - Added trigger configuration UI

### Key Implementation Notes

**Async/Await Pattern**
All trigger hooks use `await` to ensure scenes complete before continuing game flow:
```javascript
await checkSceneTriggers('before_drop', { location_id: location.id });
// Game continues after scene finishes
```

**Context Objects**
Each trigger type passes relevant context:
```javascript
await checkSceneTriggers('activity_completed', {
  activity_id: activity.id,
  result: 'success'
});
```

**Skip Button**
All scenes have skip button (already existed) - no changes needed.

**No Breaking Changes**
- Scenes without triggers work exactly as before
- Existing `playCinematic(sceneId)` function unchanged
- Backward compatible with old scene data

---

## 🧪 Testing Checklist

- [ ] Test game_start trigger on first play
- [ ] Test before_drop trigger at specific drop counts
- [ ] Test location_first_visit with different locations
- [ ] Test activity_encountered with specific activities
- [ ] Test activity_completed after successful activity
- [ ] Test after_extraction at specific successful drop counts
- [ ] Test play_once flag prevents replays
- [ ] Test scene flags prevent re-triggers
- [ ] Test conflict warning when multiple scenes match
- [ ] Test editor: Add trigger to scene
- [ ] Test editor: Dropdowns populate correctly

---

## 💡 Future Enhancements

Potential additions (not implemented):

1. **Repeat Patterns**: "Every N drops" triggers
2. **Stat Requirements**: Trigger based on guardian stats
3. **Inventory Checks**: Trigger when player has specific items
4. **Complex Conditions**: AND/OR logic between conditions
5. **Failure Triggers**: Separate triggers for failed activities/drops
6. **Time-Based**: Trigger after certain playtime

---

## 🐛 Known Limitations

1. **Exact Match Only**: drop_count and successful_drops use exact match (not "at least")
2. **Success Only**: activity_completed only triggers on success (failure not implemented)
3. **Manual Conflict Resolution**: No automatic priority system for conflicting scenes

---

## 📝 Migration Guide

### For Existing Scenes

Old scenes without triggers continue to work:
```json
{
  "scene_id": "test_simple",
  "name": "Test Scene",
  "events": [...]
}
```

### Adding Triggers to Existing Scenes

Simply add a `trigger` object:
```json
{
  "scene_id": "test_simple",
  "name": "Test Scene",
  "trigger": {
    "type": "game_start",
    "play_once": true
  },
  "events": [...]
}
```

---

## 🎉 Success Criteria Met

✅ Triggers stored on scenes (data-driven)  
✅ Six trigger types implemented  
✅ Warning on conflicts + random selection  
✅ Skip button already exists  
✅ play_once flag prevents repeats  
✅ Specific IDs only for activities  
✅ Success-only for now (failure deferred)  
✅ Editor schema updated with full configuration  
✅ No breaking changes to existing functionality  

---

## 📚 Related Documentation

- See `scenes.json` for trigger examples
- See `cinematics.js` for implementation details
- See editor tooltips for field-level help

---

## 📝 Editor User-Friendly Features

**Drop Count & Successful Drops Display:**
- The editor displays these values with a +1 offset for user-friendliness
- User enters: `1` (meaning "first drop") → Stored in JSON as: `0`
- User enters: `5` (meaning "fifth extraction") → Stored in JSON as: `4`
- This makes the editor more intuitive while maintaining 0-based internal logic

---

**Implementation Date**: January 27, 2026  
**Last Updated**: January 27, 2026  
**Status**: ✅ Complete and Ready for Testing
