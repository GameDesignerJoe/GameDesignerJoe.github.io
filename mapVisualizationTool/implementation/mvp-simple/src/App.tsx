import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Import image from public directory
const backgroundImageSrc = './CruxMap_BW_trans.png';

// Define types for map configuration
interface MapConfig {
  widthKm: number;  // Width in kilometers
  heightKm: number; // Height in kilometers
  showGrid: boolean;
  gridOpacity: number;
  visualCellSize: number; // Visual size of each cell in pixels
}

// Constants for real-world units
const METERS_PER_KM = 1000;
const BASE_CELL_SIZE_METERS = 1; // Base cell size is 1m x 1m

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
  { id: 'L0', category: 'Low', minZoom: 0.0, maxZoom: 1.0, metersPerCell: 400, displayName: 'Level 0 (400m)' },
  // Level 1: 200m cells at 1x zoom
  { id: 'L1', category: 'Low', minZoom: 1.0, maxZoom: 2.0, metersPerCell: 200, displayName: 'Level 1 (200m)' },
  // Level 2: 100m cells at 2x zoom
  { id: 'L2', category: 'Low', minZoom: 2.0, maxZoom: 4.0, metersPerCell: 100, displayName: 'Level 2 (100m)' },
  // Level 3: 50m cells at 4x zoom
  { id: 'L3', category: 'Medium', minZoom: 4.0, maxZoom: 6.0, metersPerCell: 50, displayName: 'Level 3 (50m)' },
  // Level 4: 10m cells at 8x zoom
  { id: 'L4', category: 'High', minZoom: 6.0, maxZoom: Infinity, metersPerCell: 10, displayName: 'Level 4 (10m)' },
];

// Define types for content types
interface ContentType {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  percentage: number;
}

