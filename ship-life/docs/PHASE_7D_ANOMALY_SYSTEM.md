# Phase 7.4 - Anomaly System

## 🎯 Goal
Add dynamic mission modifiers (anomalies) that create variety, challenge, and strategic decision-making in mission selection.

---

## 📋 Overview

Anomalies are special conditions that can appear on missions, modifying:
- Difficulty (success rate)
- Rewards (quantity/quality)
- Requirements (equipment types, Guardian composition)
- Special effects (flags, unlocks)

**Key Features:**
- Data-driven (Anomalies.json)
- Visible on mission cards
- Strategic choices (risk vs reward)
- Optional (not all missions have anomalies)

---

## 🎨 Design Vision

### Player Experience
- **Mission Selection:** "That mission has Solar Storm (+harder, +rewards). Do I risk it?"
- **Strategic Planning:** "Artifact Detected requires tech equipment. Do I have it?"
- **Variety:** Missions feel different each time

### Example Scenarios
1. **High Risk, High Reward:** Solar Storm makes mission harder but doubles rewards
2. **Equipment Gating:** Artifact requires tech equipment to attempt
3. **Relationship Bonuses:** Civilian Escort gives +relationship points
4. **Time-Limited:** Critical situations require immediate action

---

## 📊 Anomaly Categories

### 1. Environmental
Natural phenomena affecting mission conditions
- Solar Storm
- Asteroid Field
- Magnetic Interference
- Radiation Zone

### 2. Tactical
Mission-specific complications
- Heavy Resistance
- Time Pressure
- Reinforcements
- Ambush Risk

### 3. Opportunity
Beneficial conditions or rare finds
- Artifact Detected
- Supply Cache
- Friendly Forces
- Intelligence Bonus

### 4. Social
NPC-related factors
- Civilian Escort
- VIP Transport
- Diplomatic Complications
- Cultural Sensitivity

---

## 🔧 Implementation Plan

### Step 1: Create Anomalies.json
```json
{
  "anomalies": [
    {
      "id": "solar_storm",
      "name": "Solar Storm",
      "description": "Electromagnetic interference complicates operations",
      "icon": { "type": "color", "value": "#ff6b35", "show_name": true },
      "rarity": "common",
      "effects": {
        "difficulty_modifier": 10,
        "reward_multiplier": 1.5
      }
    }
  ]
}
```

### Step 2: Mission Assignment
Two approaches:
- **A) Random:** Roll for anomaly when mission appears (20-30% chance)
- **B) Predetermined:** Missions.json specifies anomaly_pool

**Recommendation:** Start with Random (simpler), add Predetermined later

### Step 3: Display on Mission Cards
- Add anomaly badge above/below mission name
- Color-coded by category
- Tooltip shows effects
- Visual indicator (icon + name)

### Step 4: Modify Mission Logic
```javascript
// When launching mission:
1. Check anomaly
2. Apply difficulty_modifier
3. Check equipment requirements
4. Roll success/fail with modified rate
5. Apply reward_multiplier to loot
```

### Step 5: Special Requirements
- Check Guardian composition
- Check equipped items
- Display warning if requirements not met
- Block launch if critical requirement missing

---

## 📝 Anomaly Effects Schema

### Basic Effects
```json
{
  "difficulty_modifier": 10,        // +10% harder (-10% success rate)
  "reward_multiplier": 1.5,         // 1.5x rewards
  "reward_bonus_items": [           // Additional guaranteed loot
    { "item": "rare_crystal", "amount": 1 }
  ]
}
```

### Requirements
```json
{
  "requires_equipment_type": "tech",     // Need tech equipment equipped
  "requires_minimum_guardians": 3,       // Need at least 3 in squad
  "requires_specific_guardian": "tiberius" // Must include Tiberius
}
```

### Special Effects
```json
{
  "relationship_bonus": 5,          // +5 to all pair relationships
  "unlock_flag": "artifact_found",  // Set flag on success
  "time_limited": true,             // Disappears after 1 mission cycle
  "failure_penalty": "injury"       // Special consequence on fail
}
```

---

## 🎯 Anomaly Examples

### Solar Storm
**Category:** Environmental  
**Rarity:** Common  
**Effect:** +10% difficulty, +50% rewards  
**Description:** "Electromagnetic interference complicates navigation and communication"

### Artifact Detected
**Category:** Opportunity  
**Rarity:** Rare  
**Effect:** Requires tech equipment, +rare loot, sets flag  
**Description:** "Unknown technology signature detected in mission area"

