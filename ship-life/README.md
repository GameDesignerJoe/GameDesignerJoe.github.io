# Ship Life Prototype - Phase 1 Complete

A web-based prototype for testing the "life between missions" gameplay loop for FellowDivers.

## 🚀 Quick Start

### Running Locally

1. **Open the prototype:**
   - Navigate to the `/ship-life` folder
   - Open `index.html` in a web browser
   - **OR** use a local server (recommended):
     ```bash
     # Using Python
     python -m http.server 8000
     # Then visit: http://localhost:8000/ship-life/
     
     # Using Node.js
     npx serve
     ```

2. **Enter the password:**
   - Password: `FellowDivers2025`
   - Password is cached in browser after first entry

3. **Play the game:**
   - Click "Play" to enter fullscreen
   - Select a Guardian (Stella, Vawn, Tiberius, or Maestra)
   - Start running missions!

## 📋 Phase 1 Features (COMPLETE)

### ✅ Implemented Systems

- **Password Protection** - Secure access with cached authentication
- **Character Selection** - Choose from 4 Guardians
- **Mission System** - 3 missions with simulation, success/failure, and rewards
- **Inventory** - Auto-tracked resource collection
- **Crafting** - 2 workstations with recipes and upgrades
- **Blueprint System** - Starting blueprints auto-unlocked
- **Navigation** - Seamless room switching with state persistence
- **Auto-Save** - Progress saved after every action
- **Debug Menu** - Full testing suite (gear icon in bottom-right)
- **ESC Key** - Quit dialog functionality

### 🎮 Core Gameplay Loop

```
Mission Computer → Select Mission → Planetfall Portal → Launch Mission
→ Simulation (with skip option) → Rewards → Mission Results
→ Workstations → Craft Items → Upgrade Workstations → Repeat
```

## 🛠️ Editing Content (No Code Required!)

All game content is in JSON files in the `/data` folder:

### Adding a New Mission

Edit `data/missions.json`:

```json
{
  "id": "new_mission",
  "name": "New Mission Name",
  "description": "Mission description",
  "visual": {
    "type": "color",
    "value": "#ff6600",
    "show_name": true
  },
  "difficulty": 2,
  "repeatable": true,
  "prerequisites": {
    "missions_completed": [],
    "total_missions": 0,
    "flags": []
  },
  "rewards": {
    "success": [
      {
        "item": "plasma_cell",
        "min": 5,
        "max": 10,
        "drop_chance": 100
      }
    ]
  },
  "simulation": {
    "messages": [
      {
        "text": "Your message here",
        "bar_progress": 25,
        "display_time": 3
      }
    ]
  }
}
```

### Adding a New Item

Edit `data/items.json`:

```json
{
  "id": "new_item",
  "name": "New Item",
  "description": "Item description",
  "icon": {
    "type": "color",
    "value": "#00ff00",
    "show_name": true
  },
  "type": "resource",
  "stack_count": 0
}
```

### Adding a New Recipe

Edit `data/workstations.json` - add to a workstation's `recipes` array:

```json
{
  "id": "new_recipe",
  "name": "New Item",
  "description": "What it does",
  "required_level": 1,
  "blueprint_required": "blueprint_id",
  "cost": [
    {
      "item": "plasma_cell",
      "amount": 10
    }
  ],
  "output": {
    "item": "crafted_item_id",
    "amount": 1
  }
}
```

## 🐛 Debug Menu

Access via the **gear icon** (bottom-right, 25% opacity).

### Console Commands

- `give_item [id] [amount]` - Add items to inventory
- `set_flag [name] [true/false]` - Set game flags
- `complete_mission [id]` - Mark mission as complete
- `set_guardian [id]` - Switch active Guardian
- `reset_save` - Clear all progress
- `help` - List all commands

### Quick Panels

- **View Blackboard** - See full save state
- **View Inventory** - Display all items
- **Reset Save** - Start fresh
- **Give 100 of Each Resource** - Quick testing

## 📁 Project Structure

