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

  renderDebug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: RenderStyle,
    debugText?: string
  ): void {
    if (!style.showDebug) return;

    ctx.save();
    
    // Draw debug outline
    ctx.strokeStyle = style.debugColor || '#ff0000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    ctx.setLineDash([]);

    // Draw debug text
    if (debugText) {
      ctx.font = `${style.debugFontSize || 12}px Arial`;
      ctx.fillStyle = style.debugTextColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(debugText, x, y - size/2 - 5);
    }

    ctx.restore();
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
