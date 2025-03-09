/**
 * Interface defining the style options for rendering content shapes
 */
export interface RenderStyle {
  // Basic style properties
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  opacity: number;

  // State indicators
  selected?: boolean;
  highlighted?: boolean;
  
  // Debug visualization options
  showDebug?: boolean;
  debugColor?: string;
  debugTextColor?: string;
  debugFontSize?: number;
  
  // Label options
  showLabel?: boolean;
  label?: string;
  labelColor?: string;
  labelFontSize?: number;

  // Minimum distance visualization
  showMinDistanceRing?: boolean;
  minDistanceMeters?: number;
  minDistanceRingColor?: string;
  minDistanceRingStyle?: string; // For dashed lines
  
  // Optional shadow effects
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  
  // Optional gradient fill
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    stops: number[];  // Values between 0 and 1
  };
}

/**
 * Default render style that can be extended
 */
export const DEFAULT_RENDER_STYLE: RenderStyle = {
  fillColor: '#3498db',
  strokeColor: '#2980b9',
  lineWidth: 2,
  opacity: 1,
  selected: false,
  highlighted: false,
  showDebug: false,
  debugColor: '#ffffff',
  debugTextColor: '#ffffff',
  debugFontSize: 12,
  labelColor: '#ffffff',
  labelFontSize: 12
};

/**
 * Helper function to merge a partial style with the default style
 */
export function createRenderStyle(style: Partial<RenderStyle>): RenderStyle {
  return {
    ...DEFAULT_RENDER_STYLE,
    ...style
  };
}

/**
 * Helper function to create a highlighted version of a style
 */
export function createHighlightedStyle(baseStyle: RenderStyle): RenderStyle {
  return {
    ...baseStyle,
    highlighted: true,
    opacity: Math.min(1, baseStyle.opacity + 0.2),
    lineWidth: baseStyle.lineWidth + 1,
    shadow: {
      color: 'rgba(255, 255, 255, 0.5)',
      blur: 10,
      offsetX: 0,
      offsetY: 0
    }
  };
}

/**
 * Helper function to create a selected version of a style
 */
export function createSelectedStyle(baseStyle: RenderStyle): RenderStyle {
  return {
    ...baseStyle,
    selected: true,
    strokeColor: '#f1c40f', // Highlight color
    lineWidth: baseStyle.lineWidth + 2,
    shadow: {
      color: 'rgba(241, 196, 15, 0.5)',
      blur: 15,
      offsetX: 0,
      offsetY: 0
    }
  };
}
