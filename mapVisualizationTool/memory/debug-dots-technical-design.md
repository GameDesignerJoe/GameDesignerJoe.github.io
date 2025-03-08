# Debug Dots System: Technical Design Document

## 1. System Overview

The Debug Dots system is a specialized visualization component within the MapVisualizationTool that allows for the placement and rendering of debug markers on a map. This system serves as both a development aid and a foundation for implementing other content types in the application.

## 2. Core Technical Components

### 2.1 Data Structures

#### MapCoordinate Interface
```typescript
export interface MapCoordinate {
  x: number; // normalized coordinate (0-1) from left edge
  y: number; // normalized coordinate (0-1) from top edge
}
```

#### State Variables
```typescript
// State for random dots
const [randomDotPositions, setRandomDotPositions] = useState<Array<MapCoordinate>>([]);
const [numDotsInput, setNumDotsInput] = useState("100");
const [dotSizeMeters, setDotSizeMeters] = useState("10"); // Default 10 meters
const [showDotDebug, setShowDotDebug] = useState(false);
```

## 3. Coordinate System & Positioning

### 3.1 Normalized Coordinate System

The system uses a normalized coordinate system (0-1) for storing dot positions, which provides several advantages:

- **Resolution Independence**: Positions are stored as proportional values rather than absolute pixels
- **Persistence**: Coordinates remain valid even if the map or canvas dimensions change
- **Simplicity**: Easier to reason about positions as percentages of the map's dimensions

### 3.2 Coordinate Transformation Process

The `mapToScreenCoordinates` function handles the transformation from normalized map coordinates to screen coordinates:

```typescript
export function mapToScreenCoordinates(
  mapCoord: MapCoordinate,
  mapWidthKm: number,
  mapHeightKm: number,
  canvasWidth: number,
  canvasHeight: number,
  zoomLevel: number,
  panOffset: { x: number; y: number }
): { x: number; y: number } {
  // Convert dimensions to meters
  const mapWidthMeters = mapWidthKm * 1000;
  const mapHeightMeters = mapHeightKm * 1000;

  // Calculate the base scale that preserves aspect ratio
  const baseScale = Math.min(
    canvasWidth / mapWidthMeters,
    canvasHeight / mapHeightMeters
  );

  // Calculate base dimensions at zoom level 1
  const baseWidth = mapWidthMeters * baseScale;
  const baseHeight = mapHeightMeters * baseScale;

  // Apply zoom to get final dimensions
  const scaledWidth = baseWidth * zoomLevel;
  const scaledHeight = baseHeight * zoomLevel;

  // Calculate center offset
  const centerOffsetX = (canvasWidth - scaledWidth) / 2;
  const centerOffsetY = (canvasHeight - scaledHeight) / 2;

  // Convert normalized coordinates to screen coordinates
  const screenX = normalizedX * scaledWidth + centerOffsetX + panOffset.x;
  const screenY = normalizedY * scaledHeight + centerOffsetY + panOffset.y;

  // Round only at the final step
  return {
    x: Math.round(screenX),
    y: Math.round(screenY)
  };
}
```

### 3.3 Method for Keeping Dots in the Right Place Regardless of Zoom

The system maintains correct positioning across zoom levels through a multi-step process:

1. **Storage in Normalized Coordinates**: Dot positions are stored as normalized (0-1) coordinates, making them zoom-independent
   
2. **Dynamic Transformation**: When rendering, the `mapToScreenCoordinates` function:
   - Calculates the base scale that preserves aspect ratio
   - Applies the current zoom level to this base scale
   - Calculates center offsets to maintain the map's position in the viewport
   - Applies pan offsets to account for user navigation
   
3. **Consistent Scaling Logic**: The same scaling logic is applied to:
   - The background map image
   - The grid system
   - All content elements including debug dots
   
4. **Final Rounding**: Pixel coordinates are only rounded at the final step to prevent cumulative rounding errors

This approach ensures that dots maintain their relative positions on the map regardless of zoom level or panning operations.

## 4. Size Calculation

### 4.1 Method for Setting an Accurate Size

