// Types for map coordinates
export interface MapCoordinate {
  x: number; // meters from left edge
  y: number; // meters from top edge
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

  // Calculate the normalized position (0-1) within the map
  // Adjust for aspect ratio to ensure consistent scaling
  const normalizedX = mapCoord.x / mapWidthMeters;
  const normalizedY = mapCoord.y / mapHeightMeters;

  // Apply zoom level
  const scale = baseScale * zoomLevel;

  // Calculate scaled dimensions in pixels
  const scaledWidth = mapWidthMeters * scale;
  const scaledHeight = mapHeightMeters * scale;

  // Calculate center offset
  const offsetX = (canvasWidth - scaledWidth) / 2;
  const offsetY = (canvasHeight - scaledHeight) / 2;

  // Calculate base screen coordinates without rounding
  const screenX = (normalizedX * scaledWidth) + offsetX;
  const screenY = (normalizedY * scaledHeight) + offsetY;

  // Apply pan offset
  const finalX = Math.round(screenX + panOffset.x);
  const finalY = Math.round(screenY + panOffset.y);

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
      normalizedX,
      normalizedY,
      baseScale,
      scale,
      scaledWidth,
      scaledHeight,
      offsetX,
      offsetY,
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

// Test dot position (in meters from top-left)
export const TEST_DOT: MapCoordinate = {
  x: 1500, // 1.5km from left edge
  y: 1000  // 1km from top edge - adjusted to be on visible part of map
};

// Function to draw the test dot with debug information
export function drawTestDot(
  ctx: CanvasRenderingContext2D,
  screenCoord: { x: number; y: number },
  realCoord: MapCoordinate,
  zoomLevel: number,
  backgroundImage: HTMLImageElement | null = null
): void {
  // Save current context state
  ctx.save();

  // Check if the dot should be drawn
  let shouldDraw = true;
  if (backgroundImage) {
    // Create a temporary canvas to check pixel alpha
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCanvas.width = backgroundImage.width;
      tempCanvas.height = backgroundImage.height;
      tempCtx.drawImage(backgroundImage, 0, 0);

      // Convert real coordinates to image coordinates
      const imgX = Math.floor((realCoord.x / (6 * 1000)) * backgroundImage.width);
      const imgY = Math.floor((realCoord.y / (4 * 1000)) * backgroundImage.height);

      // Get pixel alpha value
      const imageData = tempCtx.getImageData(imgX, imgY, 1, 1);
      shouldDraw = imageData.data[3] > 200; // Only draw if alpha > 200
    }
  }

  if (shouldDraw) {
    // Draw dot
    ctx.fillStyle = '#00FF00'; // Bright green
    ctx.strokeStyle = '#000000'; // Black border
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenCoord.x, screenCoord.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw coordinate text
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.font = '12px monospace'; // Use monospace for better alignment
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  // Create text with coordinates
  const coordText = `Real: (${realCoord.x.toFixed(0)}m, ${realCoord.y.toFixed(0)}m)`;
  const screenText = `Screen: (${screenCoord.x.toFixed(0)}, ${screenCoord.y.toFixed(0)})`;
  const zoomText = `Zoom: ${zoomLevel.toFixed(2)}x`;
  
  // Draw text with background for readability
  const textY = screenCoord.y - 30;
  const padding = 5;
  const lineHeight = 14;
  
  // Measure text width for background
  const maxWidth = Math.max(
    ctx.measureText(coordText).width,
    ctx.measureText(screenText).width,
    ctx.measureText(zoomText).width
  );
  
  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(
    screenCoord.x - (maxWidth / 2) - padding,
    textY - (3 * lineHeight) - padding,
    maxWidth + (padding * 2),
    (3 * lineHeight) + (padding * 2)
  );
  
  // Draw text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(coordText, screenCoord.x, textY - 2 * lineHeight);
  ctx.fillText(screenText, screenCoord.x, textY - lineHeight);
  ctx.fillText(zoomText, screenCoord.x, textY);

  // Restore context state
  ctx.restore();
}
