import { ContentTypeBase } from '../types/ContentTypes';
import { ContentInstance } from './ContentInstanceManager';
import {
  ContentDistributor,
  DistributionConstraints,
  DistributionResult,
  calculateDistanceInMeters,
  validateTransparency,
  generateInstanceId,
  estimateMaxCapacity
} from '../types/Distribution';

/**
 * Implements random distribution of content instances across the map
 */
export class RandomDistributor implements ContentDistributor {
  /**
   * Validates spacing between a potential new position and existing instances
   */
  private validateSpacing(
    position: { x: number; y: number },
    existingInstances: ContentInstance[],
    minSpacing: number,
    mapWidthKm: number,
    mapHeightKm: number,
    shapeSize: number
  ): boolean {
    return existingInstances.every(instance => {
      // Calculate center-to-center distance
      const centerDistance = calculateDistanceInMeters(
        position,
        instance.position,
        mapWidthKm,
        mapHeightKm
      );
      
      // Get the size of both shapes
      const size1 = shapeSize;
      const size2 = instance.properties?.sizeMeters ?? shapeSize;
      
      // For squares, we need to consider the diagonal
      // The diagonal of a square is sqrt(2) * side length
      const diagonalFactor = Math.SQRT2;
      const radius1 = (size1 * diagonalFactor) / 2;
      const radius2 = (size2 * diagonalFactor) / 2;
      
      // Calculate edge-to-edge distance by subtracting both radii
      const edgeDistance = centerDistance - radius1 - radius2;
      
      // Compare edge distance with minimum spacing
      return edgeDistance >= minSpacing;
    });
  }

  /**
   * Generates a random position within the normalized coordinate space
   */
  private generateRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random(),
      y: Math.random()
    };
  }

  /**
   * Distributes content instances randomly across valid map areas
   */
  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): DistributionResult {
    // Extract map dimensions from image
    const mapWidthKm = contentType.mapWidthKm ?? 10; // Default 10km if not specified
    const mapHeightKm = contentType.mapHeightKm ?? 10;

    // Get minimum spacing requirement
    const minSpacing = constraints.respectTypeSpacing
      ? contentType.minSpacing
      : constraints.minSpacing ?? 0;

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

    while (instances.length < count && attempts < maxAttempts) {
      attempts++;
      
      // Generate random position
      const position = this.generateRandomPosition();

      // Validate position
      if (!validateTransparency(position, constraints.mapImage, constraints.alphaThreshold)) {
        continue;
      }
      
      // Check spacing if required
      if (minSpacing > 0 && !this.validateSpacing(
        position,
        instances,
        minSpacing,
        mapWidthKm,
        mapHeightKm,
        contentType.size
      )) {
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
          distributionStrategy: 'random',
          attempts: attempts,
          minSpacing: minSpacing,
          sizeMeters: contentType.size
        }
      };

      instances.push(instance);
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
      placementEfficiency
    };
  }
}
