# Ship Life - Audio Asset Specifications

## 📋 Overview

This document provides detailed specifications for all audio assets needed for Ship Life, including technical requirements, mood descriptions, and reference tracks to guide audio production.

---

## 🎼 BACKGROUND MUSIC TRACKS (9 Total)

### Technical Requirements
- **Format:** MP3 (best browser compatibility)
- **Sample Rate:** 44.1kHz
- **Bit Rate:** 128-192 kbps
- **Length:** 2-5 minutes (tracks loop automatically)
- **Max File Size:** 5MB per track (recommended)
- **Volume:** Mastered to -14 LUFS (suitable for looping background)

---

### 1. Landing Page (`landing.mp3`)
**Mood:** Mysterious, atmospheric, sci-fi ambient  
**Duration:** 2-3 minutes  
**Description:** The first thing players hear. Sets the tone for a space adventure - mysterious but not scary, atmospheric with a sense of wonder and possibility.

**Musical Elements:**
- Slow, evolving synth pads
- Subtle space/sci-fi sound design
- Minimal melody, focus on atmosphere
- Low-frequency rumble or drone

**Reference Tracks:**
- Mass Effect - "Vigil"
- No Man's Sky - Ambient exploration themes
- The Expanse OST - Quieter moments

---

### 2. Character Select (`character_select.mp3`)
**Mood:** Heroic, empowering, character-focused  
**Duration:** 2-3 minutes  
**Description:** Players are choosing their Guardian - this should feel empowering and heroic. A bit more melodic than the landing page.

**Musical Elements:**
- Moderate tempo (90-110 BPM)
- Heroic brass or synth lead
- Rhythmic elements suggesting purpose
- Uplifting chord progressions

**Reference Tracks:**
- Destiny 2 - Character selection themes
- Overwatch - Hero selection music
- Star Wars - "The Force Theme" (tone, not style)

---

### 3. Mission Computer (`mission_computer.mp3`)
**Mood:** Tactical, strategic, focused energy  
**Duration:** 3-4 minutes  
**Description:** Command center vibes - tactical planning, strategic thinking. Should keep energy up without being frantic.

**Musical Elements:**
- Medium tempo (100-120 BPM)
- Driving rhythm section
- Digital/electronic sounds
- Strategic, thinking energy
- Could include morse code or data transmission sounds

**Reference Tracks:**
- XCOM 2 - Command Center theme
- FTL: Faster Than Light - Various combat prep tracks
- Cyberpunk 2077 - Strategic planning music

---

### 4. Workstations (`workstations.mp3`)
**Mood:** Industrial, mechanical, productive  
**Duration:** 3-5 minutes  
**Description:** Crafting and building - industrial ambience with mechanical rhythm. Should feel productive without being repetitive or annoying.

**Musical Elements:**
- Rhythmic mechanical sounds
- Industrial percussion
- Synth bass lines
- Ambient factory/workshop atmosphere
- Low to medium intensity

**Reference Tracks:**
- Factorio - Various factory themes
- Satisfactory OST - Building themes
- Portal 2 - Test chamber music (industrial elements)

---

### 5. Planetfall Portal (`planetfall.mp3`)
**Mood:** Pre-mission tension, excitement, preparation  
**Duration:** 2-3 minutes  
**Description:** You're about to drop into danger - building tension and excitement without being too intense. Mix of anticipation and confidence.

**Musical Elements:**
- Building intensity
- Pulsing rhythms
- Rising synth patterns
- Military/tactical undertones
- Confident but tense

**Reference Tracks:**
- Halo - "Covenant Dance" (prep sections)
- Mass Effect - Pre-mission sequences
- The Mandalorian - Action prep scenes

---

### 6. Character Room (`character_room.mp3`)
**Mood:** Character-focused, heroic (similar to Character Select)  
**Duration:** 2-3 minutes  
**Description:** Can be similar to Character Select but perhaps with a variation or different arrangement. Guardian management focus.

**Musical Elements:**
- Similar to Character Select
- Perhaps more introspective
- Character development theme
- Medium energy

**Reference Tracks:**
- Same as Character Select, but perhaps B-side versions

---

### 7. Inventory (`inventory.mp3`)
**Mood:** Calm, organizational, neutral  
**Duration:** 3-4 minutes  
**Description:** Low-stress inventory management - calm and unobtrusive. Should fade into the background while players organize items.

**Musical Elements:**
- Minimal, ambient
- Soft melodic elements
- No harsh sounds
- Calming but not sleepy
- Very loop-friendly

**Reference Tracks:**
- Stardew Valley - Inventory menu music
- The Witness - Ambient puzzle areas
- Journey - Quieter exploration segments

