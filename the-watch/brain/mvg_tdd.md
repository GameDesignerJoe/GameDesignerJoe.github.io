# The Watch - MVG Technical Design Document

## Tech Stack
- **Framework**: React (artifact-compatible)
- **Styling**: Tailwind CSS
- **State Management**: React useState/useReducer
- **No Backend**: All simulation client-side
- **No External APIs**: Self-contained application

---

## Architecture Overview

```
GameController (main component)
├── GameState (centralized state management)
├── MapView (grid display)
│   ├── GridSquare (individual cell)
│   ├── WardenMarker (blue patrol zones)
│   └── CrimeMarker (red dots after day runs)
├── ControlPanel (warden placement controls)
├── DayTransition (animation screen)
├── IncidentReport (daily stats)
└── IndependentAudit (final review)
```

---

## Data Structures

### GameState
```javascript
{
  currentDay: 1-3,
  phase: "placement" | "transition" | "report" | "audit",
  citizens: Citizen[],
  wardens: Warden[],
  grid: GridSquare[],
  dailyReports: Report[],
  finalAudit: AuditData | null
}
```

### Citizen
```javascript
{
  id: number,
  homeLocation: {x: number, y: number},
  trustLevel: "trusting" | "neutral" | "wary" | "hostile",
  watchExposure: number, // cumulative
  isWarden: boolean,
  wardenId: number | null // if isWarden = true
}
```

### Warden
```javascript
{
  id: number,
  citizenId: number, // which citizen became this warden
  position: {x: number, y: number},
  patrolRadius: 1, // fixed for MVG
  corruptionLevel: number, // 0-100, hidden
  daysEmployed: number,
  incidentsHandled: number,
  corruptActions: CorruptAction[] // logged for audit
}
```

### GridSquare
```javascript
{
  x: number,
  y: number,
  crimeDensity: number, // 0.2, 0.5, or 0.8
  crimes: Crime[] // crimes that occurred here
}
```

### Crime
```javascript
{
  id: number,
  location: {x: number, y: number},
  timeOfDay: string, // "2:34pm" for flavor
  type: "assault" | "theft" | "vandalism" | "harassment" | "traffic",
  status: "prevented" | "responded" | "reported" | "unreported",
  wardenResponder: number | null,
  isWardenGenerated: boolean // if corrupt warden created it
}
```

### Report
```javascript
{
  day: number,
  crimesPrevented: number,
  crimesResponded: number,
  crimesReported: number,
  estimatedUnreported: {min: number, max: number},
  notableIncidents: string[], // 2-4 descriptive strings
  wardenDeployment: {id: number, position: {x, y}}[]
}
```

### AuditData
```javascript
{
  reportedCrimesTotal: number,
  actualCrimesTotal: number,
  unreportedCrimesTotal: number,
  averageHappiness: number, // 0-100
  trustDistribution: {
    trusting: number,
    neutral: number,
    wary: number,
    hostile: number
  },
  wardenCorruption: {
    wardenId: number,
    corruptionLevel: number,
    actions: string[] // descriptive list
  }[],
  classification: string // "Police State", "Balanced", etc.
}
```

---

## Core Systems

### 1. Initialization System
**Purpose**: Set up game on mount

**Process**:
1. Generate 5x5 grid with random crime density distribution
   - 5-8 squares at 0.2 (low)
   - 12-15 squares at 0.5 (medium)
   - 5-8 squares at 0.8 (high)
2. Create 10 citizens with random home locations
   - All start at "trusting" trust level
   - watchExposure = 0
   - 8 civilians, 2 wardens
3. Initialize 2 Wardens from citizen pool
   - Select 2 random citizens, set isWarden = true
   - Create Warden objects at default positions (player will move)
   - corruptionLevel = 0
4. Show opening text modal

**Functions**:
```javascript
initializeGrid(): GridSquare[]
initializeCitizens(): Citizen[]
initializeWardens(citizens: Citizen[]): Warden[]
```

---

### 2. Placement System
**Purpose**: Allow player to position Wardens

