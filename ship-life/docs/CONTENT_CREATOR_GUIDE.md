# Ship Life - Content Creator Guide

## 🎮 Overview

Ship Life is a **data-driven** game - all content (missions, items, conversations, etc.) is defined in JSON files. You can add new content without writing any code!

This guide shows you how to edit the JSON files to create new missions, items, workstations, conversations, and more.

---

## 📁 Project Structure

```
ship-life/
├── game.html              ← Main game file
├── index.html             ← Landing page (password protected)
├── README.md              ← Quick start guide
│
├── data/                  ← ✨ EDIT THESE FILES TO ADD CONTENT
│   ├── rooms.json         ← Room definitions
│   ├── guardians.json     ← Character definitions
│   ├── missions.json      ← Mission definitions
│   ├── items.json         ← All items (resources, equipment, aspects, blueprints)
│   ├── workstations.json  ← Crafting stations & recipes
│   ├── conversations.json ← Dialogue & story
│   └── trophies.json      ← Achievement system
│
├── js/                    ← Game logic (rarely need to edit)
├── css/                   ← Styling
├── docs/                  ← Documentation
└── audio/                 ← Music & sound effects
```

---

## 🚀 Quick Start

### Adding a New Mission

1. Open `data/missions.json`
2. Copy an existing mission block
3. Change the values (id, name, description, rewards, etc.)
4. Save and reload the game

**Example:**
```json
{
  "id": "my_new_mission",
  "name": "Rescue Operation",
  "description": "Extract a squad from hostile territory",
  "visual": { "type": "color", "value": "#e74c3c", "show_name": true },
  "mission_type": "rescue",
  "difficulty": 3,
  "repeatable": true,
  "prerequisites": {
    "missions_completed": ["first_contact"],
    "total_missions": 0,
    "flags": []
  },
  "rewards": {
    "success": [
      { "item": "plasma_cell", "min": 10, "max": 20, "drop_chance": 100 },
      { "item": "rare_crystal", "min": 1, "max": 3, "drop_chance": 30 }
    ],
    "failure": [
      { "item": "scrap_metal", "min": 1, "max": 5, "drop_chance": 50 }
    ]
  },
  "simulation": {
    "messages": [
      { "text": "Approaching extraction zone...", "bar_progress": 25, "display_time": 3 },
      { "text": "Hostiles detected! Engaging...", "bar_progress": 50, "display_time": 4 },
      { "text": "Target secured. Heading to evac...", "bar_progress": 75, "display_time": 3 },
      { "text": "Mission complete!", "bar_progress": 100, "display_time": 2 }
    ]
  }
}
```

### Adding a New Item

1. Open `data/items.json`
2. Add a new item to the `items` array
3. Set the type: `resource`, `equipment`, or `aspect`

**Example Equipment:**
```json
{
  "id": "plasma_rifle_mk2",
  "name": "Plasma Rifle MK2",
  "description": "Advanced plasma weapon with improved accuracy",
  "icon": { "type": "color", "value": "#00ffff", "show_name": true },
  "type": "equipment",
  "stack_count": 0,
  "mission_bonuses": {
    "combat": 15,
    "rescue": 10,
    "exploration": 5
  }
}
```

### Adding a Conversation

1. Open `data/conversations.json`
2. Copy an existing conversation
3. Modify actors, prerequisites, and dialogue lines

---

## 📖 JSON File Reference

### 🎯 missions.json

Defines all missions in the game.

**Required Fields:**
- `id` (string): Unique identifier
- `name` (string): Display name
- `description` (string): Mission summary
- `visual` (object): Color placeholder
- `mission_type` (string): combat, exploration, rescue, diplomatic, stealth, etc.
- `difficulty` (number): 1-10 (affects success rate)
- `repeatable` (boolean): Can mission be replayed?
- `prerequisites` (object): Requirements to unlock
- `rewards` (object): Loot tables for success/failure
- `simulation` (object): Loading bar messages