---

### 8. Observation Deck (`observation_deck.mp3`)
**Mood:** Relaxed, conversational, character bonding  
**Duration:** 3-4 minutes  
**Description:** Social space for character interactions - warm, inviting, conversational. Should support dialogue without overpowering it.

**Musical Elements:**
- Gentle, warm tones
- Conversational pacing
- Humanizing elements (not too cold/sci-fi)
- Space for dialogue
- Medium-low volume mix

**Reference Tracks:**
- Mass Effect - Normandy ambient themes
- Firefly OST - Character moments
- Cowboy Bebop - "Space Lion" (mood)

---

### 9. Quarters (`quarters.mp3`)
**Mood:** Peaceful, reflective, statistics review  
**Duration:** 3-4 minutes  
**Description:** Personal space - reviewing achievements and progress. Should feel rewarding and reflective, end-of-day vibes.

**Musical Elements:**
- Slow tempo
- Peaceful, contemplative
- Achievement/reward undertones
- Personal, intimate feel
- Could have piano or softer synths

**Reference Tracks:**
- Celeste - "Reflection" (B-Side)
- To The Moon OST
- Undertale - "Home"

---

## 🔊 SOUND EFFECTS (46 Total)

### Technical Requirements
- **Format:** MP3
- **Sample Rate:** 44.1kHz
- **Bit Rate:** 128-192 kbps
- **Max File Size:** 500KB per effect (most should be much smaller)
- **Volume:** Peak at -3dB, average -12 to -18dB

---

## CATEGORY 1: MISSION SYSTEM (7 SFX)

### mission_card_click.mp3
**Duration:** 0.2-0.4s  
**Description:** Selecting a mission card from the Mission Computer  
**Style:** Digital UI click with slight sci-fi element  
**Reference:** Destiny mission selection, tactical menu clicks

### mission_launch.mp3
**Duration:** 1.5-3s  
**Description:** Starting the mission - launching into action  
**Style:** Dramatic launch sequence, building energy  
**Reference:** FTL jump sound, Halo drop pod, Mass Effect mission start

### mission_progress.mp3 (Optional)
**Duration:** 0.1-0.2s  
**Description:** Blips during mission simulation progress bar  
**Style:** Subtle data processing beeps  
**Reference:** Radar pings, progress indicators

### mission_success.mp3
**Duration:** 2-4s  
**Description:** Mission completed successfully  
**Style:** Victory fanfare, triumphant  
**Reference:** XCOM mission success, achievement unlocks

### mission_fail.mp3
**Duration:** 1.5-3s  
**Description:** Mission failed  
**Style:** Defeat sound, negative but not too harsh  
**Reference:** Dark Souls death (tone down), game over sounds

### mission_reward.mp3
**Duration:** 0.5-1s  
**Description:** Item acquired from mission rewards  
**Style:** Loot drop, item received  
**Reference:** Diablo item drop, Zelda item get

### mission_unlock.mp3
**Duration:** 1-2s  
**Description:** New mission unlocked notification  
**Style:** Positive unlock chime  
**Reference:** Notification pings, achievement unlocks

---

## CATEGORY 2: NAVIGATION & UI (5 SFX)

### nav_click.mp3
**Duration:** 0.1-0.2s  
**Description:** Clicking navigation buttons to switch rooms  
**Style:** Clean, satisfying UI click  
**Reference:** iOS system sounds, Material Design clicks

### button_click.mp3
**Duration:** 0.1-0.2s  
**Description:** Generic button clicks throughout the game  
**Style:** Soft, unobtrusive click  
**Reference:** Standard UI clicks, web interface sounds

### button_hover.mp3 (Optional)
**Duration:** 0.05-0.1s  
**Description:** Hovering over interactive elements  
**Style:** Very subtle, gentle tone  
**Reference:** Minimal UI feedback sounds

### sidebar_open.mp3
**Duration:** 0.3-0.5s  
**Description:** Opening workstation sidebar or similar panels  
**Style:** Sliding mechanical sound, panel movement  
**Reference:** Sliding drawer, mechanical interface

### modal_open.mp3
**Duration:** 0.3-0.5s  
**Description:** Opening modal dialogs (loadout, conversations)  
**Style:** Window opening, interface popup  
**Reference:** Dialog box appears, system window

---

## CATEGORY 3: GUARDIAN SYSTEM (6 SFX)

### guardian_select.mp3
**Duration:** 0.8-1.5s  
**Description:** Choosing your Guardian at character select  
**Style:** Character confirmation, heroic tone  
**Reference:** Fighting game character select, hero confirmation

