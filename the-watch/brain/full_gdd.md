# The Watch - Full Game Design Document

## Core Concept
A strategic resource management game where players allocate town budget to law enforcement over 14 days, making placement and hiring decisions to minimize crime. The game reveals that aggressive policing creates the problems it claims to solve, exploring themes of surveillance, corruption, and community trust.

## Full Game Scope
- **Grid**: 15x15 (225 squares)
- **Population**: 100 citizens total (including Wardens)
- **Duration**: 14 days + 1 training day
- **Starting Wardens**: 5 (at 25% budget)
- **Maximum Wardens**: 24 (at 100% budget)
- **Win Condition (Perceived)**: Minimize crime statistics
- **Win Condition (Actual)**: Maximize citizen happiness while managing crime

---

## Core Loop

1. **Read Report**: Previous day's incident report with stats and notable events
2. **Budget Allocation**: Adjust budget slider (5% to 100% in 5% increments)
3. **Warden Management**: 
   - Place Wardens on grid
   - Set patrol radius (1, 2, or 3)
   - Hire new Wardens if budget increased
4. **Decision Points**: Respond to 0-2 prompts (discipline, petitions, incidents)
5. **Run Day**: Simulation executes instantly
6. **Transition**: "Day X" animation
7. Repeat for 14 days
8. **Final Review**: Independent Audit reveals hidden metrics

---

## Opening & Training Day

### Opening Text
*"You are Commander of the Watch. The town council has granted you authority over public safety and budget allocation. In 14 days, an Independent Audit will evaluate your effectiveness. Keep this town safe, Commander."*

### Training Day (Day 0)
**Purpose**: Tutorial without consequences

**Structure**:
- Player starts with 5 Wardens at 25% budget (locked)
- Grid displayed with tooltips/hints
- Place Wardens and set patrol zones
- Run simulation
- Receive report (everything goes well)
- Explanation of budget slider unlocks for Day 1

**Outcomes**:
- Low crime, no corruption manifests
- Citizens remain happy
- Establishes baseline expectations
- Player learns UI without pressure

---

## Citizens (Full System)

**Total Population**: 100 (civilians + Wardens)

### Citizen Attributes

**Static**:
- ID number
- Home Grid Location
- Work Grid Location (where they spend days)

**Dynamic** (hidden from player):
- **Trust Level**: Neighborhood Watch → Trusting → Neutral → Wary → Hostile
- **Corruption Level**: Law-Abiding → Opportunistic → Habitual Offender → Criminal
- **Watch Exposure**: Cumulative days spent in patrolled areas
- **Is Warden**: Boolean (if recruited)
- **Warden ID**: Reference if recruited

### Trust Mechanics

**Trust Decreases**:
- Each day spent in patrolled area: -2 per Warden in range
- Witnessing Warden violence/harassment: -10
- Being crime victim with no response: -15
- Town services degrading (high budget): -1 to -5 per day
- False arrest in neighborhood: -8

**Trust Increases**:
- Crime victim receiving good response: +5
- Long periods without Watch exposure: +1 per day
- Town services improving: +2 per day

**Trust Effects**:
- **Neighborhood Watch** (80-100): Always reports crimes, volunteers info
- **Trusting** (60-79): Reports most crimes, cooperates with Watch
- **Neutral** (40-59): Reports major crimes only
- **Wary** (20-39): Rarely reports, avoids Watch
- **Hostile** (0-19): Never reports, actively antagonistic

### Corruption Mechanics

**Corruption Increases**:
- Low Trust level: +0 to +10 per day (scales with how low)
- High-crime area with no Watch presence: +5
- Town services failing (high budget): +3
- Witnessing Warden corruption without consequence: +5
- Economic pressure (simulated): Random events

**Corruption Effects**:
- **Law-Abiding** (0-20): No criminal behavior
- **Opportunistic** (21-50): Minor crimes if opportunity arises
- **Habitual Offender** (51-80): Regular criminal activity
- **Criminal** (81-100): Frequent, serious crimes

### Job System (Simplified)

Citizens have implied employment based on home/work locations. When recruited as Wardens:
- **Operational Notes** mention labor shortages
- "3 businesses report staffing difficulties" (10-15% of population as Wardens)
- "Hospital operating at reduced capacity" (18-20% as Wardens)
- "Multiple critical services shut down" (22%+ as Wardens)

Jobs aren't individually tracked, just aggregate impact on town health.

---

## Wardens (Full System)

### Warden Types

**Street Wardens**:
- Patrol assigned area
- Respond to crimes in real-time
- Visible presence affects citizen behavior
- Most prone to boredom in quiet areas
- Corruption manifests as: violence, false arrests, harassment

