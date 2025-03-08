import React, { useState, useRef, useCallback } from 'react';

const MapVisualizationTool = () => {
  // Canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // Sample content types
  const [contentTypes, setContentTypes] = useState([
    { id: 'biome-forest', name: 'Forest Biome', category: 'Biome', color: '#2d6a4f', shape: 'irregular', size: 2000, quantity: 3 },
    { id: 'biome-mountain', name: 'Mountain Range', category: 'Biome', color: '#6c757d', shape: 'irregular', size: 1500, quantity: 2 },
    { id: 'poi-village', name: 'Village', category: 'Point of Interest', color: '#e63946', shape: 'circle', size: 100, quantity: 8 },
    { id: 'poi-ruins', name: 'Ancient Ruins', category: 'Point of Interest', color: '#457b9d', shape: 'square', size: 150, quantity: 5 },
    { id: 'encounter-bandits', name: 'Bandit Camp', category: 'Enemy Encounter', color: '#d62828', shape: 'circle', size: 50, quantity: 12 },
    { id: 'encounter-wildlife', name: 'Wildlife Pack', category: 'Enemy Encounter', color: '#bc6c25', shape: 'circle', size: 30, quantity: 20 },
    { id: 'activity-resource', name: 'Resource Node', category: 'Activity', color: '#ffb703', shape: 'hexagon', size: 25, quantity: 30 },
    { id: 'activity-puzzle', name: 'Ancient Puzzle', category: 'Activity', color: '#8338ec', shape: 'hexagon', size: 40, quantity: 6 },
  ]);

  // State for map configuration
  const [mapConfig, setMapConfig] = useState({
    widthKm: 6,  // Width in kilometers
    heightKm: 4, // Height in kilometers
    targetAreaKm2: 24, // Target area in square kilometers
    actualAreaKm2: 24, // Actual achieved area after grid calculation
    showGrid: true,
    gridOpacity: 0.7,
    gridColor: '#666666',
    visualCellSize: 10, // Visual size of each cell in pixels
  });

  // State for zoom and pan
  const [zoomLevel, setZoomLevel] = useState<number>(0.5);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // State for transparency mask and cache
  const [transparencyMask, setTransparencyMask] = useState<boolean[][]>([]);
  const [maskCache] = useState<Map<string, boolean[][]>>(new Map());

  // State for content form
  const [selectedContentType, setSelectedContentType] = useState(null);
  const [newContentFormVisible, setNewContentFormVisible] = useState(false);

  // Get current detail level based on zoom
  const getCurrentDetailLevel = useCallback(() => {
    const DETAIL_LEVELS = [
      { id: 'L0', minZoom: 0.0, maxZoom: 1.0, metersPerCell: 400, displayName: '0 (400m)' },
      { id: 'L1', minZoom: 1.0, maxZoom: 2.0, metersPerCell: 200, displayName: '1 (200m)' },
      { id: 'L2', minZoom: 2.0, maxZoom: 4.0, metersPerCell: 100, displayName: '2 (100m)' },
      { id: 'L3', minZoom: 4.0, maxZoom: 6.0, metersPerCell: 50, displayName: '3 (50m)' },
      { id: 'L4', minZoom: 6.0, maxZoom: Infinity, metersPerCell: 10, displayName: '4 (10m)' },
    ];
    
    const matchingLevel = DETAIL_LEVELS.find(
      level => zoomLevel >= level.minZoom && zoomLevel < level.maxZoom
    );
    return matchingLevel || DETAIL_LEVELS[0];
  }, [zoomLevel]);

  // Handle map configuration changes
  const handleMapConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMapConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };

  // Handle content selection
  const handleContentSelect = (content) => {
    setSelectedContentType(content);
    setNewContentFormVisible(false);
  };

  // Handle adding new content
  const handleAddNewContent = () => {
    setSelectedContentType(null);
    setNewContentFormVisible(true);
  };

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!backgroundImageRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0];
    const currentIndex = ZOOM_LEVELS.indexOf(Math.min(...ZOOM_LEVELS.filter(z => z >= zoomLevel)));
    const delta = Math.sign(-event.deltaY);
    const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, currentIndex + delta));
    const newZoom = ZOOM_LEVELS[nextIndex];
    
    if (newZoom !== zoomLevel) {
      setZoomLevel(newZoom);
      // Pan offset calculation would be here
    }
  }, [zoomLevel]);

  // Handle mouse events for panning
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!backgroundImageRef.current) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setLastMousePos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    setIsPanning(true);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !backgroundImageRef.current) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setPanOffset(prev => ({
      x: prev.x + (x - lastMousePos.x),
      y: prev.y + (y - lastMousePos.y)
    }));
    
    setLastMousePos({ x, y });
  }, [isPanning, lastMousePos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Render content form
  const renderContentForm = () => {
    // Form rendering code remains the same
  };

  // Canvas component with normalized coordinate system
  const MapCanvas = () => {
    return (
      <div 
        className="relative w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ 
            cursor: isPanning ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
        />
      </div>
    );
  };

  // Rest of the component remains the same
  return (
    <div className="h-screen flex flex-col">
      {/* Component JSX remains the same */}
    </div>
  );
};

export default MapVisualizationTool;
