# Ship Life - Phase 4.5: Functionality & Bug Fixes

## Document Information
- **Phase**: 4.5 - Functionality & Bug Fixes
- **Goal**: Fix bugs, improve UX, and ensure core systems work smoothly
- **Date**: January 2026
- **Estimated Time**: 2-3 hours

---

## Overview

Phase 4.5 is a "cleanup phase" between completing content (conversations) and adding polish. The goal is to fix any bugs, improve usability, and ensure all core systems work as expected before moving forward.

**Key Focus Areas**:
- Bug fixes
- UX improvements
- Edge case handling
- System consistency
- Quality of life features

---

## Known Issues to Fix

### 1. **Conversation System Issues**
- [ ] Test conversation prerequisite chains (previous_conversations)
- [ ] Ensure completed conversations don't re-appear
- [ ] Verify relationship key generation (alphabetical sorting)
- [ ] Test conversation UI with very long dialogue
- [ ] Ensure portraits display correctly for all Guardians

### 2. **Mission System Issues**
- [ ] Verify missions_together increments for all 6 pairs
- [ ] Test mission success/failure reward rolling
- [ ] Ensure non-repeatable missions don't reappear
- [ ] Check if mission prerequisites work correctly
- [ ] Test mission simulation with skip function

### 3. **Workstation System Issues**
- [ ] Verify blueprint requirements display correctly
- [ ] Test crafting with insufficient resources
- [ ] Ensure workstation level requirements are enforced
- [ ] Check if Knowledge Base only shows unlearned blueprints
- [ ] Test workstation upgrades at max level

### 4. **Inventory System Issues**
- [ ] Ensure inventory items group correctly by type
- [ ] Test empty inventory display
- [ ] Verify item quantities update after crafting
- [ ] Check if items display after mission rewards

### 5. **Guardian Switching Issues**
- [ ] Test conversation availability changes when switching
- [ ] Ensure active Guardian portrait updates
- [ ] Verify Guardian-specific conversations filter correctly
- [ ] Check if player_char_req works for all formats

### 6. **Navigation & UI Issues**
- [ ] Ensure nav bar highlights current room
- [ ] Test sidebar close button functionality
- [ ] Verify modal overlays block navigation correctly
- [ ] Check if fullscreen mode works on all browsers
- [ ] Test responsive layout (if applicable)

### 7. **Save System Issues**
- [ ] Verify auto-save triggers correctly
- [ ] Test save corruption handling
- [ ] Ensure all game state persists across refresh
- [ ] Check export/import save functionality
- [ ] Test reset_save command

---

## Quality of Life Improvements

### 1. **Better Feedback**
- [ ] Add more specific notifications
  - "Blueprint unlocked: [name]"
  - "Conversation unlocked: [title]"
  - "Mission prerequisite not met: Need X more missions"
  
- [ ] Show why missions are locked
  - Display prerequisite requirements on hover
  
- [ ] Show why conversations are unavailable
  - "Complete 'Breaking the Ice' first"
  - "Need 5 more missions together"

### 2. **Better Visual Indicators**
- [ ] Show "NEW" badge on newly unlocked content
- [ ] Highlight active Guardian more clearly
- [ ] Add loading state for mission simulation
- [ ] Show crafting progress/animation
- [ ] Add conversation "Already Completed" indicator

### 3. **Improved Navigation**
- [ ] Add "Back" button in rooms (return to previous room)
- [ ] Show room descriptions on hover
- [ ] Add keyboard shortcuts (ESC to close modals)
- [ ] Quick navigation shortcuts (number keys?)

### 4. **Better Information Display**
- [ ] Mission Computer: Show total available missions count
- [ ] Workstations: Show total learned vs available blueprints
- [ ] Observation Deck: Show how many conversations available
- [ ] Inventory: Show total item count
- [ ] Characters: Show mission count per Guardian

