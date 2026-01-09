# Link Management & Caching System

## Overview

This document explains the link management and image caching system implemented to solve Dropbox temporary link expiration issues. The system ensures users never need to re-authenticate or clear data due to expired links.

## Problem Statement

Dropbox temporary links (from `files/get_temporary_link`) expire after 4 hours. This caused:
- Broken images after returning to the app
- Songs failing to play after extended periods
- Users needing to clear data and re-authenticate
- Poor user experience

## Solution Architecture

### 1. **Link Expiration Tracking**
All temporary links now include an expiration timestamp, allowing the system to proactively detect and refresh expired links.

### 2. **Automatic Link Refresh**
- **Startup Check**: On app launch, expired links are automatically refreshed
- **Background Refresh**: Every 30 minutes, links are checked and refreshed proactively
- **Playback Retry**: If audio playback fails, it automatically retries with a fresh link

### 3. **Image Caching**
- Cover art images are cached locally using the Cache API
- Once cached, images load instantly and never expire
- No need to regenerate temporary URLs for cached images
- Supports offline viewing of cached images

## Implementation Details

### Core Modules

#### `link-manager.js`
Central link management system:
- `isLinkExpired(expiresAt, bufferMinutes)` - Check if a link has expired
- `calculateExpiration()` - Calculate expiration timestamp (4 hours from now)
- `findExpiredLinks()` - Scan all stored links for expired ones
- `refreshExpiredLinks(progressCallback)` - Refresh all expired links
- `performStartupCheck(showProgress)` - Run on app startup
- `startBackgroundRefresh()` - Start 30-minute refresh timer
- `getFreshTemporaryLink(path, retries)` - Get fresh link with retry logic

#### `cache-manager.js`
Image caching using Cache API:
- `isImageCached(path)` - Check if image is in cache
- `getCachedImage(path)` - Retrieve cached image
- `cacheImage(path, temporaryUrl)` - Download and cache an image
- `getImageUrl(path, temporaryUrl)` - Get image (from cache or fetch)
- `preCacheImages(imageData)` - Batch cache multiple images
- `clearImageCache(path)` / `clearAllImageCache()` - Cache management
- `getCacheStats()` - Get cache size and statistics
- `cleanupOldCaches()` - Remove old cache versions

### Integration Points

#### `scanner.js` (Updated)
When scanning folders for metadata:
```javascript
// Check if image is already cached
const isCached = await cacheManager.isImageCached(coverImagePath);

if (isCached) {
  // Use cached version
  coverImageUrl = await cacheManager.getImageUrl(coverImagePath);
} else {
  // Get temporary link and cache it
  const linkData = await dropbox.getTemporaryLink(coverImagePath);
  coverImageUrl = linkData.link;
  coverImageUrlExpiresAt = linkManager.calculateExpiration();
  
  // Cache in background
  cacheManager.cacheImage(coverImagePath, coverImageUrl);
}
```

#### `app.js` (Updated)
On app initialization:
```javascript
// Perform startup link refresh check
await performStartupLinkCheck();

// Start background refresh timer
linkManager.startBackgroundRefresh();

// Cleanup old cache versions
cacheManager.cleanupOldCaches();
```

#### `player.js` (Updated)
Audio playback with automatic retry:
```javascript
// Error handler with automatic retry
audio.addEventListener('error', async (e) => {
  if (!playerState.retryAttempted && playerState.currentTrack) {
    playerState.retryAttempted = true;
    showToast('Retrying with fresh link...', 'info');
    await playTrack(playerState.currentTrack, true); // Retry
    return;
  }
  
  // If retry failed
  showToast('Playback error. Please try another track.', 'error');
});
```

#### `storage.js` (Schema Update)
Folder metadata now includes:
```javascript
{
  path: string,
  name: string,
  coverImagePath: string,
  coverImageUrl: string,
  coverImageUrlExpiresAt: number,  // NEW: Timestamp
  songCount: number,
  subfolders: array,
  lastScanned: number,
  addedAt: number
}
```

## User Experience

### Before Implementation
1. User opens app after 4+ hours
2. All images are broken (404 errors)
3. Songs won't play (expired links)
4. User must delete app data and re-authenticate
5. Must re-scan all music folders
6. Poor experience, data loss

### After Implementation
1. User opens app after 4+ hours (or days)
2. Brief "Refreshing library..." message (2-3 seconds)
3. All images appear instantly (from cache)
4. Songs play normally (fresh links generated)
5. Background refresh keeps links fresh
6. Seamless experience, no data loss

## Performance Optimizations

### Startup Performance
- Links only refresh if expired (not every startup)
- Progress callback shows update status
- Cache hits are instant (no network request)

### Memory Efficiency
- Images stored in Cache API (browser-managed storage)
- Old cache versions automatically cleaned up
- Blob URLs properly released when no longer needed

### Network Efficiency
- Cached images: Zero network requests
- Background refresh: Spreads load over time
- Retry logic: Minimizes failed requests

## Multi-Cloud Compatibility

This architecture is cloud-agnostic and will scale to:

