import React, { useState } from 'react';
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
  // State for Debug Shape Panel 1
  const [numShapesInput1, setNumShapesInput1] = useState("100");
  const [shapeSizeMeters1, setShapeSizeMeters1] = useState("10");
  const [shapeOpacity1, setShapeOpacity1] = useState(1.0);
  const [showShapeDebug1, setShowShapeDebug1] = useState(false);
  const [shapeColor1, setShapeColor1] = useState('#0000FF');
  const [shapeBorderSize1, setShapeBorderSize1] = useState(0);
  const [shapeBorderColor1, setShapeBorderColor1] = useState('#000000');
  const [shapeType1, setShapeType1] = useState<ContentShape>('circle');
  const [shapeLabel1, setShapeLabel1] = useState('');
  const [showShapeLabel1, setShowShapeLabel1] = useState(false);
  const [minDistance1, setMinDistance1] = useState("0");
  const [showMinDistanceRing1, setShowMinDistanceRing1] = useState(false);
  const [distributionMessage1, setDistributionMessage1] = useState<string | null>(null);
  const [selectedContentType1, setSelectedContentType1] = useState<ContentTypeId>('Debug1');

  // State for Debug Shape Panel 2
  const [numShapesInput2, setNumShapesInput2] = useState("100");
  const [shapeSizeMeters2, setShapeSizeMeters2] = useState("10");
  const [shapeOpacity2, setShapeOpacity2] = useState(1.0);
  const [showShapeDebug2, setShowShapeDebug2] = useState(false);
  const [shapeColor2, setShapeColor2] = useState('#FF00FF');
  const [shapeBorderSize2, setShapeBorderSize2] = useState(0);
  const [shapeBorderColor2, setShapeBorderColor2] = useState('#000000');
  const [shapeType2, setShapeType2] = useState<ContentShape>('circle');
  const [shapeLabel2, setShapeLabel2] = useState('');
  const [showShapeLabel2, setShowShapeLabel2] = useState(false);
  const [minDistance2, setMinDistance2] = useState("0");
  const [showMinDistanceRing2, setShowMinDistanceRing2] = useState(false);
  const [distributionMessage2, setDistributionMessage2] = useState<string | null>(null);
  const [selectedContentType2, setSelectedContentType2] = useState<ContentTypeId>('Debug2');

  // Handlers for Debug Shape Panel 1
  const handleAddShapes1 = () => {
    const numDots = parseInt(numShapesInput1);
    if (isNaN(numDots) || numDots <= 0) return;

    // Remove existing debug shapes
    contentInstanceManager.getInstances('debug-shape-1').forEach(instance => {
      contentInstanceManager.removeInstance('debug-shape-1', instance.id);
    });

    // Parse size and min distance values
    const size = parseFloat(shapeSizeMeters1);
    const spacing = parseFloat(minDistance1);

    if (isNaN(size) || size <= 0) {
      setDistributionMessage1("Invalid shape size");
      return;
    }

    if (isNaN(spacing)) {
      setDistributionMessage1("Invalid minimum distance");
      return;
    }

    if (!backgroundImageRef.current) {
      setDistributionMessage1("Background image not loaded");
      return;
    }

    // Create distribution constraints
    const constraints = {
      mapImage: backgroundImageRef.current!,
      alphaThreshold: 200,
      minSpacing: spacing,
      maxAttempts: numDots * 10,
      respectTypeSpacing: false
    };

    // Create content type configuration
    const debugShapeType = {
      ...DEBUG_SHAPE_TYPE_1,
      mapWidthKm: mapConfig.widthKm,
      mapHeightKm: mapConfig.heightKm,
      size: size,
      minSpacing: spacing,
      canOverlap: spacing <= 0,
      category: contentTypeDefaults[selectedContentType1].category ?? 'Debug',
      defaultProperties: {
        showDebug: showShapeDebug1,
        sizeMeters: size,
        shape: shapeType1,
        opacity: shapeOpacity1,
        color: shapeColor1,
        borderSize: shapeBorderSize1,
        borderColor: shapeBorderColor1,
        label: shapeLabel1,
        showLabel: showShapeLabel1,
        showMinDistanceRing: showMinDistanceRing1,
        minDistanceMeters: parseFloat(minDistance1),
        minDistanceRingColor: '#ffffff',
        minDistanceRingStyle: 'dashed',
        contentType: selectedContentType1
      }
    };

    // Get distributor and generate instances
    const distributor = DistributorFactory.getDefaultDistributor();
    const result = distributor.distribute(debugShapeType, numDots, constraints);

    // Update distribution message
    if (result.message) {
      setDistributionMessage1(`${result.actualCount} of ${result.requestedCount} shapes placed. ${result.message}`);
    } else {
      setDistributionMessage1(null);
    }

    // Add instances to manager
    result.instances.forEach(instance => {
      if (contentInstanceManager.validateInstance(instance)) {
        contentInstanceManager.addInstance('debug-shape-1', instance);
      }
    });

    // Update total instance count
    const totalCount = contentInstanceManager.getInstances('debug-shape-1').length + contentInstanceManager.getInstances('debug-shape-2').length;
    setInstanceCount(totalCount);
  };

  const handleDeleteShapes1 = () => {
    contentInstanceManager.getInstances('debug-shape-1').forEach(instance => {
      contentInstanceManager.removeInstance('debug-shape-1', instance.id);
    });
    const totalCount = contentInstanceManager.getInstances('debug-shape-1').length + contentInstanceManager.getInstances('debug-shape-2').length;
    setInstanceCount(totalCount);
  };

  // Handlers for Debug Shape Panel 2
  const handleAddShapes2 = () => {
    const numDots = parseInt(numShapesInput2);
    if (isNaN(numDots) || numDots <= 0) return;

    // Remove existing debug shapes
    contentInstanceManager.getInstances('debug-shape-2').forEach(instance => {
      contentInstanceManager.removeInstance('debug-shape-2', instance.id);
    });

    // Parse size and min distance values
    const size = parseFloat(shapeSizeMeters2);
    const spacing = parseFloat(minDistance2);

    if (isNaN(size) || size <= 0) {
      setDistributionMessage2("Invalid shape size");
      return;
    }

    if (isNaN(spacing)) {
      setDistributionMessage2("Invalid minimum distance");
      return;
    }

    if (!backgroundImageRef.current) {
      setDistributionMessage2("Background image not loaded");
      return;
    }

    // Create distribution constraints
    const constraints = {
      mapImage: backgroundImageRef.current!,
      alphaThreshold: 200,
      minSpacing: spacing,
      maxAttempts: numDots * 10,
      respectTypeSpacing: false
    };

    // Create content type configuration
    const debugShapeType = {
      ...DEBUG_SHAPE_TYPE_2,
      mapWidthKm: mapConfig.widthKm,
      mapHeightKm: mapConfig.heightKm,
      size: size,
      minSpacing: spacing,
      canOverlap: spacing <= 0,
      category: contentTypeDefaults[selectedContentType2].category ?? 'Debug',
      defaultProperties: {
        showDebug: showShapeDebug2,
        sizeMeters: size,
        shape: shapeType2,
        opacity: shapeOpacity2,
        color: shapeColor2,
        borderSize: shapeBorderSize2,
        borderColor: shapeBorderColor2,
        label: shapeLabel2,
        showLabel: showShapeLabel2,
        showMinDistanceRing: showMinDistanceRing2,
        minDistanceMeters: parseFloat(minDistance2),
        minDistanceRingColor: '#ffffff',
        minDistanceRingStyle: 'dashed',
        contentType: selectedContentType2
      }
    };

    // Get distributor and generate instances
    const distributor = DistributorFactory.getDefaultDistributor();
    const result = distributor.distribute(debugShapeType, numDots, constraints);

    // Update distribution message
    if (result.message) {
      setDistributionMessage2(`${result.actualCount} of ${result.requestedCount} shapes placed. ${result.message}`);
    } else {
      setDistributionMessage2(null);
    }

    // Add instances to manager
    result.instances.forEach(instance => {
      if (contentInstanceManager.validateInstance(instance)) {
        contentInstanceManager.addInstance('debug-shape-2', instance);
      }
    });

    // Update total instance count
    const totalCount = contentInstanceManager.getInstances('debug-shape-1').length + contentInstanceManager.getInstances('debug-shape-2').length;
    setInstanceCount(totalCount);
  };

  const handleDeleteShapes2 = () => {
    contentInstanceManager.getInstances('debug-shape-2').forEach(instance => {
      contentInstanceManager.removeInstance('debug-shape-2', instance.id);
    });
    const totalCount = contentInstanceManager.getInstances('debug-shape-1').length + contentInstanceManager.getInstances('debug-shape-2').length;
    setInstanceCount(totalCount);
  };
  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <DebugShapePanel
        id="debug-shape-1"
        title="Debug Shapes 1"
        numShapesInput={numShapesInput1}
        setNumShapesInput={setNumShapesInput1}
        shapeSizeMeters={shapeSizeMeters1}
        setShapeSizeMeters={setShapeSizeMeters1}
        shapeOpacity={shapeOpacity1}
        setShapeOpacity={setShapeOpacity1}
        showShapeDebug={showShapeDebug1}
        setShowShapeDebug={setShowShapeDebug1}
        shapeColor={shapeColor1}
        setShapeColor={setShapeColor1}
        shapeBorderSize={shapeBorderSize1}
        setShapeBorderSize={setShapeBorderSize1}
        shapeBorderColor={shapeBorderColor1}
        setShapeBorderColor={setShapeBorderColor1}
        shapeType={shapeType1}
        setShapeType={setShapeType1}
        shapeLabel={shapeLabel1}
        setShapeLabel={setShapeLabel1}
        showShapeLabel={showShapeLabel1}
        setShowShapeLabel={setShowShapeLabel1}
        minDistance={minDistance1}
        setMinDistance={setMinDistance1}
        showMinDistanceRing={showMinDistanceRing1}
        setShowMinDistanceRing={setShowMinDistanceRing1}
        distributionMessage={distributionMessage1}
        selectedContentType={selectedContentType1}
        setSelectedContentType={setSelectedContentType1}
        contentInstanceManager={contentInstanceManager}
        setInstanceCount={setInstanceCount}
        handleAddShapes={handleAddShapes1}
        handleDeleteShapes={handleDeleteShapes1}
        deleteIcon={deleteIcon}
      />
      <DebugShapePanel
        id="debug-shape-2"
        title="Debug Shapes 2"
        numShapesInput={numShapesInput2}
        setNumShapesInput={setNumShapesInput2}
        shapeSizeMeters={shapeSizeMeters2}
        setShapeSizeMeters={setShapeSizeMeters2}
        shapeOpacity={shapeOpacity2}
        setShapeOpacity={setShapeOpacity2}
        showShapeDebug={showShapeDebug2}
        setShowShapeDebug={setShowShapeDebug2}
        shapeColor={shapeColor2}
        setShapeColor={setShapeColor2}
        shapeBorderSize={shapeBorderSize2}
        setShapeBorderSize={setShapeBorderSize2}
        shapeBorderColor={shapeBorderColor2}
        setShapeBorderColor={setShapeBorderColor2}
        shapeType={shapeType2}
        setShapeType={setShapeType2}
        shapeLabel={shapeLabel2}
        setShapeLabel={setShapeLabel2}
        showShapeLabel={showShapeLabel2}
        setShowShapeLabel={setShowShapeLabel2}
        minDistance={minDistance2}
        setMinDistance={setMinDistance2}
        showMinDistanceRing={showMinDistanceRing2}
        setShowMinDistanceRing={setShowMinDistanceRing2}
        distributionMessage={distributionMessage2}
        selectedContentType={selectedContentType2}
        setSelectedContentType={setSelectedContentType2}
        contentInstanceManager={contentInstanceManager}
        setInstanceCount={setInstanceCount}
        handleAddShapes={handleAddShapes2}
        handleDeleteShapes={handleDeleteShapes2}
        deleteIcon={deleteIcon}
      />
    </div>
  );
};
