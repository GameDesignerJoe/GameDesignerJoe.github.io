# Phase 3 Implementation Summary
## Activity Rarity & Type Distribution System

**Implementation Date:** January 26, 2026

---

## Overview
Phase 3 adds intelligent activity spawning using rarity tiers and type distribution percentages, creating more varied and strategic drops that respect location themes.

---

## Features Implemented

### 1. MTG-Style Rarity Distribution
**Inspired by Magic: The Gathering booster packs**

- **Formula:** For every 3 activities, 2 are common and 1 is rare/uncommon
- **Calculation:** 
  - Commons = totalCount - floor(totalCount / 3)
  - Rare/Uncommon = floor(totalCount / 3)
- **Rare vs Uncommon:** 50/50 split for non-common slots

**Example:**
- 6 activities = 4 common, 2 rare/uncommon
- 9 activities = 6 common, 3 rare/uncommon
- 12 activities = 8 common, 4 rare/uncommon

### 2. Type-Based Spawning
**Respects location's activity_type_distribution**

Each location defines percentage chances for activity types:
```json
"activity_type_distribution": {
  "combat": 60,
  "resource": 20,
  "exploration": 10,
  "event": 10
}
```

The system:
1. Rolls a random number (0-100)
2. Checks cumulative percentages
3. Selects matching activity type
4. Validates totals equal 100%

### 3. Intelligent Activity Selection
**Multi-tier fallback system**

Selection priority:
1. **Exact match:** Type + Rarity
2. **Type match:** Type only (any rarity)
3. **Random fallback:** Any activity

Warnings logged when exact matches aren't found.

### 4. Replacement Spawning
**Successfully avoided activities spawn replacements**

When a guardian successfully avoids an activity:
- ✅ Doesn't count toward activity counter
- ✅ Spawns a new activity (same distribution rules)
- ✅ Appended to end of activities list
- ✅ Rewards skilled play with more opportunities

**Replacement Formula:**
- 66% chance common
- 34% chance rare/uncommon
- Uses location's type distribution

---

## Files Modified

### `ship-life/js/activities.js`
**New Functions:**
- `spawnActivities()` - Rewritten with rarity/type logic
- `calculateRarityDistribution()` - MTG-style distribution
- `rollRareOrUncommon()` - 50/50 rare vs uncommon
- `rollActivityType()` - Weighted type selection
- `selectActivity()` - Multi-tier activity matching
- `spawnReplacementActivity()` - Spawn single replacement

### `ship-life/js/text_chain.js`
**Modified:**
- `handleAvoid()` - Calls `spawnReplacementActivity()` on successful avoidance

---

## Technical Details

### Rarity Distribution Math
```javascript
// For 9 activities:
rareUncommonCount = floor(9 / 3) = 3
commonCount = 9 - 3 = 6

// Distribution: 6 common, 3 rare/uncommon
// Slots 0-5: common
// Slots 6-8: rare or uncommon (50/50)
```

### Type Distribution Algorithm
```javascript
// Example: combat 60%, resource 20%, exploration 10%, event 10%
roll = random(0-100) // e.g., 45

cumulative = 0
cumulative += 60 // 60, roll < 60 ✓ → combat
```

### Activity Selection Cascade
```javascript
1. Filter by type AND rarity → Found? Return random
2. Filter by type only → Found? Return random + warn
3. Return any random activity + warn
```

---

## Console Logging

**Spawning Log:**
```
=== ACTIVITY SPAWNING ===
Location: Frozen Wastes
Activity Count: 9 (6-12 range)
Rarity Distribution: 6 common, 3 rare/uncommon
Type Rolls: [combat (45), resource (78), combat (22), ...]
Spawned Activities:
  1. Frostbite Wraith (combat, common)
  2. Frozen Supply Cache (resource, common)
  3. Ice Stalker (combat, uncommon)
  ...
```

**Replacement Log:**
```
[Replace] Spawned Crystal Formation (exploration, common) to replace avoided activity
```

**Warning Logs:**
```
⚠️ Type distribution doesn't total 100% (got 95%)
⚠️ No rare combat activities found, using any combat
⚠️ No exploration activities found, using random activity
```

---

## Benefits

### Gameplay Variety
- 🎲 **No more repetitive spawns** - intelligent distribution
- 🎯 **Location-appropriate encounters** - type distribution
- ⭐ **Exciting rare encounters** - rarity system
- 🔄 **Rewards skillful play** - replacement spawning

### Balance Improvements
- Common activities form the baseline
- Rare activities provide challenge spikes
- Type distribution ensures thematic consistency
- Avoidance strategy becomes viable

### Designer Control
Locations can now specify:
- Activity count range (min-max)
- Type distribution percentages
- Max activities before extraction

---

## Next Steps

### Phase 4: Editor Extensions
- Add Location editor to JSON GUI
- Add Activity editor with dialogue system
- Schema definitions for new data types

### Phase 5: Polish & Balance
- Visual transitions and animations
- Audio integration
- Balance testing across all locations
- Bug fixes and edge cases

---

## Testing Notes

To test Phase 3:
1. Clear browser storage (reset game state)
2. Select different locations and observe console logs
3. Verify rarity distribution matches 2:1 ratio
4. Confirm type percentages align with location config
5. Test avoidance mechanics spawn replacements
6. Check warnings appear for invalid distributions

---

## Data Requirements

For best results, ensure:
- ✅ Activities have `type` and `rarity` fields
- ✅ Location `activity_type_distribution` totals 100%
- ✅ Enough activities exist for each type/rarity combo
- ✅ At least 2-3 activities per type minimum

---

**Phase 3 Status: ✅ COMPLETE**
