// Content type base interface
export interface ContentTypeBase {
  // Basic identification
  id: string;
  name: string;
  category: ContentCategory;
  description: string;

  // Visual properties
  color: string;
  shape: ContentShape;
  size: number; // diameter in meters
  opacity?: number; // opacity value between 0 and 1
  borderSize?: number; // border width in pixels
  borderColor?: string; // border color
  label?: string; // text label for the shape
  showLabel?: boolean; // whether to display the label

  // Distribution properties
  quantity: number;
  minSpacing: number; // minimum distance between same type in meters
  canOverlap: boolean;
  mapWidthKm?: number; // map width in kilometers
  mapHeightKm?: number; // map height in kilometers

  // Instance properties
  defaultProperties?: Record<string, any>; // default properties for new instances
}

// Enemy-specific interface
export interface EnemyContentType extends ContentTypeBase {
  category: 'Combat';
  enemyCount: number; // Number of enemies in this encounter (3-5 for small camps)
  difficulty: number; // 1-10 scale
}

// Content categories
export type ContentCategory = 'Combat' | 'Exploration' | 'Resource';

// Available shapes
export type ContentShape = 'circle' | 'square' | 'hexagon';

// Default values for new enemy content
export const defaultEnemyContent: EnemyContentType = {
  id: '',
  name: 'New Enemy Camp',
  category: 'Combat',
  description: 'A group of enemies',
  color: '#FF0000',
  shape: 'circle',
  size: 15, // 15 meters diameter
  quantity: 1,
  minSpacing: 100, // 100 meters minimum spacing
  canOverlap: false,
  enemyCount: 3,
  difficulty: 3
};
