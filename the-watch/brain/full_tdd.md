# The Watch - Full Game Technical Design Document

## Tech Stack
- **Framework**: React (artifact-compatible initially, can migrate to standalone)
- **Styling**: Tailwind CSS
- **State Management**: React useReducer for complex state
- **Persistence**: localStorage for save/load (optional enhancement)
- **No Backend**: All simulation client-side
- **No External APIs**: Self-contained application

---

## Architecture Overview

```
GameController (main orchestrator)
├── GameState (centralized state via useReducer)
├── TrainingDay (tutorial flow)
├── MapView (grid display & interaction)
│   ├── GridSquare (individual cell)
│   ├── WardenMarker (Street Wardens with patrol zones)
│   ├── CrimeMarker (red dots after day runs)
│   └── StationDisplay (Investigators & Auditors)
├── ControlPanel (budget slider, warden management)
│   ├── BudgetSlider (5-100% allocation)
│   ├── WardenList (hire/manage wardens)
│   └── RunDayButton
├── DecisionPrompt (mid-turn decisions)
├── DayTransition (animation screen)
├── IncidentReport (daily stats & details)
└── IndependentAudit (final review)
```

---

## Data Structures

### GameState (Enhanced)
```javascript
{
  // Core progression
  currentDay: 0-14, // 0 = training day
  phase: "training" | "placement" | "decision" | "transition" | "report" | "audit",
  isTrainingComplete: boolean,
  
  // Population
  citizens: Citizen[], // 100 total
  wardens: Warden[], // subset of citizens
  
  // Map
  grid: GridSquare[], // 225 squares (15x15)
  
  // Budget
  budgetPercentage: 5-100, // in 5% increments
  availableWardenSlots: number, // calculated from budget
  
  // Records
  dailyReports: Report[], // one per day
  pendingDecisions: Decision[], // 0-2 per day
  finalAudit: AuditData | null,
  
  // UI state
  selectedWardenId: number | null,
  selectedCrimeId: number | null
}
```

### Citizen (Enhanced)
```javascript
{
  id: number,
  homeLocation: {x: number, y: number},
  workLocation: {x: number, y: number},
  
  // Trust system
  trustLevel: "neighborhood_watch" | "trusting" | "neutral" | "wary" | "hostile",
  trustScore: number, // 0-100, maps to level
  
  // Corruption system
  corruptionLevel: "law_abiding" | "opportunistic" | "habitual" | "criminal",
  corruptionScore: number, // 0-100, maps to level
  
  // Tracking
  watchExposure: number, // cumulative days in patrol zones
  daysAsVictim: number,
  daysWithNoResponse: number,
  
  // Warden status
  isWarden: boolean,
  wardenId: number | null,
  
  // History (for audit)
  trustHistory: number[], // score per day
  experiencedCorruptActions: string[] // descriptions of what they witnessed
}
```

### Warden (Enhanced)
```javascript
{
  id: number,
  citizenId: number,
  type: "street" | "investigator" | "auditor",
  
  // Placement (street only)
  position: {x: number, y: number} | null,
  patrolRadius: 1 | 2 | 3 | null, // null for non-street
  
  // Performance tracking
  daysEmployed: number,
  incidentsHandled: number,
  crimesInZone: number, // activity level
  
  // Corruption
  corruptionLevel: number, // 0-100
  inheritedCorruption: number, // from citizen when hired
  
  // Audit trail
  corruptActions: CorruptAction[],
  
  // Investigator-specific
  activeCases: Case[] | null,
  solvedCases: number | null,
  
  // Auditor-specific
  whiteColarDetected: number | null
}
```

### CorruptAction
```javascript
{
  day: number,
  type: "excessive_force" | "false_arrest" | "harassment" | "planting_evidence" | 
        "fabricated_evidence" | "bribery" | "embezzlement" | "overlooked_crime",
  location: {x: number, y: number} | null,
  description: string, // human-readable for audit
  affectedCitizenIds: number[] // who witnessed/experienced it
}
```

### GridSquare (Enhanced)
```javascript
{
  x: number,
  y: number,
  crimeDensity: number, // 0.2, 0.5, or 0.8
  
  // Daily tracking
  crimes: Crime[],
  wardensPresent: number[], // Warden IDs in patrol range
  citizensPresent: number[], // Citizens who live/work here
  
  // Visual state
  isHighlighted: boolean, // UI interaction
  patrolCoverage: number // 0-3, how many wardens cover this
}
```

### Crime (Enhanced)
```javascript
{
  id: number,
  day: number,
  location: {x: number, y: number},
  timeOfDay: string, // "9:15am", "11:43pm"
  
  type: "assault" | "theft" | "vandalism" | "drug" | "harassment" | "traffic" |
        "murder" | "kidnapping" | "robbery" | "serious_assault" |
        "embezzlement" | "fraud" | "tax_evasion",
  
  category: "street" | "investigative" | "white_collar",
  
  status: "prevented" | "responded" | "solved" | "reported" | "unreported",
  
  // Resolution tracking
  wardenResponder: number | null,
  responseTime: number | null, // minutes (for flavor)
  
  // Truth tracking
  isWardenGenerated: boolean, // corrupt warden created it
  isFalseArrest: boolean, // solved but wrong person
  
  // Investigative crimes
  assignedInvestigator: number | null,
  daysToSolve: number | null,
  
  // Impact
  victimCitizenId: number | null,
  witnessIds: number[] // citizens who saw it
}
```

### Case (for Investigators)
```javascript
{
  crimeId: number,
  investigatorId: number,
  startDay: number,
  daysRequired: number, // 1-3 based on severity
  isCorruptResolution: boolean // will it be false arrest?
}
```

