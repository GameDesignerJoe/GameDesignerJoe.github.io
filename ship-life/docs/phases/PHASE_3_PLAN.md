# Ship Life - Phase 3 Implementation Plan

## Status Check: What's Already Complete

### ✅ Phase 1 & 2 Complete
- Core loop functional (Mission → Resources → Crafting)
- 10 missions with prerequisites and chains
- 10 resource types + 2 aspects
- 2 workstations with upgrade system
- Blueprint system (auto-unlocked currently)

### 🔧 Phase 3 Features Status

#### 3.1 Workstation Upgrades ✅
- **ALREADY WORKS**: Upgrade UI, resource deduction, level tracking
- **CODE**: `upgradeWorkstation()` in workstations.js
- **NEEDS**: Nothing - system is functional!

#### 3.2 Blueprint System ⚠️
- **PARTIALLY DONE**: Blueprint checking works in recipes
- **MISSING**: 
  - Blueprint looting from missions
  - Knowledge Base workstation
  - Upload blueprint functionality
  - Moving blueprints from inventory to learned

#### 3.3 Recipe Prerequisites ✅
- **ALREADY WORKS**: Recipes check level + blueprint
- **CODE**: `canCraftRecipe()` checks both conditions
- **NEEDS**: Nothing - system is functional!

#### 3.4 Content Expansion ⚠️
- **HAVE**: 2 workstations, 2 recipes total
- **NEED**: 
  - 3 more workstations (5 total)
  - 15-20 more recipes
  - Level 2-3 recipes

---

## Phase 3 Implementation Checklist

### 🎯 Main Goal
**Add blueprint looting, Knowledge Base, and expand crafting content**

### Task 1: Enable Blueprint Looting
- [ ] Treat blueprints as items (add to items.json with type: "blueprint")
- [ ] Add blueprint rewards to missions
- [ ] Verify blueprints appear in inventory
- [ ] Test blueprint drops with varied drop_chance

### Task 2: Create Knowledge Base Workstation
- [ ] Add Knowledge Base to workstations.json
- [ ] Create special UI for Knowledge Base (no recipes, just upload)
- [ ] Implement "Upload Blueprint" functionality
- [ ] Move blueprint from inventory to learned_blueprints
- [ ] Display learned vs unlearned blueprints

### Task 3: Add 8+ New Blueprints
- [ ] Create blueprints for Level 2-3 recipes
- [ ] Distribute across workstations
- [ ] Add to missions as rare rewards (20-40% drop_chance)

### Task 4: Add 3 More Workstations
- [ ] **Tech Lab** - Electronics, circuit boards, tech items
- [ ] **Med Station** - Medical supplies, stim packs
- [ ] **Fabrication Bay** - Advanced materials, nanomaterials

### Task 5: Add 18+ New Recipes
- [ ] 4-5 recipes per workstation
- [ ] Distribute across 3 levels (Level 1: basic, Level 2: advanced, Level 3: master)
- [ ] Use new Phase 2 resources (exotic matter, circuit boards, etc.)

### Task 6: Test Blueprint Flow
- [ ] Complete mission → Loot blueprint
- [ ] Navigate to Knowledge Base → Upload
- [ ] Navigate to workstation → Recipe now visible (grayed)
- [ ] Upgrade workstation if needed
- [ ] Craft item → Success

---

## Detailed Implementation

### New Blueprints to Add (items.json)

```json
{
  "id": "blueprint_advanced_rifle",
  "name": "Advanced Rifle Blueprint",
  "description": "Unlocks advanced plasma rifle crafting",
  "icon": { "type": "color", "value": "#e67e22", "show_name": true },
  "type": "blueprint",
  "stack_count": 0,
  "unlocked_at_start": false,
  "unlocks_recipe": "advanced_rifle"
}
```

### Knowledge Base Workstation Structure

```json
{
  "id": "knowledge_base",
  "name": "Knowledge Base",
  "visual": { "type": "color", "value": "#3498db", "show_name": true },
  "max_level": 1,
  "level_names": { "1": "Knowledge Base" },
  "upgrade_costs": [],
  "recipes": [],
  "_special": "This workstation has custom UI for uploading blueprints"
}
```

### New Workstations

#### Tech Lab
- **Level 1**: Basic Circuit Assembly, Signal Amplifier
- **Level 2**: Advanced Scanner, Quantum Processor
- **Level 3**: Neural Interface, AI Core

#### Med Station
- **Level 1**: Basic Stim Pack, First Aid Kit
- **Level 2**: Advanced Medkit, Regeneration Serum
- **Level 3**: Nano-Medical Suite, Revival Kit

#### Fabrication Bay
- **Level 1**: Composite Plating, Reinforced Frame
- **Level 2**: Advanced Armor Plating, Adaptive Materials
- **Level 3**: Quantum-Weave Fabric, Self-Repairing Hull

### Blueprint Distribution (Mission Rewards)

