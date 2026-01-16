# Ship Life - Audio Code Mapping

## 📋 Overview

This document maps every audio asset to its exact location in the codebase, showing where and when each sound is triggered. This is useful for developers implementing sounds and for audio designers understanding context.

---

## 🎼 BACKGROUND MUSIC

### How Music Works

**System:** `js/audio.js` - `AudioManager.playMusic()`  
**Trigger:** `js/rooms.js` - `switchRoom()` function  
**Configuration:** `data/rooms.json` - `"music"` field

Music plays automatically when entering a room that has a `"music"` field defined in `rooms.json`.

```javascript
// In js/rooms.js, switchRoom() function:
if (room.music && window.audioManager) {
    window.audioManager.playMusic(room.music);
}
```

### Music Mapping

| Music File | Room ID | Triggered By | Code Location |
|------------|---------|--------------|---------------|
| `landing.mp3` | `landing_page` | Page load | `js/main.js` - Initial room |
| `character_select.mp3` | `character_select` | Character selection screen | `js/rooms.js` - `switchRoom('character_select')` |
| `mission_computer.mp3` | `mission_computer` | Mission Computer nav click | `js/rooms.js` - `switchRoom('mission_computer')` |
| `workstations.mp3` | `workstation_room` | Workstations nav click | `js/rooms.js` - `switchRoom('workstation_room')` |
| `planetfall.mp3` | `planetfall_portal` | Planetfall Portal nav click | `js/rooms.js` - `switchRoom('planetfall_portal')` |
| `character_room.mp3` | `character_room` | Characters nav click | `js/rooms.js` - `switchRoom('character_room')` |
| `inventory.mp3` | `inventory` | Inventory nav click | `js/rooms.js` - `switchRoom('inventory')` |
| `observation_deck.mp3` | `observation_deck` | Observation Deck nav click | `js/rooms.js` - `switchRoom('observation_deck')` |
| `quarters.mp3` | `quarters` | Quarters nav click | `js/rooms.js` - `switchRoom('quarters')` |

---

## 🔊 SOUND EFFECTS

### SFX System

**System:** `js/audio.js` - `AudioManager.playSFX()`  
**Constants:** `js/audio.js` - `SFX` object defines all sound IDs

```javascript
// Example usage:
window.audioManager.playSFX(SFX.CLICK);
```

---

## CATEGORY 1: MISSION SYSTEM

### mission_card_click.mp3
**SFX Constant:** `SFX.MISSION_SELECT` (needs to be added)  
**Triggered:** Clicking a mission card  
**Code Location:** `js/rooms.js` - `createMissionCard()`

```javascript
// In createMissionCard():
if (!isLocked) {
    card.onclick = () => {
        audioManager.playSFX(SFX.MISSION_SELECT);  // ADD THIS
        selectMission(mission);
    };
}
```

**Current Status:** Not implemented yet

---

### mission_launch.mp3
**SFX Constant:** `SFX.MISSION_START`  
**Triggered:** Launching a mission from Planetfall Portal  
**Code Location:** `js/missions.js` - `startMissionSimulation()`

```javascript
// In startMissionSimulation():
function startMissionSimulation(mission, squadIds) {
    audioManager.playSFX(SFX.MISSION_START);  // ADD THIS
    // ... rest of function
}
```

**Current Status:** Defined but not implemented

---

### mission_progress.mp3
**SFX Constant:** `SFX.MISSION_PROGRESS` (optional, needs to be added)  
**Triggered:** Each progress message during simulation  
**Code Location:** `js/missions.js` - `displaySimulationMessage()`

```javascript
// Optional - add to displaySimulationMessage():
function displaySimulationMessage(msg) {
    audioManager.playSFX(SFX.MISSION_PROGRESS);  // OPTIONAL
    // ... update progress bar
}
```

**Current Status:** Not implemented (optional)

---