function App() {
  // Canvas dimensions state
  const [canvasDimensions, setCanvasDimensions] = useState({ width: Math.floor(1800), height: Math.floor(1350) });
  
  // References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // State for map configuration
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    widthKm: 6,  // 6km width to match image aspect ratio
    heightKm: 4, // 4km height (24 sq km total area)
    showGrid: true,
    gridOpacity: 0.7,
    visualCellSize: 10, // Visual size of each cell in pixels
  });

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

  // Track current detail level for grid updates
  const [currentDetailLevel, setCurrentDetailLevel] = useState<DetailLevel>(DETAIL_LEVELS[0]);

  // Get current detail level based on zoom
  const getCurrentDetailLevel = useCallback((): DetailLevel => {
    const matchingLevel = DETAIL_LEVELS.find(
      level => zoomLevel >= level.minZoom && zoomLevel < level.maxZoom
    );
    return matchingLevel || DETAIL_LEVELS[0]; // Default to highest detail if no match
  }, [zoomLevel]);

  // Helper to check if panning is possible
  const canPan = useCallback(() => {
    if (!backgroundImageRef.current) {
      return false;
    }

    const baseScale = canvasDimensions.height / backgroundImageRef.current.height;
    const scale = baseScale * zoomLevel;
    const scaledWidth = Math.floor(backgroundImageRef.current.width * scale);
    const scaledHeight = Math.floor(backgroundImageRef.current.height * scale);

    return scaledWidth > canvasDimensions.width || scaledHeight > canvasDimensions.height;
  }, [canvasDimensions, zoomLevel]);

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    if (!canPan()) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(event.clientX - rect.left);
    const y = Math.floor(event.clientY - rect.top);
    setLastMousePos({ x, y });
    setIsPanning(true);
  }, [canPan]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !backgroundImageRef.current) {
      return;
    }
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(event.clientX - rect.left);
    const y = Math.floor(event.clientY - rect.top);
    
    const deltaX = Math.floor((x - lastMousePos.x) * 1.5);
    const deltaY = Math.floor((y - lastMousePos.y) * 1.5);
    
    const baseScale = canvasDimensions.height / backgroundImageRef.current.height;
    const scale = baseScale * zoomLevel;
    const scaledWidth = Math.floor(backgroundImageRef.current.width * scale);
    const scaledHeight = Math.floor(backgroundImageRef.current.height * scale);
    
    const maxPanX = Math.floor(Math.max(0, (scaledWidth - canvasDimensions.width) / 2));
    const maxPanY = Math.floor(Math.max(0, (scaledHeight - canvasDimensions.height) / 2));
    
    setPanOffset(prev => {
      const newX = Math.floor(Math.max(-maxPanX, Math.min(maxPanX, prev.x + deltaX)));
      const newY = Math.floor(Math.max(-maxPanY, Math.min(maxPanY, prev.y + deltaY)));
      return { x: newX, y: newY };
    });
    
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
    const currentIndex = ZOOM_LEVELS.indexOf(Math.min(...ZOOM_LEVELS.filter(z => z >= zoomLevel)));
    const delta = Math.sign(-event.deltaY); // -1 for zoom out, 1 for zoom in
    const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, currentIndex + delta));
    const newZoom = ZOOM_LEVELS[nextIndex];
    
    if (newZoom !== zoomLevel) {
      setZoomLevel(newZoom);
    }
  }, [zoomLevel]);

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
    
    // Calculate cell dimensions based on detail level
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / img.width;
    const cellsPerMeter = 1 / detailLevel.metersPerCell;
    const pixelsPerCell = Math.floor(detailLevel.metersPerCell / metersPerPixel);
    
    // Calculate grid dimensions
    const cellWidth = Math.floor(pixelsPerCell);
    const cellHeight = Math.floor(pixelsPerCell);
    
    // Calculate base scaling to fit height
    const baseScale = canvasDimensions.height / img.height;
    const scale = baseScale * zoomLevel;
    
    // Scale the cell dimensions and ensure they're whole numbers
    const scaledCellWidth = Math.floor(cellWidth * scale);
    const scaledCellHeight = Math.floor(cellHeight * scale);
    
    // Calculate final dimensions based on cell count
    const scaledWidth = Math.floor(scaledCellWidth * transparencyMask[0].length);
    const scaledHeight = Math.floor(scaledCellHeight * transparencyMask.length);
    
    // Center the image and apply pan offset
    const x = Math.floor((canvasDimensions.width - scaledWidth) / 2);
    const y = Math.floor((canvasDimensions.height - scaledHeight) / 2);
    const finalX = Math.floor(x + panOffset.x);
    const finalY = Math.floor(y + panOffset.y);
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, finalX, finalY, scaledWidth, scaledHeight);
  }, [canvasDimensions, zoomLevel, panOffset, transparencyMask]);

  const drawGrid = useCallback(() => {
    if (!contextRef.current || !mapConfig.showGrid || !transparencyMask.length || !backgroundImageRef.current) return;
    
    const ctx = contextRef.current;
    const img = backgroundImageRef.current;
    
    // Get current detail level
    const detailLevel = getCurrentDetailLevel();
    
    // Calculate cell dimensions based on detail level
    const metersPerPixel = (mapConfig.widthKm * METERS_PER_KM) / img.width;
    const cellsPerMeter = 1 / detailLevel.metersPerCell;
    const pixelsPerCell = Math.floor(detailLevel.metersPerCell / metersPerPixel);
    
    // Calculate grid dimensions
    const cellWidth = Math.floor(pixelsPerCell);
    const cellHeight = Math.floor(pixelsPerCell);
    
    // Calculate base scaling to fit height
    const baseScale = canvasDimensions.height / img.height;
    const scale = baseScale * zoomLevel;
    
    // Scale the cell dimensions and ensure they're whole numbers
    const scaledCellWidth = Math.floor(cellWidth * scale);
    const scaledCellHeight = Math.floor(cellHeight * scale);
    
    // Calculate final dimensions based on cell count
    const adjustedScaledImgWidth = scaledCellWidth * transparencyMask[0].length;
    const adjustedScaledImgHeight = scaledCellHeight * transparencyMask.length;
    
    // Calculate offset to center the grid with the image and apply pan offset
    const baseOffsetX = Math.floor((canvasDimensions.width - adjustedScaledImgWidth) / 2);
    const baseOffsetY = Math.floor((canvasDimensions.height - adjustedScaledImgHeight) / 2);
    const offsetX = Math.floor(baseOffsetX + panOffset.x);
    const offsetY = Math.floor(baseOffsetY + panOffset.y);
    
    // Set grid style with thicker lines for better visibility
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = mapConfig.gridOpacity;
    ctx.imageSmoothingEnabled = false;
    
    // Draw grid only on non-transparent areas
    for (let row = 0; row < transparencyMask.length; row++) {
      for (let col = 0; col < transparencyMask[row].length; col++) {
        if (transparencyMask[row][col]) {
          // Calculate cell coordinates using consistent Math.floor
          const x = Math.floor(offsetX + (col * scaledCellWidth));
          const y = Math.floor(offsetY + (row * scaledCellHeight));
          const right = Math.floor(x + scaledCellWidth);
          const bottom = Math.floor(y + scaledCellHeight);
          
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
  }, [mapConfig.showGrid, mapConfig.gridOpacity, transparencyMask, canvasDimensions, getCurrentDetailLevel, zoomLevel, panOffset]);

  const render = useCallback(() => {
    clearCanvas();
    drawBackground();
    if (mapConfig.showGrid) {
      drawGrid();
    }
    
    // Request next frame
    animationFrameRef.current = requestAnimationFrame(render);
  }, [clearCanvas, drawBackground, drawGrid, mapConfig.showGrid]);

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
    
    // Add 2-pixel overlap to avoid missing pixels at edges
    const overlap = 2;
    
    // For each cell, check if the corresponding area in the image has non-transparent pixels
    for (let row = 0; row < adjustedHeightInCells; row++) {
      const maskRow: boolean[] = [];
      for (let col = 0; col < adjustedWidthInCells; col++) {
        // Get the pixel region for this cell with overlap
        const startX = Math.max(0, Math.floor(col * cellWidth) - overlap);
        const startY = Math.max(0, Math.floor(row * cellHeight) - overlap);
        const endX = Math.min(tempCanvas.width, Math.floor((col + 1) * cellWidth) + overlap);
        const endY = Math.min(tempCanvas.height, Math.floor((row + 1) * cellHeight) + overlap);
        
        let hasContent = false;
        
        // First try dense grid sampling
        const sampleStepX = Math.max(1, Math.floor((endX - startX) / 20));
        const sampleStepY = Math.max(1, Math.floor((endY - startY) / 20));
        
        // Sample in a dense grid pattern
        for (let y = startY; y < endY; y += sampleStepY) {
          for (let x = startX; x < endX; x += sampleStepX) {
            const index = (y * tempCanvas.width + x) * 4;
            if (data[index + 3] > 0) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) break;
        }
        
        // If no content found in grid sampling, check every pixel in the cell
        if (!hasContent) {
          for (let y = startY; y < endY && !hasContent; y++) {
            for (let x = startX; x < endX; x++) {
              const index = (y * tempCanvas.width + x) * 4;
              if (data[index + 3] > 0) {
                hasContent = true;
                break;
              }
            }
          }
        }
        
        maskRow.push(hasContent);
      }
      newMask.push(maskRow);
    }
    
    // Cache the mask for this detail level
    maskCache.set(cacheKey, newMask);
    setTransparencyMask(newMask);
  }, [mapConfig, backgroundImageLoaded, getCurrentDetailLevel]);

  // Update canvas dimensions when window is resized
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (mapContainerRef.current) {
        const containerWidth = mapContainerRef.current.clientWidth;
        const containerHeight = mapContainerRef.current.clientHeight;
        
        // Use the full container size
        setCanvasDimensions({
          width: Math.floor(containerWidth),
          height: Math.floor(containerHeight),
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
            <button onClick={handleZoomIn}>Zoom In (+)</button>
            <button onClick={handleZoomOut}>Zoom Out (-)</button>
            <button onClick={handleResetZoom}>Reset Zoom</button>
            <div className="zoom-info">
              Zoom: {(zoomLevel * 100).toFixed(0)}%
            </div>
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
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={mapConfig.gridOpacity}
              onChange={e => setMapConfig(prev => ({
                ...prev,
                gridOpacity: parseFloat(e.target.value)
              }))}
            />
          </div>
          <div className="detail-info">
            Detail Level: {getCurrentDetailLevel().displayName}
          </div>
        </div>
        
        <div 
          ref={mapContainerRef} 
          className="map-container"
          style={{ 
            WebkitUserSelect: 'none', 
            userSelect: 'none',
            cursor: canPan() ? (isPanning ? 'grabbing' : 'grab') : 'default',
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
