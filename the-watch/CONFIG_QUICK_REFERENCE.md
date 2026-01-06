# Game Config Quick Reference

## How to Tune the Game

**Edit this ONE file:** `src/config/gameConfig.js`

Changes take effect immediately on browser reload (Ctrl+R or F5).

## Quick Tuning Guide

### Make Game Easier
```javascript
// In gameConfig.js
baseDailyIncrease: 3,          // Was 5 - slower corruption
boredomBonus: 6,               // Was 10 - less boredom corruption
burnoutBonus: 5,               // Was 8 - less burnout corruption
watchExposurePenalty: -1,      // Was -2 - less trust erosion
balancedThresholds: {
  crimeControl: 60,            // Was 70 - easier to achieve
  corruption: 60,              // Was 70
  trust: 60,                   // Was 70
}
```

### Make Game Harder
```javascript
baseDailyIncrease: 7,          // Was 5 - faster corruption
boredomBonus: 15,              // Was 10 - more boredom corruption
burnoutBonus: 12,              // Was 8 - more burnout corruption
watchExposurePenalty: -3,      // Was -2 - faster trust erosion
baseCitizenCrimeProbability: 0.08,  // Was 0.05 - more crime
```

### Make "Balanced" Outcome Achievable
```javascript
// In AUDIT_CONFIG section
balancedThresholds: {
  crimeControl: 65,            // Lower from 70
  corruption: 65,              // Lower from 70
  trust: 65,                   // Lower from 70
}
```

## Key Parameters to Tweak

### Crime Generation
- `baseCitizenCrimeProbability` (0.05) - Base crime rate per citizen
- `locationCrimeMultiplier` (0.08) - Location-based crime
- `wary` multiplier (1.5) - How much more wary citizens commit crimes
- `hostile` multiplier (2.0) - How much more hostile citizens commit crimes

### Warden Corruption
- `baseDailyIncrease` (5) - Corruption per day
- `boredomBonus` (10) - Extra corruption when < 2 crimes
- `burnoutBonus` (8) - Extra corruption when > 8 crimes

### Citizen Trust
- `watchExposurePenalty` (-2) - Trust lost per warden nearby per day
- `goodResponseBonus` (5) - Trust gained when crime handled well
- `noResponsePenalty` (-15) - Trust lost when crime ignored

### Crime Resolution
- `basePreventionChance` (0.30) - 30% chance to prevent crime
- `corruptionPenaltyDivisor` (500) - How much corruption hurts prevention

### Audit Outcomes
All thresholds in `balancedThresholds`, `authoritarianThresholds`, etc.

## Testing Different Strategies

### Heavy Coverage Test
- Place both wardens at (2,2) and (2,3) - center map
- Expected: Low crime, high corruption, low trust → "Authoritarian"

### Light Coverage Test  
- Place wardens at corners (0,0) and (4,4)
- Expected: Higher crime, lower corruption, higher trust → "Neglectful"

### Balanced Attempt Test
- Place wardens at (1,2) and (3,2) - moderate spread
- Expected: Should be closest to "Balanced" (if achievable)

## Common Tweaks

### "I never get 'Balanced' outcome"
→ Lower all three thresholds in `balancedThresholds` to 60 or 65

### "Corruption grows too fast"
→ Reduce `baseDailyIncrease`, `boredomBonus`, and `burnoutBonus`

### "Trust doesn't matter enough"
→ Increase `watchExposurePenalty` (more negative) and `noResponsePenalty`

### "Not enough crime"
→ Increase `baseCitizenCrimeProbability` and `locationCrimeMultiplier`

### "Wardens prevent too few crimes"
→ Increase `basePreventionChance` (0.30 → 0.40)

## File Location

**Config File:** `/src/config/gameConfig.js`

All comments are in that file - it's designed to be human-readable!

## Remember

- Edit `gameConfig.js` only
- Reload browser (F5) to see changes
- No rebuild needed
- Keep BALANCE_TUNING.md as reference documentation
