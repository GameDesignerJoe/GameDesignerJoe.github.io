# The Watch - Full Game Milestone Plan

## Overview
This milestone plan builds upon the MVG foundation to create the complete 14-day experience with full budget management, multiple Warden types, decision systems, and comprehensive audit mechanics.

**Prerequisites**: MVG must be complete and proven fun before starting full game development.

**Total Estimated Timeline**: 20-30 development sessions beyond MVG

---

## Milestone 9: Scale to Full Grid & Population
**Goal**: Expand from 5x5/10 citizens to 15x15/100 citizens

### Tasks

1. **Update Constants**
   ```javascript
   const GRID_SIZE = 15; // was 5
   const CITIZEN_COUNT = 100; // was 10
   const STARTING_WARDENS = 5; // was 2
   const TOTAL_DAYS = 14; // was 3
   ```

2. **Refactor Grid Generation**
   - Update `generateGrid()` to handle 15x15 (225 squares)
   - Maintain density distribution ratios (30% low, 50% medium, 20% high)
   - Verify performance with 225 squares

3. **Refactor Citizen Generation**
   - Update `generateCitizens()` to create 100 citizens
   - Add workLocation to citizens (different from homeLocation)
   - Ensure diverse distribution across grid

4. **Refactor Warden Initialization**
   - Start with 5 Wardens instead of 2
   - Update default placement logic for larger grid
   - Adjust patrol radius defaults for larger scale

5. **Update Visual Layout**
   - Grid styling for 15x15 (may need smaller squares)
   - Ensure map remains readable
   - Test responsive layout on different screen sizes

6. **Performance Testing**
   - Verify simulation runs smoothly with 100 citizens
   - Check crime generation with larger population
   - Ensure map rendering is smooth

### Acceptance Criteria
- [ ] 15x15 grid renders correctly
- [ ] 100 citizens initialize with home and work locations
- [ ] 5 Wardens start in reasonable default positions
- [ ] Simulation completes in reasonable time
- [ ] Visual layout is clean and readable
- [ ] All MVG mechanics still work at new scale

### Deliverable
Scaled-up version of MVG with 14 days instead of 3, but still simple mechanics.

---

## Milestone 10: Budget System
**Goal**: Implement dynamic budget slider and hiring system

### Tasks

1. **Create Budget Slider Component**
   - Range: 5% to 100% in 5% increments
   - Visual feedback showing budget allocation
   - Display available Warden slots based on budget
   - Lock slider during training day

2. **Implement Hiring Mechanics**
   - Calculate available Warden slots from budget
   - Allow hiring when budget increases
   - Recruit from civilian population (mark citizen as Warden)
   - Inherit corruption from recruited citizen
   - Handle case when no slots available

3. **Budget Impact on Town Services**
   - Implement `calculateTownServicesQuality()` function
   - Generate operational notes based on budget level
   - Apply trust/corruption modifiers to all citizens
   - Display service degradation warnings in reports

4. **Visual Feedback**
   - Show budget percentage prominently
   - Indicate town health status (color coding?)
   - Display "X of Y Wardens deployed" counter
   - Warning messages when budget exceeds certain thresholds

5. **Balance Tuning**
   - Test different budget levels to ensure impact feels significant
   - Verify trust degradation at high budgets
   - Ensure corruption increases make sense
   - Adjust operational notes to be impactful but not overwhelming

### Acceptance Criteria
- [ ] Budget slider adjusts from 5% to 100%
- [ ] Available Warden slots calculate correctly (every 5% = 1 slot)
- [ ] Can hire new Wardens up to available slots
- [ ] Budget impacts citizen trust/corruption appropriately
- [ ] Operational notes appear in reports at high budgets
- [ ] Visual feedback is clear and informative
- [ ] High budget (80%+) creates visible negative effects

### Deliverable
Fully functional budget management system with town service impacts.

---

## Milestone 11: Multiple Warden Types
**Goal**: Add Investigators and Auditors alongside Street Wardens

### Tasks

1. **Update Warden Data Structure**
   - Add `type` field: "street" | "investigator" | "auditor"
   - Make position/patrolRadius optional (only for street)
   - Add type-specific fields (activeCases, solvedCases, whiteColarDetected)

