// Scanner Module
// Scans selected folders for audio files and adds them to the library

import config from '../config.js';
import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as cacheManager from './cache-manager.js';
import * as linkManager from './link-manager.js';
import * as localFiles from './local-files.js';
import * as id3Reader from './id3-reader.js';
import * as utils from './utils.js';
import { showToast, showScreen } from './app.js';

let isScanning = false;
let scanProgress = {
  foldersScanned: 0,
  totalFolders: 0,
  filesFound: 0,
  currentFolder: ''
};

// Get device-optimized settings
const deviceSettings = utils.getDeviceOptimizedSettings();
console.log('[Scanner] Device settings:', deviceSettings);

// Scan selected folders for audio files (with throttling and progressive loading)
export async function scanSelectedFolders(folders, progressCallback = null) {
  if (isScanning) {
    showToast('Scan already in progress', 'info');
    return;
  }
  
  isScanning = true;
  scanProgress = {
    foldersScanned: 0,
    totalFolders: folders.length,
    filesFound: 0,
    currentFolder: ''
  };
  
  console.log('[Scanner] Starting scan of', folders.length, 'folders');
  console.log('[Scanner] Device settings:', deviceSettings);
  
  // Show loading screen
  showLoadingScreen(`Scanning folders... (0/${folders.length})`);
  
  try {
    const allTracks = [];
    
    // Scan each selected folder sequentially with throttling
    for (const folder of folders) {
      // Handle both string paths and objects with .path property
      const folderPath = typeof folder === 'string' ? folder : folder.path;
      scanProgress.currentFolder = folderPath;
      
      console.log('[Scanner] Scanning folder:', folderPath);
      
      const tracks = await scanFolder(folderPath);
      allTracks.push(...tracks);
      
      scanProgress.foldersScanned++;
      scanProgress.filesFound = allTracks.length;
      
      showLoadingScreen(
        `Scanning folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
        `Found ${scanProgress.filesFound} audio files`
      );
      
      // Call progress callback if provided (for progressive UI updates)
      if (progressCallback) {
        await progressCallback({
          ...scanProgress,
          tracks: [...allTracks]
        });
      }
      
      // Add delay between folders on mobile to prevent timeout
      if (deviceSettings.isMobile && scanProgress.foldersScanned < folders.length) {
        await utils.sleep(deviceSettings.apiBatchDelay);
      }
    }
    
    // Note: No need to save all tracks again - already saved progressively in scanFolder()
    console.log(`[Scanner] ✓ All folders scanned: ${allTracks.length} total tracks`);
    
    // Hide loading, show library with nice view
    hideLoadingScreen();
    
    // Refresh library display and show the nice library view
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    // Import app to show screen properly
    const app = await import('./app.js');
    app.showScreen('library');
    
    // Show all tracks with the nice header/collage
    await library.showAllTracks();
    
    // Show success message
    showToast(`✨ Added ${allTracks.length} songs to your library!`, 'success');
    
    return allTracks;
    
  } catch (error) {
    console.error('[Scanner] Scan failed:', error);
    hideLoadingScreen();
    showToast('Scan failed. Please try again.', 'error');
    throw error;
  } finally {
    isScanning = false;
  }
}

// Scan a folder for audio files with progressive batching (mobile-friendly!)
async function scanFolder(path, allFiles = []) {
  try {
    console.log('[Scanner] Starting progressive scan of:', path);
    
    let hasMore = true;
    let cursor = null;
    let batchNumber = 0;
    let totalProcessed = 0;
    
    // Scan in batches using Dropbox pagination
    while (hasMore) {
      batchNumber++;
      
      // Fetch one batch from Dropbox
      let response;
      if (cursor) {
        response = await dropbox.listFolderContinue(cursor);
      } else {
        response = await dropbox.listFolder(path, true);
      }
      
      console.log(`[Scanner] Batch ${batchNumber}: Got ${response.entries.length} entries`);
      
      // Process this batch
      const batchTracks = [];
      for (const entry of response.entries) {
        if (entry['.tag'] === 'file' && isAudioFile(entry.name)) {
          try {
            const track = createTrackFromEntry(entry);
            batchTracks.push(track);
            totalProcessed++;
          } catch (trackError) {
            console.error('[Scanner] Error processing track:', entry.name, trackError);
          }
        }
      }
      
      // Save this batch immediately (don't wait for all batches)
      if (batchTracks.length > 0) {
        await storage.saveTracks(batchTracks);
        allFiles.push(...batchTracks);
        console.log(`[Scanner] ✓ Batch ${batchNumber} saved: ${batchTracks.length} tracks`);
      }
      
      // Update progress
      scanProgress.filesFound = allFiles.length;
      showLoadingScreen(
        `Scanning folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
        `Found ${scanProgress.filesFound} audio files (Batch ${batchNumber})`
      );
      
      // Allow UI to breathe between batches
      await utils.sleep(50);
      
      // Check if there are more pages
      hasMore = response.has_more || false;
      cursor = response.cursor || null;
    }
    
    console.log(`[Scanner] ✓ Progressive scan complete: ${totalProcessed} tracks in ${batchNumber} batches`);
    
  } catch (error) {
    console.error('[Scanner] Error scanning folder:', path, error);
    // Continue scanning other folders even if one fails
  }
  
  return allFiles;
}