### Report (Enhanced)
```javascript
{
  day: number,
  
  // Crime stats
  crimesPrevented: number,
  crimesResponded: number,
  crimesSolved: number,
  crimesReported: number,
  estimatedUnreported: {min: number, max: number},
  
  // Deployment
  budgetPercentage: number,
  streetWardens: {id: number, position: {x, y}, radius: number}[],
  investigators: number,
  auditors: number,
  
  // Narrative elements
  notableIncidents: string[], // 3-5 descriptions
  citizenFeedback: string[], // 1-3 trust indicators
  operationalNotes: string[], // 0-3 budget impact notes
  
  // Hidden truth (for audit comparison)
  actualUnreported: number,
  falseArrests: number,
  corruptActionsThisDay: number
}
```

### Decision
```javascript
{
  id: number,
  day: number,
  type: "discipline" | "petition" | "budget_surplus" | "incident_response",
  prompt: string, // question text
  options: DecisionOption[],
  selectedOption: number | null // index of chosen option
}
```

### DecisionOption
```javascript
{
  text: string, // button text
  impact: {
    trustModifier: number, // +/- to all citizens
    corruptionModifier: number, // +/- to warden corruption rate
    budgetCost: number, // optional cost
    specificWardenId: number | null, // if affects specific warden
    specificGridArea: {x: number, y: number}[] | null // if affects area
  }
}
```

### AuditData (Enhanced)
```javascript
{
  // Crime performance
  reportedCrimesTotal: number,
  actualCrimesTotal: number,
  unreportedCrimesTotal: number,
  solvedCrimesTotal: number,
  falseSolvedCrimesTotal: number,
  
  // Citizen wellbeing
  averageHappiness: number, // 0-100
  happinessChange: number, // from start to end
  trustDistribution: {
    neighborhood_watch: number,
    trusting: number,
    neutral: number,
    wary: number,
    hostile: number
  },
  
  // Warden performance
  wardenCorruption: WardenAuditDetail[],
  totalCorruptActions: number,
  
  // Budget impact
  finalBudgetPercentage: number,
  averageBudgetPercentage: number,
  townServicesImpact: string, // qualitative assessment
  
  // Classification
  classification: string,
  commentary: string, // multi-paragraph explanation
  recommendations: string[]
}
```

### WardenAuditDetail
```javascript
{
  wardenId: number,
  type: "street" | "investigator" | "auditor",
  finalCorruptionLevel: number,
  daysEmployed: number,
  actions: string[], // human-readable corrupt action descriptions
  impactScore: number // how much damage they did
}
```

---

## Core Systems

### 1. Initialization System (Enhanced)

**Purpose**: Set up game state on mount or restart

**Training Day Initialization**:
```javascript
function initializeTrainingDay(): GameState {
  const grid = generateGrid(15); // 15x15
  const citizens = generateCitizens(100, grid);
  const wardens = selectInitialWardens(citizens, 5); // fixed 5 for training
  
  return {
    currentDay: 0,
    phase: "training",
    isTrainingComplete: false,
    budgetPercentage: 25, // locked during training
    citizens,
    wardens,
    grid,
    // ... rest of state
  };
}
```

**Grid Generation**:
```javascript
function generateGrid(size: number): GridSquare[] {
  const grid: GridSquare[] = [];
  const densityDistribution = {
    low: Math.floor(size * size * 0.30), // 30% low
    medium: Math.floor(size * size * 0.50), // 50% medium
    high: Math.floor(size * size * 0.20) // 20% high
  };
  
  // Assign densities randomly but track counts
  let assigned = {low: 0, medium: 0, high: 0};
  
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      let density = assignDensity(assigned, densityDistribution);
      grid.push({
        x, y,
        crimeDensity: density,
        crimes: [],
        wardensPresent: [],
        citizensPresent: [],
        isHighlighted: false,
        patrolCoverage: 0
      });
    }
  }
  
  return grid;
}
```

**Citizen Generation**:
```javascript
function generateCitizens(count: number, grid: GridSquare[]): Citizen[] {
  return Array.from({length: count}, (_, i) => ({
    id: i,
    homeLocation: randomGridLocation(grid),
    workLocation: randomGridLocation(grid),
    trustLevel: "trusting", // everyone starts trusting
    trustScore: 70,
    corruptionLevel: "law_abiding",
    corruptionScore: 10 + Math.random() * 10, // slight variation
    watchExposure: 0,
    daysAsVictim: 0,
    daysWithNoResponse: 0,
    isWarden: false,
    wardenId: null,
    trustHistory: [70],
    experiencedCorruptActions: []
  }));
}
```

**Warden Selection**:
```javascript
function selectInitialWardens(citizens: Citizen[], count: number): Warden[] {
  // Pick random citizens to become wardens
  const selectedCitizens = shuffleArray(citizens).slice(0, count);
  
  return selectedCitizens.map((citizen, idx) => {
    citizen.isWarden = true;
    citizen.wardenId = idx;
    
    return {
      id: idx,
      citizenId: citizen.id,
      type: "street", // all street for training day
      position: randomGridLocation(grid), // default position
      patrolRadius: 1,
      daysEmployed: 0,
      incidentsHandled: 0,
      crimesInZone: 0,
      corruptionLevel: citizen.corruptionScore, // inherit
      inheritedCorruption: citizen.corruptionScore,
      corruptActions: [],
      activeCases: null,
      solvedCases: null,
      whiteColarDetected: null
    };
  });
}
```

---

### 2. Training Day System

**Purpose**: Tutorial experience without consequences

**Flow**:
1. Display intro text modal
2. Show grid with 5 Street Wardens (default positions)
3. Show tutorial tooltips: "Click a Warden, then click a square to move"
4. Budget slider visible but locked at 25%
5. Player places Wardens and sets patrol radius
6. Click "Run Training Day"
7. Simulation runs (simplified, no corruption kicks in)
8. Report shows everything went well
9. "Begin Day 1" button unlocks budget slider and starts real game

