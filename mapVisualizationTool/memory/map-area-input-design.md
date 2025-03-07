# Map Area Input Feature Design

## Overview
This document outlines the design and implementation of the Map Area input feature, which allows users to specify the target area in square kilometers for the map visualization.

## Core Components

### Constants
```typescript
const METERS_PER_KM = 1000;
const MIN_AREA_KM2 = 1;
const MAX_AREA_KM2 = 50;
```

### Interface Extensions
```typescript
interface MapConfig {
  targetAreaKm2: number;  // Target area in square kilometers
  actualAreaKm2: number;  // Actual achieved area after grid calculation
  showGrid: boolean;
  gridOpacity: number;  // Range: 0-1
  gridColor: string;    // Hex color value
  detailLevel: number;  // Current detail level
}
```

## UI Implementation

### Reset Map Component
```typescript
<button
  className="reset-map-btn"
  onClick={() => {
    setMapConfig(defaultMapConfig);
  }}
  title="Reset map to default configuration"
>
  Reset Map
</button>
```

### Map Area Input Control
```typescript
<div className="map-controls">
  <label>
    Map Area (km²):
    <input
      type="number"
      min={MIN_AREA_KM2}
      max={MAX_AREA_KM2}
      step="0.1"
      value={mapConfig.targetAreaKm2}
      onChange={e => {
        const value = Math.min(MAX_AREA_KM2, Math.max(MIN_AREA_KM2, parseFloat(e.target.value) || MIN_AREA_KM2));
        setMapConfig(prev => ({
          ...prev,
          targetAreaKm2: value
        }));
      }}
      title="Target map area in square kilometers"
    />
  </label>
</div>
```

### Grid Controls
```typescript
<div className="grid-controls">
  {/* Show Grid Toggle */}
  <label>
    <input
      type="checkbox"
      checked={mapConfig.showGrid}
      onChange={e => {
        setMapConfig(prev => ({
          ...prev,
          showGrid: e.target.checked
        }));
      }}
    />
    Show Grid
  </label>

  {/* Grid Color Picker */}
  <div className="grid-color-control">
    <label>
      Grid Color:
      <input
        type="color"
        value={mapConfig.gridColor}
        onChange={e => {
          setMapConfig(prev => ({
            ...prev,
            gridColor: e.target.value
          }));
        }}
      />
    </label>
  </div>

  {/* Grid Opacity Slider */}
  <div className="grid-opacity-control">
    <label>
      Grid Opacity:
      <input
        type="range"
        min="0"
        max="100"
        value={mapConfig.gridOpacity * 100}
        onChange={e => {
          setMapConfig(prev => ({
            ...prev,
            gridOpacity: parseInt(e.target.value) / 100
          }));
        }}
      />
    </label>
  </div>
</div>
```

### Detail Level Display
```typescript
<div className="detail-info">
  Detail Level {getCurrentDetailLevel().displayName} |
  Scale: {getCurrentDetailLevel().metersPerCell}m per cell |
  Map Area: {mapConfig.actualAreaKm2.toFixed(1)}km² of {mapConfig.targetAreaKm2}km²
</div>
```

## Area Calculation Logic

### Cell Area Calculation
```typescript
// Calculate area of a single cell based on detail level
const cellAreaKm2 = (detailLevel.metersPerCell * detailLevel.metersPerCell) / (METERS_PER_KM * METERS_PER_KM);
```

### Total Area Calculation
```typescript
// Count cells with content
let cellsWithContent = 0;
for (let row = 0; row < numRows; row++) {
  for (let col = 0; col < numCols; col++) {
    if (newMask[row][col]) {
      cellsWithContent++;
    }
  }
}

// Calculate actual area based on cells with content
const actualAreaKm2 = cellsWithContent * cellAreaKm2;

// Update map config with actual area
setMapConfig(prev => ({
  ...prev,
  actualAreaKm2: actualAreaKm2
}));
```

## Feature Behavior

1. **Input Constraints**
   - Minimum area: 1 km²
   - Maximum area: 50 km²
   - Step size: 0.1 km²
   - Invalid inputs default to minimum area

2. **Real-time Updates**
   - Grid updates immediately when area changes
   - Actual area recalculates based on visible cells
   - Display updates to show both target and actual area
   - Grid color and opacity update in real-time
   - Detail level updates with zoom changes

3. **Integration Points**
   - Affects grid cell size calculations
   - Influences transparency mask generation
   - Updates detail level display
   - Controls grid visibility and appearance

## Usage Notes

1. The input accepts decimal values for fine-tuning the area
2. The actual area may differ from target area due to:
   - Grid cell quantization
   - Transparent regions in the map
   - Detail level constraints
3. Grid appearance can be fully customized with color and opacity controls
4. Reset functionality returns all settings to default values

## Dependencies

- Requires transparency mask system
- Integrates with detail level system
- Uses grid drawing system
