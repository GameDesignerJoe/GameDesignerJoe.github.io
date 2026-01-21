# Ship Life - Phase 6: Polish & Extensibility

## Document Information
- **Phase**: 6 - Polish & Extensibility
- **Goal**: Make the game feel professional and easy to maintain/expand
- **Date**: January 2026
- **Estimated Time**: 3-4 hours

---

## Overview

Phase 6 focuses on polish, maintainability, and setting up systems for future expansion. The goal is to make the game feel finished and make it easy for non-developers to add content.

**Key Focus Areas**:
- Visual polish (animations, transitions)
- Audio system hooks (ready for sound files)
- Data validation tools
- Documentation for content creators

---

## 1. Visual Polish

### 1.1 Better Animations
- [ ] Smooth fade-in for rooms
- [ ] Card hover animations (slight lift, glow)
- [ ] Button press feedback (scale down)
- [ ] Loading spinner for mission simulation
- [ ] Success/failure animations on mission results
- [ ] Notification slide-in animation

### 1.2 Transitions
- [ ] Smooth room transitions (fade out/in)
- [ ] Sidebar slide-in/out animation
- [ ] Modal fade-in with backdrop
- [ ] Progress bar smooth fill animation

### 1.3 Loading States
- [ ] "Loading..." indicator when switching rooms
- [ ] Crafting progress indicator
- [ ] Mission simulation progress feedback
- [ ] Data loading spinner on startup

### 1.4 Visual Feedback
- [ ] Pulse animation on new unlocks
- [ ] Shake animation on errors
- [ ] Success checkmark animation
- [ ] Ripple effect on button clicks

---

## 2. Audio System Setup

### 2.1 Room Music
- [ ] Add `music` field to rooms.json
- [ ] Create audio manager system
- [ ] Music fade in/out on room change
- [ ] Volume controls (master, music, sfx)

### 2.2 Sound Effect Hooks
- [ ] Click sound hook (buttons, cards)
- [ ] Craft sound hook
- [ ] Mission start/complete sounds
- [ ] Conversation advance sound
- [ ] Unlock/achievement sound
- [ ] Error sound

### 2.3 Audio Settings
- [ ] Mute toggle
- [ ] Volume sliders in debug menu
- [ ] Save audio preferences
- [ ] Audio enable/disable per category

**Note:** No actual audio files yet - just hooks ready for future addition

---

## 3. Data Validation

### 3.1 JSON Validation
- [ ] Check for syntax errors in JSON files
- [ ] Validate required fields
- [ ] Check for invalid IDs/references
- [ ] Warn about missing prerequisite chains

### 3.2 Reference Validation
- [ ] Validate item IDs in recipes
- [ ] Validate guardian IDs in conversations
- [ ] Validate mission IDs in prerequisites
- [ ] Validate blueprint IDs in recipes

### 3.3 Debug Validation Tool
- [ ] "Validate All Data" button in debug menu
- [ ] Report missing/invalid references
- [ ] Check for orphaned conversations
- [ ] Check for unreachable missions

### 3.4 Console Warnings
- [ ] Warn about duplicate IDs
- [ ] Warn about missing visual assets
- [ ] Warn about broken conversation chains
- [ ] Warn about impossible crafting recipes

---

## 4. Documentation

### 4.1 Data File README
- [ ] Create `DATA_EDITING_GUIDE.md`
- [ ] Document JSON structure for each file
- [ ] Explain field meanings
- [ ] Provide examples

### 4.2 Content Creator Guide
- [ ] How to add a new mission
- [ ] How to add a new conversation
- [ ] How to add a new recipe
- [ ] How to add a new Guardian
- [ ] How to create conversation chains

### 4.3 Common Tasks
- [ ] Adding a mission chain
- [ ] Creating a story arc (conversation series)
- [ ] Adding a new crafting tier
- [ ] Balancing mission rewards

### 4.4 Reference Documentation
- [ ] List of all item IDs
- [ ] List of all guardian IDs
- [ ] List of all mission IDs
- [ ] List of all flags

---

## Implementation Plan

### **Step 1: Visual Polish (1-1.5 hours)**
1. Add CSS animations for hover states
2. Implement smooth transitions
3. Add loading states
4. Polish button feedback

### **Step 2: Audio System (1 hour)**
1. Create audio manager skeleton
2. Add music field to rooms.json
3. Add sound hooks to key actions
4. Add audio settings to debug menu

### **Step 3: Data Validation (1 hour)**
1. Create validation system
2. Add reference checking
3. Implement debug validation tool
4. Add console warnings

### **Step 4: Documentation (0.5-1 hour)**
1. Write DATA_EDITING_GUIDE.md
2. Create content creator examples
3. Document common tasks
4. Generate ID reference lists

---

## Success Criteria

**Phase 6 is complete when:**
- [ ] All animations smooth and polished
- [ ] Audio system hooks in place (ready for files)
- [ ] Data validation catches common errors
- [ ] Documentation allows non-devs to add content
- [ ] Game feels professional and finished
- [ ] Easy to maintain and extend

---

## Files to Modify

**New Files:**
- `docs/DATA_EDITING_GUIDE.md`
- `docs/CONTENT_CREATOR_GUIDE.md`
- `js/audio.js` (audio manager)

**Modified Files:**
- `css/ui.css` (animations)
- `css/main.css` (transitions)
- `js/debug.js` (validation tools)
- `data/rooms.json` (music field)
- `game.html` (audio script)

---

## Next Steps After Phase 6

Once polish is complete, move to:
- **Phase 7**: Advanced Features (Aspects, Anomalies, Achievements)
- **Content Expansion**: More missions, conversations, guardians
- **Playtesting**: Balance tuning, feedback gathering

---

**END OF PHASE 6 PLAN**