**Implementation**:
```javascript
function runTrainingDaySimulation(state: GameState): GameState {
  // Generate minimal crimes
  const crimes = generateTrainingCrimes(state.grid, state.citizens);
  
  // Resolve with ideal outcomes (no corruption, high effectiveness)
  const resolvedCrimes = resolveCrimesOptimistically(crimes, state.wardens);
  
  // No trust degradation, no corruption increase
  // Generate glowing report
  const report = generateTrainingReport(resolvedCrimes, state.wardens);
  
  return {
    ...state,
    currentDay: 1,
    phase: "report",
    isTrainingComplete: true,
    dailyReports: [report],
    grid: updateGridWithCrimes(state.grid, resolvedCrimes)
  };
}
```

---

### 3. Budget System

**Purpose**: Manage Watch funding and town impact

**Budget Calculations**:
```javascript
function calculateAvailableWardens(budgetPercentage: number): number {
  // Every 5% = 1 Warden slot
  return Math.floor(budgetPercentage / 5);
}

function calculateTownServicesQuality(budgetPercentage: number): {
  quality: "excellent" | "good" | "poor" | "critical",
  trustModifier: number,
  corruptionModifier: number,
  notes: string[]
} {
  if (budgetPercentage <= 40) {
    return {
      quality: "excellent",
      trustModifier: 0,
      corruptionModifier: 0,
      notes: []
    };
  }
  
  if (budgetPercentage <= 60) {
    return {
      quality: "good",
      trustModifier: -1,
      corruptionModifier: 0,
      notes: [
        "Park maintenance reduced to monthly schedule",
        "Library operating weekend-only"
      ]
    };
  }
  
  if (budgetPercentage <= 80) {
    return {
      quality: "poor",
      trustModifier: -3,
      corruptionModifier: 2,
      notes: [
        "Community center closed due to funding cuts",
        "Public transit reduced to weekend service",
        "Hospital ER understaffed - longer wait times",
        "Several businesses report difficulty hiring"
      ]
    };
  }
  
  return {
    quality: "critical",
    trustModifier: -5,
    corruptionModifier: 5,
    notes: [
      "Food bank permanently closed",
      "Schools consolidating classes - teacher shortage",
      "Road repairs suspended indefinitely",
      "Multiple critical services shut down"
    ]
  };
}
```

**Hiring Wardens**:
```javascript
function hireNewWarden(
  state: GameState, 
  type: "street" | "investigator" | "auditor"
): GameState {
  // Check if slots available
  const maxWardens = calculateAvailableWardens(state.budgetPercentage);
  if (state.wardens.length >= maxWardens) {
    return state; // can't hire
  }
  
  // Select from civilian population
  const eligibleCitizens = state.citizens.filter(c => !c.isWarden);
  const selectedCitizen = selectRandomWeighted(eligibleCitizens); // could weight by corruption
  
  // Create new Warden
  const newWarden: Warden = {
    id: state.wardens.length,
    citizenId: selectedCitizen.id,
    type,
    position: type === "street" ? randomGridLocation(state.grid) : null,
    patrolRadius: type === "street" ? 1 : null,
    daysEmployed: 0,
    incidentsHandled: 0,
    crimesInZone: 0,
    corruptionLevel: selectedCitizen.corruptionScore,
    inheritedCorruption: selectedCitizen.corruptionScore,
    corruptActions: [],
    activeCases: type === "investigator" ? [] : null,
    solvedCases: type === "investigator" ? 0 : null,
    whiteColarDetected: type === "auditor" ? 0 : null
  };
  
  // Update citizen
  selectedCitizen.isWarden = true;
  selectedCitizen.wardenId = newWarden.id;
  
  return {
    ...state,
    wardens: [...state.wardens, newWarden],
    citizens: state.citizens.map(c => 
      c.id === selectedCitizen.id ? selectedCitizen : c
    )
  };
}
```

---

### 4. Crime Generation System (Enhanced)

**Purpose**: Create crimes based on citizens, grid density, and game state

**Main Generation**:
```javascript
function generateCrimes(state: GameState): Crime[] {
  const crimes: Crime[] = [];
  
  // Generate citizen-based crimes
  state.citizens.forEach(citizen => {
    if (citizen.isWarden) return; // wardens don't commit (most) crimes
    
    const crimeProbability = calculateCrimeProbability(citizen, state);
    
    if (Math.random() < crimeProbability) {
      const crime = generateCitizenCrime(citizen, state);
      crimes.push(crime);
    }
  });
  
  // Generate location-based crimes (independent of specific citizens)
  state.grid.forEach(square => {
    const locationCrimeProbability = square.crimeDensity * 0.1; // base rate
    
    if (Math.random() < locationCrimeProbability) {
      const crime = generateLocationCrime(square, state);
      crimes.push(crime);
    }
  });
  
  // Generate Warden-created crimes (corruption)
  state.wardens.forEach(warden => {
    if (warden.type !== "street") return;
    if (warden.corruptionLevel < 30) return; // not corrupt enough
    
    const corruptCrimes = generateCorruptWardenCrimes(warden, state);
    crimes.push(...corruptCrimes);
  });
  
  return crimes;
}
```

**Crime Probability Calculation**:
```javascript
function calculateCrimeProbability(citizen: Citizen, state: GameState): number {
  let baseProbability = 0.02; // 2% base chance
  
  // Corruption factor
  baseProbability += citizen.corruptionScore / 1000; // 0-10% based on corruption
  
  // Trust factor (inverse)
  const trustMultiplier = (100 - citizen.trustScore) / 200; // 0-0.5
  baseProbability *= (1 + trustMultiplier);
  
  // Location density factor
  const homeSquare = getGridSquare(state.grid, citizen.homeLocation);
  baseProbability *= homeSquare.crimeDensity;
  
  // Service degradation factor
  const services = calculateTownServicesQuality(state.budgetPercentage);
  baseProbability *= (1 + services.corruptionModifier / 10);
  
  return Math.min(baseProbability, 0.5); // cap at 50%
}
```

