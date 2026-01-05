# The Watch - MVG Milestone Plan

## Overview
This document outlines the step-by-step development plan for the Minimum Viable Gameplay build. Each milestone builds on the previous, allowing for testing and iteration at each stage.

**Total Estimated Timeline**: 8-12 development sessions

---

## Milestone 1: Foundation & Grid Display
**Goal**: Render the game board and establish basic state management

### Tasks
1. Set up React project structure
   - Create component files
   - Set up Tailwind CSS
   - Define constants file

2. Create data structures
   - Define types/interfaces for GameState, Citizen, Warden, GridSquare, Crime
   - Create initialization functions

3. Build MapView component
   - Render 5x5 grid of GridSquare components
   - Apply basic styling (borders, spacing)
   - Ensure grid is centered and properly sized

4. Implement initialization system
   - `initializeGrid()`: Create 25 GridSquares with random crime densities
   - `initializeCitizens()`: Create 10 citizens with random home locations
   - `initializeWardens()`: Convert 2 citizens to Wardens
   - Display grid on mount

### Acceptance Criteria
- [ ] 5x5 grid renders on screen
- [ ] Each square has a crime density value (check in console)
- [ ] 10 citizens exist in state (8 civilians, 2 Wardens)
- [ ] Game initializes on mount
- [ ] Grid is visually clean and properly spaced

### Deliverable
A static grid that initializes with data. No interaction yet.

---

## Milestone 2: Warden Placement
**Goal**: Allow player to position Wardens on the grid

### Tasks
1. Add Warden selection state
   - Track selectedWardenId in GameController
   - Highlight selected Warden visually

2. Implement placement logic
   - Click Warden to select it
   - Click grid square to move selected Warden
   - Update Warden position in state
   - Prevent placing two Wardens on same square

3. Display patrol zones
   - Calculate 3x3 patrol area around each Warden
   - Add blue overlay to GridSquares in patrol zone
   - Use low opacity so squares remain visible

4. Add Warden markers
   - Display Warden icon/number on their square
   - Make Wardens clickable for selection
   - Show which Warden is selected (highlight)

5. Create ControlPanel component
   - Display "Run Day 1" button (disabled for now)
   - Show current day number
   - List Wardens and their positions

### Acceptance Criteria
- [ ] Can click a Warden to select it
- [ ] Can click a grid square to move selected Warden
- [ ] Blue patrol zone (3x3) appears around each Warden
- [ ] Cannot place two Wardens on same square
- [ ] Visual feedback for selected Warden
- [ ] ControlPanel shows game state

### Deliverable
Interactive grid where Wardens can be positioned. Simulation doesn't run yet.

---

## Milestone 3: Core Simulation Logic
**Goal**: Implement the day simulation without UI (console-driven)

### Tasks
1. Build crime generation system
   - `generateCrimes()`: Create crimes based on citizen trust + grid density
   - Assign random times of day
   - Assign crime types (assault, theft, vandalism, etc.)
   - Log generated crimes to console

2. Build crime resolution system
   - `resolveCrimes()`: Check each crime against Warden patrol zones
   - Determine status: prevented, responded, reported, or unreported
   - Consider citizen trust for reporting likelihood
   - Log resolution results to console

3. Build Warden corruption system
   - `updateWardenCorruption()`: Increase corruption each day
   - Factor in activity level (boredom vs burnout)
   - Generate corrupt actions for corrupted Wardens (>30 corruption)
   - Log corruption changes to console

4. Build citizen trust system
   - `updateCitizenTrust()`: Adjust trust based on Warden proximity
   - Decrease trust for citizens in heavily patrolled areas
   - Decrease trust for crime victims with no response
   - Log trust changes to console

5. Create simulation orchestrator
   - `simulateDay()`: Call all subsystems in order
   - Update GameState with results
   - Log full day summary to console

6. Wire "Run Day" button
   - Call simulateDay when clicked
   - Update GameState with results
   - Log everything to console (no UI updates yet)

### Acceptance Criteria
- [ ] Clicking "Run Day" triggers simulation
- [ ] Crimes generate based on density and citizen trust
- [ ] Crimes resolve correctly (prevented/responded/reported/unreported)
- [ ] Warden corruption increases over time
- [ ] Citizen trust decreases in patrolled areas
- [ ] Console logs show clear simulation results
- [ ] GameState updates after simulation

### Deliverable
Functioning simulation engine. Results logged to console, no UI display yet.

---

## Milestone 4: Day Transition & Report Display
**Goal**: Show simulation results to player through UI

### Tasks
1. Create DayTransition component
   - Fullscreen overlay
   - "Day X" text with fade in/hold/fade out animation
   - Auto-advance after 2 seconds

