// Home Module
// Displays "My Music Collection" folder grid on home page

import * as storage from './storage.js';
import * as scanner from './scanner.js';
import * as dropbox from './dropbox.js';
import * as playlists from './playlists.js';
import { showToast, showScreen } from './app.js';

let allFolders = [];
let allPlaylists = [];
let isRefreshing = false;

// Initialize home module
export async function init() {
  console.log('[Home] Initializing home page');
  await refreshFolders();
}

// Refresh folder display (loads from cache - instant!)
export async function refreshFolders() {
  if (isRefreshing) {
    showToast('Already refreshing...', 'info');
    return;
  }
  
  isRefreshing = true;
  console.log('[Home] Refreshing folders (from cache)');
  
  try {
    // Get Dropbox folders (from cache - no re-scanning!)
    const dropboxFolders = await storage.getAllFoldersWithMetadata();
    
    // Get local folders
    const localFolderHandles = await storage.getLocalFolderHandles();
    
    // Create folder metadata for local folders
    const localFolders = await createLocalFolderMetadata(localFolderHandles);
    
    // Combine both sources
    allFolders = [...localFolders, ...dropboxFolders];
    
    // Get playlists (refresh them first to ensure latest data)
    await playlists.refreshPlaylists();
    allPlaylists = playlists.getAllPlaylists() || [];
    
    console.log('[Home] Fetched playlists:', allPlaylists.length, allPlaylists);
    
    // Build folder cards including subfolders
    await buildFolderCollection();
    
    console.log(`[Home] Displayed ${allFolders.length} folders (${localFolders.length} local, ${dropboxFolders.length} Dropbox) and ${allPlaylists.length} playlists`);
    
  } catch (error) {
    console.error('[Home] Error refreshing folders:', error);
    showToast('Error loading folders', 'error');
  } finally {
    isRefreshing = false;
  }
}

// Create folder metadata for local folders
async function createLocalFolderMetadata(localFolderHandles) {
  const localFolders = [];
  const allTracks = await storage.getAllTracks();
  
  for (const folderHandle of localFolderHandles) {
    // Count songs from this local folder
    const folderPrefix = `local:${folderHandle.name}/`;
    const songsInFolder = allTracks.filter(track => 
      track.source === 'local' && track.path.startsWith(folderPrefix)
    );
    
    if (songsInFolder.length > 0) {
      // Get album art from first track (if available)
      let coverImageUrl = 'assets/icons/icon-song-black..png'; // Default
      
      // Find first track with album art
      const trackWithArt = songsInFolder.find(track => track.albumArt);
      if (trackWithArt && trackWithArt.albumArt) {
        coverImageUrl = trackWithArt.albumArt;
      }
      
      localFolders.push({
        path: folderPrefix,
        name: folderHandle.name,
        songCount: songsInFolder.length,
        coverImageUrl: coverImageUrl,
        source: 'local',
        subfolders: [] // Local folders don't have subfolder tracking yet
      });
    }
  }
  
  return localFolders;
}