**Interactions**:
- Click Warden → select it (highlight)
- Click grid square → move selected Warden there
- Visual: Show 3x3 blue overlay for patrol zone
- Validation: Can't place two Wardens on same square

**Functions**:
```javascript
selectWarden(wardenId: number): void
moveWarden(wardenId: number, position: {x, y}): void
getPatrolZone(position: {x, y}, radius: number): {x, y}[]
```

---

### 3. Simulation System
**Purpose**: Run one day of activity

**Triggered by**: "Run Day X" button

**Process**:
1. **Crime Generation**
   - For each citizen: calculate crime probability based on trustLevel
   - For each grid square: generate crimes based on crimeDensity
   - Assign random time of day to each crime
   - Determine if citizen reports crime (based on trust + warden proximity)

2. **Crime Resolution**
   - For each crime, check if Warden patrol zone covers location
   - If covered: random chance to prevent (higher with low corruption)
   - If not prevented but covered: respond (mark as responded)
   - If not covered but high trust area: mark as reported
   - If not covered and low trust: mark as unreported

3. **Warden Corruption Increase**
   - Increment corruption based on:
     - Days employed (+5 base)
     - Activity level in zone (+0 to +15 based on incidents)
     - Boredom/burnout calculation

4. **Warden-Generated Incidents**
   - Corrupted Wardens (>30 corruption) create fake incidents
   - More common in low-crime areas
   - Types: harassment, traffic violations
   - Count as "responded" in stats

5. **Citizen Trust Updates**
   - Citizens in heavily patrolled areas: trust decreases
   - Citizens who were crime victims with no response: trust decreases more
   - Crime victims with good response: trust increases slightly
   - Citizens exposed to corrupt Warden actions: trust decreases

6. **Generate Daily Report**
   - Count crimes by status
   - Estimate unreported range (actual * 0.8 to actual * 1.2)
   - Select 2-4 notable incidents for flavor text
   - Store report for display

**Functions**:
```javascript
simulateDay(gameState: GameState): GameState
generateCrimes(citizens: Citizen[], grid: GridSquare[]): Crime[]
resolveCrimes(crimes: Crime[], wardens: Warden[]): Crime[]
updateWardenCorruption(wardens: Warden[], crimes: Crime[]): Warden[]
updateCitizenTrust(citizens: Citizen[], wardens: Warden[], crimes: Crime[]): Citizen[]
generateReport(day: number, crimes: Crime[], wardens: Warden[]): Report
```

---

### 4. Report System
**Purpose**: Display daily statistics

**Data Shown**:
- Crime summary stats (prevented/responded/reported/unreported estimate)
- Warden deployment positions
- 2-4 notable incidents with flavor text

**Interaction**:
- Read report
- Return to map (placement phase for next day)

**Functions**:
```javascript
generateNotableIncidents(crimes: Crime[], count: number): string[]
formatReport(report: Report): JSX.Element
```

---

### 5. Audit System
**Purpose**: Calculate and display final truth

**Triggered by**: After Day 3 report, click "View Independent Audit Results"

**Calculations**:
1. **Happiness Score**: 
   - Base 100
   - -15 per Warden per citizen in their patrol zone
   - -20 per trust level drop from "trusting"
   - -30 per corrupt action witnessed
   - Clamp to 0-100

2. **Classification**:
   - avgHappiness > 70 && reportedCrimes < 15: "Balanced Community"
   - avgHappiness < 40: "Police State"
   - reportedCrimes > 20 && avgHappiness > 60: "Negligent Administration"
   - Default: "Authoritarian Failure"

3. **Corruption Details**:
   - List each Warden's corrupt actions with descriptions
   - Count total incidents by type

**Functions**:
```javascript
calculateAudit(gameState: GameState): AuditData
calculateHappiness(citizens: Citizen[], wardens: Warden[]): number
classifyPerformance(audit: AuditData): string
formatCorruptionActions(warden: Warden): string[]
```

---

## Component Structure

### GameController
**Responsibilities**:
- Manages global game state
- Orchestrates phase transitions
- Handles "Run Day" button
- Renders current phase component