```
/ship-life/
├── index.html              # Password gate
├── game.html               # Main game
├── README.md               # This file
├── /css/                   # All styles
│   ├── main.css
│   ├── rooms.css
│   ├── ui.css
│   └── debug.css
├── /js/                    # All game logic
│   ├── main.js             # Initialization
│   ├── state.js            # Save system
│   ├── rooms.js            # Navigation
│   ├── missions.js         # Mission system
│   ├── workstations.js     # Crafting
│   ├── guardians.js        # Characters
│   ├── inventory.js        # Items
│   ├── ui.js               # UI utilities
│   ├── debug.js            # Debug tools
│   └── conversations.js    # Phase 4 stub
└── /data/                  # JSON content files
    ├── rooms.json          # 6 rooms
    ├── guardians.json      # 4 Guardians
    ├── missions.json       # 3 missions
    ├── items.json          # 7 items
    ├── workstations.json   # 2 workstations
    └── blueprints.json     # 2 blueprints
```

## 🎯 Testing Checklist

### Phase 1 Acceptance Test

1. ✅ Password gate works
2. ✅ Character selection required on first run
3. ✅ Mission Computer shows 3 missions
4. ✅ Mission simulation runs with progress bar
5. ✅ Success/failure determined by difficulty
6. ✅ Rewards added to inventory
7. ✅ Workstations display correctly
8. ✅ Recipes show as grayed-out when can't craft
9. ✅ Crafting deducts resources and adds output
10. ✅ Workstation upgrades work
11. ✅ Save persists across browser close/reopen
12. ✅ ESC key shows quit dialog
13. ✅ Debug menu provides testing tools

### Quick Test Flow

```
1. Enter password → 2. Select Stella → 3. Run "First Contact" mission
→ 4. Check inventory has resources → 5. Open Debug menu
→ 6. give_item plasma_cell 100 → 7. Craft Plasma Rifle
→ 8. Close browser → 9. Reopen → Verify progress saved
```

## 🔄 What's Next (Future Phases)

### Phase 2: Mission Progression
- Mission unlocking system
- Repeatable vs one-time missions
- Variable reward drops

### Phase 3: Workstation Upgrades
- More workstations (5 total)
- Level 2-3 recipes
- Blueprint looting from missions

### Phase 4: Conversation System
- Guardian relationships
- Missions_together tracking
- Important vs Background conversations

### Phase 5: Guardian Swapping
- Character Room
- Per-Guardian conversation filtering

### Phase 6+: Polish & Advanced Features
- Audio hooks
- Visual polish
- Aspect system
- Anomaly system

## 💾 Save System

- **Storage**: Browser localStorage
- **Key**: `shiplife_save`
- **Format**: JSON
- **Auto-save triggers**: Mission complete, craft item, upgrade workstation
- **Persistence**: Survives browser close/reopen

### View Your Save

Open browser console (F12) and run:
```javascript
localStorage.getItem('shiplife_save')
```

### Reset Save

Use debug menu or browser console:
```javascript
localStorage.removeItem('shiplife_save')
location.reload()
```

## 🎨 Customization

### Change Colors

Edit CSS variables in `css/main.css`:

```css
:root {
    --primary: #4a90e2;      /* Main accent color */
    --success: #2ecc71;      /* Success messages */
    --danger: #e74c3c;       /* Errors/warnings */
    --text-light: #ecf0f1;   /* Main text color */
}
```

### Change Room Backgrounds

Edit `data/rooms.json`:

```json
{
  "background": {
    "type": "color",
    "value": "#your-hex-color"
  }
}
```

## 🐞 Troubleshooting

### Game Won't Load
- Check browser console (F12) for errors
- Ensure all JSON files are valid (use jsonlint.com)
- Try resetting save: `localStorage.clear()`

### Can't Craft Items
- Check you have enough resources (debug menu → View Inventory)
- Verify workstation level is high enough
- Confirm blueprint is unlocked (should be auto-unlocked on first load)

### Save Not Persisting
- Check browser allows localStorage
- Try different browser (Chrome, Firefox, Edge)
- Disable private/incognito mode

## 📝 Notes for Developers

- **No frameworks** - Pure vanilla JavaScript (ES6+)
- **Data-driven** - All content in JSON files
- **Auto-save** - Called after every state-modifying action
- **Color placeholders** - All visuals use `show_name: true` for now
- **Fullscreen API** - May require user gesture to trigger

## 🎉 Success Criteria

Phase 1 is complete when:
- ✅ Core loop works (Mission → Craft → Upgrade)
- ✅ Save persists across sessions
- ✅ Content editable via JSON files only
- ✅ Debug menu provides instant testing
- ✅ UI feels responsive with hover/click animations

---

**Built with ❤️ for the FellowDivers prototype**

For questions or issues, check the documentation in `/ship-life/docs/`