### mission_success.mp3
**SFX Constant:** `SFX.MISSION_SUCCESS`  
**Triggered:** Mission completed successfully  
**Code Location:** `js/missions.js` - `completeMissionSimulation()` (success case)

```javascript
// In completeMissionSimulation():
if (success) {
    audioManager.playSFX(SFX.MISSION_SUCCESS);  // ADD THIS
    // ... show success message
}
```

**Current Status:** Defined but not implemented

---

### mission_fail.mp3
**SFX Constant:** `SFX.MISSION_FAIL`  
**Triggered:** Mission failed  
**Code Location:** `js/missions.js` - `completeMissionSimulation()` (fail case)

```javascript
// In completeMissionSimulation():
if (!success) {
    audioManager.playSFX(SFX.MISSION_FAIL);  // ADD THIS
    // ... show failure message
}
```

**Current Status:** Defined but not implemented

---

### mission_reward.mp3
**SFX Constant:** `SFX.MISSION_REWARD` (needs to be added)  
**Triggered:** Receiving rewards after mission  
**Code Location:** `js/missions.js` - `addRewardsToInventory()`

```javascript
// In addRewardsToInventory():
function addRewardsToInventory(rewards) {
    audioManager.playSFX(SFX.MISSION_REWARD);  // ADD THIS
    // ... add items to inventory
}
```

**Current Status:** Not implemented

---

### mission_unlock.mp3
**SFX Constant:** `SFX.UNLOCK`  
**Triggered:** New mission becomes available  
**Code Location:** `js/missions.js` - When mission prerequisites met

```javascript
// When unlocking mission:
audioManager.playSFX(SFX.UNLOCK);
showNotification('New mission unlocked!');
```

**Current Status:** Defined but not implemented

---

## CATEGORY 2: NAVIGATION & UI

### nav_click.mp3
**SFX Constant:** `SFX.NAV_CLICK` (needs to be added)  
**Triggered:** Clicking navigation buttons  
**Code Location:** `js/rooms.js` - `initializeNavigation()`

```javascript
// In initializeNavigation():
button.onclick = () => {
    audioManager.playSFX(SFX.NAV_CLICK);  // ADD THIS
    switchRoom(room.id);
};
```

**Current Status:** Not implemented

---

### button_click.mp3
**SFX Constant:** `SFX.CLICK`  
**Triggered:** All button clicks throughout the game  
**Code Location:** `js/ui.js` - `createButton()` function

```javascript
// In createButton():
button.onclick = () => {
    audioManager.playSFX(SFX.CLICK);  // ALREADY PARTIALLY IMPLEMENTED
    callback();
};
```

**Current Status:** Defined, needs implementation in all buttons

---

### button_hover.mp3
**SFX Constant:** `SFX.HOVER` (optional, needs to be added)  
**Triggered:** Hovering over buttons  
**Code Location:** Various button creation functions

```javascript
// Optional - add to buttons:
button.onmouseenter = () => {
    audioManager.playSFX(SFX.HOVER);
};
```

**Current Status:** Not implemented (optional)

---

### sidebar_open.mp3
**SFX Constant:** `SFX.SIDEBAR_OPEN` (needs to be added)  
**Triggered:** Opening workstation sidebar or conversation list  
**Code Location:** `js/workstations.js` - `openWorkstation()`

```javascript
// In openWorkstation() and showConversationList():
function openWorkstation(ws) {
    audioManager.playSFX(SFX.SIDEBAR_OPEN);  // ADD THIS
    // ... show sidebar
}
```

**Current Status:** Not implemented

---

### modal_open.mp3
**SFX Constant:** `SFX.MODAL_OPEN` (needs to be added)  
**Triggered:** Opening loadout modal or other dialogs  
**Code Location:** `js/rooms.js` - `openLoadoutModal()`

```javascript
// In openLoadoutModal():
function openLoadoutModal(guardianId) {
    audioManager.playSFX(SFX.MODAL_OPEN);  // ADD THIS
    // ... show modal
}
```

**Current Status:** Not implemented

