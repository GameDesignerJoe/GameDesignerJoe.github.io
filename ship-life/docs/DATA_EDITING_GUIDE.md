# Ship Life - Data Editing Guide

**Welcome!** This guide will help you add new content to Ship Life by editing JSON data files.

---

## 📁 Where Are the Data Files?

All editable content is in the `/ship-life/data/` folder:

- `items.json` - Resources, blueprints, equipment
- `guardians.json` - Playable characters
- `missions.json` - Missions players can run
- `workstations.json` - Crafting stations and recipes
- `conversations.json` - Dialogue between guardians
- `rooms.json` - Game areas/screens

---

## 🎯 Quick Start: Adding New Content

### How to Add a New Mission

1. Open `data/missions.json`
2. Find the `"missions"` array
3. Copy an existing mission object
4. Paste it at the end (before the closing `]`)
5. Change the values:
   - `"id"` - Unique identifier (lowercase, underscores)
   - `"name"` - Display name shown to players
   - `"description"` - What the mission is about
   - `"difficulty"` - Number from 1-10
   - `"rewards"` - What players get (see Rewards section)

**Example:**
```json
{
  "id": "my_new_mission",
  "name": "My New Mission",
  "description": "A brand new exciting mission",
  "difficulty": 5,
  "visual": {
    "type": "color",
    "value": "#3498db",
    "show_name": true
  },
  "rewards": [
    {
      "type": "item",
      "item": "circuit_board",
      "amount": 3
    }
  ],
  "success_messages": [
    "Mission accomplished!"
  ],
  "failure_messages": [
    "Better luck next time."
  ]
}
```

---

### How to Add a New Item

1. Open `data/items.json`
2. Find the `"items"` array
3. Add a new object with these fields:

```json
{
  "id": "my_item",
  "name": "My Item",
  "type": "resource",
  "description": "A useful item",
  "icon": {
    "type": "color",
    "value": "#e74c3c",
    "show_name": true
  }
}
```

**Item Types:**
- `"resource"` - Crafting materials
- `"blueprint"` - Unlocks recipes
- `"aspect"` - Equipment/modifiers

---

### How to Add a New Conversation

1. Open `data/conversations.json`
2. Add a new conversation object:

```json
{
  "id": "my_conversation",
  "title": "Catching Up",
  "type": "background",
  "repeatable": false,
  "participants": ["stella", "vawn"],
  "prerequisites": {
    "missions_together": {
      "stella_vawn": 3
    }
  },
  "dialogue": [
    {
      "speaker": "stella",
      "text": "Hey, how's it going?"
    },
    {
      "speaker": "vawn",
      "text": "Pretty good! That last mission was intense."
    }
  ]
}
```

**Conversation Types:**
- `"important"` - Story conversations (always shown first)
- `"background"` - Optional chats (shown after important ones)

---

## 📖 Field Reference

### Visual Objects

Used for placeholder graphics:

```json
"visual": {
  "type": "color",
  "value": "#hexcolor",
  "show_name": true
}
```

- `type` - Always `"color"` for now
- `value` - Hex color code (e.g., `"#ff0000"` for red)
- `show_name` - Show name text on the color? (`true`/`false`)

---

### Prerequisites

Control when content unlocks:

```json
"prerequisites": {
  "missions_completed": ["mission_id"],
  "flags": ["flag_name"],
  "missions_together": {
    "stella_vawn": 5
  }
}
```

- `missions_completed` - Array of mission IDs that must be done
- `flags` - Array of story flags that must be set
- `missions_together` - Relationship levels (pair_id: count)

---

### Rewards

What players get from missions:

```json
"rewards": [
  {
    "type": "item",
    "item": "circuit_board",
    "amount": 5
  },
  {
    "type": "flag",
    "flag": "story_event_complete"
  }
]
```

**Reward Types:**
- `"item"` - Give inventory items
- `"flag"` - Set a story flag

---

### Workstation Recipes

How to craft items:

```json
{
  "id": "recipe_id",
  "name": "Recipe Name",
  "required_level": 1,
  "blueprint_required": "blueprint_id",
  "cost": [
    {
      "item": "circuit_board",
      "amount": 2
    }
  ],
  "output": {
    "item": "advanced_circuit",
    "amount": 1
  }
}
```

