import React, { useState } from 'react';

const MapVisualizationTool = () => {
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

  const [selectedContentType, setSelectedContentType] = useState(null);
  const [newContentFormVisible, setNewContentFormVisible] = useState(false);

  // Sample map configuration
  const [mapConfig, setMapConfig] = useState({
    width: 6,
    height: 4,
    hexSize: 10,
    showGrid: true
  });

  // Sample analysis data
  const analysisData = {
    contentCounts: {
      'Biome': 5,
      'Point of Interest': 13,
      'Enemy Encounter': 32,
      'Activity': 36
    },
    density: {
      overall: 0.036, // items per 100m²
      byRegion: {
        'North': 0.042,
        'East': 0.038,
        'South': 0.031,
        'West': 0.035
      }
    },
    travelTimes: {
      average: 65, // seconds
      longest: 180,
      shortest: 15
    },
    warnings: [
      'Low content density detected in south region',
      'High encounter clustering in northeast forest',
      'Some activities (4) couldn\'t be placed due to spacing constraints'
    ]
  };

  const handleMapConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMapConfig({
      ...mapConfig,
      [name]: type === 'checkbox' ? checked : Number(value)
    });
  };

  const handleContentSelect = (content) => {
    setSelectedContentType(content);
    setNewContentFormVisible(false);
  };

  const handleAddNewContent = () => {
    setSelectedContentType(null);
    setNewContentFormVisible(true);
  };

  const renderContentForm = () => {
    const content = selectedContentType || {
      name: '',
      category: 'Enemy Encounter',
      color: '#ff0000',
      shape: 'circle',
      size: 50,
      quantity: 10,
      minSpacing: 100,
      canOverlap: false,
      allowedBiomes: ['forest', 'mountain']
    };

    return (
      <div className="content-form p-4 bg-gray-50 rounded-md">
        <h3 className="text-lg font-medium mb-4">{selectedContentType ? 'Edit Content Type' : 'New Content Type'}</h3>
        
        <div className="space-y-4">
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md" 
              value={content.name}
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={content.category}>
              <option>Biome</option>
              <option>Point of Interest</option>
              <option>Enemy Encounter</option>
              <option>Activity</option>
              <option>Restoration Location</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center">
                <input 
                  type="color" 
                  className="w-10 h-10 border border-gray-300 rounded-md mr-2" 
                  value={content.color}
                />
                <input 
                  type="text" 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md" 
                  value={content.color}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shape</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={content.shape}>
                <option>circle</option>
                <option>square</option>
                <option>hexagon</option>
                <option>irregular</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Size (meters)</label>
              <input 
                type="number" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                value={content.size}
              />
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input 
                type="number" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                value={content.quantity}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Min. Spacing (m)</label>
              <input 
                type="number" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                value={content.minSpacing}
              />
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Can Overlap</label>
              <div className="flex items-center h-10">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded" 
                  checked={content.canOverlap}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Biomes</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" multiple>
              <option>forest</option>
              <option>mountain</option>
              <option>plains</option>
              <option>desert</option>
              <option>swamp</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button 
              onClick={() => {
                setSelectedContentType(null);
                setNewContentFormVisible(false);
              }} 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md"
            >
              Cancel
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {selectedContentType ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Mock canvas implementation - in a real application this would render using Canvas API
  const MapCanvas = () => {
    return (
      <div className="relative w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src="/api/placeholder/800/600" 
            alt="Map visualization" 
            className="max-w-full max-h-full object-contain"
          />
          <div className="absolute inset-0 pointer-events-none">
            {/* This would be the actual canvas rendering in the real app */}
            <svg width="100%" height="100%" className="pointer-events-none">
              <defs>
                <pattern id="hexgrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path 
                    d="M15,0 L30,8.66 L30,21.34 L15,30 L0,21.34 L0,8.66 Z" 
                    fill="none" 
                    stroke="rgba(0,0,0,0.1)" 
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hexgrid)" />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white px-6 py-3">
        <h1 className="text-xl font-bold">Fellowship Map Content Visualization Tool</h1>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Input */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Map Configuration</h2>
            <div className="space-y-3">
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Map Width (km)</label>
                <input 
                  type="number" 
                  name="width"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                  value={mapConfig.width}
                  onChange={handleMapConfigChange}
                />
              </div>
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Map Height (km)</label>
                <input 
                  type="number" 
                  name="height"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                  value={mapConfig.height}
                  onChange={handleMapConfigChange}
                />
              </div>
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Hex Size (m)</label>
                <input 
                  type="number" 
                  name="hexSize"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                  value={mapConfig.hexSize}
                  onChange={handleMapConfigChange}
                />
              </div>
              <div className="form-group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input 
                    type="checkbox" 
                    name="showGrid"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2" 
                    checked={mapConfig.showGrid}
                    onChange={handleMapConfigChange}
                  />
                  Show Grid
                </label>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Content Types</h2>
              <button 
                onClick={handleAddNewContent}
                className="px-2 py-1 bg-blue-600 text-white text-sm rounded-md"
              >
                Add New
              </button>
            </div>

            {newContentFormVisible ? (
              renderContentForm()
            ) : selectedContentType ? (
              renderContentForm()
            ) : (
              <div className="space-y-2">
                {contentTypes.map(content => (
                  <div 
                    key={content.id} 
                    onClick={() => handleContentSelect(content)}
                    className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-2" 
                        style={{ backgroundColor: content.color }}
                      />
                      <div className="font-medium">{content.name}</div>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {content.quantity} items • {content.size}m • {content.shape}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <button className="w-full py-2 bg-blue-600 text-white rounded-md font-medium">
              Generate Map
            </button>
          </div>
        </div>

        {/* Middle Panel - Map Visualization */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Map Visualization</h2>
              <button className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm">
                Export PNG
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MapCanvas />
          </div>
        </div>

        {/* Right Panel - Analysis */}
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Analysis</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-medium mb-2">Content Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(analysisData.contentCounts).map(([category, count]) => (
                    <div key={category} className="flex justify-between">
                      <span>{category}</span>
                      <span className="font-medium">{count} items</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-md font-medium mb-2">Density Analysis</h3>
                <div className="mb-2">
                  <div className="flex justify-between">
                    <span>Overall</span>
                    <span className="font-medium">{analysisData.density.overall.toFixed(3)} items/100m²</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm text-gray-500">By Region</h4>
                  {Object.entries(analysisData.density.byRegion).map(([region, density]) => (
                    <div key={region} className="flex justify-between text-sm">
                      <span>{region}</span>
                      <span>{density.toFixed(3)} items/100m²</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-md font-medium mb-2">Travel Times</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average</span>
                    <span className="font-medium">{analysisData.travelTimes.average}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Longest Gap</span>
                    <span>{analysisData.travelTimes.longest}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shortest Gap</span>
                    <span>{analysisData.travelTimes.shortest}s</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-md font-medium mb-2">Warnings</h3>
                <div className="space-y-2">
                  {analysisData.warnings.map((warning, index) => (
                    <div key={index} className="p-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapVisualizationTool;