### Civilian Escort
**Category:** Social  
**Rarity:** Uncommon  
**Effect:** -10% difficulty, +relationship bonus  
**Description:** "Local civilians request escort through mission zone"

### Time Pressure
**Category:** Tactical  
**Rarity:** Common  
**Effect:** +20% difficulty, 2x rewards  
**Description:** "Situation deteriorating rapidly - immediate action required"

### Heavy Resistance
**Category:** Tactical  
**Rarity:** Uncommon  
**Effect:** +15% difficulty, requires 3+ Guardians  
**Description:** "Enemy forces significantly stronger than anticipated"

### Supply Cache
**Category:** Opportunity  
**Rarity:** Rare  
**Effect:** Guaranteed blueprint drop, normal difficulty  
**Description:** "Abandoned supply depot detected - valuable equipment inside"

---

## 🎨 UI Design

### Mission Card with Anomaly
```
┌─────────────────────────┐
│   FIRST CONTACT         │
│   ⚡ Solar Storm        │ ← Anomaly badge
│                         │
│   Establish comms...    │
│                         │
│   Difficulty: ★★★☆☆    │
│   +50% Rewards          │ ← Effect indicator
└─────────────────────────┘
```

### Anomaly Tooltip (Hover)
```
┌─────────────────────────────┐
│ ⚡ Solar Storm              │
│ Environmental · Common      │
│                             │
│ Effects:                    │
│ • +10% Difficulty           │
│ • +50% Reward Multiplier    │
│                             │
│ "Electromagnetic            │
│  interference..."           │
└─────────────────────────────┘
```

### Planetfall Portal Warning
```
┌─────────────────────────────┐
│ ⚠️ ANOMALY REQUIREMENTS     │
│                             │
│ This mission requires:      │
│ • Tech Equipment (0/1)      │
│ • Minimum 3 Guardians (2/3) │
│                             │
│ [Launch Mission] (disabled) │
└─────────────────────────────┘
```

---

## 💻 Code Structure

### 1. Data Loading
```javascript
// js/main.js
let anomaliesData = null;

async function loadAnomaliesData() {
    const response = await fetch('data/anomalies.json');
    anomaliesData = await response.json();
}
```

### 2. Anomaly Assignment
```javascript
// js/missions.js
function assignAnomalies(missions) {
    missions.forEach(mission => {
        if (!mission.anomaly && Math.random() < 0.25) {
            mission.anomaly = rollAnomaly();
        }
    });
}

function rollAnomaly() {
    // Weight by rarity
    const pool = [];
    anomaliesData.anomalies.forEach(a => {
        const weight = getRarityWeight(a.rarity);
        for (let i = 0; i < weight; i++) pool.push(a);
    });
    return pool[Math.floor(Math.random() * pool.length)];
}
```

### 3. Display Badge
```javascript
// js/rooms.js - createMissionCard()
if (mission.anomaly) {
    const anomalyBadge = document.createElement('div');
    anomalyBadge.className = 'mission-anomaly-badge';
    anomalyBadge.style.background = mission.anomaly.icon.value;
    anomalyBadge.textContent = `⚡ ${mission.anomaly.name}`;
    card.appendChild(anomalyBadge);
}
```

### 4. Apply Effects
```javascript
// js/missions.js - calculateMissionSuccessRate()
function calculateMissionSuccessRate(gameState, squadIds, mission) {
    let baseRate = getDifficultySuccessRate(mission.difficulty);
    
    // Apply anomaly modifier
    if (mission.anomaly && mission.anomaly.effects.difficulty_modifier) {
        baseRate -= mission.anomaly.effects.difficulty_modifier;
    }
    
    // ... rest of calculation
    return Math.max(5, Math.min(95, finalRate));
}
```

### 5. Check Requirements
```javascript
// js/missions.js
function checkAnomalyRequirements(gameState, squadIds, mission) {
    if (!mission.anomaly || !mission.anomaly.effects) return { met: true };
    
    const effects = mission.anomaly.effects;
    
    // Check equipment type
    if (effects.requires_equipment_type) {
        const hasEquipment = squadIds.some(gid => {
            const loadout = getLoadout(gameState, gid);
            const equip = getItemById(loadout.equipment);
            return equip && equip.equipment_type === effects.requires_equipment_type;
        });
        if (!hasEquipment) {
            return {
                met: false,
                missing: `Requires ${effects.requires_equipment_type} equipment`
            };
        }
    }
    
    // Check Guardian count
    if (effects.requires_minimum_guardians && squadIds.length < effects.requires_minimum_guardians) {
        return {
            met: false,
            missing: `Requires at least ${effects.requires_minimum_guardians} Guardians`
        };
    }
    
    return { met: true };
}
```