2. Create IncidentReport component
   - Display crime statistics (prevented/responded/reported/unreported)
   - Show Warden deployment info
   - Generate and display 2-4 notable incidents as flavor text
   - Add "Continue" button

3. Implement phase system
   - Add phase state: "placement" | "transition" | "report"
   - "Run Day" button changes phase to "transition"
   - After transition animation, change to "report"
   - "Continue" button returns to "placement" (or advances day)

4. Build report generation
   - `generateReport()`: Create Report object from simulation results
   - Store reports in GameState
   - `generateNotableIncidents()`: Pick interesting crimes for flavor text

5. Implement day counter
   - Track currentDay in GameState
   - Increment after each report
   - Display current day in UI

### Acceptance Criteria
- [ ] "Run Day" button triggers transition animation
- [ ] "Day X" displays with smooth fade in/out
- [ ] Report displays with correct statistics
- [ ] 2-4 notable incidents show with descriptive text
- [ ] "Continue" button advances to next day (for days 1-2)
- [ ] Phase transitions work smoothly
- [ ] Can complete Days 1 and 2 fully

### Deliverable
Complete day loop: Placement → Transition → Report → (Next Day)

---

## Milestone 5: Crime & Warden Visualization
**Goal**: Show crimes and patrol details on the map

### Tasks
1. Display crimes on map
   - After day runs, show red dots on GridSquares with crimes
   - Multiple crimes in one square = multiple dots or count badge
   - Make crime markers clickable

2. Create crime detail modal/tooltip
   - Click red dot to see crime details
   - Show: type, time, status (prevented/responded/etc.), Warden involvement
   - Display in clean overlay or tooltip

3. Create Warden detail modal/tooltip
   - Click Warden to see daily activity
   - Show: incidents handled, patrol area, position
   - Display response times (for flavor)

4. Add map interaction to report phase
   - During report, map shows crimes from that day
   - Player can explore map while reading report
   - Clicking incidents reveals details

5. Visual polish
   - Smooth red dot appearance (fade in)
   - Hover states for interactive elements
   - Clear visual hierarchy (crimes more prominent than patrol zones during report)

### Acceptance Criteria
- [ ] Red dots appear on map after day runs
- [ ] Clicking crime shows detailed information
- [ ] Clicking Warden shows activity summary
- [ ] Map remains interactive during report phase
- [ ] Visual feedback for all interactive elements
- [ ] Crime counts accurate on map

### Deliverable
Rich map visualization that tells the story of each day visually.

---

## Milestone 6: Independent Audit System
**Goal**: Calculate and display final review after Day 3

### Tasks
1. Build audit calculation system
   - `calculateAudit()`: Run after Day 3 simulation
   - `calculateHappiness()`: Average citizen happiness based on trust + exposure
   - Calculate trust distribution (counts of each level)
   - Aggregate Warden corruption actions
   - Count actual vs reported crimes
   - Determine classification based on metrics

2. Create IndependentAudit component
   - Display happiness score prominently
   - Show trust distribution (chart or list)
   - List Warden corruption incidents with descriptions
   - Show actual crime statistics vs what player saw
   - Display final classification with commentary

3. Implement audit trigger
   - After Day 3 report, show "View Independent Audit Results" button
   - Button transitions to audit phase
   - Audit is final screen (no return)

4. Add classification logic
   - Define thresholds for different classifications
   - Generate appropriate commentary for each classification
   - Make commentary reflect player's specific choices

5. Format corruption actions
   - `formatCorruptionActions()`: Convert corrupt action data to readable strings
   - Examples: "5 uses of excessive force", "2 false arrests", "8 harassment citations"
   - Group by Warden

### Acceptance Criteria
- [ ] After Day 3, "View Audit" button appears
- [ ] Clicking button shows Independent Audit
- [ ] Happiness score calculates correctly
- [ ] Trust distribution matches citizen states
- [ ] Warden corruption actions listed with specifics
- [ ] Classification appears with relevant commentary
- [ ] Actual vs reported crime counts match simulation data
- [ ] Audit reveals information player didn't have access to

### Deliverable
Complete final review that recontextualizes the player's experience.

---

## Milestone 7: Intro & Game Flow Polish
**Goal**: Add opening text and smooth the overall experience

### Tasks
1. Create IntroModal component
   - Display opening text on mount
   - "You are Commander of the Watch. In 3 days time, an Independent Audit..."
   - "Start" button to dismiss and begin placement
   - Appears before grid is shown

2. Refine phase transitions
   - Ensure all phase changes are smooth
   - Add loading states if needed
   - Prevent clicking "Run Day" multiple times
   - Disable interactions during transitions

