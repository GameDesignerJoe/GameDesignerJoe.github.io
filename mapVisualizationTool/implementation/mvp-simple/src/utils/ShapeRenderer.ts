import { RenderStyle } from '../types/RenderStyle';

/**
 * Interface for shape rendering implementations
 */
export interface ShapeRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void;

  renderDebug?(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle,
    debugText?: string
  ): void;

  renderLabel?(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void;
}

/**
 * Base class providing common functionality for shape renderers
 */
abstract class BaseShapeRenderer implements ShapeRenderer {
  abstract render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void;

  protected applyStyle(ctx: CanvasRenderingContext2D, style: RenderStyle, size: number): void {
    // Save current context state
    ctx.save();

    // Apply basic styles
    ctx.fillStyle = style.fillColor;
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.lineWidth;
    ctx.globalAlpha = style.opacity;

    // Apply shadow if specified
    if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowBlur = style.shadow.blur;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
    }

    // Apply gradient if specified
    if (style.gradient) {
      const gradient = style.gradient.type === 'linear'
        ? ctx.createLinearGradient(-size/2, -size/2, size/2, size/2)
        : ctx.createRadialGradient(0, 0, 0, 0, 0, size/2);

      style.gradient.colors.forEach((color, index) => {
        gradient.addColorStop(style.gradient!.stops[index], color);
      });

      ctx.fillStyle = gradient;
    }
  }

  protected restoreContext(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  protected renderMinDistanceRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    if (!style.showMinDistanceRing || !style.minDistanceMeters) return;

    ctx.save();
    
    // Set up the style for the minimum distance ring
    ctx.strokeStyle = style.minDistanceRingColor || '#ffffff';
    ctx.lineWidth = 1;
    if (style.minDistanceRingStyle) {
      ctx.setLineDash([5, 5]); // Create dashed line
    }
    ctx.globalAlpha = 0.5;

    // Calculate the total radius (shape size + min distance)
    const shapeRadius = size / 2;
    const totalRadius = shapeRadius + style.minDistanceMeters;

    // Draw the ring
    ctx.beginPath();
    ctx.arc(x, y, totalRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  protected renderText(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    text: string,
    position: 'above' | 'below',
    style: {
      fontSize: number;
      textColor: string;
    }
  ): void {
    ctx.save();
    
    ctx.font = `${style.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = position === 'above' ? 'bottom' : 'top';
    
    // Measure text for background
    const metrics = ctx.measureText(text);
    const padding = 4;
    const textWidth = metrics.width;
    const textHeight = style.fontSize;
    const bgX = x - (textWidth / 2) - padding;
      const bgY = position === 'above' 
        ? y - size/2 - textHeight - padding * 2 - 10 // Move up by 10px
        : y + size/2 + padding * 2 + 5; // Add more padding below
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      bgX,
      bgY,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
    
    // Draw text
    ctx.fillStyle = style.textColor;
    ctx.fillText(
      text, 
      x, 
      position === 'above' 
        ? y - size/2 - padding - 10 // Move up by 10px
        : y + size/2 + textHeight + padding + 5 // Add more padding below
    );

    ctx.restore();
  }

  renderDebug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle,
    debugText?: string
  ): void {
    if (!style.showDebug) return;

    if (debugText) {
      this.renderText(ctx, x, y, size, debugText, 'below', {
        fontSize: style.debugFontSize || 12,
        textColor: style.debugTextColor || '#ffffff'
      });
    }
  }

  renderLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    if (!style.showLabel || !style.label) return;

    this.renderText(ctx, x, y, size, style.label, 'above', {
      fontSize: style.labelFontSize || 12,
      textColor: style.labelColor || '#ffffff'
    });
  }
}

/**
 * Circle shape renderer implementation
 */
export class CircleRenderer extends BaseShapeRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    this.applyStyle(ctx, style, size);

    ctx.beginPath();
    ctx.arc(x, y, size/2, 0, Math.PI * 2);
    ctx.fill();
    if (style.lineWidth > 0) {
      ctx.stroke();
    }

    this.restoreContext(ctx);
    
    // Render minimum distance ring if enabled
    this.renderMinDistanceRing(ctx, x, y, size, style);
  }
}

/**
 * Square shape renderer implementation
 */
export class SquareRenderer extends BaseShapeRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    this.applyStyle(ctx, style, size);

    const halfSize = size/2;
    ctx.fillRect(x - halfSize, y - halfSize, size, size);
    if (style.lineWidth > 0) {
      ctx.strokeRect(x - halfSize, y - halfSize, size, size);
    }

    this.restoreContext(ctx);
    
    // Render minimum distance ring if enabled
    this.renderMinDistanceRing(ctx, x, y, size, style);
  }

  protected renderMinDistanceRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    if (!style.showMinDistanceRing || !style.minDistanceMeters) return;

    ctx.save();
    
    // Set up the style for the minimum distance ring
    ctx.strokeStyle = style.minDistanceRingColor || '#ffffff';
    ctx.lineWidth = 1;
    if (style.minDistanceRingStyle) {
      ctx.setLineDash([5, 5]); // Create dashed line
    }
    ctx.globalAlpha = 0.5;

    // Calculate the total size (shape size + min distance * 2)
    const totalSize = size + (style.minDistanceMeters * 2);
    const halfTotalSize = totalSize / 2;

    // Draw the square ring
    ctx.strokeRect(x - halfTotalSize, y - halfTotalSize, totalSize, totalSize);

    ctx.restore();
  }
}

/**
 * Hexagon shape renderer implementation
 */
export class HexagonRenderer extends BaseShapeRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    this.applyStyle(ctx, style, size);

    const radius = size/2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const pointX = x + radius * Math.cos(angle);
      const pointY = y + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    ctx.fill();
    if (style.lineWidth > 0) {
      ctx.stroke();
    }

    this.restoreContext(ctx);
    
    // Render minimum distance ring if enabled
    this.renderMinDistanceRing(ctx, x, y, size, style);
  }

  protected renderMinDistanceRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle
  ): void {
    if (!style.showMinDistanceRing || !style.minDistanceMeters) return;

    ctx.save();
    
    // Set up the style for the minimum distance ring
    ctx.strokeStyle = style.minDistanceRingColor || '#ffffff';
    ctx.lineWidth = 1;
    if (style.minDistanceRingStyle) {
      ctx.setLineDash([5, 5]); // Create dashed line
    }
    ctx.globalAlpha = 0.5;

    // Calculate the total radius (shape size + min distance)
    const radius = size / 2;
    const totalRadius = radius + style.minDistanceMeters;

    // Draw the hexagonal ring
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const pointX = x + totalRadius * Math.cos(angle);
      const pointY = y + totalRadius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Factory for creating shape renderers
 */
export class ShapeRendererFactory {
  private static renderers: Map<string, ShapeRenderer> = new Map([
    ['circle', new CircleRenderer()],
    ['square', new SquareRenderer()],
    ['hexagon', new HexagonRenderer()]
  ]);

  static getRenderer(shape: string): ShapeRenderer {
    const renderer = this.renderers.get(shape);
    if (!renderer) {
      throw new Error(`No renderer found for shape: ${shape}`);
    }
    return renderer;
  }

  static registerRenderer(shape: string, renderer: ShapeRenderer): void {
    this.renderers.set(shape, renderer);
  }
}