// Check if file is an audio file based on extension
function isAudioFile(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return config.audioExtensions.includes(ext);
}

// Check if file is an image file based on extension
function isImageFile(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return config.imageExtensions.includes(ext);
}

// Find cover image in folder
async function findCoverImage(folderPath) {
  try {
    const entries = await dropbox.listFolder(folderPath, false);
    
    // First, look for files named "cover" with any image extension
    const coverFile = entries.entries.find(entry => {
      if (entry['.tag'] !== 'file') return false;
      const nameWithoutExt = entry.name.substring(0, entry.name.lastIndexOf('.')) || entry.name;
      return nameWithoutExt.toLowerCase() === 'cover' && isImageFile(entry.name);
    });
    
    if (coverFile) {
      return coverFile.path_lower;
    }
    
    // If no "cover" file, return the first image file found
    const imageFile = entries.entries.find(entry => {
      return entry['.tag'] === 'file' && isImageFile(entry.name);
    });
    
    return imageFile ? imageFile.path_lower : null;
  } catch (error) {
    console.error('[Scanner] Error finding cover image:', error);
    return null;
  }
}

// Scan folder and build metadata (cover image, song count, subfolders) with timeout protection
export async function scanFolderMetadata(folderPath, timeoutMs = null) {
  // Use device-specific timeout if not provided
  if (timeoutMs === null) {
    timeoutMs = deviceSettings.operationTimeout;
  }
  
  try {
    console.log('[Scanner] Scanning metadata for folder:', folderPath, `(timeout: ${timeoutMs}ms)`);
    
    // Wrap the operation in a timeout promise
    const metadataPromise = scanFolderMetadataInternal(folderPath);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Metadata scan timeout')), timeoutMs)
    );
    
    return await Promise.race([metadataPromise, timeoutPromise]);
    
  } catch (error) {
    if (error.message === 'Metadata scan timeout') {
      console.error('[Scanner] Metadata scan timed out for:', folderPath);
      showToast(`Timeout scanning ${folderPath.split('/').pop()}`, 'error');
    } else {
      console.error('[Scanner] Error scanning folder metadata:', error);
    }
    return null;
  }
}

