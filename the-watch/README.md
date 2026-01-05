# The Watch - MVG

A strategic game about authority, surveillance, and community trust.

## Current Status: Milestone 1 Complete ✓

### Milestone 1: Foundation & Grid Display
- ✓ React project structure set up
- ✓ Data structures and types defined
- ✓ MapView component (5x5 grid) rendering
- ✓ Initialization system implemented
- ✓ Grid displays on mount with crime densities

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The game will open at http://localhost:3000

## Development Progress

### Completed
- [x] **M1: Foundation & Grid Display** - Basic game board rendering

### Next Steps
- [ ] **M2: Warden Placement** - Allow positioning Wardens on grid
- [ ] **M3: Core Simulation Logic** - Implement day simulation
- [ ] **M4: Day Transition & Report Display** - Show simulation results
- [ ] **M5: Crime & Warden Visualization** - Rich map visualization
- [ ] **M6: Independent Audit System** - Final review calculation
- [ ] **M7: Intro & Game Flow Polish** - Complete experience
- [ ] **M8: Balance & Tuning** - Ensure gameplay delivers intended experience

## Architecture

```
/src
  /components
    GameController.jsx - Main game orchestrator
    MapView.jsx - Grid display
    GridSquare.jsx - Individual cell
  /systems
    initialization.js - Game state setup
  /utils
    constants.js - Game configuration
  /types
    types.js - Type definitions
```

## Debug Features

The debug panel (bottom right) shows:
- Current game phase
- Citizen and Warden counts
- Grid square count
- Crime density distribution

## Documentation

See `/brain` folder for complete design documentation:
- `cline_readme.md` - Development guide
- `mvg_gdd.md` - MVG game design
- `mvg_tdd.md` - MVG technical design
- `mvg_milestone_plan.md` - Development milestones
