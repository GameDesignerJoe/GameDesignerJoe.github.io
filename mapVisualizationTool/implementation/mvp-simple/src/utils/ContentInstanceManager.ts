import { MapCoordinate } from './MapCoordinates';

/**
 * Represents an instance of a content type placed on the map
 */
export interface ContentInstance {
  /** Unique identifier for this instance */
  id: string;
  
  /** References the content type definition */
  typeId: string;
  
  /** Normalized position (0-1) on the map */
  position: MapCoordinate;
  
  /** Optional type-specific properties */
  properties?: Record<string, any>;
}

/**
 * Manages content instances for all content types
 */
export class ContentInstanceManager {
  /** Store instances by type ID for efficient access */
  private instances: Record<string, ContentInstance[]> = {};
  
  /**
   * Add a new instance of a content type
   * @param typeId The content type identifier
   * @param instance The instance to add
   */
  addInstance(typeId: string, instance: ContentInstance): void {
    if (!this.instances[typeId]) {
      this.instances[typeId] = [];
    }
    this.instances[typeId].push(instance);
  }
  
  /**
   * Remove an instance by its ID
   * @param typeId The content type identifier
   * @param instanceId The instance identifier to remove
   */
  removeInstance(typeId: string, instanceId: string): void {
    if (this.instances[typeId]) {
      this.instances[typeId] = this.instances[typeId]
        .filter(instance => instance.id !== instanceId);
    }
  }
  
  /**
   * Get all instances of a specific content type
   * @param typeId The content type identifier
   * @returns Array of instances for the specified type
   */
  getInstances(typeId: string): ContentInstance[] {
    return this.instances[typeId] || [];
  }
  
  /**
   * Get all instances across all content types
   * @returns Array of all instances
   */
  getAllInstances(): ContentInstance[] {
    return Object.values(this.instances).flat();
  }
  
  /**
   * Validate a content instance
   * @param instance The instance to validate
   * @returns true if the instance is valid
   */
  validateInstance(instance: ContentInstance): boolean {
    return !!(
      instance.id && 
      instance.typeId && 
      instance.position &&
      instance.position.x >= 0 && instance.position.x <= 1 &&
      instance.position.y >= 0 && instance.position.y <= 1
    );
  }
}
