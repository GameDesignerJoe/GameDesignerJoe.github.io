// Cache Manager Module
// Manages image caching using Cache API for faster loading and offline support

import * as dropbox from './dropbox.js';

const CACHE_NAME = 'music-player-images-v1';
const CACHE_PREFIX = 'image:';

// Check if Cache API is available
export function isCacheSupported() {
  return 'caches' in window;
}

// Generate cache key from Dropbox path
function getCacheKey(path) {
  return `${CACHE_PREFIX}${path}`;
}

// Check if an image is cached
export async function isImageCached(path) {
  if (!isCacheSupported()) return false;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getCacheKey(path);
    const response = await cache.match(cacheKey);
    return !!response;
  } catch (error) {
    console.error('[CacheManager] Error checking cache:', error);
    return false;
  }
}

// Get cached image
export async function getCachedImage(path) {
  if (!isCacheSupported()) return null;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getCacheKey(path);
    const response = await cache.match(cacheKey);
    
    if (response) {
      console.log('[CacheManager] Cache HIT:', path);
      return response;
    }
    
    console.log('[CacheManager] Cache MISS:', path);
    return null;
  } catch (error) {
    console.error('[CacheManager] Error getting cached image:', error);
    return null;
  }
}

// Cache an image from a temporary URL
export async function cacheImage(path, temporaryUrl) {
  if (!isCacheSupported()) {
    console.warn('[CacheManager] Cache API not supported');
    return false;
  }
  
  try {
    console.log('[CacheManager] Caching image:', path);
    
    // Fetch the image data from Dropbox temporary URL
    const response = await fetch(temporaryUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Clone the response because we can only read it once
    const responseToCache = response.clone();
    
    // Store in cache
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getCacheKey(path);
    await cache.put(cacheKey, responseToCache);
    
    console.log('[CacheManager] Image cached successfully:', path);
    return true;
    
  } catch (error) {
    console.error('[CacheManager] Error caching image:', path, error);
    return false;
  }
}

// Get image URL (from cache or fetch and cache)
export async function getImageUrl(path, temporaryUrl = null) {
  try {
    // First, try to get from cache
    const cachedResponse = await getCachedImage(path);
    
    if (cachedResponse) {
      // Return blob URL from cached response
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }
    
    // Not cached, need to fetch
    if (!temporaryUrl) {
      console.log('[CacheManager] No temporary URL provided, fetching from Dropbox');
      const linkData = await dropbox.getTemporaryLink(path);
      temporaryUrl = linkData.link;
    }
    
    // Fetch and cache the image
    const response = await fetch(temporaryUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Cache it for future use
    if (isCacheSupported()) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = getCacheKey(path);
      await cache.put(cacheKey, response.clone());
      console.log('[CacheManager] Image fetched and cached:', path);
    }
    
    // Return blob URL for immediate use
    const blob = await response.blob();
    return URL.createObjectURL(blob);
    
  } catch (error) {
    console.error('[CacheManager] Error getting image URL:', path, error);
    return null;
  }
}

// Pre-cache multiple images (batch operation)
export async function preCacheImages(imageData) {
  if (!isCacheSupported()) {
    console.warn('[CacheManager] Cache API not supported');
    return { cached: 0, failed: 0 };
  }
  
  console.log(`[CacheManager] Pre-caching ${imageData.length} images...`);
  
  let cached = 0;
  let failed = 0;
  
  for (const { path, temporaryUrl } of imageData) {
    try {
      const success = await cacheImage(path, temporaryUrl);
      if (success) {
        cached++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('[CacheManager] Failed to cache:', path, error);
      failed++;
    }
  }
  
  console.log(`[CacheManager] Pre-cache complete: ${cached} cached, ${failed} failed`);
  return { cached, failed };
}

// Clear specific image from cache
export async function clearImageCache(path) {
  if (!isCacheSupported()) return false;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = getCacheKey(path);
    const deleted = await cache.delete(cacheKey);
    
    if (deleted) {
      console.log('[CacheManager] Image removed from cache:', path);
    }
    
    return deleted;
  } catch (error) {
    console.error('[CacheManager] Error clearing image cache:', error);
    return false;
  }
}

// Clear all cached images
export async function clearAllImageCache() {
  if (!isCacheSupported()) return false;
  
  try {
    const deleted = await caches.delete(CACHE_NAME);
    console.log('[CacheManager] All image cache cleared');
    return deleted;
  } catch (error) {
    console.error('[CacheManager] Error clearing all cache:', error);
    return false;
  }
}

// Get cache statistics
export async function getCacheStats() {
  if (!isCacheSupported()) {
    return { supported: false, count: 0, size: 0 };
  }
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    let totalSize = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    return {
      supported: true,
      count: keys.length,
      size: totalSize,
      sizeFormatted: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('[CacheManager] Error getting cache stats:', error);
    return { supported: true, count: 0, size: 0, error: error.message };
  }
}

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Cleanup old cache versions
export async function cleanupOldCaches() {
  if (!isCacheSupported()) return;
  
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => 
      name.startsWith('music-player-images-') && name !== CACHE_NAME
    );
    
    for (const cacheName of oldCaches) {
      await caches.delete(cacheName);
      console.log('[CacheManager] Deleted old cache:', cacheName);
    }
  } catch (error) {
    console.error('[CacheManager] Error cleaning up old caches:', error);
  }
}

export default {
  isCacheSupported,
  isImageCached,
  getCachedImage,
  cacheImage,
  getImageUrl,
  preCacheImages,
  clearImageCache,
  clearAllImageCache,
  getCacheStats,
  cleanupOldCaches
};
