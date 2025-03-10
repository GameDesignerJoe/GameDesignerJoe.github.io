# Distribution System Technical Documentation

## Overview

The distribution system provides a flexible framework for distributing content instances across the map. It supports multiple distribution strategies while ensuring proper validation and spacing constraints.

## Core Components

### 1. Distribution Interface

#### ContentDistributor Interface
```typescript
interface ContentDistributor {
  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): ContentInstance[];
}
```

#### Distribution Constraints
```typescript
interface DistributionConstraints {
  // Map boundaries and validation
  mapImage: HTMLImageElement;
  alphaThreshold?: number; // Default 200
  
  // Spacing constraints
  minSpacing?: number; // In meters
  respectTypeSpacing?: boolean; // Use contentType.minSpacing (e.g., Fast Travel's 500m)
  
  // Distribution parameters
  maxAttempts?: number; // Default count * 10
  clusterCount?: number; // For clustered distribution
  clusterRadius?: number; // For clustered distribution
}
```

### 2. Distribution Strategies

#### Random Distribution
- Uniform random distribution across valid map areas
- Respects transparency validation
- Enforces minimum spacing between instances
- Bounded attempt logic to prevent infinite loops

#### Clustered Distribution
- Generates cluster center points
- Distributes content around cluster centers
- Controls density within clusters
- Maintains minimum spacing between instances

### 3. Validation System

#### Transparency Validation
- Uses map image alpha channel
- Ensures content only appears on valid map areas
- Configurable alpha threshold
- Efficient pixel sampling

#### Spacing Validation
- Converts normalized coordinates to meters
- Respects content type minimum spacing
- Optimized distance calculations
- Handles both global and type-specific spacing

## Implementation Details

### 1. Random Distribution Strategy
```typescript
class RandomDistributor implements ContentDistributor {
  private validateTransparency(
    position: MapCoordinate,
    constraints: DistributionConstraints
  ): boolean {
    // Convert normalized coordinates to image coordinates
    const imgX = Math.floor(position.x * constraints.mapImage.width);
    const imgY = Math.floor(position.y * constraints.mapImage.height);
    
    // Get alpha value at position
    const alpha = getPixelAlpha(imgX, imgY, constraints.mapImage);
    
    // Check against threshold
    return alpha > (constraints.alphaThreshold ?? 200);
  }

  private validateSpacing(
    position: MapCoordinate,
    existingInstances: ContentInstance[],
    minSpacing: number
  ): boolean {
    return existingInstances.every(instance => {
      const distance = calculateDistance(position, instance.position);
      return distance >= minSpacing;
    });
  }

  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): ContentInstance[] {
    const instances: ContentInstance[] = [];
    let attempts = 0;
    const maxAttempts = constraints.maxAttempts ?? count * 10;

    while (instances.length < count && attempts < maxAttempts) {
      attempts++;
      
      // Generate random position
      const position = {
        x: Math.random(),
        y: Math.random()
      };

      // Validate position
      if (!this.validateTransparency(position, constraints)) continue;
      
      const minSpacing = constraints.respectTypeSpacing
        ? contentType.minSpacing
        : constraints.minSpacing ?? 0;
        
      if (!this.validateSpacing(position, instances, minSpacing)) continue;

      // Create and add instance
      instances.push({
        id: generateId(),
        typeId: contentType.id,
        position: position
      });
    }

    return instances;
  }
}
```

### 2. Clustered Distribution Strategy
```typescript
class ClusteredDistributor implements ContentDistributor {
  private generateClusterCenters(
    count: number,
    constraints: DistributionConstraints
  ): MapCoordinate[] {
    // Generate evenly spaced cluster centers
    const centers: MapCoordinate[] = [];
    const clusterCount = constraints.clusterCount ?? Math.ceil(count / 10);
    
    // Implementation details...
    return centers;
  }

  private distributeAroundCenter(
    center: MapCoordinate,
    radius: number,
    count: number,
    constraints: DistributionConstraints
  ): MapCoordinate[] {
    // Generate positions within cluster radius
    const positions: MapCoordinate[] = [];
    
    // Implementation details...
    return positions;
  }

  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): ContentInstance[] {
    // Generate cluster centers
    const centers = this.generateClusterCenters(count, constraints);
    
    // Distribute instances around centers
    const instances: ContentInstance[] = [];
    
    // Implementation details...
    return instances;
  }
}
```

### 3. Distribution Factory
```typescript
class DistributorFactory {
  private static distributors = new Map<string, ContentDistributor>([
    ['random', new RandomDistributor()],
    ['clustered', new ClusteredDistributor()]
  ]);

  static getDistributor(type: string): ContentDistributor {
    const distributor = this.distributors.get(type);
    if (!distributor) {
      throw new Error(`No distributor found for type: ${type}`);
    }
    return distributor;
  }

  static registerDistributor(type: string, distributor: ContentDistributor): void {
    this.distributors.set(type, distributor);
  }
}
```

## Usage Examples

### 1. Basic Random Distribution
```typescript
// Example 1: Basic distribution with custom spacing
const distributor = DistributorFactory.getDistributor('random');
const instances = distributor.distribute(contentType, 100, {
  mapImage: mapImage,
  alphaThreshold: 200,
  minSpacing: 50 // meters
});

// Example 2: Using content type's default spacing (e.g., Fast Travel)
const fastTravelInstances = distributor.distribute(fastTravelType, 25, {
  mapImage: mapImage,
  alphaThreshold: 200,
  respectTypeSpacing: true // Will use Fast Travel's 500m spacing
});
```

### 2. Clustered Distribution
```typescript
const distributor = DistributorFactory.getDistributor('clustered');
const instances = distributor.distribute(contentType, 100, {
  mapImage: mapImage,
  clusterCount: 5,
  clusterRadius: 200, // meters
  minSpacing: 20 // meters
});
```

## Best Practices

1. **Validation**
   - Always validate positions against map boundaries
   - Respect minimum spacing requirements
   - Consider content type-specific constraints
     - Some types have fixed spacing (e.g., Fast Travel: 500m)
     - Others may have variable spacing based on size
   - Implement reasonable attempt limits
   - Use respectTypeSpacing for content-aware distribution

2. **Performance**
   - Use efficient distance calculations
   - Consider spatial partitioning for large numbers of instances
   - Cache validation results when possible
   - Optimize cluster generation for large counts

3. **Extensibility**
   - Follow the ContentDistributor interface
   - Use the factory pattern for new strategies
   - Keep distribution logic separate from content types
   - Make constraints configurable

## Integration with Content System

The distribution system integrates with:

1. **ContentInstanceManager**
   - Stores generated instances
   - Provides access to existing instances
   - Handles instance lifecycle

2. **ContentTypePanel**
   - Provides UI for distribution settings
   - Shows distribution progress
   - Handles distribution errors

3. **Rendering System**
   - Visualizes distributed content
   - Provides debug visualization
   - Shows distribution patterns

## Future Considerations

1. **Additional Strategies**
   - Grid-based distribution
   - Path-based distribution
   - Perlin noise distribution
   - Custom distribution patterns

2. **Performance Optimizations**
   - Spatial partitioning
   - Parallel processing
   - Incremental distribution
   - Distribution caching

3. **Enhanced Features**
   - Distribution constraints by region
   - Dynamic redistribution
   - Distribution analytics
   - Pattern visualization
