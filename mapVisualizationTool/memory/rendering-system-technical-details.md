# Rendering System Technical Documentation

## Overview

The rendering system provides a flexible, extensible framework for visualizing different types of content on the map. It supports multiple shape types, real-world measurements, and advanced styling options while maintaining proper scaling across zoom levels.

## Core Components

### 1. Shape Rendering System

#### ShapeRenderer Interface
```typescript
interface ShapeRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void;
}
```

#### Available Shape Types
- Circle: Basic circular shape
- Square: Square/rectangular shape
- Hexagon: Six-sided polygon

#### Adding New Shapes
1. Create a new class extending BaseShapeRenderer
2. Implement the render method
3. Register with ShapeRendererFactory

### 2. Styling System

#### RenderStyle Properties
- Basic Properties:
  - fillColor: Main shape color
  - strokeColor: Border color
  - lineWidth: Border width
  - opacity: Transparency level

- State Indicators:
  - selected: Selection state
  - highlighted: Hover/highlight state

- Debug Options:
  - showDebug: Toggle debug info
  - debugColor: Debug text color
  - debugFontSize: Debug text size

- Label Options:
  - showLabel: Toggle label visibility
  - label: Label text
  - labelColor: Label text color
  - labelFontSize: Label text size

- Effects:
  - shadow: Shadow effects (color, blur, offset)
  - gradient: Linear or radial gradients

### 3. Coordinate System

#### MapCoordinate Interface
```typescript
interface MapCoordinate {
  x: number; // normalized (0-1) from left edge
  y: number; // normalized (0-1) from top edge
}
```

#### Coordinate Transformation
- Uses normalized coordinates (0-1) for storage
- Transforms to screen coordinates based on:
  - Map dimensions (in kilometers)
  - Canvas dimensions
  - Zoom level
  - Pan offset

### 4. Size Calculation

- Sizes specified in real-world meters
- Conversion to screen pixels considers:
  - Map scale (km to pixels)
  - Zoom level
  - Aspect ratio preservation

## Usage Examples

### 1. Basic Shape Rendering
```typescript
const renderer = ShapeRendererFactory.getRenderer('circle');
renderer.render(ctx, x, y, size, {
  fillColor: '#3498db',
  strokeColor: '#2980b9',
  lineWidth: 2,
  opacity: 1
});
```

### 2. Debug Visualization
```typescript
renderer.renderDebug(ctx, x, y, size, {
  showDebug: true,
  debugColor: '#ffffff',
  debugTextColor: '#ffffff',
  debugFontSize: 12
}, 'Debug Text');
```

### 3. Custom Styling
```typescript
const style = createRenderStyle({
  fillColor: '#3498db',
  gradient: {
    type: 'radial',
    colors: ['#3498db', '#2980b9'],
    stops: [0, 1]
  },
  shadow: {
    color: 'rgba(0, 0, 0, 0.5)',
    blur: 10,
    offsetX: 2,
    offsetY: 2
  }
});
```

## Best Practices

1. **Coordinate Handling**
   - Always store positions in normalized coordinates
   - Transform to screen coordinates only during rendering
   - Round pixel values only at final step

2. **Size Specifications**
   - Use real-world measurements (meters) for content sizes
   - Let the system handle conversion to screen pixels
   - Consider zoom levels when specifying sizes

3. **Style Management**
   - Use createRenderStyle helper for consistent defaults
   - Create reusable style presets for similar content
   - Use style factories for dynamic styling

4. **Performance Considerations**
   - Cache rendered results when possible
   - Use appropriate shape types for content
   - Minimize style changes during rendering

## Integration with Content System

The rendering system integrates with the broader content system through:

1. **ContentRenderer Class**
   - Handles rendering of all content instances
   - Manages coordinate transformation
   - Applies content-specific styling

2. **ContentInstanceManager**
   - Provides instances to render
   - Maintains instance properties
   - Handles instance lifecycle

3. **ContentTypeBase**
   - Defines shape and style defaults
   - Specifies size in meters
   - Controls debug visualization options

## Future Considerations

1. **Planned Enhancements**
   - Additional shape types
   - More styling options
   - Performance optimizations
   - Advanced effects

2. **Extension Points**
   - Custom shape renderers
   - Style preprocessors
   - Debug visualization extensions
   - Rendering pipeline hooks