// Build complete folder collection (parents + subfolders with audio)
async function buildFolderCollection() {
  const folderGrid = document.getElementById('folderGrid');
  if (!folderGrid) return;
  
  folderGrid.innerHTML = '';
  
  if (allFolders.length === 0) {
    // Show empty state
    folderGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p>No music folders yet</p>
        <p class="empty-state-subtitle">Add folders from Sources to get started</p>
        <button id="goToSourcesBtn" class="btn-primary">Go to Sources</button>
      </div>
    `;
    
    document.getElementById('goToSourcesBtn')?.addEventListener('click', () => {
      showScreen('sources');
    });
    
    return;
  }
  
  const allFolderCards = [];
  const seenPaths = new Set(); // Track which folders we've already added
  
  // Get all tracks once (optimization - don't query repeatedly)
  const allTracks = await storage.getAllTracks();
  
  // Process each selected folder
  for (const folder of allFolders) {
    // Add parent folder card if not already added
    if (!seenPaths.has(folder.path)) {
      allFolderCards.push(folder);
      seenPaths.add(folder.path);
    }
    
    // Check for subfolders with audio files (from cache only!)
    if (folder.subfolders && folder.subfolders.length > 0) {
      for (const subfolderPath of folder.subfolders) {
        // Skip if we've already added this subfolder
        if (seenPaths.has(subfolderPath)) {
          continue;
        }
        
        try {
          // Check if subfolder has audio files (using cached tracks)
          const songsInSubfolder = allTracks.filter(track => track.path.startsWith(subfolderPath));
          
          if (songsInSubfolder.length > 0) {
            // Get metadata for subfolder (from cache only - no scanning!)
            let subfolderData = await storage.getFolderByPath(subfolderPath);
            
            // If we have cached metadata, use it
            if (subfolderData) {
              allFolderCards.push(subfolderData);
              seenPaths.add(subfolderPath);
            } else {
              // No cached metadata - create minimal card
              // Metadata will be created when folder was first added in Sources
              const pathParts = subfolderPath.split('/').filter(p => p);
              const name = pathParts[pathParts.length - 1] || 'Folder';
              
              allFolderCards.push({
                path: subfolderPath,
                name: name,
                songCount: songsInSubfolder.length,
                coverImageUrl: null,
                source: 'dropbox'
              });
              seenPaths.add(subfolderPath);
            }
          }
        } catch (error) {
          console.error('[Home] Error processing subfolder:', subfolderPath, error);
        }
      }
    }
  }
  
  // Create folder cards
  allFolderCards.forEach(folder => {
    const card = createFolderCard(folder);
    folderGrid.appendChild(card);
  });
  
  // Create playlist cards (circular) - now async
  for (const playlist of allPlaylists) {
    const card = await createPlaylistCard(playlist);
    folderGrid.appendChild(card);
  }
  
  // Add "Add New Folder" card at the end
  const addCard = createAddFolderCard();
  folderGrid.appendChild(addCard);
}

// Create folder card element
function createFolderCard(folder) {
  const card = document.createElement('div');
  card.className = 'folder-card';
  card.dataset.folderPath = folder.path;
  
  // Use cover image URL or fallback to cassette tape
  const imageUrl = folder.coverImageUrl || 'assets/icons/icon-tape-black.png';
  const songCount = folder.songCount || 0;
  
  card.innerHTML = `
    <div class="folder-card-image">
      <img src="${imageUrl}" alt="${escapeHtml(folder.name)}" loading="lazy">
    </div>
    <button class="folder-play-btn" title="Play ${escapeHtml(folder.name)}">▶</button>
    <div class="folder-card-info">
      <h3 class="folder-card-name">${escapeHtml(folder.name)}</h3>
      <p class="folder-card-count">${songCount} ${songCount === 1 ? 'song' : 'songs'}</p>
    </div>
  `;
  
  // Play button handler - play all songs from this folder
  const playBtn = card.querySelector('.folder-play-btn');
  playBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Don't trigger card click
    await handleFolderPlay(folder.path);
  });
  
  // Card click handler - filter library to this folder
  card.addEventListener('click', () => handleFolderClick(folder.path));
  
  return card;
}

// Generate subdued gradient for playlist based on ID
function getPlaylistGradient(playlistId) {
  // Subdued gradient pairs - muted complementary tones
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple-blue
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-red
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue-cyan
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green-turquoise
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink-yellow
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', // Cyan-purple
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Mint-pink
    'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)', // Orange-pink
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach gradient
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'  // Coral-blue
  ];
  
  // Use playlist ID to get consistent gradient
  const index = playlistId % gradients.length;
  return gradients[index];
}

// Create playlist card element (circular with collage)
async function createPlaylistCard(playlist) {
  const card = document.createElement('div');
  card.className = 'folder-card playlist-card';
  card.dataset.playlistId = playlist.id;
  
  const songCount = playlist.tracks ? playlist.tracks.length : 0;
  const playlistGradient = getPlaylistGradient(playlist.id);
  
  // Get collage data
  const collageData = await playlists.getPlaylistCollageData(playlist.id);
  
  let imageHTML = '';
  if (collageData.hasImages) {
    // Create collage with up to 4 album arts
    const albumArts = collageData.albumArts;
    imageHTML = `
      <div class="folder-card-image playlist-image playlist-collage" style="background: ${playlistGradient};">
        <div class="playlist-collage-grid">
          ${albumArts.map((art, index) => `
            <div class="collage-item" style="background-image: url(${art});"></div>
          `).join('')}
          ${Array(4 - albumArts.length).fill('<div class="collage-item"></div>').join('')}
        </div>
      </div>
    `;
  } else {
    // No album art - show gradient with icon
    imageHTML = `
      <div class="folder-card-image playlist-image" style="background: ${playlistGradient};">
        <img src="assets/icons/icon-512.svg" alt="${escapeHtml(playlist.name)}" loading="lazy" style="opacity: 0.3; filter: brightness(0) invert(1);">
      </div>
    `;
  }
  
  card.innerHTML = `
    ${imageHTML}
    <button class="folder-play-btn" title="Play ${escapeHtml(playlist.name)}">▶</button>
    <div class="folder-card-info">
      <h3 class="folder-card-name">${escapeHtml(playlist.name)}</h3>
      <p class="folder-card-count">${songCount} ${songCount === 1 ? 'song' : 'songs'}</p>
    </div>
  `;
  
  // Play button handler - play playlist
  const playBtn = card.querySelector('.folder-play-btn');
  playBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Don't trigger card click
    await handlePlaylistPlay(playlist.id);
  });
  
  // Card click handler - open playlist detail
  card.addEventListener('click', () => handlePlaylistClick(playlist.id));
  
  return card;
}

// Create "Add New Folder" card
function createAddFolderCard() {
  const card = document.createElement('div');
  card.className = 'folder-card add-folder-card';
  
  card.innerHTML = `
    <div class="folder-card-image">
      <div class="add-icon">+</div>
    </div>
    <div class="folder-card-info">
      <h3 class="folder-card-name">Add New Folder</h3>
    </div>
  `;
  
  // Click handler - go to sources
  card.addEventListener('click', () => {
    showScreen('sources');
  });
  
  return card;
}

// Handle folder play button - play all songs from folder
async function handleFolderPlay(folderPath) {
  console.log('[Home] Playing folder:', folderPath);
  
  try {
    // Get all tracks from this folder
    const allTracks = await storage.getAllTracks();
    const folderTracks = allTracks.filter(track => {
      // Handle both local and Dropbox paths
      if (track.source === 'local' || track.path.startsWith('local:')) {
        return track.path.startsWith(folderPath);
      }
      return track.path.startsWith(folderPath);
    });
    
    if (folderTracks.length === 0) {
      showToast('No songs found in this folder', 'info');
      return;
    }
    
    // Sort tracks by track number, then title (proper album order)
    const sortedTracks = [...folderTracks].sort(utils.trackNumberSort);
    
    // Get folder name from path (remove "local:" prefix if present)
    let folderName = folderPath.split('/').filter(p => p).pop() || 'Music';
    folderName = folderName.replace(/^local:/, ''); // Remove "local:" prefix
    
    // Start playing from first track with folder context
    const queue = await import('./queue.js');
    const context = {
      type: 'folder',
      id: folderPath,
      name: folderName
    };
    await queue.playTrackWithQueue(sortedTracks[0], sortedTracks, context);
    
    showToast(`▶ Playing ${sortedTracks.length} songs`, 'success');
    
  } catch (error) {
    console.error('[Home] Error playing folder:', error);
    showToast('Error playing folder', 'error');
  }
}

// Handle folder card click - filter library to this folder
async function handleFolderClick(folderPath) {
  console.log('[Home] Folder clicked:', folderPath);
  
  // Navigate to library screen
  showScreen('library');
  
  // Filter library to this folder
  const library = await import('./library.js');
  library.filterByFolder(folderPath);
}

// Handle playlist play button - play playlist
async function handlePlaylistPlay(playlistId) {
  console.log('[Home] Playing playlist:', playlistId);
  
  try {
    await playlists.playPlaylist(playlistId);
  } catch (error) {
    console.error('[Home] Error playing playlist:', error);
    showToast('Error playing playlist', 'error');
  }
}

// Handle playlist card click - open playlist detail
function handlePlaylistClick(playlistId) {
  console.log('[Home] Playlist clicked:', playlistId);
  playlists.viewPlaylist(playlistId);
}

// Force re-scan folder metadata (expensive operation - shows warning)
export async function forceRescanMetadata() {
  console.log('[Home] Force re-scanning folder metadata');
  
  // Show warning
  const confirmed = confirm(
    '⚠️ This will re-scan all folders and may take 5-10 minutes on mobile.\n\n' +
    'Only do this if you\'ve added new songs to existing folders in Dropbox.\n\n' +
    'Continue?'
  );
  
  if (!confirmed) {
    return;
  }
  
  showToast('Re-scanning all folders... This may take a while', 'info');
  
  // Also update track durations for ALL files (local + Dropbox)
  try {
    const library = await import('./library.js');
    const updatedCount = await library.updateMissingDurations();
    console.log(`[Home] Updated ${updatedCount} track durations`);
  } catch (error) {
    console.error('[Home] Error updating durations:', error);
  }
  
  try {
    // Re-scan metadata for all folders
    const folders = await storage.getAllFoldersWithMetadata();
    let scannedCount = 0;
    
    for (const folder of folders) {
      scannedCount++;
      showToast(`Scanning ${scannedCount}/${folders.length} folders...`, 'info');
      await scanner.scanFolderMetadata(folder.path);
    }
    
    // Reload display
    await refreshFolders();
    
    showToast('✓ All folders re-scanned!', 'success');
    
  } catch (error) {
    console.error('[Home] Error refreshing folder metadata:', error);
    showToast('Error re-scanning folders', 'error');
  }
}

// Refresh folder metadata (called by refresh button - scans for cover art)
export async function refreshFolderMetadata() {
  console.log('[Home] Refreshing cover art...');
  showToast('Scanning for cover art...', 'info');
  
  try {
    // Get all Dropbox folders
    const folders = await storage.getAllFoldersWithMetadata();
    const dropboxFolders = folders.filter(f => f.source !== 'local');
    
    if (dropboxFolders.length === 0) {
      await refreshFolders();
      showToast('✓ No Dropbox folders to scan', 'info');
      return;
    }
    
    let scannedCount = 0;
    let foundCovers = 0;
    
    // Scan metadata for each Dropbox folder (includes cover art)
    for (const folder of dropboxFolders) {
      scannedCount++;
      showToast(`Scanning ${scannedCount}/${dropboxFolders.length} folders...`, 'info');
      
      // Mobile-optimized scanning with timeout
      const metadata = await scanner.scanFolderMetadata(folder.path);
      
      // Log cover art status for main folder
      if (metadata && metadata.coverImagePath) {
        foundCovers++;
        console.log(`[Home] Found cover for ${metadata.name}:`, metadata.coverImagePath);
        console.log(`[Home] Cover URL:`, metadata.coverImageUrl ? metadata.coverImageUrl.substring(0, 50) + '...' : 'none');
      } else {
        console.log(`[Home] No cover found for ${folder.name}`);
      }
      
      // ALSO scan all subfolders for their cover art
      if (metadata && metadata.subfolders && metadata.subfolders.length > 0) {
        console.log(`[Home] Scanning ${metadata.subfolders.length} subfolders for cover art...`);
        
        for (const subfolderPath of metadata.subfolders) {
          try {
            const subMetadata = await scanner.scanFolderMetadata(subfolderPath);
            
            if (subMetadata && subMetadata.coverImagePath) {
              foundCovers++;
              console.log(`[Home] ✓ Found cover in subfolder ${subMetadata.name}`);
            }
          } catch (error) {
            console.warn(`[Home] Error scanning subfolder ${subfolderPath}:`, error);
          }
        }
      }
    }
    
    console.log(`[Home] Scan complete: ${foundCovers}/${scannedCount} folders have cover art`);
    
    // Force clear the folder cache and reload from database
    allFolders = [];
    
    // Reload display with new cached images
    await refreshFolders();
    
    if (foundCovers > 0) {
      showToast(`✓ Found ${foundCovers} cover image${foundCovers > 1 ? 's' : ''}!`, 'success');
    } else {
      showToast(`✓ Scan complete - No cover images found`, 'info');
    }
    
  } catch (error) {
    console.error('[Home] Error refreshing cover art:', error);
    showToast('Error scanning cover art', 'error');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get all folders (for external use)
export function getAllFolders() {
  return allFolders;
}
