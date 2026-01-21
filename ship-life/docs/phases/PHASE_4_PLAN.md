# Ship Life - Phase 4: Conversation System

## Document Information
- **Phase**: 4 - Conversation System
- **Goal**: Add narrative progression through Guardian relationships and dialogue
- **Date**: January 2026
- **Estimated Time**: 3-4 hours

---

## Overview

Phase 4 adds the social/narrative layer to Ship Life. Players will develop relationships with other Guardians through conversations, unlocking story beats and character development moments.

**Key Features**:
- Observation Deck room where Guardians gather
- JRPG-style dialogue system with portraits
- Relationship tracking (missions completed together)
- Conversation prerequisites (unlock after X missions)
- Important story conversations vs Background filler

---

## Phase 4 Deliverables

### 4.1 Observation Deck Room ✅
**Status**: Room already exists in rooms.json, needs implementation

**What to Build**:
- [ ] Display 2-3 Guardian NPCs (those with conversations available)
- [ ] Filter: Only show Guardians who have conversations with active Guardian
- [ ] Filter: Don't show active Guardian (can't talk to yourself)
- [ ] Prioritize Guardians with "Important" conversations
- [ ] Show Guardian portraits in clickable cards
- [ ] Visual: Similar to Character Select, but NPCs not player

**Acceptance Criteria**:
- Observation Deck shows 2 Guardians
- Active Guardian not shown
- Guardians have eligible conversations
- Clicking Guardian → Opens conversation list

---

### 4.2 Conversations.json Data File
**What to Create**:
- [ ] Create `data/conversations.json`
- [ ] Add 10 starter conversations (mix of Important and Background)
- [ ] Define structure:
  ```json
  {
    "conversations": [
      {
        "id": "stella_vawn_first_talk",
        "title": "Breaking the Ice",
        "type": "important",
        "participants": ["stella", "vawn"],
        "player_char_req": "any",
        "prerequisites": {
          "missions_together": { "stella_vawn": 3 },
          "total_missions": 0,
          "flags": []
        },
        "lines": [
          { "actor": "stella", "text": "So... we've been on a few missions now." },
          { "actor": "vawn", "text": "Yeah. You're not bad out there." },
          { "actor": "stella", "text": "Not bad? I saved your life twice!" },
          { "actor": "vawn", "text": "...Fair point." }
        ]
      }
    ]
  }
  ```

**Conversation Types**:
- **Important**: Story-critical, unlock once, advance relationships
- **Background**: Filler conversations, repeatable, add flavor

**Acceptance Criteria**:
- conversations.json created with 10 conversations
- Mix of Important (6) and Background (4)
- Prerequisites vary (1-10 missions_together)
- All 6 Guardian pairs represented (stella_vawn, stella_tiberius, etc.)

---

### 4.3 Conversation List UI
**What to Build**:
- [ ] Click Guardian in Observation Deck → Show conversation list sidebar
- [ ] Display eligible conversations (prerequisites met)
- [ ] Show Important conversations first, then 1 Background
- [ ] Display conversation title and type
- [ ] Clicking conversation → Opens dialogue UI
- [ ] Close button to return to Observation Deck

**Acceptance Criteria**:
- Sidebar opens on right side
- Important conversations listed at top
- Always shows 1 Background conversation (if any available)
- Clicking conversation starts dialogue

---

### 4.4 JRPG-Style Dialogue System
**What to Build**:
- [ ] Modal overlay dialogue UI (blocks navigation)
- [ ] Two portrait slots: Left and Right
- [ ] Actor1 (first participant) always on left
- [ ] Actor2 (second participant) always on right
- [ ] Text box at bottom with speaker name
- [ ] Highlight current speaker's portrait
- [ ] "Next" button advances to next line
- [ ] After final line → Returns to Observation Deck
- [ ] Mark conversation as completed

