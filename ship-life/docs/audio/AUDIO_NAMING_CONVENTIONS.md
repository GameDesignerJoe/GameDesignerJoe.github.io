# Ship Life - Audio Naming Conventions

## 📋 Overview

This document defines the naming standards for all audio assets in Ship Life. Consistent naming ensures easy organization, prevents conflicts, and simplifies implementation.

---

## 🎯 General Rules

### File Naming Format
```
[category]_[descriptor]_[variant].mp3
```

**Rules:**
- All lowercase
- Use underscores (_) to separate words, not hyphens or spaces
- No special characters except underscores
- Descriptive but concise (2-3 words max)
- Include variant number if multiple versions exist

**Examples:**
- ✅ `mission_success.mp3`
- ✅ `craft_success_v2.mp3`
- ✅ `button_click.mp3`
- ❌ `Mission-Success.mp3` (uppercase, hyphens)
- ❌ `craft success.mp3` (spaces)
- ❌ `sfx_001.mp3` (not descriptive)

---

## 🎼 BACKGROUND MUSIC NAMING

### Format
```
[room_name].mp3
```

### Rules
- Match the room ID from `data/rooms.json`
- Single word if possible, multi-word separated by underscores
- No prefixes or suffixes unless variants

### Examples

| Room | Filename |
|------|----------|
| Landing Page | `landing.mp3` |
| Character Select | `character_select.mp3` |
| Mission Computer | `mission_computer.mp3` |
| Workstations | `workstations.mp3` |
| Planetfall Portal | `planetfall.mp3` |
| Character Room | `character_room.mp3` |
| Inventory | `inventory.mp3` |
| Observation Deck | `observation_deck.mp3` |
| Quarters | `quarters.mp3` |

### Variants (If Needed)
If you need multiple versions for testing or variety:
- `landing_v1.mp3`, `landing_v2.mp3`
- `mission_computer_alt.mp3`
- `quarters_calm.mp3`, `quarters_energetic.mp3`

---

## 🔊 SOUND EFFECTS NAMING

### Format
```
[category]_[action]_[variant].mp3
```

### Categories
Use these standard category prefixes:

| Category | Prefix | Example |
|----------|--------|---------|
| Mission System | `mission_` | `mission_launch.mp3` |
| Navigation & UI | `nav_` or none | `nav_click.mp3`, `button_click.mp3` |
| Guardian System | `guardian_` | `guardian_select.mp3` |
| Crafting | `craft_` | `craft_success.mp3` |
| Workstation | `workstation_` | `workstation_open.mp3` |
| Conversation | `conversation_` | `conversation_start.mp3` |
| Trophy | `trophy_` | `trophy_unlock.mp3` |
| Notification | `notification_` | `notification_success.mp3` |
| Loadout | `loadout_` | `loadout_open.mp3` |
| Inventory | `inventory_` | `inventory_tab.mp3` |

---

## 📂 DIRECTORY STRUCTURE

```
ship-life/
└── audio/
    ├── music/
    │   ├── landing.mp3
    │   ├── character_select.mp3
    │   ├── mission_computer.mp3
    │   ├── workstations.mp3
    │   ├── planetfall.mp3
    │   ├── character_room.mp3
    │   ├── inventory.mp3
    │   ├── observation_deck.mp3
    │   └── quarters.mp3
    │
    └── sfx/
        ├── mission_card_click.mp3
        ├── mission_launch.mp3
        ├── mission_success.mp3
        ├── mission_fail.mp3
        ├── button_click.mp3
        ├── nav_click.mp3
        ├── craft_success.mp3
        ├── craft_fail.mp3
        ├── guardian_select.mp3
        ├── equip_item.mp3
        ├── notification_success.mp3
        ├── notification_error.mp3
        └── [etc...]
```

---

## 🎵 DETAILED NAMING BY CATEGORY

### MISSION SYSTEM
```
mission_card_click.mp3       - Selecting a mission card
mission_launch.mp3           - Starting the mission
mission_progress.mp3         - Progress bar blips (optional)
mission_success.mp3          - Mission completed
mission_fail.mp3             - Mission failed
mission_reward.mp3           - Item acquired
mission_unlock.mp3           - New mission unlocked
```

### NAVIGATION & UI
```
nav_click.mp3               - Room navigation buttons
button_click.mp3            - Generic button clicks
button_hover.mp3            - Button hover (optional)
sidebar_open.mp3            - Opening sidebars
modal_open.mp3              - Opening modals/dialogs
```

### GUARDIAN SYSTEM
```
guardian_select.mp3         - Selecting Guardian
guardian_switch.mp3         - Switching active Guardian
squad_toggle.mp3            - Toggle squad member
loadout_open.mp3            - Open loadout modal
equip_item.mp3              - Equip equipment/aspect
unequip_item.mp3            - Remove equipment
```

