import { ContentTypeBase } from '../types/ContentTypes';
import { ContentInstance } from './ContentInstanceManager';
import {
  ContentDistributor,
  DistributionConstraints,
  DistributionResult,
  generateInstanceId,
  estimateMaxCapacity
} from '../types/Distribution';
import { ValidationSystem, ValidationConfig } from './ValidationSystem';

/**
 * Implements random distribution of content instances across the map
 */
export class RandomDistributor implements ContentDistributor {
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

      // Update validation system config with current constraints
      this.validationSystem.updateConfig({
        mapImage: constraints.mapImage,
        mapWidthKm: mapWidthKm,
        mapHeightKm: mapHeightKm,
        alphaThreshold: constraints.alphaThreshold,
        minSpacing: effectiveSpacing,
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
