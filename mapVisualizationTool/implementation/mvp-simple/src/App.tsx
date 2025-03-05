import { useState, useEffect, useRef } from 'react';
import './App.css';
import backgroundImageSrc from './CruxMap_BW_trans.png';

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
const CELL_SIZE_METERS = 1; // Each cell is 1m x 1m

// Define types for content types
export interface ContentType {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  percentage: number;
}

// Define types for analysis data
export interface AnalysisData {
  contentDistribution: {
    [key: string]: number;
  };
  densityMap: {
    [key: string]: number[][];
  };
  warnings: string[];
}

function App() {
  // Canvas dimensions state (will be calculated based on container size)
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1800, height: 1350 });
  
  // Reference to the map container element
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // State for map configuration
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    widthKm: 5,
    heightKm: 4,
    showGrid: true,
    gridOpacity: 0.7,
    visualCellSize: 10, // Visual size of each cell in pixels
  });

  // Helper functions for unit conversions
  const getWidthInCells = () => Math.floor(mapConfig.widthKm * METERS_PER_KM / CELL_SIZE_METERS);
  const getHeightInCells = () => Math.floor(mapConfig.heightKm * METERS_PER_KM / CELL_SIZE_METERS);

  // State for transparency mask
  const [transparencyMask, setTransparencyMask] = useState<boolean[][]>([]);
  
  // State for background image loaded status
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState<boolean>(false);
  
  // Reference to the background image to prevent reloading
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentType[]>([
    { id: '1', name: 'Forest', color: '#2d6a4f', borderColor: '#1b4332', percentage: 40 },
    { id: '2', name: 'Mountains', color: '#6c757d', borderColor: '#495057', percentage: 20 },
    { id: '3', name: 'Water', color: '#0077b6', borderColor: '#023e8a', percentage: 30 },
    { id: '4', name: 'Desert', color: '#e9c46a', borderColor: '#ca6702', percentage: 10 },
  ]);

  // State for map data (will be generated)
  const [mapData, setMapData] = useState<string[][]>([]);

  // State for analysis data
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    contentDistribution: {},
    densityMap: {},
    warnings: [],
  });

  // Function to update canvas dimensions based on container size
  const updateCanvasDimensions = () => {
    if (mapContainerRef.current) {
      const container = mapContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Set canvas dimensions to match container size
      setCanvasDimensions({ width, height });
    }
  };
  
  // Update canvas dimensions when window is resized
  useEffect(() => {
    // Initial update
    updateCanvasDimensions();
    
    // Add resize event listener
    window.addEventListener('resize', updateCanvasDimensions);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, []);

  // Function to generate map data using flood fill algorithm for contiguous biomes
  const generateMap = () => {
    // Calculate grid dimensions in cells (1m per cell)
    const widthInCells = getWidthInCells();
    const heightInCells = getHeightInCells();
    
    // Initialize empty map with null values
    const newMapData: (string | null)[][] = Array(heightInCells)
      .fill(null)
      .map(() => Array(widthInCells).fill(null));
    
    // Calculate total cells
    const totalCells = widthInCells * heightInCells;
    
    // Sort content types by percentage (descending)
    const sortedContentTypes = [...contentTypes].sort((a, b) => b.percentage - a.percentage);
    
    // For each content type, fill a contiguous region
    for (const contentType of sortedContentTypes) {
      // Calculate how many cells this content type should occupy
      const targetCellCount = Math.floor((contentType.percentage / 100) * totalCells);
      
      // Find a valid starting point (an empty cell)
      let startX = -1;
      let startY = -1;
      
      // Try to find an empty cell
      let attempts = 0;
      while (startX === -1 && attempts < 100) {
        const randomX = Math.floor(Math.random() * widthInCells);
        const randomY = Math.floor(Math.random() * heightInCells);
        
        if (newMapData[randomY][randomX] === null) {
          startX = randomX;
          startY = randomY;
        }
        
        attempts++;
      }
      
      // If we couldn't find an empty cell, just use the first null cell we find
      if (startX === -1) {
        for (let y = 0; y < heightInCells; y++) {
          for (let x = 0; x < widthInCells; x++) {
            if (newMapData[y][x] === null) {
              startX = x;
              startY = y;
              break;
            }
          }
          if (startX !== -1) break;
        }
      }
      
      // If we still couldn't find an empty cell, skip this content type
      if (startX === -1) continue;
      
      // Perform flood fill from the starting point
      let cellsToFill = targetCellCount;
      let currentCells = 0;
      
      // Set the starting cell
      newMapData[startY][startX] = contentType.id;
      currentCells++;
      
      // Queue for BFS (Breadth-First Search)
      const queue: [number, number][] = [[startX, startY]];
      
      // Directions for adjacent cells (4-way connectivity)
      const directions = [
        [0, 1],  // down
        [1, 0],  // right
        [0, -1], // up
        [-1, 0]  // left
      ];
      
      // Add diagonal directions for more natural-looking regions
      directions.push([1, 1], [-1, -1], [1, -1], [-1, 1]);
      
      // Shuffle directions to create more natural-looking regions
      directions.sort(() => Math.random() - 0.5);
      
      // Continue filling until we've reached the target or no more cells are available
      while (queue.length > 0 && currentCells < cellsToFill) {
        const [x, y] = queue.shift()!;
        
        // Shuffle directions for each cell to create more natural-looking regions
        const shuffledDirections = [...directions].sort(() => Math.random() - 0.5);
        
        // Try each direction
        for (const [dx, dy] of shuffledDirections) {
          const newX = x + dx;
          const newY = y + dy;
          
          // Check if the new position is valid and empty
          if (
            newX >= 0 && newX < widthInCells &&
            newY >= 0 && newY < heightInCells &&
            newMapData[newY][newX] === null
          ) {
            // Fill this cell
            newMapData[newY][newX] = contentType.id;
            currentCells++;
            
            // Add to queue for further expansion
            queue.push([newX, newY]);
            
            // Stop if we've reached the target
            if (currentCells >= cellsToFill) break;
          }
        }
      }
    }
    
    // Fill any remaining empty cells with the first content type
    for (let y = 0; y < heightInCells; y++) {
      for (let x = 0; x < widthInCells; x++) {
        if (newMapData[y][x] === null) {
          newMapData[y][x] = sortedContentTypes[0].id;
        }
      }
    }
    
    // Convert to string[][] (removing null values)
    const finalMapData = newMapData.map(row => 
      row.map(cell => cell === null ? sortedContentTypes[0].id : cell)
    );
    
    setMapData(finalMapData);
    
    // Generate analysis data
    analyzeMap(finalMapData);
  };

  // Function to analyze map data
  const analyzeMap = (data: string[][]) => {
    // This is a placeholder for the actual analysis algorithm
    // In the full implementation, this would calculate various metrics
    
    // Count content distribution
    const distribution: {[key: string]: number} = {};
    contentTypes.forEach(type => {
      distribution[type.id] = 0;
    });
    
    data.forEach(row => {
      row.forEach(cell => {
        distribution[cell]++;
      });
    });
    
    // Convert counts to percentages
    const totalCells = getWidthInCells() * getHeightInCells();
    Object.keys(distribution).forEach(key => {
      distribution[key] = Math.round((distribution[key] / totalCells) * 100);
    });
    
    // Generate simple density map (placeholder)
    const densityMap: {[key: string]: number[][]} = {};
    contentTypes.forEach(type => {
      densityMap[type.id] = Array(getHeightInCells()).fill(0).map(() => 
        Array(getWidthInCells()).fill(0)
      );
    });
    
    // Generate warnings (placeholder)
    const warnings: string[] = [];
    
    // Check if any content type has 0% distribution
    contentTypes.forEach(type => {
      if (distribution[type.id] === 0) {
        warnings.push(`Warning: ${type.name} has 0% distribution in the generated map.`);
      }
    });
    
    // Check if distribution is significantly different from requested percentages
    contentTypes.forEach(type => {
      const diff = Math.abs(distribution[type.id] - type.percentage);
      if (diff > 10) {
        warnings.push(`Warning: ${type.name} distribution (${distribution[type.id]}%) differs significantly from requested (${type.percentage}%).`);
      }
    });
    
    setAnalysisData({
      contentDistribution: distribution,
      densityMap,
      warnings,
    });
  };

  // Function to draw a square
  const drawSquare = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    strokeColor: string = '#ffffff',
  ) => {
    // Use the full size without any gap
    const cellSize = size;
    
    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cellSize, cellSize);
    
    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.5; // Thinner line for less visible grid
    ctx.strokeRect(x, y, cellSize, cellSize);
  };
  
  // Function to get square coordinates
  const getSquareCoordinates = (col: number, row: number, size: number) => {
    // Use the provided size parameter (visualCellSize) for calculating positions
    // Calculate the position of the cell based on the size
    const x = col * size;
    const y = row * size;
    
    return { x, y };
  };
  
  // Function to get level of detail based on zoom level
  const getLevelOfDetail = () => {
    // At higher zoom levels, we might want to show more detail
    // At lower zoom levels, we might want to show less detail
    if (zoomLevel >= 2) {
      return 'High'; // High detail level
    } else if (zoomLevel >= 1) {
      return 'Medium'; // Medium detail level
    } else {
      return 'Low'; // Low detail level
    }
  };

  // Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // State for zoom level
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
  // Calculate the effective cell size based on zoom level
  const getEffectiveCellSize = () => mapConfig.visualCellSize * zoomLevel;
  
  // Calculate what each cell represents in real-world units
  const getCellRepresentation = () => {
    // Each cell in the data is 1 meter
    // The visual representation depends on the zoom level
    
    // Calculate the scale based on zoom level
    const scale = zoomLevel >= 1 
      ? `1:${Math.round(1 / zoomLevel)}`
      : `${Math.round(zoomLevel * 100)}%`;
    
    return `1 square = ${CELL_SIZE_METERS} meter${CELL_SIZE_METERS !== 1 ? 's' : ''} (Scale ${scale})`;
  };
  
  // Preload the background image once
  useEffect(() => {
    if (!backgroundImageRef.current) {
      const img = new Image();
      img.src = backgroundImageSrc;
      img.onload = () => {
        backgroundImageRef.current = img;
        setBackgroundImageLoaded(true);
      };
      img.onerror = () => {
        console.error('Error loading background image');
        setBackgroundImageLoaded(true);
      };
    }
  }, []);
  
  // Function to draw the map with current zoom level
  const drawMapWithZoom = () => {
    if (!backgroundImageRef.current) return;
    
    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Ensure canvas has the dimensions from state
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;
    
    // Save the current transformation matrix
    ctx.save();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);
    
    // Apply zoom transformation to the entire canvas
    // Scale from the center of the canvas
    ctx.translate(canvasDimensions.width / 2, canvasDimensions.height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-canvasDimensions.width / 2, -canvasDimensions.height / 2);
    
    // Draw the background image to fill the entire canvas
    ctx.drawImage(backgroundImageRef.current, 0, 0, canvasDimensions.width, canvasDimensions.height);
    
    // Draw map data if available
    if (mapData.length > 0) {
      drawMapData(ctx, mapData, transparencyMask);
    } else if (mapConfig.showGrid) {
      // Draw empty grid if no data but grid is enabled
      drawEmptyGrid(ctx, transparencyMask);
    }
    
    // Restore the transformation matrix
    ctx.restore();
  };
  
  // Create transparency mask when map configuration changes
  useEffect(() => {
    if (!backgroundImageLoaded || !backgroundImageRef.current) return;
    
    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Use dimensions from state
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);
    
    // Draw the background image without zoom to create the mask
    ctx.drawImage(backgroundImageRef.current, 0, 0, canvasDimensions.width, canvasDimensions.height);
    
    // Create transparency mask
    const imageData = ctx.getImageData(0, 0, canvasDimensions.width, canvasDimensions.height);
    const mask: boolean[][] = [];
    
    // Initialize the mask array
    const heightInCells = getHeightInCells();
    const widthInCells = getWidthInCells();
    
    for (let y = 0; y < heightInCells; y++) {
      mask[y] = [];
      for (let x = 0; x < widthInCells; x++) {
        // Get the corresponding position on the image
        const { x: pixelX, y: pixelY } = getSquareCoordinates(x, y, mapConfig.visualCellSize);
        
        // Sample the center of where the square would be
        const centerX = pixelX + mapConfig.visualCellSize / 2;
        const centerY = pixelY + mapConfig.visualCellSize / 2;
        
        // Check if this point is within canvas bounds
        if (centerX < canvasDimensions.width && centerY < canvasDimensions.height) {
          // Get the pixel index in the image data array
          const pixelIndex = ((Math.floor(centerY) * canvasDimensions.width) + Math.floor(centerX)) * 4;
          
          // Check alpha channel (index + 3)
          const alpha = imageData.data[pixelIndex + 3];
          
          // If alpha is above threshold (e.g., 50), consider it non-transparent
          mask[y][x] = alpha > 50;
        } else {
          mask[y][x] = false;
        }
      }
    }
    
    setTransparencyMask(mask);
    
    // Redraw with zoom
    drawMapWithZoom();
  }, [mapConfig.widthKm, mapConfig.heightKm, mapConfig.visualCellSize, backgroundImageLoaded, canvasDimensions]);
  
  // Function to draw map data with transparency mask
  const drawMapData = (
    ctx: CanvasRenderingContext2D, 
    data: string[][], 
    mask: boolean[][]
  ) => {
    // Set global alpha for semi-transparency
    ctx.globalAlpha = mapConfig.gridOpacity;
    
    // Draw filled squares based on mapData, respecting the mask
    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        // Only draw if this position is non-transparent in the mask
        if (mask[row] && mask[row][col]) {
          const contentTypeId = data[row][col];
          const contentType = contentTypes.find(type => type.id === contentTypeId);
          
          if (contentType) {
            const { x, y } = getSquareCoordinates(col, row, mapConfig.visualCellSize);
            drawSquare(ctx, x, y, getEffectiveCellSize(), contentType.color, contentType.borderColor);
          }
        }
      }
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
  };
  
  // Function to draw empty grid with transparency mask
  const drawEmptyGrid = (
    ctx: CanvasRenderingContext2D,
    mask: boolean[][]
  ) => {
    // Set global alpha for semi-transparency
    ctx.globalAlpha = mapConfig.gridOpacity;
    
    // Draw empty grid, respecting the mask
    const heightInCells = getHeightInCells();
    const widthInCells = getWidthInCells();
    
    for (let row = 0; row < heightInCells; row++) {
      for (let col = 0; col < widthInCells; col++) {
        // Only draw if this position is non-transparent in the mask
        if (mask[row] && mask[row][col]) {
          const { x, y } = getSquareCoordinates(col, row, mapConfig.visualCellSize);
          drawSquare(ctx, x, y, getEffectiveCellSize(), '#e2e8f0', '#cbd5e1');
        }
      }
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
  };
  
  // Add mouse wheel event listener for zooming
  useEffect(() => {
    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Determine zoom direction
      const zoomDirection = e.deltaY < 0 ? 1 : -1;
      
      // Calculate new zoom level
      const zoomFactor = 0.1; // 10% zoom per wheel tick
      const newZoomLevel = Math.max(0.5, Math.min(3, zoomLevel + (zoomDirection * zoomFactor)));
      
      setZoomLevel(newZoomLevel);
    };
    
    // Add wheel event listener
    canvas.addEventListener('wheel', handleWheel);
    
    // Clean up event listener on unmount
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel]);
  
  // Draw the map whenever mapData, mapConfig, contentTypes, transparencyMask, or zoomLevel change
  useEffect(() => {
    if (!backgroundImageLoaded || !backgroundImageRef.current) return; // Wait for background image to load
    
    // Use the drawMapWithZoom function to redraw the map
    drawMapWithZoom();
  }, [mapData, mapConfig, contentTypes, transparencyMask, backgroundImageLoaded, zoomLevel, canvasDimensions]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Map Visualization Tool</h1>
      </header>
      
      <main className="app-content">
        <div className="input-panel">
          <h2 className="panel-title">Input Panel</h2>
          
          <button
            onClick={generateMap}
            className="generate-button"
            disabled={contentTypes.reduce((sum, type) => sum + type.percentage, 0) !== 100}
          >
            Generate Map
          </button>
          
          <div className="panel-section">
            <h3>Map Configuration</h3>
            
            <div className="form-group">
              <label htmlFor="widthKm">Width (km):</label>
              <input
                type="number"
                id="widthKm"
                name="widthKm"
                min="1"
                max="100"
                value={mapConfig.widthKm}
                onChange={(e) => setMapConfig({...mapConfig, widthKm: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="heightKm">Height (km):</label>
              <input
                type="number"
                id="heightKm"
                name="heightKm"
                min="1"
                max="100"
                value={mapConfig.heightKm}
                onChange={(e) => setMapConfig({...mapConfig, heightKm: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="visualCellSize">Visual Cell Size (px):</label>
              <input
                type="number"
                id="visualCellSize"
                name="visualCellSize"
                min="1"
                max="50"
                value={mapConfig.visualCellSize}
                onChange={(e) => setMapConfig({...mapConfig, visualCellSize: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="showGrid">Show Grid:</label>
              <input
                type="checkbox"
                id="showGrid"
                name="showGrid"
                checked={mapConfig.showGrid}
                onChange={(e) => setMapConfig({...mapConfig, showGrid: e.target.checked})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="gridOpacity">Grid Opacity:</label>
              <input
                type="range"
                id="gridOpacity"
                name="gridOpacity"
                min="0.1"
                max="1.0"
                step="0.1"
                value={mapConfig.gridOpacity}
                onChange={(e) => setMapConfig({...mapConfig, gridOpacity: parseFloat(e.target.value)})}
                className="form-input"
              />
              <span>{mapConfig.gridOpacity.toFixed(1)}</span>
            </div>
          </div>
          
          <div className="panel-section">
            <h3>Content Types</h3>
            
            <div className="content-types-list">
              {contentTypes.map(type => (
                <div key={type.id} className="content-type-item">
                  <div className="content-type-colors">
                    <div className="content-type-color" style={{ backgroundColor: type.color }}>
                      <input
                        type="color"
                        value={type.color}
                        onChange={(e) => {
                          const updatedTypes = contentTypes.map(t => 
                            t.id === type.id ? { ...t, color: e.target.value } : t
                          );
                          setContentTypes(updatedTypes);
                        }}
                        className="color-picker"
                        title="Fill Color"
                      />
                    </div>
                    <div className="content-type-border-color" style={{ backgroundColor: type.borderColor }}>
                      <input
                        type="color"
                        value={type.borderColor}
                        onChange={(e) => {
                          const updatedTypes = contentTypes.map(t => 
                            t.id === type.id ? { ...t, borderColor: e.target.value } : t
                          );
                          setContentTypes(updatedTypes);
                        }}
                        className="color-picker"
                        title="Border Color"
                      />
                    </div>
                  </div>
                  
                  <div className="content-type-details">
                    <input
                      type="text"
                      value={type.name}
                      onChange={(e) => {
                        const updatedTypes = contentTypes.map(t => 
                          t.id === type.id ? { ...t, name: e.target.value } : t
                        );
                        setContentTypes(updatedTypes);
                      }}
                      className="content-type-name"
                      placeholder="Type name"
                    />
                    
                    <div className="content-type-percentage">
                      <input
                        type="number"
                        value={type.percentage}
                        onChange={(e) => {
                          const updatedTypes = contentTypes.map(t => 
                            t.id === type.id ? { ...t, percentage: parseInt(e.target.value, 10) } : t
                          );
                          setContentTypes(updatedTypes);
                        }}
                        min="0"
                        max="100"
                        className="percentage-input"
                      />
                      <span>%</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setContentTypes(contentTypes.filter(t => t.id !== type.id));
                    }}
                    className="remove-button"
                    aria-label="Remove content type"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <div className="total-percentage">
              Total: {contentTypes.reduce((sum, type) => sum + type.percentage, 0)}%
              {contentTypes.reduce((sum, type) => sum + type.percentage, 0) !== 100 && (
                <span className="percentage-warning">
                  (Should be 100%)
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="map-panel">
          <div className="map-panel-header">
            <h2 className="panel-title">Map Visualization</h2>
            
            <button 
              className="export-button"
              onClick={() => {
                const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
                if (canvas) {
                  const link = document.createElement('a');
                  link.download = 'map-visualization.png';
                  link.href = canvas.toDataURL('image/png');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }}
              disabled={mapData.length === 0}
            >
              Export as PNG
            </button>
          </div>
          
          <div className="map-canvas-container" ref={mapContainerRef}>
            <canvas id="map-canvas" className="map-canvas" />
            
            {mapData.length === 0 && (
              <div className="empty-state">
                <p>Generate a map to see the visualization</p>
              </div>
            )}
            
            <div className="zoom-controls">
              <span className="zoom-level">Zoom: {zoomLevel.toFixed(1)}x</span>
              <div className="zoom-buttons">
                <button 
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))}
                  className="zoom-button"
                  disabled={zoomLevel >= 3}
                >
                  +
                </button>
                <button 
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                  className="zoom-button"
                  disabled={zoomLevel <= 0.5}
                >
                  -
                </button>
                <button 
                  onClick={() => setZoomLevel(1)}
                  className="zoom-button"
                >
                  Reset
                </button>
              </div>
              <p className="zoom-hint">Use mouse wheel to zoom in/out</p>
              <div className="cell-representation">
                <span>{getCellRepresentation()}</span>
                <span>Effective cell size: {getEffectiveCellSize().toFixed(1)}px</span>
                <span>Detail level: {getLevelOfDetail()}</span>
              </div>
            </div>
          </div>
          
          {mapData.length > 0 && (
            <div className="map-legend">
              <h3>Legend</h3>
              <div className="legend-items">
                {contentTypes.map(type => (
                  <div key={type.id} className="legend-item">
                    <div 
                      className="legend-color" 
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="legend-name">{type.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="analysis-panel">
          <h2 className="panel-title">Analysis Panel</h2>
          
          {Object.keys(analysisData.contentDistribution).length === 0 ? (
            <div className="empty-analysis">
              <p>Generate a map to see analysis data</p>
            </div>
          ) : (
            <div className="analysis-content">
              <div className="panel-section">
                <h3>Content Distribution</h3>
                <div className="distribution-chart">
                  {contentTypes.map(type => {
                    const percentage = analysisData.contentDistribution[type.id] || 0;
                    const requestedPercentage = type.percentage;
                    
                    // Determine if there's a significant difference
                    const diff = Math.abs(percentage - requestedPercentage);
                    const isSignificantDiff = diff > 10;
                    
                    return (
                      <div key={type.id} className="chart-item">
                        <div className="chart-label">
                          <div 
                            className="chart-color" 
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="chart-name">{type.name}</span>
                        </div>
                        
                        <div className="chart-bars">
                          <div className="chart-bar-container">
                            <div 
                              className="chart-bar actual"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: type.color,
                              }}
                            />
                            <span className="chart-value">{percentage}%</span>
                          </div>
                          
                          <div className="chart-bar-container">
                            <div 
                              className="chart-bar requested"
                              style={{ 
                                width: `${requestedPercentage}%`,
                                backgroundColor: `${type.color}80`, // 50% opacity
                              }}
                            />
                            <span className="chart-value">{requestedPercentage}%</span>
                          </div>
                        </div>
                        
                        {isSignificantDiff && (
                          <div className="chart-diff-warning">
                            Significant difference detected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="panel-section">
                <h3>Warnings</h3>
                {analysisData.warnings.length === 0 ? (
                  <p className="no-warnings">No warnings detected</p>
                ) : (
                  <ul className="warnings-list">
                    {analysisData.warnings.map((warning, index) => (
                      <li key={index} className="warning-item">
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
