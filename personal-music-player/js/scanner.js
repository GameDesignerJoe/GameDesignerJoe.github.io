// Scanner Module
// Scans selected folders for audio files and adds them to the library

import config from '../config.js';
import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
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