**Visual Layout**:
```
┌───────────────────────────────────────┐
│  [Portrait]         [Portrait]         │
│   Actor 1            Actor 2           │
│    (dim)           (highlighted)       │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ Speaker: Vawn                   │  │
│  │                                 │  │
│  │ "You're not bad out there."    │  │
│  │                                 │  │
│  │               [Next >]          │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

**Acceptance Criteria**:
- Portraits display correctly (actor1 left, actor2 right)
- Current speaker's portrait highlighted
- Text displays line by line
- "Next" button advances dialogue
- Final line returns to Observation Deck
- Navigation locked during conversation

---

### 4.5 Relationship Tracking System
**What to Build**:
- [ ] Add `relationships` to game state:
  ```javascript
  relationships: {
    stella_vawn: {
      missions_together: 6,
      conversations_completed: ["stella_vawn_first_talk"]
    },
    stella_tiberius: {
      missions_together: 2,
      conversations_completed: []
    }
  }
  ```
- [ ] Generate relationship keys alphabetically (stella_vawn not vawn_stella)
- [ ] Increment missions_together after each mission (for all Guardian pairs)
- [ ] Add conversation ID to conversations_completed after completion

**Acceptance Criteria**:
- missions_together tracks correctly
- All Guardian pairs initialized in relationships
- Keys generated consistently
- conversations_completed array adds IDs after playing

---

### 4.6 Conversation Prerequisites
**What to Build**:
- [ ] Check prerequisites before showing conversation
- [ ] Support multiple prerequisite types:
  - `missions_together`: Specific pair must have X missions together
  - `total_missions`: Player must have completed X total missions
  - `flags`: Specific flags must be set
  - `previous_conversations`: Must have completed specific conversations
- [ ] Use AND logic (all prerequisites must be met)
- [ ] Filter conversations that don't meet requirements

**Example Prerequisites**:
```json
"prerequisites": {
  "missions_together": { "stella_vawn": 6 },
  "total_missions": 10,
  "flags": ["first_contact_complete"],
  "previous_conversations": ["stella_vawn_first_talk"]
}
```

**Acceptance Criteria**:
- Prerequisites checked correctly
- Conversations unlock at right times
- Multiple prerequisite types supported
- AND logic works (all conditions required)

---

### 4.7 Player Character Requirements
**What to Build**:
- [ ] Filter conversations by player_char_req
- [ ] Support three formats:
  - `"any"`: Available to all players
  - `"stella"`: Only when playing as Stella
  - `["stella", "vawn"]`: Available when playing as Stella OR Vawn
- [ ] Only show conversations where active Guardian meets requirement

**Acceptance Criteria**:
- "any" conversations shown to all players
- Single-character requirements filter correctly
- Array-based requirements work (OR logic)
- Swapping Guardians changes available conversations

---

### 4.8 Missions Together Tracking
**What to Build**:
- [ ] After mission completion, increment missions_together for all Guardian pairs
- [ ] Current team: Hardcoded as all 4 Guardians (Stella, Vawn, Tiberius, Maestra)
- [ ] Increment 6 pair counters (4 choose 2):
  - stella_vawn
  - stella_tiberius
  - stella_maestra
  - vawn_tiberius
  - vawn_maestra
  - tiberius_maestra

**Acceptance Criteria**:
- Completing mission increments all 6 pairs
- missions_together persists across sessions
- Relationship tracking accurate

---

### 4.9 Content Expansion
**What to Add**:
- [ ] Expand conversations.json to 15-20 conversations
- [ ] Distribute across all Guardian pairs
- [ ] Mix of Important (10) and Background (5-10)
- [ ] Varied prerequisites (1-15 missions_together)
- [ ] Some conversations require previous conversations

**Story Beats to Hit**:
1. **First Mission Together** (3 missions) - Break the ice
2. **Getting to Know You** (6 missions) - Learn backstory
3. **Trust Building** (10 missions) - Share vulnerabilities
4. **Deep Connection** (15 missions) - Major story reveals

**Acceptance Criteria**:
- 15-20 total conversations
- All Guardian pairs have conversations
- Story progression feels natural
- Conversations unlock gradually

---

### 4.10 Conversation UI Polish
**What to Add**:
- [ ] Typewriter effect for text (optional, placeholder for now)
- [ ] Portrait animations (fade in/out on speaker change)
- [ ] Sound hooks (conversation start, line advance, conversation end)
- [ ] Conversation history (mark completed conversations)
- [ ] "Already Played" indicator on conversation list

**Acceptance Criteria**:
- Visual polish makes system feel alive
- Completed conversations marked
- Sound hooks in place (silent for now)

---

## Implementation Order

### Step 1: Data Foundation (30 mins)
1. Create conversations.json with 10 conversations
2. Add relationships to game state structure
3. Test JSON validation

### Step 2: Observation Deck (45 mins)
1. Implement Guardian NPC filtering
2. Display clickable Guardian cards
3. Test Guardian selection

### Step 3: Conversation List (30 mins)
1. Build conversation list sidebar
2. Filter by prerequisites
3. Display Important + Background conversations
4. Test conversation selection

### Step 4: Dialogue System (60 mins)
1. Build JRPG dialogue UI
2. Implement line-by-line display
3. Add portrait highlighting
4. Test full conversation flow

### Step 5: Relationship Tracking (30 mins)
1. Implement missions_together incrementing
2. Add conversation completion tracking
3. Test relationship persistence

### Step 6: Content Expansion (45 mins)
1. Add 5-10 more conversations
2. Write story beats
3. Test unlock progression

**Total Estimated Time**: 3-4 hours

---

## Testing Plan

### Unit Tests
- [ ] Relationship key generation (alphabetical)
- [ ] missions_together incrementing (all pairs)
- [ ] Conversation prerequisite checking
- [ ] player_char_req filtering

### Integration Tests
- [ ] Complete 6 missions → Conversation unlocks
- [ ] Play conversation → Marked as completed
- [ ] Swap Guardian → Different conversations available
- [ ] Complete all conversations with one Guardian

### Playtest Flow
1. Start as Stella
2. Complete 3 missions
3. Visit Observation Deck → Vawn appears
4. Click Vawn → See "Breaking the Ice" conversation
5. Play conversation → Dialogue advances smoothly
6. Return to Observation Deck → Conversation marked complete
7. Complete 6 more missions
8. Visit Observation Deck → New conversations unlocked
9. Play multiple conversations
10. Swap to Vawn → Different conversations available

---

## Acceptance Criteria (Overall)

### Phase 4 Complete When:
- [ ] Observation Deck displays 2-3 Guardians
- [ ] Conversations.json has 15-20 conversations
- [ ] Conversation list filters correctly
- [ ] JRPG dialogue UI works smoothly
- [ ] Relationship tracking accurate
- [ ] Prerequisites unlock conversations at right times
- [ ] player_char_req filtering works
- [ ] missions_together increments correctly
- [ ] Conversations persist as completed
- [ ] Story beats feel meaningful

---

## Success Metrics

**Engagement**:
- Players naturally want to unlock all conversations
- Story beats feel rewarding
- Relationships develop organically

**Technical**:
- No bugs in relationship tracking
- Conversations unlock reliably
- UI smooth and polished

**Content**:
- 15-20 conversations provide 1-2 hours of dialogue
- All Guardian pairs have meaningful interactions
- Story progression feels natural

---

## Future Enhancements (Post-Phase 4)

- [ ] Typewriter effect for text
- [ ] Portrait animations
- [ ] Conversation choices (branching dialogue)
- [ ] Relationship levels (Friend, Close Friend, Trusted)
- [ ] Special conversations at high relationship levels
- [ ] Voice acting hooks
- [ ] Character expressions (happy, sad, angry portraits)

---

## Notes

**Current Hardcoded Team**:
For MVP, all 4 Guardians are always on the team. This means:
- Every mission increments all 6 pair counters
- All relationships progress at same rate
- Future: Team selection could make this more interesting

**Conversation Replayability**:
- Important conversations: Play once, then marked complete
- Background conversations: Can replay anytime (optional future feature)

**Data-Driven**:
All conversations editable in conversations.json. Writers can add content without touching code.

---

**END OF PHASE 4 PLAN**
