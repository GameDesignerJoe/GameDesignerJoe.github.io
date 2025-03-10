import React, { useState, useEffect } from 'react';
import { ContentShape, ContentTypeId, contentTypeDefaults, ContentTypeBase } from '../../types/ContentTypes';
import { ContentInstanceManager } from '../../utils/ContentInstanceManager';
import { DebugShapePanel } from '../DebugShapePanel/DebugShapePanel';
import { DistributorFactory } from '../../utils/DistributorFactory';

interface DebugShapeControlsProps {
  contentInstanceManager: ContentInstanceManager;
  setInstanceCount: (value: number) => void;
  deleteIcon: string;
  backgroundImageRef: React.RefObject<HTMLImageElement>;
  mapConfig: {
    widthKm: number;
    heightKm: number;
  };
}

// Debug Shape content type definitions
const DEBUG_SHAPE_TYPE_1: ContentTypeBase = {
  id: 'debug-shape-1',
  name: 'Debug Shape 1',
  category: 'Debug',
  description: 'Debug visualization marker',
  color: '#0000FF',
  shape: 'circle',
  size: 10,
  quantity: 100,
  minSpacing: 0,
  canOverlap: true,
  opacity: 1.0
};

const DEBUG_SHAPE_TYPE_2: ContentTypeBase = {
  id: 'debug-shape-2',
  name: 'Debug Shape 2',
  category: 'Debug',
  description: 'Debug visualization marker',
  color: '#FF00FF',
  shape: 'circle',
  size: 10,
  quantity: 100,
  minSpacing: 0,
  canOverlap: true,
  opacity: 1.0
};

