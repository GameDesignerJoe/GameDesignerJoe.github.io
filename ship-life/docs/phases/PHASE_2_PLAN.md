# Ship Life - Phase 2 Implementation Plan

## Status Check: What's Already Complete

### ✅ Phase 1 Complete (Foundation & Core Loop)
All Phase 1 systems are functional:
- Password protection & Landing Page
- Character selection (4 Guardians)
- Navigation system with 6 rooms
- Mission Computer with mission selection
- Mission simulation with animated progress bar
- Mission results with rewards
- Inventory system
- 2 Workstations with crafting
- Workstation upgrades
- Blueprint system (auto-unlocked)
- Debug menu
- Auto-save system
- ESC key quit dialog

### 🔧 Phase 2 Features Already Built (But Need Content)

**GOOD NEWS**: Most Phase 2 *systems* are already implemented in the code!

#### 2.1 Mission Prerequisites ✅
- **ALREADY WORKS**: `missions.js` checks `missions_completed`, `total_missions`, and `flags`
- **CODE**: `getAvailableMissions()` function filters by prerequisites
- **NEEDS**: More missions with varied prerequisites

#### 2.2 Repeatable Missions ✅
- **ALREADY WORKS**: Missions have `repeatable: true/false` field
- **CODE**: Non-repeatable missions filtered out after completion
- **NEEDS**: Mix of repeatable and one-time missions

#### 2.3 Variable Rewards ✅
- **ALREADY WORKS**: `drop_chance`, `min`/`max` quantities all functional
- **CODE**: `rollRewards()` function handles RNG
- **NEEDS**: More diverse reward configurations

#### 2.4 Mission Counter Tracking ✅
- **ALREADY WORKS**: Tracks total missions and per-Guardian counts
- **CODE**: `incrementMissionCounter()` in state.js
- **NEEDS**: Missions that unlock at total_missions thresholds

#### 2.5 Content Expansion ⚠️
- **PARTIALLY DONE**: Have 3 missions, 7 items, 2 workstations
- **NEEDS**: 
  - 7 more missions (total 10)
  - 3-5 more resource types
  - More varied difficulty levels (1-5)
  - Diverse simulation messages

---

## Phase 2 Implementation Checklist

### 🎯 Main Goal
**Expand content to prove the systems scale and provide ~2 hours of gameplay**

### Tasks

#### Task 1: Add More Resource Types
- [ ] Create 3-5 new resource items in `items.json`
  - Exotic Matter (rare, high-tier)
  - Circuit Boards (tech crafting)
  - Crystalline Shards (special materials)
  - Fusion Cores (energy)
  - Nano-materials (advanced)

#### Task 2: Create 7 New Missions
- [ ] Add 7 missions to `missions.json` with varied:
  - Difficulty levels (2-5)
  - Prerequisites (mission chains)
  - Total mission count requirements
  - Repeatable vs one-time
  - Diverse rewards
  - Unique simulation messages

**Mission Ideas:**
1. **"Rescue Operation"** - Difficulty 2, requires First Contact
2. **"Tech Salvage"** - Difficulty 2, repeatable, tech focus
3. **"Kin Assault"** - Difficulty 3, requires 3 total missions
4. **"Diplomatic Mission"** - Difficulty 1, unlocks after 5 missions
5. **"Deep Space Recon"** - Difficulty 4, requires Supply Run + Rescue
6. **"Reactor Crisis"** - Difficulty 4, one-time, story mission
7. **"Training Exercise"** - Difficulty 1, repeatable, low rewards

#### Task 3: Test Mission Chains
- [ ] Verify prerequisites unlock correctly
- [ ] Test repeatable vs non-repeatable behavior
- [ ] Confirm mission pool refreshes properly
- [ ] Test total_missions unlocking

#### Task 4: Balance Rewards
- [ ] Distribute new resources across missions
- [ ] Adjust drop_chance values (30-100%)
- [ ] Test reward variance over multiple runs
- [ ] Ensure resource scarcity feels right

#### Task 5: Update README
- [ ] Document all 10 missions
- [ ] List all resource types
- [ ] Add Phase 2 completion notes

---

## Detailed Implementation

### New Resources to Add

