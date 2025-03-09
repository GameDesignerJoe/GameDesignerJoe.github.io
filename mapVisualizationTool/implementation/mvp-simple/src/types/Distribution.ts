import { ContentTypeBase } from './ContentTypes';
import { ContentInstance } from '../utils/ContentInstanceManager';

/**
 * Interface for content distribution strategies
 */
export interface ContentDistributor {
  distribute(
    contentType: ContentTypeBase,
    count: number,
    constraints: DistributionConstraints
  ): ContentInstance[];
}

/**
 * Configuration options for content distribution
 */
export interface DistributionConstraints {
  // Map boundaries and validation
  mapImage: HTMLImageElement;
  alphaThreshold?: number; // Default 200
  
  // Spacing constraints
  minSpacing?: number; // In meters
  respectTypeSpacing?: boolean; // Use contentType.minSpacing
  
  // Distribution parameters
  maxAttempts?: number; // Default count * 10
  clusterCount?: number; // For clustered distribution
  clusterRadius?: number; // For clustered distribution
}

/**
 * Result of a distribution operation
 */
export interface DistributionResult {
  instances: ContentInstance[];
  success: boolean;
  message?: string;
  attempts: number;
}

/**
 * Available distribution strategies
 */
export type DistributionStrategy = 'random' | 'clustered';

/**
 * Helper function to calculate distance between two points in meters
 */
export function calculateDistanceInMeters(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
  mapWidthKm: number,
  mapHeightKm: number
): number {
  // Convert normalized coordinates to meters
  const widthMeters = mapWidthKm * 1000;
  const heightMeters = mapHeightKm * 1000;
  
  const x1 = point1.x * widthMeters;
  const y1 = point1.y * heightMeters;
  const x2 = point2.x * widthMeters;
  const y2 = point2.y * heightMeters;
  
  // Calculate Euclidean distance
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Helper function to validate transparency at a position
 */
export function validateTransparency(
  position: { x: number; y: number },
  mapImage: HTMLImageElement,
  threshold: number = 200
): boolean {
  // Create temporary canvas for image analysis
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  
  // Set canvas size to match image
  canvas.width = mapImage.width;
  canvas.height = mapImage.height;
  
  // Draw image
  ctx.drawImage(mapImage, 0, 0);
  
  // Convert normalized coordinates to image coordinates
  const imgX = Math.floor(position.x * mapImage.width);
  const imgY = Math.floor(position.y * mapImage.height);
  
  // Get pixel data
  const pixel = ctx.getImageData(imgX, imgY, 1, 1).data;
  
  // Check alpha value
  return pixel[3] > threshold;
}

/**
 * Helper function to generate a unique ID for instances
 */
export function generateInstanceId(): string {
  return Math.random().toString(36).substr(2, 9);
}