**Mission Types:**
- `combat` - Combat-focused missions
- `exploration` - Discovery missions
- `rescue` - Extraction missions
- `diplomatic` - Negotiation missions
- `stealth` - Infiltration missions

**Prerequisites:**
```json
"prerequisites": {
  "missions_completed": ["mission_id_1", "mission_id_2"],  // Must complete these first
  "total_missions": 5,                                       // Must complete 5 total missions
  "flags": ["flag_name"]                                     // Must have this flag set
}
```

**Rewards:**
```json
"rewards": {
  "success": [
    { 
      "item": "item_id",     // Item to drop
      "min": 5,              // Minimum quantity
      "max": 10,             // Maximum quantity
      "drop_chance": 100     // % chance to drop (0-100)
    }
  ],
  "failure": [ /* same structure */ ]
}
```

**Mission Chains:**
Add this optional field to show chain progress:
```json
"chain": {
  "name": "Raider Conflict",
  "part": 2,
  "total": 4
}
```

---

### 🎒 items.json

Defines all items: resources, equipment, aspects, and blueprints.

**Item Types:**
- `resource` - Crafting materials (stacks)
- `equipment` - Weapon/tool slot (1 per Guardian)
- `aspect` - Special ability slot (3 per Guardian)
- `blueprint` - Crafting recipe (uploaded to Knowledge Base)

**Basic Resource:**
```json
{
  "id": "plasma_cell",
  "name": "Plasma Cell",
  "description": "Energy source for plasma weapons",
  "icon": { "type": "color", "value": "#00ffff", "show_name": true },
  "type": "resource",
  "stack_count": 0  // 0 = unlimited stacking
}
```

**Equipment with Mission Bonuses:**
```json
{
  "id": "stealth_cloak",
  "name": "Stealth Cloak",
  "description": "Reduces detection range",
  "icon": { "type": "color", "value": "#8e44ad", "show_name": true },
  "type": "equipment",
  "stack_count": 0,
  "mission_bonuses": {
    "stealth": 20,      // +20% success on stealth missions
    "combat": -5,       // -5% on combat (trade-off)
    "exploration": 10
  }
}
```

**Aspect:**
```json
{
  "id": "tactical_mind",
  "name": "Tactical Mind",
  "description": "Enhanced strategic thinking",
  "icon": { "type": "color", "value": "#3498db", "show_name": true },
  "type": "aspect",
  "stack_count": 0,
  "mission_bonuses": {
    "combat": 10,
    "rescue": 10,
    "diplomatic": 5
  }
}
```

**Blueprint:**
```json
{
  "id": "bp_advanced_rifle",
  "name": "Advanced Rifle Blueprint",
  "description": "Schematic for crafting advanced plasma rifles",
  "icon": { "type": "color", "value": "#f39c12", "show_name": true },
  "type": "blueprint",
  "stack_count": 0
}
```

---

### 🔧 workstations.json

Defines crafting stations and their recipes.

**Workstation Structure:**
```json
{
  "id": "weapons_bench",
  "name": "Weapons Bench",
  "visual": { "type": "color", "value": "#c0392b", "show_name": true },
  "max_level": 3,
  "level_names": {
    "1": "Basic Weapons Bench",
    "2": "Advanced Weapons Bench",
    "3": "Master Weapons Bench"
  },
  "upgrades": [
    {
      "to_level": 2,
      "cost": [
        { "item": "steel_ingot", "amount": 20 },
        { "item": "circuit_board", "amount": 10 }
      ]
    },
    {
      "to_level": 3,
      "cost": [
        { "item": "rare_alloy", "amount": 30 },
        { "item": "advanced_circuit", "amount": 15 }
      ]
    }
  ],
  "recipes": [
    {
      "id": "basic_rifle",
      "name": "Basic Plasma Rifle",
      "icon": { "type": "color", "value": "#e74c3c", "show_name": true },
      "required_level": 1,
      "required_blueprint": null,  // No blueprint needed
      "cost": [
        { "item": "plasma_cell", "amount": 10 },
        { "item": "steel_ingot", "amount": 5 }
      ],
      "output": { "item": "plasma_rifle", "amount": 1 },
      "craft_time": 0  // Instant
    },
    {
      "id": "advanced_rifle",
      "name": "Advanced Plasma Rifle",
      "icon": { "type": "color", "value": "#9b59b6", "show_name": true },
      "required_level": 2,
      "required_blueprint": "bp_advanced_rifle",  // Need blueprint!
      "cost": [
        { "item": "plasma_cell", "amount": 25 },
        { "item": "rare_alloy", "amount": 10 }
      ],
      "output": { "item": "plasma_rifle_mk2", "amount": 1 },
      "craft_time": 0
    }
  ]
}
```

