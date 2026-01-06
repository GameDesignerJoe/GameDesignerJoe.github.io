# Balance Tuning Guide - The Watch MVG

## Overview
The current balance creates a challenging experience where heavy policing leads to corruption and trust erosion. This document explains the key parameters and suggests adjustments for different play experiences.

## Current Balance (M8 - Initial Tuning)

### Crime Generation (src/systems/crime.js)
- **Citizen Crime Base**: 5% per day
  - Wary multiplier: 1.5x (7.5%)
  - Hostile multiplier: 2.0x (10%)
  - Location density multiplier: 0.2-0.8
  - Cap: 30% max probability

- **Location Crime Base**: 8% at high density (0.8)
  - Scales with crime density value

- **Corrupt Warden Crime**: Triggered at 30% corruption
  - Generates 1-2 harassment/traffic crimes in quiet areas (< 2 crimes)

### Crime Resolution (src/systems/resolution.js)
- **Prevention Chance**: 30% - (corruption/500)
  - At 0% corruption: 30% prevention
  - At 50% corruption: 20% prevention
  - At 100% corruption: 10% prevention

- **Citizen Reporting** (no warden present):
  - Trusting: 56% report (70/100 * 0.8)
  - Neutral: 40% report (50/100 * 0.8)
  - Wary: 24% report (30/100 * 0.8)
  - Hostile: 8% report (10/100 * 0.8)

### Warden Corruption (src/systems/updates.js)
- **Base Increase**: +5% per day
- **Boredom Bonus**: +10% when < 2 crimes in zone
- **Burnout Bonus**: +8% when > 8 crimes in zone
- **Result**: Both wardens hit 100% by day 20-23

### Citizen Trust (src/systems/updates.js)
- **Watch Exposure**: -2 trust per warden nearby per day
- **Crime Victim Responses**:
  - Good response (prevented/responded): +5 trust
  - No response (unreported): -15 trust

---

## Tuning Recommendations

### Making the Game Easier (More Forgiving)

**Slower Corruption:**
```javascript
// In src/systems/updates.js - updateWardenCorruption()
let corruptionIncrease = 3; // Was 5
// Boredom: +7 (was +10)
// Burnout: +5 (was +8)
```

**Less Trust Erosion:**
```javascript
// In src/systems/updates.js - updateCitizenTrust()
trustChange -= wardensNearHome * 1; // Was -2
```

**Better Prevention:**
```javascript
// In src/systems/resolution.js - resolveCrimes()
const preventionChance = 0.40 - (responder.corruptionLevel / 500); // Was 0.30
```

### Making the Game Harder (More Realistic)

**Faster Corruption:**
```javascript
let corruptionIncrease = 7; // Was 5
// Boredom: +15 (was +10)
// Burnout: +12 (was +8)
```

**More Trust Erosion:**
```javascript
trustChange -= wardensNearHome * 3; // Was -2
```

**More Crime:**
```javascript
// In src/systems/crime.js - calculateCrimeProbability()
let baseProbability = 0.08; // Was 0.05
```

### Making "Balanced" Outcome Achievable

Currently "Balanced" requires:
- Crime Control >= 70
- Corruption Score >= 70 (avg corruption <= 30)
- Trust Score >= 70

**Option 1: Relax Requirements**
```javascript
// In src/systems/audit.js - classifyOutcome()
if (crimeScore >= 60 && corruptionScore >= 60 && trustScore >= 60) {
  return 'balanced'; // Was 70/70/70
}
```

**Option 2: Improve Mechanics**
- Reduce corruption growth
- Reduce trust erosion
- Allow warden "rotation" to reset corruption

### Adjusting Outcome Distribution

**Current Thresholds:**
- Balanced: 70/70/70 (very rare)
- Authoritarian: crime >= 70 AND (corruption < 40 OR trust < 40)
- Neglectful: crime < 50 AND trust >= 60
- Chaos: crime < 50 AND corruption < 50 AND trust < 50
- Mixed: Everything else

**Suggested Tweaks:**
- Lower "Balanced" to 60/60/60
- Add "Effective but Costly" outcome (high crime control, moderate corruption/trust)
- Add "Community-Focused" outcome (moderate crime, high trust)

---

## Quick Balance Patches

### Patch 1: "Achievable Balance"
Makes the ideal outcome possible with good play:
- Corruption base: 5 → 3
- Trust erosion: -2 → -1
- Prevention: 0.30 → 0.35
- Balanced threshold: 70 → 65

### Patch 2: "Forgiving Experience"
Reduces punishment for heavy policing:
- Corruption base: 5 → 4
- Boredom: +10 → +6
- Burnout: +8 → +5
- Trust erosion: -2 → -1.5

### Patch 3: "Harsh Reality"
Makes the dilemma even more stark:
- Corruption base: 5 → 6
- Trust erosion: -2 → -3
- Crime base: 5% → 7%
- Balanced threshold: 70 → 75

---

## Testing Strategies

### Heavy Coverage Test
- Both wardens center (2,2) and (2,3)
- Expected: Low crime, high corruption, low trust → "Authoritarian"

### Light Coverage Test
- Wardens at corners (0,0) and (4,4)
- Expected: Higher crime, lower corruption, higher trust → "Neglectful" or "Mixed"

### Balanced Attempt Test
- Wardens at (1,2) and (3,2) - moderate spread
- Expected: Should be closest to "Balanced" if achievable

---

## Future Expansions

When scaling to full game, consider:
- **Warden Rotation**: Replace corrupt wardens mid-game
- **Training**: Spend resources to reduce corruption
- **Community Programs**: Boost trust without wardens
- **Intelligence**: Reveal high-crime areas
- **Variable Patrol**: Different zone sizes/shapes

---

## Current Assessment

**What Works:**
✓ Corruption grows inevitably (matches theme)
✓ Trust erodes under surveillance (matches theme)
✓ Crime responds to coverage
✓ Dilemma is clear

**What Might Need Tuning:**
⚠️ "Balanced" may be mathematically impossible
⚠️ Corruption grows too fast (100% by day 20)
⚠️ Trust erosion might be too subtle
⚠️ Player has limited agency (only positioning)

**Recommendation:**
Start with current balance, then apply "Patch 1: Achievable Balance" if playtesters find it too punishing.