---

## 🎨 CSS Styling

### Anomaly Badge
```css
.mission-anomaly-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.mission-anomaly-badge::before {
    content: "⚡ ";
}
```

### Category Colors
```css
.anomaly-environmental { background: linear-gradient(135deg, #ff6b35, #f7931e); }
.anomaly-tactical { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.anomaly-opportunity { background: linear-gradient(135deg, #2ecc71, #27ae60); }
.anomaly-social { background: linear-gradient(135deg, #3498db, #2980b9); }
```

---

## ✅ Implementation Checklist

### Phase 1: Foundation
- [ ] Create `data/anomalies.json` with 10-15 anomalies
- [ ] Load anomalies data in `main.js`
- [ ] Add anomaly assignment logic
- [ ] Test data loading

### Phase 2: Display
- [ ] Add anomaly badge to mission cards
- [ ] Style badges (colors, icons)
- [ ] Add tooltip on hover
- [ ] Show effects in Planetfall Portal

### Phase 3: Mechanics
- [ ] Apply difficulty modifiers
- [ ] Apply reward multipliers
- [ ] Implement requirement checking
- [ ] Block launch if requirements not met

### Phase 4: Special Effects
- [ ] Relationship bonuses
- [ ] Bonus items
- [ ] Flag setting
- [ ] Special notifications

### Phase 5: Polish
- [ ] Add animations (badge pulse)
- [ ] Sound effects hooks
- [ ] Success/fail messages mentioning anomaly
- [ ] Debug commands (add/remove anomaly)

---

## 🧪 Testing Plan

### Test Cases
1. **Random Assignment:** Reload mission computer 10x, verify anomalies appear ~25% of time
2. **Difficulty Modifier:** Complete Solar Storm mission 10x, verify success rate reduced
3. **Reward Multiplier:** Complete +50% mission, verify loot increased
4. **Equipment Requirement:** Try launching without tech equipment, verify blocked
5. **Guardian Requirement:** Try launching with 2 Guardians when 3 required, verify blocked
6. **Special Effects:** Complete mission with relationship bonus, verify all pairs increment

### Debug Commands
```javascript
// Add to debug menu
addAnomaly(missionId, anomalyId)
removeAnomaly(missionId)
rerollAnomalies()
```

---

## 🎮 Player Communication

### Tutorial Messages
- First anomaly: "⚡ This mission has an Anomaly - special conditions that affect difficulty and rewards"
- First blocked: "⚠️ You don't meet this anomaly's requirements. Check your loadouts!"
- First success: "✨ The anomaly made this harder, but the rewards are greater!"

### Notification Examples
- "Solar Storm detected on First Contact"
- "Artifact Detected requires tech equipment"
- "Civilian Escort complete - relationship bonuses earned"

---

## 📈 Balance Considerations

### Rarity Distribution
- **Common (60%):** Small modifiers (±10% difficulty, ±25% rewards)
- **Uncommon (30%):** Medium modifiers (±15% difficulty, ±50% rewards, requirements)
- **Rare (10%):** Large modifiers (±20% difficulty, 2x rewards, special effects)

### Risk vs Reward
- Harder anomalies should give proportionally better rewards
- Requirements should gate high-value opportunities
- Positive anomalies should be rarer than negative

### Frequency
- 20-30% of missions have anomalies
- Never more than 2 anomalies per mission refresh
- Rare anomalies ~2-3% overall appearance rate

---

## 🔮 Future Enhancements

### Post-MVP Features
1. **Anomaly Chains:** Completing anomaly missions unlocks related missions
2. **Persistent Anomalies:** Some anomalies stay for multiple mission cycles
3. **Dynamic Severity:** Anomaly strength scales with player progression
4. **Combo Effects:** Multiple anomalies on one mission
5. **Guardian Specializations:** Certain Guardians better at handling anomalies
6. **Anomaly Research:** Unlock better handling through tech tree

---

## 📚 Related Documents
- `shiplife_milestone_plan.txt` - Overall roadmap
- `data/anomalies.json` - Anomaly definitions
- `data/missions.json` - Mission structure
- `PHASE_7B_SQUAD_LOADOUT.md` - Equipment system reference

---

**Document Version:** 1.0  
**Status:** Planning  
**Next Step:** Create anomalies.json

**Let's build it! 🚀**