The system uses real-world measurements (meters) for dot sizes, which are then converted to screen pixels during rendering:

```typescript
// Convert dot size from meters to pixels and scale with zoom
const dotSizeM = parseFloat(dotSizeMeters);

// Calculate base scale that preserves aspect ratio
const baseScale = Math.min(
  canvasDimensions.width / mapWidthMeters,
  canvasDimensions.height / mapHeightMeters
);

// Calculate dot size using same scaling as grid cells
const baseDotSize = dotSizeM * baseScale;
const scaledDotSize = baseDotSize * zoomLevel;

// Use half the size for radius since arc() takes radius not diameter
const finalRadius = scaledDotSize / 2;
```

The size calculation process:

1. **Real-World Measurement**: Sizes are specified in meters, providing a consistent real-world scale
2. **Pixels-Per-Meter Calculation**: The system calculates how many pixels represent one meter at the current scale
3. **Zoom Adjustment**: The base size is multiplied by the current zoom level
4. **Consistent Scaling**: The same scaling factors are applied to all elements, maintaining relative sizes

This approach ensures that a 10-meter dot appears correctly sized relative to a 100-meter grid cell, regardless of zoom level.

## 5. Distribution Methods

### 5.1 Method for Random Distribution Across the Map

The system generates a random distribution of dots across the map using the following approach:

```typescript
const positions: Array<MapCoordinate> = [];
let attempts = 0;
const maxAttempts = numDots * 10;
const alphaThreshold = 200;

while (positions.length < numDots && attempts < maxAttempts) {
  attempts++;
  
  // Generate random normalized coordinates (0-1)
  const normalizedX = Math.random();
  const normalizedY = Math.random();

  // Convert to image coordinates
  const imgX = Math.floor(normalizedX * img.width);
  const imgY = Math.floor(normalizedY * img.height);

  // Get pixel alpha value
  const pixelIndex = (imgY * img.width + imgX) * 4;
  const alpha = data[pixelIndex + 3];

  // Only add position if alpha is above threshold
  if (alpha > alphaThreshold) {
    positions.push({ x: normalizedX, y: normalizedY });
  }
}
```

Key aspects of the distribution algorithm:

1. **Uniform Random Distribution**: Uses JavaScript's `Math.random()` to generate uniformly distributed coordinates
2. **Bounded Attempts**: Limits the number of attempts to prevent infinite loops (10x the requested number of dots)
3. **Normalized Coordinates**: Generates positions in the normalized (0-1) coordinate space
4. **Transparency Filtering**: Only accepts positions that fall on non-transparent areas of the map

This approach ensures an even, random distribution of dots across the valid areas of the map.

## 6. Map Boundary Validation

### 6.1 Method for Ensuring Dots Are On the Map

The system validates dot positions using image transparency data:

```typescript
// Create a temporary canvas to analyze the image
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');
if (!tempCtx) return;

// Set canvas size to match the background image
tempCanvas.width = img.width;
tempCanvas.height = img.height;

// Draw the background image
tempCtx.drawImage(img, 0, 0);

// Get image data to analyze transparency
const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
const data = imageData.data;

// Check alpha value at the generated position
const pixelIndex = (imgY * img.width + imgX) * 4;
const alpha = data[pixelIndex + 3];

// Only add position if alpha is above threshold
if (alpha > alphaThreshold) {
  positions.push({ x: normalizedX, y: normalizedY });
}
```

The validation process:

1. **Temporary Canvas Creation**: Creates an off-screen canvas to analyze the map image
2. **Image Data Extraction**: Draws the map and extracts the raw pixel data
3. **Alpha Channel Analysis**: Examines the alpha (transparency) channel of each potential dot position
4. **Threshold Validation**: Only accepts positions where the alpha value exceeds 200 (out of 255)

This approach ensures that dots are only placed on visible portions of the map, avoiding placement in the transparent background or off-map areas.

## 7. Rendering Process

The rendering process occurs in the `drawRandomDots` function:

