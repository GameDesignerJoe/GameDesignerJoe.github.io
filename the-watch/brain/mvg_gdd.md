# The Watch - MVG Game Design Document

## Core Concept
A strategic resource management game where players place law enforcement in a small town to minimize crime over 3 days, only to discover their "successful" strategies have created an oppressive surveillance state.

## Minimum Viable Gameplay Scope
- **Grid**: 5x5 (25 squares)
- **Population**: 10 citizens total (including Wardens)
- **Duration**: 3 days
- **Starting Wardens**: 2
- **Win Condition (Perceived)**: Minimize crime statistics
- **Win Condition (Actual)**: Maximize citizen happiness

---

## Core Loop

1. **Placement Phase**: Position Wardens on grid, set patrol zones (fixed radius 1 = 3x3)
2. **Transition**: "Day X" animation/text
3. **Simulation**: Day runs instantly (no player interaction)
4. **Report Phase**: Incident report shows crime stats and notable events
5. Repeat for 3 days
6. **Final Review**: Independent Audit reveals hidden metrics (happiness, corruption)

---

## Game Flow

### Opening
Text appears: *"You are Commander of the Watch. In 3 days time, an Independent Audit will come out showing your effectiveness at keeping crime down in your area. Good luck, Commander. Keep this city safe."*

### Day 1
- Player places 2 Wardens on 5x5 grid
- Click "Run Day 1" 
- Transition screen
- Simulation runs
- Day 2 begins with Day 1 Report

### Days 2-3
- Read previous day's report
- Adjust Warden positions
- Run day
- Receive next report

### Final Review
- Day 3 Report appears first
- Button: "View Independent Audit Results"
- Audit reveals: citizen happiness, Warden corruption, unreported crimes, actual safety

---

## Citizens (Simplified)

**Total Population**: 10 (8 civilians + 2 Wardens at start)

**Civilian Stats** (hidden from player):
- Home Grid Location
- Trust Level: Trusting → Neutral → Wary → Hostile
- Watch Exposure: Cumulative encounters with Wardens

**Trust Changes**:
- High Warden presence in area → Trust decreases
- Warden violence/harassment → Trust decreases
- Crimes going unsolved → Trust decreases slightly
- Being crime victim with no response → Trust decreases significantly

**Crime Likelihood**:
- Base chance per citizen per day
- Increases with low Trust
- Increases in areas with no Warden presence (desperation)
- Increases in areas with excessive Warden presence (rebellion)

---

## Wardens (Simplified)

**Starting Count**: 2 (from civilian population)

**Placement**:
- Place on any grid square
- Fixed patrol radius 1 (covers 3x3 area = 9 squares)

**Corruption** (hidden):
- Increases slowly each day employed
- Increases faster in low-activity areas (boredom)
- Increases faster in high-activity areas (burnout)
- Manifests as: excessive force, false arrests, harassment, evidence planting

**Effectiveness**:
- Prevents crimes in patrol zone
- Responds to crimes in patrol zone
- Corrupted Wardens still "solve" crimes but damage Trust

---

## Crime System (Simplified)

**Crime Generation**:
- Each citizen has % chance to commit crime each day based on Trust
- Grid squares have crime density values affecting frequency
- Crimes assigned to random times throughout day (for reporting)

**Crime Resolution**:
1. **Prevented**: Warden in patrol zone, visible deterrent stopped it
2. **Responded**: Crime occurred, Warden arrived and "resolved" it
3. **Reported**: Crime occurred, no Warden present, citizen reported it
4. **Unreported**: Crime occurred, no Warden present, citizen didn't report (low Trust)

**Crime Types** (for flavor in reports):
- Assault
- Theft
- Vandalism  
- Harassment (often Warden-generated in quiet areas)
- Traffic violations (Warden-generated)

---

## Grid System

**Size**: 5x5 = 25 squares