2. **Create Warden Type Selector**
   - UI for choosing type when hiring
   - Display different icons/colors for each type
   - Show type capabilities in tooltip/description

3. **Implement Investigative Crime Category**
   - Define investigative crime types (murder, kidnapping, serious assault)
   - Create Case data structure
   - Implement case assignment logic
   - Implement case resolution over multiple days

4. **Implement White-Collar Crime Category**
   - Define white-collar crime types (embezzlement, fraud, tax evasion)
   - Generate white-collar crimes based on grid areas
   - Implement Auditor detection logic
   - Balance detection rates

5. **Update Crime Resolution System**
   - Route crimes to appropriate Warden type
   - Street Wardens handle street crimes (existing logic)
   - Investigators handle assigned cases
   - Auditors detect white-collar crimes

6. **Station Display Component**
   - Visual representation of station-based Wardens
   - Show active cases for Investigators
   - Show detection rates for Auditors
   - Make station clickable for details

7. **Type-Specific Corruption**
   - Investigators: fabricated evidence, biased arrests, bribes
   - Auditors: embezzlement, overlooking crimes, protection rackets
   - Different corruption manifestations in reports

8. **Update Reports**
   - Show breakdown by Warden type
   - Display Investigator case status
   - Display Auditor detection stats
   - Include type-specific incidents in notable events

### Acceptance Criteria
- [ ] Can hire Street, Investigator, or Auditor Wardens
- [ ] Each type has distinct gameplay function
- [ ] Investigative crimes get assigned to Investigators
- [ ] Auditors detect white-collar crimes
- [ ] Station display shows non-street Wardens clearly
- [ ] Type-specific corruption manifests appropriately
- [ ] Reports reflect all three types
- [ ] Different types feel meaningfully different to play

### Deliverable
Three distinct Warden types with unique mechanics and corruption patterns.

---

## Milestone 12: Variable Patrol Radius
**Goal**: Allow players to adjust Street Warden patrol coverage

### Tasks

1. **Add Patrol Radius UI**
   - Selector for each Street Warden: 1, 2, or 3
   - Visual preview of coverage when adjusting
   - Keyboard shortcuts for quick adjustment

2. **Update Patrol Zone Calculations**
   - Radius 1: 3x3 (9 squares)
   - Radius 2: 5x5 (25 squares)
   - Radius 3: 7x7 (49 squares)
   - Efficiently calculate which squares are covered

3. **Impact on Effectiveness**
   - Larger radius = lower effectiveness per square
   - Smaller radius = tighter control but more gaps
   - Adjust crime prevention/response rates accordingly

4. **Impact on Corruption**
   - Larger radius with low activity = more boredom
   - Smaller radius with high activity = more burnout
   - Balance corruption calculations

5. **Visual Feedback**
   - Blue overlay intensity shows effectiveness
   - Overlapping zones visible
   - Clear indication when changing radius

### Acceptance Criteria
- [ ] Can adjust each Street Warden's patrol radius
- [ ] Visual preview updates in real-time
- [ ] Larger radius covers more area but less effectively
- [ ] Radius impacts corruption calculations
- [ ] Visual feedback is clear and helpful
- [ ] Strategic choice between coverage and effectiveness feels meaningful

### Deliverable
Variable patrol radius system with strategic trade-offs.

---

## Milestone 13: Training Day Tutorial
**Goal**: Add Day 0 tutorial experience

### Tasks

1. **Create Training Day State**
   - Set currentDay to 0
   - Lock budget at 25%
   - Start with 5 Street Wardens
   - Flag isTrainingComplete = false

2. **Build Tutorial Flow**
   - Intro modal with explanatory text
   - Tooltips on first interactions
   - Guided placement of Wardens
   - Explanation of patrol radius
   - "Run Training Day" button

3. **Simplified Training Simulation**
   - Generate minimal crimes (ensure variety)
   - All resolutions positive (no corruption visible)
   - Citizens remain happy
   - Everything "works" as expected

4. **Training Day Report**
   - Glowing report with good stats
   - Explanation of report sections
   - "This is what success looks like" messaging
   - "Begin Day 1" button to start real game

