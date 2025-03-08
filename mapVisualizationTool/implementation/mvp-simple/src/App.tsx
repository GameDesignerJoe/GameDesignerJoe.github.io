import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import mapImage from './assets/map.png';
import { ContentTypePanel } from './components/ContentTypePanel/ContentTypePanel';
import { ContentTypeBase } from './types/ContentTypes';
import { TEST_DOT, mapToScreenCoordinates, drawTestDot } from './utils/MapCoordinates';

const backgroundImageSrc = mapImage;

// Helper function to draw content type shapes
const drawContentShape = (
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  size: number,
  color: string
) => {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'square':
      const halfSize = size / 2;
      ctx.fillRect(x - halfSize, y - halfSize, size, size);
      ctx.strokeRect(x - halfSize, y - halfSize, size, size);
      break;
    case 'hexagon':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const pointX = x + (size / 2) * Math.cos(angle);
        const pointY = y + (size / 2) * Math.sin(angle);
        if (i === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
};

// Define types for map configuration
interface MapConfig {
  widthKm: number;  // Width in kilometers
  heightKm: number; // Height in kilometers
  targetAreaKm2: number;  // Target area in square kilometers
  actualAreaKm2: number;  // Actual achieved area after grid calculation
  showGrid: boolean;
  gridOpacity: number;
  gridColor: string; // Color of the grid lines
  visualCellSize: number; // Visual size of each cell in pixels
}

// Constants for real-world units
const METERS_PER_KM = 1000;
const BASE_CELL_SIZE_METERS = 1; // Base cell size is 1m x 1m
const MIN_AREA_KM2 = 1;
const MAX_AREA_KM2 = 50;

// Detail level definitions
interface DetailLevel {
  id: string;
  category: 'High' | 'Medium' | 'Low';
  minZoom: number;
  maxZoom: number;
  metersPerCell: number;
  displayName: string;
}

// Define zoom stages that match grid size changes proportionally
const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0];

const DETAIL_LEVELS: DetailLevel[] = [
  // Level 0 (Most zoomed out): 400m cells at 0.5x zoom
  { id: 'L0', category: 'Low', minZoom: 0.0, maxZoom: 1.0, metersPerCell: 400, displayName: '0 (400m)' },
  // Level 1: 200m cells at 1x zoom
  { id: 'L1', category: 'Low', minZoom: 1.0, maxZoom: 2.0, metersPerCell: 200, displayName: '1 (200m)' },
  // Level 2: 100m cells at 2x zoom
  { id: 'L2', category: 'Low', minZoom: 2.0, maxZoom: 4.0, metersPerCell: 100, displayName: '2 (100m)' },
  // Level 3: 50m cells at 4x zoom
  { id: 'L3', category: 'Medium', minZoom: 4.0, maxZoom: 6.0, metersPerCell: 50, displayName: '3 (50m)' },
  // Level 4: 10m cells at 8x zoom
  { id: 'L4', category: 'High', minZoom: 6.0, maxZoom: Infinity, metersPerCell: 10, displayName: '4 (10m)' },
];

