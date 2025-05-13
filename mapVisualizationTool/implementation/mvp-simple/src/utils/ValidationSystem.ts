import { ContentInstance } from './ContentInstanceManager';
import { ContentTypeBase } from '../types/ContentTypes';
import { calculateDistanceInMeters, validateTransparency } from '../types/Distribution';

/**
 * Types of validation that can be performed
 */
export type ValidationType = 'transparency' | 'spacing' | 'biome' | 'proximity';

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  type: ValidationType;
  message?: string;
  details?: {
    failedChecks?: string[];
    conflictingInstances?: ContentInstance[];
    minDistanceViolation?: number;
    suggestedPosition?: { x: number; y: number };
  };
}

/**
 * Configuration for validation operations
 */
export interface ValidationConfig {
  mapImage: HTMLImageElement;
  mapWidthKm: number;
  mapHeightKm: number;
  alphaThreshold?: number;
  minSpacing?: number;
  respectTypeSpacing?: boolean;
  validateTypes?: ValidationType[];
}

/**
 * Manages validation of content instances
 */
export class ValidationSystem {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  /**
   * Validate a single instance against all enabled validation types
   */
  public validateInstance(
    instance: ContentInstance,
    contentType: ContentTypeBase,
    existingInstances: ContentInstance[] = []
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    const types = this.config.validateTypes || ['transparency', 'spacing'];

    for (const type of types) {
      switch (type) {
        case 'transparency':
          results.push(this.validateTransparency(instance));
          break;
        case 'spacing':
          results.push(this.validateSpacing(instance, contentType, existingInstances));
          break;
        // Future validation types will be added here
      }
    }

    return results;
  }

  /**
   * Validate multiple instances at once
   */
  public validateInstances(
    instances: ContentInstance[],
    contentType: ContentTypeBase
  ): Map<string, ValidationResult[]> {
    const results = new Map<string, ValidationResult[]>();

    for (const instance of instances) {
      const otherInstances = instances.filter(i => i.id !== instance.id);
      results.set(instance.id, this.validateInstance(instance, contentType, otherInstances));
    }

    return results;
  }

  /**
   * Check if a position would be valid for a new instance
   */
  public validatePosition(
    position: { x: number; y: number },
    contentType: ContentTypeBase,
    existingInstances: ContentInstance[]
  ): ValidationResult[] {
    const tempInstance: ContentInstance = {
      id: 'temp',
      typeId: contentType.id,
      position: position,
      properties: {}
    };

    return this.validateInstance(tempInstance, contentType, existingInstances);
  }

  /**
   * Find the nearest valid position to a given point
   */
  public findNearestValidPosition(
    position: { x: number; y: number },
    contentType: ContentTypeBase,
    existingInstances: ContentInstance[],
  _searchRadius: number = 0.1 // 10% of map dimension
): { x: number; y: number } | null {
  // Implementation will use a spiral search pattern to find valid position
  // This is a placeholder for future implementation
  return null;
}

  private validateTransparency(instance: ContentInstance): ValidationResult {
    const valid = validateTransparency(
      instance.position,
      this.config.mapImage,
      this.config.alphaThreshold
    );

    return {
      valid,
      type: 'transparency',
      message: valid ? undefined : 'Position is in a transparent area of the map'
    };
  }

  private validateSpacing(
    instance: ContentInstance,
    contentType: ContentTypeBase,
    existingInstances: ContentInstance[]
  ): ValidationResult {
    const minSpacing = this.config.respectTypeSpacing
      ? contentType.minSpacing
      : this.config.minSpacing ?? 0;

    if (minSpacing <= 0) {
      return { valid: true, type: 'spacing' };
    }

    const conflicts = existingInstances.filter(existing => {
      const distance = calculateDistanceInMeters(
        instance.position,
        existing.position,
        this.config.mapWidthKm,
        this.config.mapHeightKm
      );
      return distance < minSpacing;
    });

    const valid = conflicts.length === 0;
    const details = valid ? undefined : {
      failedChecks: ['minimum distance'],
      conflictingInstances: conflicts,
      minDistanceViolation: minSpacing
    };

    return {
      valid,
      type: 'spacing',
      message: valid ? undefined : `Violates minimum spacing of ${minSpacing}m`,
      details
    };
  }

  /**
   * Update the validation configuration
   */
  public updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get validation statistics for a set of instances
   */
  public getValidationStats(
    instances: ContentInstance[],
    contentType: ContentTypeBase
  ): {
    totalInstances: number;
    validInstances: number;
    invalidByType: Record<ValidationType, number>;
  } {
    const stats = {
      totalInstances: instances.length,
      validInstances: 0,
      invalidByType: {
        transparency: 0,
        spacing: 0,
        biome: 0,
        proximity: 0
      }
    };

    const validationResults = this.validateInstances(instances, contentType);

    for (const [_, results] of validationResults) {
      const allValid = results.every(r => r.valid);
      if (allValid) {
        stats.validInstances++;
      } else {
        results
          .filter(r => !r.valid)
          .forEach(r => stats.invalidByType[r.type]++);
      }
    }

    return stats;
  }
}
