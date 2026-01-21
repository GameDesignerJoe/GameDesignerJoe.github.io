# Phase 7C: Continuation Instructions

## 📍 Current Status
**Date:** January 15, 2026  
**Progress:** ~10% complete (Step 1 in progress)  
**Context Window:** 83% used - Fresh start recommended

---

## ✅ What's Been Completed

### Phase 7B - Squad & Loadout System
- ✅ Full squad selection & loadout management
- ✅ Success rate calculations with bonuses
- ✅ All bug fixes and UX improvements
- ✅ Guardian indicators on equipped items

### Phase 7C - Mission Polish (Started)
- ✅ Created PHASE_7C_POLISH_QUARTERS.md plan
- ✅ Started mission data updates in missions.json:
  - First Contact: Added chain (Diplomatic Relations 1/2)
  - Updated some difficulty colors
  - Supply Run: Color changed to teal

---

## 🎯 Next Steps - Resume Here

### **STEP 1: Finish Mission Data Updates (15-20 min)**

#### 1.1 Add Mission Chains
Open `data/missions.json` and add chain fields to:

```json
// Diplomatic Mission (add after line with "diplomatic_mission")
"chain": {
  "name": "Diplomatic Relations",
  "part": 2,
  "total": 2
},

// Tech Salvage (update existing)
"chain": {
  "name": "Tech Investigation",
  "part": 1,
  "total": 2
},

// Reactor Crisis (update existing)
"chain": {
  "name": "Tech Investigation", 
  "part": 2,
  "total": 2
},

// Rescue Operation (update existing)
"chain": {
  "name": "Lost Kin",
  "part": 1,
  "total": 2
},

// Kin Assault (update existing)
"chain": {
  "name": "Lost Kin",
  "part": 2,
  "total": 2
}
```

#### 1.2 Fix Difficulty Colors
Update these mission colors in `missions.json`:

**Difficulty 3 → Yellow (#f39c12):**
- Hostile Engagement
- Kin Assault

**Difficulty 4 → Orange (#e67e22):**
- Deep Space Recon  
- Reactor Crisis

**Keep Training Exercise gray (#7f8c8d)** - it's intentionally dull

---

### **STEP 2: Implement Mission Card Improvements (1 hour)**

#### 2.1 Show Chain Info on Cards
In `js/rooms.js`, update `createMissionCard()`:

```javascript
// After mission name, add chain display
if (mission.chain) {
    const chainInfo = document.createElement('div');
    chainInfo.className = 'mission-chain-badge';
    chainInfo.textContent = `${mission.chain.name} - Part ${mission.chain.part}/${mission.chain.total}`;
    card.appendChild(chainInfo);
}
```

Add CSS in `css/rooms.css`:
```css
.mission-chain-badge {
    font-size: 11px;
    color: var(--primary);
    background: rgba(74, 144, 226, 0.2);
    padding: 3px 8px;
    border-radius: 4px;
    margin-top: 5px;
    display: inline-block;
}
```

#### 2.2 Show Resources on Cards
In `js/rooms.js`, update `createMissionCard()`:

```javascript
// After description, add resource preview
const resourcePreview = document.createElement('div');
resourcePreview.className = 'mission-resources';
resourcePreview.textContent = 'Rewards: ';

// Get top 3 rewards by drop chance
const topRewards = mission.rewards.success
    .sort((a, b) => b.drop_chance - a.drop_chance)
    .slice(0, 3);

topRewards.forEach(reward => {
    const item = window.itemsData.find(i => i.id === reward.item);
    if (item) {
        resourcePreview.textContent += `${item.name}, `;
    }
});

card.appendChild(resourcePreview);
```

Add CSS in `css/rooms.css`:
```css
.mission-resources {
    font-size: 12px;
    color: var(--success);
    margin-top: 8px;
    opacity: 0.8;
}
```

#### 2.3 Add Mission Counter
In `js/rooms.js`, update `renderMissionComputer()`:

```javascript
// At the start, before mission grid
const statsDiv = document.createElement('div');
statsDiv.className = 'mission-stats';

const totalMissions = gameState.missions_completed?.length || 0;
const totalRun = gameState.total_missions_run || 0;
const successRate = totalRun > 0 ? Math.round((totalMissions / totalRun) * 100) : 0;

statsDiv.innerHTML = `
    <div class="stat-item">
        <span class="stat-label">Missions Completed:</span>
        <span class="stat-value">${totalMissions}</span>
    </div>
    <div class="stat-item">
        <span class="stat-label">Success Rate:</span>
        <span class="stat-value">${successRate}%</span>
    </div>
`;

container.appendChild(statsDiv);
```

Add CSS in `css/rooms.css`:
```css
.mission-stats {
    display: flex;
    gap: 30px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    margin-bottom: 20px;
}

.stat-item {
    display: flex;
    gap: 10px;
}

.stat-label {
    color: var(--disabled);
}

.stat-value {
    color: var(--primary);
    font-weight: 700;
}
```

#### 2.4 Add "NEW" Indicators
In `js/state.js`, add to initial state:
```javascript
completed_missions: [],  // Array of mission IDs completed
```

In `js/rooms.js`, update `createMissionCard()`:
```javascript
// Check if mission is new (never completed)
const isNew = !gameState.completed_missions.includes(mission.id);
if (isNew) {
    card.classList.add('mission-new');
    const newBadge = document.createElement('div');
    newBadge.className = 'new-badge';
    newBadge.textContent = 'NEW!';
    card.appendChild(newBadge);
}
```

Add CSS in `css/rooms.css`:
```css
.mission-card.mission-new {
    border: 2px solid gold;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
}

.new-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: gold;
    color: black;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    transform: rotate(15deg);
}
```

In `js/missions.js`, update mission completion:
```javascript
// After successful mission
if (!gameState.completed_missions.includes(missionId)) {
    gameState.completed_missions.push(missionId);
}
```

---

### **STEP 3: Balance Fixes (30 min)**

#### 3.1 Starting Items
In `js/state.js`, update `initializeGameState()`:

```javascript
// If new game, give starting resources
if (!existingState) {
    state.inventory = {
        plasma_cell: 20,
        metal_parts: 15,
        common_alloy: 10,
        battery: 5
    };
    
    // Give starting blueprints
    state.learned_blueprints = [
        'blueprint_basic_rifle',
        'blueprint_basic_shield'
    ];
}
```

#### 3.2 Craft Notifications
In `js/missions.js`, after adding items to inventory:

```javascript
// Check if new items enable crafting
checkCraftUnlocks(gameState);

function checkCraftUnlocks(state) {
    const workstations = window.workstationsData || [];
    
    workstations.forEach(ws => {
        ws.recipes.forEach(recipe => {
            // Skip if already notified
            const notifyKey = `craft_notify_${recipe.id}`;
            if (state[notifyKey]) return;
            
            // Check if can now craft
            if (canCraftRecipe(recipe, ws, state)) {
                showNotification(`You can now craft: ${recipe.name}!`, 'success');
                state[notifyKey] = true;
            }
        });
    });
}
```

---

### **STEP 4: Quarters Room (2-3 hours)**

See PHASE_7C_POLISH_QUARTERS.md for full details on:
- Adding quarters room to rooms.json
- Creating statistics.js for stat calculations
- Creating trophies.js and trophies.json
- Rendering quarters room UI

---

## 🔍 Testing Checklist

After each step, test:
- [ ] Mission cards show chain info correctly
- [ ] Resources display on cards
- [ ] Mission counter shows accurate stats
- [ ] NEW badges appear on uncompleted missions
- [ ] Starting items allow immediate crafting
- [ ] Craft notifications appear appropriately

---

## 📁 Files to Modify

**Data:**
- `data/missions.json` - Add chains, fix colors

**JavaScript:**
- `js/rooms.js` - Mission card improvements, counter
- `js/state.js` - Starting items, completed tracking
- `js/missions.js` - Craft notifications

**CSS:**
- `css/rooms.css` - New styles for improvements

**New Files (Step 4):**
- `js/statistics.js`
- `js/trophies.js`
- `data/trophies.json`

---

## 💡 Tips

1. **Test incrementally** - After each sub-step, refresh and test
2. **Use debug mode** - Check console for errors
3. **Save often** - The game auto-saves, but commit to git
4. **Check PHASE_7C_POLISH_QUARTERS.md** for full context

---

## ⏱️ Time Estimates

- Finish Step 1 data: 20 min
- Implement Step 2 JS: 1 hour
- Implement Step 3 balance: 30 min  
- Implement Step 4 quarters: 2-3 hours

**Total remaining:** ~4-5 hours

---

## 🎯 End Goal

When Phase 7C is complete, the game will have:
- ✨ Polished mission system with chains & better UX
- ⚖️ Balanced starting experience  
- 🏆 Quarters room showing player achievements
- 📊 Full statistics tracking
- 🎮 Complete, polished gameplay loop!

---

**Ready to continue! Start with Step 1.1 above.** 🚀