function App() {
  // Canvas dimensions state
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1800, height: 1350 });
  
  // References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // State for map configuration and input
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    widthKm: 6,  // 6km width to match image aspect ratio
    heightKm: 4, // 4km height (24 sq km total area)
    targetAreaKm2: 24, // Default 24 sq km (same as original 6x4)
    actualAreaKm2: 24,
    showGrid: true,
    gridOpacity: 0.7,
    gridColor: '#666666', // Default grid color
    visualCellSize: 10, // Visual size of each cell in pixels
  });
  
  // State for input value
  const [areaInputValue, setAreaInputValue] = useState(mapConfig.targetAreaKm2.toString());

  // Update input value and dimensions when target area changes
  useEffect(() => {
    setAreaInputValue(mapConfig.targetAreaKm2.toString());

    if (!backgroundImageRef.current) return;
    
    const imageAspectRatio = backgroundImageRef.current.width / backgroundImageRef.current.height;
    const targetHeightKm = Math.sqrt(mapConfig.targetAreaKm2 / imageAspectRatio);
    const targetWidthKm = targetHeightKm * imageAspectRatio;
    
    setMapConfig(prev => ({
      ...prev,
      widthKm: targetWidthKm,
      heightKm: targetHeightKm
    }));
    
    // Clear mask cache to force recalculation
    maskCache.clear();
  }, [mapConfig.targetAreaKm2]);

  // State for zoom level
  const [zoomLevel, setZoomLevel] = useState<number>(0.5);

  // State for panning
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // State for transparency mask and cache
  const [transparencyMask, setTransparencyMask] = useState<boolean[][]>([]);
  const [maskCache] = useState<Map<string, boolean[][]>>(new Map());
  
  // State for background image loaded status
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState<boolean>(false);

  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentTypeBase[]>([]);

  // Track current detail level for grid updates
  const [currentDetailLevel, setCurrentDetailLevel] = useState<DetailLevel>(DETAIL_LEVELS[0]);

  // Handle content type changes
  const handleContentTypeChange = useCallback((newContentTypes: ContentTypeBase[]) => {
    setContentTypes(newContentTypes);
  }, []);

  // Get current detail level based on zoom
  const getCurrentDetailLevel = useCallback((): DetailLevel => {
    const matchingLevel = DETAIL_LEVELS.find(
      level => zoomLevel >= level.minZoom && zoomLevel < level.maxZoom
    );
    return matchingLevel || DETAIL_LEVELS[0]; // Default to highest detail if no match
  }, [zoomLevel]);

  // Helper to check if panning is possible
  const canPan = useCallback(() => {
    return backgroundImageRef.current !== null;
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    if (!backgroundImageRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setLastMousePos({ x, y });
    setIsPanning(true);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !backgroundImageRef.current) {
      return;
    }
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate the delta in screen coordinates
    const deltaX = x - lastMousePos.x;
    const deltaY = y - lastMousePos.y;
    
    // Calculate aspect ratios
    const mapAspectRatio = backgroundImageRef.current.width / backgroundImageRef.current.height;
    const canvasAspectRatio = canvasDimensions.width / canvasDimensions.height;
    
    // Calculate base scale
    const baseScale = Math.min(
      canvasDimensions.width / backgroundImageRef.current.width,
      canvasDimensions.height / backgroundImageRef.current.height
    );
    
    // Scale the pan deltas inversely with zoom level and aspect ratio
    const scale = baseScale * zoomLevel;
    const scaledDeltaX = deltaX / scale;
    const scaledDeltaY = deltaY / scale;
    
    // Update pan offset with scaled deltas
    setPanOffset(prev => ({
      x: prev.x + scaledDeltaX,
      y: prev.y + scaledDeltaY
    }));
    
    setLastMousePos({ x, y });
  }, [isPanning, lastMousePos, canvasDimensions, zoomLevel]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsPanning(false);
  }, []);

  // Toggle grid handler
  const handleToggleGrid = useCallback(() => {
    setMapConfig(prev => ({
      ...prev,
      showGrid: !prev.showGrid
    }));
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(Math.min(...ZOOM_LEVELS.filter(z => z >= zoomLevel)));
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
    setZoomLevel(ZOOM_LEVELS[nextIndex]);
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(Math.min(...ZOOM_LEVELS.filter(z => z >= zoomLevel)));
    const nextIndex = Math.max(currentIndex - 1, 0);
    setZoomLevel(ZOOM_LEVELS[nextIndex]);
  }, [zoomLevel]);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(0.5); // Reset to most zoomed out level
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Handle mousewheel zoom
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!backgroundImageRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    // Get current zoom parameters
    const currentIndex = ZOOM_LEVELS.indexOf(Math.min(...ZOOM_LEVELS.filter(z => z >= zoomLevel)));
    const delta = Math.sign(-event.deltaY); // -1 for zoom out, 1 for zoom in
    const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, currentIndex + delta));
    const newZoom = ZOOM_LEVELS[nextIndex];
    
    if (newZoom !== zoomLevel) {
      // Calculate pixels per meter to maintain aspect ratio
      const baseScale = Math.min(
        canvasDimensions.width / backgroundImageRef.current.width,
        canvasDimensions.height / backgroundImageRef.current.height
      );
      const oldScale = baseScale * zoomLevel;
      const newScale = baseScale * newZoom;
      
      // Calculate scaled dimensions without rounding
      const oldScaledWidth = backgroundImageRef.current.width * oldScale;
      const oldScaledHeight = backgroundImageRef.current.height * oldScale;
      
      // Calculate new scaled dimensions without rounding
      const newScaledWidth = backgroundImageRef.current.width * newScale;
      const newScaledHeight = backgroundImageRef.current.height * newScale;
      
      // Calculate the center offset of the image without rounding
      const oldCenterOffsetX = (canvasDimensions.width - oldScaledWidth) / 2;
      const oldCenterOffsetY = (canvasDimensions.height - oldScaledHeight) / 2;
      
      // Calculate cursor position relative to the image without rounding
      const imageX = (cursorX - (oldCenterOffsetX + panOffset.x)) / oldScale;
      const imageY = (cursorY - (oldCenterOffsetY + panOffset.y)) / oldScale;
      
      // Calculate where this point would be in the new zoom level without rounding
      const newCenterOffsetX = (canvasDimensions.width - newScaledWidth) / 2;
      const newCenterOffsetY = (canvasDimensions.height - newScaledHeight) / 2;
      const newPointX = imageX * newScale + newCenterOffsetX;
      const newPointY = imageY * newScale + newCenterOffsetY;
      
      // Calculate the required pan offset to keep the point under the cursor
      // Only round at the final step
      const newPanX = Math.round(cursorX - newPointX);
      const newPanY = Math.round(cursorY - newPointY);
      
      // Apply the new zoom and pan
      setZoomLevel(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    }
  }, [zoomLevel, panOffset, canvasDimensions]);

  // Drawing functions
  const clearCanvas = useCallback(() => {
    if (!contextRef.current) return;
    contextRef.current.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);
  }, [canvasDimensions]);

  const drawBackground = useCallback(() => {
    if (!contextRef.current || !backgroundImageRef.current) return;
    
    const ctx = contextRef.current;
    const img = backgroundImageRef.current;
    
    // Check if transparency mask is initialized
    if (!transparencyMask.length) return;
    
    // Get current detail level
    const detailLevel = getCurrentDetailLevel();
    
    // Calculate dimensions without intermediate rounding
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / img.width;
    const pixelsPerCell = detailLevel.metersPerCell / metersPerPixel;
    
    // Calculate the base scale that preserves aspect ratio
    const mapAspectRatio = img.width / img.height;
    const canvasAspectRatio = canvasDimensions.width / canvasDimensions.height;
    
    // Calculate pixels per meter to maintain aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / img.width,
      canvasDimensions.height / img.height
    );
    const scale = baseScale * zoomLevel;
    
    // Calculate final dimensions with minimal rounding
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    // Center the image and apply pan offset
    // Only round at the final step when actually drawing
    const x = (canvasDimensions.width - scaledWidth) / 2;
    const y = (canvasDimensions.height - scaledHeight) / 2;
    const finalX = Math.round(x + panOffset.x);
    const finalY = Math.round(y + panOffset.y);
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, finalX, finalY, scaledWidth, scaledHeight);
  }, [canvasDimensions, zoomLevel, panOffset, transparencyMask]);

  const drawGrid = useCallback(() => {
    if (!contextRef.current || !mapConfig.showGrid || !transparencyMask.length || !backgroundImageRef.current) return;
    
    const ctx = contextRef.current;
    const img = backgroundImageRef.current;
    
    // Get current detail level
    const detailLevel = getCurrentDetailLevel();
    
    // Calculate dimensions without intermediate rounding
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / img.width;
    const pixelsPerCell = detailLevel.metersPerCell / metersPerPixel;
    
    // Calculate the base scale that preserves aspect ratio
    const mapAspectRatio = img.width / img.height;
    const canvasAspectRatio = canvasDimensions.width / canvasDimensions.height;
    
    // Calculate pixels per meter to maintain aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / img.width,
      canvasDimensions.height / img.height
    );
    const scale = baseScale * zoomLevel;
    
    // Calculate cell dimensions without rounding
    const scaledCellWidth = pixelsPerCell * scale;
    const scaledCellHeight = pixelsPerCell * scale;
    
    // Calculate final dimensions without intermediate rounding
    const adjustedScaledImgWidth = scaledCellWidth * transparencyMask[0].length;
    const adjustedScaledImgHeight = scaledCellHeight * transparencyMask.length;
    
    // Calculate offset to center the grid with the image and apply pan offset
    const baseOffsetX = (canvasDimensions.width - adjustedScaledImgWidth) / 2;
    const baseOffsetY = (canvasDimensions.height - adjustedScaledImgHeight) / 2;
    const offsetX = baseOffsetX + panOffset.x;
    const offsetY = baseOffsetY + panOffset.y;
    
    // Set grid style with thicker lines for better visibility
    ctx.strokeStyle = mapConfig.gridColor;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = mapConfig.gridOpacity;
    ctx.imageSmoothingEnabled = false;
    
    // Draw grid only on non-transparent areas
    for (let row = 0; row < transparencyMask.length; row++) {
      for (let col = 0; col < transparencyMask[row].length; col++) {
        if (transparencyMask[row][col]) {
          // Calculate cell coordinates and only round at the final drawing step
          const x = Math.round(offsetX + (col * scaledCellWidth));
          const y = Math.round(offsetY + (row * scaledCellHeight));
          const right = Math.round(offsetX + ((col + 1) * scaledCellWidth));
          const bottom = Math.round(offsetY + ((row + 1) * scaledCellHeight));
          
          // Draw cell borders without sub-pixel offsets
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(right, y);
          ctx.lineTo(right, bottom);
          ctx.lineTo(x, bottom);
          ctx.lineTo(x, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
    
    // Reset context state
    ctx.globalAlpha = 1.0;
  }, [mapConfig.showGrid, mapConfig.gridOpacity, mapConfig.gridColor, transparencyMask, canvasDimensions, getCurrentDetailLevel, zoomLevel, panOffset]);

  // Draw content types
  const drawContentTypes = useCallback(() => {
    if (!contextRef.current || !backgroundImageRef.current || !transparencyMask.length) return;
    
    const ctx = contextRef.current;
    const img = backgroundImageRef.current;
    
    // Get current detail level
    const detailLevel = getCurrentDetailLevel();
    
    // Calculate the base scale that preserves aspect ratio
    const mapAspectRatio = img.width / img.height;
    const canvasAspectRatio = canvasDimensions.width / canvasDimensions.height;
    
    // Calculate pixels per meter to maintain aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / img.width,
      canvasDimensions.height / img.height
    );
    const scale = baseScale * zoomLevel;
    
    // Calculate dimensions without intermediate rounding
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    // Calculate offset to center the image and apply pan offset
    const baseOffsetX = (canvasDimensions.width - scaledWidth) / 2;
    const baseOffsetY = (canvasDimensions.height - scaledHeight) / 2;
    const offsetX = baseOffsetX + panOffset.x;
    const offsetY = baseOffsetY + panOffset.y;

    // Calculate meters per pixel without rounding
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / img.width;
    const pixelsPerMeter = 1 / metersPerPixel;

    // For each content type, draw instances based on quantity
    contentTypes.forEach(contentType => {
      const positions: { x: number, y: number }[] = [];
      const maxAttempts = contentType.quantity * 10;
      let attempts = 0;

      // Helper function to check if a position respects minimum spacing
      const isValidPosition = (x: number, y: number) => {
        const minSpacingPixels = contentType.minSpacing * pixelsPerMeter;
        return positions.every(pos => {
          const dx = x - pos.x;
          const dy = y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance >= minSpacingPixels;
        });
      };

      while (positions.length < contentType.quantity && attempts < maxAttempts) {
        attempts++;
        
        const seed = `${contentType.id}-${attempts}`;
        const hash = seed.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        const x = Math.abs(hash % img.width);
        const y = Math.abs((hash >> 8) % img.height);
        
        // Calculate cell position without intermediate rounding
        const cellX = Math.floor(x / (detailLevel.metersPerCell / (mapConfig.widthKm * METERS_PER_KM / img.width)));
        const cellY = Math.floor(y / (detailLevel.metersPerCell / (mapConfig.heightKm * METERS_PER_KM / img.height)));
        
        if (transparencyMask[cellY]?.[cellX] && isValidPosition(x, y)) {
          positions.push({ x, y });
        }
      }

      positions.forEach(pos => {
        // Scale position to current zoom level without intermediate rounding
        const scaledX = offsetX + (pos.x * scale);
        const scaledY = offsetY + (pos.y * scale);
        
        // Scale size based on meters and zoom level
        const sizeInPixels = contentType.size * pixelsPerMeter;
        const scaledSize = sizeInPixels * scale;
        
        // Only round at the final step when drawing
        const finalX = Math.round(scaledX);
        const finalY = Math.round(scaledY);
        const finalSize = Math.round(scaledSize);
        
        // Draw the content shape with final rounded values
        drawContentShape(ctx, contentType.shape, finalX, finalY, finalSize, contentType.color);
      });
    });
  }, [canvasDimensions, zoomLevel, panOffset, contentTypes, transparencyMask, getCurrentDetailLevel, mapConfig]);

  // Draw test dot
  const drawTestDotOnMap = useCallback(() => {
    if (!contextRef.current || !backgroundImageRef.current) return;

    // Convert test dot coordinates to screen coordinates
    const screenCoord = mapToScreenCoordinates(
      TEST_DOT,
      mapConfig.widthKm,
      mapConfig.heightKm,
      canvasDimensions.width,
      canvasDimensions.height,
      zoomLevel,
      panOffset
    );

    // Draw the dot with debug info
    drawTestDot(
      contextRef.current,
      screenCoord,
      TEST_DOT,
      zoomLevel
    );
  }, [mapConfig.widthKm, mapConfig.heightKm, canvasDimensions, zoomLevel, panOffset]);

  const render = useCallback(() => {
    clearCanvas();
    drawBackground();
    if (mapConfig.showGrid) {
      drawGrid();
    }
    drawContentTypes();
    drawTestDotOnMap(); // Add test dot
    
    // Request next frame
    animationFrameRef.current = requestAnimationFrame(render);
  }, [clearCanvas, drawBackground, drawGrid, drawContentTypes, drawTestDotOnMap, mapConfig.showGrid]);

  // Set up canvas context and start render loop when ready
  useEffect(() => {
    if (!canvasRef.current || !backgroundImageLoaded || !transparencyMask.length) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: true
    });
    
    if (!context) {
      console.error('Could not get canvas context');
      return;
    }
    
    context.imageSmoothingEnabled = false;
    context.imageSmoothingQuality = 'high';
    contextRef.current = context;
    
    // Start render loop
    render();
    
    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render, backgroundImageLoaded, transparencyMask]);

  // Preload the background image once
  useEffect(() => {
    if (!backgroundImageRef.current) {
      const img = new Image();
      img.src = backgroundImageSrc;
      
      img.onload = () => {
        backgroundImageRef.current = img;
        setBackgroundImageLoaded(true);
      };
      
      img.onerror = (e) => {
        console.error("Error loading background image:", e);
        setBackgroundImageLoaded(true);
      };
    }
  }, []);

  // Create or retrieve transparency mask when detail level changes
  useEffect(() => {
    if (!backgroundImageLoaded || !backgroundImageRef.current) return;
    
    const detailLevel = getCurrentDetailLevel();
    const cacheKey = detailLevel.id;
    
    // Check if we have a cached mask for this detail level
    const cachedMask = maskCache.get(cacheKey);
    if (cachedMask) {
      setTransparencyMask(cachedMask);
      return;
    }
    
    // Calculate cell dimensions based on detail level
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / backgroundImageRef.current.width;
    const cellsPerMeter = 1 / detailLevel.metersPerCell;
    const pixelsPerCell = Math.floor(detailLevel.metersPerCell / metersPerPixel);
    
    // Calculate grid dimensions
    const cellWidth = Math.floor(pixelsPerCell);
    const cellHeight = Math.floor(pixelsPerCell);
    
    // Calculate number of cells
    const widthInCells = Math.ceil(backgroundImageRef.current.width / cellWidth);
    const heightInCells = Math.ceil(backgroundImageRef.current.height / cellHeight);
    
    // Adjust cell counts to ensure we cover the entire image
    const adjustedWidthInCells = Math.ceil(backgroundImageRef.current.width / cellWidth);
    const adjustedHeightInCells = Math.ceil(backgroundImageRef.current.height / cellHeight);
    
    // Create a temporary canvas to analyze the background image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Set canvas size to match the background image
    tempCanvas.width = backgroundImageRef.current.width;
    tempCanvas.height = backgroundImageRef.current.height;
    
    // Draw the background image
    tempCtx.drawImage(backgroundImageRef.current, 0, 0);
    
    // Get image data to analyze transparency
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    // Create a new mask array
    const newMask: boolean[][] = [];
    
    // For each cell, check if the corresponding area in the image has non-transparent pixels
    for (let row = 0; row < adjustedHeightInCells; row++) {
      const maskRow: boolean[] = [];
      for (let col = 0; col < adjustedWidthInCells; col++) {
        // Get the pixel region for this cell (no overlap)
        const startX = Math.floor(col * cellWidth);
        const startY = Math.floor(row * cellHeight);
        const endX = Math.min(tempCanvas.width, Math.floor((col + 1) * cellWidth));
        const endY = Math.min(tempCanvas.height, Math.floor((row + 1) * cellHeight));
        
        // Count non-transparent pixels
        let nonTransparentCount = 0;
        const totalPixels = (endX - startX) * (endY - startY);
        const threshold = Math.floor(totalPixels * 0.15); // 15% threshold
        
        // Sample every other pixel for better performance while maintaining accuracy
        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const index = (y * tempCanvas.width + x) * 4;
            // Only count pixels with alpha > 128 (half opacity) to ignore anti-aliasing
            if (data[index + 3] > 128) {
              nonTransparentCount += 4; // Account for skipped pixels
              if (nonTransparentCount >= threshold) {
                break;
              }
            }
          }
          if (nonTransparentCount >= threshold) {
            break;
          }
        }
        
        const hasContent = nonTransparentCount >= threshold;
        maskRow.push(hasContent);
      }
      newMask.push(maskRow);
    }
    
    // Count cells with content and calculate actual area
    let cellsWithContent = 0;
    for (let row = 0; row < newMask.length; row++) {
      for (let col = 0; col < newMask[row].length; col++) {
        if (newMask[row][col]) {
          cellsWithContent++;
        }
      }
    }

    // Calculate actual area based on cells with content
    const cellAreaKm2 = (detailLevel.metersPerCell * detailLevel.metersPerCell) / (METERS_PER_KM * METERS_PER_KM);
    const actualAreaKm2 = cellsWithContent * cellAreaKm2;

    // Cache the mask for this detail level
    maskCache.set(cacheKey, newMask);
    setTransparencyMask(newMask);

    // Update actual area in map config
    setMapConfig(prev => ({
      ...prev,
      actualAreaKm2: actualAreaKm2
    }));
  }, [mapConfig.widthKm, mapConfig.heightKm, backgroundImageLoaded, getCurrentDetailLevel]);

  // Update canvas dimensions when window is resized
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (mapContainerRef.current) {
        const containerWidth = mapContainerRef.current.clientWidth;
        const containerHeight = mapContainerRef.current.clientHeight;
        
        // Use the full container size without rounding
        setCanvasDimensions({
          width: containerWidth,
          height: containerHeight,
        });
      }
    };
    
    // Initial update
    updateCanvasDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateCanvasDimensions);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Map Visualization Tool</h1>
      </header>
      
      <main className="app-content">
        <div className="controls-panel">
          <div className="zoom-controls">
            <button onClick={handleResetZoom}>Reset Map</button>
          </div>
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
                  if (!isNaN(parsedValue) && backgroundImageRef.current) {
                    const value = Math.min(MAX_AREA_KM2, Math.max(MIN_AREA_KM2, parsedValue));
                    const imageAspectRatio = backgroundImageRef.current.width / backgroundImageRef.current.height;
                    const targetHeightKm = Math.sqrt(value / imageAspectRatio);
                    const targetWidthKm = targetHeightKm * imageAspectRatio;
                    
                    setMapConfig(prev => ({
                      ...prev,
                      targetAreaKm2: value,
                      widthKm: targetWidthKm,
                      heightKm: targetHeightKm
                    }));
                  }
                }}
                title="Target map area in square kilometers"
              />
            </label>
          </div>
          <div className="grid-controls">
            <label>
              <input
                type="checkbox"
                checked={mapConfig.showGrid}
                onChange={handleToggleGrid}
              />
              Show Grid
            </label>
            <input
              type="color"
              value={mapConfig.gridColor}
              onChange={e => setMapConfig(prev => ({
                ...prev,
                gridColor: e.target.value
              }))}
              title="Grid Color"
            />
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={mapConfig.gridOpacity}
              onChange={e => setMapConfig(prev => ({
                ...prev,
                gridOpacity: parseFloat(e.target.value)
              }))}
              title="Grid Opacity"
            />
          </div>
          <div className="detail-info">
            Detail Level {getCurrentDetailLevel().displayName} | Map Area: {mapConfig.actualAreaKm2.toFixed(1)}km² of {mapConfig.targetAreaKm2}km²
          </div>

          <div className="content-panel">
            <ContentTypePanel onContentTypeChange={handleContentTypeChange} />
          </div>
        </div>
        
        <div 
          ref={mapContainerRef} 
          className="map-container"
          style={{ 
            WebkitUserSelect: 'none', 
            userSelect: 'none',
            cursor: isPanning ? 'grabbing' : 'grab',
            touchAction: 'none' // Prevent browser handling of all panning and zooming gestures
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          <canvas 
            ref={canvasRef}
            id="map-canvas"
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