5. **Unlock Real Game**
   - Unlock budget slider
   - Enable hiring
   - Enable decision prompts
   - Start real corruption/trust mechanics

### Acceptance Criteria
- [ ] Training day runs before Day 1
- [ ] Tutorial text explains core concepts
- [ ] Budget locked during training
- [ ] Training simulation has no negative consequences
- [ ] Report explains what player should expect
- [ ] Day 1 begins with full mechanics enabled
- [ ] Tutorial feels helpful without being patronizing

### Deliverable
Complete tutorial experience that teaches core mechanics.

---

## Milestone 14: Decision System
**Goal**: Add mid-turn decision prompts

### Tasks

1. **Create Decision Data Structures**
   - Decision type: discipline, petition, budget surplus, incident response
   - Options with impacts (trust, corruption, budget, specific targets)
   - Selection tracking

2. **Build Decision Prompt Component**
   - Modal overlay with decision text
   - 2-4 options as buttons
   - Clear presentation of choice
   - No indication of impact (player decides blind)

3. **Implement Decision Generators**
   - `generateDisciplineDecision()`: Warden misconduct
   - `generatePetitionDecision()`: Citizen requests
   - `generateBudgetSurplusDecision()`: Extra funding
   - `generateIncidentResponseDecision()`: Major events
   - Randomize which appear (0-2 per day)

4. **Decision Impact System**
   - Apply trust modifiers to citizens
   - Apply corruption modifiers to Wardens
   - Handle budget changes
   - Target specific Wardens or grid areas
   - Log decisions for audit

5. **Integrate into Game Flow**
   - After report, before placement
   - Must answer all decisions before continuing
   - Decisions affect next day's simulation
   - Audit reveals decision consequences

6. **Balance and Variety**
   - Ensure decisions feel meaningful
   - Impacts should be noticeable but not overwhelming
   - Generate different decision text for variety
   - Test different decision combinations

### Acceptance Criteria
- [ ] 0-2 decision prompts appear most days
- [ ] Decisions present moral/strategic dilemmas
- [ ] Must answer decisions before continuing
- [ ] Decision impacts affect game state
- [ ] Different decision types feel distinct
- [ ] Audit reveals long-term consequences of decisions
- [ ] Decisions add strategic depth without overwhelming

### Deliverable
Complete decision system with multiple types and meaningful impacts.

---

## Milestone 15: Enhanced Crime Generation
**Goal**: Sophisticated crime system with types, timing, and patterns

### Tasks

1. **Expand Crime Types**
   - Street: assault, theft, vandalism, drugs, harassment, traffic
   - Investigative: murder, kidnapping, robbery, serious assault
   - White-collar: embezzlement, fraud, tax evasion
   - Ensure variety in daily reports

2. **Time of Day System**
   - Assign crimes to time slots (morning, afternoon, evening, night)
   - Day crimes in commercial areas
   - Night crimes in residential areas
   - Use for flavor in reports

3. **Citizen-Based Crime Generation**
   - Each citizen has crime probability based on corruption
   - Track which citizen committed which crime
   - Citizen corruption increases crime frequency
   - Repeat offenders possible

4. **Location-Based Crime Generation**
   - Grid density affects base crime rate
   - Certain areas more prone to certain crimes
   - Patterns emerge naturally from density distribution

5. **Warden-Generated Crime Enhancement**
   - Corrupt Wardens manufacture incidents
   - More common in low-activity zones (boredom)
   - Harassment and traffic violations primarily
   - Count toward incident stats but erode trust

6. **Crime Victim Tracking**
   - Assign victimCitizenId to crimes
   - Track if victim got response
   - Victims with no response lose trust significantly
   - Track repeat victimization

7. **Witness System**
   - Assign witnessIds to crimes
   - Witnesses to corrupt actions lose trust
   - High witness count increases reporting likelihood
   - Witnesses remember for audit

### Acceptance Criteria
- [ ] Wide variety of crime types generated
- [ ] Crimes assigned to realistic times of day
- [ ] Citizens with high corruption commit more crimes
- [ ] Crime patterns emerge from grid density
- [ ] Corrupt Wardens manufacture incidents in quiet zones
- [ ] Victims and witnesses tracked accurately
- [ ] Crime generation feels dynamic and reactive

