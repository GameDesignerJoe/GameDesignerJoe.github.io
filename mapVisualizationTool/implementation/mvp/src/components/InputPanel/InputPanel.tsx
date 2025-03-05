import { useState } from 'react';
import { ContentType } from '../../App';
import './InputPanel.css';

interface MapConfig {
  width: number;
  height: number;
  hexSize: number;
}

interface InputPanelProps {
  mapConfig: MapConfig;
  setMapConfig: (config: MapConfig) => void;
  contentTypes: ContentType[];
  setContentTypes: (types: ContentType[]) => void;
  onGenerate: () => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  mapConfig,
  setMapConfig,
  contentTypes,
  setContentTypes,
  onGenerate,
}) => {
  const [newContentType, setNewContentType] = useState<Omit<ContentType, 'id'>>({
    name: '',
    color: '#3b82f6',
    percentage: 0,
  });

  // Handle map config changes
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMapConfig({
      ...mapConfig,
      [name]: parseInt(value, 10),
    });
  };

  // Handle content type percentage changes
  const handlePercentageChange = (id: string, value: number) => {
    const updatedTypes = contentTypes.map(type => 
      type.id === id ? { ...type, percentage: value } : type
    );
    setContentTypes(updatedTypes);
  };

  // Handle content type color changes
  const handleColorChange = (id: string, color: string) => {
    const updatedTypes = contentTypes.map(type => 
      type.id === id ? { ...type, color } : type
    );
    setContentTypes(updatedTypes);
  };

  // Handle content type name changes
  const handleNameChange = (id: string, name: string) => {
    const updatedTypes = contentTypes.map(type => 
      type.id === id ? { ...type, name } : type
    );
    setContentTypes(updatedTypes);
  };

  // Handle adding a new content type
  const handleAddContentType = () => {
    if (newContentType.name.trim() === '') return;
    
    const newId = (contentTypes.length + 1).toString();
    setContentTypes([
      ...contentTypes,
      {
        id: newId,
        name: newContentType.name,
        color: newContentType.color,
        percentage: newContentType.percentage,
      },
    ]);
    
    // Reset the form
    setNewContentType({
      name: '',
      color: '#3b82f6',
      percentage: 0,
    });
  };

  // Handle removing a content type
  const handleRemoveContentType = (id: string) => {
    setContentTypes(contentTypes.filter(type => type.id !== id));
  };

  // Calculate total percentage
  const totalPercentage = contentTypes.reduce((sum, type) => sum + type.percentage, 0);

  return (
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
            onChange={handleConfigChange}
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
            onChange={handleConfigChange}
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="hexSize">Hex Size:</label>
          <input
            type="number"
            id="hexSize"
            name="hexSize"
            min="10"
            max="100"
            value={mapConfig.hexSize}
            onChange={handleConfigChange}
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
                  onChange={(e) => handleColorChange(type.id, e.target.value)}
                  className="color-picker"
                />
              </div>
              
              <div className="content-type-details">
                <input
                  type="text"
                  value={type.name}
                  onChange={(e) => handleNameChange(type.id, e.target.value)}
                  className="content-type-name"
                  placeholder="Type name"
                />
                
                <div className="content-type-percentage">
                  <input
                    type="number"
                    value={type.percentage}
                    onChange={(e) => handlePercentageChange(type.id, parseInt(e.target.value, 10))}
                    min="0"
                    max="100"
                    className="percentage-input"
                  />
                  <span>%</span>
                </div>
              </div>
              
              <button
                onClick={() => handleRemoveContentType(type.id)}
                className="remove-button"
                aria-label="Remove content type"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        <div className="total-percentage">
          Total: {totalPercentage}%
          {totalPercentage !== 100 && (
            <span className="percentage-warning">
              (Should be 100%)
            </span>
          )}
        </div>
        
        <div className="add-content-type">
          <div className="content-type-color" style={{ backgroundColor: newContentType.color }}>
            <input
              type="color"
              value={newContentType.color}
              onChange={(e) => setNewContentType({ ...newContentType, color: e.target.value })}
              className="color-picker"
            />
          </div>
          
          <div className="content-type-details">
            <input
              type="text"
              value={newContentType.name}
              onChange={(e) => setNewContentType({ ...newContentType, name: e.target.value })}
              className="content-type-name"
              placeholder="New type name"
            />
            
            <div className="content-type-percentage">
              <input
                type="number"
                value={newContentType.percentage}
                onChange={(e) => setNewContentType({ ...newContentType, percentage: parseInt(e.target.value, 10) })}
                min="0"
                max="100"
                className="percentage-input"
              />
              <span>%</span>
            </div>
          </div>
          
          <button
            onClick={handleAddContentType}
            className="add-button"
            disabled={newContentType.name.trim() === ''}
          >
            +
          </button>
        </div>
      </div>
      
      <button
        onClick={onGenerate}
        className="generate-button"
        disabled={totalPercentage !== 100}
      >
        Generate Map
      </button>
    </div>
  );
};

export default InputPanel;