**Special Workstation: Knowledge Base**
Upload blueprints here to unlock recipes:
```json
{
  "id": "knowledge_base",
  "name": "Knowledge Base",
  "visual": { "type": "color", "value": "#3498db", "show_name": true },
  "max_level": 1,
  "level_names": { "1": "Knowledge Base" },
  "upgrades": [],
  "recipes": []  // No recipes - this is for uploading blueprints
}
```

---

### 💬 conversations.json

Defines all dialogue sequences between Guardians.

**Conversation Structure:**
```json
{
  "id": "stella_vawn_first_chat",
  "title": "Getting to Know You",
  "type": "background",  // "important" or "background"
  "actors": ["stella", "vawn"],
  "prerequisites": {
    "player_char_req": "any",           // "any", "stella", or ["stella", "vawn"]
    "missions_together": 3,             // Must complete 3 missions together
    "total_missions": 0,                // Total missions (any Guardian)
    "flags": [],                        // Required flags
    "previous_conversations": []        // Must complete these conversations first
  },
  "dialogue": [
    { "speaker": "stella", "text": "So, Vawn... tell me about yourself." },
    { "speaker": "vawn", "text": "Not much to tell. I keep to myself." },
    { "speaker": "stella", "text": "Come on, we're going to be working together a lot." },
    { "speaker": "vawn", "text": "Fine. I'll share one thing..." }
  ],
  "unlock_on_complete": {
    "flags": ["stella_vawn_bonding"]  // Set this flag when conversation completes
  }
}
```

**Conversation Types:**
- `important` - Story-critical conversations (always show if available)
- `background` - Optional filler dialogue (only 1 shown at a time)

**Player Character Requirements:**
- `"any"` - Any Guardian can trigger this conversation
- `"stella"` - Only Stella can trigger
- `["stella", "vawn"]` - Either Stella OR Vawn can trigger

---

### 🏆 trophies.json

Defines achievements that track player progress.

**Trophy Structure:**
```json
{
  "id": "first_mission",
  "name": "First Steps",
  "description": "Complete your first mission",
  "icon": { "type": "color", "value": "#2ecc71", "show_name": false },
  "requirement": {
    "type": "missions_completed",
    "count": 1
  }
}
```

**Requirement Types:**
- `missions_completed` - Complete X missions
- `perfect_streak` - Complete X missions with 100% success rate
- `mission_type` - Complete X missions of a specific type
- `squad_size` - Complete a mission with X guardians
- `solo_difficult` - Complete a difficult mission solo
- `full_loadouts` - Have X guardians with full equipment
- `unique_crafts` - Craft X unique items
- `conversations` - Complete X conversations

---

### 🎨 rooms.json

Defines all rooms and their properties.

**Room Structure:**
```json
{
  "id": "mission_computer",
  "name": "Mission Computer",
  "background": { "type": "color", "value": "#2c3e50" },
  "title_display": true,
  "music": "mission_computer"  // Optional: music track to play
}
```

---

### 👥 guardians.json

Defines playable characters.

**Guardian Structure:**
```json
{
  "id": "stella",
  "name": "Stella",
  "role": "Tactical Specialist",
  "portrait": { "type": "color", "value": "#e74c3c", "show_name": true }
}
```

---

## 🎯 Common Tasks

### Creating a Mission Chain

