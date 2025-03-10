import React, { useEffect, useRef } from 'react';
import { ContentShape, ContentTypeId } from '../../types/ContentTypes';
import { ShapeRendererFactory } from '../../utils/ShapeRenderer';
import { createRenderStyle } from '../../types/RenderStyle';
import { ContentInstanceManager } from '../../utils/ContentInstanceManager';

interface MapLegendProps {
  contentInstanceManager: ContentInstanceManager;
}

export const MapLegend: React.FC<MapLegendProps> = ({ contentInstanceManager }) => {
  // Get all unique content types that have instances
  const activeContent = Object.entries(contentInstanceManager.getAllInstances().reduce((acc, instance) => {
    if (!acc[instance.typeId]) {
      acc[instance.typeId] = {
        typeId: instance.typeId,
        shape: instance.properties?.shape || 'circle',
        color: instance.properties?.color || '#ffffff',
        borderSize: instance.properties?.borderSize,
        borderColor: instance.properties?.borderColor,
        label: instance.properties?.label || instance.typeId
      };
    }
    return acc;
  }, {} as Record<string, {
    typeId: string;
    shape: ContentShape;
    color: string;
    borderSize?: number;
    borderColor?: string;
    label?: string;
  }>));

  // Don't show legend if no content exists
  if (activeContent.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      backgroundColor: 'rgba(42, 42, 42, 0.9)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white',
      zIndex: 1000,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
    }}>
      <div style={{ 
        fontSize: '14px', 
        fontWeight: 'bold',
        marginBottom: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        paddingBottom: '5px'
      }}>
        Map Legend
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeContent.map(([id, type]) => (
          <LegendItem key={id} type={type} />
        ))}
      </div>
    </div>
  );
};

interface LegendItemProps {
  type: {
    typeId: string;
    shape: ContentShape;
    color: string;
    borderSize?: number;
    borderColor?: string;
    label?: string;
  };
}

const LegendItem: React.FC<LegendItemProps> = ({ type }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 24, 24);

    // Get the renderer for this shape
    const renderer = ShapeRendererFactory.getRenderer(type.shape);

    // Create render style
    const style = createRenderStyle({
      fillColor: type.color,
      strokeColor: type.borderColor ?? type.color,
      lineWidth: type.borderSize ?? 0,
      opacity: 1
    });

    // Render the shape
    renderer.render(ctx, 12, 12, 16, style);
  }, [type]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ 
        width: '24px', 
        height: '24px',
        position: 'relative'
      }}>
        <canvas
          ref={canvasRef}
          width={24}
          height={24}
          style={{
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      </div>
      <span style={{ fontSize: '12px' }}>{type.label}</span>
    </div>
  );
};