### guardian_switch.mp3
**Duration:** 0.5-1s  
**Description:** Switching active Guardian during gameplay  
**Style:** Character change, quick transition  
**Reference:** Team switching sounds, character swap

### squad_toggle.mp3
**Duration:** 0.2-0.4s  
**Description:** Adding/removing Guardians from squad  
**Style:** Selection toggle, checkbox-like  
**Reference:** Team selection clicks, roster management

### loadout_open.mp3
**Duration:** 0.4-0.6s  
**Description:** Opening the loadout management modal  
**Style:** Equipment interface opening  
**Reference:** Inventory menu opens, equipment screen

### equip_item.mp3
**Duration:** 0.4-0.7s  
**Description:** Equipping equipment or aspects to Guardian  
**Style:** Satisfying equip sound, gear locking in  
**Reference:** RPG equipment sounds, weapon equip

### unequip_item.mp3
**Duration:** 0.2-0.4s  
**Description:** Removing equipped items  
**Style:** Quick removal, releasing equipment  
**Reference:** Item removal, gear detach

---

## CATEGORY 4: CRAFTING & WORKSTATIONS (8 SFX)

### workstation_open.mp3
**Duration:** 0.5-1s  
**Description:** Opening a workstation interface  
**Style:** Mechanical activation, station powering up  
**Reference:** Terminal activation, crafting bench opening

### recipe_select.mp3
**Duration:** 0.2-0.4s  
**Description:** Selecting a recipe to view/craft  
**Style:** Recipe card select, information display  
**Reference:** Menu selection, recipe browsing

### craft_success.mp3
**Duration:** 1-2s  
**Description:** Successfully crafting an item  
**Style:** Satisfying creation sound, item constructed  
**Reference:** Minecraft crafting, Fortnite building completion

### craft_fail.mp3
**Duration:** 0.5-1s  
**Description:** Can't craft (insufficient resources)  
**Style:** Negative feedback, error tone  
**Reference:** Error sounds, insufficient funds

### blueprint_upload.mp3
**Duration:** 0.8-1.5s  
**Description:** Uploading blueprint to Knowledge Base  
**Style:** Data transfer, information uploading  
**Reference:** File upload complete, data processing

### workstation_upgrade.mp3
**Duration:** 1.5-2.5s  
**Description:** Upgrading a workstation level  
**Style:** Level up sound, facility improvement  
**Reference:** Building upgrade, facility enhancement

### resource_pickup.mp3 (Optional)
**Duration:** 0.3-0.5s  
**Description:** Gaining resources/items  
**Style:** Collection sound, item acquired  
**Reference:** Coin collect, resource gather

### inventory_sort.mp3 (Optional)
**Duration:** 0.4-0.6s  
**Description:** Organizing inventory  
**Style:** Items shuffling, organization  
**Reference:** Sorting sounds, inventory management

---

## CATEGORY 5: CONVERSATION SYSTEM (4 SFX)

### conversation_start.mp3
**Duration:** 0.6-1s  
**Description:** Starting a conversation with a Guardian  
**Style:** Dialogue beginning, communication opening  
**Reference:** Text box appear, dialogue start

### dialogue_advance.mp3
**Duration:** 0.1-0.2s  
**Description:** Clicking to advance to next dialogue line  
**Style:** Text progression, page turn  
**Reference:** Visual novel text advance, dialogue click

### conversation_complete.mp3
**Duration:** 1-1.5s  
**Description:** Finishing a conversation  
**Style:** Dialogue end, relationship +1  
**Reference:** Quest complete (minor), conversation end

### important_conversation.mp3
**Duration:** 1.5-2s  
**Description:** Starting an important story conversation  
**Style:** Dramatic reveal, story moment  
**Reference:** Cutscene start, major dialogue

---

## CATEGORY 6: TROPHIES & ACHIEVEMENTS (3 SFX)

### trophy_unlock.mp3
**Duration:** 2-3s  
**Description:** Achievement/trophy unlocked  
**Style:** Celebratory, rewarding  
**Reference:** Xbox achievement, PlayStation trophy

### trophy_progress.mp3 (Optional)
**Duration:** 0.5-1s  
**Description:** Making progress toward trophy  
**Style:** Positive feedback, milestone reached  
**Reference:** Progress notification, partial achievement

### stats_update.mp3 (Optional)
**Duration:** 0.3-0.5s  
**Description:** Statistics updating in Quarters  
**Style:** Numbers counting up, data updating  
**Reference:** Score tallying, stat increase

---

## CATEGORY 7: NOTIFICATIONS & FEEDBACK (5 SFX)