3. Add restart functionality
   - "New Game" button after audit
   - Reset all state and restart from intro
   - Optional: Keep audit results visible until dismissed

4. Polish ControlPanel
   - Clear indication of current phase
   - Disable "Run Day" when Wardens not placed (if applicable)
   - Show helpful hints: "Click a Warden, then click a square to move it"

5. Responsive layout
   - Ensure game works on different screen sizes
   - Grid scales appropriately
   - Reports readable on smaller screens

### Acceptance Criteria
- [ ] Intro text appears on first load
- [ ] Can't interact with grid until intro dismissed
- [ ] All phase transitions feel intentional and smooth
- [ ] Can restart game after audit
- [ ] ControlPanel provides clear guidance
- [ ] Game is playable on laptop/desktop screens
- [ ] No visual jank or awkward states

### Deliverable
Polished, complete game flow from start to finish.

---

## Milestone 8: Balance & Tuning
**Goal**: Ensure gameplay delivers intended experience

### Tasks
1. Playtest multiple strategies
   - Full coverage (both Wardens active)
   - Minimal coverage (Wardens in corners)
   - Focused coverage (both Wardens in same area)
   - Record results for each strategy

2. Tune simulation parameters
   - Crime generation rates
   - Trust degradation rates
   - Corruption increase rates
   - Reporting likelihood thresholds
   - Goal: Make different strategies feel meaningfully different

3. Verify core loop satisfaction
   - Does placing Wardens feel meaningful?
   - Do reports reveal useful information?
   - Is audit surprising/revealing?
   - Are there "aha!" moments when patterns emerge?

4. Balance happiness calculation
   - Ensure happiness reflects choices clearly
   - Verify classifications match player experience
   - Adjust thresholds if classifications don't feel right

5. Polish flavor text
   - Ensure notable incidents are varied and interesting
   - Add personality to audit commentary
   - Make corruption action descriptions impactful

6. Bug fixes
   - Test edge cases (e.g., no crimes generated on a day)
   - Handle division by zero in calculations
   - Ensure state never becomes corrupted

### Acceptance Criteria
- [ ] Playing "full coverage" creates noticeably worse audit results
- [ ] Playing "light coverage" creates better happiness but more visible crime
- [ ] Different strategies produce different classifications
- [ ] No game-breaking bugs
- [ ] Simulation feels consistent and fair
- [ ] Reports and audit are interesting to read
- [ ] Core message comes through in gameplay

### Deliverable
Balanced, playable game that delivers on design intent.

---

## Post-MVP Testing Checklist

Before considering MVG complete, verify:

### Functional
- [ ] Game initializes correctly
- [ ] Can move both Wardens
- [ ] Can complete all 3 days
- [ ] Crimes generate and resolve
- [ ] Reports display accurate data
- [ ] Audit calculates correctly
- [ ] Can restart game

### Experiential
- [ ] Understand what I'm supposed to do
- [ ] Placement feels meaningful
- [ ] Curious about results after running day
- [ ] Reports reveal useful information
- [ ] Surprised/impacted by audit results
- [ ] Want to play again with different strategy

### Technical
- [ ] No console errors
- [ ] Performance is smooth
- [ ] State management is clean
- [ ] Code is readable for future expansion

---

## Known Limitations (Acceptable for MVG)

These are intentionally left simple for MVG:
- Fixed patrol radius (no player choice)
- No budget management
- No hiring new Wardens
- No training day
- No different Warden types
- Simple crime types
- Basic happiness calculation
- Limited flavor text variety
- 3 days only (very short)

These will be addressed in full game.

---

## Expansion Path to Full Game

After MVG proves the concept:

1. **Milestone 9**: Expand grid to 15x15, population to 100
2. **Milestone 10**: Add budget slider and hiring system
3. **Milestone 11**: Implement variable patrol radius
4. **Milestone 12**: Add Warden types (Investigators, Auditors)
5. **Milestone 13**: Extend to 14 days with training day
6. **Milestone 14**: Enhanced crime generation and citizen simulation
7. **Milestone 15**: Complaint tracking and mid-day decisions
8. **Milestone 16**: Polish and balance for full game

---

## Development Tips

**Start with console logging**
- Print simulation results before building UI
- Verify logic works before making it pretty

**Test incrementally**
- Don't wait until Milestone 8 to test
- Play the game after each milestone
- Catch issues early

**Prioritize feel over features**
- Better to have 3 meaningful days than 14 shallow ones
- Focus on moments of realization and surprise
- The audit reveal is the most important part

**Expect iteration**
- First simulation parameters won't be right
- Flavor text will need multiple passes
- UI layout will evolve

**Keep full game in mind**
- Write code that can scale
- Don't hardcode MVG-specific values
- Structure allows expansion without rewrite
