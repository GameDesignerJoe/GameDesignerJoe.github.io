# Fellowship Map Content Visualization Tool - Technical Design Document

## 1. System Architecture

### 1.1 Overview
The Map Content Visualization Tool will be implemented as a browser-based JavaScript application, providing a standalone solution that can be easily shared among team members without installation requirements.

### 1.2 Architecture Diagram
```
┌───────────────────────────────────────────────────────────────┐
│                        User Interface                          │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐  │
│  │  Input      │       │  Analysis   │       │  Map        │  │
│  │  Panel      │       │  Panel      │       │  Panel      │  │
│  └─────────────┘       └─────────────┘       └─────────────┘  │
└───────────┬─────────────────┬─────────────────────┬───────────┘
            │                 │                     │
┌───────────▼─────────┐ ┌─────▼───────────┐ ┌───────▼───────────┐
│ Configuration       │ │ Analysis        │ │ Rendering         │
│ Manager             │ │ Engine          │ │ Engine            │
└───────────┬─────────┘ └─────┬───────────┘ └───────┬───────────┘
            │                 │                     │
            └─────────┬───────┘                     │
                      │                             │
         ┌────────────▼────────────┐   ┌────────────▼────────────┐
         │ Content Distribution    │   │ Canvas Manager          │
         │ Engine                  │   │                         │
         └─────────────────────────┘   └─────────────────────────┘
```

### 1.3 Components
- **User Interface**: HTML/CSS framework for the three-panel layout
- **Configuration Manager**: Handles user inputs and configuration state
- **Content Distribution Engine**: Core algorithms for placing content
- **Analysis Engine**: Calculates metrics based on content distribution
- **Rendering Engine**: Manages visualization of the map and content
- **Canvas Manager**: Low-level canvas operations for efficient rendering

### 1.4 Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Visualization**: HTML5 Canvas API
- **Optional Libraries**:
  - FileSaver.js for exporting images
  - Potential utility libraries like lodash for data manipulation

## 2. Data Models

### 2.1 Configuration Model
```javascript
const mapConfiguration = {
  // Basic map properties
  targetAreaKm2: 1, // Target area in square kilometers
  actualAreaKm2: 1, // Actual achieved area after grid calculation
  seed: "random-seed-12345", // For reproducible generation
  
  // Visual settings
  backgroundImage: "map-terrain.png",
  showGrid: true,
  gridColor: "#666666",
  gridOpacity: 0.5,
  detailLevel: 0, // Current detail level
  
  // Content definitions
  contentTypes: [
    // Array of content type definitions
  ],
  
  // Generation settings
  placementStrategy: "random", // or "clustered", "even", etc.
  iterationLimit: 1000, // Max attempts for content placement
  spacing: 1.0 // Global multiplier for spacing rules
};
```

### 2.2 Content Type Model
```javascript
const contentType = {
  // Basic properties
  id: "enemy-camp-small",
  name: "Small Enemy Camp",
  category: "Combat",
  description: "A small group of enemies (3-5)",
  
  // Visual properties
  color: "#FF0000",
  shape: "circle", // or "square", "hexagon", etc.
  icon: "enemy-camp", // Optional icon identifier
  
  // Spatial properties
  size: 15, // diameter in meters
  sizeVariation: 0.2, // ±20% size variation
  
  // Distribution properties
  quantity: 50, // Number to place
  minSpacing: 100, // Minimum distance between same type
  canOverlap: false,
  
  // Biome rules
  allowedBiomes: ["forest", "mountains"], // or "any"
  disallowedBiomes: ["water"],
  
  // Proximity rules
  minDistanceToTypes: {
    "poi-village": 200 // Minimum distance to villages
  },
  maxDistanceToTypes: {
    "resource-water": 500 // Must be within 500m of water
  },
  
  // Generation priority
  priority: 2, // Higher priority content placed first
  
  // Gameplay properties (for analysis)
  interactionTime: 5, // minutes
  difficulty: 3, // 1-10 scale
  playerCount: 2 // Optimal player count
};
```

### 2.3 Biome Model
```javascript
const biome = {
  id: "dense-forest",
  name: "Dense Forest",
  color: "#006400",
  coverage: 0.25, // 25% of map area
  edgeRoughness: 0.3, // 0-1 scale (0=smooth, 1=very rough)
  priority: 1, // Higher priority biomes placed first
  restrictedBiomes: ["water"], // Cannot overlap these
  seedPoints: 5 // Number of initial points for generation
};
```

