import { ContentDistributor, DistributionStrategy } from '../types/Distribution';
import { RandomDistributor } from './RandomDistributor';

/**
 * Factory class for creating and managing content distributors
 */
export class DistributorFactory {
  private static distributors = new Map<DistributionStrategy, ContentDistributor>([
    ['random', new RandomDistributor()]
    // Additional distributors will be added here as they are implemented
    // ['clustered', new ClusteredDistributor()]
  ]);

  /**
   * Get a distributor instance for the specified strategy
   */
  static getDistributor(strategy: DistributionStrategy): ContentDistributor {
    const distributor = this.distributors.get(strategy);
    if (!distributor) {
      throw new Error(`No distributor found for strategy: ${strategy}`);
    }
    return distributor;
  }

  /**
   * Register a new distributor implementation
   */
  static registerDistributor(strategy: DistributionStrategy, distributor: ContentDistributor): void {
    this.distributors.set(strategy, distributor);
  }

  /**
   * Get a list of available distribution strategies
   */
  static getAvailableStrategies(): DistributionStrategy[] {
    return Array.from(this.distributors.keys());
  }

  /**
   * Check if a strategy is available
   */
  static hasStrategy(strategy: DistributionStrategy): boolean {
    return this.distributors.has(strategy);
  }
}
