import { ContentTypeBase } from '../types/ContentTypes';
import { ContentInstance } from './ContentInstanceManager';
import { ShapeRendererFactory } from './ShapeRenderer';
import { RenderStyle, createRenderStyle, createHighlightedStyle, createSelectedStyle } from '../types/RenderStyle';

/**
 * Configuration for the content renderer
 */
export interface RenderConfig {
  canvasWidth: number;
  canvasHeight: number;
  mapWidthKm: number;
  mapHeightKm: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
}

/**
 * Handles rendering of all content instances
 */
export class ContentRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(ctx: CanvasRenderingContext2D, config: RenderConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  /**
   * Update the rendering configuration
   */
  updateConfig(config: RenderConfig): void {
    this.config = config;
  }

  /**
   * Convert normalized coordinates (0-1) to screen coordinates
   */
  private normalizedToScreen(x: number, y: number): { x: number; y: number } {
    // Calculate map dimensions in meters
    const mapWidthMeters = this.config.mapWidthKm * 1000;
    const mapHeightMeters = this.config.mapHeightKm * 1000;

    // Calculate base scale that preserves aspect ratio
    const baseScale = Math.min(
      this.config.canvasWidth / mapWidthMeters,
      this.config.canvasHeight / mapHeightMeters
    );

    // Calculate base dimensions at zoom level 1
    const baseWidth = mapWidthMeters * baseScale;
    const baseHeight = mapHeightMeters * baseScale;

    // Apply zoom to get final dimensions
    const scaledWidth = baseWidth * this.config.zoomLevel;
    const scaledHeight = baseHeight * this.config.zoomLevel;

    // Calculate center offset
    const centerOffsetX = (this.config.canvasWidth - scaledWidth) / 2;
    const centerOffsetY = (this.config.canvasHeight - scaledHeight) / 2;

    // Convert normalized coordinates to screen coordinates
    return {
      x: centerOffsetX + this.config.panOffset.x + (x * scaledWidth),
      y: centerOffsetY + this.config.panOffset.y + (y * scaledHeight)
    };
  }

  /**
   * Calculate the screen size for a given size in meters
   */
  private metersToScreenSize(meters: number): number {
    const mapWidthMeters = this.config.mapWidthKm * 1000;
    const baseScale = this.config.canvasWidth / mapWidthMeters;
    return meters * baseScale * this.config.zoomLevel;
  }

  /**
   * Create a render style for a content instance
   */
  private createInstanceStyle(
    contentType: ContentTypeBase,
    instance: ContentInstance
  ): RenderStyle {
    let style = createRenderStyle({
      fillColor: contentType.color,
      strokeColor: contentType.color,
      lineWidth: 2,
      opacity: instance.properties?.opacity ?? contentType.opacity ?? 0.8
    });

    // Apply instance-specific properties
    if (instance.properties) {
      if (instance.properties.selected) {
        style = createSelectedStyle(style);
      }
      if (instance.properties.highlighted) {
        style = createHighlightedStyle(style);
      }
      if (instance.properties.showDebug) {
        style = {
          ...style,
          showDebug: true,
          debugColor: '#ffffff',
          debugTextColor: '#ffffff'
        };
      }
    }

    return style;
  }

  /**
   * Render a single content instance
   */
  renderInstance(instance: ContentInstance, contentType: ContentTypeBase): void {
    // Get the appropriate shape renderer
    const renderer = ShapeRendererFactory.getRenderer(contentType.shape);

    // Convert normalized position to screen coordinates
    const screenPos = this.normalizedToScreen(
      instance.position.x,
      instance.position.y
    );

    // Calculate screen size
    const sizeMeters = instance.properties?.sizeMeters || contentType.size;
    const screenSize = this.metersToScreenSize(sizeMeters);

    // Create render style
    const style = this.createInstanceStyle(contentType, instance);

    // Render the shape
    renderer.render(
      this.ctx,
      screenPos.x,
      screenPos.y,
      screenSize,
      style
    );

    // Render debug information if enabled
    if (style.showDebug) {
      const debugText = `${instance.id}\n(${instance.position.x.toFixed(2)}, ${instance.position.y.toFixed(2)})`;
      renderer.renderDebug?.(
        this.ctx,
        screenPos.x,
        screenPos.y,
        screenSize,
        style,
        debugText
      );
    }
  }

  /**
   * Render multiple instances of the same content type
   */
  renderInstances(instances: ContentInstance[], contentType: ContentTypeBase): void {
    instances.forEach(instance => this.renderInstance(instance, contentType));
  }
}
