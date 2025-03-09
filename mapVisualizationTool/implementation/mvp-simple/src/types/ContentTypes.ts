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

  // Minimum distance visualization
  showMinDistanceRing?: boolean;
  minDistanceMeters?: number;
  minDistanceRingColor?: string;
  minDistanceRingStyle?: string;
}

// Enemy-specific interface
export interface EnemyContentType extends ContentTypeBase {
  category: 'Combat';
  enemyCount: number; // Number of enemies in this encounter (3-5 for small camps)
  difficulty: number; // 1-10 scale
}

// Content categories
export type ContentCategory = 
  | 'Debug'
  | 'Combat'
  | 'Exploration'
  | 'Resource'
  | 'Mission'
  | 'Travel'
  | 'Restoration';

// Content type identifiers
export type ContentTypeId = 
  | 'Debug'
  | 'Enemies'
  | 'PointOfInterest'
  | 'MissionLocation'
  | 'Start'
  | 'FastTravel'
  | 'Restoration';

// Interface for content type defaults including quantity and spacing
interface ContentTypeDefaults extends Partial<ContentTypeBase> {
  defaultQuantity?: number;
  defaultMinDistance?: number;
}

// Default properties for each content type
export const contentTypeDefaults: Record<ContentTypeId, ContentTypeDefaults> = {
  Debug: {
    color: '#0000FF',
    shape: 'circle',
    size: 10,
    opacity: 1.0,
    category: 'Debug',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 100,
    label: 'Debug',
    showLabel: true
  },
  Enemies: {
    color: '#FF0000',
    shape: 'circle',
    size: 15,
    opacity: 0.8,
    category: 'Combat',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 100,
    label: 'Enemies',
    showLabel: true
  },
  PointOfInterest: {
    color: '#00BFFF',
    shape: 'hexagon',
    size: 50,
    opacity: 0.9,
    category: 'Exploration',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 100,
    defaultMinDistance: 200,
    label: 'Point of Interest',
    showLabel: true
  },
  MissionLocation: {
    color: '#FFD700',
    shape: 'hexagon',
    size: 40,
    opacity: 0.9,
    category: 'Mission',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 20,
    defaultMinDistance: 400,
    label: 'Mission Location',
    showLabel: true
  },
  Start: {
    color: '#32CD32',
    shape: 'diamond',
    size: 100,
    opacity: 1.0,
    category: 'Travel',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 1,
    label: 'Start',
    showLabel: true
  },
  FastTravel: {
    color: '#9370DB',
    shape: 'hexagon',
    size: 25,
    opacity: 0.9,
    category: 'Travel',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 25,
    defaultMinDistance: 400,
    label: 'Fast Travel',
    showLabel: true
  },
  Restoration: {
    color: '#00FFFF',
    shape: 'square',
    size: 50,
    opacity: 0.8,
    category: 'Restoration',
    borderSize: 1,
    borderColor: '#000000',
    defaultQuantity: 50,
    defaultMinDistance: 20,
    label: 'Restoration',
    showLabel: true
  }
};

// Available shapes
export type ContentShape = 'circle' | 'square' | 'hexagon' | 'diamond';

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
