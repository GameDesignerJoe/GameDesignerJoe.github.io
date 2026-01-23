# Mission Difficulty System - Design Document

**Version:** 1.0  
**Last Updated:** January 2026  
**Purpose:** Complete specification for the stat-based mission difficulty and success calculation system

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Mathematics](#core-mathematics)
3. [Guardian Stats System](#guardian-stats-system)
4. [Mission Stat Requirements](#mission-stat-requirements)
5. [Gear & Equipment System](#gear--equipment-system)
6. [Difficulty Scaling](#difficulty-scaling)
7. [Success Calculation Examples](#success-calculation-examples)
8. [Design Guidelines](#design-guidelines)
9. [JSON Structure Specifications](#json-structure-specifications)
10. [Integration with Existing Systems](#integration-with-existing-systems)
11. [Player-Facing Information](#player-facing-information)
12. [Implementation Notes](#implementation-notes)

---

## System Overview

### Philosophy

The mission difficulty system creates meaningful strategic choices by requiring players to:
- **Match Guardian stats to mission requirements** (not just "bring everyone")
- **Invest in appropriate gear** for different mission types
- **Balance risk vs reward** as difficulty increases
- **Specialize their roster** rather than creating identical Guardians

### Core Principles

1. **Low difficulty missions** can be completed by 1-2 well-matched Guardians
2. **High difficulty missions** require full teams with optimized gear
3. **Even perfect loadouts** have a 20% failure chance at maximum difficulty (creates tension)
4. **Guardian selection matters** - wrong Guardian can hurt more than help
5. **Gear progression** is essential - basic gear cannot complete hardest content

---

## Core Mathematics

### Success Rate Formula

```
Success % = (Guardian Contribution + Gear Contribution) ÷ Difficulty Multiplier
```

**Result is capped at 100%**

### Guardian Contribution

```
Guardian Base Points = 50 points (constant)
Guardian Contribution = Base Points × (Guardian's Relevant Stat ÷ 50)
```

For **multi-stat missions**, Guardian contribution is weighted:
```
Guardian Contribution = 50 × (
  (Stat₁ ÷ 50 × Weight₁) + 
  (Stat₂ ÷ 50 × Weight₂) + 
  (Stat₃ ÷ 50 × Weight₃)
)
```

### Gear Contribution

```
Gear Contribution = Number of Guardians × 4 slots × Gear Bonus per slot
```

Each Guardian can equip **4 pieces of gear**. Gear bonuses range from **0-20 points** per piece.

For **multi-stat missions**, gear bonuses are weighted the same as Guardian stats.

### Stat Weights by Priority

- **Primary (Gold):** 50% weight
- **Secondary (Silver):** 30% weight  
- **Tertiary (Bronze):** 20% weight

### Total Points Calculation

```
Total Points = (Sum of all Guardian Contributions) + (Sum of all Gear Contributions)
Final Success % = min(100, Total Points ÷ Difficulty Multiplier)
```

---

## Guardian Stats System

### The Five Stats

Every Guardian has five stats ranging from **10 to 50**:

1. **Health** - Durability, stamina, survivability
2. **Attack** - Offensive capability, damage output
3. **Defense** - Protective ability, damage mitigation
4. **Movement** - Speed, agility, mobility
5. **Mind** - Intelligence, tactics, problem-solving

### Guardian Stat Distributions

Guardians should be **specialists** with distinct profiles:

#### Stella - Balanced Defender
```
Health: 40 | Attack: 40 | Defense: 50 | Movement: 30 | Mind: 30
Total: 190
```
**Archetype:** Tank/Leader - High defense, balanced offense, moderate support stats

#### Vawn - Mobile Striker
```
Health: 30 | Attack: 50 | Defense: 20 | Movement: 50 | Mind: 30
Total: 180
```
**Archetype:** Glass Cannon - Maximum attack/movement, fragile defense

#### Tiberius - Tactical Tank
```
Health: 40 | Attack: 30 | Defense: 50 | Movement: 20 | Mind: 50
Total: 190
```
**Archetype:** Strategic Leader - High defense/mind, low mobility

#### Maestra - Versatile Specialist
```
Health: 30 | Attack: 50 | Defense: 30 | Movement: 40 | Mind: 50
Total: 200
```
**Archetype:** Elite All-Arounder - Strong in multiple areas, no major weakness

#### Nyx (Future Guardian)
```
Health: 40 | Attack: 50 | Defense: 30 | Movement: 40 | Mind: 20
Total: 180
```
**Archetype:** Assault Specialist - High combat stats, low tactical thinking

#### Shadow (Future Guardian)
```
Health: 30 | Attack: 50 | Defense: 30 | Movement: 50 | Mind: 40
Total: 200
```
**Archetype:** Infiltrator - Maximum mobility/precision, moderate survivability

### Design Guidelines for Guardian Stats

- **Total stat budget:** 180-200 points per Guardian
- **Minimum stat value:** 10 (untrained)
- **Maximum stat value:** 50 (peak capability)
- **Specialist pattern:** 1-2 stats at 40-50, others at 20-40
- **Avoid perfect balance:** Every Guardian should have at least one stat below 30

---

## Mission Stat Requirements

### Single-Stat Missions

Missions require **one primary stat**. This stat receives 100% weight.

**Example: Attack-focused combat mission**
```json
"required_stats": {
  "primary": "attack"
}
```

### Two-Stat Missions

Missions require a **primary (Gold)** and **secondary (Silver)** stat.

**Example: Tactical assault requiring Attack + Mind**
```json
"required_stats": {
  "primary": "attack",    // 50% weight
  "secondary": "mind"     // 30% weight
}
```

### Three-Stat Missions

Missions require **primary (Gold)**, **secondary (Silver)**, and **tertiary (Bronze)** stats.

**Example: Complex rescue requiring Attack + Movement + Mind**
```json
"required_stats": {
  "primary": "attack",      // 50% weight
  "secondary": "movement",  // 30% weight
  "tertiary": "mind"        // 20% weight
}
```

### Mission Design Guidelines by Difficulty

| Difficulty | Stat Requirements | Typical Pattern |
|-----------|------------------|----------------|
| 1-3 | 1 stat | Single specialty missions |
| 4-6 | 1-2 stats | Introduce complexity |
| 7-8 | 2 stats | Require team synergy |
| 9-10 | 2-3 stats | Maximum complexity |

### Stat Requirement Examples by Mission Type

**Combat Missions:**
- Difficulty 1-3: Attack only
- Difficulty 4-6: Attack (primary) + Defense (secondary)
- Difficulty 7-10: Attack (primary) + Defense (secondary) + Health (tertiary)

**Stealth/Infiltration Missions:**
- Difficulty 1-3: Movement only
- Difficulty 4-6: Movement (primary) + Mind (secondary)
- Difficulty 7-10: Movement (primary) + Mind (secondary) + Attack (tertiary)

**Diplomatic Missions:**
- Difficulty 1-3: Mind only
- Difficulty 4-6: Mind (primary) + Defense (secondary)
- Difficulty 7-10: Mind (primary) + Defense (secondary) + Health (tertiary)

**Rescue Missions:**
- Difficulty 1-3: Health only
- Difficulty 4-6: Health (primary) + Movement (secondary)
- Difficulty 7-10: Health (primary) + Movement (secondary) + Defense (tertiary)

**Reconnaissance Missions:**
- Difficulty 1-3: Movement only
- Difficulty 4-6: Movement (primary) + Mind (secondary)
- Difficulty 7-10: Movement (primary) + Mind (secondary) + Defense (tertiary)

---

## Gear & Equipment System

### Gear Slots

Each Guardian has **4 equipment slots**. Each slot can hold one piece of gear.

### Gear Stat Bonuses

Gear provides **point bonuses** to specific stats, ranging from **0 to 20 points**.

**Rarity Tiers:**
- **Common (Tier I):** 0-5 points
- **Uncommon (Tier II):** 5-10 points
- **Rare (Tier III):** 10-15 points
- **Epic (Tier IV):** 15-20 points
- **Legendary (Tier V):** 20+ points (future expansion)

### Single-Stat Gear

Basic gear boosts one stat only.

**Example: Basic Plasma Rifle**
```json
{
  "id": "plasma_rifle_basic",
  "name": "Plasma Rifle",
  "type": "equipment",
  "rarity": "common",
  "stat_bonuses": {
    "attack": 5
  }
}
```

### Multi-Stat Gear (Higher Rarity)

Rare gear can boost multiple stats.

**Example: Advanced Combat Armor**
```json
{
  "id": "combat_armor_advanced",
  "name": "Advanced Combat Armor",
  "type": "equipment",
  "rarity": "rare",
  "stat_bonuses": {
    "defense": 12,
    "health": 8
  }
}
```

### Negative Modifier Gear

High-power gear can have tradeoffs.

**Example: Berserker Implant**
```json
{
  "id": "berserker_implant",
  "name": "Berserker Implant",
  "type": "equipment",
  "rarity": "epic",
  "stat_bonuses": {
    "attack": 20,
    "defense": -10
  }
}
```

### Gear Design Guidelines

**Common (0-5 points):**
- Single stat only
- No negative modifiers
- Easy to craft/find

**Uncommon (5-10 points):**
- Single stat only
- No negative modifiers
- Moderate crafting requirements

**Rare (10-15 points):**
- Can boost 1-2 stats
- Small negatives allowed (-5 max)
- Significant crafting requirements

**Epic (15-20 points):**
- Can boost 2-3 stats
- Meaningful negatives allowed (-10 to -15)
- Rare materials required

**Legendary (20+ points):**
- Can boost 3+ stats
- Major negatives possible (-15+)
- Extremely rare/unique items

### Equipment Slot Categories

While any gear can go in any slot, consider these thematic categories:

1. **Weapon Slot** - Primarily boosts Attack
2. **Armor Slot** - Primarily boosts Defense/Health
3. **Tech Slot** - Primarily boosts Mind/Movement
4. **Accessory Slot** - Mixed bonuses or utility effects

---

## Difficulty Scaling

### Difficulty Multipliers (1-10 Scale)

These multipliers determine how many total points are needed to achieve 100% success.

| Difficulty | Multiplier | Description |
|-----------|-----------|-------------|
| 1 | 0.6 | Tutorial/Training |
| 2 | 1.1 | Easy |
| 3 | 1.5 | Standard |
| 4 | 1.7 | Moderate |
| 5 | 2.0 | Challenging |
| 6 | 3.0 | Hard |
| 7 | 4.0 | Very Hard |
| 8 | 5.5 | Extreme |
| 9 | 6.5 | Near Impossible |
| 10 | 8.0 | Maximum |

### Difficulty Target Design

**Difficulty 1:**
- **Solo possible:** 1 Guardian with 25 stat = 42% success with no gear
- **Easy completion:** 2 Guardians with basic gear = 100%

**Difficulty 5:**
- **Solo impossible:** Even max stat Guardian needs perfect gear
- **Comfortable completion:** 3-4 Guardians with moderate gear = 75-100%

**Difficulty 10:**
- **Full team required:** 4 Guardians needed even with perfect gear
- **Never guaranteed:** 4 Guardians × max gear = 75% (25% fail chance)

### Calculated Success Rates (Reference)

**Difficulty 1 (÷ 0.6):**
- 1 Guardian (stat 25) + 0 gear = 42%
- 2 Guardians (stat 25) + 0 gear = 83%
- 1 Guardian (stat 25) + 4 gear (5 each) = 75%

**Difficulty 5 (÷ 2.0):**
- 1 Guardian (stat 50) + 4 gear (20 each) = 85%
- 2 Guardians (stat 25) + 8 gear (10 each) = 90%
- 4 Guardians (stat 25) + 16 gear (10 each) = 100%

**Difficulty 10 (÷ 8.0):**
- 4 Guardians (stat 25) + 16 gear (5 each) = 40%
- 4 Guardians (stat 50) + 16 gear (10 each) = 75%
- 4 Guardians (stat 50) + 16 gear (20 each) = 75%

**Key Insight:** At Difficulty 10, even perfect teams have significant risk. This is intentional.

---

## Success Calculation Examples

### Example 1: Simple Combat Mission (Difficulty 3)

**Mission Requirements:**
- Primary: Attack (100% weight)
- Difficulty Multiplier: 1.0

**Team Composition:**
- Vawn (Attack: 50)
- No gear

**Calculation:**
```
Guardian Contribution: 50 × (50 ÷ 50) = 50 points
Gear Contribution: 1 × 4 × 0 = 0 points
Total Points: 50 points

Success % = 50 ÷ 1.0 = 50%
```

**Result: 50% success rate**

---

### Example 2: Tactical Combat Mission (Difficulty 5)

**Mission Requirements:**
- Primary: Attack (50% weight)
- Secondary: Mind (30% weight)
- Difficulty Multiplier: 2.0

**Team Composition:**
- Stella (Attack: 40, Mind: 30) + 4 gear (Attack +10 each)
- Tiberius (Attack: 30, Mind: 50) + 4 gear (Mind +10 each)

**Calculation for Stella:**
```
Guardian Contribution: 50 × ((40÷50 × 0.5) + (30÷50 × 0.3))
                      = 50 × (0.40 + 0.18)
                      = 50 × 0.58
                      = 29 points

Gear Contribution: 4 slots × 10 points × 0.5 weight = 20 points
Stella Total: 29 + 20 = 49 points
```

**Calculation for Tiberius:**
```
Guardian Contribution: 50 × ((30÷50 × 0.5) + (50÷50 × 0.3))
                      = 50 × (0.30 + 0.30)
                      = 50 × 0.60
                      = 30 points

Gear Contribution: 4 slots × 10 points × 0.3 weight = 12 points
Tiberius Total: 30 + 12 = 42 points
```

**Total Points:** 49 + 42 = 91 points

**Success % = 91 ÷ 2.0 = 45.5%**

**Result: 45.5% success rate** - Need more Guardians or better gear!

---

### Example 3: Maximum Difficulty Rescue (Difficulty 10)

**Mission Requirements:**
- Primary: Health (50% weight)
- Secondary: Movement (30% weight)
- Tertiary: Defense (20% weight)
- Difficulty Multiplier: 7.5

**Team Composition (Full Squad):**
- Stella (Health: 40, Movement: 30, Defense: 50) + 4 gear (Defense +15 each)
- Vawn (Health: 30, Movement: 50, Defense: 20) + 4 gear (Movement +20 each)
- Tiberius (Health: 40, Movement: 20, Defense: 50) + 4 gear (Health +15 each)
- Maestra (Health: 30, Movement: 40, Defense: 30) + 4 gear (Movement +15 each)

**Calculation for Stella:**
```
Guardian: 50 × ((40÷50×0.5) + (30÷50×0.3) + (50÷50×0.2))
        = 50 × (0.40 + 0.18 + 0.20) = 50 × 0.78 = 39 points
Gear: (4×15×0.2) = 12 points
Stella Total: 51 points
```

**Calculation for Vawn:**
```
Guardian: 50 × ((30÷50×0.5) + (50÷50×0.3) + (20÷50×0.2))
        = 50 × (0.30 + 0.30 + 0.08) = 50 × 0.68 = 34 points
Gear: (4×20×0.3) = 24 points
Vawn Total: 58 points
```

**Calculation for Tiberius:**
```
Guardian: 50 × ((40÷50×0.5) + (20÷50×0.3) + (50÷50×0.2))
        = 50 × (0.40 + 0.12 + 0.20) = 50 × 0.72 = 36 points
Gear: (4×15×0.5) = 30 points
Tiberius Total: 66 points
```

**Calculation for Maestra:**
```
Guardian: 50 × ((30÷50×0.5) + (40÷50×0.3) + (30÷50×0.2))
        = 50 × (0.30 + 0.24 + 0.12) = 50 × 0.66 = 33 points
Gear: (4×15×0.3) = 18 points
Maestra Total: 51 points
```

**Total Points:** 51 + 58 + 66 + 51 = 226 points

**Success % = 226 ÷ 8.0 = 28.3%**

**Result: 28.3% success rate** - Even with full team and good gear, this mission is extremely risky!

To reach 75%: Would need 600 total points (8.0 × 75 = 600)

---

## Design Guidelines

### Creating Balanced Missions

**Step 1: Choose Difficulty Level**
- Determines multiplier (see table above)
- Consider player progression point

**Step 2: Select Required Stats**
- Difficulty 1-3: 1 stat only
- Difficulty 4-6: 1-2 stats
- Difficulty 7-10: 2-3 stats

**Step 3: Assign Stat Weights**
- Primary mission goal → Primary stat (50%)
- Secondary challenge → Secondary stat (30%)
- Tertiary requirement → Tertiary stat (20%)

**Step 4: Test the Math**
- Calculate expected success with "average" team (stats: 25-30, gear: 5-10)
- Adjust difficulty multiplier if needed
- Ensure impossible to 100% guarantee at Difficulty 8+

### Mission Variety Examples

**"Frontal Assault" (Combat-Heavy)**
- Primary: Attack
- Secondary: Health
- Rewards: Combat gear, weapons

**"Stealth Extraction" (Movement-Heavy)**
- Primary: Movement
- Secondary: Mind
- Rewards: Tech gear, infiltration tools

**"Diplomatic Crisis" (Mind-Heavy)**
- Primary: Mind
- Secondary: Defense
- Rewards: Resources, allies

**"Defensive Stand" (Defense-Heavy)**
- Primary: Defense
- Secondary: Health
- Rewards: Armor, defensive structures

**"Speed Run" (Movement-Heavy)**
- Primary: Movement
- Secondary: Attack
- Rewards: Mobility gear

### Progression Curve Recommendations

**Early Game (Missions 1-10):**
- Difficulty 1-2 missions
- Single-stat requirements
- Teach basic matching (bring Attack Guardian to Attack mission)

**Mid Game (Missions 11-25):**
- Difficulty 2-4 missions
- Introduce two-stat missions
- Require gear investment

**Late Game (Missions 26-50):**
- Difficulty 4-7 missions
- Two-stat missions standard
- Occasional three-stat missions
- Require rare/epic gear

**End Game (Missions 51+):**
- Difficulty 7-10 missions
- Two-to-three stat missions
- Require perfect team composition + epic gear
- Accept some failures as intended

---

## JSON Structure Specifications

### Guardians JSON - New Fields

Add a `stats` object to each Guardian:

```json
{
  "id": "stella",
  "name": "Stella",
  "portrait": {
    "type": "image",
    "value": "guardians/stella_200.png",
    "show_name": false
  },
  "role": "DPS",
  "description": "A fierce warrior with a strategic mind",
  "stats": {
    "health": 40,
    "attack": 40,
    "defense": 50,
    "movement": 30,
    "mind": 30
  },
  "starting_guardian": true,
  "unlocked_at_start": true
}
```

**New Fields:**
- `stats` (object): Contains the five Guardian stats
  - `health` (number): 10-50
  - `attack` (number): 10-50
  - `defense` (number): 10-50
  - `movement` (number): 10-50
  - `mind` (number): 10-50

### Missions JSON - New Fields

Add difficulty and stat requirements:

```json
{
  "id": "tactical_assault",
  "name": "Tactical Assault",
  "description": "Coordinate a precision strike on enemy position",
  "difficulty": 5,
  "difficulty_multiplier": 2.0,
  "required_stats": {
    "primary": "attack",
    "secondary": "mind"
  },
  "visual": {
    "type": "color",
    "value": "#e67e22",
    "show_name": true
  },
  "repeatable": true,
  "persist_on_fail": true,
  "prerequisites": {
    "missions_completed": ["first_contact"],
    "total_missions": 5,
    "flags": []
  },
  "rewards": {
    "success": [...],
    "failure": [...]
  }
}
```

**New Fields:**
- `difficulty` (number): 1-10 scale visible to player
- `difficulty_multiplier` (number): The actual multiplier used in calculation (see table)
- `required_stats` (object): Stats needed for this mission
  - `primary` (string): Main stat requirement - "health", "attack", "defense", "movement", or "mind"
  - `secondary` (string, optional): Secondary stat requirement
  - `tertiary` (string, optional): Tertiary stat requirement

### Items/Gear JSON - New Fields

Replace or supplement `mission_bonuses` with `stat_bonuses`:

```json
{
  "id": "advanced_combat_armor",
  "name": "Advanced Combat Armor",
  "description": "Military-grade protective gear",
  "icon": {
    "type": "color",
    "value": "#34495e",
    "show_name": true
  },
  "type": "equipment",
  "rarity": "rare",
  "stat_bonuses": {
    "defense": 12,
    "health": 8
  },
  "stack_count": 0
}
```

**New Fields:**
- `rarity` (string): "common", "uncommon", "rare", "epic", "legendary"
- `stat_bonuses` (object): Point bonuses to stats
  - `health` (number, optional): Bonus to Health stat
  - `attack` (number, optional): Bonus to Attack stat
  - `defense` (number, optional): Bonus to Defense stat
  - `movement` (number, optional): Bonus to Movement stat
  - `mind` (number, optional): Bonus to Mind stat
  
**Note:** Negative values are allowed (e.g., `"defense": -10`)

### Example: Complete Mission with Three-Stat Requirement

```json
{
  "id": "impossible_rescue",
  "name": "Deep Space Rescue",
  "description": "Extract stranded Guardians from hostile territory under time pressure",
  "difficulty": 10,
  "difficulty_multiplier": 8.0,
  "required_stats": {
    "primary": "health",
    "secondary": "movement",
    "tertiary": "defense"
  },
  "visual": {
    "type": "color",
    "value": "#e74c3c",
    "show_name": true
  },
  "repeatable": false,
  "persist_on_fail": true,
  "prerequisites": {
    "missions_completed": ["rescue_operation", "deep_space_recon"],
    "total_missions": 50,
    "flags": ["advanced_rescue_training"]
  },
  "rewards": {
    "success": [
      {
        "item": "legendary_medkit",
        "min": 1,
        "max": 1,
        "drop_chance": 100
      },
      {
        "item": "rare_alloy",
        "min": 20,
        "max": 30,
        "drop_chance": 100
      }
    ],
    "failure": [
      {
        "item": "common_alloy",
        "min": 5,
        "max": 10,
        "drop_chance": 100
      }
    ]
  },
  "simulation": {
    "messages": [
      {
        "text": "Emergency beacon detected... jumping to coordinates!",
        "bar_progress": 20,
        "display_time": 3
      },
      {
        "text": "Hostiles everywhere! Clear a path!",
        "bar_progress": 50,
        "display_time": 3
      },
      {
        "text": "Guardians located! Get them to the ship!",
        "bar_progress": 80,
        "display_time": 3
      },
      {
        "text": "Jump drive charging... hold position!",
        "bar_progress": 95,
        "display_time": 3
      },
      {
        "text": "Extraction complete! All Guardians safe!",
        "bar_progress": 100,
        "display_time": 2
      }
    ]
  }
}
```

---

## Integration with Existing Systems

### Existing Mission System

The current system uses:
- `difficulty` (1-5 scale) maps to flat success rates
- `mission_bonuses` on equipment (e.g., `"combat": 10`)
- Simple pass/fail calculation

### Migration Strategy

**Phase 1: Add New Fields (Non-Breaking)**
- Add `stats` to `guardians.json`
- Add `required_stats` and `difficulty_multiplier` to `missions.json`
- Add `stat_bonuses` to `items.json`
- Keep existing `mission_bonuses` for backward compatibility

**Phase 2: Implement New Calculation**
- Create new success calculation function using the formula from this doc
- Run both old and new systems in parallel for testing
- Log discrepancies for balancing

**Phase 3: UI Updates**
- Display Guardian stats in Guardian selection screen
- Show mission stat requirements (Gold/Silver/Bronze icons)
- Calculate and display predicted success % before mission launch

**Phase 4: Content Update**
- Rebalance existing missions with new `difficulty_multiplier` values
- Update all missions with `required_stats`
- Create new gear with `stat_bonuses`
- Deprecate old `mission_bonuses` system

**Phase 5: Remove Old System**
- Remove `mission_bonuses` from calculation
- Keep in JSON for historical items (they just contribute 0)
- Document migration in changelog

### Handling Legacy Content

**Old Equipment:**
- Items with `mission_bonuses` but no `stat_bonuses` contribute 0 to new system
- Add conversion script: `"combat": 10` → `"attack": 10`
- Notify players of equipment changes

**Old Missions:**
- Missions without `required_stats` should be flagged as "needs update"
- Default to single-stat based on old `mission_type` field:
  - `"combat"` → `"primary": "attack"`
  - `"diplomatic"` → `"primary": "mind"`
  - `"rescue"` → `"primary": "health"`
  - `"recon"` → `"primary": "movement"`
  - `"search"` → `"primary": "mind"`
  - `"collection"` → `"primary": "movement"`

---

## Player-Facing Information

### Pre-Mission Screen

Players should see:

1. **Mission Difficulty** (1-10 number with label)
   - Example: "Difficulty 7 - Very Hard"

2. **Required Stats** (with visual priority)
   - 🥇 **Attack** (Primary)
   - 🥈 **Mind** (Secondary)
   - 🥉 **Defense** (Tertiary)

3. **Predicted Success Rate**
   - Calculate based on selected Guardians + equipped gear
   - Display as percentage with color coding:
     - 80-100%: Green
     - 50-79%: Yellow
     - 0-49%: Red

4. **Guardian Stat Match Indicators**
   - Show each Guardian's contribution
   - Highlight which stats they're contributing to
   - Visual indicator if Guardian is poorly matched

### Example UI Mockup (Text)

```
╔════════════════════════════════════════╗
║  MISSION: Deep Space Rescue            ║
║  Difficulty: 10 - Maximum Challenge    ║
╠════════════════════════════════════════╣
║  Required Stats:                       ║
║  🥇 Health (Primary)                   ║
║  🥈 Movement (Secondary)               ║
║  🥉 Defense (Tertiary)                 ║
╠════════════════════════════════════════╣
║  Selected Team:                        ║
║  ✓ Stella   [Health: 40, Defense: 50]  ║
║  ✓ Vawn     [Movement: 50, Health: 30] ║
║  ✓ Tiberius [Defense: 50, Health: 40]  ║
║  ✓ Maestra  [Movement: 40, Health: 30] ║
╠════════════════════════════════════════╣
║  Predicted Success Rate: 30% ⚠️        ║
║                                        ║
║  [Launch Mission]  [Cancel]            ║
╚════════════════════════════════════════╝
```

### Guardian Selection Screen

When selecting Guardians for a mission, show:
- Guardian portraits
- Guardian stats with highlighting for required stats
- Real-time success % update as Guardians are added/removed
- Suggested Guardians based on stat requirements

### Gear Loadout Screen

When equipping gear:
- Show Guardian's current stats
- Show gear's stat bonuses
- Display final stat totals with gear equipped
- Highlight which stats contribute to current mission

---

## Implementation Notes

### Calculation Performance

The success rate calculation should be:
- Performed client-side for instant feedback
- Cached when team/gear doesn't change
- Recalculated on any Guardian or gear change

### Randomization

The calculated success % should be used to:
- Roll a random number (1-100)
- If roll ≤ success %, mission succeeds
- If roll > success %, mission fails

**Important:** Always roll randomly. Never guarantee success even at 100%.

### Data Validation

When loading JSON data:
- Guardian stats must sum to 180-200 points
- Each stat must be 10-50
- Difficulty multipliers must match difficulty level (reference table)
- Required stats must be valid stat names
- Gear bonuses should align with rarity tier

### Testing Checklist

- [ ] Solo Guardian at Difficulty 1 achieves ~40-45% success
- [ ] Full team at Difficulty 5 with moderate gear achieves ~75-100%
- [ ] Perfect team at Difficulty 10 achieves ~75% (never 100%)
- [ ] Wrong Guardian selection noticeably reduces success rate
- [ ] Gear upgrades provide meaningful improvement
- [ ] Multi-stat missions require diverse team composition
- [ ] Negative gear modifiers create interesting tradeoffs

### Balance Tuning

If success rates feel off:

**Too Easy:**
- Increase difficulty multipliers (especially 6-10)
- Reduce gear stat bonuses
- Add more multi-stat missions

**Too Hard:**
- Decrease difficulty multipliers
- Increase gear stat bonuses
- Make more single-stat missions available

**No Meaningful Choice:**
- Ensure Guardians have distinct stat profiles
- Add more negative-modifier gear
- Create missions requiring underused stats

---

## Appendix A: Quick Reference Tables

### Stat Distribution Summary

| Guardian | Health | Attack | Defense | Movement | Mind | Total |
|----------|--------|--------|---------|----------|------|-------|
| Stella | 40 | 40 | 50 | 30 | 30 | 190 |
| Vawn | 30 | 50 | 20 | 50 | 30 | 180 |
| Tiberius | 40 | 30 | 50 | 20 | 50 | 190 |
| Maestra | 30 | 50 | 30 | 40 | 50 | 200 |

### Difficulty Multiplier Table

| Difficulty | Multiplier | Points for 100% (Perfect Team) |
|-----------|-----------|-------------------------------|
| 1 | 0.6 | 60 |
| 2 | 1.1 | 110 |
| 3 | 1.5 | 150 |
| 4 | 1.7 | 170 |
| 5 | 2.0 | 200 |
| 6 | 3.0 | 300 |
| 7 | 4.0 | 400 |
| 8 | 5.5 | 550 |
| 9 | 6.5 | 650 |
| 10 | 8.0 | 800 |

### Gear Rarity Guide

| Rarity | Point Range | Multi-Stat? | Negatives? |
|--------|-------------|-------------|------------|
| Common | 0-5 | No | No |
| Uncommon | 5-10 | No | No |
| Rare | 10-15 | Yes (2 stats) | Small (-5) |
| Epic | 15-20 | Yes (2-3 stats) | Medium (-10 to -15) |
| Legendary | 20+ | Yes (3+ stats) | Large (-15+) |

---

## Appendix B: Example Mission Set

### Difficulty 1: "Training Exercise"
```json
{
  "difficulty": 1,
  "difficulty_multiplier": 0.6,
  "required_stats": {
    "primary": "attack"
  }
}
```
**Target:** 1 Guardian with average stats = 42% success

---

### Difficulty 3: "Supply Raid"
```json
{
  "difficulty": 3,
  "difficulty_multiplier": 1.5,
  "required_stats": {
    "primary": "movement"
  }
}
```
**Target:** 2 Guardians or 1 specialist = 70%+ success

---

### Difficulty 5: "Tactical Assault"
```json
{
  "difficulty": 5,
  "difficulty_multiplier": 2.0,
  "required_stats": {
    "primary": "attack",
    "secondary": "mind"
  }
}
```
**Target:** 3 Guardians with mixed skills = 60-80% success

---

### Difficulty 7: "Defensive Siege"
```json
{
  "difficulty": 7,
  "difficulty_multiplier": 4.0,
  "required_stats": {
    "primary": "defense",
    "secondary": "health",
    "tertiary": "attack"
  }
}
```
**Target:** 4 Guardians with good gear = 50-70% success

---

### Difficulty 10: "Impossible Odds"
```json
{
  "difficulty": 10,
  "difficulty_multiplier": 8.0,
  "required_stats": {
    "primary": "attack",
    "secondary": "movement",
    "tertiary": "mind"
  }
}
```
**Target:** 4 Guardians with epic gear = 65-75% success (never 100%)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial design document |

---

**End of Document**