---

## ✅ Validation

After editing files, **always validate** to catch errors:

1. Load the game
2. Press the **⚙️ gear icon** (bottom left)
3. Go to **Panels** tab
4. Click **"🔍 Validate All Data Files"**
5. Check the Console tab for errors

**Common Errors:**
- Missing quotes around text
- Missing commas between objects
- Duplicate IDs
- Invalid item references

---

## 🎨 Color Codes

Suggested colors for different types:

**Items:**
- Resources: `#3498db` (blue), `#2ecc71` (green)
- Blueprints: `#f39c12` (orange)
- Aspects: `#9b59b6` (purple)

**Missions:**
- Easy (1-3): `#2ecc71` (green)
- Medium (4-7): `#f39c12` (orange)
- Hard (8-10): `#e74c3c` (red)

**Guardians:**
- DPS: `#e74c3c` (red)
- Tank: `#3498db` (blue)
- Support: `#2ecc71` (green)
- Ranged: `#9b59b6` (purple)

---

## 🔗 ID Reference

### Current Guardian IDs
- `stella` - DPS Guardian
- `vawn` - Tank Guardian
- `tiberius` - Support Guardian
- `maestra` - Ranged Guardian

### Current Item IDs (Examples)
- `circuit_board` - Advanced computing components
- `battery` - Portable power source
- `exotic_matter` - Rare quantum material
- `plasma_cell` - Volatile energy source
- `common_alloy` - Basic metal alloy

*(See `data/items.json` for complete list)*

### Current Mission IDs
- `tech_salvage` - Recover advanced technology
- `first_contact` - Establish communication
- `training_exercise` - Run combat drills

*(See `data/missions.json` for complete list)*

---

## 💡 Tips & Best Practices

1. **Always use unique IDs** - No two items/missions can have the same ID
2. **Test after changes** - Load the game and validate data
3. **Start small** - Add one thing at a time
4. **Copy existing content** - Use it as a template
5. **Use clear names** - Make IDs readable (e.g., `advanced_plasma_rifle` not `apr1`)
6. **Keep backups** - Copy files before big changes

---

## 🚨 Common Mistakes

### Missing Comma
```json
❌ WRONG:
{
  "id": "item1"
  "name": "Item"
}

✅ CORRECT:
{
  "id": "item1",
  "name": "Item"
}
```

### Trailing Comma
```json
❌ WRONG:
{
  "id": "item1",
  "name": "Item",
}

✅ CORRECT:
{
  "id": "item1",
  "name": "Item"
}
```

### Invalid References
```json
❌ WRONG:
"cost": [
  { "item": "doesnt_exist", "amount": 1 }
]

✅ CORRECT:
"cost": [
  { "item": "circuit_board", "amount": 1 }
]
```

---

## 📞 Need Help?

1. Check the validation output in debug console
2. Look at existing content for examples
3. Make sure JSON syntax is correct
4. Verify all IDs exist and are spelled correctly

---

## 🎮 Example: Complete New Mission

Here's a full example of adding a new mission:

```json
{
  "id": "asteroid_mining",
  "name": "Asteroid Mining",
  "description": "Extract valuable minerals from a nearby asteroid field",
  "difficulty": 6,
  "visual": {
    "type": "color",
    "value": "#8e44ad",
    "show_name": true
  },
  "prerequisites": {
    "missions_completed": ["tech_salvage"]
  },
  "rewards": [
    {
      "type": "item",
      "item": "exotic_matter",
      "amount": 2
    },
    {
      "type": "item",
      "item": "common_alloy",
      "amount": 5
    }
  ],
  "success_messages": [
    "Mining operation successful!",
    "Asteroid fully harvested!"
  ],
  "failure_messages": [
    "Equipment malfunction. Mining aborted.",
    "Asteroid field too unstable."
  ]
}
```

**What this does:**
- Unlocks after completing "Tech Salvage"
- Medium-hard difficulty (6/10)
- Rewards Exotic Matter and Common Alloy
- Has multiple success/failure messages for variety

---

**Happy content creating!** 🚀
