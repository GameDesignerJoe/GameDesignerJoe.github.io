import React, { useMemo } from 'react';
import { ContentInstanceManager } from '../../utils/ContentInstanceManager';
import { ContentTypeId } from '../../types/ContentTypes';

interface DetailsPanelProps {
  contentInstanceManager: ContentInstanceManager;
  mapWidthKm: number;
  mapHeightKm: number;
  instanceCount: number;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  contentInstanceManager,
  mapWidthKm,
  mapHeightKm,
  instanceCount
}) => {
  const metrics = useMemo(() => {
    const allInstances = contentInstanceManager.getAllInstances();
    const mapAreaKm2 = mapWidthKm * mapHeightKm;

    // Group instances by type
    const instancesByType = allInstances.reduce((acc, instance) => {
      const typeId = instance.typeId;
      if (!acc[typeId]) {
        acc[typeId] = [];
      }
      acc[typeId].push(instance);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate total enemies (regular + bosses)
    const enemyCount = (instancesByType['Enemies']?.length || 0);
    const bossCount = (instancesByType['Bosses']?.length || 0);
    const totalEnemies = enemyCount + bossCount;

    // Calculate total locations
    const locationTypes = ['Start', 'PointOfInterest', 'FastTravel', 'MissionLocation', 'Restoration'];
    const totalLocations = locationTypes.reduce((sum, type) => 
      sum + (instancesByType[type]?.length || 0), 0
    );

    // Calculate individual type counts
    const typeCounts = {
      PointOfInterest: instancesByType['PointOfInterest']?.length || 0,
      Bosses: bossCount,
      Enemies: enemyCount,
      MissionLocation: instancesByType['MissionLocation']?.length || 0,
      FastTravel: instancesByType['FastTravel']?.length || 0,
      Restoration: instancesByType['Restoration']?.length || 0,
      Start: instancesByType['Start']?.length || 0
    };

    // Calculate content density
    const contentDensity = allInstances.length / mapAreaKm2;

    // Calculate combat/exploration ratio
    const combatContent = totalEnemies;
    const explorationContent = totalLocations;
    const combatExplorationRatio = explorationContent > 0 ? 
      combatContent / explorationContent : 0;

    // Calculate map coverage (rough estimate based on content distribution)
    const coverageRadius = 0.2; // 200m radius around each content piece
    const coveredArea = Math.min(
      mapAreaKm2,
      allInstances.length * Math.PI * coverageRadius * coverageRadius
    );
    const mapCoverage = (coveredArea / mapAreaKm2) * 100;

    return {
      totalContent: allInstances.length,
      totalEnemies,
      totalLocations,
      typeCounts,
      contentDensity,
      combatExplorationRatio,
      mapCoverage
    };
  }, [contentInstanceManager, mapWidthKm, mapHeightKm, instanceCount]);

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
        <div>Total Enemies: {metrics.totalEnemies}</div>
        <div>Total Locations: {metrics.totalLocations}</div>
      </div>

      {/* Content Types Section */}
      <div style={{ marginBottom: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Content Types</div>
        {Object.entries(metrics.typeCounts).map(([type, count]) => (
          count > 0 && (
            <div key={type}>
              {type.replace(/([A-Z])/g, ' $1').trim()}: {count}
            </div>
          )
        ))}
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
