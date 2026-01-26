# Phase 1 Implementation Summary - Map as Lobby System

## Overview
This document summarizes the Phase 1 implementation of the "Map as Lobby" system for Ship Life. This is a major architectural change that replaces the mission selection system with a planetary map interface where players select locations to drop into.

## What Was Implemented

### 1. New Data Files Created

#### `data/planets.json`
- Defines available planets (currently just Earth for Phase 1)
- Contains planet metadata: id, name, subtitle, map_image

#### `data/locations.json`
- Defines drop locations on each planet
- Each location includes:
  - Basic info (id, name, description, image)
  - Hotspot position for map pins (x, y coordinates as percentages)
  - Lock status and unlock requirements
  - Activity spawn rules (min/max activities to generate)
  - Activity type distribution weights
  - Possible resources that can be found

#### `data/activities.json`
- Defines individual activities that can spawn at locations
- Each activity includes:
  - Type (combat, investigating, resource_gathering, puzzle)
  - Difficulty and rarity
  - Stat requirements
  - Risk factors (detection_risk, flee_chance, down_risk)
  - Loot tables with drop chances
  - Character-specific dialogue

#### `data/game_config.json`
- Simple configuration file
- Currently just lists activity types

### 2. New JavaScript Systems

#### `js/map.js`
- **loadMapRoom()**: Loads the map interface
- **renderPlanetMap()**: Renders the map with hotspots
- **createHotspot()**: Creates clickable location pins
- **checkLocationUnlock()**: Checks if locations are unlocked based on player progression
- **showLocationSidebar()**: Displays location details in a sliding sidebar
- **selectLocation()**: Handles location selection and spawns activities

#### `js/activities.js`
- **spawnActivities()**: Randomly generates activities for a location (Phase 1: simple random)
- **calculateActivityLoot()**: Calculates loot rewards from completed activities
- **awardActivityLoot()**: Awards loot to player inventory

### 3. New Styles

#### `css/map.css`
- Map container and background styles
- Hotspot pin animations (pulsing effect)
- Location sidebar with slide-in animation
- Responsive design for different screen sizes

### 4. Modified Files

#### `js/main.js`
- Added loading of new data files (planets, locations, activities, game_config)
- Stores new data in window globals for access throughout the game

#### `js/rooms.js`
- Changed mission_computer room to call `loadMapRoom()` instead of rendering mission list
- Modified guardian selection to only allow 1 guardian (Phase 1 limitation)
- Updated planetfall portal text from "Select Squad (1-4 Guardians)" to "Select 1 Guardian"
- Guardian selection now replaces previous selection instead of limiting to 4

#### `game.html`
- Added `<link>` for css/map.css
- Added `<script>` tags for js/activities.js and js/map.js
- Inserted before rooms.js to ensure proper load order

## Key Design Decisions

### Phase 1 Simplifications
1. **Single Guardian**: Only 1 guardian can be selected per drop (easier to balance)
2. **Simple Activity Spawning**: Activities are randomly selected (no rarity or type weighting yet)
3. **Auto-Success Activities**: All activities automatically succeed and give rewards (no challenge resolution)
4. **One Planet**: Only Earth is available initially
5. **Gradient Background**: Using CSS gradients instead of actual planet map images

### Data Structure Highlights
- **Hotspot Positioning**: Uses percentage-based coordinates (0-100%) for responsive map placement
- **Unlock System**: Locations can be locked behind progression metrics (drop count, activities completed)
- **Activity Spawning**: Each location defines min/max activities and type distribution
- **Character Dialogue**: Activities can have guardian-specific dialogue or fall back to generic text

## What Still Needs to be Done (Future Phases)

### Phase 2: Activity Challenge System
- Implement stat checks and skill tests
- Add failure states and consequences
- Guardian can be "downed" during activities
- Detection/stealth mechanics
- Flee chance calculations

### Phase 3: Activity Type Distribution
- Implement weighted random selection based on location's activity_type_distribution
- Implement rarity system (common, uncommon, rare activities)
- Respect max_activities limits per location

### Phase 4: Multiple Locations & Progression
- Add more locations to Earth
- Implement full unlock system
- Track player progression (successful_drops, activities_completed)
- Add more planets

### Phase 5: Polish & Enhancement
- Add actual map background images
- Implement location-specific visuals
- Add animations for activity resolution
- Guardian dialogue system during activities
- Real-time activity log/narrative

## Breaking Changes & Compatibility

### What Was Preserved
- ✅ All existing mission system code remains intact
- ✅ Guardian selection and loadout systems unchanged
- ✅ Inventory and crafting systems work as before
- ✅ Save system compatible (new fields are additive)

### What Changed
- ⚠️ Mission Computer room now shows Map instead of mission list
- ⚠️ Only 1 guardian can be selected (down from 1-4)
- ⚠️ Old missions.json is no longer used for mission selection

### Migration Path
If needed to roll back:
1. Change `rooms.js` line 104 back to `renderMissionComputer(container)`
2. Change guardian selection back to max 4
3. Remove new script tags from game.html
4. Old system will work as before

## Testing Recommendations

### Critical Tests
1. **Load Game**: Verify game loads without errors
2. **Select Guardian**: Ensure guardian selection works
3. **View Map**: Check that map displays with 3 locations
4. **Click Location**: Verify sidebar opens with location info
5. **Drop Here**: Confirm "Drop Here" button works on unlocked location
6. **Locked Locations**: Verify locked locations show requirements
7. **Planetfall Portal**: Check that guardian selection works (1 max)
8. **Launch Mission**: Ensure mission can still launch with new system

### Console Checks
Look for these log messages:
- "Activities system loaded."
- "Map system loaded."
- "=== ACTIVITY SPAWNING ===" (when location selected)
- Activity details in console

## File Manifest

### Created
- `ship-life/data/planets.json`
- `ship-life/data/locations.json`
- `ship-life/data/activities.json`
- `ship-life/data/game_config.json`
- `ship-life/js/map.js`
- `ship-life/js/activities.js`
- `ship-life/css/map.css`

### Modified
- `ship-life/js/main.js` (data loading)
- `ship-life/js/rooms.js` (map integration, guardian selection)
- `ship-life/game.html` (script/style includes)

### Documentation
- `ship-life/docs/map_as_lobby_read_first.md` (existing)
- `ship-life/docs/map_as_lobby.md` (existing)
- `ship-life/docs/PHASE1_IMPLEMENTATION_SUMMARY.md` (this file)

## Next Steps

1. **Test the implementation** thoroughly
2. **Verify no breaking changes** to existing features
3. **Get feedback** on the map interface UX
4. **Plan Phase 2** implementation (activity challenges)
5. **Consider adding** actual map images
6. **Document** any bugs or issues found

## Notes for Future Development

- The activities system is designed to be extensible
- Guardian-specific dialogue system is in place but not fully utilized
- Location unlock system is ready but only one location uses it
- Activity difficulty affects nothing in Phase 1 (reserved for Phase 2)
- The stat_requirements in activities are ready for Phase 2 challenge system

---

**Implementation Date**: January 25, 2026  
**Phase**: 1 of 5  
**Status**: Ready for Testing  
**Breaking Changes**: Minimal (mostly cosmetic)