```javascript
const GameController = () => {
  const [gameState, setGameState] = useState(initializeGame());
  
  const handleRunDay = () => {
    // 1. Set phase to "transition"
    // 2. After 2s, run simulation
    // 3. Set phase to "report"
  };
  
  return (
    <>
      {phase === "intro" && <IntroModal />}
      {phase === "placement" && <PlacementView />}
      {phase === "transition" && <DayTransition day={currentDay} />}
      {phase === "report" && <IncidentReport />}
      {phase === "audit" && <IndependentAudit />}
    </>
  );
};
```

---

### MapView
**Responsibilities**:
- Render 5x5 grid
- Show Warden patrol zones (blue overlay)
- Show crime markers (red dots) after day runs
- Handle click interactions for placement

```javascript
const MapView = ({grid, wardens, crimes, onSquareClick, phase}) => {
  return (
    <div className="grid grid-cols-5 gap-1">
      {grid.map(square => (
        <GridSquare 
          key={`${square.x}-${square.y}`}
          square={square}
          wardens={wardens}
          crimes={crimes}
          onClick={() => onSquareClick(square.x, square.y)}
          showCrimes={phase === "report"}
        />
      ))}
    </div>
  );
};
```

---

### GridSquare
**Responsibilities**:
- Render single cell
- Show blue overlay if in patrol zone
- Show red dot if crime occurred here
- Handle click for details

```javascript
const GridSquare = ({square, wardens, crimes, onClick, showCrimes}) => {
  const isPatrolled = checkIfPatrolled(square, wardens);
  const hasCrimes = showCrimes && crimes.filter(c => 
    c.location.x === square.x && c.location.y === square.y
  ).length > 0;
  
  return (
    <div 
      className={`
        aspect-square border border-gray-300 
        ${isPatrolled ? 'bg-blue-100' : 'bg-gray-50'}
        ${hasCrimes ? 'relative' : ''}
      `}
      onClick={onClick}
    >
      {hasCrimes && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
    </div>
  );
};
```

---

### IncidentReport
**Responsibilities**:
- Display daily report data
- Format stats and notable incidents
- Button to continue to next day (or audit if Day 3)

```javascript
const IncidentReport = ({report, day, onContinue}) => {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Day {day} Incident Report</h2>
      
      <section className="mb-6">
        <h3 className="text-lg font-semibold">Crime Summary</h3>
        <ul>
          <li>Crimes Prevented: {report.crimesPrevented}</li>
          <li>Crimes Responded: {report.crimesResponded}</li>
          <li>Crimes Reported: {report.crimesReported}</li>
          <li>Estimated Unreported: {report.estimatedUnreported.min}-{report.estimatedUnreported.max}</li>
        </ul>
      </section>
      
      <section className="mb-6">
        <h3 className="text-lg font-semibold">Notable Incidents</h3>
        <ul>
          {report.notableIncidents.map((incident, i) => (
            <li key={i} className="text-sm">{incident}</li>
          ))}
        </ul>
      </section>
      
      <button onClick={onContinue} className="px-4 py-2 bg-blue-600 text-white rounded">
        {day === 3 ? "View Independent Audit Results" : "Continue to Day " + (day + 1)}
      </button>
    </div>
  );
};
```

---

### IndependentAudit
**Responsibilities**:
- Display final audit results
- Show hidden metrics (happiness, trust, corruption)
- Reveal classification and commentary

```javascript
const IndependentAudit = ({auditData}) => {
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6">Independent Audit Results</h1>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold">Citizen Happiness</h2>
        <p className="text-3xl font-bold">{auditData.averageHappiness}/100</p>
      </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold">Trust Distribution</h2>
        {/* Chart or list */}
      </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold">Warden Corruption</h2>
        {auditData.wardenCorruption.map(wc => (
          <div key={wc.wardenId}>
            <h3>Warden #{wc.wardenId}</h3>
            <ul>
              {wc.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold">Classification</h2>
        <p className="text-2xl font-bold text-red-600">{auditData.classification}</p>
      </section>
    </div>
  );
};
```

