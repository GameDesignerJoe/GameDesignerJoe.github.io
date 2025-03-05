import { useState, useEffect, useRef } from 'react';
import './App.css';

// Define types for map configuration
interface MapConfig {
  width: number;
  height: number;
  hexSize: number;
}

// Define types for content types
export interface ContentType {
  id: string;
  name: string;
  color: string;
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
  // State for map configuration
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    width: 20,
    height: 15,
    hexSize: 30,
  });

  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentType[]>([
    { id: '1', name: 'Forest', color: '#2d6a4f', percentage: 40 },
    { id: '2', name: 'Mountains', color: '#6c757d', percentage: 20 },
    { id: '3', name: 'Water', color: '#0077b6', percentage: 30 },
    { id: '4', name: 'Desert', color: '#e9c46a', percentage: 10 },
  ]);

  // State for map data (will be generated)
  const [mapData, setMapData] = useState<string[][]>([]);

  // State for analysis data
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    contentDistribution: {},
    densityMap: {},
    warnings: [],
  });

  // Function to generate map data
  const generateMap = () => {
    // This is a placeholder for the actual map generation algorithm
    // In the full implementation, this would use the content distribution algorithm
    const newMapData: string[][] = [];
    
    for (let y = 0; y < mapConfig.height; y++) {
      const row: string[] = [];
      for (let x = 0; x < mapConfig.width; x++) {
        // Simple random distribution for now
        const randomIndex = Math.floor(Math.random() * contentTypes.length);
        row.push(contentTypes[randomIndex].id);
      }
      newMapData.push(row);
    }
    
    setMapData(newMapData);
    
    // Generate analysis data
    analyzeMap(newMapData);
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
    const totalCells = mapConfig.width * mapConfig.height;
    Object.keys(distribution).forEach(key => {
      distribution[key] = Math.round((distribution[key] / totalCells) * 100);
    });
    
    // Generate simple density map (placeholder)
    const densityMap: {[key: string]: number[][]} = {};
    contentTypes.forEach(type => {
      densityMap[type.id] = Array(mapConfig.height).fill(0).map(() => 
        Array(mapConfig.width).fill(0)
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
    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
    
    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  };
  
  // Function to get square coordinates
  const getSquareCoordinates = (col: number, row: number, size: number) => {
    const x = col * (size + 2); // Add 2px gap between squares
    const y = row * (size + 2); // Add 2px gap between squares
    
    return { x, y };
  };

  // Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw the map whenever mapData, mapConfig, or contentTypes change
  useEffect(() => {
    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate canvas dimensions based on square size
    const squareSize = mapConfig.hexSize; // Reuse the hexSize parameter
    
    const canvasWidth = mapConfig.width * (squareSize + 2) + 10; // Add padding
    const canvasHeight = mapConfig.height * (squareSize + 2) + 10; // Add padding
    
    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw square grid
    if (mapData.length > 0) {
      // Draw filled squares based on mapData
      for (let row = 0; row < mapData.length; row++) {
        for (let col = 0; col < mapData[row].length; col++) {
          const contentTypeId = mapData[row][col];
          const contentType = contentTypes.find(type => type.id === contentTypeId);
          
          if (contentType) {
            const { x, y } = getSquareCoordinates(col, row, mapConfig.hexSize);
            drawSquare(ctx, x, y, mapConfig.hexSize, contentType.color);
          }
        }
      }
    } else {
      // Draw empty grid if no data
      for (let row = 0; row < mapConfig.height; row++) {
        for (let col = 0; col < mapConfig.width; col++) {
          const { x, y } = getSquareCoordinates(col, row, mapConfig.hexSize);
          drawSquare(ctx, x, y, mapConfig.hexSize, '#e2e8f0', '#cbd5e1');
        }
      }
    }
  }, [mapData, mapConfig, contentTypes]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Map Visualization Tool</h1>
      </header>
      
      <main className="app-content">
        <div className="input-panel">
          <h2 className="panel-title">Input Panel</h2>
          
          <div className="panel-section">
            <h3>Map Configuration</h3>
            
            <div className="form-group">
              <label htmlFor="width">Width:</label>
              <input
                type="number"
                id="width"
                name="width"
                min="5"
                max="50"
                value={mapConfig.width}
                onChange={(e) => setMapConfig({...mapConfig, width: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="height">Height:</label>
              <input
                type="number"
                id="height"
                name="height"
                min="5"
                max="50"
                value={mapConfig.height}
                onChange={(e) => setMapConfig({...mapConfig, height: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="hexSize">Square Size:</label>
              <input
                type="number"
                id="hexSize"
                name="hexSize"
                min="10"
                max="100"
                value={mapConfig.hexSize}
                onChange={(e) => setMapConfig({...mapConfig, hexSize: parseInt(e.target.value, 10)})}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="panel-section">
            <h3>Content Types</h3>
            
            <div className="content-types-list">
              {contentTypes.map(type => (
                <div key={type.id} className="content-type-item">
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
                    />
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
          
          <button
            onClick={generateMap}
            className="generate-button"
            disabled={contentTypes.reduce((sum, type) => sum + type.percentage, 0) !== 100}
          >
            Generate Map
          </button>
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
          
          <div className="map-canvas-container">
            <canvas id="map-canvas" className="map-canvas" />
            
            {mapData.length === 0 && (
              <div className="empty-state">
                <p>Generate a map to see the visualization</p>
              </div>
            )}
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
