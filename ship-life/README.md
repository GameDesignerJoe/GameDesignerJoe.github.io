# Ship Life - Prototype

A data-driven narrative RPG where you manage a spaceship crew, run missions, craft equipment, and build relationships between Guardians.

## 🎮 Quick Start

1. Open `index.html` in a web browser
2. Enter password
3. Click "Play" to start
4. Select your Guardian
5. Run missions, craft items, and explore conversations

## 📚 Documentation

- **[Content Creator Guide](docs/CONTENT_CREATOR_GUIDE.md)** - How to add missions, items, conversations, and more via JSON
- **[Audio Implementation Guide](docs/AUDIO_IMPLEMENTATION_GUIDE.md)** - How to add music and sound effects
- **[Milestone Plan](docs/shiplife_milestone_plan.txt)** - Full development roadmap

## 🎯 Features

- ✅ **Mission System** - 10 missions with prerequisites, chains, and variable rewards
- ✅ **Crafting System** - 6 workstations with 20+ recipes and blueprint unlocks
- ✅ **Guardian System** - 4 playable characters with swappable loadouts
- ✅ **Conversation System** - 20+ dialogues that unlock based on relationships
- ✅ **Loadout System** - Equip guardians with equipment & aspects for mission bonuses
- ✅ **Quarters Room** - Statistics tracking and trophy/achievement system
- ✅ **Data Validation** - Built-in JSON validator in debug menu
- ✅ **Auto-Save** - Progress automatically saved to localStorage

## 🛠️ Tech Stack

- Vanilla JavaScript (ES6+)
- JSON-driven content system
- LocalStorage for save data
- CSS3 animations
- No external dependencies

## 📁 Project Structure

```
ship-life/
├── game.html          # Main game
├── index.html         # Password-protected landing page
├── data/              # All content (JSON files)
├── js/                # Game systems
├── css/               # Styling
├── docs/              # Documentation
└── audio/             # Music & SFX (add your MP3s here)
```

## 🎨 Adding Content

All game content is defined in JSON files in the `data/` folder:

- **missions.json** - Mission definitions
- **items.json** - Resources, equipment, aspects, blueprints
- **workstations.json** - Crafting stations and recipes
- **conversations.json** - Dialogue and story
- **guardians.json** - Character definitions
- **trophies.json** - Achievements
- **rooms.json** - Room definitions

See [Content Creator Guide](docs/CONTENT_CREATOR_GUIDE.md) for detailed instructions.

## 🐛 Debug Menu

Press the **⚙️** button (bottom-right) to open debug tools:

- View Blackboard (game state)
- View Inventory
- Validate Data Files
- Give Items
- Set Flags
- Toggle Audio

## 📝 License

Private prototype - All rights reserved

---

**Current Version**: Phase 7 Complete (Quarters, Loadouts, Trophies)