---

## CATEGORY 3: GUARDIAN SYSTEM

### guardian_select.mp3
**SFX Constant:** `SFX.GUARDIAN_SELECT` (needs to be added)  
**Triggered:** Selecting Guardian at character select  
**Code Location:** `js/rooms.js` - `selectGuardian()`

```javascript
// In selectGuardian():
function selectGuardian(guardian) {
    audioManager.playSFX(SFX.GUARDIAN_SELECT);  // ADD THIS
    gameState.active_guardian = guardian.id;
    // ...
}
```

**Current Status:** Not implemented

---

### guardian_switch.mp3
**SFX Constant:** `SFX.GUARDIAN_SWITCH` (needs to be added)  
**Triggered:** Switching active Guardian in Character Room  
**Code Location:** `js/rooms.js` - `switchGuardian()`

```javascript
// In switchGuardian():
function switchGuardian(guardian) {
    audioManager.playSFX(SFX.GUARDIAN_SWITCH);  // ADD THIS
    gameState.active_guardian = guardian.id;
    // ...
}
```

**Current Status:** Not implemented

---

### squad_toggle.mp3
**SFX Constant:** `SFX.SQUAD_TOGGLE` (needs to be added)  
**Triggered:** Adding/removing Guardians from mission squad  
**Code Location:** `js/rooms.js` - `toggleGuardianSelection()`

```javascript
// In toggleGuardianSelection():
function toggleGuardianSelection(guardianId) {
    audioManager.playSFX(SFX.SQUAD_TOGGLE);  // ADD THIS
    // ... toggle selection
}
```

**Current Status:** Not implemented

---

### loadout_open.mp3
**SFX Constant:** `SFX.LOADOUT_OPEN` (needs to be added)  
**Triggered:** Opening loadout management modal  
**Code Location:** `js/rooms.js` - `openLoadoutModal()`

```javascript
// In openLoadoutModal():
function openLoadoutModal(guardianId) {
    audioManager.playSFX(SFX.LOADOUT_OPEN);  // ADD THIS (or use MODAL_OPEN)
    // ... show modal
}
```

**Current Status:** Not implemented

---

### equip_item.mp3
**SFX Constant:** `SFX.EQUIP` (needs to be added)  
**Triggered:** Equipping equipment or aspects  
**Code Location:** `js/rooms.js` - `showItemPicker()` card onclick

```javascript
// In showItemPicker(), card click handler:
card.onclick = () => {
    if (equipped.equipped) {
        // error case
        return;
    }
    audioManager.playSFX(SFX.EQUIP);  // ADD THIS
    equipItem(gameState, guardianId, item.id, slotType, slotIndex);
    // ...
};
```

**Current Status:** Not implemented

---

### unequip_item.mp3
**SFX Constant:** `SFX.UNEQUIP` (needs to be added)  
**Triggered:** Removing equipped items  
**Code Location:** `js/rooms.js` - `unequipSlot()`

```javascript
// In unequipSlot():
function unequipSlot(guardianId, slotType, slotIndex) {
    audioManager.playSFX(SFX.UNEQUIP);  // ADD THIS
    unequipItem(gameState, guardianId, slotType, slotIndex);
    // ...
}
```

**Current Status:** Not implemented

---

## CATEGORY 4: CRAFTING & WORKSTATIONS

### workstation_open.mp3
**SFX Constant:** `SFX.WORKSTATION_OPEN` (needs to be added)  
**Triggered:** Opening a workstation  
**Code Location:** `js/workstations.js` - `openWorkstation()`

```javascript
// In openWorkstation():
function openWorkstation(ws) {
    audioManager.playSFX(SFX.WORKSTATION_OPEN);  // ADD THIS
    // ... open sidebar
}
```

**Current Status:** Not implemented

---

### recipe_select.mp3
**SFX Constant:** `SFX.RECIPE_SELECT` (needs to be added)  
**Triggered:** Selecting a recipe to view  
**Code Location:** `js/workstations.js` - Recipe card click

