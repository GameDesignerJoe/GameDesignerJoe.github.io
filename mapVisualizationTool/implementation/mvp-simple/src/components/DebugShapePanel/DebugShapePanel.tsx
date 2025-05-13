import React, { useState } from 'react';
import { ContentShape, ContentTypeId, contentTypeDefaults } from '../../types/ContentTypes';
import { ContentInstanceManager } from '../../utils/ContentInstanceManager';

interface DebugShapePanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  id: string; // Unique identifier for this panel
  title: string; // Panel title
  name: string; // User-defined name for the panel
  onNameChange: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  numShapesInput: string;
  setNumShapesInput: (value: string) => void;
  shapeSizeMeters: string;
  setShapeSizeMeters: (value: string) => void;
  shapeOpacity: number;
  setShapeOpacity: (value: number) => void;
  showShapeDebug: boolean;
  setShowShapeDebug: (value: boolean) => void;
  shapeColor: string;
  setShapeColor: (value: string) => void;
  shapeBorderSize: number;
  setShapeBorderSize: (value: number) => void;
  shapeBorderColor: string;
  setShapeBorderColor: (value: string) => void;
  shapeType: ContentShape;
  setShapeType: (value: ContentShape) => void;
  shapeLabel: string;
  setShapeLabel: (value: string) => void;
  showShapeLabel: boolean;
  setShowShapeLabel: (value: boolean) => void;
  minDistance: string;
  setMinDistance: (value: string) => void;
  showMinDistanceRing: boolean;
  setShowMinDistanceRing: (value: boolean) => void;
  distributionMessage: string | null;
  selectedContentType: ContentTypeId;
  setSelectedContentType: (value: ContentTypeId) => void;
  contentInstanceManager: ContentInstanceManager;
  setInstanceCount: (value: number) => void;
  handleAddShapes: () => void;
  handleDeleteShapes: () => void;
  resetIcon: string;
  duplicateIcon: string;
  trashIcon: string;
}

const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'oval', label: 'Oval' },
  { value: 'horizontalDiamond', label: 'Horizontal Diamond' }
] as const;