**Corrupt Warden Crime Generation**:
```javascript
function generateCorruptWardenCrimes(warden: Warden, state: GameState): Crime[] {
  const crimes: Crime[] = [];
  const patrolZone = getPatrolZone(warden.position, warden.patrolRadius);
  
  // Check activity level in zone
  const crimeCount = state.grid
    .filter(sq => isInZone(sq, patrolZone))
    .reduce((sum, sq) => sum + sq.crimes.length, 0);
  
  // Boredom factor (low activity = more manufactured incidents)
  if (crimeCount < 2 && warden.corruptionLevel > 40) {
    // Manufacture 1-3 incidents
    const count = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < count; i++) {
      const location = randomLocationInZone(patrolZone);
      const crimeType = Math.random() < 0.5 ? "harassment" : "traffic";
      
      crimes.push({
        id: generateCrimeId(),
        day: state.currentDay,
        location,
        timeOfDay: randomTime(),
        type: crimeType,
        category: "street",
        status: "responded", // warden "solves" their own created crime
        wardenResponder: warden.id,
        responseTime: 1, // instant
        isWardenGenerated: true,
        isFalseArrest: true,
        assignedInvestigator: null,
        daysToSolve: null,
        victimCitizenId: findNearestCitizen(location, state.citizens),
        witnessIds: findNearbyWitnesses(location, state.citizens)
      });
      
      // Log corrupt action
      warden.corruptActions.push({
        day: state.currentDay,
        type: crimeType === "harassment" ? "harassment" : "false_arrest",
        location,
        description: `Manufactured ${crimeType} incident to justify presence`,
        affectedCitizenIds: [findNearestCitizen(location, state.citizens)]
      });
    }
  }
  
  return crimes;
}
```

---

### 5. Crime Resolution System (Enhanced)

**Purpose**: Determine how crimes get handled based on Warden deployment

**Main Resolution**:
```javascript
function resolveCrimes(crimes: Crime[], state: GameState): Crime[] {
  return crimes.map(crime => {
    if (crime.category === "street") {
      return resolveStreetCrime(crime, state);
    } else if (crime.category === "investigative") {
      return assignToInvestigator(crime, state);
    } else if (crime.category === "white_collar") {
      return resolveWhiteCollarCrime(crime, state);
    }
    return crime;
  });
}
```

**Street Crime Resolution**:
```javascript
function resolveStreetCrime(crime: Crime, state: GameState): Crime {
  // Find wardens covering this location
  const coveringWardens = state.wardens.filter(w => 
    w.type === "street" && 
    isInPatrolZone(crime.location, w.position, w.patrolRadius)
  );
  
  if (coveringWardens.length === 0) {
    // No coverage - reported or unreported based on trust
    return resolveWithoutWarden(crime, state);
  }
  
  // Select responding warden (closest or least busy)
  const responder = selectResponder(coveringWardens, crime);
  
  // Prevention vs response based on timing and corruption
  const preventionChance = 0.3 - (responder.corruptionLevel / 500);
  
  if (Math.random() < preventionChance) {
    // Prevented before it happened
    crime.status = "prevented";
    crime.wardenResponder = responder.id;
    responder.incidentsHandled++;
    return crime;
  }
  
  // Crime occurs, warden responds
  crime.status = "responded";
  crime.wardenResponder = responder.id;
  crime.responseTime = calculateResponseTime(crime.location, responder.position);
  responder.incidentsHandled++;
  
  // Check for corrupt resolution
  if (responder.corruptionLevel > 50 && Math.random() < 0.3) {
    crime.isFalseArrest = true;
    
    // Log corrupt action
    responder.corruptActions.push({
      day: state.currentDay,
      type: Math.random() < 0.5 ? "excessive_force" : "false_arrest",
      location: crime.location,
      description: `Used ${Math.random() < 0.5 ? 'excessive force' : 'false arrest'} responding to ${crime.type}`,
      affectedCitizenIds: [crime.victimCitizenId, ...crime.witnessIds]
    });
  }
  
  return crime;
}
```

**Resolution Without Warden**:
```javascript
function resolveWithoutWarden(crime: Crime, state: GameState): Crime {
  // Find citizens at this location
  const nearbyResidents = state.citizens.filter(c =>
    distance(c.homeLocation, crime.location) <= 1
  );
  
  // Calculate reporting likelihood based on average trust
  const avgTrust = nearbyResidents.reduce((sum, c) => sum + c.trustScore, 0) / nearbyResidents.length;
  const reportProbability = avgTrust / 100 * 0.8; // trust affects reporting
  
  // Crime severity also affects reporting
  const severityBonus = getCrimeSeverityBonus(crime.type);
  
  if (Math.random() < (reportProbability + severityBonus)) {
    crime.status = "reported";
  } else {
    crime.status = "unreported";
  }
  
  return crime;
}
```

**Investigator Assignment**:
```javascript
function assignToInvestigator(crime: Crime, state: GameState): Crime {
  const investigators = state.wardens.filter(w => w.type === "investigator");
  
  if (investigators.length === 0) {
    crime.status = "reported"; // sits unsolved
    return crime;
  }
  
  // Assign to least busy investigator
  const investigator = investigators.reduce((least, curr) => 
    curr.activeCases.length < least.activeCases.length ? curr : least
  );
  
  // Create case
  const daysToSolve = calculateDaysToSolve(crime.type, investigator.corruptionLevel);
  const newCase: Case = {
    crimeId: crime.id,
    investigatorId: investigator.id,
    startDay: state.currentDay,
    daysRequired: daysToSolve,
    isCorruptResolution: investigator.corruptionLevel > 40 && Math.random() < 0.4
  };
  
  investigator.activeCases.push(newCase);
  crime.assignedInvestigator = investigator.id;
  crime.daysToSolve = daysToSolve;
  crime.status = "reported"; // under investigation
  
  return crime;
}
```

---

### 6. Warden Corruption System (Enhanced)

**Purpose**: Increase corruption over time based on conditions

