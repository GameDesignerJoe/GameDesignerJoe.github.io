// Link Manager Module
// Manages temporary link expiration and automatic refresh

import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import config from '../config.js';

// Check if a link has expired or will expire soon
export function isLinkExpired(expiresAt, bufferMinutes = 5) {
  if (!expiresAt) return true;
  
  const now = Date.now();
  const buffer = bufferMinutes * 60 * 1000; // Convert to milliseconds
  
  return now >= (expiresAt - buffer);
}

// Calculate expiration timestamp for a new link (4 hours from now)
export function calculateExpiration() {
  return Date.now() + config.dropboxUrlExpiry;
}

// Check all stored links and find expired ones
export async function findExpiredLinks() {
  console.log('[LinkManager] Checking for expired links...');
  
  const folders = await storage.getAllFoldersWithMetadata();
  const expiredFolders = [];
  
  for (const folder of folders) {
    if (folder.coverImageUrl && isLinkExpired(folder.coverImageUrlExpiresAt)) {
      expiredFolders.push(folder);
    }
  }
  
  console.log(`[LinkManager] Found ${expiredFolders.length} folders with expired image links`);
  return expiredFolders;
}

// Refresh expired image links for a single folder
export async function refreshFolderImageLink(folder) {
  try {
    if (!folder.coverImagePath) {
      console.log('[LinkManager] No cover image path for folder:', folder.path);
      return folder;
    }
    
    console.log('[LinkManager] Refreshing image link for:', folder.name);
    
    // Get fresh temporary link from Dropbox
    const linkData = await dropbox.getTemporaryLink(folder.coverImagePath);
    
    // Update folder metadata with new link and expiration
    folder.coverImageUrl = linkData.link;
    folder.coverImageUrlExpiresAt = calculateExpiration();
    
    // Save updated metadata
    await storage.saveFolderMetadata(folder);
    
    console.log('[LinkManager] Image link refreshed for:', folder.name);
    return folder;
    
  } catch (error) {
    console.error('[LinkManager] Error refreshing image link for folder:', folder.path, error);
    return folder;
  }
}

// Refresh all expired links
export async function refreshExpiredLinks(progressCallback = null) {
  console.log('[LinkManager] Starting link refresh process...');
  
  try {
    const expiredFolders = await findExpiredLinks();
    
    if (expiredFolders.length === 0) {
      console.log('[LinkManager] No expired links found');
      return { refreshed: 0, failed: 0 };
    }
    
    let refreshed = 0;
    let failed = 0;
    
    for (let i = 0; i < expiredFolders.length; i++) {
      try {
        await refreshFolderImageLink(expiredFolders[i]);
        refreshed++;
        
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: expiredFolders.length,
            refreshed,
            failed
          });
        }
      } catch (error) {
        console.error('[LinkManager] Failed to refresh folder:', expiredFolders[i].path, error);
        failed++;
      }
    }
    
    console.log(`[LinkManager] Refresh complete: ${refreshed} succeeded, ${failed} failed`);
    return { refreshed, failed };
    
  } catch (error) {
    console.error('[LinkManager] Error during link refresh:', error);
    throw error;
  }
}

// Check and refresh links on startup
export async function performStartupCheck(showProgress = true) {
  console.log('[LinkManager] Performing startup link check...');
  
  try {
    const expiredFolders = await findExpiredLinks();
    
    if (expiredFolders.length === 0) {
      console.log('[LinkManager] All links are valid');
      return { needed: false, refreshed: 0 };
    }
    
    console.log(`[LinkManager] Found ${expiredFolders.length} expired links, refreshing...`);
    
    const result = await refreshExpiredLinks((progress) => {
      if (showProgress) {
        // Update loading message if function is available
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
          loadingMessage.innerHTML = `
            Refreshing library...
            <div class="loading-secondary">${progress.current} of ${progress.total} folders updated</div>
          `;
        }
      }
    });
    
    return { 
      needed: true, 
      refreshed: result.refreshed,
      failed: result.failed
    };
    
  } catch (error) {
    console.error('[LinkManager] Startup check failed:', error);
    return { needed: true, refreshed: 0, failed: 0, error };
  }
}

// Start background refresh timer (checks every 30 minutes)
let refreshTimer = null;

export function startBackgroundRefresh() {
  if (refreshTimer) {
    console.log('[LinkManager] Background refresh already running');
    return;
  }
  
  const intervalMinutes = 30;
  console.log(`[LinkManager] Starting background refresh (every ${intervalMinutes} minutes)`);
  
  refreshTimer = setInterval(async () => {
    console.log('[LinkManager] Running background link check...');
    
    try {
      const expiredFolders = await findExpiredLinks();
      
      if (expiredFolders.length > 0) {
        console.log(`[LinkManager] Background refresh: Found ${expiredFolders.length} expired links`);
        await refreshExpiredLinks();
      }
    } catch (error) {
      console.error('[LinkManager] Background refresh error:', error);
    }
  }, intervalMinutes * 60 * 1000);
}

export function stopBackgroundRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log('[LinkManager] Background refresh stopped');
  }
}

// Get fresh temporary link with error handling and retry
export async function getFreshTemporaryLink(path, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[LinkManager] Getting temporary link for: ${path} (attempt ${attempt})`);
      const linkData = await dropbox.getTemporaryLink(path);
      return {
        url: linkData.link,
        expiresAt: calculateExpiration()
      };
    } catch (error) {
      console.error(`[LinkManager] Error getting temporary link (attempt ${attempt}):`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export default {
  isLinkExpired,
  calculateExpiration,
  findExpiredLinks,
  refreshFolderImageLink,
  refreshExpiredLinks,
  performStartupCheck,
  startBackgroundRefresh,
  stopBackgroundRefresh,
  getFreshTemporaryLink
};