**Investigators**:
- Station-based, don't patrol
- Solve reported crimes after the fact
- Improve "solved crime" rate
- Take 1-2 days to solve cases
- Corruption manifests as: false evidence, biased arrests, dropped cases for bribes

**Auditors** (Special Crimes Unit):
- Station-based, focus on white-collar crime
- Detect financial crimes (embezzlement, fraud)
- Rarely interact with public
- Corruption manifests as: embezzlement, overlooking crimes, protection rackets

### Warden Attributes

**Static**:
- ID number
- Citizen ID (which civilian became this Warden)
- Type (Street/Investigator/Auditor)

**Dynamic** (hidden from player):
- Position (Street only)
- Patrol Radius (Street only): 1, 2, or 3
- Corruption Level: 0-100
- Days Employed
- Incidents Handled
- Corrupt Actions Log: Array of specific actions taken

### Corruption Mechanics

**Corruption Increases**:
- Base rate: +5 per day employed
- **Street Wardens**:
  - Low activity area (boredom): +10 per day
  - High activity area (burnout): +8 per day
  - Optimal activity (moderate): +5 per day
- **Investigators**:
  - High caseload: +6 per day
  - Low caseload: +7 per day
- **Auditors**:
  - Access to money: +8 per day (temptation)
  - Low oversight: +10 per day

**Inherited Corruption**:
- When recruiting from civilian population, citizen's Corruption level transfers
- Hostile, corrupted citizen becomes corrupt Warden immediately
- Creates feedback loop: over-policing corrupts citizens who become corrupt Wardens

**Corruption Manifestations**:

*Street Wardens (>30 corruption)*:
- Excessive force during arrests
- Harassment for minor infractions
- Planting evidence
- Theft during searches
- False arrests to boost stats

*Investigators (>30 corruption)*:
- Fabricating evidence
- Bias in case selection
- Framing suspects
- Accepting bribes to drop cases

*Auditors (>30 corruption)*:
- Embezzling funds
- Overlooking crimes (protection rackets)
- Falsifying reports
- Insider trading

### Placement & Assignment

**Street Wardens**:
- Player places on grid
- Selects patrol radius (1, 2, or 3)
- Larger radius = more coverage but less effectiveness per square

**Investigators & Auditors**:
- Assigned to station (no grid placement)
- Player sets number of each type
- Work automatically on cases/crimes in their domain

---

## Budget System

### Budget Slider
- **Range**: 5% to 100% (adjustable in 5% increments)
- **Starting**: 25% (5 Wardens on Day 1)
- **Formula**: Each 5% = 1 additional Warden
  - 5% = 1 Warden
  - 25% = 5 Wardens
  - 50% = 10 Wardens
  - 100% = 20 Wardens

### Budget Impact on Town

**Town Services Quality** (inverse to budget):

**25-40% budget**:
- Full services operational
- Citizens content with infrastructure
- No operational notes

**45-60% budget**:
- Minor service reductions
- "Park maintenance delayed this week"
- "Library reduced hours"
- Slight Trust erosion (-1 per day)

**65-80% budget**:
- Significant service cuts
- "Community center closed due to funding"
- "Public transit weekend-only"
- "Hospital ER understaffed"
- Moderate Trust erosion (-3 per day)
- Corruption increases (+2 per day for all citizens)

**85-100% budget**:
- Critical services failing
- "Food bank permanently closed"
- "Schools consolidating classes - teacher shortage"
- "Road repairs suspended indefinitely"
- Severe Trust erosion (-5 per day)
- High Corruption increase (+5 per day for all citizens)
- Citizen unhappiness visible in increased crime despite heavy Watch presence

---

## Crime System

### Crime Types

**Street Crimes** (handled by Street Wardens):
- **Assault**: Trust-based, increases with low Trust
- **Theft**: Opportunity-based, increases with Corruption
- **Vandalism**: Often targets Watch property in over-policed areas
- **Drug-related**: Increases with Corruption and poor services
- **Harassment** (Warden-generated): Corrupt Wardens in quiet areas
- **Traffic violations** (Warden-generated): Corrupt Wardens manufacturing incidents

**Investigative Crimes** (handled by Investigators):
- **Murder**: Rare, requires investigation
- **Kidnapping**: Rare, serious investigation
- **Robbery**: Requires detective work to solve
- **Assault with serious injury**: Follow-up investigation

**White-Collar Crimes** (handled by Auditors):
- **Embezzlement**: Increases with poor oversight
- **Fraud**: Increases in business districts
- **Tax evasion**: Always present at low level
- **Corruption** (ironic): Can detect Warden corruption if Auditors aren't corrupt