1. Create multiple missions with similar `mission_type`
2. Set prerequisites so they unlock in sequence
3. Add the `chain` field to each:

```json
// Mission 1
{
  "id": "chain_part_1",
  "chain": { "name": "Operation Phoenix", "part": 1, "total": 3 },
  "prerequisites": { "missions_completed": [], "total_missions": 0, "flags": [] }
}

// Mission 2
{
  "id": "chain_part_2",
  "chain": { "name": "Operation Phoenix", "part": 2, "total": 3 },
  "prerequisites": { "missions_completed": ["chain_part_1"], "total_missions": 0, "flags": [] }
}

// Mission 3
{
  "id": "chain_part_3",
  "chain": { "name": "Operation Phoenix", "part": 3, "total": 3 },
  "prerequisites": { "missions_completed": ["chain_part_2"], "total_missions": 0, "flags": [] }
}
```

### Creating Craftable Equipment

1. Add the item to `items.json` (type: equipment or aspect)
2. Add a blueprint to `items.json` (type: blueprint)
3. Add the item as a mission reward so players can get the blueprint
4. Add a recipe to a workstation in `workstations.json`

### Creating a Story Arc

1. Create `important` conversations that unlock in sequence
2. Use `previous_conversations` prerequisites
3. Set flags when conversations complete
4. Use those flags as mission prerequisites

---

## 🔍 Testing Your Changes

1. **JSON Syntax**: Use a JSON validator (https://jsonlint.com)
2. **In-Game Validation**: Open debug menu → "Validate All Data Files"
3. **Test Flow**: Play through the content to ensure it works as expected

---

## 💡 Tips & Best Practices

### IDs
- Use lowercase with underscores: `plasma_rifle_mk2`
- Make them descriptive
- Never reuse IDs across different item types

### Balance
- **Easy missions** (difficulty 1-2): 90-80% success
- **Medium missions** (difficulty 3-5): 70-50% success
- **Hard missions** (difficulty 6-8): 40-20% success
- **Elite missions** (difficulty 9-10): 10-5% success

### Drop Rates
- **Common rewards**: 70-100% drop chance
- **Uncommon rewards**: 30-60% drop chance
- **Rare rewards**: 10-25% drop chance
- **Epic rewards**: 1-5% drop chance

### Mission Types
Use consistent mission types across missions and equipment bonuses:
- `combat`, `exploration`, `rescue`, `diplomatic`, `stealth`

### Progression
- Start players with 1-2 easy missions
- Unlock new missions after completing 3-5 missions
- Gate advanced equipment behind blueprints
- Use conversations to tell story between missions

---

## 🚨 Common Mistakes

### Missing Commas
```json
// ❌ WRONG - missing comma after object
{
  "id": "item1"
  "name": "Item"
}

// ✅ CORRECT
{
  "id": "item1",
  "name": "Item"
}
```

### Trailing Commas
```json
// ❌ WRONG - trailing comma after last item
{
  "items": [
    { "id": "item1" },
    { "id": "item2" },  ← Remove this comma
  ]
}
```

### Invalid References
- Always reference items by their ID
- Check that referenced missions/items/flags exist
- Use debug menu to validate data files

---

## 📚 Additional Documentation

- **Audio Guide**: See `docs/AUDIO_IMPLEMENTATION_GUIDE.md`
- **Phase Plans**: See `docs/PHASE_*.md` for detailed implementation notes
- **Milestone Plan**: See `docs/shiplife_milestone_plan.txt` for project roadmap

---

## 🎮 Getting Started

1. **Familiarize yourself** with existing content in the JSON files
2. **Copy existing examples** and modify them
3. **Test frequently** using the debug menu
4. **Have fun creating!** The system is flexible and forgiving

---

## ❓ Questions?

Check the debug menu for:
- View Blackboard (see game state)
- View Inventory (check item counts)
- Validate Data Files (catch errors)
- Give Items (test crafting)
- Set Flags (test unlocks)

---

**Happy creating! 🚀**
