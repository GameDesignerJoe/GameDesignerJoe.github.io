# Ship Life - Phase 7B: Squad & Loadout System

## Document Information
- **Phase**: 7B - Squad & Loadout System
- **Goal**: Strategic team building and equipment management
- **Date**: January 2026
- **Estimated Time**: 8-10 hours
- **Status**: In Progress

---

## Overview

Phase 7B adds tactical depth to missions by allowing players to:
- Choose which Guardians to send on each mission (1-4)
- Equip each Guardian with weapons, armor, and special abilities
- See how loadouts affect mission success rates
- Face missions with specific equipment requirements

This transforms missions from random chance to strategic decision-making.

---

## Core Design Decisions

### **Guardian Loadout Structure**
Each Guardian has **4 equipment slots:**
- **1 Equipment Slot**: Weapons & Armor (physical combat gear)
- **3 Aspect Slots**: Powers & Abilities (special enhancements)

### **Item Categories**

**Equipment (Physical Gear):**
- **Weapons**: Plasma Rifle, Pulse Cannon, Quantum Disruptor
- **Armor**: Energy Shield, Combat Armor, Adaptive Armor
- **Effect**: Tangible combat improvements

**Aspects (Powers):**
- **Tech**: Scanners, Processors, Neural Interface, AI Core
- **Medical**: Stim Packs, Medkits, Nano-Medical Suite
- **Structural**: Composite Plating, Reinforced Frame, Adaptive Materials
- **Effect**: Special abilities and bonuses

### **Mission Types** (6 types)
1. **Combat** - Direct engagement missions
2. **Collection** - Gather resources/intel
3. **Defend** - Protect locations/people
4. **Search** - Locate objectives
5. **Recon** - Reconnaissance operations
6. **Rescue** - Extract personnel

---

## Success Rate System

### **Formula**
```javascript
baseSuccess = 100 - (difficulty * 10)
loadoutBonus = sum of all equipped items' bonuses for this mission type
finalSuccess = Math.min(100, Math.max(0, baseSuccess + loadoutBonus))
```

### **No Squad Size Bonus**
- Team size does NOT affect success rate
- Same difficulty whether 1 or 4 guardians
- Strategic choice: risk fewer guardians or spread loadout bonuses

### **Equipment Bonuses**
Each item has mission type affinities:
```json
"mission_bonuses": {
  "combat": 10,
  "defeat": 10
}
```

**Example:**
- Plasma Rifle: +10% on Combat missions
- Scanner: +10% on Search/Recon missions
- Medkit: +10% on Rescue missions

**Stacking:**
- Multiple items stack additively
- 4 guardians with optimal loadouts = massive bonus
- Trade-off: spread bonuses or focus one guardian

---

## Mission Requirements System

### **Optional vs Required**
- **Most missions**: Any equipment helps
- **Special missions**: REQUIRE specific equipment type
- Can't launch without meeting requirements

### **Example Requirements**
```json
"requirements": {
  "equipment_type": "scanner"  // Must have a scanner equipped
}
```

**Missions with Requirements:**
- Deep Space Recon: Requires Scanner
- Reactor Crisis: Requires Tech equipment

---

## Implementation Checklist

### **Step 1: Data Foundation ✅**
- [x] Split items into "equipment" vs "aspect" types
- [x] Add mission_bonuses to all items
- [x] Tag all missions with mission types
- [x] Add requirements to special missions
- [x] Create 2-4 new missions to fill gaps

### **Step 2: State Management ✅**
- [ ] Add loadout structure to game state
- [ ] Create loadout.js system file
- [ ] Add equip/unequip functions
- [ ] Save/load loadout state

### **Step 3: Squad Selection UI ✅**
- [ ] Update Planetfall Portal layout
- [ ] Add guardian selection grid (4 portraits)
- [ ] Toggle selection on click
- [ ] Show selected guardians
- [ ] Show loadout preview on portraits

### **Step 4: Loadout Management UI ✅**
- [ ] Create loadout modal
- [ ] Display equipment slots (1 + 3)
- [ ] Click slot → show filtered inventory
- [ ] Equip/unequip items
- [ ] Show live success rate preview
- [ ] Color-code success rate display

### **Step 5: Success Rate Calculation ✅**
- [ ] Update mission success calculation
- [ ] Factor in loadout bonuses
- [ ] Real-time recalculation
- [ ] Display breakdown tooltip

### **Step 6: Requirements System ✅**
- [ ] Check requirements before launch
- [ ] Show warnings on mission cards
- [ ] Disable launch if requirements not met
- [ ] Tooltip explains what's needed