```javascript
// In recipe card onclick:
card.onclick = () => {
    audioManager.playSFX(SFX.RECIPE_SELECT);  // ADD THIS
    showRecipeDetails(recipe);
};
```

**Current Status:** Not implemented

---

### craft_success.mp3
**SFX Constant:** `SFX.CRAFT`  
**Triggered:** Successfully crafting an item  
**Code Location:** `js/workstations.js` - `craftRecipe()` (success case)

```javascript
// In craftRecipe():
if (canCraft) {
    audioManager.playSFX(SFX.CRAFT);  // ALREADY HOOKED UP
    // ... craft item
}
```

**Current Status:** Defined, ready for implementation

---

### craft_fail.mp3
**SFX Constant:** `SFX.ERROR`  
**Triggered:** Cannot craft (insufficient resources)  
**Code Location:** `js/workstations.js` - `craftRecipe()` (fail case)

```javascript
// In craftRecipe():
if (!canCraft) {
    audioManager.playSFX(SFX.ERROR);  // ALREADY HOOKED UP
    showNotification('Insufficient resources');
}
```

**Current Status:** Defined, ready for implementation

---

### blueprint_upload.mp3
**SFX Constant:** `SFX.BLUEPRINT_UPLOAD` (needs to be added)  
**Triggered:** Uploading blueprint to Knowledge Base  
**Code Location:** `js/workstations.js` - `uploadBlueprint()`

```javascript
// In uploadBlueprint():
function uploadBlueprint(blueprintId) {
    audioManager.playSFX(SFX.BLUEPRINT_UPLOAD);  // ADD THIS
    // ... upload blueprint
}
```

**Current Status:** Not implemented

---

### workstation_upgrade.mp3
**SFX Constant:** `SFX.WORKSTATION_UPGRADE` (needs to be added)  
**Triggered:** Upgrading a workstation level  
**Code Location:** `js/workstations.js` - `upgradeWorkstation()`

```javascript
// In upgradeWorkstation():
function upgradeWorkstation(wsId) {
    audioManager.playSFX(SFX.WORKSTATION_UPGRADE);  // ADD THIS
    // ... level up workstation
}
```

**Current Status:** Not implemented

---

## CATEGORY 5: CONVERSATION SYSTEM

### conversation_start.mp3
**SFX Constant:** `SFX.CONVERSATION`  
**Triggered:** Starting a conversation  
**Code Location:** `js/conversations.js` - `startConversation()`

```javascript
// In startConversation():
function startConversation(conv) {
    audioManager.playSFX(SFX.CONVERSATION);  // ALREADY HOOKED UP
    // ... show conversation
}
```

**Current Status:** Defined, ready for implementation

---

### dialogue_advance.mp3
**SFX Constant:** `SFX.DIALOGUE_ADVANCE` (needs to be added)  
**Triggered:** Clicking to advance dialogue  
**Code Location:** `js/conversations.js` - `advanceDialogue()`

```javascript
// In advanceDialogue():
function advanceDialogue() {
    audioManager.playSFX(SFX.DIALOGUE_ADVANCE);  // ADD THIS
    // ... show next line
}
```

**Current Status:** Not implemented

---

### conversation_complete.mp3
**SFX Constant:** `SFX.CONVERSATION_COMPLETE` (needs to be added)  
**Triggered:** Finishing a conversation  
**Code Location:** `js/conversations.js` - `endConversation()`

```javascript
// In endConversation():
function endConversation(conv) {
    audioManager.playSFX(SFX.CONVERSATION_COMPLETE);  // ADD THIS
    // ... close conversation
}
```

**Current Status:** Not implemented

---

## CATEGORY 6: TROPHIES & ACHIEVEMENTS

### trophy_unlock.mp3
**SFX Constant:** `SFX.TROPHY_UNLOCK` (needs to be added)  
**Triggered:** Trophy/achievement unlocked  
**Code Location:** `js/trophies.js` - `checkAndUnlockTrophies()`