// Internal metadata scanning function
async function scanFolderMetadataInternal(folderPath) {
  // Get cover image
  const coverImagePath = await findCoverImage(folderPath);
  
  // Get cover image temp URL if found, and cache it
  let coverImageUrl = null;
  let coverImageUrlExpiresAt = null;
  
  if (coverImagePath) {
    try {
      // Check if image is already cached
      const isCached = await cacheManager.isImageCached(coverImagePath);
      
      if (isCached) {
        console.log('[Scanner] Using cached image for:', coverImagePath);
        // Get blob URL from cache
        coverImageUrl = await cacheManager.getImageUrl(coverImagePath);
      } else {
        // Get temporary link and cache the image (WAIT for it to complete)
        console.log('[Scanner] Caching new cover image:', coverImagePath);
        const linkData = await dropbox.getTemporaryLink(coverImagePath);
        
        try {
          // Cache the image and wait for completion
          await cacheManager.cacheImage(coverImagePath, linkData.link);
          // Now get the blob URL from cache
          coverImageUrl = await cacheManager.getImageUrl(coverImagePath);
          console.log('[Scanner] ✓ Cover image cached successfully');
        } catch (cacheError) {
          console.error('[Scanner] Failed to cache image, using temp link:', cacheError);
          // Fallback to temp link if caching fails
          coverImageUrl = linkData.link;
          coverImageUrlExpiresAt = linkManager.calculateExpiration();
        }
      }
    } catch (error) {
      console.error('[Scanner] Error getting cover image URL:', error);
    }
  }
  
  // Count songs in this folder
  const tracks = await storage.getAllTracks();
  const songCount = tracks.filter(track => track.path.startsWith(folderPath)).length;
  
  // Get folder name from path
  const pathParts = folderPath.split('/').filter(p => p);
  const name = pathParts[pathParts.length - 1] || 'Root';
  
  // Get subfolders
  const entries = await dropbox.listFolder(folderPath, false);
  const subfolders = entries.entries
    .filter(entry => entry['.tag'] === 'folder')
    .map(folder => folder.path_lower);
  
  const metadata = {
    path: folderPath,
    name: name,
    coverImagePath: coverImagePath,
    coverImageUrl: coverImageUrl,
    coverImageUrlExpiresAt: coverImageUrlExpiresAt,
    songCount: songCount,
    subfolders: subfolders,
    lastScanned: Date.now(),
    addedAt: Date.now()
  };
  
  // Save metadata to storage
  await storage.saveFolderMetadata(metadata);
  
  console.log(`[Scanner] Folder metadata saved: ${name} (${songCount} songs, ${subfolders.length} subfolders, cover: ${coverImagePath ? 'yes' : 'no'})`);
  
  return metadata;
}

// Create track object from Dropbox file entry
function createTrackFromEntry(entry) {
  // Extract basic info from filename and path
  const filename = entry.name;
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Parse metadata from filename with enhanced logic
  const metadata = parseFilenameMetadata(nameWithoutExt);
  
  // Get album from parent folder as fallback
  const pathParts = entry.path_display.split('/');
  const folderAlbum = pathParts.length > 2 ? pathParts[pathParts.length - 2] : 'Unknown Album';
  
  // Use parsed album if available, otherwise use folder name
  const album = metadata.album || folderAlbum;
  
  // Generate unique ID from path using a simple hash
  let hash = 0;
  for (let i = 0; i < entry.path_lower.length; i++) {
    const char = entry.path_lower.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const id = 'track_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  
  return {
    id,
    title: metadata.title,
    artist: metadata.artist,
    album,
    track: metadata.track,
    path: entry.path_lower,
    pathDisplay: entry.path_display,
    filename,
    size: entry.size,
    source: 'dropbox', // Mark as Dropbox file
    modifiedTime: entry.server_modified,
    addedAt: Date.now()
  };
}

// Enhanced filename parser - handles multiple formats
function parseFilenameMetadata(nameWithoutExt) {
  // Default values
  let artist = 'Unknown Artist';
  let album = null; // null means use folder name
  let track = null;
  let title = nameWithoutExt;
  
  // Check if filename contains separator
  if (!nameWithoutExt.includes(' - ')) {
    // No separator - entire name is the title
    return { artist, album, track, title };
  }
  
  // Split by " - " separator
  const parts = nameWithoutExt.split(' - ').map(p => p.trim());
  
  if (parts.length === 2) {
    // Pattern: "Part1 - Part2"
    const firstPart = parts[0];
    const secondPart = parts[1];
    
    // Check if first part is a track number
    if (isTrackNumber(firstPart)) {
      // "01 - Title" or "Track 01 - Title"
      track = extractTrackNumber(firstPart);
      title = secondPart;
      // Artist and album will use defaults/folder
    } else {
      // "Artist - Title"
      artist = firstPart;
      title = secondPart;
    }
  } else if (parts.length === 3) {
    // Pattern: "Part1 - Part2 - Part3"
    const firstPart = parts[0];
    const secondPart = parts[1];
    const thirdPart = parts[2];
    
    // Check different patterns
    if (isTrackNumber(secondPart)) {
      // "Artist - 01 - Title" or "Artist - Track 01 - Title"
      artist = firstPart;
      track = extractTrackNumber(secondPart);
      title = thirdPart;
    } else if (isTrackNumber(firstPart)) {
      // "01 - Album - Title" (less common)
      track = extractTrackNumber(firstPart);
      album = secondPart;
      title = thirdPart;
    } else {
      // "Artist - Album - Title"
      artist = firstPart;
      album = secondPart;
      title = thirdPart;
    }
  } else if (parts.length >= 4) {
    // Pattern: "Artist - Album - Track - Title" or more parts
    const firstPart = parts[0];
    const secondPart = parts[1];
    const thirdPart = parts[2];
    const remainingParts = parts.slice(3);
    
    // Check if third part is a track number
    if (isTrackNumber(thirdPart)) {
      // "Artist - Album - 01 - Title"
      artist = firstPart;
      album = secondPart;
      track = extractTrackNumber(thirdPart);
      title = remainingParts.join(' - ');
    } else if (isTrackNumber(firstPart)) {
      // "01 - Artist - Album - Title" (unusual but handle it)
      track = extractTrackNumber(firstPart);
      artist = secondPart;
      album = thirdPart;
      title = remainingParts.join(' - ');
    } else {
      // Assume: "Artist - Album - Sub-info - Title..."
      // Take first as artist, second as album, rest as title
      artist = firstPart;
      album = secondPart;
      title = parts.slice(2).join(' - ');
    }
  }
  
  return { artist, album, track, title };
}

// Check if a string represents a track number
function isTrackNumber(str) {
  // Patterns: "01", "1", "Track 01", "Track 1", "01.", "1."
  const trackPatterns = [
    /^\d{1,3}$/,              // Just digits: "01" or "1"
    /^Track\s+\d{1,3}$/i,     // "Track 01" or "track 1"
    /^\d{1,3}\.$/,            // "01." or "1."
    /^#\d{1,3}$/              // "#01" or "#1"
  ];
  
  return trackPatterns.some(pattern => pattern.test(str.trim()));
}

// Extract track number from string
function extractTrackNumber(str) {
  // Extract just the numeric part
  const match = str.match(/\d{1,3}/);
  return match ? match[0] : null;
}

// Show loading screen with message
function showLoadingScreen(primary, secondary = '') {
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingMessage = document.getElementById('loadingMessage');
  
  if (loadingMessage) {
    loadingMessage.innerHTML = `
      ${primary}
      ${secondary ? `<div class="loading-secondary">${secondary}</div>` : ''}
    `;
  }
  
  if (loadingScreen) {
    loadingScreen.classList.add('active');
    // Make sure other screens are hidden
    document.querySelectorAll('.screen').forEach(screen => {
      if (screen.id !== 'loadingScreen') {
        screen.classList.remove('active');
      }
    });
  }
}

// Hide loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.remove('active');
  }
}

