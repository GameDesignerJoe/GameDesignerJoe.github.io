# Debug Dots System Features

## Overview

The Debug Dots system serves as a reference implementation for content visualization in the Map Visualization Tool. It demonstrates the full range of features available to content types through the generic content system.

## Core Features

### 1. Shape Options
- Multiple shape types supported:
  - Circle (default)
  - Square
  - Hexagon
- Shapes maintain proper aspect ratio and size across all zoom levels
- Real-world size specification in meters

### 2. Visual Styling
- Color customization
  - Main fill color
  - Border color
  - Color picker interface for easy selection
- Opacity control (0-100%)
- Border width (0-10 pixels)
- Visual feedback for:
  - Selection state
  - Hover/highlight state

### 3. Labeling System
- Optional text labels
- Label positioning above shapes
- Label visibility toggle
- Background highlighting for better readability
- Custom label text support

### 4. Debug Visualization
- Optional debug information display
- Shows:
  - Instance ID
  - Normalized coordinates (0-1)
  - Real-world measurements
- Debug text with background for readability
- Debug visualization toggle

### 5. Distribution Controls
- Quantity control (1-1000 instances)
- Random distribution across valid map areas
- Transparency validation
  - Only places shapes on non-transparent areas
  - Configurable alpha threshold
- Bounded attempt system to prevent infinite loops

### 6. Property Updates
- Live property updates without regeneration:
  - Shape type
  - Size
  - Color
  - Opacity
  - Border properties
  - Labels
  - Debug settings
- Maintains instance positions during updates

### 7. Instance Management
- Add/remove operations
- Batch updates
- Instance count tracking
- Instance validation
- Property persistence

## Usage as Reference

The Debug Dots system demonstrates how to:

1. **Implement Content Types**
   - Define shape and style properties
   - Handle real-world measurements
   - Manage instance lifecycle

2. **Handle User Interaction**
   - Property editing
   - Visual feedback
   - Instance management

3. **Validate Content**
   - Position validation
   - Property validation
   - Map boundary checking

4. **Manage State**
   - Instance state
   - Visual state
   - Debug state

## Integration Points

### 1. Content Instance Manager
- Uses ContentInstanceManager for storage
- Demonstrates proper instance lifecycle management
- Shows type-safe instance handling

### 2. Rendering System
- Integrates with ShapeRenderer
- Shows proper use of RenderStyle
- Demonstrates coordinate transformation

### 3. Distribution System
- Shows basic random distribution
- Demonstrates transparency validation
- Provides foundation for more complex distribution patterns

## Best Practices Demonstrated

1. **Real-World Measurements**
   - Use meters for size specifications
   - Handle coordinate transformation properly
   - Maintain proper scaling across zoom levels

2. **State Management**
   - Separate instance state from visual state
   - Efficient property updates
   - Proper cleanup

3. **User Interface**
   - Clear controls
   - Immediate feedback
   - Proper validation

4. **Performance**
   - Efficient updates without regeneration
   - Proper cleanup of removed instances
   - Bounded operation limits

## Example Usage

```typescript
// Creating a debug shape instance
const instance: ContentInstance = {
  id: generateId(),
  typeId: 'debug-shape',
  position: { x: 0.5, y: 0.5 },
  properties: {
    shape: 'circle',
    sizeMeters: 10,
    color: '#0000FF',
    opacity: 0.8,
    borderSize: 2,
    borderColor: '#000000',
    label: 'Debug Point',
    showLabel: true,
    showDebug: true
  }
};

// Adding to content manager
contentInstanceManager.addInstance('debug-shape', instance);

// Updating properties
const updatedInstance = {
  ...instance,
  properties: {
    ...instance.properties,
    color: '#FF0000'
  }
};
contentInstanceManager.removeInstance('debug-shape', instance.id);
contentInstanceManager.addInstance('debug-shape', updatedInstance);
```

## Future Extensions

The Debug Dots system is designed to be extended with:

1. **Additional Shape Types**
   - Custom shapes
   - Compound shapes
   - Dynamic shapes

2. **Advanced Distribution**
   - Clustered distribution
   - Pattern-based distribution
   - Constraint-based placement

3. **Enhanced Validation**
   - Proximity rules
   - Terrain-based validation
   - Relationship validation

4. **Interactive Features**
   - Drag and drop
   - Multi-select
   - Copy/paste
