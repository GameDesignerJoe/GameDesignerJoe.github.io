# Blueprint System Guide

## Overview
The Ship-Life game uses a unified blueprint system where blueprints are stored as items in `items.json` rather than in a separate file.

---

## How Blueprints Work

### 1. **Blueprint Items (items.json)**
Blueprints are regular items with:
- `type: "blueprint"`
- `unlocked_at_start: true/false` (optional) - If true, automatically learned at game start
- Standard item properties (id, name, description, icon)

**Example:**
```json
{
  "id": "blueprint_plasma_rifle",
  "name": "Plasma Rifle Blueprint",
  "description": "Unlocks basic plasma rifle crafting",
  "icon": {
    "type": "color",
    "value": "#4a90e2",
    "show_name": true
  },
  "type": "blueprint",
  "unlocked_at_start": true,
  "stack_count": 0
}
```

### 2. **Recipe Requirements (workstations.json)**
Recipes can optionally require blueprints:
- `blueprint_required: "blueprint_id"` - Must learn this blueprint to craft
- `blueprint_required: "none"` - No blueprint needed
- `blueprint_required: null` or omitted - No blueprint needed

**Example:**
```json
{
  "id": "basic_rifle",
  "name": "Basic Plasma Rifle",
  "required_level": 1,
  "blueprint_required": "blueprint_plasma_rifle",
  "cost": [...]
}
```

---

## Current Blueprint Items (16 total)

✅ **Starting Blueprints (unlocked_at_start: true)**
- `blueprint_plasma_rifle` - Basic Plasma Rifle
- `blueprint_energy_shield` - Basic Energy Shield

📦 **Unlockable Blueprints (earned through missions)**
- `blueprint_advanced_rifle` - Advanced Plasma Rifle
- `blueprint_pulse_cannon` - Pulse Cannon
- `blueprint_advanced_shield` - Reinforced Shield
- `blueprint_combat_armor` - Combat Armor
- `blueprint_signal_amplifier` - Signal Amplifier
- `blueprint_quantum_processor` - Quantum Processor
- `blueprint_neural_interface` - Neural Interface
- `blueprint_ai_core` - AI Core
- `blueprint_stim_pack` - Stim Pack
- `blueprint_advanced_medkit` - Advanced Medkit
- `blueprint_nano_medical_suite` - Nano-Medical Suite
- `blueprint_composite_plating` - Composite Plating
- `blueprint_adaptive_materials` - Adaptive Materials
- `blueprint_quantum_weave` - Quantum-Weave Fabric

---

## Editor Implementation Notes

### Recipe Editor Dropdown
The "Blueprint Required" dropdown should offer:
1. **"None"** (first option) - For recipes that don't need blueprints
2. All blueprint items from `items.json` where `type === "blueprint"`

### When Creating New Blueprints
1. Add to `items.json` with `type: "blueprint"`
2. Set `unlocked_at_start: true` for starting blueprints (rare!)
3. Set `unlocked_at_start: false` or omit for earned blueprints
4. Add to mission rewards so players can find them

### When Creating New Recipes
1. Decide if blueprint is required
2. If yes: Select appropriate blueprint from dropdown
3. If no: Select "None" from dropdown
4. The game will handle `"none"` values correctly

---

## FAQ

**Q: Can I use the old blueprints.json file?**
A: No, it's deprecated. The game only reads from items.json now.

**Q: How do I make a recipe available from the start?**
A: Either:
- Set `blueprint_required: "none"` (or null)
- Use a blueprint with `unlocked_at_start: true`

**Q: Where do blueprints come from?**
A: Players find them as mission rewards (type: "blueprint" items in mission rewards)

**Q: Can multiple recipes use the same blueprint?**
A: Yes! For example, `blueprint_stim_pack` unlocks both "Stim Pack" and "First Aid Kit" recipes.

---

## Migration Notes

### What Changed
- **Old System**: Separate blueprints.json file with `unlocked_at_start` property
- **New System**: Blueprints stored in items.json as type: "blueprint" items
- **Backward Compatibility**: Old saves still work - starting blueprints are hardcoded in state.js

### Files Modified
- ✅ `items.json` - Added `unlocked_at_start` to 2 starting blueprints
- ✅ `state.js` - Reads starting blueprints from items.json
- ✅ `workstations.js` - Allows `blueprint_required: "none"`
- ✅ `validation.js` - Validates optional blueprints
- ✅ `blueprints.json` - Marked as DEPRECATED

---

## Summary

✅ **Single source of truth**: All blueprints in items.json
✅ **Optional blueprints**: Recipes can have no blueprint requirement
✅ **Starting blueprints**: Use `unlocked_at_start: true` property
✅ **All 16 blueprints**: Properly tracked and available as mission rewards
✅ **Editor ready**: Just need to add "None" option to blueprint dropdown

The system is now cleaner, more flexible, and easier to maintain!
