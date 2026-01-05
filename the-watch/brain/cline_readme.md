# The Watch - Project Overview for Cline AI

## READ THIS FIRST

This document provides context for the AI assistant (Cline) working on this project. It explains the game's purpose, development philosophy, and how to approach building it.

---

## What We're Building

**The Watch** is a strategic game about authority, surveillance, and community trust. Players manage law enforcement in a town, making decisions about resource allocation and Warden placement. The game's hook: what looks like successful crime reduction is actually creating an oppressive surveillance state that erodes community wellbeing.

**Core Theme**: More authority ≠ more safety. The game reveals this through hidden metrics that only appear in a final audit.

**Target Experience**: 
- 15-30 minute playthrough
- Immediate desire to replay with different strategy
- Emotional impact when audit reveals the truth
- Reflection on real-world parallels

---

## Development Philosophy

### Start Small, Prove the Concept

We're building **MVG (Minimum Viable Gameplay)** first - the smallest version that proves the core loop is fun. Only after MVG is complete and enjoyable do we expand to the full game.

**Why this matters:**
- If the core loop isn't engaging at small scale, adding complexity won't fix it
- MVG lets us iterate quickly on game feel
- We validate the emotional impact (audit reveal) before investing in depth
- Prevents building elaborate systems for a game that isn't fun

### MVG Specifications

- **Grid**: 5x5 (25 squares)
- **Population**: 10 citizens total (8 civilians + 2 Wardens)
- **Duration**: 3 days
- **Mechanics**: Simplified - no budget slider, no hiring, fixed patrol radius, basic crime types
- **Goal**: Prove that placement → simulation → report → audit loop is engaging

### Full Game Specifications

- **Grid**: 15x15 (225 squares)
- **Population**: 100 citizens (civilians + Wardens)
- **Duration**: 14 days + training day
- **Mechanics**: Full budget system, hiring, multiple Warden types, variable patrol radius, decision prompts
- **Goal**: Deep, replayable experience with emergent strategies

---

## Document Structure

You have access to six key documents:

### MVG Documents (Build These First)
1. **MVG-GDD**: Game design for minimum version
2. **MVG-TDD**: Technical implementation for MVG
3. **MVG-Milestone Plan**: 8-step build process for MVG

### Full Game Documents (Build These After MVG Works)
4. **Full-GDD**: Complete game design
5. **Full-TDD**: Full technical architecture
6. **Full-Milestone Plan**: 12-step expansion from MVG to full game

---

## How to Approach Development

### Phase 1: Build MVG (Milestones 1-8)

**Follow the MVG-Milestone Plan exactly.** Each milestone builds on the previous and includes acceptance criteria. Don't skip ahead.

**Key Milestones:**
1. Foundation & Grid Display
2. Warden Placement
3. Core Simulation Logic
4. Day Transition & Report Display
5. Crime & Warden Visualization
6. Independent Audit System
7. Intro & Game Flow Polish
8. Balance & Tuning

**Completion Criteria:**
- All 8 milestones done
- Game is playable start to finish
- Audit reveal feels impactful
- Developer wants to play again

### Phase 2: Validate MVG

Before moving to full game:
- Play MVG multiple times
- Try different strategies (heavy coverage, light coverage, focused coverage)
- Verify audit reveals make sense
- Confirm the emotional beat works ("Oh no, what have I done?")
- Get feedback if possible

**If MVG isn't fun or impactful, FIX IT before expanding.** Adding features won't save a weak core.

### Phase 3: Expand to Full Game (Milestones 9-20)

Once MVG is validated, follow the Full Game Milestone Plan:
9. Scale to Full Grid & Population
10. Budget System
11. Multiple Warden Types
12. Variable Patrol Radius
13. Training Day Tutorial
14. Decision System
15. Enhanced Crime Generation
16. Citizen Simulation Depth
17. Enhanced Report System
18. Comprehensive Audit System
19. Polish & Balance
20. Final Features & Release Prep

---

## Development Principles

### 1. Function Over Flash
Build working systems before making them pretty. Console.log the simulation results before building the UI. Get mechanics right, then polish.

### 2. Test Constantly
After each milestone, play the game. Don't wait until the end to discover something doesn't work. Catch issues early.

### 3. Balance is Everything
The game's message depends on balance. Players must be able to achieve "Balanced Community" but it shouldn't be obvious. Over-policing must feel wrong. Spend significant time tuning numbers.

