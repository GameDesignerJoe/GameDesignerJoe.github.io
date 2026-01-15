# Ship Life Prototype - AI Agent Quick Start Guide

## READ THIS FIRST

You are building a **web-based prototype** that simulates the "life between missions" gameplay loop for FellowDivers, a space superhero game. This is a **proof of concept** to test whether narrative progression and resource management can drive long-term player engagement.

**Your client**: Joe, a World Director who needs this prototype to demonstrate core systems to stakeholders.

**Your mission**: Build a functional, extensible prototype where players complete missions, gather resources, craft items, upgrade workstations, and build relationships with Guardian characters—all through a clean, data-driven architecture.

---

## Project Philosophy: Build for Iteration, Not Perfection

### The Golden Rules

1. **Data-Driven Everything**: Joe will edit JSON files constantly. Code should NEVER require changes for content updates.
2. **Incremental & Testable**: Each feature must work in isolation before moving forward.
3. **Clarity Over Complexity**: Two-state systems (can craft / can't craft) beat five-state systems.
4. **Prototype Speed**: Placeholders are fine. Color blocks with text overlays beat waiting for art.
5. **Auto-Save Everything**: Players should never think about saving.

### What Success Looks Like

✅ Joe can add a new mission by editing Missions.json (no code changes)  
✅ The core loop (Mission → Resources → Crafting → Upgrades) works flawlessly  
✅ Save system persists across browser sessions  
✅ Debug menu lets Joe test any scenario instantly  
✅ The prototype feels responsive and polished (even with placeholder art)

### What Failure Looks Like

❌ Hardcoded content (mission names in JavaScript, not JSON)  
❌ Broken save system (player loses progress on refresh)  
❌ Complex systems that require code changes to add content  
❌ Missing debug tools (Joe can't test edge cases)  
❌ Non-functional placeholders (buttons that do nothing)

---

## Project Structure Overview

```
/shiplife-prototype/
├── index.html              # Password gate
├── game.html               # Main game
├── /css/                   # Styles
├── /js/                    # Game logic
├── /data/                  # JSON files (Joe edits these)
│   ├── rooms.json
│   ├── missions.json
│   ├── guardians.json
│   ├── items.json
│   ├── workstations.json
│   ├── conversations.json
│   └── blueprints.json
├── /assets/                # Images, audio (mostly placeholders)
└── README.md
```

**Key Insight**: Everything in `/data/` is user-editable. Everything in `/js/` is system logic that reads from `/data/`.

---

## The Core Loop (What Players Do)

```
1. Mission Computer → Select mission
2. Planetfall Portal → Simulate mission (loading bar + text)
3. Mission Results → Receive resources
4. Workstations → Craft items using resources
5. Workstations → Upgrade workstation (unlocks better recipes)
6. Observation Deck → Talk to Guardians (builds relationships)
7. Repeat → New missions/conversations unlock based on progress
```

**Your job**: Make this loop feel smooth, rewarding, and bug-free.

---

## Architecture Principles

### 1. State Management (The Blackboard)

**One source of truth**: `localStorage` with key `shiplife_save`

**Contains**:
- Active Guardian (who player is currently inhabiting)
- Inventory (all resources/items owned)
- Workstation levels (progress on upgrades)
- Completed missions (history + unlocks)
- Learned blueprints (unlocked recipes)
- Relationships (missions_together counts per Guardian pair)
- Flags (arbitrary true/false switches)

**Auto-save triggers**: After every meaningful action (mission complete, craft item, finish conversation, upgrade workstation)

**Critical**: If save system breaks, everything breaks. Test this relentlessly.

---

### 2. Data-Driven Design

**Bad Example** (hardcoded):
```javascript
if (missionId === "first_contact") {
  rewards = [{ item: "plasma_cell", amount: 10 }];
}
```

**Good Example** (data-driven):
```javascript
const mission = missions.find(m => m.id === missionId);
const rewards = rollRewards(mission.rewards.success);
```

**Why this matters**: Joe needs to add 50+ missions without touching your code. Make it easy for him.

---

### 3. JSON Structure Philosophy

**Missions.json defines**:
- What missions exist
- Their prerequisites (which missions must be completed first)
- Their rewards (what drops, with RNG)
- Their simulation text (flavor during loading bar)

**Workstations.json defines**:
- What workstations exist
- What recipes they can craft
- What upgrades unlock new recipes

**Conversations.json defines**:
- What dialogues exist
- Who can see them (player_char_req: "stella" vs "any")
- Their prerequisites (missions_together counts, flags, etc.)

**Your job**: Parse these files, enforce the rules, display the results.

---

## Phase 1 Priority: The MVP Core Loop

**Week 1-2 Goal**: Prove the loop works end-to-end.

### Must-Have Features (Phase 1)

1. **Password protection** → index.html blocks access until correct password entered
2. **Landing Page** → "Play" button enters fullscreen, navigates to Character Select
3. **Character Select** → Forces player to choose one of 4 Guardians (Stella, Vawn, Tiberius, Maestra)
4. **Navigation system** → Persistent bar at top, room switching, save last room
5. **Mission Computer** → Display 3 missions (1 unlocked, 2 locked), click to select
6. **Mission simulation** → Loading bar, text messages, 70% success roll, Cancel button
7. **Mission Results** → Show success/fail, list rewards, add to inventory
8. **Inventory display** → List view, grouped by Type, show quantities
9. **Workstations** → Display workstation cards, click opens sidebar
10. **Crafting** → Show recipes, display X/Y resource counts (red if insufficient), craft button
11. **Workstation upgrades** → Upgrade displayed at top of recipe list, deducts resources, increments level
12. **Save/Load** → Auto-save after actions, persist across browser close/reopen
13. **Debug menu** → Gear icon, console commands (give_item, set_flag, reset_save)
14. **ESC key** → Quit dialog, returns to Landing Page

**DO NOT move to Phase 2 until all of Phase 1 works perfectly.**

---

## How to Build This (Step-by-Step Approach)

### Step 1: File Setup (30 minutes)
- Create folder structure
- Add index.html (password gate)
- Add game.html (main container)
- Create empty CSS/JS files
- Create placeholder JSON files with 1-2 entries each

**Test**: Files load, no 404 errors

---

### Step 2: State System (1 hour)
- Build `state.js` with loadSave(), createNewSave(), autoSave()
- Test in browser console: create save, modify, reload page, verify persistence

**Test**: `localStorage.getItem('shiplife_save')` returns valid JSON

---

### Step 3: Navigation (1 hour)
- Build nav bar HTML
- Add room switching function (changes background color)
- Save last room to state

**Test**: Click nav buttons, rooms switch, last room remembered on reload

---

### Step 4: Character Select (1 hour)
- Load Guardians.json
- Display 4 portraits (color placeholders)
- Lock navigation until Guardian chosen
- Save active Guardian to state

**Test**: Can't navigate until Guardian selected, selection persists on reload

---

### Step 5: Mission System (3 hours)
- Load Missions.json (3 missions: 1 unlocked, 2 locked)
- Display mission cards in Mission Computer
- Check prerequisites, gray out locked missions
- Click mission → Navigate to Planetfall Portal
- Build simulation (loading bar, text messages, 12-second duration)
- Roll success (70% for Difficulty 1)
- Display Mission Results screen
- Add rewards to inventory, increment counters, set flags
- Auto-save

**Test**: Complete mission, check inventory has rewards, reload page, check save file

---

### Step 6: Inventory (1 hour)
- Display inventory as list (Resources, Aspects, Blueprints sections)
- Show item name + quantity

**Test**: Inventory shows items from missions

---

### Step 7: Workstations (3 hours)
- Display 1 workstation card in Workstation room
- Click opens sidebar
- Load recipes from Workstations.json
- Display recipe list (left side)
- Click recipe → Show details (right side)
- Display X/Y resource counts (red if insufficient)
- Craft button (gray if can't craft)
- Crafting deducts resources, adds item to inventory
- Refresh sidebar after craft

**Test**: Craft item, inventory updates, resources deducted

---

### Step 8: Workstation Upgrades (1 hour)
- Display upgrade at top of recipe list
- Show upgrade requirements with X/Y counts
- Upgrade button (gray if can't afford)
- Upgrading deducts resources, increments level
- New recipes unlock (previously grayed recipes become normal)

**Test**: Upgrade workstation, new recipes appear

---

### Step 9: Debug Menu (2 hours)
- Gear icon in bottom-right (25% opacity)
- Click opens debug panel
- Console tab: text input, command parser
- Commands: give_item, set_flag, reset_save, view blackboard
- Display confirmation messages

**Test**: `give_item plasma_cell 100` adds to inventory, `reset_save` clears localStorage

---

### Step 10: ESC Key (30 minutes)
- Listen for ESC keypress
- Show quit dialog (modal overlay)
- "Yes" → Exit fullscreen, navigate to Landing Page
- "No" → Close dialog, resume game

**Test**: ESC pauses game, shows dialog, "Yes" returns to Landing Page

---

### Step 11: Polish (1 hour)
- Add hover effects (scale, glow)
- Add click animations (scale down)
- Style grayed-out states (50% opacity)
- Add insufficient resource styling (red text)

**Test**: UI feels responsive, hover/click feedback works

---

### Step 12: End-to-End Test (1 hour)
Run through complete flow:
1. Password → Landing Page → Character Select (choose Stella)
2. Mission Computer → Select mission → Planetfall Portal → Launch
3. Simulation runs → Success
4. Mission Results → Receive resources
5. Workstations → Craft item (should fail, not enough resources)
6. Debug: `give_item plasma_cell 50`
7. Craft item (should succeed)
8. Check inventory → Item appears
9. ESC → Quit → Landing Page
10. Reload page → Resume as Stella in last room

**If all steps work**: Phase 1 complete. Move to Phase 2.

---

## Common Pitfalls & How to Avoid Them

### Pitfall 1: Hardcoding Content
**Bad**: `if (missionId === "first_contact") { ... }`  
**Good**: `const mission = missions.find(m => m.id === missionId)`

**Why**: Joe will add 50 missions. Don't make him edit your code.

---

### Pitfall 2: Not Testing Save/Load
**Problem**: Everything works, then player refreshes and loses progress.  
**Solution**: After every feature, close browser, reopen, verify state persists.

---

### Pitfall 3: Incomplete Auto-Save
**Problem**: Crafting saves, but upgrading doesn't. Player loses upgrade on refresh.  
**Solution**: Call `autoSave(state)` after EVERY state-modifying action.

---

### Pitfall 4: Breaking Prerequisite Logic
**Problem**: Mission shows as unlocked even though prerequisite not met.  
**Solution**: Always check ALL prerequisites (missions_completed, total_missions, flags) with AND logic.

---

### Pitfall 5: Not Building Debug Tools Early
**Problem**: Can't test late-game features without grinding 20 missions.  
**Solution**: Build debug menu in Phase 1. Use it constantly during development.

---

## Testing Strategy

### Unit Test (Per Feature)
After building each feature, test it in isolation:
- Mission selection: Do locked missions stay locked?
- Crafting: Does button gray out when resources insufficient?
- Upgrades: Do new recipes unlock at correct level?

### Integration Test (End of Phase)
Test full flow:
- Mission → Resources → Crafting → Upgrade
- Close browser → Reopen → State persists
- Debug commands → State updates correctly

### Edge Case Test
- What if inventory has 0 items?
- What if all missions completed?
- What if save file corrupted?
- What if player presses ESC during simulation?

**Golden Rule**: If you didn't test it, assume it's broken.

---

## Working with Joe (Your Client)

### What Joe Cares About
1. **Can I edit content without touching code?** (JSON files)
2. **Does the core loop feel rewarding?** (Mission → Craft → Upgrade)
3. **Can I test any scenario instantly?** (Debug menu)
4. **Will this impress stakeholders?** (Polish, responsiveness)

### What Joe Doesn't Care About
- Perfect code architecture (this is a prototype)
- Advanced optimization (60 FPS is fine)
- Mobile support (desktop only)
- Accessibility features (nice-to-have, not required)

### Communication Tips
- **Ask clarifying questions** before building complex features
- **Show working demos** early and often (even if ugly)
- **Document what you built** (Joe will forget details)
- **Flag blockers immediately** (don't waste days on unsolvable problems)

---

## Key Technical Constraints

### Browser Compatibility
- **Target**: Modern Chrome, Firefox, Edge (2024+)
- **No IE support**: Use ES6+ freely
- **No mobile**: Don't worry about touch events

### Performance Targets
- **60 FPS**: Smooth animations
- **< 100ms**: Room switching (instant feel)
- **< 50ms**: Auto-save (imperceptible)
- **< 2 seconds**: Initial load (data files fetch)

### Storage Limits
- **localStorage**: ~5MB available (more than enough)
- **JSON files**: Keep under 1MB each (no issue with current scope)

### Security
- **Password protection**: Simple localStorage check (not cryptographic)
- **Save data**: Unencrypted JSON (this is fine for prototype)

---

## When You Get Stuck

### Debugging Checklist
1. **Check browser console** for errors
2. **View save file**: `localStorage.getItem('shiplife_save')`
3. **Validate JSON**: Copy/paste into jsonlint.com
4. **Test in isolation**: Comment out complex code, test simple version
5. **Use debug menu**: Give yourself resources, set flags, test scenarios

### Common Issues & Solutions

**"Save file won't load"**  
→ Check for JSON syntax errors (missing commas, brackets)  
→ Clear localStorage and start fresh: `localStorage.clear()`

**"Missions won't unlock"**  
→ Check prerequisites in Missions.json  
→ Verify flags are being set correctly  
→ Use debug menu to view blackboard state

**"Crafting button stays grayed"**  
→ Console.log each prerequisite check  
→ Verify workstation level matches recipe.required_level  
→ Check blueprint is in learned_blueprints array

**"Navigation stuck locked"**  
→ Ensure lockNavigation() is always paired with unlockNavigation()  
→ Check for early returns that skip unlock calls

---

## Philosophy Reminders

### Build Features, Not Systems
❌ "I'll build a generic interactable system that works for everything"  
✅ "I'll build mission cards first, then workstation cards, then abstract if patterns emerge"

**Why**: Premature abstraction wastes time. Build concrete, refactor later.

---

### Placeholder Everything
❌ "I need final art before I can build this feature"  
✅ "I'll use color blocks with text overlays, art comes later"

**Why**: Art is not blocking. Colored rectangles with `show_name: true` work fine.

---

### Test Constantly
❌ "I'll build all of Phase 1, then test"  
✅ "I'll test after each feature, then test Phase 1 end-to-end"

**Why**: Finding bugs early is 10x faster than debugging a broken system.

---

### Auto-Save Everything
❌ "Players can click 'Save' button"  
✅ "Auto-save after every action, no manual saving"

**Why**: Players will forget to save, then blame you when they lose progress.

---

## Success Metrics (How You'll Know It's Working)

### Phase 1 Complete When:
- ✅ Core loop works (Mission → Craft → Upgrade)
- ✅ Save persists across browser sessions
- ✅ Joe can add missions by editing Missions.json
- ✅ Debug menu provides instant access to any game state
- ✅ UI feels responsive (hover/click animations work)

### Prototype Complete When:
- ✅ All 7 phases implemented (see Milestone Plan)
- ✅ Joe can playtest for 2-3 hours without hitting bugs
- ✅ Conversations unlock based on relationships
- ✅ Guardian swapping changes available conversations
- ✅ Visual polish makes it feel like a real game

---

## Final Pep Talk

You're building a **proof of concept**, not a shipping product. Speed and clarity matter more than perfection. Joe needs this to demonstrate systems to stakeholders, so:

1. **Make it work** (functional features)
2. **Make it editable** (data-driven)
3. **Make it testable** (debug menu)
4. **Make it feel good** (polish)

If you follow the Phase 1 step-by-step guide, you'll have a working prototype in 1-2 weeks. From there, Phases 2-7 are just more content and polish.

**Remember**: Every feature should answer "Can Joe edit this without touching my code?" If the answer is no, refactor.

**You've got this. Start with Phase 1, Step 1. Build incrementally. Test constantly. Ship fast.**

---

## Quick Reference Card

```
PASSWORD: FellowDivers2025
SAVE KEY: shiplife_save
TARGET BROWSERS: Chrome, Firefox, Edge (desktop only)
STACK: HTML5 + CSS3 + Vanilla JS + localStorage
FONTS: Google Fonts (Orbitron + Inter)

PHASES:
1. Foundation (Weeks 1-2) - Core loop MVP
2. Mission Progression (Week 2-3) - Unlocking & repeatability  
3. Workstation Upgrades (Week 3) - Blueprints & progression
4. Conversations (Week 4) - Narrative & relationships
5. Guardian Swapping (Week 4-5) - Per-Guardian filtering
6. Polish (Week 5-6) - Audio hooks, visual refinement
7. Advanced Features (Week 6+) - Aspects, Anomalies

DEBUG COMMANDS:
give_item [id] [amount]
set_flag [name] [true/false]
set_guardian [id]
reset_save

TESTING MANTRA:
Build → Test → Save/Load Test → Move Forward
```

---

**Now go build something amazing. Joe's counting on you.** 🚀