**Daily Update**:
```javascript
function updateWardenCorruption(state: GameState): GameState {
  const updatedWardens = state.wardens.map(warden => {
    let corruptionIncrease = 5; // base increase per day
    
    if (warden.type === "street") {
      corruptionIncrease += calculateStreetWardenCorruption(warden, state);
    } else if (warden.type === "investigator") {
      corruptionIncrease += calculateInvestigatorCorruption(warden);
    } else if (warden.type === "auditor") {
      corruptionIncrease += 8; // high temptation with money
    }
    
    warden.corruptionLevel = Math.min(100, warden.corruptionLevel + corruptionIncrease);
    warden.daysEmployed++;
    
    return warden;
  });
  
  return {
    ...state,
    wardens: updatedWardens
  };
}
```

**Street Warden Corruption**:
```javascript
function calculateStreetWardenCorruption(warden: Warden, state: GameState): number {
  const patrolZone = getPatrolZone(warden.position, warden.patrolRadius);
  
  // Count crimes in zone
  const crimesInZone = state.grid
    .filter(sq => isInZone(sq, patrolZone))
    .reduce((sum, sq) => sum + sq.crimes.length, 0);
  
  // Boredom (low activity)
  if (crimesInZone < 2) {
    return 10; // bored wardens get corrupt faster
  }
  
  // Burnout (high activity)
  if (crimesInZone > 10) {
    return 8;
  }
  
  // Optimal activity
  return 5;
}
```

---

### 7. Citizen Trust System (Enhanced)

**Purpose**: Update trust based on Watch presence and experiences

**Daily Update**:
```javascript
function updateCitizenTrust(state: GameState): GameState {
  const updatedCitizens = state.citizens.map(citizen => {
    if (citizen.isWarden) return citizen; // wardens don't have trust scores
    
    let trustChange = 0;
    
    // Watch exposure factor
    const wardensNearHome = countWardensNearLocation(
      citizen.homeLocation, 
      state.wardens
    );
    trustChange -= wardensNearHome * 2; // -2 per warden nearby
    
    // Service degradation factor
    const services = calculateTownServicesQuality(state.budgetPercentage);
    trustChange += services.trustModifier;
    
    // Crime victim factor
    const wasVictimToday = state.grid
      .flatMap(sq => sq.crimes)
      .some(c => c.victimCitizenId === citizen.id);
    
    if (wasVictimToday) {
      const crimeForVictim = state.grid
        .flatMap(sq => sq.crimes)
        .find(c => c.victimCitizenId === citizen.id);
      
      if (crimeForVictim.status === "prevented" || crimeForVictim.status === "responded") {
        trustChange += 5; // good response
      } else {
        trustChange -= 15; // no response
        citizen.daysWithNoResponse++;
      }
      
      citizen.daysAsVictim++;
    }
    
    // Witnessed corruption factor
    const witnessedCorruption = state.wardens
      .flatMap(w => w.corruptActions)
      .filter(action => 
        action.day === state.currentDay &&
        action.affectedCitizenIds.includes(citizen.id)
      );
    
    witnessedCorruption.forEach(action => {
      trustChange -= 10;
      citizen.experiencedCorruptActions.push(action.description);
    });
    
    // Apply change
    citizen.trustScore = Math.max(0, Math.min(100, citizen.trustScore + trustChange));
    
    // Update trust level based on score
    citizen.trustLevel = getTrustLevel(citizen.trustScore);
    
    // Track history
    citizen.trustHistory.push(citizen.trustScore);
    
    return citizen;
  });
  
  return {
    ...state,
    citizens: updatedCitizens
  };
}
```

---

### 8. Decision System

**Purpose**: Present player with mid-turn choices

**Decision Generation**:
```javascript
function generateDecisions(state: GameState): Decision[] {
  const decisions: Decision[] = [];
  const maxDecisions = 2;
  
  // Potential decision types
  const potentialDecisions = [
    () => generateDisciplineDecision(state),
    () => generatePetitionDecision(state),
    () => generateBudgetSurplusDecision(state),
    () => generateIncidentResponseDecision(state)
  ];
  
  // Shuffle and take up to 2
  const selectedGenerators = shuffleArray(potentialDecisions).slice(0, maxDecisions);
  
  selectedGenerators.forEach((generator, idx) => {
    const decision = generator();
    if (decision) {
      decision.id = idx;
      decision.day = state.currentDay;
      decisions.push(decision);
    }
  });
  
  return decisions.filter(d => d !== null);
}
```