### Deliverable
Rich crime generation system with variety and emergent patterns.

---

## Milestone 16: Citizen Simulation Depth
**Goal**: Enhanced citizen behavior and state tracking

### Tasks

1. **Work Location System**
   - Citizens move between home and work conceptually
   - Affects which grid squares they're "present" in
   - Crimes can occur at home or work
   - Watch exposure tracks both locations

2. **Trust Level Thresholds**
   - Neighborhood Watch: 80-100 (proactive, reports everything)
   - Trusting: 60-79 (cooperative, reports most)
   - Neutral: 40-59 (reports major crimes only)
   - Wary: 20-39 (rarely reports, avoids Watch)
   - Hostile: 0-19 (never reports, antagonistic)

3. **Corruption Level Thresholds**
   - Law-Abiding: 0-20 (no criminal behavior)
   - Opportunistic: 21-50 (minor crimes if opportunity)
   - Habitual: 51-80 (regular criminal activity)
   - Criminal: 81-100 (frequent, serious crimes)

4. **Trust Degradation Factors**
   - Watch exposure: -2 per Warden in area per day
   - Witnessing violence: -10
   - Crime victim without response: -15
   - Service degradation: -1 to -5 per day
   - False arrest in neighborhood: -8

5. **Trust Recovery Factors**
   - Good response when victim: +5
   - No Watch exposure: +1 per day (gradual recovery)
   - Service improvements: +2 per day

6. **Corruption Growth Factors**
   - Low trust: +0 to +10 per day (scales)
   - High-crime area with no Watch: +5
   - Service failures: +3
   - Witnessing Warden corruption: +5
   - Economic pressure (random events): +2

7. **History Tracking**
   - Trust score history (per day)
   - List of experienced corrupt actions
   - Days as victim / days without response
   - For audit storytelling

### Acceptance Criteria
- [ ] Citizens transition between trust levels realistically
- [ ] Corruption grows in response to game conditions
- [ ] Trust and corruption interact (low trust → more corruption)
- [ ] History tracking enables rich audit stories
- [ ] Citizen behavior feels dynamic and responsive
- [ ] Can see emergent patterns (e.g., areas becoming hostile)

### Deliverable
Deep citizen simulation that drives crime and reporting behavior.

---

## Milestone 17: Enhanced Report System
**Goal**: Rich daily reports with narrative elements

### Tasks

1. **Expand Report Sections**
   - Crime Summary (stats)
   - Watch Deployment (details by type)
   - Notable Incidents (3-5 with flavor)
   - Citizen Feedback (trust indicators)
   - Operational Notes (budget impacts)
   - Budget Status

2. **Notable Incidents Generation**
   - Prioritize interesting crimes (murders, kidnappings, Warden-generated)
   - Mix of different types
   - Include location, time, resolution details
   - Mention Warden involvement naturally
   - 3-5 per day

3. **Citizen Feedback Indicators**
   - Anonymous tips (high trust areas)
   - No witnesses (low trust areas)
   - Complaint counts (corruption)
   - Neighborhood watch reports (very high trust)
   - Subtle trust indicators without showing scores

4. **Operational Notes Variety**
   - Service-specific impacts (library, hospital, roads, etc.)
   - Scale with budget level
   - Labor shortage hints (when many Wardens hired)
   - Progressive degradation over time

5. **Report Formatting**
   - Clean, professional layout
   - Easy to scan
   - Highlight important information
   - Consistent structure daily

### Acceptance Criteria
- [ ] Reports contain comprehensive information
- [ ] Notable incidents are interesting and varied
- [ ] Citizen feedback provides useful (but subtle) trust indicators
- [ ] Operational notes tell story of town degradation
- [ ] Reports are easy to read and informative
- [ ] Each report feels unique to that day

### Deliverable
Polished, informative daily reports that drive player decisions.

---

## Milestone 18: Comprehensive Audit System
**Goal**: Deep final review with detailed revelations

### Tasks

1. **Happiness Calculation**
   - Base 100 per citizen
   - Watch exposure penalty
   - Trust drop penalty
   - Witnessed corruption penalty
   - Service degradation penalty
   - Average across all non-Warden citizens

