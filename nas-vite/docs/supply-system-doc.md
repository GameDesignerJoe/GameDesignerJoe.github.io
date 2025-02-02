# Not All Survive - Supply & Durability Systems Design Document

## Design Philosophy
The supply and durability systems in "Not All Survive" are designed to create meaningful player choices that reflect the genuine challenges faced by Antarctic explorers. Players must balance essential needs against weight constraints, durability concerns, and emergency preparations.

Each item choice carries both immediate and long-term consequences. A player who neglects repair kits might save weight initially but face critical equipment failures later. Similarly, choosing between multiple food types isn't just about calories - it's about managing spoilage, preparation requirements, and emergency reserves.

The system aims to create "interesting failures" where players don't simply die from a single poor choice, but rather face cascading challenges that force creative solutions with deteriorating resources.

## Core Design Goals
1. **Historical Authenticity**: Equipment, weights, and durability reflect real Antarctic expedition records
2. **Meaningful Choices**: Every item selected or left behind significantly impacts survival strategy
3. **Dynamic Resource Management**: Items deteriorate, requiring active maintenance and careful use
4. **Emergent Gameplay**: Systems interact to create unique survival scenarios
5. **Educational Value**: Players learn about actual expedition planning through gameplay

## Interface Design

### Supply Selection Screen
- **Two-Column Layout**
  - Left: Available items with historical tooltips
  - Right: Selected items with running weight total
- **Quick Selection Options**
  - "Standard Load" button for historically accurate default loadout
  - Category filters for easy item location
- **Mobile Considerations**
  - Tooltips activated by (i) icon tap
  - Swipe between categories
  - Clear weight indicators

### In-Game Interface
- **Inventory Access**
  - Backpack icon near compass
  - Only available during camp actions
- **Item Status Display**
  - Durability state shown in item name
  - Clear usage requirements
  - Warning indicators for critical items

## Core Mechanics

### Weight Management
- Total weight affects:
  - Movement speed
  - Stamina consumption
  - Terrain accessibility
- Dynamic weight reduction as supplies are consumed
- Strategic item abandonment decisions

### Resource Consumption
- Food items require specific conditions
  - Some need cooking (stove + fuel)
  - Others edible while moving
- Items deteriorate through:
  - Normal use
  - Environmental exposure
  - Critical events
  - Time passage

### Repair System
- Location restrictions
  - Most repairs require camping
  - Some need specific weather conditions
- Resource management
  - Limited repair kit uses
  - Repair effectiveness varies
  - Different kits for different items

## Item Categories & Effects

### Design Philosophy Per Category

#### Food & Provisions
- Balanced for 20-day expeditions
- Multiple food types serve different purposes:
  - Pemmican for reliable nutrition
  - Chocolate for emergency energy
  - Dried goods for weight efficiency

#### Equipment
- Core items essential for survival
- Each item serves multiple purposes
- Durability affects effectiveness

#### Navigation & Scientific
- Affects movement efficiency
- Provides crucial information
- Variable reliability based on conditions

#### Clothing
- Layered protection system
- Environmental interaction
- Wear patterns affect performance

#### Medical Supplies
- Limited use resources
- Critical for specific conditions
- Preventative and reactive uses

#### Repair Items
- Specialized vs general tools
- Limited use mechanics
- Effectiveness varies by condition

## Durability System

### Core Concept
Durability represents both physical wear and functional effectiveness. The system creates a maintenance mini-game where players must balance repair resources against item replacement.

### State Effects
Each durability state affects items differently:
- Pristine items work optimally
- Poor condition items risk failure
- Broken items may be salvageable
- Ruined items become unusable

### Strategic Elements
- Repair timing decisions
- Resource allocation choices
- Risk assessment with damaged items
- Backup equipment planning

## Historical Elements

### Authentic Details
- Equipment lists based on:
  - Shackleton's Endurance expedition
  - Scott's Terra Nova expedition
  - Amundsen's successful Pole journey

### Educational Integration
- Tooltips provide historical context
- Equipment choices reflect period capabilities
- Failure scenarios mirror historical challenges

### Accuracy Considerations
- Weights from expedition records
- Tool effectiveness based on accounts
- Environmental effects from journals

## Implementation Guidelines

### Priority Features
1. Core supply selection interface
2. Basic durability tracking
3. Essential repair mechanics
4. Item status display

### Future Enhancements
1. Advanced repair options
2. Environmental deterioration
3. Salvage mechanics
4. Emergency conversions

### Balance Considerations
- Initial weight limits
- Durability decay rates
- Repair effectiveness
- Resource consumption rates

## Technical Requirements

### Data Structure
- Item properties tracking
- State management
- Event triggers
- Usage history

### UI Elements
- Clear status indicators
- Intuitive controls
- Mobile compatibility
- Feedback systems

### System Integration
- Weather effects
- Movement impacts
- Camp mechanics
- Resource tracking

## References
[Historical documentation would be listed here]