**Example Decision Generator**:
```javascript
function generateDisciplineDecision(state: GameState): Decision | null {
  // Find a warden with recent corrupt action
  const corruptWardens = state.wardens.filter(w => 
    w.corruptActions.some(a => a.day === state.currentDay - 1)
  );
  
  if (corruptWardens.length === 0) return null;
  
  const warden = corruptWardens[0];
  const recentAction = warden.corruptActions[warden.corruptActions.length - 1];
  
  return {
    id: 0,
    day: state.currentDay,
    type: "discipline",
    prompt: `Warden #${warden.id} ${recentAction.description}. A citizen has filed a formal complaint. How do you respond?`,
    options: [
      {
        text: "Discipline the Warden",
        impact: {
          trustModifier: 3,
          corruptionModifier: 0,
          budgetCost: 0,
          specificWardenId: warden.id,
          specificGridArea: null
        }
      },
      {
        text: "Defend the Warden publicly",
        impact: {
          trustModifier: -5,
          corruptionModifier: 3, // signals corruption is okay
          budgetCost: 0,
          specificWardenId: null,
          specificGridArea: null
        }
      },
      {
        text: "Launch internal investigation",
        impact: {
          trustModifier: 1,
          corruptionModifier: -2,
          budgetCost: 1000,
          specificWardenId: warden.id,
          specificGridArea: null
        }
      }
    ],
    selectedOption: null
  };
}
```

**Applying Decision Impact**:
```javascript
function applyDecisionImpact(state: GameState, decision: Decision): GameState {
  const selectedOption = decision.options[decision.selectedOption];
  
  // Apply trust modifier to all citizens
  const updatedCitizens = state.citizens.map(c => ({
    ...c,
    trustScore: Math.max(0, Math.min(100, c.trustScore + selectedOption.impact.trustModifier))
  }));
  
  // Apply corruption modifier to wardens (or specific warden)
  const updatedWardens = state.wardens.map(w => {
    if (selectedOption.impact.specificWardenId && w.id !== selectedOption.impact.specificWardenId) {
      return w;
    }
    
    return {
      ...w,
      corruptionLevel: Math.max(0, Math.min(100, w.corruptionLevel + selectedOption.impact.corruptionModifier))
    };
  });
  
  return {
    ...state,
    citizens: updatedCitizens,
    wardens: updatedWardens
  };
}
```

---

### 9. Simulation Orchestrator (Enhanced)

**Purpose**: Run complete day simulation

**Main Flow**:
```javascript
function simulateDay(state: GameState): GameState {
  // 1. Increment day
  let newState = {...state, currentDay: state.currentDay + 1};
  
  // 2. Update patrol coverage on grid
  newState = updateGridPatrolCoverage(newState);
  
  // 3. Generate crimes
  const crimes = generateCrimes(newState);
  
  // 4. Resolve crimes
  const resolvedCrimes = resolveCrimes(crimes, newState);
  
  // 5. Update grid with crimes
  newState.grid = updateGridWithCrimes(newState.grid, resolvedCrimes);
  
  // 6. Process investigator cases (check if any solved today)
  newState = processInvestigatorCases(newState);
  
  // 7. Process auditor detections
  newState = processAuditorDetections(newState, resolvedCrimes);
  
  // 8. Update warden corruption
  newState = updateWardenCorruption(newState);
  
  // 9. Update citizen trust
  newState = updateCitizenTrust(newState);
  
  // 10. Update citizen corruption
  newState = updateCitizenCorruption(newState);
  
  // 11. Generate daily report
  const report = generateReport(newState, resolvedCrimes);
  newState.dailyReports.push(report);
  
  // 12. Generate decision prompts for next turn
  if (newState.currentDay < 14) {
    newState.pendingDecisions = generateDecisions(newState);
  }
  
  // 13. Set phase
  newState.phase = newState.pendingDecisions.length > 0 ? "decision" : "report";
  
  return newState;
}
```

---

### 10. Report Generation (Enhanced)

**Purpose**: Create comprehensive daily report

```javascript
function generateReport(state: GameState, crimes: Crime[]): Report {
  // Calculate stats
  const crimesPrevented = crimes.filter(c => c.status === "prevented").length;
  const crimesResponded = crimes.filter(c => c.status === "responded").length;
  const crimesSolved = crimes.filter(c => c.status === "solved").length;
  const crimesReported = crimes.filter(c => c.status === "reported").length;
  const actualUnreported = crimes.filter(c => c.status === "unreported").length;
  
  // Estimated unreported (add noise so player doesn't know exact count)
  const estimatedUnreported = {
    min: Math.floor(actualUnreported * 0.7),
    max: Math.ceil(actualUnreported * 1.3)
  };
  
  // Notable incidents
  const notableIncidents = generateNotableIncidents(crimes, state, 4);
  
  // Citizen feedback
  const citizenFeedback = generateCitizenFeedback(state);
  
  // Operational notes
  const services = calculateTownServicesQuality(state.budgetPercentage);
  const operationalNotes = services.notes;
  
  // Count false arrests (hidden for now)
  const falseArrests = crimes.filter(c => c.isFalseArrest).length;
  const corruptActionsThisDay = state.wardens.reduce(
    (sum, w) => sum + w.corruptActions.filter(a => a.day === state.currentDay).length,
    0
  );
  
  return {
    day: state.currentDay,
    crimesPrevented,
    crimesResponded,
    crimesSolved,
    crimesReported,
    estimatedUnreported,
    budgetPercentage: state.budgetPercentage,
    streetWardens: state.wardens
      .filter(w => w.type === "street")
      .map(w => ({id: w.id, position: w.position, radius: w.patrolRadius})),
    investigators: state.wardens.filter(w => w.type === "investigator").length,
    auditors: state.wardens.filter(w => w.type === "auditor").length,
    notableIncidents,
    citizenFeedback,
    operationalNotes,
    actualUnreported,
    falseArrests,
    corruptActionsThisDay
  };
}
```

**Notable Incidents Generation**:
```javascript
function generateNotableIncidents(crimes: Crime[], state: GameState, count: number): string[] {
  // Prioritize interesting crimes
  const interesting = crimes.filter(c => 
    c.type === "murder" || 
    c.type === "kidnapping" ||
    c.isWardenGenerated ||
    c.isFalseArrest
  );
  
  const regular = crimes.filter(c => !interesting.includes(c));
  
  // Mix interesting with regular
  const selected = [
    ...shuffleArray(interesting).slice(0, Math.min(2, interesting.length)),
    ...shuffleArray(regular).slice(0, count - Math.min(2, interesting.length))
  ];
  
  return selected.map(crime => formatIncidentDescription(crime, state));
}
```

**Citizen Feedback Generation**:
```javascript
function generateCitizenFeedback(state: GameState): string[] {
  const feedback: string[] = [];
  
  // Trust indicators
  const avgTrust = state.citizens.reduce((sum, c) => sum + c.trustScore, 0) / state.citizens.length;
  
  if (avgTrust > 70) {
    feedback.push("Anonymous tip led to arrest in Grid F4");
    feedback.push("Neighborhood watch reported suspicious activity");
  } else if (avgTrust < 40) {
    feedback.push("No witnesses came forward for incident in Grid C7");
    feedback.push("Multiple complaints filed regarding Warden conduct");
  }
  
  // Complaint count
  const complaints = state.wardens.reduce(
    (sum, w) => sum + w.corruptActions.filter(a => a.day === state.currentDay).length,
    0
  );
  
  if (complaints > 3) {
    feedback.push(`${complaints} citizen complaints filed today`);
  }
  
  return feedback;
}
```

---

### 11. Audit System (Enhanced)

**Purpose**: Calculate final review metrics

**Main Calculation**:
```javascript
function calculateAudit(state: GameState): AuditData {
  // Aggregate crime stats
  const reportedTotal = state.dailyReports.reduce((sum, r) => 
    sum + r.crimesPrevented + r.crimesResponded + r.crimesSolved + r.crimesReported, 0
  );
  const actualTotal = state.dailyReports.reduce((sum, r) => 
    sum + r.crimesPrevented + r.crimesResponded + r.crimesSolved + r.crimesReported + r.actualUnreported, 0
  );
  const unreportedTotal = state.dailyReports.reduce((sum, r) => sum + r.actualUnreported, 0);
  const solvedTotal = state.dailyReports.reduce((sum, r) => sum + r.crimesSolved, 0);
  const falseSolvedTotal = state.dailyReports.reduce((sum, r) => sum + r.falseArrests, 0);
  
  // Calculate happiness
  const happiness = calculateHappiness(state.citizens, state.wardens);
  const initialHappiness = 70; // everyone started trusting
  const happinessChange = happiness - initialHappiness;
  
  // Trust distribution
  const trustDistribution = {
    neighborhood_watch: state.citizens.filter(c => c.trustLevel === "neighborhood_watch").length,
    trusting: state.citizens.filter(c => c.trustLevel === "trusting").length,
    neutral: state.citizens.filter(c => c.trustLevel === "neutral").length,
    wary: state.citizens.filter(c => c.trustLevel === "wary").length,
    hostile: state.citizens.filter(c => c.trustLevel === "hostile").length
  };
  
  // Warden corruption details
  const wardenCorruption = state.wardens.map(w => ({
    wardenId: w.id,
    type: w.type,
    finalCorruptionLevel: w.corruptionLevel,
    daysEmployed: w.daysEmployed,
    actions: w.corruptActions.map(a => a.description),
    impactScore: w.corruptActions.length * 10 + w.corruptionLevel
  }));
  
  const totalCorruptActions = state.wardens.reduce((sum, w) => sum + w.corruptActions.length, 0);
  
  // Budget stats
  const avgBudget = state.dailyReports.reduce((sum, r) => sum + r.budgetPercentage, 0) / state.dailyReports.length;
  
  // Classification
  const classification = classifyPerformance(happiness, reportedTotal, totalCorruptActions);
  const commentary = generateCommentary(classification, happiness, happinessChange, state);
  const recommendations = generateRecommendations(classification, state);
  
  return {
    reportedCrimesTotal: reportedTotal,
    actualCrimesTotal: actualTotal,
    unreportedCrimesTotal: unreportedTotal,
    solvedCrimesTotal: solvedTotal,
    falseSolvedCrimesTotal: falseSolvedTotal,
    averageHappiness: happiness,
    happinessChange,
    trustDistribution,
    wardenCorruption,
    totalCorruptActions,
    finalBudgetPercentage: state.budgetPercentage,
    averageBudgetPercentage: avgBudget,
    townServicesImpact: getTownServicesImpactDescription(avgBudget),
    classification,
    commentary,
    recommendations
  };
}
```

**Happiness Calculation**:
```javascript
function calculateHappiness(citizens: Citizen[], wardens: Warden[]): number {
  let totalHappiness = 0;
  
  citizens.forEach(citizen => {
    if (citizen.isWarden) return; // don't count wardens
    
    let happiness = 100;
    
    // Trust penalty
    const trustPenalty = (70 - citizen.trustScore) * 0.5; // 0-35 penalty
    happiness -= trustPenalty;
    
    // Watch exposure penalty
    happiness -= citizen.watchExposure * 0.5;
    
    // Witnessed corruption penalty
    happiness -= citizen.experiencedCorruptActions.length * 5;
    
    // Victim with no response penalty
    happiness -= citizen.daysWithNoResponse * 10;
    
    totalHappiness += Math.max(0, Math.min(100, happiness));
  });
  
  return Math.round(totalHappiness / citizens.filter(c => !c.isWarden).length);
}
```

**Classification Logic**:
```javascript
function classifyPerformance(
  happiness: number, 
  reportedCrimes: number, 
  corruptActions: number
): string {
  // Balanced Community (ideal)
  if (happiness > 65 && reportedCrimes < 100 && corruptActions < 20) {
    return "BALANCED COMMUNITY";
  }
  
  // Authoritarian Success (low crime but unhappy)
  if (happiness < 50 && reportedCrimes < 80) {
    return "AUTHORITARIAN SUCCESS";
  }
  
  // Police State (very unhappy, heavy control)
  if (happiness < 35) {
    return "POLICE STATE";
  }
  
  // Negligent (high crime, low involvement)
  if (reportedCrimes > 150 && happiness > 60) {
    return "NEGLIGENT ADMINISTRATION";
  }
  
  // Corrupted System (lots of corruption)
  if (corruptActions > 40) {
    return "CORRUPTED SYSTEM";
  }
  
  // Failed State (everything bad)
  if (happiness < 40 && reportedCrimes > 120) {
    return "FAILED STATE";
  }
  
  // Default: needs improvement
  return "AUTHORITARIAN FAILURE";
}
```

---

## Component Architecture

### GameController (Enhanced)
```javascript
const GameController = () => {
  const [state, dispatch] = useReducer(gameReducer, null, initializeGame);
  
  // Phase handlers
  const handleRunDay = () => {
    dispatch({type: "START_TRANSITION"});
    setTimeout(() => {
      const newState = simulateDay(state);
      dispatch({type: "SIMULATION_COMPLETE", payload: newState});
    }, 2000); // transition duration
  };
  
  const handleDecisionSelect = (decisionId, optionIndex) => {
    dispatch({type: "MAKE_DECISION", payload: {decisionId, optionIndex}});
  };
  
  const handleBudgetChange = (newPercentage) => {
    dispatch({type: "UPDATE_BUDGET", payload: newPercentage});
  };
  
  // Render based on phase
  switch (state.phase) {
    case "training":
      return <TrainingDay state={state} dispatch={dispatch} />;
    case "placement":
      return <PlacementView state={state} dispatch={dispatch} onRunDay={handleRunDay} />;
    case "decision":
      return <DecisionPrompt state={state} onSelect={handleDecisionSelect} />;
    case "transition":
      return <DayTransition day={state.currentDay} />;
    case "report":
      return <IncidentReport state={state} dispatch={dispatch} />;
    case "audit":
      return <IndependentAudit audit={state.finalAudit} />;
    default:
      return null;
  }
};
```

### Game Reducer
```javascript
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "UPDATE_BUDGET":
      return updateBudget(state, action.payload);
    
    case "MOVE_WARDEN":
      return moveWarden(state, action.payload.wardenId, action.payload.position);
    
    case "SET_PATROL_RADIUS":
      return setWardenPatrolRadius(state, action.payload.wardenId, action.payload.radius);
    
    case "HIRE_WARDEN":
      return hireNewWarden(state, action.payload.type);
    
    case "MAKE_DECISION":
      return applyDecisionImpact(state, findDecision(state, action.payload.decisionId));
    
    case "START_TRANSITION":
      return {...state, phase: "transition"};
    
    case "SIMULATION_COMPLETE":
      return action.payload;
    
    case "CONTINUE_TO_PLACEMENT":
      return {...state, phase: "placement", selectedWardenId: null};
    
    case "VIEW_AUDIT":
      const audit = calculateAudit(state);
      return {...state, phase: "audit", finalAudit: audit};
    
    case "RESTART_GAME":
      return initializeGame();
    
    default:
      return state;
  }
}
```

---

## Performance Optimizations

### Memoization
```javascript
const MapView = React.memo(({grid, wardens, crimes, phase}) => {
  // Memoize heavy calculations
  const patrolCoverage = useMemo(
    () => calculatePatrolCoverage(grid, wardens),
    [grid, wardens]
  );
  
  const crimesByLocation = useMemo(
    () => groupCrimesByLocation(crimes),
    [crimes]
  );
  
  return (
    <div className="grid grid-cols-15 gap-0.5">
      {grid.map(square => (
        <GridSquare 
          key={`${square.x}-${square.y}`}
          square={square}
          coverage={patrolCoverage[`${square.x}-${square.y}`]}
          crimes={crimesByLocation[`${square.x}-${square.y}`]}
        />
      ))}
    </div>
  );
});
```

### Efficient Grid Rendering
- Use CSS Grid for layout
- Only render visible crimes (after day runs)
- Lazy load crime details on click
- Debounce warden movement interactions

---

## Save/Load System (Optional Enhancement)

```javascript
function saveGame(state: GameState): void {
  const saveData = {
    version: "1.0",
    timestamp: Date.now(),
    state: state
  };
  localStorage.setItem("thewatch_save", JSON.stringify(saveData));
}