### 2.4 Results Model
```javascript
const generationResults = {
  // Successful placement counts
  placedContent: {
    "enemy-camp-small": 47, // 47 of 50 requested were placed
    "poi-village": 8, // All 8 requested were placed
    // etc.
  },
  
  // Placement failures
  failures: {
    "enemy-camp-small": {
      count: 3,
      reasons: {
        "biome-restriction": 2,
        "spacing-violation": 1
      }
    }
  },
  
  // Analysis metrics
  metrics: {
    contentDensity: 0.05, // items per square meter
    averageTravel: 120, // seconds between content
    contentBalance: {
      "Combat": 65, // percent
      "Exploration": 25,
      "Resource": 10
    }
  },
  
  // Warnings
  warnings: [
    {
      type: "low-density",
      area: {x: 2000, y: 3000, radius: 500},
      message: "Low content density in northeast region"
    }
  ],
  
  // Placed content details (for rendering)
  placedItems: [
    {
      typeId: "enemy-camp-small",
      position: {x: 2500, y: 1500},
      size: 16.2, // Actual size after variation
      // Other placement-specific properties
    },
    // etc.
  ]
};
```

## 3. Core Algorithms

### 3.1 Content Distribution Algorithm
The primary challenge is efficiently placing content according to constraints. The core algorithm will:

1. Determine placement order based on priority
2. For each content type:
   a. Calculate valid placement regions based on biome restrictions
   b. Generate candidate positions according to placement strategy
   c. Evaluate constraints (spacing, proximity, etc.)
   d. Place valid items up to requested quantity or iteration limit
   e. Record successful placements and failures

Pseudocode for main distribution loop:
```
function distributeContent(mapConfig, contentTypes):
  sortedTypes = sortByPriority(contentTypes)
  placedItems = []
  results = initializeResults()
  
  // First place biomes
  placedBiomes = generateBiomes(mapConfig.biomes)
  
  for each contentType in sortedTypes:
    placementCount = 0
    attempts = 0
    
    while placementCount < contentType.quantity and attempts < maxAttempts:
      // Generate candidate position
      position = generateCandidatePosition(contentType, mapConfig, placementStrategy)
      
      // Check if position is valid
      if isValidPlacement(position, contentType, placedItems, placedBiomes):
        // Add item to placed items
        item = createItem(contentType, position)
        placedItems.push(item)
        placementCount++
        updateResults(results, "success", contentType)
      else:
        updateResults(results, "failure", contentType, getRejectionReason())
      
      attempts++
  
  // Calculate analysis metrics
  results.metrics = calculateMetrics(placedItems, mapConfig)
  
  // Generate warnings
  results.warnings = generateWarnings(placedItems, mapConfig)
  
  return {placedItems, placedBiomes, results}
```

### 3.2 Biome Generation Algorithm
Biomes will be generated using a modified Voronoi diagram approach:

1. Place seed points for each biome based on desired coverage
2. Generate Voronoi cells from seed points
3. Apply edge roughness and smoothing
4. Adjust boundaries to match coverage targets

### 3.3 Spatial Validation Algorithm
For checking if a content placement is valid:

```
function isValidPlacement(position, contentType, placedItems, biomes):
  // Check biome constraints
  currentBiome = getBiomeAtPosition(position, biomes)
  if !isAllowedBiome(contentType, currentBiome):
    return false
  
  // Check spacing constraints
  for each item in placedItems:
    if item.typeId == contentType.id:
      distance = calculateDistance(position, item.position)
      if distance < contentType.minSpacing:
        return false
  
  // Check proximity constraints
  for each minDistanceType, distance in contentType.minDistanceToTypes:
    for each item in placedItems.ofType(minDistanceType):
      if calculateDistance(position, item.position) < distance:
        return false
  
  for each maxDistanceType, distance in contentType.maxDistanceToTypes:
    hasNearbyItem = false
    for each item in placedItems.ofType(maxDistanceType):
      if calculateDistance(position, item.position) <= distance:
        hasNearbyItem = true
        break
    if !hasNearbyItem:
      return false
  
  // Check overlap constraints
  if !contentType.canOverlap:
    for each item in placedItems:
      if wouldOverlap(position, contentType.size, item):
        return false
  
  return true
```

### 3.4 Analysis Algorithms
Key metrics will be calculated using:

1. **Density Calculations**: Content per square kilometer, by region and type
2. **Travel Time Estimation**: Based on distance and assumed player speed
3. **Clustering Analysis**: Identifying hot spots and sparse areas
4. **Content Balance**: Distribution across categories and difficulty

## 4. Rendering Engine

### 4.1 Canvas Setup
```javascript
function setupCanvas(mapConfig) {
  const canvas = document.getElementById('map-canvas');
  
  // Calculate appropriate canvas dimensions based on map size and screen
  const scale = calculateOptimalScale(mapConfig.width, mapConfig.height);
  
  canvas.width = mapConfig.width * scale;
  canvas.height = mapConfig.height * scale;
  
  const ctx = canvas.getContext('2d');
  
  return {canvas, ctx, scale};
}
```