2. **Trust Distribution Calculation**
   - Count citizens at each trust level
   - Show distribution (chart or list)
   - Compare to starting distribution

3. **Warden Corruption Details**
   - List each Warden's corruption level
   - Enumerate corrupt actions with descriptions
   - Show days employed and activity level
   - Calculate impact score per Warden

4. **Crime Statistics Comparison**
   - Reported vs actual crimes
   - Gap reveals unreported crimes
   - False arrests count
   - Show where player was blind

5. **Classification System**
   - Balanced Community (ideal)
   - Authoritarian Success (effective but oppressive)
   - Police State (very oppressive)
   - Negligent Administration (hands-off, crime high)
   - Corrupted System (high corruption)
   - Failed State (everything bad)

6. **Commentary Generation**
   - 2-3 paragraph analysis
   - Specific to player's choices
   - Reference key decisions and outcomes
   - Explain classification
   - Balance critique with recognition

7. **Recommendations**
   - 3-5 specific suggestions
   - Based on what went wrong/right
   - Help player understand better strategy
   - Encourage replay with different approach

8. **Citizen Stories (Optional)**
   - Select 2-3 citizens with interesting arcs
   - Show their trust history over 14 days
   - Describe what they experienced
   - Make numbers human

### Acceptance Criteria
- [ ] Audit reveals all hidden information
- [ ] Happiness calculation reflects gameplay choices
- [ ] Warden corruption details are specific and damning
- [ ] Crime statistics show where player was blind
- [ ] Classification matches player's actual performance
- [ ] Commentary feels personal and insightful
- [ ] Recommendations are actionable
- [ ] Audit creates "aha!" moment for player

### Deliverable
Complete, impactful audit system that recontextualizes the game.

---

## Milestone 19: Polish & Balance
**Goal**: Tune all systems for optimal experience

### Tasks

1. **Playtesting Campaign**
   - Play through multiple strategies:
     - Minimal Watch (20-30% budget)
     - Balanced (40-50% budget)
     - Heavy Watch (70-80% budget)
     - Police State (95-100% budget)
   - Record outcomes for each
   - Document player experience notes

2. **Balance Adjustments**
   - Crime generation rates
   - Trust degradation rates
   - Corruption growth rates
   - Warden effectiveness
   - Budget impact thresholds
   - Decision impact magnitudes
   - Goal: Make "Balanced Community" achievable but not obvious

3. **Audit Threshold Tuning**
   - Classification thresholds
   - Ensure they match gameplay feel
   - Verify all classifications are achievable
   - Test edge cases

4. **Visual Polish**
   - Animation smoothness
   - Color scheme consistency
   - Hover states and feedback
   - Loading indicators
   - Micro-interactions
   - Overall aesthetic cohesion

5. **Text Polish**
   - Flavor text variety
   - Report clarity
   - Audit commentary impact
   - Tutorial helpfulness
   - Typos and grammar

6. **Performance Optimization**
   - Profile simulation performance
   - Optimize hot paths
   - Memoize expensive calculations
   - Ensure smooth experience even on Day 14

7. **Accessibility**
   - Keyboard navigation
   - Screen reader compatibility (basic)
   - Color contrast ratios
   - Text sizing
   - Focus indicators

8. **Bug Fixes**
   - Test all edge cases
   - Handle impossible states
   - Validate all calculations
   - Error boundaries
   - Graceful degradation

### Acceptance Criteria
- [ ] "Balanced Community" is achievable with optimal strategy
- [ ] All classifications are achievable with different strategies
- [ ] Game feels fair and consistent
- [ ] Visual polish is complete
- [ ] Text is clear, typo-free, and impactful
- [ ] Performance is smooth throughout
- [ ] No game-breaking bugs
- [ ] Basic accessibility standards met

### Deliverable
Polished, balanced full game ready for release.

---

## Milestone 20: Final Features & Release Prep
**Goal**: Add nice-to-have features and prepare for release

### Tasks

