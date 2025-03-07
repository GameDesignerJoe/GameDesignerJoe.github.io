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
  gridOpacity: number;
  gridColor: string;
  visualCellSize: number;
}
```

## UI Implementation

### Map Area Input Control
```typescript
<div className="map-controls">
  <label>
    <span>Map Area (km²)</span>
    <input
      type="number"
      min={MIN_AREA_KM2}
      max={MAX_AREA_KM2}
      step="0.1"
      value={areaInputValue}
      onChange={e => {
        const newValue = e.target.value;
        setAreaInputValue(newValue);
        const parsedValue = parseFloat(newValue);
        if (!isNaN(parsedValue)) {
          const value = Math.min(MAX_AREA_KM2, Math.max(MIN_AREA_KM2, parsedValue));
          setMapConfig(prev => ({
            ...prev,
            targetAreaKm2: value
          }));
        }
      }}
      title="Target map area in square kilometers"
    />
  </label>
</div>
```

### Area Display Component
```typescript
<div className="detail-info">
  Detail Level {getCurrentDetailLevel().displayName} | 
  Map Area: {mapConfig.actualAreaKm2.toFixed(1)}km² of {mapConfig.targetAreaKm2}km²
</div>
```

### Control Panel Styling
```css
.map-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background-color: #3a3a3a;
  padding: 0.5rem;
  border-radius: 0.25rem;
  height: 34px;  // Consistent height with other controls
}

.map-controls label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  white-space: nowrap;
}

.map-controls label span {
  min-width: 85px;
  font-size: 0.9rem;
}

.map-controls input[type="number"] {
  width: 60px;
  height: 24px;
  padding: 0 0.25rem;
  background-color: #4a4a4a;
  border: none;
  border-radius: 0.25rem;
  color: #ffffff;
  font-size: 0.9rem;
  text-align: right;
}

.map-controls input[type="number"]::-webkit-inner-spin-button,
.map-controls input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  background-color: #4a4a4a;
  height: 24px;
}
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

3. **Visual Feedback**
   - Consistent 34px control panel height
   - Right-aligned numeric input
   - Standardized input styling matching other controls
   - Clear label with fixed width for alignment

## Integration Points

- Affects grid cell size calculations
- Influences transparency mask generation
- Updates detail level display

## Usage Notes

1. The input accepts decimal values for fine-tuning the area
2. The actual area may differ from target area due to:
   - Grid cell quantization
   - Transparent regions in the map
   - Detail level constraints

## Dependencies

- Requires transparency mask system
- Integrates with detail level system
- Uses grid drawing system
