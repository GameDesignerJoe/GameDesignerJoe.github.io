// Types for map coordinates
export interface MapCoordinate {
  x: number; // normalized coordinate (0-1) from left edge
  y: number; // normalized coordinate (0-1) from top edge
}

// Transform map coordinates to screen coordinates based on zoom level and pan
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
  const mapAspectRatio = mapWidthMeters / mapHeightMeters;
  const canvasAspectRatio = canvasWidth / canvasHeight;
  
  // Calculate pixels per meter to maintain aspect ratio
  const baseScale = Math.min(
    canvasWidth / mapWidthMeters,
    canvasHeight / mapHeightMeters
  );

  // Calculate base dimensions at zoom level 1
  const baseWidth = mapWidthMeters * baseScale;
  const baseHeight = mapHeightMeters * baseScale;

  // Calculate center offset for base dimensions
  const baseCenterX = (canvasWidth - baseWidth) / 2;
  const baseCenterY = (canvasHeight - baseHeight) / 2;

  // Input coordinates are already normalized (0-1)
  const normalizedX = mapCoord.x;
  const normalizedY = mapCoord.y;

  // Apply zoom to get final dimensions
  const scaledWidth = baseWidth * zoomLevel;
  const scaledHeight = baseHeight * zoomLevel;

  // Calculate final center offset
  const centerOffsetX = (canvasWidth - scaledWidth) / 2;
  const centerOffsetY = (canvasHeight - scaledHeight) / 2;

  // Convert normalized coordinates to screen coordinates
  const screenX = normalizedX * scaledWidth + centerOffsetX + panOffset.x;
  const screenY = normalizedY * scaledHeight + centerOffsetY + panOffset.y;

  // Round only at the final step
  const finalX = Math.round(screenX);
  const finalY = Math.round(screenY);

  // Log coordinate transformation details with both raw and final values
  console.log('Coordinate transformation:', JSON.stringify({
    input: {
      mapCoord,
      mapWidthKm,
      mapHeightKm,
      canvasWidth,
      canvasHeight,
      zoomLevel,
      panOffset
    },
    calculations: {
      mapWidthMeters,
      mapHeightMeters,
      mapAspectRatio,
      canvasAspectRatio,
      baseScale,
      baseWidth,
      baseHeight,
      baseCenterX,
      baseCenterY,
      normalizedX,
      normalizedY,
      scaledWidth,
      scaledHeight,
      centerOffsetX,
      centerOffsetY,
      screenX,
      screenY
    },
    output: {
      screenX: finalX,
      screenY: finalY
    }
  }, null, 2));

  return {
    x: finalX,
    y: finalY
  };
}