### **Step 7: Visual Polish ✅**
- [ ] Mission type icons
- [ ] Equipment slot icons
- [ ] Success rate animations
- [ ] Smooth transitions
- [ ] Validation & testing

---

## Data Structure Specifications

### **Items.json Updates**
```json
{
  "id": "plasma_rifle",
  "name": "Plasma Rifle",
  "type": "equipment",
  "subtype": "weapon",
  "description": "...",
  "mission_bonuses": {
    "combat": 10
  },
  "icon": { ... }
}
```

### **Missions.json Updates**
```json
{
  "id": "hostile_engagement",
  "name": "Hostile Engagement",
  "mission_type": "combat",
  "requirements": null,
  ...existing fields...
}
```

### **Game State Additions**
```json
{
  "loadouts": {
    "stella": {
      "equipment": "plasma_rifle",
      "aspects": ["signal_amplifier", null, "stim_pack"]
    },
    "vawn": {
      "equipment": "energy_shield",
      "aspects": [null, null, null]
    }
  }
}
```

---

## UI Specifications

### **Planetfall Portal: Squad Selection**
```
┌─────────────────────────────────────┐
│   MISSION: Hostile Engagement       │
│   Type: Combat | Difficulty: 3      │
│   Success Rate: 75%                 │
└─────────────────────────────────────┘

SELECT YOUR SQUAD (1-4 Guardians)

┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│STELLA│  │ VAWN │  │TIBER-│  │MAEST-│
│  ✓   │  │  ✓   │  │ IUS  │  │  RA  │
│ [🔫] │  │ [🛡️] │  │      │  │      │
│Configure││Configure││Configure││Configure│
└──────┘  └──────┘  └──────┘  └──────┘

[Launch Mission]
```

### **Loadout Modal**
```
┌────────────────────────────────────────┐
│  STELLA'S LOADOUT                      │
│  Mission Success: 75% ↑                │
├────────────────────────────────────────┤
│                                        │
│  EQUIPMENT SLOT:                       │
│  ┌─────────────────┐                  │
│  │ Plasma Rifle    │ +10% Combat      │
│  │ [Click to swap] │                  │
│  └─────────────────┘                  │
│                                        │
│  ASPECT SLOTS:                         │
│  ┌─────────────────┐                  │
│  │ Empty Slot      │                  │
│  │ [Click to equip]│                  │
│  └─────────────────┘                  │
│  ┌─────────────────┐                  │
│  │ Empty Slot      │                  │
│  └─────────────────┘                  │
│  ┌─────────────────┐                  │
│  │ Empty Slot      │                  │
│  └─────────────────┘                  │
│                                        │
│  [Save] [Cancel]                       │
└────────────────────────────────────────┘
```

---

## Testing Checklist

### **Basic Functionality**
- [ ] Can select 1-4 guardians
- [ ] Can't launch with 0 guardians
- [ ] Can open loadout for each guardian
- [ ] Can equip/unequip items
- [ ] Success rate updates in real-time

### **Success Rate**
- [ ] Base rate correct (100 - difficulty*10)
- [ ] Equipment bonuses apply correctly
- [ ] Aspect bonuses apply correctly
- [ ] Bonuses stack from multiple guardians
- [ ] Max 100%, min 0%

### **Requirements**
- [ ] Required missions show warning
- [ ] Can't launch without required equipment
- [ ] Warning clears when requirement met
- [ ] Tooltip shows what's needed

### **Data Persistence**
- [ ] Loadouts save on equip
- [ ] Loadouts persist across sessions
- [ ] Mission selection persists
- [ ] State remains valid after reload

---

## Success Criteria

**Phase 7B is complete when:**
- [x] All items categorized (equipment vs aspects)
- [x] All missions tagged with types
- [ ] Squad selection UI functional
- [ ] Loadout management UI functional
- [ ] Success rate calculation working
- [ ] Requirements system enforced
- [ ] All systems validated and tested
- [ ] Documentation updated

---

## Future Enhancements (Post-7B)

- **Loadout Presets**: Save/load equipment configurations
- **Recommended Loadouts**: AI suggests optimal gear
- **Synergy Bonuses**: Certain combos give extra bonuses
- **Character Room Loadouts**: Manage gear outside missions
- **Equipment Comparison**: Side-by-side item comparison
- **Loadout Templates**: Share configurations

---

**END OF PHASE 7B SPECIFICATION**
