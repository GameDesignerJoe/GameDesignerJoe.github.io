import React, { useMemo } from 'react';
import { ContentInstanceManager } from '../../utils/ContentInstanceManager';
import { ContentTypeId, contentTypeDefaults } from '../../types/ContentTypes';

interface DetailsPanelProps {
  contentInstanceManager: ContentInstanceManager;
  mapWidthKm: number;
  mapHeightKm: number;
  instanceCount: number;
}

// Mapping for plural labels
const pluralLabels: Record<ContentTypeId, string> = {
  Start: 'Starting Locations',
  Enemies: 'Enemies',
  Bosses: 'Bosses',
  PointOfInterest: 'Points of Interest',
  MissionLocation: 'Mission Locations',
  FastTravel: 'Fast Travel Locations',
  Restoration: 'Restoration Locations',
  Resources: 'Resources',
  Debug: 'Debug Points'
};

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  contentInstanceManager,
  mapWidthKm,
  mapHeightKm,
  instanceCount
}) => {
  const metrics = useMemo(() => {
    const allInstances = contentInstanceManager.getAllInstances();
    const mapAreaKm2 = mapWidthKm * mapHeightKm;

    // Group instances by their actual content type from properties
    const instancesByType = allInstances.reduce((acc, instance) => {
      // Get the actual type from instance properties
      const actualType = instance.properties?.contentType;
      if (actualType && actualType !== 'Debug') {
        if (!acc[actualType]) {
          acc[actualType] = [];
        }
        acc[actualType].push(instance);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate total enemies (regular + bosses)
    const enemyCount = (instancesByType['Enemies']?.length || 0);
    const bossCount = (instancesByType['Bosses']?.length || 0);
    const totalEnemies = enemyCount + bossCount;

    // Calculate total locations
    const locationTypes: ContentTypeId[] = ['Start', 'PointOfInterest', 'FastTravel', 'MissionLocation', 'Restoration', 'Resources'];
    const totalLocations = locationTypes.reduce((sum, type) => 
      sum + (instancesByType[type]?.length || 0), 0
    );

    // Calculate individual type counts
    const typeCounts = Object.entries(contentTypeDefaults)
      .filter(([id]) => id !== 'Debug')
      .reduce((acc, [id]) => {
        acc[id] = instancesByType[id]?.length || 0;
        return acc;
      }, {} as Record<string, number>);

    // Calculate content density (excluding debug shapes)
    const contentCount = Object.values(instancesByType).reduce((sum, instances) => sum + instances.length, 0);
    const contentDensity = contentCount / mapAreaKm2;

    // Calculate combat/exploration ratio
    const combatContent = totalEnemies;
    const explorationContent = totalLocations;
    const combatExplorationRatio = explorationContent > 0 ? 
      combatContent / explorationContent : 0;

    // Calculate map coverage (rough estimate based on content distribution)
    const coverageRadius = 0.2; // 200m radius around each content piece
    const coveredArea = Math.min(
      mapAreaKm2,
      contentCount * Math.PI * coverageRadius * coverageRadius
    );
    const mapCoverage = (coveredArea / mapAreaKm2) * 100;

    return {
      totalContent: contentCount,
      totalEnemies,
      totalLocations,
      typeCounts,
      contentDensity,
      combatExplorationRatio,
      mapCoverage
    };
  }, [contentInstanceManager, mapWidthKm, mapHeightKm, instanceCount]);

  // Only show the panel if there's content
  if (metrics.totalContent === 0) {
    return null;
  }

  return (
    <div style={{ 
      position: 'absolute', 
      top: '10px', 
      right: '10px', 
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '14px',
      minWidth: '200px'
    }}>
      {/* Map Size Section */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Map Size</div>
        <div>
          {mapWidthKm.toFixed(1)}km × {mapHeightKm.toFixed(1)}km ({(mapWidthKm * mapHeightKm).toFixed(1)}km²)
        </div>
      </div>

      {/* Content Summary Section */}
      <div style={{ marginBottom: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Content Summary</div>
        <div>Total Content: {metrics.totalContent}</div>
        {metrics.totalEnemies > 0 && <div>Total Enemies: {metrics.totalEnemies}</div>}
        {metrics.totalLocations > 0 && <div>Total Locations: {metrics.totalLocations}</div>}
      </div>

      {/* Content Types Section */}
      <div style={{ marginBottom: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Content Types</div>
        {Object.entries(metrics.typeCounts).map(([type, count]) => {
          if (count === 0) return null;
          const label = pluralLabels[type as ContentTypeId] || type;
          return (
            <div key={type}>
              {label}: {count}
            </div>
          );
        })}
      </div>

      {/* Metrics Section */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Metrics</div>
        <div>Content Density: {metrics.contentDensity.toFixed(1)} items/km²</div>
        <div>Combat/Exploration: {metrics.combatExplorationRatio.toFixed(2)}</div>
        <div>Map Coverage: {metrics.mapCoverage.toFixed(1)}%</div>
      </div>
    </div>
  );
};