// Get scan status
export function isCurrentlyScanning() {
  return isScanning;
}

export function getScanProgress() {
  return scanProgress;
}

// ==========================================
// LOCAL FILES SCANNING
// ==========================================

// Scan local folders for audio files
export async function scanLocalFolders(localFolderHandles) {
  if (isScanning) {
    showToast('Scan already in progress', 'info');
    return;
  }
  
  isScanning = true;
  scanProgress = {
    foldersScanned: 0,
    totalFolders: localFolderHandles.length,
    filesFound: 0
  };
  
  console.log('[Scanner] Starting local scan of', localFolderHandles.length, 'folders');
  
  // Show loading screen
  showLoadingScreen(`Scanning local folders... (0/${localFolderHandles.length})`);
  
  try {
    const allTracks = [];
    
    // Scan each selected folder
    for (const folderData of localFolderHandles) {
      console.log('[Scanner] Scanning local folder:', folderData.name);
      
      // Verify permission
      const hasPermission = await localFiles.verifyPermission(folderData.handle);
      if (!hasPermission) {
        console.warn('[Scanner] No permission for folder:', folderData.name);
        showToast(`Permission denied for "${folderData.name}"`, 'error');
        continue;
      }
      
      const tracks = await scanLocalFolder(folderData.handle, folderData.name);
      allTracks.push(...tracks);
      
      scanProgress.foldersScanned++;
      scanProgress.filesFound = allTracks.length;
      
      showLoadingScreen(
        `Scanning local folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
        `Found ${scanProgress.filesFound} audio files`
      );
    }
    
    // Save all tracks to database
    if (allTracks.length > 0) {
      showLoadingScreen('Saving tracks to library...', `Processing ${allTracks.length} files`);
      await storage.saveTracks(allTracks);
      console.log(`[Scanner] Saved ${allTracks.length} local tracks to database`);
    }
    
    // Hide loading, show library
    hideLoadingScreen();
    showScreen('library');
    
    // Refresh library display
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    // Show success message
    showToast(`✨ Added ${allTracks.length} local songs!`, 'success');
    
  } catch (error) {
    console.error('[Scanner] Local scan failed:', error);
    hideLoadingScreen();
    showToast('Local scan failed. Please try again.', 'error');
  } finally {
    isScanning = false;
  }
}

// Scan a local folder for audio files
async function scanLocalFolder(dirHandle, baseFolderName) {
  const allTracks = [];
  
  try {
    // Get all audio files recursively
    const audioFiles = await localFiles.getAllAudioFiles(dirHandle);
    
    console.log(`[Scanner] Processing ${audioFiles.length} local files from ${baseFolderName}`);
    
    // Create track objects
    for (const fileEntry of audioFiles) {
      try {
        const track = await createLocalTrackFromFile(fileEntry, baseFolderName);
        allTracks.push(track);
        
        // Update progress
        scanProgress.filesFound++;
        if (scanProgress.filesFound % 10 === 0) {
          showLoadingScreen(
            `Scanning local folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
            `Found ${scanProgress.filesFound} audio files`
          );
        }
      } catch (trackError) {
        console.error('[Scanner] Error processing local file:', fileEntry.name, trackError);
      }
    }
  } catch (error) {
    console.error('[Scanner] Error scanning local folder:', baseFolderName, error);
  }
  
  return allTracks;
}