```javascript
// In checkAndUnlockTrophies():
if (trophy unlocked) {
    audioManager.playSFX(SFX.TROPHY_UNLOCK);  // ADD THIS
    showNotification(`Trophy unlocked: ${trophy.name}`);
}
```

**Current Status:** Not implemented

---

## CATEGORY 7: NOTIFICATIONS & FEEDBACK

### notification_success.mp3
**SFX Constant:** `SFX.NOTIFICATION` or `SFX.SUCCESS` (needs refinement)  
**Triggered:** Success notifications  
**Code Location:** `js/ui.js` - `showNotification()` (success type)

```javascript
// In showNotification():
function showNotification(message, type = 'info') {
    if (type === 'success') {
        audioManager.playSFX(SFX.SUCCESS);  // ADD THIS
    }
    // ... show notification
}
```

**Current Status:** Partially defined

---

### notification_error.mp3
**SFX Constant:** `SFX.ERROR`  
**Triggered:** Error/warning notifications  
**Code Location:** `js/ui.js` - `showNotification()` (error type)

```javascript
// In showNotification():
function showNotification(message, type = 'info') {
    if (type === 'error') {
        audioManager.playSFX(SFX.ERROR);  // ALREADY DEFINED
    }
    // ... show notification
}
```

**Current Status:** Defined, ready for implementation

---

### unlock_generic.mp3
**SFX Constant:** `SFX.UNLOCK`  
**Triggered:** Generic unlock events  
**Code Location:** Various unlock functions

```javascript
// Example - unlocking conversation:
audioManager.playSFX(SFX.UNLOCK);
showNotification('New conversation available!');
```

**Current Status:** Defined, ready for implementation

---

## 📝 IMPLEMENTATION NOTES

### Adding New SFX Constants

To add a new sound effect constant, edit `js/audio.js`:

```javascript
// Add to SFX object:
const SFX = {
    CLICK: 'click',
    CRAFT: 'craft',
    // ... existing constants
    
    // NEW CONSTANTS:
    MISSION_SELECT: 'mission_card_click',
    NAV_CLICK: 'nav_click',
    GUARDIAN_SELECT: 'guardian_select',
    EQUIP: 'equip_item',
    UNEQUIP: 'unequip_item',
    // ... etc
};
```

### Testing Sounds

Use browser console to test any sound:

```javascript
// Test music:
audioManager.playMusic('mission_computer');

// Test SFX:
audioManager.playSFX(SFX.CLICK);
audioManager.playSFX('mission_success');
```

---

## 🎯 PRIORITY IMPLEMENTATION ORDER

### Phase 1: Core Sounds (Tier 1)
1. ✅ Music system (already working)
2. `SFX.CLICK` - Add to all buttons via `createButton()`
3. `SFX.MISSION_START` - Add to `startMissionSimulation()`
4. `SFX.MISSION_SUCCESS` - Add to mission completion
5. `SFX.MISSION_FAIL` - Add to mission failure
6. `SFX.CRAFT` - Add to crafting success
7. `SFX.ERROR` - Add to error notifications
8. `SFX.SUCCESS` - Add to success notifications

### Phase 2: Enhancement (Tier 2)
9. Add all guardian system sounds
10. Add workstation sounds
11. Add conversation sounds
12. Add navigation sounds

### Phase 3: Polish (Tier 3)
13. Add optional hover effects
14. Add progress sounds
15. Add trophy sounds

---

## 🔗 RELATED DOCUMENTS

- `AUDIO_ASSET_SPECIFICATIONS.md` - Detailed asset specs
- `AUDIO_ASSET_LIST.csv` - Complete asset tracking
- `AUDIO_NAMING_CONVENTIONS.md` - File naming standards
- `../AUDIO_IMPLEMENTATION_GUIDE.md` - Original implementation guide

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Contact:** GameDesignerJoe
