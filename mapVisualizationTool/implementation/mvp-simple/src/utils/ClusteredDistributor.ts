import { ContentTypeBase } from '../types/ContentTypes';
import { ContentInstance } from './ContentInstanceManager';
import {
  ContentDistributor,
  DistributionConstraints,
  DistributionResult,
  calculateDistanceInMeters,
  generateInstanceId,
  estimateMaxCapacity
} from '../types/Distribution';
import { ValidationSystem, ValidationConfig } from './ValidationSystem';

/**
 * Implements clustered distribution of content instances across the map
 */
export class ClusteredDistributor implements ContentDistributor {
  private validationSystem: ValidationSystem;

  constructor() {
    // Initialize validation system with default config
    // Actual config will be set during distribution
    this.validationSystem = new ValidationSystem({
      mapImage: new Image(), // Placeholder, will be updated
      mapWidthKm: 10,
      mapHeightKm: 10
    });
  }

  /**
   * Generates evenly spaced cluster centers
   */
  private generateClusterCenters(
    count: number,
    contentType: ContentTypeBase,
    constraints: DistributionConstraints,
    mapWidthKm: number,
    mapHeightKm: number
  ): { x: number; y: number }[] {
    const clusterCount = constraints.clusterCount ?? Math.ceil(count / 10);
    const centers: { x: number; y: number }[] = [];
    let attempts = 0;
    const maxAttempts = clusterCount * 10;

    // Calculate minimum distance between cluster centers
    // This ensures clusters don't overlap too much
    const minClusterSpacing = Math.sqrt((mapWidthKm * mapHeightKm) / clusterCount) * 0.5;

    while (centers.length < clusterCount && attempts < maxAttempts) {
      attempts++;

      // Generate random position for cluster center
      const position = {
        x: Math.random(),
        y: Math.random()
      };

      // Update validation system config
      this.validationSystem.updateConfig({
        mapImage: constraints.mapImage,
        mapWidthKm: mapWidthKm,
        mapHeightKm: mapHeightKm,
        alphaThreshold: constraints.alphaThreshold
      });

      // Validate position using validation system
      const validationResults = this.validationSystem.validatePosition(
        position,
        contentType,
        centers.map(c => ({ id: 'center', typeId: 'cluster', position: c, properties: {} }))
      );

      // Check if position is valid
      if (!validationResults.every(result => result.valid)) {
        continue;
      }

      // Validate spacing between cluster centers
      const isValidSpacing = centers.every(center => {
        const distance = calculateDistanceInMeters(
          position,
          center,
          mapWidthKm,
          mapHeightKm
        );
        return distance >= minClusterSpacing * 1000; // Convert km to meters
      });

      if (!isValidSpacing) {
        continue;
      }

      centers.push(position);
    }

    return centers;
  }

  /**
   * Generates a random position within a cluster radius
   */
  private generateClusterPosition(
    center: { x: number; y: number },
    radius: number,
    mapWidthKm: number,
    mapHeightKm: number
  ): { x: number; y: number } {
    // Convert radius from meters to normalized coordinates
    const normalizedRadius = radius / (mapWidthKm * 1000);

    // Generate random angle and distance
    const angle = Math.random() * Math.PI * 2;
    // Use square root to get more uniform distribution
    const distance = Math.sqrt(Math.random()) * normalizedRadius;

    // Calculate position using polar coordinates
    const x = center.x + Math.cos(angle) * distance;
    const y = center.y + Math.sin(angle) * distance;

    // Clamp to valid range (0-1)
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
  }

  /**
   * Distributes content instances in clusters across valid map areas
   */
  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): DistributionResult {
    // Extract map dimensions from content type
    const mapWidthKm = contentType.mapWidthKm ?? 10;
    const mapHeightKm = contentType.mapHeightKm ?? 10;

    // Get minimum spacing requirement
    const minSpacing = constraints.respectTypeSpacing
      ? contentType.minSpacing
      : constraints.minSpacing ?? 0;

    // Get cluster radius (default to 5% of map width)
    const clusterRadius = constraints.clusterRadius ?? mapWidthKm * 50; // 5% of width in meters

    // Generate cluster centers
    const centers = this.generateClusterCenters(count, contentType, constraints, mapWidthKm, mapHeightKm);

    // Estimate capacity
    const estimatedCapacity = estimateMaxCapacity(
      constraints.mapImage,
      minSpacing,
      contentType.size,
      mapWidthKm,
      mapHeightKm
    );

    const instances: ContentInstance[] = [];
    let attempts = 0;
    const maxAttempts = constraints.maxAttempts ?? count * 10;

    // Calculate instances per cluster
    const instancesPerCluster = Math.ceil(count / centers.length);

    // Distribute instances around cluster centers
    for (const center of centers) {
      let clusterInstances = 0;

      while (
        clusterInstances < instancesPerCluster &&
        instances.length < count &&
        attempts < maxAttempts
      ) {
        attempts++;

        // Generate position within cluster
        const position = this.generateClusterPosition(
          center,
          clusterRadius,
          mapWidthKm,
          mapHeightKm
        );

        // Update validation system config with current constraints
        this.validationSystem.updateConfig({
          mapImage: constraints.mapImage,
          mapWidthKm: mapWidthKm,
          mapHeightKm: mapHeightKm,
          alphaThreshold: constraints.alphaThreshold,
          minSpacing: minSpacing,
          respectTypeSpacing: constraints.respectTypeSpacing
        });

        // Validate position using validation system
        const validationResults = this.validationSystem.validatePosition(
          position,
          contentType,
          instances
        );

        // Check if position is valid
        if (!validationResults.every(result => result.valid)) {
          continue;
        }

        // Create and add instance
        const instance: ContentInstance = {
          id: generateInstanceId(),
          typeId: contentType.id,
          position: position,
          properties: {
            // Optional properties from content type
            ...contentType.defaultProperties,
            // Distribution-specific properties
            distributionStrategy: 'clustered',
            attempts: attempts,
            minSpacing: minSpacing,
            sizeMeters: contentType.size,
            clusterCenter: center,
            clusterRadius: clusterRadius
          }
        };

        instances.push(instance);
        clusterInstances++;
      }
    }

    // Calculate placement efficiency
    const placementEfficiency = instances.length / attempts;

    // Generate appropriate message based on results
    let message: string | undefined;
    if (instances.length < count) {
      if (instances.length < estimatedCapacity * 0.9) {
        message = `Limited valid area for placement. Placed ${instances.length}/${count}`;
      } else {
        message = `Reached capacity limit. Max ~${estimatedCapacity} with current spacing`;
      }
    }

    return {
      instances,
      success: instances.length === count,
      message,
      attempts,
      requestedCount: count,
      actualCount: instances.length,
      estimatedCapacity,
      placementEfficiency,
      clusterCenters: centers
    };
  }
}