// Create track object from local file
async function createLocalTrackFromFile(fileEntry, baseFolderName) {
  const filename = fileEntry.name;
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Default values from filename
  let artist = 'Unknown Artist';
  let title = nameWithoutExt;
  let album = baseFolderName;
  let albumArt = null;
  
  // Try to parse artist and title from filename (fallback)
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    const firstPart = parts[0].trim();
    
    if (!/^\d+$/.test(firstPart)) {
      artist = firstPart;
      title = parts.slice(1).join(' - ').trim();
    } else {
      title = parts.slice(1).join(' - ').trim();
    }
  }
  
  // Try to get album from parent folder in path
  const pathParts = fileEntry.path.split('/');
  if (pathParts.length > 1) {
    album = pathParts[pathParts.length - 2];
  }
  
  // Get file size and read ID3 tags
  let fileSize = 0;
  try {
    const file = await fileEntry.handle.getFile();
    fileSize = file.size;
    
    // Read ID3 tags to get better metadata and album art
    try {
      const metadata = await id3Reader.readAudioFileMetadata(file);
      
      // Use ID3 metadata if available (prefer over filename parsing)
      if (metadata.title) title = metadata.title;
      if (metadata.artist) artist = metadata.artist;
      if (metadata.album) album = metadata.album;
      if (metadata.duration) {
        // Store duration from ID3 tags
        fileEntry.duration = metadata.duration;
      }
      if (metadata.albumArt) {
        albumArt = metadata.albumArt;
        console.log('[Scanner] ✓ Album art extracted from:', filename, 
          '- Size:', Math.round(albumArt.length / 1024), 'KB',
          '- Preview:', albumArt.substring(0, 50) + '...');
      }
      
      if (metadata.hasAlbumArt && !albumArt) {
        console.warn('[Scanner] ⚠ Album art detected but not extracted from:', filename);
      }
      
      if (!metadata.hasAlbumArt) {
        console.log('[Scanner] ℹ No album art in:', filename);
      }
    } catch (id3Error) {
      console.warn('[Scanner] Could not read ID3 tags from:', filename, id3Error.message);
      // Continue with filename-based metadata
    }
  } catch (e) {
    console.warn('[Scanner] Could not get file:', filename, e);
  }
  
  // Generate unique ID from path
  let hash = 0;
  const pathStr = `local:${baseFolderName}/${fileEntry.path}`;
  for (let i = 0; i < pathStr.length; i++) {
    const char = pathStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const id = 'local_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  
  return {
    id,
    title,
    artist,
    album,
    albumArt, // Store album art data URL
    duration: fileEntry.duration || 0, // Duration in seconds from ID3 tags
    path: `local:${baseFolderName}/${fileEntry.path}`, // Prefix with source
    filename,
    size: fileSize,
    source: 'local', // Mark as local file
    fileHandle: fileEntry.handle, // Store handle for playback (IndexedDB can store this)
    addedAt: Date.now()
  };
}