1. **Restart/New Game**
   - "New Game" button after audit
   - Confirm dialog (don't lose progress)
   - Clean state reset
   - Return to intro

2. **Save/Load System (Optional)**
   - Auto-save to localStorage after each day
   - Load game on mount if save exists
   - "Continue" vs "New Game" on start
   - Save metadata (day, date, version)
   - Handle version compatibility

3. **Statistics Tracking (Optional)**
   - Track games played
   - Best happiness score
   - Classifications achieved
   - Average stats across runs
   - Display in menu

4. **Export Audit (Optional)**
   - "Share Results" button
   - Generate shareable text or image
   - Copy to clipboard
   - Shows classification and key stats

5. **Settings Menu (Optional)**
   - Animation speed
   - Sound effects toggle (if added)
   - Reset progress
   - Credits

6. **Documentation**
   - README with setup instructions
   - Deployment guide
   - Code comments for key systems
   - Architecture overview

7. **Final Testing**
   - Complete playthrough from start to audit
   - Test all features
   - Verify save/load
   - Cross-browser testing (if standalone)
   - Mobile responsiveness check

### Acceptance Criteria
- [ ] Can restart game cleanly
- [ ] Save/load works reliably (if implemented)
- [ ] All optional features work as intended
- [ ] Documentation is complete
- [ ] Final testing reveals no critical bugs
- [ ] Game is ready for users

### Deliverable
Complete, polished game ready for release.

---

## Post-Release Roadmap

### Version 1.1 - Community Feedback
- Address user-reported bugs
- Balance adjustments based on player data
- Quality-of-life improvements
- Additional flavor text variety

### Version 1.2 - Enhanced Features
- More decision types
- Seasonal events
- Detailed citizen stories mode
- Sound effects and music

### Version 2.0 - Expanded Content
- Multiple towns with different demographics
- Custom difficulty settings
- Sandbox mode (no audit, just experiment)
- Achievement system

---

## Development Principles

**Iterate on MVG First**
- Don't start full game until MVG proves the concept
- MVG should be genuinely fun with minimal features
- If MVG isn't fun, full game won't save it

**Build Systems, Not Features**
- Create flexible systems that scale
- Avoid hardcoding values
- Think about future expansion
- Keep code modular and testable

**Playtest Constantly**
- Don't wait until the end
- Test after each milestone
- Get feedback from others
- Be willing to adjust based on play experience

**Balance is Critical**
- The game's message depends on balance
- "Balanced Community" must be achievable
- Over-policing must feel wrong
- Under-policing must have consequences
- Spend significant time tuning

**Polish Matters**
- Smooth animations make a difference
- Clear visual feedback prevents confusion
- Good writing sells the theme
- Small details create immersion

**Scope Discipline**
- Resist feature creep
- Focus on core experience
- Optional enhancements come after core is solid
- Ship a complete, polished core over feature-rich but rough

---

## Risk Management

**Performance with 100 Citizens**
- Mitigation: Profile early, optimize hot paths
- Fallback: Reduce to 75 citizens if necessary

**Balance Difficulty**
- Mitigation: Extensive playtesting with different strategies
- Fallback: Add difficulty settings to accommodate different play styles

**Complexity Overwhelming Players**
- Mitigation: Strong tutorial, clear UI, gradual introduction
- Fallback: Simplify systems, hide complexity

**Audit Not Impactful**
- Mitigation: Test audit reveal with players unfamiliar with design
- Fallback: Enhance commentary, add citizen stories, improve presentation

**Development Timeline**
- Mitigation: Milestone structure allows for adjustment
- Fallback: Cut optional features, focus on core experience

---

## Success Criteria

**Technical**
- [ ] Game runs smoothly on modern browsers
- [ ] No game-breaking bugs
- [ ] All systems function as designed
- [ ] Code is maintainable and documented

**Design**
- [ ] Core loop is engaging
- [ ] Strategic choices feel meaningful
- [ ] Audit reveal is impactful
- [ ] Message comes through clearly
- [ ] Different strategies produce different outcomes

**Player Experience**
- [ ] Tutorial teaches effectively
- [ ] Reports provide useful information
- [ ] Players want to replay with different strategies
- [ ] "Aha!" moment when audit reveals truth
- [ ] Players reflect on themes after playing

**Polish**
- [ ] Visual design is clean and cohesive
- [ ] Animations are smooth
- [ ] Text is clear and typo-free
- [ ] UI is intuitive
- [ ] Game feels complete and professional
