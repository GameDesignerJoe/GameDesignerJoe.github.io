import { useState } from 'react';
import './App.css';

// Import panels
import InputPanel from './components/InputPanel/InputPanel';
import MapPanel from './components/MapPanel/MapPanel';
import AnalysisPanel from './components/AnalysisPanel/AnalysisPanel';

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Map Visualization Tool</h1>
      </header>
      
      <main className="app-content">
        <InputPanel 
          mapConfig={mapConfig} 
          setMapConfig={setMapConfig}
          contentTypes={contentTypes}
          setContentTypes={setContentTypes}
          onGenerate={generateMap}
        />
        
        <MapPanel 
          mapConfig={mapConfig}
          contentTypes={contentTypes}
          mapData={mapData}
        />
        
        <AnalysisPanel 
          analysisData={analysisData}
          contentTypes={contentTypes}
        />
      </main>
    </div>
  );
}

export default App;