Add blueprints as rare rewards to existing missions:

**Rescue Operation** (Diff 2):
- blueprint_advanced_shield (30% drop)

**Tech Salvage** (Diff 2):
- blueprint_signal_amplifier (40% drop)
- blueprint_quantum_processor (20% drop)

**Kin Assault** (Diff 3):
- blueprint_advanced_rifle (30% drop)
- blueprint_composite_plating (40% drop)

**Deep Space Recon** (Diff 4):
- blueprint_quantum_weave (25% drop)
- blueprint_neural_interface (15% drop)

**Reactor Crisis** (Diff 4):
- blueprint_ai_core (50% drop)
- blueprint_nano_medical_suite (40% drop)

---

## Code Changes Needed

### 1. Update items.json
- Change existing blueprints to type: "blueprint"
- Add 8+ new blueprint items
- Set unlocked_at_start: false for new blueprints

### 2. Add blueprints to mission rewards
- Edit missions.json to include blueprint drops
- Use 20-40% drop_chance for rarity

### 3. Create Knowledge Base UI
- Modify workstations.js to detect Knowledge Base
- Show special UI: In Inventory vs Learned columns
- Add "Upload" button for unlearned blueprints

### 4. Add 3 new workstations
- Edit workstations.json
- Add Tech Lab, Med Station, Fabrication Bay
- Distribute 18+ recipes across all 5 workstations

### 5. Add new craftable items
- Edit items.json to add outputs
- Advanced weapons, armor, tech items, medical supplies

---

## Testing Plan

### Phase 3 Acceptance Tests

**Test 1: Blueprint Looting**
1. Complete "Tech Salvage" mission 5 times
2. Verify blueprint drops (should get ~2/5 times at 40%)
3. Check inventory shows blueprint

**Test 2: Knowledge Base Upload**
1. Have blueprint in inventory
2. Navigate to Workstations → Click Knowledge Base
3. Click "Upload Blueprint"
4. Verify blueprint moves to learned_blueprints
5. Verify blueprint removed from inventory

**Test 3: Recipe Unlocking**
1. Upload "Advanced Rifle Blueprint"
2. Navigate to Weapons Bench
3. Verify "Advanced Plasma Rifle" visible (grayed out if level too low)
4. Upgrade Weapons Bench to Level 2
5. Verify recipe now craftable

**Test 4: Workstation Variety**
1. Navigate to Workstations room
2. Verify 5 workstations displayed
3. Click each one, verify recipes load
4. Test crafting from each workstation

**Test 5: Level Gating**
1. Open Tech Lab (Level 1)
2. Verify only Level 1 recipes visible
3. Upgrade to Level 2
4. Verify Level 2 recipes appear
5. Upgrade to Level 3
6. Verify Level 3 recipes appear

---

## Success Criteria

Phase 3 is complete when:
- ✅ Blueprints loot from missions
- ✅ Knowledge Base uploads blueprints
- ✅ 5 total workstations (Weapons, Armor, Tech, Med, Fab)
- ✅ 20+ recipes across all workstations
- ✅ Recipes distributed across 3 levels
- ✅ Blueprint → Upload → Unlock → Craft flow works

---

## Estimated Time

- **Add Blueprint Items**: 20 minutes
- **Update Mission Rewards**: 15 minutes
- **Create Knowledge Base UI**: 45 minutes (new UI component)
- **Add 3 Workstations**: 30 minutes
- **Create 18 Recipes**: 60 minutes
- **Testing**: 30 minutes
- **Total**: ~3.5 hours

---

## Recipe Ideas by Workstation

### Weapons Bench (5 recipes)
- Level 1: Basic Plasma Rifle ✅
- Level 2: Advanced Plasma Rifle, Pulse Cannon
- Level 3: Quantum Disruptor, Master-Crafted Rifle

### Armor Forge (5 recipes)
- Level 1: Basic Energy Shield ✅
- Level 2: Reinforced Shield, Combat Armor
- Level 3: Adaptive Armor, Master-Forged Shield

### Tech Lab (4 recipes)
- Level 1: Basic Scanner, Signal Amplifier
- Level 2: Quantum Processor, Advanced Scanner
- Level 3: Neural Interface, AI Core

### Med Station (4 recipes)
- Level 1: Basic Stim Pack, First Aid Kit
- Level 2: Advanced Medkit, Regeneration Serum
- Level 3: Nano-Medical Suite

### Fabrication Bay (4 recipes)
- Level 1: Composite Plating, Reinforced Frame
- Level 2: Advanced Armor Plating, Adaptive Materials
- Level 3: Quantum-Weave Fabric

**Total: 22 recipes across 5 workstations**

---

## Next Steps After Phase 3

Once Phase 3 is complete, we can move to:
- **Phase 4**: Conversation system (Observation Deck, dialogue UI)
- **Phase 5**: Guardian swapping (Character Room)
- **Phase 6**: Polish & extensibility
