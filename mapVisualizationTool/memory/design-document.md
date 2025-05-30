# Fellowship Map Content Visualization Tool - Design Document

## 1. Project Overview

### 1.1 Purpose
The Map Content Visualization Tool will provide game designers with an intuitive interface for visualizing content distribution and density across the Fellowship game map. This tool will help designers understand spatial relationships between different content types, evaluate player progression paths, and optimize content placement for engaging gameplay experiences.

### 1.2 Goals
- Visualize content density and distribution across the game map
- Provide mathematical analysis of content density, player travel time, and engagement metrics
- Support rapid iteration of content distribution strategies
- Create shareable visualizations for team discussions
- Inform engineering resource requirements for content implementation

### 1.3 Scope
This tool is intended for high-level content planning and visualization, not precise content placement for implementation. It provides a "big picture" view of how different content types would be distributed across the game map based on designer-specified parameters.

## 2. User Requirements

### 2.1 Primary Users
Game designers who need to plan, visualize, and balance content across Fellowship's open world.

### 2.2 User Stories
- As a designer, I want to visualize how many enemy encounters would fit in a specific region, so I can plan content density.
- As a designer, I want to see the impact of increasing the number of activities on overall map density.
- As a designer, I want to experiment with different biome distributions to evaluate player exploration patterns.
- As a designer, I want to understand how different content types interact spatially, so I can create varied gameplay.
- As a design team, we want to share consistent visualizations to align on content strategy.

## 3. Core Functionality

### 3.1 Three-Panel Interface
The tool will provide a three-panel interface:

1. **Input Panel**: Form controls for configuring map parameters and content types
2. **Analysis Panel**: Text-based metrics and warnings based on content distribution
3. **Map Panel**: Visual representation of the map with placed content

### 3.2 Map Configuration
Designers can specify:
- Map dimensions (width and height in kilometers)
- Visual cell size for the grid overlay (visual representation only)
- Grid customization:
  - Visibility toggle
  - Color selection
  - Opacity control
- Grid only appears on non-transparent portions of the map

### 3.3 Content Definition
Designers can create content types with properties including:
- Name and category
- Visual representation (color, shape, icon)
- Size and shape
- Quantity and distribution parameters
- Placement rules (biome restrictions, overlap permissions)

### 3.4 Content Generation
The tool will algorithmically distribute content across the map based on specified parameters, following rules for:
- Biome constraints
- Spacing between similar content
- Proximity requirements to other content
- Overlap permissions

### 3.5 Analysis
The tool will calculate and display:
- Content density metrics (items per square kilometer)
- Estimated player travel times between content
- Balance metrics for different content categories
- Warnings for potential issues (overcrowding, empty zones)

### 3.6 Coordinate System and Visualization

#### 3.6.1 Normalized Coordinate System
The tool uses a normalized coordinate system (0-1) for storing content positions, providing several key advantages:

- **Resolution Independence**: Positions are stored as proportional values rather than absolute pixels
- **Persistence**: Coordinates remain valid even if the map or canvas dimensions change
- **Simplicity**: Easier to reason about positions as percentages of the map's dimensions

#### 3.6.2 Content Placement and Scaling
The system maintains accurate content placement through:

1. **Storage in Normalized Coordinates**: Content positions are stored as normalized (0-1) coordinates
2. **Dynamic Transformation**: A coordinate transformation system handles all scaling and offset calculations
3. **Consistent Scaling Logic**: The same scaling is applied to all content elements
4. **Final Rounding**: Pixel coordinates are only rounded at the final step

#### 3.6.3 Real-World Measurements
The system uses real-world measurements (meters) for content sizes:

1. **Real-World Measurement**: Sizes are specified in meters
2. **Pixels-Per-Meter Calculation**: System calculates pixels per meter at current scale
3. **Zoom Adjustment**: Base size is multiplied by current zoom level
4. **Consistent Scaling**: Same scaling factors applied to all elements

#### 3.6.4 Map Visualization
The map visualization includes:
- Color-coded biomes
- Icons/shapes for different content types
- Legend for map elements
- Optional square grid overlay (only visible on non-transparent portions of the map)
- Zoom and pan controls with pixel-perfect rendering
- Debug visualization options for content placement validation

### 3.7 Export/Sharing
Designers can export:
- PNG image of the map visualization
- Configuration data for recreating the visualization
- Analysis reports

## 4. Content Types and Properties

### 4.1 Core Content Properties
All content types will support the following properties:

#### Basic Properties
- **Name**: Identifier for the content type
- **Category**: High-level grouping (e.g., "Combat", "Exploration")
- **Description**: Brief explanation of this content type

