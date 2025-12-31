// Image Retry Manager - Smart retry system for Steam images
// Tracks failed images and retries at strategic moments

import { SteamGame } from '@/types/steam';

// Track which games have failed image loads
const failedImages = new Set<number>();
const successfulRetries = new Set<number>();

/**
 * Mark a game's image as failed
 */
export function markImageAsFailed(appId: number) {
  failedImages.add(appId);
  console.log(`[Image Retry] Marked ${appId} as failed (${failedImages.size} total failures)`);
}

/**
 * Check if a game's image has failed
 */
export function hasImageFailed(appId: number): boolean {
  return failedImages.has(appId);
}

/**
 * Clear failed status (when retry succeeds)
 */
export function markImageAsSuccess(appId: number) {
  failedImages.delete(appId);
  successfulRetries.add(appId);
  console.log(`[Image Retry] ✅ Successfully loaded image for ${appId} on retry!`);
}

/**
 * Get list of all failed image app IDs
 */
export function getFailedImages(): number[] {
  return Array.from(failedImages);
}

/**
 * Get stats about image loading
 */
export function getImageStats() {
  return {
    failed: failedImages.size,
    retried: successfulRetries.size,
  };
}

/**
 * Retry loading an image for a specific game
 * Returns promise that resolves with success boolean
 */
export async function retryImageLoad(appId: number): Promise<boolean> {
  if (!hasImageFailed(appId)) {
    return true; // Already successful
  }

  console.log(`[Image Retry] Attempting retry for game ${appId}...`);

  return new Promise((resolve) => {
    const img = new Image();
    const imageUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
    
    // Set a timeout for the image load
    const timeout = setTimeout(() => {
      console.log(`[Image Retry] Timeout for ${appId}`);
      resolve(false);
    }, 5000); // 5 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      markImageAsSuccess(appId);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      console.log(`[Image Retry] Failed again for ${appId}`);
      resolve(false);
    };

    img.src = imageUrl;
  });
}

/**
 * Retry loading images for multiple games
 * Returns array of app IDs that succeeded
 */
export async function retryMultipleImages(appIds: number[]): Promise<number[]> {
  console.log(`[Image Retry] Batch retry for ${appIds.length} games...`);
  
  // Filter to only retry failed images
  const toRetry = appIds.filter(id => hasImageFailed(id));
  
  if (toRetry.length === 0) {
    console.log(`[Image Retry] No failed images to retry`);
    return [];
  }

  console.log(`[Image Retry] Retrying ${toRetry.length} failed images...`);
  
  // Retry all in parallel
  const results = await Promise.all(
    toRetry.map(async (appId) => ({
      appId,
      success: await retryImageLoad(appId),
    }))
  );

  const succeeded = results.filter(r => r.success).map(r => r.appId);
  
  console.log(`[Image Retry] Batch complete: ${succeeded.length}/${toRetry.length} succeeded`);
  
  return succeeded;
}

/**
 * KEY MOMENT: When game is unlocked (Pool 2 → Pool 1)
 */
export async function retryOnUnlock(game: SteamGame): Promise<boolean> {
  console.log(`[Image Retry] 🔓 Game unlocked: ${game.name} - checking image...`);
  return await retryImageLoad(game.appid);
}

/**
 * KEY MOMENT: When game is drawn for shop
 */
export async function retryOnDraw(game: SteamGame): Promise<boolean> {
  console.log(`[Image Retry] 🎰 Game drawn: ${game.name} - checking image...`);
  return await retryImageLoad(game.appid);
}

/**
 * KEY MOMENT: When game is selected as featured
 */
export async function retryOnFeatured(game: SteamGame): Promise<boolean> {
  console.log(`[Image Retry] ⭐ Game featured: ${game.name} - checking image...`);
  return await retryImageLoad(game.appid);
}

/**
 * Reset all tracking (for testing or new session)
 */
export function resetImageTracking() {
  failedImages.clear();
  successfulRetries.clear();
  console.log(`[Image Retry] Tracking reset`);
}