```typescript
const drawRandomDots = useCallback(() => {
  if (!contextRef.current || !backgroundImageRef.current || !randomDotPositions.length) return;

  const ctx = contextRef.current;
  const img = backgroundImageRef.current;

  // Calculate dot size using scaling logic
  const dotSizeM = parseFloat(dotSizeMeters);
  const baseScale = Math.min(
    canvasDimensions.width / mapWidthMeters,
    canvasDimensions.height / mapHeightMeters
  );
  const baseDotSize = dotSizeM * baseScale;
  const scaledDotSize = baseDotSize * zoomLevel;
  const finalRadius = scaledDotSize / 2;

  ctx.save();
  randomDotPositions.forEach(pos => {
    // Convert map coordinates to screen coordinates
    const screenCoord = mapToScreenCoordinates(
      pos,
      mapConfig.widthKm,
      mapConfig.heightKm,
      canvasDimensions.width,
      canvasDimensions.height,
      zoomLevel,
      panOffset
    );

    // Draw dot
    ctx.fillStyle = '#0000FF'; // Blue
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenCoord.x, screenCoord.y, finalRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw debug text if enabled
    if (showDotDebug) {
      // Debug text rendering code...
    }
  });
  ctx.restore();
}, [canvasDimensions, zoomLevel, panOffset, randomDotPositions, showDotDebug, dotSizeMeters, mapConfig]);
```

The rendering process:

1. **Size Calculation**: Calculates the dot size in pixels based on the specified meter size and current zoom
2. **Coordinate Transformation**: Converts each normalized map coordinate to a screen coordinate
3. **Drawing**: Renders each dot as a filled circle with a border
4. **Debug Information**: Optionally renders coordinate and size information for debugging

## 8. Extending for Other Content Types

This system provides a foundation for implementing other content types by:

1. **Reusing the Coordinate System**: The normalized coordinate system and transformation functions can be applied to any content type
2. **Adapting the Size Calculation**: The meter-to-pixel conversion can be used for any sized element
3. **Customizing the Distribution Logic**: The random distribution with transparency checking can be modified for different placement strategies
4. **Extending the Rendering Process**: The drawing approach can be customized for different shapes and appearances

To implement a new content type:

1. Define a new interface extending `ContentTypeBase`
2. Create state variables to store instances of the new type
3. Implement a placement strategy (random, grid-based, etc.)
4. Add a rendering function that uses the same coordinate transformation and scaling logic
5. Create UI controls for managing the new content type

## 9. Implementation Considerations

When implementing this system for other content types, consider:

1. **Performance Optimization**: For large numbers of elements, consider:
   - Batching draw operations
   - Using off-screen canvases for caching
   - Implementing spatial partitioning for hit testing

2. **Minimum Spacing**: The current Debug Dots implementation doesn't enforce minimum spacing between dots, but this could be added:
   ```typescript
   const isValidPosition = (x, y) => {
     return positions.every(pos => {
       const dx = x - pos.x;
       const dy = y - pos.y;
       const distance = Math.sqrt(dx * dx + dy * dy);
       return distance >= minSpacingMeters;
     });
   };
   ```

3. **Distribution Patterns**: Consider alternative distribution patterns:
   - Grid-based placement
   - Clustered distribution
   - Perlin noise-based distribution for natural-looking patterns

4. **Serialization**: Add functionality to save and load dot positions:
   ```typescript
   const savePositions = () => {
     localStorage.setItem('debugDots', JSON.stringify(randomDotPositions));
   };
   
   const loadPositions = () => {
     const saved = localStorage.getItem('debugDots');
     if (saved) {
       setRandomDotPositions(JSON.parse(saved));
     }
   };
   ```

## 10. Summary

The Debug Dots system provides a robust foundation for visualizing and placing elements on a map with:

1. **Zoom-Independent Positioning**: Using normalized coordinates and dynamic transformation
2. **Accurate Size Representation**: Converting real-world measurements to screen pixels
3. **Intelligent Distribution**: Randomly placing elements only on valid map areas
4. **Boundary Validation**: Ensuring elements appear only on visible portions of the map

This system can be extended to implement various content types while maintaining consistent behavior across different zoom levels and map configurations.
