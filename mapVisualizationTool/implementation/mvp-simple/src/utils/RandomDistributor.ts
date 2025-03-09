import { ContentTypeBase } from '../types/ContentTypes';
import { ContentInstance } from './ContentInstanceManager';
import {
  ContentDistributor,
  DistributionConstraints,
  calculateDistanceInMeters,
  validateTransparency,
  generateInstanceId
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
    mapHeightKm: number
  ): boolean {
    return existingInstances.every(instance => {
      const distance = calculateDistanceInMeters(
        position,
        instance.position,
        mapWidthKm,
        mapHeightKm
      );
      return distance >= minSpacing;
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
  ): ContentInstance[] {
    const instances: ContentInstance[] = [];
    let attempts = 0;
    const maxAttempts = constraints.maxAttempts ?? count * 10;

    // Extract map dimensions from image
    const mapWidthKm = contentType.mapWidthKm ?? 10; // Default 10km if not specified
    const mapHeightKm = contentType.mapHeightKm ?? 10;

    // Get minimum spacing requirement
    const minSpacing = constraints.respectTypeSpacing
      ? contentType.minSpacing
      : constraints.minSpacing ?? 0;

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
        mapHeightKm
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
          minSpacing: minSpacing
        }
      };

      instances.push(instance);
    }

    return instances;
  }
}