### Crime Generation

**Base Crime Rate**:
- Each citizen has daily crime chance based on Corruption level
- Each grid square has crime density modifier (0.2, 0.5, 0.8)
- Combined: `citizenCorruption * gridDensity = crime probability`

**Time of Day**:
- Crimes assigned random times for flavor
- Day crimes (9am-5pm): Commercial areas, office crimes
- Night crimes (10pm-4am): Residential, street crimes
- Used in reporting only, doesn't affect mechanics

**Crime Distribution by Area**:
- **Low-density areas** (affluent): Rare natural crime, but Warden-generated if patrolled
- **Medium-density areas** (middle-class): Moderate crime, balanced
- **High-density areas** (poor): Frequent crime, visible and reported

### Crime Resolution

**Street Crimes**:
1. **Prevented**: Street Warden in patrol zone, visible deterrent (30% chance)
2. **Responded**: Crime occurs, Street Warden arrives and resolves (50% chance if in zone)
3. **Reported**: No Warden available, citizen reports (based on Trust)
4. **Unreported**: No Warden, citizen doesn't report (low Trust or no hope)

**Investigative Crimes**:
1. Crime occurs and gets reported (or discovered)
2. Assigned to Investigator automatically
3. Takes 1-3 days to solve based on:
   - Investigator workload
   - Investigator corruption (corrupt = faster but wrong person)
   - Crime severity

**White-Collar Crimes**:
1. Crime occurs (often hidden)
2. Auditor has chance to detect based on:
   - Number of Auditors
   - Auditor corruption (corrupt = overlook it)
   - Crime value (larger = more detectable)

**Corrupt Warden Resolution**:
- Corrupt Wardens still "solve" crimes
- But solutions are often: false arrests, excessive force, evidence planting
- Stats look good, but Trust erodes faster
- Creates illusion of success masking systemic failure

### Reporting Likelihood

Citizen reports crime based on:
- **Trust Level**: Neighborhood Watch (95%), Trusting (80%), Neutral (50%), Wary (20%), Hostile (5%)
- **Warden Proximity**: Too close = -20% (feel watched), moderate = +10% (feel safe)
- **Crime Severity**: Murder (always reported eventually), theft (maybe not)

**Unreported Crime Problem**:
- High Watch presence → low Trust → low reporting
- Player goes blind in heavily policed areas
- Thinks crime is down, but it's just hidden
- Creates false sense of success

---

## Grid System

### Size & Structure
- **15x15 grid** = 225 squares
- **Squares represent**: ~1 city block
- **Visual**: Clean geometric grid, Mini Metro aesthetic

### Crime Density Distribution

**Generated at game start**:
- **60-80 squares (Low density 0.2)**: Affluent residential, parks, office complexes
- **100-120 squares (Medium density 0.5)**: Middle-class areas, mixed-use, shopping
- **45-65 squares (High density 0.8)**: Poor residential, industrial, entertainment districts

**Density Effects**:
- Affects base crime generation rate
- Affects how quickly citizens' Corruption increases
- Affects reporting behavior (high-density = more witnesses)

### Implied Zones (Emergent, Not Labeled)

Players discover through play:
- **Northwest quadrant**: Tends affluent, low crime
- **Southwest quadrant**: Tends poor, high crime
- **Center**: Mixed-use, moderate crime
- **East side**: Commercial/office, day activity

No explicit labels, players learn through pattern recognition.

---

## Daily Report System

### Report Structure

Appears at start of each day (after simulation):

```
DAY X INCIDENT REPORT

CRIME SUMMARY
- Crimes Prevented: X
- Crimes Responded: X
- Crimes Solved: X (by Investigators)
- Crimes Reported (Unsolved): X
- Estimated Unreported: X-X

WATCH DEPLOYMENT
- Street Wardens: X (positions listed)
- Investigators: X
- Auditors: X
- Budget Allocation: X%

NOTABLE INCIDENTS
[3-5 specific incidents with details]
- "Assault at Grid D4, 2:34pm - Street Warden #3 responded, suspect arrested"
- "Anonymous tip led to drug bust in Grid F7"
- "Robbery at Grid C2 - Under investigation by Investigator #2"

CITIZEN FEEDBACK
[Indicators of Trust without explicitly showing it]
- "Multiple complaints filed regarding Warden conduct in residential areas"
- "Neighborhood watch reported suspicious activity in Grid H8"
- "No witnesses came forward for incident in Grid B3"

OPERATIONAL NOTES
[Budget impact on town services]
- "Library reduced to weekend-only hours"
- "3 businesses report difficulty finding workers"
- "Community center programs suspended"

BUDGET STATUS
- Current allocation: X%
- Cost: $X,XXX per day
- Funds available for adjustment
```