#### Visual Properties
- **Color**: Primary display color
- **Shape**: Visual representation (circle, square, hexagon, etc.)
- **Size**: Dimensions in meters

#### Distribution Properties
- **Quantity**: Number of instances to place
- **Can Overlap**: Whether it can overlap with other content
- **Biome Restrictions**: Allowed/disallowed biomes
- **Minimum Spacing**: Required distance from same content type

### 4.2 Primary Content Types

#### 4.2.1 Biomes
Large regions with distinct environmental characteristics.
- **Unique properties**: Coverage percentage, edge roughness

#### 4.2.2 Points of Interest (POIs)
Significant locations like structures, landmarks, and facilities.
- **Unique properties**: Size variants, structure type

#### 4.2.3 Enemy Encounters
Combat encounters with hostile entities.
- **Unique properties**: Enemy count, formation pattern, difficulty

#### 4.2.4 Activities
Interactive gameplay elements beyond combat.
- **Unique properties**: Activity type, completion time, respawn behavior

#### 4.2.5 Restoration Locations
Areas players can transform through restoration mechanics.
- **Unique properties**: Size category (small, medium, large), restoration type

## 5. User Interface Design

### 5.1 Input Panel
The input panel will provide form controls organized into sections:

#### 5.1.1 Map Configuration
- Map dimensions (width/height)
- Grid settings
- Background map selection

#### 5.1.2 Content Library
- List of defined content types
- Controls for adding/editing/removing content types
- Content type detail form

#### 5.1.3 Generation Controls
- Generate button
- Seed input for reproducible generation
- Algorithm settings

### 5.2 Analysis Panel
The analysis panel will display metrics and insights:

#### 5.2.1 Content Metrics
- Total counts by content type
- Density calculations
- Distribution statistics

#### 5.2.2 Player Experience Metrics
- Travel time estimates
- Engagement predictions
- Content variety measures

#### 5.2.3 Warnings and Suggestions
- Highlight potential issues
- Suggest optimization opportunities

### 5.3 Map Panel
The map visualization will include:

#### 5.3.1 Main Visualization
- Color-coded map with content representation
- Optional grid overlay
- Dynamic scaling based on map size

#### 5.3.2 Legend
- Color and icon key for all content types
- Scale indicator

#### 5.3.3 Map Navigation
- Pan: Click and drag to move around the map
- Zoom: Mouse wheel to zoom in/out
- Reset: Return to initial view and position
- Visual feedback:
  - Cursor changes to indicate pan availability
  - Detail level updates with zoom changes
  - Grid scale adjusts automatically

## 6. Feature Roadmap

### 6.1 MVP (Phase 1)
Essential functionality to provide immediate value:
- Basic content type definition (3-4 types)
- Simple visualization with grid overlay
- Random content distribution with basic rules
- Core analysis metrics
- PNG export

### 6.2 Phase 2: Enhanced Content
- Full property framework for content types
- Content library with save/load functionality
- Additional content types
- Enhanced distribution algorithms

### 6.3 Phase 3: Advanced Visualization
- Interactive map (pan/zoom)
- Layer toggling
- Detailed tooltips
- Multiple visualization options

### 6.4 Phase 4: Advanced Analysis
- Gameplay time estimates
- Content balance analysis
- Progression path visualization
- Potential bottleneck identification

## 7. Design Considerations

### 7.1 Usability Principles
- Focus on ease of use for designers
- Provide clear visual feedback
- Minimize required inputs for basic functionality
- Support both quick iteration and detailed configuration

### 7.2 Performance Considerations
- Balance between visualization detail and performance
- Efficient grid rendering with integer-aligned coordinates
- Transparency mask caching per detail level
- Optimized pixel sampling for mask generation
- Memory-efficient content aggregation at different zoom levels
- Smooth transitions between detail levels

### 7.3 Extensibility
- Design for easy addition of new content types
- Support custom properties as needs evolve
- Allow for algorithm refinement over time

## 8. Appendix: Example Workflows

### 8.1 Example: Basic Map Configuration
1. Designer sets map size to 6km x 4km
2. Defines 3 biomes with relative sizes
3. Adds 50 enemy encounters and 20 POIs
4. Generates visualization
5. Exports PNG for team review

### 8.2 Example: Content Density Analysis
1. Designer loads existing map configuration
2. Adjusts enemy encounter quantity from 50 to 100
3. Generates new visualization
4. Reviews density metrics
5. Adjusts encounter spacing based on analysis
6. Regenerates and compares results

### 8.3 Example: Progression Planning
1. Designer defines progressive difficulty zones
2. Places POIs as progression milestones
3. Adds encounter density appropriate to each zone
4. Analyzes player paths between milestones
5. Adjusts content to create appropriate pacing
