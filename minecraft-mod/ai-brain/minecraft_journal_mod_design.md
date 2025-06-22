# Minecraft Journal Mod - Design Document

## Overview
A Minecraft mod that adds discoverable journal entries throughout the world, telling the stories of various NPCs through written logs. Players can find these journals in sequence and use a special compass to locate undiscovered entries.

## Technical Specifications
- **Platform**: Minecraft Java Edition 1.21.6
- **Mod Loader**: Fabric
- **Target**: Single-player and multiplayer compatible

## Core Features

### 1. Journal Blocks
- **Custom blocks** that players can interact with to read story entries
- **Multiple variants** - different colored/textured blocks for different storylines
- **Interaction**: Right-click to open reading interface
- **Collectible**: Players can break and collect journals to display in their homes
- **Visual indicator**: Should be clearly distinguishable from vanilla blocks
- **Story persistence**: Reading progress tied to journal content, not block location

### 2. Story System
- **Sequential progression**: Players always receive entries in predetermined order
- **Multiple storylines**: Each character has their own independent sequence
- **Pre-written content**: All story entries authored beforehand
- **Player progress tracking**: System remembers which entries each player has discovered
- **Cross-session persistence**: Progress saved between game sessions

### 3. Journal Compass
- **Custom item** that points toward nearest undiscovered journal
- **Universal targeting**: Points to journals from any storyline
- **Visual feedback**: Clear directional indication
- **Range considerations**: Effective range limitations to prevent trivializing exploration

### 4. World Generation
- **Spawn area placement**: Guaranteed journal within 50-100 blocks of spawn point
- **Scattered placement**: Journals distributed throughout the world at various distances
- **Biome integration**: Consider placing journals in appropriate biomes for story context
- **Structure integration**: Some journals placed in existing structures (villages, ruins, dungeons)
- **Distance balancing**: Ensure reasonable spacing between journal locations

## Data Structure

### Storyline Configuration
```
Storyline {
  - id: unique identifier
  - name: character/story name
  - entries: ordered list of story texts
  - block_variant: which journal block texture to use
  - placement_rules: where this storyline's journals can spawn
}
```

### Player Progress Tracking
```
PlayerData {
  - player_uuid: unique player identifier
  - discovered_entries: map of storyline_id -> entry_index
  - journal_locations: coordinates of placed journals (for compass)
}
```

## Implementation Phases

### Phase 0: Setup & Hello World
1. Install Java Development Kit (JDK 21)
2. Install IntelliJ IDEA or Visual Studio Code
3. Set up Fabric development environment
4. Create basic mod structure using Fabric template
5. Implement "Hello World" mod - simple block that prints message to chat when clicked
6. Test mod loading and basic functionality
7. Set up art tools for texture creation (Paint.NET, GIMP, or Aseprite)
8. Create basic placeholder textures

### Phase 1: Core Mechanics
1. Create basic journal block (single variant)
2. Implement reading interface/GUI
3. Create story data structure
4. Implement player progress tracking
5. Basic interaction (right-click to read)

### Phase 2: World Integration
1. Implement world generation placement system
2. Create guaranteed spawn journal placement
3. Add scattered world placement
4. Test journal discovery and progression

### Phase 3: Navigation System
1. Create journal compass item
2. Implement compass pointing mechanics
3. Add compass crafting recipe
4. Test compass functionality

### Phase 4: Art & Textures
1. Create final journal block textures for each storyline
2. Design journal compass texture and model
3. Create particle effects for journal discovery
4. Add custom GUI elements for reading interface
5. Polish visual presentation
1. Extend system for multiple journal block variants
2. Create textures for different storylines
3. Implement storyline-specific placement rules
4. Test multiple concurrent storylines

### Phase 5: Multiple Storylines
1. Extend system for multiple journal block variants
2. Implement storyline-specific placement rules
3. Test multiple concurrent storylines
4. Create storyline selection/tracking systems

### Phase 6: Polish & Balance
1. Refine world generation placement algorithms
2. Balance compass range and effectiveness
3. Add sound effects and particle effects
4. Optimize performance
5. Comprehensive testing

## User Experience Flow

1. **Discovery**: Player explores world and finds journal compass or first journal
2. **First Read**: Player interacts with journal, reads first story entry
3. **Progression**: Player uses compass to locate next journal
4. **Sequential Story**: Each journal reveals the next entry in sequence
5. **Multiple Stories**: Player can pursue multiple character storylines simultaneously
6. **Completion**: Player experiences complete narratives through exploration

## Tools & Requirements

### Development Environment
- **Java Development Kit (JDK 21)** - Required for Minecraft 1.21.6
- **IDE**: IntelliJ IDEA Community (recommended) or Visual Studio Code
- **Fabric MDK** - Mod development kit template
- **Git** - Version control (recommended)

### Art & Texture Tools
- **Paint.NET** (Windows, free) - Good for beginners
- **GIMP** (Cross-platform, free) - More advanced features
- **Aseprite** (Paid, ~$20) - Excellent for pixel art
- **Photoshop/Krita** - Professional alternatives

### Texture Requirements
- **16x16 pixels** - Standard Minecraft block texture size
- **PNG format** with transparency support
- **Consistent art style** with vanilla Minecraft textures

## Technical Considerations

### Data Persistence
- Player progress must persist across sessions
- Story progress tied to journal content, not world location
- World generation data needs to be consistent
- Multiplayer synchronization for shared worlds
- Handle journal relocation (players moving collected journals)

### Performance
- Efficient compass update mechanics
- Optimized world generation to prevent lag
- Memory management for story data

### Compatibility
- Ensure compatibility with other world generation mods
- Consider conflicts with other compass-type items
- Maintain save file compatibility

## Content Planning

### Initial Implementation
- **Single storyline** with 12 journal entries
- **Basic journal block** design
- **Simple compass** functionality

### Future Expansion
- **Multiple character storylines** (3-5 characters)
- **Themed journal blocks** per character
- **Advanced placement rules** (biome-specific, structure-specific)
- **Enhanced compass features** (distance indication, multiple compass types)

## Success Metrics
- Journals spawn correctly in new worlds
- Story progression works sequentially
- Compass accurately points to nearest undiscovered journal
- Player progress persists across sessions
- No significant performance impact on world generation
- Compatible with multiplayer environments