```json
{
  "id": "exotic_matter",
  "name": "Exotic Matter",
  "description": "Rare quantum material from deep space",
  "icon": { "type": "color", "value": "#9b59b6", "show_name": true },
  "type": "resource",
  "stack_count": 0
}
```

```json
{
  "id": "circuit_board",
  "name": "Circuit Board",
  "description": "Advanced computing components",
  "icon": { "type": "color", "value": "#16a085", "show_name": true },
  "type": "resource",
  "stack_count": 0
}
```

```json
{
  "id": "crystalline_shard",
  "name": "Crystalline Shard",
  "description": "Energy-infused crystal fragments",
  "icon": { "type": "color", "value": "#3498db", "show_name": true },
  "type": "resource",
  "stack_count": 0
}
```

### Mission Template

```json
{
  "id": "rescue_operation",
  "name": "Rescue Operation",
  "description": "Extract stranded Guardians from hostile territory",
  "map": "danger_zone",
  "visual": {
    "type": "color",
    "value": "#e67e22",
    "show_name": true
  },
  "difficulty": 2,
  "repeatable": false,
  "persist_on_fail": true,
  "prerequisites": {
    "missions_completed": ["first_contact"],
    "total_missions": 0,
    "flags": []
  },
  "rewards": {
    "success": [
      {
        "item": "common_alloy",
        "min": 10,
        "max": 20,
        "drop_chance": 100
      },
      {
        "item": "battery",
        "min": 3,
        "max": 6,
        "drop_chance": 70
      },
      {
        "item": "circuit_board",
        "min": 1,
        "max": 3,
        "drop_chance": 40
      }
    ],
    "failure": [
      {
        "item": "common_alloy",
        "min": 2,
        "max": 5,
        "drop_chance": 100
      }
    ]
  },
  "unlock_on_complete": {
    "flags": ["rescue_complete"],
    "missions": []
  },
  "simulation": {
    "messages": [
      {
        "text": "Drop pod incoming! Brace for landing!",
        "bar_progress": 20,
        "display_time": 3
      },
      {
        "text": "Vawn locates the extraction point!",
        "bar_progress": 45,
        "display_time": 3
      },
      {
        "text": "Hostiles closing in! Defend the position!",
        "bar_progress": 70,
        "display_time": 3
      },
      {
        "text": "Rescue successful! Returning to ship!",
        "bar_progress": 100,
        "display_time": 2
      }
    ]
  }
}
```

---

## Testing Plan

### Phase 2 Acceptance Tests

**Test 1: Mission Unlocking**
1. Start new save
2. Complete "First Contact"
3. Verify "Rescue Operation" appears in Mission Computer
4. Complete 3 total missions
5. Verify mission requiring "total_missions: 3" appears

**Test 2: Repeatable vs One-Time**
1. Complete repeatable mission
2. Return to Mission Computer
3. Verify mission still available
4. Complete non-repeatable mission
5. Verify mission disappears

**Test 3: Reward Variance**
1. Save before mission
2. Complete mission 5 times (reload save each time)
3. Verify rewards vary each time
4. Verify drop_chance working (30% drops ~3/10 times)

**Test 4: Resource Balance**
1. Complete 10 missions
2. Check inventory
3. Verify mix of common/rare resources
4. Attempt to craft items - should have some but not all resources

---

## Success Criteria

Phase 2 is complete when:
- ✅ 10 total missions in game (currently have 3)
- ✅ 10+ resource types (currently have 5)
- ✅ Difficulty range 1-5 (currently 1-3)
- ✅ Mission chains working (prerequisite unlocking)
- ✅ Repeatable vs one-time working
- ✅ Reward variance confirmed
- ✅ 1-2 hours of gameplay before running out of content

---

## Estimated Time

- **Add Resources**: 15 minutes
- **Create 7 Missions**: 45 minutes (JSON editing)
- **Testing**: 30 minutes
- **Total**: ~1.5 hours

---

## Next Steps After Phase 2

Once Phase 2 is complete, we can move to:
- **Phase 3**: Blueprint looting, more workstations, more recipes
- **Phase 4**: Conversation system
- **Phase 5**: Guardian swapping