function loadGame(): GameState | null {
  const saved = localStorage.getItem("thewatch_save");
  if (!saved) return null;
  
  try {
    const saveData = JSON.parse(saved);
    // Validate version compatibility
    if (saveData.version === "1.0") {
      return saveData.state;
    }
  } catch (e) {
    console.error("Failed to load save", e);
  }
  
  return null;
}
```

---

## File Structure (Enhanced)

```
/src
  /components
    GameController.jsx
    TrainingDay.jsx
    PlacementView.jsx
    MapView.jsx
    GridSquare.jsx
    WardenMarker.jsx
    CrimeMarker.jsx
    StationDisplay.jsx
    ControlPanel.jsx
      BudgetSlider.jsx
      WardenList.jsx
      WardenTypeSelector.jsx
    DecisionPrompt.jsx
    DayTransition.jsx
    IncidentReport.jsx
    IndependentAudit.jsx
    IntroModal.jsx
  /systems
    initialization.js
    simulation.js
    crime.js
      crimeGeneration.js
      crimeResolution.js
    warden.js
      wardenCorruption.js
      wardenManagement.js
    citizen.js
      citizenTrust.js
      citizenCorruption.js
    budget.js
    decisions.js
    audit.js
    investigators.js
    auditors.js
  /utils
    constants.js
    calculations.js
    formatting.js
    gridUtils.js
    randomUtils.js
  /types
    types.js (or types.d.ts)
  /hooks
    useGameState.js
    useSimulation.js
  App.jsx
  index.css (Tailwind)
```

---

## Testing Strategy

### Unit Tests (Priority Areas)
- Crime generation probabilities
- Warden corruption calculations
- Citizen trust updates
- Budget impact calculations
- Audit scoring logic

### Integration Tests
- Full day simulation
- Multi-day progressions
- Decision impact cascades
- Audit accuracy

### Playtesting Focus
- Balance: Can players achieve "Balanced Community"?
- Clarity: Do reports convey useful information?
- Surprise: Is audit reveal impactful?
- Replayability: Do different strategies produce different results?

---

## Deployment Considerations

**React Artifact**:
- Runs in claude.ai interface
- No deployment needed
- Limited to single-file constraints
- Can export code for standalone deployment

**Standalone Version**:
- Build with Vite or Create React App
- Deploy to Vercel/Netlify
- Add analytics (optional)
- Add save/load persistence

---

## Future Enhancements (Post-Launch)

- Multiple towns with different demographics
- Historical data tracking across playthroughs
- Social sharing of audit results
- Custom difficulty settings
- More decision types and events
- Seasonal events (holidays, elections)
- Detailed citizen stories mode
- Sandbox mode (no audit, just experiment)