### 4.2 Rendering Pipeline
The rendering process will follow this sequence:

1. Clear canvas and draw background
2. Draw biomes as filled polygons
3. Draw hex grid (if enabled)
4. Draw content items in priority order:
   a. Large background items first
   b. Medium items next
   c. Small foreground items last
5. Draw warnings/highlights (if any)
6. Draw legend

### 4.3 Content Rendering
Each content type will be rendered according to its shape and properties:

```javascript
function renderContentItem(ctx, item, scale) {
  const x = item.position.x * scale;
  const y = item.position.y * scale;
  const size = item.size * scale;
  
  ctx.fillStyle = item.color;
  ctx.strokeStyle = darken(item.color);
  ctx.lineWidth = 1;
  
  switch(item.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    
    case 'square':
      ctx.fillRect(x - size/2, y - size/2, size, size);
      ctx.strokeRect(x - size/2, y - size/2, size, size);
      break;
    
    case 'hexagon':
      drawHexagon(ctx, x, y, size/2);
      break;
    
    // Additional shapes as needed
  }
  
  // Draw icon if specified
  if (item.icon) {
    drawIcon(ctx, item.icon, x, y, size * 0.6);
  }
}
```

### 4.4 Coordinate System and Content Placement

The system uses a normalized coordinate system (0-1) for storing content positions, which provides several key advantages:

- **Resolution Independence**: Positions are stored as proportional values rather than absolute pixels
- **Persistence**: Coordinates remain valid even if the map or canvas dimensions change
- **Simplicity**: Easier to reason about positions as percentages of the map's dimensions

The coordinate transformation process is handled by the `mapToScreenCoordinates` function:

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

  return {
    x: Math.round(screenX),
    y: Math.round(screenY)
  };
}
```

This implementation ensures:
- Correct positioning across all zoom levels
- Proper scaling with map dimensions
- Accurate coordinate transformation
- Pixel-perfect rendering through final rounding

The system maintains correct positioning through:

1. **Storage in Normalized Coordinates**: Content positions are stored as normalized (0-1) coordinates
2. **Dynamic Transformation**: The `mapToScreenCoordinates` function handles all scaling and offset calculations
3. **Consistent Scaling Logic**: The same scaling is applied to all content elements
4. **Final Rounding**: Pixel coordinates are only rounded at the final step

### 4.5 Content Size Calculation

The system uses real-world measurements (meters) for content sizes:

```typescript
// Convert size from meters to pixels and scale with zoom
const contentSizeM = parseFloat(sizeMeters);

// Calculate base scale that preserves aspect ratio
const baseScale = Math.min(
  canvasDimensions.width / mapWidthMeters,
  canvasDimensions.height / mapHeightMeters
);

