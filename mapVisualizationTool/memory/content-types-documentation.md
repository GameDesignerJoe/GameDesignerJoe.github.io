# Content Types Documentation

## Overview

The content type system provides a flexible framework for defining different types of content that can be placed on the map. Each content type defines its visual appearance, distribution rules, and special properties that control its behavior in the world.

## Core Properties

Every content type includes the following core properties:

### Basic Identification
- `id`: Unique identifier for the content type
- `name`: Human-readable name
- `category`: Content category (Debug, Combat, Exploration, Resource, Mission, Travel, Restoration)
- `description`: Detailed description of the content type

### Visual Properties
- `color`: Main color for the shape
- `shape`: Shape type (circle, square, hexagon, diamond)
- `size`: Diameter in meters
- `opacity`: Opacity value between 0 and 1
- `borderSize`: Border width in pixels
- `borderColor`: Border color
- `label`: Text label for the shape
- `showLabel`: Whether to display the label

### Distribution Properties
- `quantity`: Number of instances to generate
- `minSpacing`: Minimum distance between same type in meters
- `canOverlap`: Whether instances can overlap
- `mapWidthKm`: Map width in kilometers (optional)
- `mapHeightKm`: Map height in kilometers (optional)

### Instance Properties
- `defaultProperties`: Default properties for new instances

### Minimum Distance Visualization
- `showMinDistanceRing`: Whether to show minimum distance ring
- `minDistanceMeters`: Minimum distance in meters
- `minDistanceRingColor`: Color of the minimum distance ring
- `minDistanceRingStyle`: Style of the minimum distance ring (solid/dashed)

## Content Type Categories

### Debug
Used for development and testing purposes.

#### Debug1
- Purpose: Basic debug visualization
- Default Properties:
  - Color: Blue (#0000FF)
  - Shape: Circle
  - Size: 10 meters
  - Default Quantity: 100
  - No minimum spacing

#### Debug2
- Purpose: Alternative debug visualization
- Default Properties:
  - Color: Magenta (#FF00FF)
  - Shape: Circle
  - Size: 10 meters
  - Default Quantity: 100
  - No minimum spacing

### Combat

#### Enemies
- Purpose: Basic enemy encounters
- Default Properties:
  - Color: Red (#FF0000)
  - Shape: Circle
  - Size: 15 meters
  - Default Quantity: 500
  - Opacity: 0.8

#### Bosses
- Purpose: Major enemy encounters
- Default Properties:
  - Color: Red (#FF0000)
  - Shape: Diamond
  - Size: 30 meters
  - Default Quantity: 12
  - Opacity: 0.8

### Exploration

#### Points of Interest
- Purpose: Notable locations for exploration
- Default Properties:
  - Color: Light Blue (#00BFFF)
  - Shape: Hexagon
  - Size: 50 meters
  - Default Quantity: 100
  - Opacity: 0.9

### Mission

#### Mission Locations
- Purpose: Quest and mission objectives
- Default Properties:
  - Color: Gold (#FFD700)
  - Shape: Hexagon
  - Size: 40 meters
  - Default Quantity: 20
  - Opacity: 0.9

### Travel

#### Starting Location
- Purpose: Player spawn points
- Default Properties:
  - Color: Green (#32CD32)
  - Shape: Diamond
  - Size: 100 meters
  - Default Quantity: 1
  - Opacity: 1.0

#### Fast Travel Locations
- Purpose: Quick travel points
- Default Properties:
  - Color: Purple (#9370DB)
  - Shape: Hexagon
  - Size: 25 meters
  - Default Quantity: 25
  - Opacity: 0.9
  - **Minimum Spacing**: 500 meters
    - Ensures Fast Travel points are well-distributed
    - Prevents clustering of travel options
    - Maintains strategic value of each location

### Restoration

#### Restoration Locations
- Purpose: Health/resource restoration points
- Default Properties:
  - Color: Cyan (#00FFFF)
  - Shape: Square
  - Size: 50 meters
  - Default Quantity: 50
  - Opacity: 0.8

## Usage Examples

### Creating a Basic Content Type
```typescript
const basicType: ContentTypeBase = {
  id: 'example',
  name: 'Example Type',
  category: 'Exploration',
  description: 'Example content type',
  color: '#3498db',
  shape: 'circle',
  size: 20,
  quantity: 50,
  minSpacing: 100,
  canOverlap: false,
  opacity: 0.8
};
```

### Creating a Fast Travel Location
```typescript
const fastTravelPoint: ContentTypeBase = {
  id: 'fast-travel',
  name: 'Fast Travel Point',
  category: 'Travel',
  description: 'Quick travel location',
  color: '#9370DB',
  shape: 'hexagon',
  size: 25,
  quantity: 1,
  minSpacing: 500, // Enforced minimum distance
  canOverlap: false,
  opacity: 0.9,
  showLabel: true,
  label: 'Fast Travel'
};
```

## Best Practices

1. **Spacing Configuration**
   - Set appropriate minimum spacing based on content purpose
   - Consider content size when setting spacing
   - Use larger spacing for important locations (e.g., Fast Travel)
   - Test spacing with different map scales

2. **Visual Design**
   - Use distinct colors for different categories
   - Choose appropriate shapes for content type
   - Set size based on real-world importance
   - Consider opacity for visual layering

3. **Distribution**
   - Set reasonable quantities for map size
   - Consider overlap rules carefully
   - Test distribution with various map sizes
   - Validate spacing requirements

4. **Properties**
   - Always set default properties
   - Include descriptive labels
   - Configure appropriate visualization options
   - Document special properties

## Integration with Systems

### Distribution System
- Respects minimum spacing requirements
- Handles content type-specific constraints
- Validates placement against map boundaries
- Supports different distribution strategies

### Rendering System
- Renders shapes according to type specifications
- Handles opacity and borders
- Supports labels and debug visualization
- Scales properly with zoom levels

### Validation System
- Enforces minimum spacing rules
- Validates against map boundaries
- Checks for valid placement areas
- Handles content type-specific rules