---

## Visual Design Guidelines

**Aesthetic**: Minimalist, clean, inspired by Mini Metro
- Simple geometric shapes
- Limited color palette: blues (Wardens), reds (crime), grays (neutral)
- Sans-serif typography
- Ample whitespace
- Smooth transitions

**Grid Design**:
- Equal-sized squares with subtle borders
- Blue wash for patrol zones (low opacity overlay)
- Small red dots for crimes (positioned in corner of square)
- Warden icons: simple blue circles or shields

**Transitions**:
- "Day X" text: fade in, hold 1.5s, fade out
- Between phases: smooth 300ms opacity transitions

---

## Scalability Considerations

### Designed for Expansion

**State Structure**: 
- All game parameters (grid size, warden count, day count) should be constants at top of file
- Easy to change `GRID_SIZE = 5` to `GRID_SIZE = 15` for full game

**Modular Systems**:
- Simulation logic separated from UI
- Crime generation can be enhanced with more types
- Warden system can be extended with types (Investigators, Auditors)

**Data Models**:
- Citizen and Warden objects have room for additional properties
- Crime types can be expanded without breaking existing logic

**Component Architecture**:
- MapView can handle any grid size
- Report system can accommodate more data fields
- Audit system can include additional metrics

### What Changes for Full Game

**Constants to Adjust**:
```javascript
// MVG
const GRID_SIZE = 5;
const CITIZEN_COUNT = 10;
const STARTING_WARDENS = 2;
const TOTAL_DAYS = 3;

// Full Game
const GRID_SIZE = 15;
const CITIZEN_COUNT = 100;
const STARTING_WARDENS = 5;
const TOTAL_DAYS = 14;
```

**Systems to Add**:
- Budget slider component
- Hiring interface
- Variable patrol radius selection
- Training day
- Warden type selection
- More sophisticated crime generation
- Complaint tracking

---

## Performance Considerations

**MVG Scale**:
- 25 grid squares
- 10 citizens
- ~5-10 crimes per day
- Negligible performance concerns

**Full Game Scale**:
- 225 grid squares
- 100 citizens
- ~50-100 crimes per day
- Should still run smoothly, but consider:
  - Memoizing expensive calculations
  - Virtualized grid rendering if needed
  - Debouncing interactions

---

## Testing Strategy

**Manual Testing Focus**:
1. **Placement**: Can move Wardens, patrol zones display correctly
2. **Simulation**: Crimes generate, get resolved appropriately
3. **Trust/Corruption**: Citizens and Wardens change over time
4. **Reports**: Stats calculate correctly
5. **Audit**: Final numbers match accumulated data
6. **Edge Cases**: 
   - All Wardens in one corner (rest of town unpatrolled)
   - No Wardens moved (default positions)
   - Overlapping patrol zones

**Key Metrics to Verify**:
- Crime count consistency (generated = prevented + responded + reported + unreported)
- Trust degradation visible in behavior changes
- Corruption manifests in both stats and actions
- Happiness calculation reflects gameplay choices

---

## File Structure

```
/src
  /components
    GameController.jsx
    MapView.jsx
    GridSquare.jsx
    WardenMarker.jsx
    CrimeMarker.jsx
    ControlPanel.jsx
    DayTransition.jsx
    IncidentReport.jsx
    IndependentAudit.jsx
    IntroModal.jsx
  /systems
    initialization.js
    simulation.js
    crime.js
    warden.js
    citizen.js
    audit.js
  /utils
    constants.js
    calculations.js
    formatting.js
  /types
    types.js (or types.d.ts if using TypeScript)
  App.jsx
  index.css (Tailwind)
```

---

## Development Notes

**Priority**: Get the simulation working first
- Initialization and placement can be simple
- Focus on crime generation and resolution logic
- Ensure corruption and trust changes feel meaningful

**Iteration**: Start with console logging
- Log each day's simulation results to verify logic
- Add UI once core systems work

**Polish Last**: 
- Transitions and animations after gameplay works
- Flavor text for incidents once templates established
- Visual refinement when mechanics proven