// Calculate size using same scaling as grid cells
const baseSize = contentSizeM * baseScale;
const scaledSize = baseSize * zoomLevel;
```

The size calculation process:
1. **Real-World Measurement**: Sizes are specified in meters
2. **Pixels-Per-Meter Calculation**: System calculates pixels per meter at current scale
3. **Zoom Adjustment**: Base size is multiplied by current zoom level
4. **Consistent Scaling**: Same scaling factors applied to all elements


### 4.5 Legend Generation
The legend will be dynamically generated based on active content types:

```javascript
function renderLegend(contentTypes, domElement) {
  let legendHTML = '<div class="legend-title">Map Legend</div>';
  
  // Group by category
  const categorizedContent = groupByCategory(contentTypes);
  
  for (const [category, items] of Object.entries(categorizedContent)) {
    legendHTML += `<div class="legend-category">${category}</div>`;
    
    for (const item of items) {
      legendHTML += `
        <div class="legend-item">
          <span class="legend-swatch" style="background-color: ${item.color}"></span>
          <span class="legend-name">${item.name}</span>
        </div>
      `;
    }
  }
  
  domElement.innerHTML = legendHTML;
}
```

## 5. User Interaction Handling

### 5.1 Form Input Handling
```javascript
function setupInputHandlers() {
  // Map configuration inputs
  document.getElementById('map-width').addEventListener('change', updateMapConfig);
  document.getElementById('map-height').addEventListener('change', updateMapConfig);
  
  // Content type management
  document.getElementById('add-content').addEventListener('click', showContentForm);
  document.getElementById('content-list').addEventListener('click', handleContentListClick);
  
  // Generation control
  document.getElementById('generate-map').addEventListener('click', generateMap);
  document.getElementById('export-map').addEventListener('click', exportMap);
}
```

### 5.2 Content Type Management
The interface will include functionality for:

1. Adding new content types through a form
2. Editing existing content types
3. Removing content types
4. Duplicating content types as a starting point

### 5.3 Export Functionality
```javascript
function exportMap() {
  const canvas = document.getElementById('map-canvas');
  
  // Convert canvas to data URL
  const dataUrl = canvas.toDataURL('image/png');
  
  // Create download link
  const link = document.createElement('a');
  link.download = 'fellowship-map.png';
  link.href = dataUrl;
  link.click();
}
```

## 6. Performance Considerations

### 6.1 Canvas Optimization
- Use appropriate canvas dimensions based on view size
- Implement layer caching for static elements
- Use requestAnimationFrame for any animations
- Consider offscreen canvas for complex calculations

### 6.2 Algorithm Efficiency
- Implement spatial partitioning for collision detection
- Use efficient data structures for constraint checking
- Consider Web Workers for intensive calculations
- Implement early termination for invalid placements

### 6.3 Memory Management
- Reuse objects where possible to reduce garbage collection
- Batch DOM updates
- Clean up event listeners when components are removed

## 7. Extension Points

### 7.1 Custom Content Type Properties
The system will support addition of new properties to content types:

```javascript
function extendContentType(contentType, customProps) {
  return {...contentType, ...customProps};
}
```

### 7.2 Custom Placement Algorithms
The distribution engine will support custom placement strategies:

```javascript
const placementStrategies = {
  random: randomPlacementStrategy,
  clustered: clusteredPlacementStrategy,
  evenlySpaced: evenlySpacedStrategy,
  pathFollowing: pathFollowingStrategy,
  
  // Extension point for custom strategies
  registerStrategy(name, strategyFn) {
    this[name] = strategyFn;
  }
};
```

### 7.3 Export/Import Plugins
The system will support plugins for additional export formats:

```javascript
const exporters = {
  png: exportToPng,
  json: exportToJson,
  
  // Extension point for custom exporters
  registerExporter(format, exporterFn) {
    this[format] = exporterFn;
  }
};
```

## 8. Implementation Approach

### 8.1 Code Organization

```
/src
  /js
    /config
      defaultSettings.js
    /core
      configManager.js
      distributionEngine.js
      analysisEngine.js
    /rendering
      canvasManager.js
      renderingEngine.js
      legendRenderer.js
    /ui
      formHandlers.js
      contentTypeManager.js
      exportManager.js
    /utils
      mathUtils.js
      colorUtils.js
      spatialUtils.js
    main.js
  /css
    styles.css
  index.html
```

### 8.2 Initialization Flow

```javascript
// Entry point
function initializeApplication() {
  // Load default configuration
  const config = ConfigManager.getDefaultConfig();
  
  // Set up UI components
  UI.setupInterface(config);
  
  // Initialize canvas
  const {canvas, ctx} = RenderingEngine.initializeCanvas(config);
  
  // Set up event handlers
  UI.setupEventHandlers({
    onConfigChange: handleConfigChange,
    onGenerateRequest: handleGenerateRequest,
    onExportRequest: handleExportRequest
  });
  
  // Initial render with empty map
  RenderingEngine.renderEmptyMap(canvas, ctx, config);
}

// Main generator function
function handleGenerateRequest() {
  const config = ConfigManager.getCurrentConfig();
  
  // Show loading indicator
  UI.showLoading();
  
  // Generate content distribution
  const results = DistributionEngine.distributeContent(config);
  
  // Update analysis panel
  AnalysisEngine.displayResults(results);
  
  // Render map
  RenderingEngine.renderMap(results);
  
  // Hide loading indicator
  UI.hideLoading();
}
```

## 9. Testing Strategy

### 9.1 Unit Testing
- Test core algorithms independently
- Validate constraint checking
- Verify metric calculations

### 9.2 Integration Testing
- Test end-to-end content generation
- Verify UI updates properly reflect changes
- Test export functionality

### 9.3 Performance Testing
- Test with maximum map dimensions
- Test with large numbers of content types
- Measure rendering performance

## 10. Deployment

### 10.1 Build Process
1. Bundle JavaScript modules
2. Minify CSS
3. Optimize assets
4. Generate documentation

### 10.2 Distribution
- Host on internal web server
- Alternatively, package as static files for local use
- Consider GitHub Pages for easy sharing

## 11. Future Considerations

### 11.1 Advanced Features
- Interactive map editing
- Player path simulation
- Content relationship visualization
- 3D visualization option

### 11.2 Integration Opportunities
- Import actual game map data
- Export directly to game asset format
- Connect to content management system
- Live team collaboration features