### notification_success.mp3
**Duration:** 0.5-1s  
**Description:** Positive feedback notifications  
**Style:** Pleasant confirmation tone  
**Reference:** Success notifications, positive feedback

### notification_error.mp3
**Duration:** 0.4-0.8s  
**Description:** Error or invalid action warnings  
**Style:** Gentle error tone (not harsh)  
**Reference:** System error (gentle), warning beep

### notification_info.mp3
**Duration:** 0.4-0.7s  
**Description:** General information notifications  
**Style:** Neutral notification tone  
**Reference:** Info alerts, system messages

### warning_resources.mp3 (Optional)
**Duration:** 0.5-1s  
**Description:** Not enough resources warning  
**Style:** Resource insufficient indicator  
**Reference:** Low resource warning, insufficient funds

### unlock_generic.mp3
**Duration:** 1-1.5s  
**Description:** Generic unlock sound for new content  
**Style:** Positive unlock, new content available  
**Reference:** Feature unlock, content available

---

## CATEGORY 8: LOADOUT & INVENTORY (4 SFX)

### slot_select.mp3
**Duration:** 0.2-0.3s  
**Description:** Selecting a loadout slot  
**Style:** Equipment slot selection  
**Reference:** Inventory slot click, equipment selection

### item_browse.mp3 (Optional)
**Duration:** 0.1-0.15s  
**Description:** Scrolling through items in picker  
**Style:** Subtle item browsing  
**Reference:** List scrolling, item hover

### already_equipped.mp3
**Duration:** 0.5-0.8s  
**Description:** Trying to equip already-equipped item  
**Style:** Error feedback, item in use  
**Reference:** Item already equipped warning

### inventory_tab.mp3
**Duration:** 0.2-0.4s  
**Description:** Switching inventory category tabs  
**Style:** Tab switching, category change  
**Reference:** Tab click, section navigation

---

## 📊 PRODUCTION PRIORITIES

### Tier 1 (Essential - Deliver First)
**Must-Have for Launch:** 20 assets total
- All 9 background music tracks
- Core SFX: mission_launch, mission_success, mission_fail
- UI: button_click, nav_click
- Crafting: craft_success, craft_fail
- Guardian: guardian_select, equip_item
- Notifications: notification_success, notification_error

### Tier 2 (Enhancement - Second Wave)
**Polish Pass:** 15 assets
- Mission: mission_card_click, mission_reward, mission_unlock
- Guardian: guardian_switch, squad_toggle, unequip_item
- Workstation: workstation_open, recipe_select, workstation_upgrade, blueprint_upload
- Conversation: conversation_start, dialogue_advance, conversation_complete
- Loadout: loadout_open, slot_select

### Tier 3 (Optional Polish)
**Nice to Have:** 11 assets
- All optional/hover effects
- Progress indicators
- Warning sounds
- Ambient feedback

---

## 🎯 QUALITY STANDARDS

### Consistency
- All sounds should feel part of the same sonic universe
- Consistent processing (reverb, EQ) across similar categories
- Volume levels balanced for seamless playback

### Technical
- No clipping or distortion
- Clean cuts (no pops/clicks at start/end)
- Properly normalized
- Metadata included (title, artist, album)

### Loop Points (Music)
- Seamless loops (no audible jump)
- Natural musical phrase endings
- Could include intro/outro versions if desired

### Accessibility
- No high-pitched tones that could cause discomfort
- Clear distinction between success/fail sounds
- Volume considerate of extended play sessions

---

## 📝 NOTES FOR AUDIO DESIGNER

1. **Sci-Fi But Warm:** The game has a sci-fi setting but focuses on characters and relationships. Audio should be futuristic but not cold or clinical.

2. **Loop Friendly:** Music will loop indefinitely. Ensure smooth, non-jarring loops.

3. **Spatial Consideration:** Players may spend 5-30 minutes in any given room. Music should not become annoying.

4. **UI Hierarchy:** Core actions (missions, crafting) should have more prominent sounds than generic buttons.

5. **Notification Clarity:** Success/error/info notifications should be immediately distinguishable.

6. **Volume Staging:** All audio will be played through a volume control system with separate music and SFX sliders.

7. **Browser Playback:** Audio plays in web browsers via HTML5 Audio API. Ensure compatibility.

---

## 🔗 RELATED DOCUMENTS

- `AUDIO_ASSET_LIST.csv` - Spreadsheet format for tracking
- `AUDIO_NAMING_CONVENTIONS.md` - File naming standards
- `AUDIO_CODE_MAPPING.md` - Where each sound is triggered in code
- `AUDIO_IMPLEMENTATION_GUIDE.md` - Technical implementation reference

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Contact:** GameDesignerJoe
