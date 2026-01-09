// Scanner Module
// Scans selected folders for audio files and adds them to the library

import config from '../config.js';
import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as cacheManager from './cache-manager.js';
import * as linkManager from './link-manager.js';
import * as localFiles from './local-files.js';
import { showToast, showScreen } from './app.js';

let isScanning = false;
let scanProgress = {
  foldersScanned: 0,
  totalFolders: 0,
  filesFound: 0
};

// Scan selected folders for audio files
export async function scanSelectedFolders(folders) {
  if (isScanning) {
    showToast('Scan already in progress', 'info');
    return;
  }
  
  isScanning = true;
  scanProgress = {
    foldersScanned: 0,
    totalFolders: folders.length,
    filesFound: 0
  };
  
  console.log('[Scanner] Starting scan of', folders.length, 'folders');
  
  // Show loading screen
  showLoadingScreen(`Scanning folders... (0/${folders.length})`);
  
  try {
    const allTracks = [];
    
    // Scan each selected folder
    for (const folder of folders) {
      // Handle both string paths and objects with .path property
      const folderPath = typeof folder === 'string' ? folder : folder.path;
      console.log('[Scanner] Scanning folder:', folderPath);
      
      const tracks = await scanFolder(folderPath);
      allTracks.push(...tracks);
      
      scanProgress.foldersScanned++;
      scanProgress.filesFound = allTracks.length;
      
      showLoadingScreen(
        `Scanning folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
        `Found ${scanProgress.filesFound} audio files`
      );
    }
    
    // Save all tracks to database
    if (allTracks.length > 0) {
      showLoadingScreen('Saving tracks to library...', `Processing ${allTracks.length} files`);
      await storage.saveTracks(allTracks);
      console.log(`[Scanner] Saved ${allTracks.length} tracks to database`);
    }
    
    // Hide loading, show library
    hideLoadingScreen();
    showScreen('library');
    
    // Refresh library display
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    // Show success message
    showToast(`✨ Added ${allTracks.length} songs to your library!`, 'success');
    
  } catch (error) {
    console.error('[Scanner] Scan failed:', error);
    hideLoadingScreen();
    showToast('Scan failed. Please try again.', 'error');
  } finally {
    isScanning = false;
  }
}

// Scan a folder for audio files (handles pagination)
async function scanFolder(path, allFiles = []) {
  try {
    // Use Dropbox's getAllFiles which handles pagination automatically
    const entries = await dropbox.getAllFiles(path);
    
    console.log(`[Scanner] Processing ${entries.length} entries from ${path}`);
    
    // Just process the files
    for (const entry of entries) {
      if (entry['.tag'] === 'file') {
        // Check if it's an audio file
        if (isAudioFile(entry.name)) {
          try {
            const track = createTrackFromEntry(entry);
            allFiles.push(track);
            
            // Update progress
            scanProgress.filesFound++;
            if (scanProgress.filesFound % 10 === 0) {
              // Update UI every 10 files
              showLoadingScreen(
                `Scanning folders... (${scanProgress.foldersScanned}/${scanProgress.totalFolders})`,
                `Found ${scanProgress.filesFound} audio files`
              );
            }
          } catch (trackError) {
            console.error('[Scanner] Error processing track:', entry.name, trackError);
            // Continue with next track
          }
        }
      }
    }
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

// Scan folder and build metadata (cover image, song count, subfolders)
export async function scanFolderMetadata(folderPath) {
  try {
    console.log('[Scanner] Scanning metadata for folder:', folderPath);
    
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
          // Get temporary link and cache the image
          const linkData = await dropbox.getTemporaryLink(coverImagePath);
          coverImageUrl = linkData.link;
          coverImageUrlExpiresAt = linkManager.calculateExpiration();
          
          // Cache the image in the background (don't wait)
          cacheManager.cacheImage(coverImagePath, coverImageUrl)
            .catch(err => console.error('[Scanner] Background image caching failed:', err));
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
    
    console.log(`[Scanner] Folder metadata saved: ${name} (${songCount} songs, cover: ${coverImagePath ? 'yes' : 'no'})`);
    
    return metadata;
  } catch (error) {
    console.error('[Scanner] Error scanning folder metadata:', error);
    return null;
  }
}

// Create track object from Dropbox file entry
function createTrackFromEntry(entry) {
  // Extract basic info from filename and path
  const filename = entry.name;
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Try to parse artist and title from filename
  // Common patterns: "Artist - Title.mp3" or "01 - Title.mp3" or just "Title.mp3"
  let artist = 'Unknown Artist';
  let title = nameWithoutExt;
  
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    const firstPart = parts[0].trim();
    
    // Check if first part is just a track number
    if (!/^\d+$/.test(firstPart)) {
      artist = firstPart;
      title = parts.slice(1).join(' - ').trim();
    } else {
      // Just a track number, use the rest as title
      title = parts.slice(1).join(' - ').trim();
    }
  }
  
  // Try to get album from parent folder
  const pathParts = entry.path_display.split('/');
  const album = pathParts.length > 2 ? pathParts[pathParts.length - 2] : 'Unknown Album';
  
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
    title,
    artist,
    album,
    path: entry.path_lower,
    pathDisplay: entry.path_display,
    filename,
    size: entry.size,
    modifiedTime: entry.server_modified,
    addedAt: Date.now()
  };
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
  
  // Try to parse artist and title from filename
  let artist = 'Unknown Artist';
  let title = nameWithoutExt;
  
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    const firstPart = parts[0].trim();
    
    // Check if first part is just a track number
    if (!/^\d+$/.test(firstPart)) {
      artist = firstPart;
      title = parts.slice(1).join(' - ').trim();
    } else {
      // Just a track number, use the rest as title
      title = parts.slice(1).join(' - ').trim();
    }
  }
  
  // Try to get album from parent folder in path
  const pathParts = fileEntry.path.split('/');
  const album = pathParts.length > 1 ? pathParts[pathParts.length - 2] : baseFolderName;
  
  // Generate unique ID from path
  let hash = 0;
  const pathStr = `local:${baseFolderName}/${fileEntry.path}`;
  for (let i = 0; i < pathStr.length; i++) {
    const char = pathStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const id = 'local_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  
  // Get file size
  let fileSize = 0;
  try {
    const file = await fileEntry.handle.getFile();
    fileSize = file.size;
  } catch (e) {
    console.warn('[Scanner] Could not get file size:', filename);
  }
  
  return {
    id,
    title,
    artist,
    album,
    path: `local:${baseFolderName}/${fileEntry.path}`, // Prefix with source
    filename,
    size: fileSize,
    source: 'local', // Mark as local file
    fileHandle: fileEntry.handle, // Store handle for playback (IndexedDB can store this)
    addedAt: Date.now()
  };
}