### Report Transparency

**What Player Sees**:
- Crime statistics (prevented/responded/solved/reported)
- Estimated unreported (intentionally vague range)
- Notable incidents with locations
- Indirect Trust indicators
- Budget impact hints

**What Player Doesn't See**:
- Actual unreported crime count
- Citizen happiness scores
- Trust levels
- Corruption levels
- Which "solved" crimes were false arrests
- Full extent of Warden corruption

---

## Decision Points

### Frequency
- 0-2 prompts per day (not every day)
- Appear after report, before placement phase
- Force player to make judgment calls

### Types of Decisions

**Discipline Decisions**:
*"Warden #5 used excessive force during traffic stop. Citizen filed complaint. Your response?"*
- Discipline Warden (lowers morale, might not reduce corruption)
- Defend Warden (protects them, signals corruption is okay)
- Investigate further (costs time, might reveal nothing)

**Petition Decisions**:
*"Citizens in Grid G4-G6 petition for increased Watch presence due to crime concerns. Respond?"*
- Approve (assign Warden there, might over-police)
- Deny (save resources, citizens feel ignored)
- Compromise (partial response)

**Budget Surplus**:
*"Budget surplus available. Allocate funds?"*
- Hire additional Warden
- Invest in community programs (reduces crime, improves Trust, not visible in stats)
- Save for later (no immediate effect)

**Incident Response**:
*"Major crime in Grid C8. Witnesses describe Warden violence during arrest. Statement?"*
- Public statement defending Watch (protects reputation, emboldens corruption)
- Promise investigation (costs resources, might help Trust)
- No comment (neutral)

### Decision Impact

**Immediate**:
- Change in citizen Trust
- Change in Warden behavior
- Budget allocation

**Long-term**:
- Sets precedent for future incidents
- Affects how citizens view Watch authority
- Influences Warden corruption rates

**Hidden**:
- Player doesn't see exact impact
- Creates uncertainty and moral weight
- Reflects real complexity of these decisions

---

## Map Interaction

### During Placement Phase

**Street Wardens**:
- Drag Warden to new position
- Click to select, click grid to place
- Adjust patrol radius (1, 2, or 3)
- Blue overlay shows coverage

**Station Wardens**:
- Can't move (always at station)
- Can adjust count (hire/dismiss not supported in MVG, but full game allows hiring)

### During Report Phase

**Crime Visualization**:
- Red dots on squares where crimes occurred
- Click dot for details: type, time, status, Warden involvement
- Multiple crimes = clustered dots or count badge

**Warden Visualization**:
- Blue zones show where Wardens patrolled
- Click Warden for activity log: incidents handled, response times
- Overlapping zones visible (saturation indicates over-policing)

**Pattern Recognition**:
- High crime in unpatrolled areas (obvious)
- High crime in heavily patrolled areas (surprising, indicates corruption/retaliation)
- Low crime with no reports (Trust erosion, hidden crimes)

---

## Independent Audit (Final Review)

### Trigger
After Day 14:
1. Day 14 Report displays normally
2. Button appears: "View Independent Audit Results"
3. Click to see final review (no return)

### Audit Calculation

**Metrics Revealed**:

**Crime Performance**:
- Reported crimes total
- Actual crimes total  
- Unreported crimes total (the gap)
- Crimes solved vs falsely solved

**Citizen Happiness** (0-100 scale):
- Base: 100
- Watch Exposure penalty: -1 per Warden-day in citizen's area
- Trust erosion penalty: -20 per trust level drop from starting
- Corrupt action penalty: -5 per witnessed corrupt action
- Service degradation penalty: -1 to -10 per day based on budget
- Clamp to 0-100

**Trust Distribution**:
- Count of citizens at each Trust level
- Graph/chart showing breakdown

**Warden Corruption**:
- Each Warden's corruption level revealed
- Specific corrupt actions listed with descriptions
- Total corrupt incidents across all Wardens

**Classification** (based on metrics):
- **Balanced Community** (happiness >70, crime managed reasonably)
- **Authoritarian Success** (crime very low, happiness <40)
- **Police State** (happiness <30, high Watch presence)
- **Negligent Administration** (crime very high, low Watch presence)
- **Corrupted System** (high Warden corruption, false arrests common)
- **Failed State** (everything bad: crime high, happiness low, corruption rampant)