### 4. Respect the Architecture
The TDD documents include data structures for a reason. They're designed to scale from MVG to full game. Don't shortcut them with quick hacks that will need rewriting.

### 5. Keep It Simple
When faced with implementation choices, choose simpler. Complex systems are harder to debug and balance. Elegant simplicity beats clever complexity.

### 6. Trust the Process
The milestone structure is deliberate. Each builds on the previous. Don't skip around or try to do everything at once. Sequential progress is faster than parallel chaos.

---

## Critical Technical Notes

### State Management
- Use React useReducer for game state (it will get complex)
- All game state should flow through the reducer
- Keep components thin, logic in systems/

### Simulation Architecture
The simulation should be pure functions that take current state and return new state. This makes it:
- Testable (run simulation without UI)
- Debuggable (log inputs/outputs)
- Deterministic (same inputs = same outputs)

### Performance Considerations
- MVG (25 squares, 10 citizens): No performance concerns
- Full Game (225 squares, 100 citizens): Needs memoization and efficient algorithms
- Build with performance in mind from the start

### Data Flow
```
User Input → Reducer → New State → Simulation → Updated State → UI Render
```

Keep this flow unidirectional and clear.

---

## What Makes This Game Work

### The Hidden Truth
Players see crime statistics and think they're winning. The audit reveals:
- Crimes they never knew about (unreported due to low trust)
- Warden corruption (false arrests, violence, harassment)
- Citizen unhappiness (their "success" created misery)

**This only works if:**
1. Players genuinely try to minimize crime
2. Heavy policing actually reduces visible crime (they think it's working)
3. The audit reveal is surprising and impactful
4. Players immediately want to try a different approach

### The Emergent Strategy
Players should discover through gameplay:
- Light Watch presence preserves trust
- High trust = better reporting (you see more crime, but that's good)
- Over-policing blinds you (citizens stop reporting)
- Corruption grows with both boredom and burnout
- Budget allocation affects town services, which affects crime

**None of this should be explicitly told.** Players figure it out through the feedback loop of placement → report → audit.

---

## Common Pitfalls to Avoid

### Don't Build Everything at Once
Milestone structure exists for a reason. Build incrementally, test frequently.

### Don't Optimize Prematurely
Get it working, then make it fast. Profile before optimizing.

### Don't Overthink the Simulation
The simulation doesn't need to be realistic, it needs to be balanced. Abstract, simplified systems that create the right player experience are better than complex realistic systems that are hard to balance.

### Don't Ignore the Audit
The audit is the most important part of the game. It's the punchline. If the audit isn't impactful, the game fails. Spend time making it reveal the truth effectively.

### Don't Skip Playtesting
You can't balance by theory. You must play the game. Multiple times. With different strategies.

---

## Visual Design Notes

**Aesthetic**: Minimalist, inspired by Mini Metro
- Clean geometric shapes
- Limited color palette (blues for Wardens, reds for crime, grays for neutral)
- Simple sans-serif typography
- Ample whitespace
- Smooth transitions

**Why this aesthetic**: 
- Focuses attention on the data/map
- Feels clinical and bureaucratic (fits theme)
- Easy to read and scan
- Professional/serious tone

**Not going for**: 
- Cartoon/playful style
- Realistic graphics
- Busy/detailed interface

---

## Success Metrics

### MVG Success
- Playable start to finish
- Takes 5-10 minutes
- Audit reveal creates "oh no" moment
- Developer wants to play again

### Full Game Success
- All systems functional and balanced
- Takes 15-30 minutes
- Multiple distinct strategies viable
- "Balanced Community" achievable but not obvious
- Players reflect on real-world parallels after playing

---

## When to Ask for Help

If you encounter:
- **Unclear requirements**: Ask for clarification
- **Balance questions**: Suggest values but note they need playtesting
- **Design decisions**: Present options with tradeoffs
- **Technical challenges**: Explain the problem before implementing hacky solutions

The developer (Joe) is collaborative and appreciates good questions.

---

## Final Notes

This is a game with a message. The technical implementation serves the emotional experience. Every system - crime generation, corruption growth, trust degradation - exists to create the moment of realization when the audit drops.

Build it piece by piece. Test constantly. Trust the process.

The core loop is: 
**Place Wardens → Watch day unfold → Read report → Adjust strategy → Repeat → Audit reveals the truth**

If that loop is engaging and the reveal is impactful, we've succeeded.

Now go build the MVG. Start with Milestone 1.
