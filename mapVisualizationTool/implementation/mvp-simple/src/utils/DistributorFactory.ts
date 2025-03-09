import { ContentDistributor } from '../types/Distribution';
import { RandomDistributor } from './RandomDistributor';
import { ClusteredDistributor } from './ClusteredDistributor';

/**
 * Factory class for managing content distribution strategies
 */
export class DistributorFactory {
  private static distributors = new Map<string, ContentDistributor>([
    ['random', new RandomDistributor()],
    ['clustered', new ClusteredDistributor()]
  ]);

  /**
   * Get a distributor instance by type
   */
  static getDistributor(type: string): ContentDistributor {
    const distributor = this.distributors.get(type);
    if (!distributor) {
      throw new Error(`No distributor found for type: ${type}`);
    }
    return distributor;
  }

  /**
   * Register a new distributor type
   */
  static registerDistributor(type: string, distributor: ContentDistributor): void {
    this.distributors.set(type, distributor);
  }

  /**
   * Get default distributor (random)
   */
  static getDefaultDistributor(): ContentDistributor {
    return this.getDistributor('random');
  }
}