### CRAFTING & WORKSTATIONS
```
workstation_open.mp3        - Open workstation
recipe_select.mp3           - Select recipe
craft_success.mp3           - Successful craft
craft_fail.mp3              - Craft failed (no resources)
blueprint_upload.mp3        - Upload to Knowledge Base
workstation_upgrade.mp3     - Level up workstation
resource_pickup.mp3         - Gain resources (optional)
inventory_sort.mp3          - Sort inventory (optional)
```

### CONVERSATION SYSTEM
```
conversation_start.mp3      - Begin conversation
dialogue_advance.mp3        - Next dialogue line
conversation_complete.mp3   - Finish conversation
important_conversation.mp3  - Story conversation (optional)
```

### TROPHIES & ACHIEVEMENTS
```
trophy_unlock.mp3           - Achievement unlocked
trophy_progress.mp3         - Progress made (optional)
stats_update.mp3            - Stats updating (optional)
```

### NOTIFICATIONS & FEEDBACK
```
notification_success.mp3    - Positive feedback
notification_error.mp3      - Error/warning
notification_info.mp3       - Information message
warning_resources.mp3       - Low resources (optional)
unlock_generic.mp3          - Generic unlock
```

### LOADOUT & INVENTORY
```
slot_select.mp3             - Select loadout slot
item_browse.mp3             - Browse items (optional)
already_equipped.mp3        - Item already equipped
inventory_tab.mp3           - Switch inventory tabs
```

---

## 🔄 VARIANT NAMING

If you need multiple versions of the same sound:

### Method 1: Version Numbers
```
craft_success_v1.mp3
craft_success_v2.mp3
craft_success_v3.mp3
```

### Method 2: Descriptive Suffixes
```
button_click_soft.mp3
button_click_hard.mp3
button_click_digital.mp3
```

### Method 3: Intensity/Context
```
mission_success_minor.mp3
mission_success_major.mp3
mission_success_epic.mp3
```

---

## ⚠️ SPECIAL CASES

### Layered Sounds
If you provide separate layers for dynamic mixing:
```
mission_launch_base.mp3
mission_launch_layer1.mp3
mission_launch_layer2.mp3
```

### Looping Variants
If providing intro/loop/outro sections:
```
mission_computer_intro.mp3
mission_computer_loop.mp3
mission_computer_outro.mp3
```

### Temporary/Work-in-Progress
Use `_temp` or `_wip` suffix:
```
mission_success_temp.mp3
craft_success_wip.mp3
```

---

## 📝 METADATA STANDARDS

### ID3 Tags (MP3)
Each audio file should include proper metadata:

**For Music:**
- **Title:** Full descriptive name (e.g., "Mission Computer Theme")
- **Artist:** Composer/studio name
- **Album:** "Ship Life OST"
- **Track Number:** Room/category order
- **Genre:** "Video Game Music" or "Sci-Fi"
- **Year:** Production year
- **Comments:** Additional notes, version info

**For SFX:**
- **Title:** Full descriptive name (e.g., "Mission Launch Sound")
- **Artist:** Sound designer name
- **Album:** "Ship Life SFX"
- **Track Number:** Category order
- **Genre:** "Sound Effects"
- **Year:** Production year
- **Comments:** Usage notes, variant info

---

## ✅ VALIDATION CHECKLIST

Before delivering audio files, verify:

- [ ] Filename matches the convention exactly
- [ ] All lowercase letters
- [ ] Underscores only (no spaces, hyphens, special chars)
- [ ] Descriptive and clear purpose
- [ ] Placed in correct folder (music/ or sfx/)
- [ ] Metadata tags filled out
- [ ] File format is MP3
- [ ] No duplicate filenames
- [ ] Version number if variant

---

## 🔗 QUICK REFERENCE

### Common Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| `[room].mp3` | `landing.mp3` | Background music |
| `[system]_[action].mp3` | `mission_launch.mp3` | System-specific SFX |
| `[action].mp3` | `button_click.mp3` | Generic actions |
| `notification_[type].mp3` | `notification_success.mp3` | Feedback sounds |
| `[item]_[action].mp3` | `equip_item.mp3` | Item interactions |

### Don't Use

- ❌ Spaces: `mission success.mp3`
- ❌ Hyphens: `mission-success.mp3`
- ❌ Uppercase: `Mission_Success.mp3`
- ❌ Numbers only: `sfx_001.mp3`
- ❌ Special chars: `mission_success!.mp3`
- ❌ Long names: `mission_successfully_completed_fanfare_final.mp3`

---

## 📚 RELATED DOCUMENTS

- `AUDIO_ASSET_SPECIFICATIONS.md` - Detailed asset specs
- `AUDIO_ASSET_LIST.csv` - Complete asset tracking
- `AUDIO_CODE_MAPPING.md` - Implementation reference
- `AUDIO_IMPLEMENTATION_GUIDE.md` - Technical guide

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Contact:** GameDesignerJoe