export const DebugShapeControls: React.FC<DebugShapeControlsProps> = ({
  contentInstanceManager,
  setInstanceCount,
  deleteIcon,
  backgroundImageRef,
  mapConfig
}) => {
  interface PanelState {
    id: string;
    name: string;
    isCollapsed: boolean;
    isVisible: boolean;
    opacityMap: Map<string, number>;
    numShapesInput: string;
    shapeSizeMeters: string;
    shapeOpacity: number;
    showShapeDebug: boolean;
    shapeColor: string;
    shapeBorderSize: number;
    shapeBorderColor: string;
    shapeType: ContentShape;
    shapeLabel: string;
    showShapeLabel: boolean;
    minDistance: string;
    showMinDistanceRing: boolean;
    distributionMessage: string | null;
    selectedContentType: ContentTypeId;
  }

  // Initialize panels state with two default panels
  const [panels, setPanels] = useState<PanelState[]>(() => [
    {
      id: 'debug-shape-1',
      name: 'Debug Shapes 1',
      isCollapsed: false,
      isVisible: true,
      opacityMap: new Map(),
      numShapesInput: contentTypeDefaults.Debug1.defaultQuantity?.toString() ?? "100",
      shapeSizeMeters: contentTypeDefaults.Debug1.size?.toString() ?? "10",
      shapeOpacity: contentTypeDefaults.Debug1.opacity ?? 1.0,
      showShapeDebug: false,
      shapeColor: contentTypeDefaults.Debug1.color ?? '#0000FF',
      shapeBorderSize: contentTypeDefaults.Debug1.borderSize ?? 0,
      shapeBorderColor: contentTypeDefaults.Debug1.borderColor ?? '#000000',
      shapeType: contentTypeDefaults.Debug1.shape ?? 'circle',
      shapeLabel: contentTypeDefaults.Debug1.label ?? '',
      showShapeLabel: contentTypeDefaults.Debug1.showLabel ?? false,
      minDistance: contentTypeDefaults.Debug1.minSpacing?.toString() ?? "0",
      showMinDistanceRing: false,
      distributionMessage: null,
      selectedContentType: 'Debug1'
    },
    {
      id: 'debug-shape-2',
      name: 'Debug Shapes 2',
      isCollapsed: false,
      isVisible: true,
      opacityMap: new Map(),
      numShapesInput: contentTypeDefaults.Debug2.defaultQuantity?.toString() ?? "100",
      shapeSizeMeters: contentTypeDefaults.Debug2.size?.toString() ?? "10",
      shapeOpacity: contentTypeDefaults.Debug2.opacity ?? 1.0,
      showShapeDebug: false,
      shapeColor: contentTypeDefaults.Debug2.color ?? '#FF00FF',
      shapeBorderSize: contentTypeDefaults.Debug2.borderSize ?? 0,
      shapeBorderColor: contentTypeDefaults.Debug2.borderColor ?? '#000000',
      shapeType: contentTypeDefaults.Debug2.shape ?? 'circle',
      shapeLabel: contentTypeDefaults.Debug2.label ?? '',
      showShapeLabel: contentTypeDefaults.Debug2.showLabel ?? false,
      minDistance: contentTypeDefaults.Debug2.minSpacing?.toString() ?? "0",
      showMinDistanceRing: false,
      distributionMessage: null,
      selectedContentType: 'Debug2'
    }
  ]);

  // Helper function to update a panel's state
  const updatePanel = (panelId: string, updates: Partial<PanelState>) => {
    setPanels(currentPanels => 
      currentPanels.map(panel => 
        panel.id === panelId ? { ...panel, ...updates } : panel
      )
    );
  };

  // Helper function to create a new panel
  const createNewPanel = () => {
    const newPanelId = `debug-shape-${Date.now()}`;
    const newPanel: PanelState = {
      id: newPanelId,
      name: `New Shape ${panels.length + 1}`,
      isCollapsed: false,
      isVisible: true,
      opacityMap: new Map(),
      numShapesInput: contentTypeDefaults.Debug1.defaultQuantity?.toString() ?? "100",
      shapeSizeMeters: contentTypeDefaults.Debug1.size?.toString() ?? "10",
      shapeOpacity: contentTypeDefaults.Debug1.opacity ?? 1.0,
      showShapeDebug: false,
      shapeColor: contentTypeDefaults.Debug1.color ?? '#0000FF',
      shapeBorderSize: contentTypeDefaults.Debug1.borderSize ?? 0,
      shapeBorderColor: contentTypeDefaults.Debug1.borderColor ?? '#000000',
      shapeType: contentTypeDefaults.Debug1.shape ?? 'circle',
      shapeLabel: contentTypeDefaults.Debug1.label ?? '',
      showShapeLabel: contentTypeDefaults.Debug1.showLabel ?? false,
      minDistance: contentTypeDefaults.Debug1.minSpacing?.toString() ?? "0",
      showMinDistanceRing: false,
      distributionMessage: null,
      selectedContentType: 'Debug1'
    };
    setPanels(currentPanels => [...currentPanels, newPanel]);
  };

  // Helper function to duplicate a panel
  const duplicatePanel = (panelId: string) => {
    const panelToDuplicate = panels.find(p => p.id === panelId);
    if (!panelToDuplicate) return;

    const newPanelId = `debug-shape-${Date.now()}`;
    const newPanel: PanelState = {
      ...panelToDuplicate,
      id: newPanelId,
      name: `${panelToDuplicate.name} (Copy)`,
      opacityMap: new Map()
    };
    setPanels(currentPanels => [...currentPanels, newPanel]);
  };

  // Helper function to delete a panel
  const deletePanel = (panelId: string) => {
    // Remove all shapes associated with this panel
    contentInstanceManager.getInstances(panelId).forEach(instance => {
      contentInstanceManager.removeInstance(panelId, instance.id);
    });

    // Remove the panel from state
    setPanels(currentPanels => currentPanels.filter(panel => panel.id !== panelId));

    // Update total instance count
    const totalCount = panels.reduce((count, panel) => 
      count + contentInstanceManager.getInstances(panel.id).length, 0
    );
    setInstanceCount(totalCount);
  };

  // Update instance visibility when panel visibility changes
  useEffect(() => {
    panels.forEach(panel => {
      const shapes = contentInstanceManager.getInstances(panel.id);
      shapes.forEach(shape => {
        if (!panel.isVisible) {
          // Store current opacity before hiding
          panel.opacityMap.set(shape.id, shape.properties?.opacity ?? 1.0);
          const updatedInstance = {
            ...shape,
            properties: {
              ...shape.properties,
              opacity: 0
            }
          };
          contentInstanceManager.removeInstance(panel.id, shape.id);
          contentInstanceManager.addInstance(panel.id, updatedInstance);
        } else {
          // Restore original opacity
          const originalOpacity = panel.opacityMap.get(shape.id) ?? panel.shapeOpacity;
          const updatedInstance = {
            ...shape,
            properties: {
              ...shape.properties,
              opacity: originalOpacity
            }
          };
          contentInstanceManager.removeInstance(panel.id, shape.id);
          contentInstanceManager.addInstance(panel.id, updatedInstance);
        }
      });
    });
  }, [panels, contentInstanceManager]);

  // Effect to update panel when content type changes
  useEffect(() => {
    panels.forEach(panel => {
      const defaults = contentTypeDefaults[panel.selectedContentType];
      updatePanel(panel.id, {
        numShapesInput: defaults.defaultQuantity?.toString() ?? "100",
        shapeSizeMeters: defaults.size?.toString() ?? "10",
        shapeOpacity: defaults.opacity ?? 1.0,
        shapeColor: defaults.color ?? '#0000FF',
        shapeBorderSize: defaults.borderSize ?? 0,
        shapeBorderColor: defaults.borderColor ?? '#000000',
        shapeType: defaults.shape ?? 'circle',
        shapeLabel: defaults.label ?? '',
        showShapeLabel: defaults.showLabel ?? false,
        minDistance: defaults.minSpacing?.toString() ?? "0"
      });
    });
  }, [panels.map(p => p.selectedContentType).join(',')]);

  // Handler for adding shapes to a panel
  const handleAddShapes = (panel: PanelState) => {
    console.log('Adding shapes for panel:', panel.id, panel.name);
    const numDots = parseInt(panel.numShapesInput) || contentTypeDefaults[panel.selectedContentType].defaultQuantity || 100;
    console.log('Number of dots to add:', numDots);
    if (isNaN(numDots) || numDots <= 0) return;

    // Remove existing shapes
    const existingShapes = contentInstanceManager.getInstances(panel.id);
    console.log('Removing existing shapes:', existingShapes.length);
    existingShapes.forEach(instance => {
      contentInstanceManager.removeInstance(panel.id, instance.id);
    });

    // Parse size and min distance values
    const size = parseFloat(panel.shapeSizeMeters);
    const spacing = parseFloat(panel.minDistance);

    if (isNaN(size) || size <= 0) {
      updatePanel(panel.id, { distributionMessage: "Invalid shape size" });
      return;
    }

    if (isNaN(spacing)) {
      updatePanel(panel.id, { distributionMessage: "Invalid minimum distance" });
      return;
    }

    if (!backgroundImageRef.current) {
      updatePanel(panel.id, { distributionMessage: "Background image not loaded" });
      return;
    }

    // Create distribution constraints
    const constraints = {
      mapImage: backgroundImageRef.current!,
      alphaThreshold: 200,
      minSpacing: spacing + size,
      maxAttempts: numDots * 10,
      respectTypeSpacing: false
    };

    // Create content type configuration
    const debugShapeType = {
      ...DEBUG_SHAPE_TYPE_1, // Use type 1 as base for all panels
      id: panel.id, // Override with panel's ID
      mapWidthKm: mapConfig.widthKm,
      mapHeightKm: mapConfig.heightKm,
      size: size,
      minSpacing: spacing + size,
      canOverlap: spacing <= 0,
      category: contentTypeDefaults[panel.selectedContentType].category ?? 'Debug',
      defaultProperties: {
        showDebug: panel.showShapeDebug,
        sizeMeters: size,
        shape: panel.shapeType,
        opacity: panel.shapeOpacity,
        color: panel.shapeColor,
        borderSize: panel.shapeBorderSize,
        borderColor: panel.shapeBorderColor,
        label: panel.shapeLabel,
        showLabel: panel.showShapeLabel,
        showMinDistanceRing: panel.showMinDistanceRing,
        minDistanceMeters: parseFloat(panel.minDistance) + size,
        minDistanceRingColor: '#ffffff',
        minDistanceRingStyle: 'dashed',
        contentType: panel.selectedContentType
      }
    };

    // Get distributor and generate instances
    const distributor = DistributorFactory.getDefaultDistributor();
    const result = distributor.distribute(debugShapeType, numDots, constraints);

    // Update distribution message
    if (result.message) {
      updatePanel(panel.id, {
        distributionMessage: `${result.actualCount} of ${result.requestedCount} shapes placed. ${result.message}`
      });
    } else {
      updatePanel(panel.id, { distributionMessage: null });
    }

    // Add instances to manager
    console.log('Distribution result:', result);
    let addedCount = 0;
    result.instances.forEach(instance => {
      if (contentInstanceManager.validateInstance(instance)) {
        contentInstanceManager.addInstance(panel.id, instance);
        addedCount++;
      }
    });
    console.log('Successfully added shapes:', addedCount);

    // Update total instance count
    const totalCount = panels.reduce((count, p) => 
      count + contentInstanceManager.getInstances(p.id).length, 0
    );
    console.log('Total instance count across all panels:', totalCount);
    setInstanceCount(totalCount);
  };

  // Handler for deleting shapes from a panel
  const handleDeleteShapes = (panelId: string) => {
    contentInstanceManager.getInstances(panelId).forEach(instance => {
      contentInstanceManager.removeInstance(panelId, instance.id);
    });
    const totalCount = panels.reduce((count, panel) => 
      count + contentInstanceManager.getInstances(panel.id).length, 0
    );
    setInstanceCount(totalCount);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '10px',
      backgroundColor: '#2a2a2a',
      height: 'auto',
      minHeight: 'min-content'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        padding: '10px',
        paddingLeft: '20px', // Add indentation for panels
      }}>
      {panels.map(panel => (
        <DebugShapePanel
          key={panel.id}
          id={panel.id}
          title={panel.name}
          isCollapsed={panel.isCollapsed}
          onToggleCollapse={() => updatePanel(panel.id, { isCollapsed: !panel.isCollapsed })}
          isVisible={panel.isVisible}
          onToggleVisibility={() => updatePanel(panel.id, { isVisible: !panel.isVisible })}
          numShapesInput={panel.numShapesInput}
          setNumShapesInput={(value) => updatePanel(panel.id, { numShapesInput: value })}
          shapeSizeMeters={panel.shapeSizeMeters}
          setShapeSizeMeters={(value) => updatePanel(panel.id, { shapeSizeMeters: value })}
          shapeOpacity={panel.shapeOpacity}
          setShapeOpacity={(value) => updatePanel(panel.id, { shapeOpacity: value })}
          showShapeDebug={panel.showShapeDebug}
          setShowShapeDebug={(value) => updatePanel(panel.id, { showShapeDebug: value })}
          shapeColor={panel.shapeColor}
          setShapeColor={(value) => updatePanel(panel.id, { shapeColor: value })}
          shapeBorderSize={panel.shapeBorderSize}
          setShapeBorderSize={(value) => updatePanel(panel.id, { shapeBorderSize: value })}
          shapeBorderColor={panel.shapeBorderColor}
          setShapeBorderColor={(value) => updatePanel(panel.id, { shapeBorderColor: value })}
          shapeType={panel.shapeType}
          setShapeType={(value) => updatePanel(panel.id, { shapeType: value })}
          shapeLabel={panel.shapeLabel}
          setShapeLabel={(value) => updatePanel(panel.id, { shapeLabel: value })}
          showShapeLabel={panel.showShapeLabel}
          setShowShapeLabel={(value) => updatePanel(panel.id, { showShapeLabel: value })}
          minDistance={panel.minDistance}
          setMinDistance={(value) => updatePanel(panel.id, { minDistance: value })}
          showMinDistanceRing={panel.showMinDistanceRing}
          setShowMinDistanceRing={(value) => updatePanel(panel.id, { showMinDistanceRing: value })}
          distributionMessage={panel.distributionMessage}
          selectedContentType={panel.selectedContentType}
          setSelectedContentType={(value) => updatePanel(panel.id, { selectedContentType: value })}
          contentInstanceManager={contentInstanceManager}
          setInstanceCount={setInstanceCount}
          handleAddShapes={() => handleAddShapes(panel)}
          handleDeleteShapes={() => handleDeleteShapes(panel.id)}
          resetIcon="/assets/icon_reset_settings.png"
          duplicateIcon="/assets/icon_content_copy.png"
          trashIcon="/assets/icon_trash.png"
          name={panel.name}
          onNameChange={(value) => updatePanel(panel.id, { name: value })}
          onDuplicate={() => duplicatePanel(panel.id)}
          onDelete={() => deletePanel(panel.id)}
        />
      ))}
      </div>
      <button
        onClick={createNewPanel}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          backgroundColor: '#4a2a82', // Purple color from mockup
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        <span style={{ fontSize: '24px' }}>+</span>
        Add Shape
      </button>
    </div>
  );
};
