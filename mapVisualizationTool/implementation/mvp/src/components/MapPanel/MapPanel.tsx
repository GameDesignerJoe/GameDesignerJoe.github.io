import { useEffect, useRef } from 'react';
import { ContentType } from '../../App';
import './MapPanel.css';

interface MapConfig {
  width: number;
  height: number;
  hexSize: number;
}

interface MapPanelProps {
  mapConfig: MapConfig;
  contentTypes: ContentType[];
  mapData: string[][];
}

const MapPanel: React.FC<MapPanelProps> = ({
  mapConfig,
  contentTypes,
  mapData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Function to draw a hexagon
  const drawHexagon = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    strokeColor: string = '#ffffff',
  ) => {
    const hexHeight = size * Math.sqrt(3);
    
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();
    
    // Fill
    ctx.fillStyle = color;
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  
  // Function to get hex coordinates
  const getHexCoordinates = (col: number, row: number, size: number) => {
    const hexHeight = size * Math.sqrt(3);
    const hexWidth = size * 2;
    
    // Offset every other row
    const xOffset = row % 2 === 0 ? 0 : size * 1.5;
    
    const x = col * hexWidth * 0.75 + size + xOffset;
    const y = row * hexHeight * 0.5 + size;
    
    return { x, y };
  };
  
  // Function to export the map as a PNG image
  const exportMapAsPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.download = 'map-visualization.png';
    link.href = canvas.toDataURL('image/png');
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Draw the map whenever mapData, mapConfig, or contentTypes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate canvas dimensions based on map size and hex size
    const hexHeight = mapConfig.hexSize * Math.sqrt(3);
    const hexWidth = mapConfig.hexSize * 2;
    
    const canvasWidth = mapConfig.width * hexWidth * 0.75 + mapConfig.hexSize * 2;
    const canvasHeight = mapConfig.height * hexHeight * 0.5 + hexHeight;
    
    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw hexagonal grid
    if (mapData.length > 0) {
      // Draw filled hexagons based on mapData
      for (let row = 0; row < mapData.length; row++) {
        for (let col = 0; col < mapData[row].length; col++) {
          const contentTypeId = mapData[row][col];
          const contentType = contentTypes.find(type => type.id === contentTypeId);
          
          if (contentType) {
            const { x, y } = getHexCoordinates(col, row, mapConfig.hexSize);
            drawHexagon(ctx, x, y, mapConfig.hexSize, contentType.color);
          }
        }
      }
    } else {
      // Draw empty grid if no data
      for (let row = 0; row < mapConfig.height; row++) {
        for (let col = 0; col < mapConfig.width; col++) {
          const { x, y } = getHexCoordinates(col, row, mapConfig.hexSize);
          drawHexagon(ctx, x, y, mapConfig.hexSize, '#e2e8f0', '#cbd5e1');
        }
      }
    }
  }, [mapData, mapConfig, contentTypes]);
  
  return (
    <div className="map-panel">
      <div className="map-panel-header">
        <h2 className="panel-title">Map Visualization</h2>
        
        <button 
          className="export-button"
          onClick={exportMapAsPng}
          disabled={mapData.length === 0}
        >
          Export as PNG
        </button>
      </div>
      
      <div className="map-canvas-container">
        <canvas ref={canvasRef} className="map-canvas" />
        
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
  );
};

export default MapPanel;