export const DebugShapePanel: React.FC<DebugShapePanelProps> = ({
  id,
  title,
  isCollapsed = false,
  onToggleCollapse,
  isVisible = true,
  onToggleVisibility,
  numShapesInput,
  setNumShapesInput,
  shapeSizeMeters,
  setShapeSizeMeters,
  shapeOpacity,
  setShapeOpacity,
  showShapeDebug,
  setShowShapeDebug,
  shapeColor,
  setShapeColor,
  shapeBorderSize,
  setShapeBorderSize,
  shapeBorderColor,
  setShapeBorderColor,
  shapeType,
  setShapeType,
  shapeLabel,
  setShapeLabel,
  showShapeLabel,
  setShowShapeLabel,
  minDistance,
  setMinDistance,
  showMinDistanceRing,
  setShowMinDistanceRing,
  distributionMessage,
  selectedContentType,
  setSelectedContentType,
  contentInstanceManager,
  setInstanceCount,
  handleAddShapes,
  handleDeleteShapes,
  resetIcon,
  duplicateIcon,
  trashIcon,
  name,
  onNameChange,
  onDuplicate,
  onDelete
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#2a2a2a',
      overflow: 'visible'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #3a3a3a',
          cursor: 'pointer'
        }}
        onClick={onToggleCollapse}
      >
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <h3 style={{ 
            margin: 0,
            fontSize: '14px',
            fontWeight: 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ 
              display: 'inline-block',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}>
              ▼
            </span>
          {name || title}
          </h3>
        </div>
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Update all shapes' visibility properties when toggling visibility
            const shapes = contentInstanceManager.getInstances(id);
            const newIsVisible = !isVisible;
            shapes.forEach(shape => {
              const updatedInstance = {
                ...shape,
                properties: {
                  ...shape.properties,
                  opacity: newIsVisible ? shapeOpacity : 0,
                  showMinDistanceRing: newIsVisible ? showMinDistanceRing : false,
                  showLabel: newIsVisible ? showShapeLabel : false,
                  showDebug: newIsVisible ? showShapeDebug : false
                }
              };
              contentInstanceManager.removeInstance(id, shape.id);
              contentInstanceManager.addInstance(id, updatedInstance);
            });
            onToggleVisibility?.();
          }}
        >
          <img 
            src={`/mapVisualizationTool/assets/icon_visibility_${isVisible ? 'on' : 'off'}.png`}
            alt={isVisible ? 'Visible' : 'Hidden'}
            style={{ 
              width: '20px',
              height: '20px',
              opacity: isVisible ? 1 : 0.5
            }}
          />
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          padding: '10px',
          backgroundColor: '#2a2a2a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Content Name:</span>
            <input
              type="text"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              style={{ 
                flex: 1,
                backgroundColor: 'rgb(59, 59, 59)',
                border: '1px solid rgb(118, 118, 118)',
                color: '#ffffff',
                padding: '1px 4px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Count:</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={numShapesInput}
              onChange={e => setNumShapesInput(e.target.value)}
              style={{ width: '60px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Content Type:</span>
            <select
              value={selectedContentType}
              onChange={e => setSelectedContentType(e.target.value as ContentTypeId)}
              style={{ 
                width: '150px',
                border: '1px solid rgb(118, 118, 118)',
                backgroundColor: 'rgb(59, 59, 59)',
                color: '#ffffff',
                padding: '1px'
              }}
            >
              {Object.keys(contentTypeDefaults).map(type => (
                <option key={type} value={type}>
                  {type.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Shape:</span>
            <select
              value={shapeType}
              onChange={e => {
                const newShape = e.target.value as ContentShape;
                setShapeType(newShape);
                // Update existing dots' shape property without regenerating them
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      shape: newShape
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      sizeMeters: parseFloat(newSize)
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      opacity: newOpacity
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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
                const input = e.target as HTMLInputElement;
                const newColor = input.value;
                setShapeColor(newColor);
                // Update existing shapes' color property without regenerating them
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      color: newColor
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      borderSize: newSize
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
                });
                setInstanceCount(shapes.length); // Maintain count
              }}
              style={{ width: '60px' }}
            />
            <input
              type="color"
              value={shapeBorderColor}
              onChange={e => {
                const input = e.target as HTMLInputElement;
                const newColor = input.value;
                setShapeBorderColor(newColor);
                // Update existing shapes' border color without regenerating them
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      borderColor: newColor
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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
                const shapes = contentInstanceManager.getInstances(id);
                shapes.forEach(shape => {
                  const updatedInstance = {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      label: newLabel
                    }
                  };
                  contentInstanceManager.removeInstance(id, shape.id);
                  contentInstanceManager.addInstance(id, updatedInstance);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Min Distance (m):</span>
            <input
              type="number"
              min="0"
              max="1000"
              value={minDistance}
              onChange={e => {
                const newValue = e.target.value;
                setMinDistance(newValue);
                // Only regenerate shapes if there are already shapes on the map
                const existingShapes = contentInstanceManager.getInstances(id);
                if (existingShapes.length > 0) {
                  handleAddShapes(); // Regenerate shapes with new min distance
                }
              }}
              style={{ width: '60px' }}
            />
            {distributionMessage && (
              <span style={{ 
                marginLeft: '10px',
                fontSize: '12px',
                color: '#ff9999'
              }}>
                {distributionMessage}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={showMinDistanceRing}
                onChange={e => {
                  const newShowRing = e.target.checked;
                  setShowMinDistanceRing(newShowRing);
                  // Update existing shapes' min distance ring property
                  const shapes = contentInstanceManager.getInstances(id);
                  shapes.forEach(shape => {
                    const updatedInstance = {
                      ...shape,
                      properties: {
                        ...shape.properties,
                        showMinDistanceRing: newShowRing && isVisible,
                        minDistanceMeters: parseFloat(minDistance),
                        minDistanceRingColor: '#ffffff',
                        minDistanceRingStyle: 'dashed'
                      }
                    };
                    contentInstanceManager.removeInstance(id, shape.id);
                    contentInstanceManager.addInstance(id, updatedInstance);
                  });
                  setInstanceCount(shapes.length);
                }}
              />
              Show Min Distance
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={showShapeLabel}
                onChange={e => {
                  const newShowLabel = e.target.checked;
                  setShowShapeLabel(newShowLabel);
                  // Update existing shapes' showLabel property without regenerating them
                  const shapes = contentInstanceManager.getInstances(id);
                  shapes.forEach(shape => {
                    const updatedInstance = {
                      ...shape,
                      properties: {
                        ...shape.properties,
                        showLabel: newShowLabel && isVisible
                      }
                    };
                    contentInstanceManager.removeInstance(id, shape.id);
                    contentInstanceManager.addInstance(id, updatedInstance);
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
                  const shapes = contentInstanceManager.getInstances(id);
                  shapes.forEach(shape => {
                    const updatedInstance = {
                      ...shape,
                      properties: {
                        ...shape.properties,
                        showDebug: newShowDebug && isVisible
                      }
                    };
                    contentInstanceManager.removeInstance(id, shape.id);
                    contentInstanceManager.addInstance(id, updatedInstance);
                  });
                  setInstanceCount(shapes.length); // Maintain count
                }}
              />
              Show Debug Text
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={() => {
                  const size = parseFloat(shapeSizeMeters);
                  const spacing = parseFloat(minDistance);
                  if (!isNaN(size) && !isNaN(spacing)) {
                    handleAddShapes();
                  }
                }}
                style={{ flex: 1 }}
              >
                Map Content
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
                  transition: 'transform 0.2s ease, filter 0.2s ease'
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
                  src={resetIcon} 
                  alt="Reset content"
                  style={{ 
                    width: '20px',
                    height: '20px'
                  }}
                />
              </button>
            </div>

            <button
              onClick={onDuplicate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <img 
                src={duplicateIcon} 
                alt="Duplicate content"
                style={{ 
                  width: '20px',
                  height: '20px'
                }}
              />
              Duplicate Content
            </button>

            <button
              onClick={onDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: '#661a1a',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <img 
                src={trashIcon} 
                alt="Delete content"
                style={{ 
                  width: '20px',
                  height: '20px'
                }}
              />
              Delete Content
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