### 5. **Debug Improvements**
- [ ] Add "Unlock All Conversations" command
- [ ] Add "Complete X Missions" command
- [ ] Add "Set Total Missions" command
- [ ] Add "List Available Conversations" command
- [ ] Better error messages in console

---

## Edge Cases to Handle

### 1. **Empty States**
- [x] Empty inventory (handled)
- [x] No missions available (handled)
- [x] No conversations available (handled)
- [ ] No blueprints to upload
- [ ] All workstations maxed out
- [ ] All conversations completed

### 2. **Overflow/Underflow**
- [ ] What if player has 999+ of an item?
- [ ] What if player completes 100+ missions?
- [ ] What if conversation list is very long?
- [ ] What if recipe list exceeds sidebar height?

### 3. **Invalid States**
- [ ] What if no Guardian selected? (redirect to character select)
- [ ] What if data files fail to load? (show error screen)
- [ ] What if save data is corrupted? (create new save)
- [ ] What if JSON has syntax errors? (validate on load)

### 4. **Race Conditions**
- [ ] Clicking buttons multiple times rapidly
- [ ] Starting mission while in workstation
- [ ] Switching rooms during conversation
- [ ] Auto-save during state changes

---

## Testing Checklist

### **Complete Game Flow**
- [ ] Start fresh save
- [ ] Select Guardian
- [ ] Complete 3 missions
- [ ] Craft 2 items
- [ ] Upload 1 blueprint
- [ ] Switch Guardian
- [ ] Play 2 conversations
- [ ] Complete 5 more missions
- [ ] Play more conversations
- [ ] Upgrade 1 workstation
- [ ] Craft with new level
- [ ] Complete all available conversations
- [ ] Max out all workstations
- [ ] Complete 20+ missions

### **Edge Case Testing**
- [ ] Try to craft without resources
- [ ] Try to upgrade without resources
- [ ] Try to upload already-learned blueprint
- [ ] Complete non-repeatable mission twice
- [ ] Switch Guardian mid-mission (shouldn't be possible)
- [ ] Close sidebar while crafting
- [ ] Spam click mission cards
- [ ] Refresh page mid-mission

### **Cross-Browser Testing**
- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if Mac available)

---

## Specific Bug Reports from User

_This section will be filled in with specific bugs/issues the user has encountered_

### Bug 1: [User Reported]
**Description:**
**Steps to Reproduce:**
**Expected Behavior:**
**Actual Behavior:**
**Fix:**

### Bug 2: [User Reported]
**Description:**
**Steps to Reproduce:**
**Expected Behavior:**
**Actual Behavior:**
**Fix:**

### Bug 3: [User Reported]
**Description:**
**Steps to Reproduce:**
**Expected Behavior:**
**Actual Behavior:**
**Fix:**

---

## Implementation Priority

### **High Priority (Must Fix)**
1. Game-breaking bugs
2. Save corruption issues
3. Critical UX problems
4. Conversation system bugs
5. Mission reward bugs

### **Medium Priority (Should Fix)**
1. QoL improvements
2. Better feedback messages
3. Edge case handling
4. Visual indicators
5. Debug command improvements

### **Low Priority (Nice to Have)**
1. Keyboard shortcuts
2. Hover tooltips
3. Animation polish
4. Additional debug commands
5. Cross-browser tweaks

---

## Success Criteria

**Phase 4.5 is complete when:**
- [ ] All high-priority bugs fixed
- [ ] Complete game flow works end-to-end
- [ ] Edge cases handled gracefully
- [ ] QoL improvements implemented
- [ ] User-reported bugs addressed
- [ ] Testing checklist completed
- [ ] Game feels stable and polished

---

## Next Steps After Phase 4.5

Once functionality is solid, move to:
- **Phase 6**: Polish & Extensibility (animations, audio hooks, documentation)
- **Phase 7**: Advanced Features (Aspects, Anomalies, Achievements)

---

**END OF PHASE 4.5 PLAN**