### Audit Display

```
INDEPENDENT AUDIT RESULTS

PERFORMANCE SUMMARY
Your administration prioritized crime reduction through heavy 
Watch presence. While reported crime decreased, citizen 
happiness declined by 45% over 14 days.

CRIME STATISTICS
- Crimes You Reported: 87
- Actual Crimes Committed: 213
- Unreported/Hidden Crimes: 126
- False Arrests: 34

CITIZEN HAPPINESS: 32/100
Average happiness score across all 100 citizens.

TRUST BREAKDOWN
- Neighborhood Watch: 3 citizens
- Trusting: 12 citizens
- Neutral: 25 citizens
- Wary: 38 citizens
- Hostile: 22 citizens

WARDEN CORRUPTION INCIDENTS
Warden #3 (Street): Corruption Level 78
  - 12 uses of excessive force
  - 5 false arrests
  - 8 harassment citations
  - 3 evidence planting incidents

Warden #7 (Investigator): Corruption Level 65
  - 7 cases closed with fabricated evidence
  - 4 instances of accepting bribes
  - 2 wrongful convictions

[... continues for all Wardens ...]

CLASSIFICATION: AUTHORITARIAN FAILURE

While crime statistics improved in your reports, the Watch 
created an oppressive environment where citizens fear both 
criminals and the Wardens meant to protect them. Over-policing 
eroded community trust, leading to unreported crimes and a 
population living under constant surveillance. The Watch 
themselves became corrupted, committing violence and injustice 
in the name of order.

RECOMMENDATIONS
A lighter Watch presence with community investment would have 
maintained both safety and quality of life. Security without 
freedom is not safety—it is control.
```

---

## Win Conditions (Hidden)

### Optimal Strategy (Discovered Through Play)

**Budget**: 35-45% (7-9 Wardens)
**Placement**: Strategic, not blanket coverage
**Distribution**: 
- 5-6 Street Wardens in actual high-crime areas
- 2 Investigators for follow-up
- 1 Auditor for white-collar oversight

**Outcomes**:
- Moderate visible crime (accepted as cost of freedom)
- High citizen happiness (60-75)
- Low Warden corruption (stayed under 30)
- High reporting rate (Trust maintained)
- Balanced classification

**Player realizes**: Less is more, trust matters more than force.

### Failure States (Common)

**Over-Policing**:
- 80%+ budget
- 15+ Wardens
- Blanket coverage
- Result: Low crime stats, happiness <40, "Police State"

**Under-Policing**:
- <20% budget
- 3-4 Wardens
- Minimal coverage
- Result: High crime, low happiness, "Negligent"

**Misplaced**:
- All Wardens in affluent areas (political pressure)
- Ignoring actual high-crime zones
- Result: Crime persists, corruption grows, "Failed State"

---

## Replayability

### Factors Encouraging Replay

**Randomization**:
- Citizen attributes randomized each game
- Crime density distribution varies
- Specific crime events unpredictable

**Strategy Variation**:
- "What if I used fewer Wardens?"
- "What if I focused only on high-crime areas?"
- "What if I invested in Investigators over Street Wardens?"

**Classification Goals**:
- Try to achieve each classification
- Optimize for highest happiness
- Experiment with extreme strategies

**Short Duration**:
- 14 days feels manageable
- Can complete in one sitting
- Low time investment for retry

---

## Narrative & Theme

### Core Message
Authority without accountability corrupts. Surveillance creates the behavior it claims to prevent. Community trust is more valuable than control.

### Player Journey

**Days 1-4**: Experimentation
- Trying different placements
- Learning systems
- Seeing initial results

**Days 5-9**: Optimization
- Patterns emerge
- Strategy solidifies
- Feeling like "I've got this"

**Days 10-14**: Doubt
- Cracks appear
- Complaints increase
- Stats look good but something feels wrong

**Audit**: Revelation
- "Oh no, what have I done?"
- Recontextualizes everything
- Urge to try again with new understanding

### Emotional Beats

**Training Day**: Confidence, clarity
**Early Days**: Curiosity, engagement
**Mid Game**: Control, mastery
**Late Game**: Confusion, concern
**Audit**: Shock, reflection, understanding

---

## Out of Scope for Full Game

These features are interesting but not essential:

- Real-time crime response (stays turn-based)
- Individual citizen stories/narratives
- Detailed economic simulation
- Political pressure mechanics (implied only)
- Multiple towns or scenarios
- Multiplayer or comparison features
- Difficulty settings (one balanced experience)

Focus remains: strategic placement, resource allocation, pattern recognition, moral revelation.