**Crime Density** (hidden values per square):
- **Low** (0.2): 5-8 squares - few natural crimes
- **Medium** (0.5): 12-15 squares - moderate activity
- **High** (0.8): 5-8 squares - frequent crimes

**No Named Zones**: Players discover patterns through play

---

## Daily Report Structure

Appears at start of next day (or final review after Day 3):

```
DAY X INCIDENT REPORT

CRIME SUMMARY
- Crimes Prevented: X
- Crimes Responded: X
- Crimes Reported: X
- Estimated Unreported: X-X

WATCH DEPLOYMENT
- Warden #1: Grid [C3], Patrol Radius 1
- Warden #2: Grid [A1], Patrol Radius 1

NOTABLE INCIDENTS
- [2-4 specific crime descriptions with grid location and Warden response]
- Example: "Assault at Grid D4, 2:34pm - Warden #1 responded, suspect arrested"
- Example: "Theft at Grid A5, 11:15am - Reported by citizen, no Warden available"
```

**Report does NOT show**: Happiness, Trust levels, corruption, true unreported crime count

---

## Independent Audit (Final Review)

Appears after Day 3 Report, triggered by button click.

**Reveals**:
- **Crime Statistics**: Your reported numbers vs actual crimes committed
- **Citizen Happiness**: Average happiness score (0-100)
- **Trust Levels**: Distribution of citizen Trust (Trusting/Neutral/Wary/Hostile)
- **Warden Corruption**: Specific corrupt actions taken by each Warden
- **Unreported Crimes**: Actual count and locations
- **Classification**: "Police State" / "Balanced" / "Negligent" / etc.

**Sample Audit Text**:
```
INDEPENDENT AUDIT RESULTS

Your reported crime statistics showed improvement over 3 days.
However, citizen happiness declined by 40%.

CITIZEN TRUST BREAKDOWN
- Trusting: 1
- Neutral: 2  
- Wary: 3
- Hostile: 2

WARDEN CORRUPTION INCIDENTS
- Warden #1: 5 uses of excessive force, 2 false arrests
- Warden #2: 8 harassment citations, 3 evidence fabrications

ACTUAL vs REPORTED CRIMES
- You reported 12 crimes total
- 27 crimes actually occurred
- 15 went unreported due to eroded trust

CLASSIFICATION: AUTHORITARIAN FAILURE
While visible crime decreased, you created a surveillance state 
where citizens are afraid to report crimes and Wardens abuse power.
```

---

## User Interface (Simplified)

**Map View**:
- 5x5 grid of squares
- Click square to place/move Warden
- Blue overlay shows patrol zone (3x3 around Warden)
- After day runs: Red dots show crimes, click for details
- Clean, minimalist aesthetic (Mini Metro inspiration)

**Controls**:
- "Run Day X" button
- Warden selection (drag to move or click square to place)
- Map is always visible

**Transitions**:
- Fade to "Day X" text
- Brief pause (1-2 seconds)
- Fade to report

---

## Design Pillars

1. **Hidden Consequences**: Players optimize for visible metrics without seeing the damage
2. **Pattern Recognition**: Success comes from studying maps and finding balance
3. **Moral Commentary**: The game's thesis is "more authority ≠ more safety"
4. **Replayability**: Short duration encourages experimentation with different strategies

---

## Victory Conditions

**Player Thinks**: Low crime stats = success

**Game Reveals**: High happiness + reasonable crime management = success

**Optimal Strategy** (discovered through play):
- Minimal Warden coverage
- Strategic placement in actual high-crime areas
- Accept some visible crime as cost of community trust
- Avoid over-policing any area

---

## Out of Scope for MVG

- Budget slider (fixed 2 Wardens)
- Hiring additional Wardens
- Variable patrol radius
- Training day
- Different Warden types (Investigators, Auditors)
- Detailed citizen occupation tracking
- Multiple crime categories for simulation
- Complaint tracking system
- Mid-day decision points
