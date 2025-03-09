import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import mapImage from './assets/map.png';
import deleteIcon from './assets/delete.png';
import { ContentTypePanel } from './components/ContentTypePanel/ContentTypePanel';
import { ContentTypeBase, ContentShape } from './types/ContentTypes';
import { mapToScreenCoordinates, MapCoordinate } from './utils/MapCoordinates';
import { ContentInstanceManager, ContentInstance } from './utils/ContentInstanceManager';
import { ContentRenderer } from './utils/ContentRenderer';
import { DistributorFactory } from './utils/DistributorFactory';
import { DistributionConstraints } from './types/Distribution';

const backgroundImageSrc = mapImage;

// Debug Shape content type definition
const DEBUG_SHAPE_TYPE: ContentTypeBase = {
  id: 'debug-shape',
  name: 'Debug Shape',
  category: 'Exploration',
  description: 'Debug visualization marker',
  color: '#0000FF',
  shape: 'circle',
  size: 10,
  quantity: 100,
  minSpacing: 0,
  canOverlap: true,
  opacity: 1.0
};

// Available shape options
const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'hexagon', label: 'Hexagon' }
] as const;

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
  const contentRendererRef = useRef<ContentRenderer | null>(null);

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

  // State for content instance management
  const [contentInstanceManager] = useState(() => new ContentInstanceManager());
  const [instanceCount, setInstanceCount] = useState(0); // Track instance count changes
  
  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentTypeBase[]>([]);

  // State for debug shapes
  const [numShapesInput, setNumShapesInput] = useState("100");
  const [shapeSizeMeters, setShapeSizeMeters] = useState("10"); // Default 10 meters
  const [shapeOpacity, setShapeOpacity] = useState(1.0);
  const [showShapeDebug, setShowShapeDebug] = useState(false);
  const [shapeColor, setShapeColor] = useState('#0000FF');
  const [shapeBorderSize, setShapeBorderSize] = useState(0);
  const [shapeBorderColor, setShapeBorderColor] = useState('#000000');
  const [shapeType, setShapeType] = useState<ContentShape>('circle');
  const [shapeLabel, setShapeLabel] = useState('');
  const [showShapeLabel, setShowShapeLabel] = useState(false);

  // Track current detail level for grid updates
  const [currentDetailLevel, setCurrentDetailLevel] = useState<DetailLevel>(DETAIL_LEVELS[0]);

  // Get current detail level based on zoom
  const getCurrentDetailLevel = useCallback((): DetailLevel => {
    const matchingLevel = DETAIL_LEVELS.find(
      level => zoomLevel >= level.minZoom && zoomLevel < level.maxZoom
    );
    return matchingLevel || DETAIL_LEVELS[0]; // Default to highest detail if no match
  }, [zoomLevel]);

  // Handle deleting shapes
  const handleDeleteShapes = useCallback(() => {
    // Remove all debug shape instances
    contentInstanceManager.getInstances('debug-shape').forEach(instance => {
      contentInstanceManager.removeInstance('debug-shape', instance.id);
    });
    setInstanceCount(0); // Update instance count
  }, [contentInstanceManager]);

  // Handle adding shapes
  const handleAddShapes = useCallback((targetCount?: number) => {
    if (!backgroundImageRef.current) return;

    const numDots = targetCount ?? parseInt(numShapesInput);
    if (isNaN(numDots) || numDots <= 0) return;

    // Remove existing debug shapes
    handleDeleteShapes();

    // Create distribution constraints
    const constraints: DistributionConstraints = {
      mapImage: backgroundImageRef.current,
      alphaThreshold: 200,
      minSpacing: 0, // No minimum spacing for debug shapes
      maxAttempts: numDots * 10
    };

    // Create content type configuration
    const debugShapeType: ContentTypeBase = {
      ...DEBUG_SHAPE_TYPE,
      mapWidthKm: mapConfig.widthKm,
      mapHeightKm: mapConfig.heightKm,
      defaultProperties: {
        showDebug: showShapeDebug,
        sizeMeters: parseFloat(shapeSizeMeters),
        shape: shapeType,
        opacity: shapeOpacity,
        color: shapeColor,
        borderSize: shapeBorderSize,
        borderColor: shapeBorderColor,
        label: shapeLabel,
        showLabel: showShapeLabel
      }
    };

    // Get distributor and generate instances
    const distributor = DistributorFactory.getDefaultDistributor();
    const instances = distributor.distribute(debugShapeType, numDots, constraints);

    // Add instances to manager
    instances.forEach(instance => {
      if (contentInstanceManager.validateInstance(instance)) {
        contentInstanceManager.addInstance('debug-shape', instance);
        setInstanceCount(prev => prev + 1);
      }
    });
  }, [numShapesInput, mapConfig.widthKm, mapConfig.heightKm, shapeSizeMeters, showShapeDebug, shapeType, shapeColor, shapeOpacity, shapeLabel, showShapeLabel, shapeBorderSize, shapeBorderColor, contentInstanceManager, handleDeleteShapes]);

  // Handle enter key in input field
  const handleInputKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAddShapes();
    }
  }, [handleAddShapes]);

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

  // Create transparency mask when detail level changes
  useEffect(() => {
    if (!backgroundImageRef.current || !backgroundImageLoaded) return;
    
    const detailLevel = getCurrentDetailLevel();
    const cacheKey = detailLevel.id;
    
    // Check if we have a cached mask for this detail level
    const cachedMask = maskCache.get(cacheKey);
    if (cachedMask) {
      setTransparencyMask(cachedMask);
      return;
    }
    
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
    
    // Calculate map dimensions in meters
    const mapWidthMeters = mapConfig.widthKm * METERS_PER_KM;
    const mapHeightMeters = mapConfig.heightKm * METERS_PER_KM;

    // Calculate number of cells based on real-world dimensions
    const widthInCells = Math.ceil(mapWidthMeters / detailLevel.metersPerCell);
    const heightInCells = Math.ceil(mapHeightMeters / detailLevel.metersPerCell);

    // Calculate base scale that preserves aspect ratio (same as mapToScreenCoordinates)
    const baseScale = Math.min(
      tempCanvas.width / mapWidthMeters,
      tempCanvas.height / mapHeightMeters
    );

    // Create a new mask array
    const newMask: boolean[][] = [];
    
    // For each cell, check if the corresponding area in the image has non-transparent pixels
    for (let row = 0; row < heightInCells; row++) {
      const maskRow: boolean[] = [];
      for (let col = 0; col < widthInCells; col++) {
        // Convert cell coordinates to meters
        const metersX = col * detailLevel.metersPerCell;
        const metersY = row * detailLevel.metersPerCell;
        
        // Convert meters to image coordinates
        const startX = Math.floor((metersX / mapWidthMeters) * tempCanvas.width);
        const startY = Math.floor((metersY / mapHeightMeters) * tempCanvas.height);
        const endX = Math.min(tempCanvas.width, Math.floor(((metersX + detailLevel.metersPerCell) / mapWidthMeters) * tempCanvas.width));
        const endY = Math.min(tempCanvas.height, Math.floor(((metersY + detailLevel.metersPerCell) / mapHeightMeters) * tempCanvas.height));
        
        // Count non-transparent pixels
        let nonTransparentCount = 0;
        const totalPixels = (endX - startX) * (endY - startY);
        const threshold = Math.floor(totalPixels * 0.15); // 15% threshold
        
        // Sample every other pixel for better performance
        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const index = (y * tempCanvas.width + x) * 4;
            // Only count pixels with alpha > 128 (half opacity)
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
    
    // Cache the mask for this detail level
    maskCache.set(cacheKey, newMask);
    setTransparencyMask(newMask);
  }, [backgroundImageLoaded, getCurrentDetailLevel, mapConfig.widthKm]);

  // Handle content type changes
  const handleContentTypeChange = useCallback((newContentTypes: ContentTypeBase[]) => {
    setContentTypes(newContentTypes);
  }, []);

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
    
    // Calculate map dimensions in meters
    const mapWidthMeters = mapConfig.widthKm * METERS_PER_KM;
    const mapHeightMeters = mapConfig.heightKm * METERS_PER_KM;

    // Calculate base scale that preserves aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / mapWidthMeters,
      canvasDimensions.height / mapHeightMeters
    );

    // Calculate base dimensions at zoom level 1
    const baseWidth = mapWidthMeters * baseScale;
    const baseHeight = mapHeightMeters * baseScale;

    // Apply zoom to get final dimensions
    const scaledWidth = baseWidth * zoomLevel;
    const scaledHeight = baseHeight * zoomLevel;

    // Calculate center offset
    const centerOffsetX = (canvasDimensions.width - scaledWidth) / 2;
    const centerOffsetY = (canvasDimensions.height - scaledHeight) / 2;

    // Calculate the delta in screen coordinates
    const deltaX = x - lastMousePos.x;
    const deltaY = y - lastMousePos.y;

    // Update pan offset directly - the coordinate system already accounts for zoom
    setPanOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
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
      // Calculate map dimensions in meters
      const mapWidthMeters = mapConfig.widthKm * METERS_PER_KM;
      const mapHeightMeters = mapConfig.heightKm * METERS_PER_KM;

      // Calculate base scale that preserves aspect ratio (same as mapToScreenCoordinates)
      const baseScale = Math.min(
        canvasDimensions.width / mapWidthMeters,
        canvasDimensions.height / mapHeightMeters
      );

      // Calculate base dimensions at zoom level 1
      const baseWidth = mapWidthMeters * baseScale;
      const baseHeight = mapHeightMeters * baseScale;

      // Get current dimensions and position
      const currentWidth = baseWidth * zoomLevel;
      const currentHeight = baseHeight * zoomLevel;
      const currentCenterX = (canvasDimensions.width - currentWidth) / 2;
      const currentCenterY = (canvasDimensions.height - currentHeight) / 2;
      const currentLeft = currentCenterX + panOffset.x;
      const currentTop = currentCenterY + panOffset.y;

      // Convert cursor position to normalized coordinates (0-1)
      const normalizedX = (cursorX - currentLeft) / currentWidth;
      const normalizedY = (cursorY - currentTop) / currentHeight;

      // Calculate new dimensions
      const newWidth = baseWidth * newZoom;
      const newHeight = baseHeight * newZoom;
      const newCenterX = (canvasDimensions.width - newWidth) / 2;
      const newCenterY = (canvasDimensions.height - newHeight) / 2;

      // Calculate where cursor should be in new dimensions
      const newScreenX = normalizedX * newWidth + newCenterX;
      const newScreenY = normalizedY * newHeight + newCenterY;

      // Calculate pan offset to keep cursor point fixed
      const newPanX = cursorX - newScreenX;
      const newPanY = cursorY - newScreenY;

      // Apply new zoom and pan
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
    
    // Calculate map dimensions in meters
    const mapWidthMeters = mapConfig.widthKm * METERS_PER_KM;
    const mapHeightMeters = mapConfig.heightKm * METERS_PER_KM;

    // Calculate base scale that preserves aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / mapWidthMeters,
      canvasDimensions.height / mapHeightMeters
    );

    // Calculate base dimensions at zoom level 1
    const baseWidth = mapWidthMeters * baseScale;
    const baseHeight = mapHeightMeters * baseScale;

    // Apply zoom to get final dimensions
    const scaledWidth = baseWidth * zoomLevel;
    const scaledHeight = baseHeight * zoomLevel;

    // Calculate center offset
    const centerOffsetX = (canvasDimensions.width - scaledWidth) / 2;
    const centerOffsetY = (canvasDimensions.height - scaledHeight) / 2;

    // Calculate final position with pan offset
    const finalX = Math.round(centerOffsetX + panOffset.x);
    const finalY = Math.round(centerOffsetY + panOffset.y);
    
    ctx.imageSmoothingEnabled = false;
    // Draw image scaled to match map dimensions
    ctx.drawImage(
      img,
      finalX,
      finalY,
      scaledWidth,
      scaledHeight
    );
  }, [canvasDimensions, zoomLevel, panOffset, transparencyMask]);

  const drawGrid = useCallback(() => {
    if (!contextRef.current || !mapConfig.showGrid || !transparencyMask.length || !backgroundImageRef.current) return;
    
    const ctx = contextRef.current;
    const img = backgroundImageRef.current;
    
    // Get current detail level
    const detailLevel = getCurrentDetailLevel();
    
    // Calculate map dimensions in meters
    const mapWidthMeters = mapConfig.widthKm * METERS_PER_KM;
    const mapHeightMeters = mapConfig.heightKm * METERS_PER_KM;

    // Calculate base scale that preserves aspect ratio
    const baseScale = Math.min(
      canvasDimensions.width / mapWidthMeters,
      canvasDimensions.height / mapHeightMeters
    );

    // Calculate base dimensions at zoom level 1
    const baseWidth = mapWidthMeters * baseScale;
    const baseHeight = mapHeightMeters * baseScale;

    // Apply zoom to get final dimensions
    const scaledWidth = baseWidth * zoomLevel;
    const scaledHeight = baseHeight * zoomLevel;

    // Calculate center offset
    const centerOffsetX = (canvasDimensions.width - scaledWidth) / 2;
    const centerOffsetY = (canvasDimensions.height - scaledHeight) / 2;

    // Calculate cell dimensions
    const metersPerCell = detailLevel.metersPerCell;
    const cellsPerRow = Math.ceil(mapWidthMeters / metersPerCell);
    const cellsPerCol = Math.ceil(mapHeightMeters / metersPerCell);

    // Calculate scaled cell dimensions
    const baseCellWidth = metersPerCell * baseScale;
    const baseCellHeight = metersPerCell * baseScale;
    const scaledCellWidth = baseCellWidth * zoomLevel;
    const scaledCellHeight = baseCellHeight * zoomLevel;

    // Calculate final grid position
    const offsetX = centerOffsetX + panOffset.x;
    const offsetY = centerOffsetY + panOffset.y;
    
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

    // Initialize or update content renderer
    if (!contentRendererRef.current) {
      contentRendererRef.current = new ContentRenderer(contextRef.current, {
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        mapWidthKm: mapConfig.widthKm,
        mapHeightKm: mapConfig.heightKm,
        zoomLevel,
        panOffset
      });
    } else {
      contentRendererRef.current.updateConfig({
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        mapWidthKm: mapConfig.widthKm,
        mapHeightKm: mapConfig.heightKm,
        zoomLevel,
        panOffset
      });
    }

    // Render each content type's instances
    contentTypes.forEach(contentType => {
      const instances = contentInstanceManager.getInstances(contentType.id);
      contentRendererRef.current?.renderInstances(instances, contentType);
    });
  }, [canvasDimensions, zoomLevel, panOffset, contentTypes, transparencyMask, mapConfig]);

  // Draw debug shapes using stored instances
  const drawRandomShapes = useCallback(() => {
    if (!contextRef.current || !backgroundImageRef.current) return;

    // Initialize or update content renderer
    if (!contentRendererRef.current) {
      contentRendererRef.current = new ContentRenderer(contextRef.current, {
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        mapWidthKm: mapConfig.widthKm,
        mapHeightKm: mapConfig.heightKm,
        zoomLevel,
        panOffset
      });
    } else {
      contentRendererRef.current.updateConfig({
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        mapWidthKm: mapConfig.widthKm,
        mapHeightKm: mapConfig.heightKm,
        zoomLevel,
        panOffset
      });
    }

    // Get all debug shapes
    const debugShapes = contentInstanceManager.getInstances('debug-shape');
    if (debugShapes.length === 0) return;

    // Render each debug shape
    debugShapes.forEach(shape => {
      const shapeType: ContentTypeBase = {
        ...DEBUG_SHAPE_TYPE,
        size: shape.properties?.sizeMeters ?? parseFloat(shapeSizeMeters),
        shape: shape.properties?.shape ?? 'circle',
        opacity: shape.properties?.opacity ?? shapeOpacity,
        color: shape.properties?.color ?? shapeColor,
        borderSize: shape.properties?.borderSize ?? shapeBorderSize,
        borderColor: shape.properties?.borderColor ?? shapeBorderColor,
        label: shape.properties?.label ?? shapeLabel,
        showLabel: shape.properties?.showLabel ?? showShapeLabel
      };
      contentRendererRef.current?.renderInstance(shape, shapeType);
    });
  }, [canvasDimensions, zoomLevel, panOffset, contentInstanceManager, showShapeDebug, shapeSizeMeters, shapeOpacity, shapeColor, shapeLabel, showShapeLabel, shapeBorderSize, shapeBorderColor, mapConfig]);

  const render = useCallback(() => {
    if (!contextRef.current || !backgroundImageRef.current) return;
    
    clearCanvas();
    drawBackground();
    if (mapConfig.showGrid) {
      drawGrid();
    }
    drawContentTypes();
    drawRandomShapes(); // Add random shapes
    
    // Request next frame
    animationFrameRef.current = requestAnimationFrame(render);
  }, [clearCanvas, drawBackground, drawGrid, drawContentTypes, drawRandomShapes, mapConfig.showGrid]);

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
  }, [render, backgroundImageLoaded, transparencyMask, canvasRef]);

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
          <details className="shape-controls" style={{ marginTop: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
            <summary style={{ padding: '8px', cursor: 'pointer', userSelect: 'none', backgroundColor: '#1a1a1a', borderBottom: '1px solid #3a3a3a', transition: 'background-color 0.2s' }}>Debug Shapes</summary>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Count:</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={numShapesInput}
                  onChange={e => {
                    const newValue = e.target.value;
                    setNumShapesInput(newValue);
                    const numDots = parseInt(newValue);
                    if (!isNaN(numDots) && numDots > 0) {
                      handleAddShapes(numDots);
                    }
                  }}
                  style={{ width: '60px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Shape:</span>
                <select
                  value={shapeType}
                  onChange={e => {
                    const newShape = e.target.value as ContentShape;
                    setShapeType(newShape);
                    // Update existing dots' shape property without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          shape: newShape
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ 
                    width: '80px',
                    border: '1px solid rgb(118, 118, 118)',
                    backgroundColor: 'rgb(59, 59, 59)',
                    color: '#ffffff',
                    padding: '1px'
                  }}
                >
                  {SHAPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Size (m):</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={shapeSizeMeters}
                  onChange={e => {
                    const newSize = e.target.value;
                    setShapeSizeMeters(newSize);
                    // Update existing dots' size property without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          sizeMeters: parseFloat(newSize)
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ width: '60px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={shapeOpacity}
                  onChange={e => {
                    const newOpacity = parseFloat(e.target.value);
                    setShapeOpacity(newOpacity);
                    // Update existing shapes' opacity property without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          opacity: newOpacity
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '30px', textAlign: 'right' }}>{(shapeOpacity * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Color:</span>
                <input
                  type="color"
                  value={shapeColor}
                  onChange={e => {
                    const newColor = e.target.value;
                    setShapeColor(newColor);
                    // Update existing shapes' color property without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          color: newColor
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ 
                    width: '60px',
                    height: '20px',
                    padding: '1px',
                    backgroundColor: 'rgb(59, 59, 59)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Border:</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={shapeBorderSize}
                  onChange={e => {
                    const newSize = parseInt(e.target.value);
                    setShapeBorderSize(newSize);
                    // Update existing shapes' border size without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          borderSize: newSize
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ width: '60px' }}
                />
                <input
                  type="color"
                  value={shapeBorderColor}
                  onChange={e => {
                    const newColor = e.target.value;
                    setShapeBorderColor(newColor);
                    // Update existing shapes' border color without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          borderColor: newColor
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ 
                    width: '60px',
                    height: '20px',
                    padding: '1px',
                    backgroundColor: 'rgb(59, 59, 59)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Label:</span>
                <input
                  type="text"
                  value={shapeLabel}
                  onChange={e => {
                    const newLabel = e.target.value;
                    setShapeLabel(newLabel);
                    // Update existing shapes' label without regenerating them
                    const shapes = contentInstanceManager.getInstances('debug-shape');
                    shapes.forEach(shape => {
                      const updatedInstance = {
                        ...shape,
                        properties: {
                          ...shape.properties,
                          label: newLabel
                        }
                      };
                      contentInstanceManager.removeInstance('debug-shape', shape.id);
                      contentInstanceManager.addInstance('debug-shape', updatedInstance);
                    });
                    setInstanceCount(shapes.length); // Maintain count
                  }}
                  style={{ 
                    flex: 1,
                    backgroundColor: 'rgb(59, 59, 59)',
                    border: '1px solid rgb(118, 118, 118)',
                    color: '#ffffff',
                    padding: '1px 4px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="checkbox"
                    checked={showShapeLabel}
                    onChange={e => {
                      const newShowLabel = e.target.checked;
                      setShowShapeLabel(newShowLabel);
                      // Update existing shapes' showLabel property without regenerating them
                      const shapes = contentInstanceManager.getInstances('debug-shape');
                      shapes.forEach(shape => {
                        const updatedInstance = {
                          ...shape,
                          properties: {
                            ...shape.properties,
                            showLabel: newShowLabel
                          }
                        };
                        contentInstanceManager.removeInstance('debug-shape', shape.id);
                        contentInstanceManager.addInstance('debug-shape', updatedInstance);
                      });
                      setInstanceCount(shapes.length); // Maintain count
                    }}
                  />
                  Show Label
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="checkbox"
                    checked={showShapeDebug}
                    onChange={e => {
                      const newShowDebug = e.target.checked;
                      setShowShapeDebug(newShowDebug);
                      // Update existing dots' debug property without regenerating them
                      const shapes = contentInstanceManager.getInstances('debug-shape');
                      shapes.forEach(shape => {
                        const updatedInstance = {
                          ...shape,
                          properties: {
                            ...shape.properties,
                            showDebug: newShowDebug
                          }
                        };
                        contentInstanceManager.removeInstance('debug-shape', shape.id);
                        contentInstanceManager.addInstance('debug-shape', updatedInstance);
                      });
                      setInstanceCount(shapes.length); // Maintain count
                    }}
                  />
                  Show Debug Text
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <button 
                  onClick={() => handleAddShapes()}
                  style={{ flex: 1 }}
                >
                  Add Shapes
                </button>
                <button
                  onClick={handleDeleteShapes}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = 'scale(0.95)';
                    btn.style.filter = 'brightness(0.8)';
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = 'scale(1)';
                    btn.style.filter = 'brightness(1)';
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = 'scale(1)';
                    btn.style.filter = 'brightness(1)';
                  }}
                >
                  <img 
                    src={deleteIcon} 
                    alt="Delete shapes"
                    style={{ 
                      width: '20px',
                      height: '20px'
                    }}
                  />
                </button>
              </div>
            </div>
          </details>
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
          {/* Bottom left detail level indicator */}
          <div style={{ 
            position: 'absolute', 
            bottom: '10px', 
            left: '10px', 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {getCurrentDetailLevel().metersPerCell}m {mapConfig.actualAreaKm2.toFixed(1)}km²
          </div>
          {/* Right side details panel */}
          <div style={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px', 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '14px',
            minWidth: '150px'
          }}>
            <div style={{ marginBottom: '5px' }}>
              Map Size: {mapConfig.widthKm.toFixed(1)}km × {mapConfig.heightKm.toFixed(1)}km ({mapConfig.actualAreaKm2.toFixed(1)}km²)
            </div>
            <div style={{ marginBottom: '5px' }}>
              Debug Shapes: {instanceCount}
            </div>
            <div>
              Shape Size: {shapeSizeMeters}m
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
