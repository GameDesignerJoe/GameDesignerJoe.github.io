# Ship Life - Phase 7C: Polish & Quarters

## Document Information
- **Phase**: 7C - Polish & Quarters
- **Goal**: Polish existing systems + Add Quarters Room
- **Date**: January 15, 2026
- **Estimated Time**: 4-5 hours

---

## Implementation Plan

### **Step 1: Mission Polish (1-2h)**

#### 1.1 Mission Chains
- Add `chain` field to missions.json
- Format: `{ "name": "Chain Name", "part": 1, "total": 3 }`
- Create 2-3 mission chains:
  - "Lost Kin" (Rescue Operation → Kin Assault)
  - "Tech Investigation" (Tech Salvage → Reactor Crisis)
  - "Diplomatic Relations" (First Contact → Diplomatic Mission)

#### 1.2 Show Resources on Cards
- Display possible rewards on mission cards
- Show 1-3 key resources (highest drop chance)
- Icon + name format

#### 1.3 Better Difficulty Colors
- Current: Red at difficulty 3 is too alarming
- New scale:
  - 1: Green (#27ae60)
  - 2: Teal (#16a085)
  - 3: Yellow (#f39c12)
  - 4: Orange (#e67e22)
  - 5: Red (#c0392b)

#### 1.4 Mission Counter
- Display "Missions Completed: X" at top of Mission Computer
- Track total missions run
- Show success rate percentage

#### 1.5 "New" Indicators
- Gold border for missions player hasn't completed yet
- Track `first_seen` flag per mission
- Visual "NEW!" badge

---

### **Step 2: Balance Fixes (1h)**

#### 2.1 Starting Items
- Give players initial resources/blueprints
- Ensure they can craft at least 1-2 items immediately
- Starting loadout:
  - 20 Plasma Cells
  - 15 Metal Parts
  - 10 Common Alloy
  - 2-3 basic blueprints

#### 2.2 Item Unlock Notifications
- Show notification when player gets items needed for a recipe
- "You can now craft: [Item Name]!"
- Check after every mission reward

---

### **Step 3: Quarters Room (2-3h)**

#### 3.1 New Room Data
- Add "quarters" to rooms.json
- Description: "Personal quarters displaying your journey"

#### 3.2 Statistics Display
- **Mission Stats:**
  - Total missions: X
  - Success rate: X%
  - Missions by type breakdown
  - Favorite mission (most run)
  
- **Guardian Stats:**
  - Most used guardian
  - Missions per guardian
  - Best performing guardian (highest success rate)

- **Resource Stats:**
  - Total resources collected
  - Rarest item found
  - Items crafted count

#### 3.3 Trophies/Achievements
- Display milestone achievements:
  - "First Mission" - Complete any mission
  - "Perfect Run" - 10 missions with 100% success
  - "Tech Specialist" - Complete all tech missions
  - "Combat Veteran" - Complete 20 combat missions
  - "Full Squad" - Complete mission with all 4 guardians
  - "Solo Mission" - Complete difficult mission with 1 guardian
  - "Well Equipped" - Have all 4 guardians with full loadouts
  - "Master Crafter" - Craft 10 different items
  - "Collector" - Obtain 5 rare items

#### 3.4 Quarters UI
- Grid layout showing trophy cards
- Each trophy shows:
  - Icon/visual
  - Name
  - Description
  - Progress bar (if not complete)
  - "Unlocked" stamp if complete

---

## File Changes

### Data Files:
1. `data/missions.json` - Add chains, update colors
2. `data/rooms.json` - Add Quarters room
3. **NEW** `data/trophies.json` - Trophy definitions

### JavaScript Files:
1. `js/state.js` - Add statistics tracking
2. `js/rooms.js` - Add Quarters rendering
3. `js/missions.js` - Update for chains & notifications
4. **NEW** `js/statistics.js` - Statistics calculation
5. **NEW** `js/trophies.js` - Trophy system

### CSS Files:
1. `css/rooms.css` - Quarters room styles
2. `css/ui.css` - Trophy card styles

---

## Success Criteria

Phase 7C is complete when:
- [x] Missions show chains ("Part 1 of 2")
- [x] Resources displayed on mission cards
- [x] Better difficulty color scale
- [x] Mission counter at Mission Computer
- [x] "New" indicators on unplayed missions
- [x] Starting items balance fixed
- [x] Craft unlock notifications work
- [x] Quarters room functional
- [x] Statistics display accurate
- [x] Trophy system working
- [x] All features tested and polished

---

## Time Breakdown

- **Day 1 (1.5h):** Mission polish (chains, resources, colors, counter)
- **Day 2 (1h):** Balance fixes + notifications
- **Day 3 (2-3h):** Quarters room + trophies system

**Total:** 4.5-5.5 hours
