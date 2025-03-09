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
      const diagonalFactor = instance.properties?.shape === 'square' ? Math.SQRT2 : 1;
      const radius1 = (size1 * diagonalFactor) / 2;
      const radius2 = (size2 * diagonalFactor) / 2;
      
      // Calculate the total required distance between centers:
      // 1. Each shape contributes its radius
      // 2. Add the minimum spacing between edges
      const totalRequiredDistance = radius1 + radius2 + minSpacing;
      
      // Debug logging
      console.log('Distance check:', {
        centerDistance,
        radius1,
        radius2,
        minSpacing,
        totalRequiredDistance,
        shape1Size: size1,
        shape2Size: size2,
        position,
        existingPosition: instance.position
      });
      
      // The shapes are properly spaced if the center distance is at least
      // the sum of their radii plus the minimum spacing
      return centerDistance >= totalRequiredDistance;
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

    // Get minimum spacing requirement and shape size
    const minSpacing = constraints.minSpacing ?? 0;
    console.log('Initial minSpacing:', minSpacing);
    
    // Ensure shape size is valid
    const shapeSize = contentType.size > 0 ? contentType.size : 10; // Default to 10m if invalid
    console.log('Shape size:', shapeSize);

    // Calculate effective spacing based on shape size and minimum distance
    const effectiveSpacing = minSpacing;
    console.log('Effective spacing:', effectiveSpacing);

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
      if (!this.validateSpacing(
        position,
        instances,
        effectiveSpacing,
        mapWidthKm,
        mapHeightKm,
        shapeSize
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