### Google Drive
- Typical link expiration: 1 hour
- Simply adjust `dropboxUrlExpiry` in config
- Same link-manager logic applies

### OneDrive
- Link expiration varies by type
- Provider-specific expiration handling
- Unified interface via StorageProvider pattern

### Future Implementation
```javascript
class StorageProvider {
  async getTemporaryLink(path) { }
  getLinkExpiration() { }
  async listFolder(path) { }
}

class DropboxProvider extends StorageProvider {
  getLinkExpiration() { return 4 * 60 * 60 * 1000; } // 4 hours
}

class GoogleDriveProvider extends StorageProvider {
  getLinkExpiration() { return 1 * 60 * 60 * 1000; } // 1 hour
}
```

## Configuration

### `config.js`
```javascript
{
  dropboxUrlExpiry: 4 * 60 * 60 * 1000, // 4 hours
  // Future: googleDriveUrlExpiry, oneDriveUrlExpiry, etc.
}
```

### Cache API
- Cache name: `'music-player-images-v1'`
- Versioned for easy cache invalidation
- Old versions auto-cleaned on startup

## Testing Checklist

### Basic Functionality
- [ ] Fresh app load works correctly
- [ ] Images display on first scan
- [ ] Songs play normally
- [ ] Queue functionality works

### Link Expiration Scenarios
- [ ] Return after 4+ hours → links auto-refresh
- [ ] Startup check detects expired links
- [ ] Expired images are refreshed
- [ ] Songs with expired links retry automatically

### Caching
- [ ] Images cache on first load
- [ ] Cached images load instantly on subsequent views
- [ ] Cache stats show correct size/count
- [ ] Old cache versions are cleaned up

### Error Handling
- [ ] Playback error triggers automatic retry
- [ ] Retry with fresh link succeeds
- [ ] Offline mode shows cached images
- [ ] Network errors handled gracefully

### Background Operations
- [ ] Background refresh runs every 30 minutes
- [ ] Proactive refresh prevents expiration
- [ ] Doesn't interfere with user actions
- [ ] Logs show refresh activity

## Monitoring & Debugging

### Console Logs
All modules use prefixed logging:
- `[LinkManager]` - Link management operations
- `[CacheManager]` - Caching operations
- `[Player]` - Playback and retry attempts
- `[Scanner]` - Folder scanning and image processing
- `[App]` - Startup checks and initialization

### Cache Statistics
Check cache status in console:
```javascript
const stats = await cacheManager.getCacheStats();
console.log(stats);
// { supported: true, count: 45, size: 2348576, sizeFormatted: "2.24 MB" }
```

### Link Status
Check for expired links:
```javascript
const expiredFolders = await linkManager.findExpiredLinks();
console.log(`Found ${expiredFolders.length} expired links`);
```

## Troubleshooting

### Problem: Images still broken after refresh
**Solution**: Clear cache and rescan
```javascript
await cacheManager.clearAllImageCache();
// Then rescan folders
```

### Problem: Background refresh not running
**Solution**: Check if timer is active
```javascript
// Stop and restart
linkManager.stopBackgroundRefresh();
linkManager.startBackgroundRefresh();
```

### Problem: Songs won't play even after retry
**Solution**: Check OAuth token validity
- Dropbox token may be actually revoked
- User needs to re-authenticate
- This is different from link expiration

### Problem: Cache using too much space
**Solution**: Clear old cache entries
```javascript
const stats = await cacheManager.getCacheStats();
if (stats.size > 50 * 1024 * 1024) { // 50MB
  await cacheManager.clearAllImageCache();
}
```

## Future Enhancements

### Planned Features
1. **Smart Pre-caching**: Pre-cache images for folders user views frequently
2. **Cache Limits**: Automatic cleanup when cache exceeds size limit
3. **Offline Mode**: Full offline playback support (cache audio files)
4. **Link Pre-generation**: Pre-generate links for upcoming queue tracks
5. **Analytics**: Track cache hit rate and refresh frequency

### Multi-Cloud Support
When adding Google Drive and OneDrive:
1. Create provider-specific classes
2. Implement provider-specific link expiration
3. Unified interface via base StorageProvider class
4. Link manager handles all providers uniformly

## Maintenance

### Regular Tasks
- Monitor cache size growth
- Review background refresh logs
- Check for failed refresh attempts
- Update cache version when schema changes

### Version Updates
When updating cache structure:
1. Increment cache version: `'music-player-images-v2'`
2. `cleanupOldCaches()` will remove v1
3. Images will re-cache on first access

## Summary

The link management and caching system provides:
✅ **Zero re-authentication**: OAuth tokens remain valid
✅ **Automatic recovery**: Expired links refresh automatically  
✅ **Instant loading**: Cached images load immediately
✅ **Seamless experience**: Users never notice link expiration
✅ **Multi-cloud ready**: Architecture supports multiple providers
✅ **Offline capable**: Cached content works offline

Users can now:
- Leave the app for days/weeks
- Return without any setup required
- See all images instantly
- Play songs without issues
- Never clear data or re-authenticate

This transforms the app from requiring constant maintenance to being truly set-and-forget.
