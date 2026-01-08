// Home Module
// Displays "My Music Collection" folder grid on home page

import * as storage from './storage.js';
import * as scanner from './scanner.js';
import * as dropbox from './dropbox.js';
import { showToast, showScreen } from './app.js';

let allFolders = [];
let isRefreshing = false;

// Initialize home module
export async function init() {
  console.log('[Home] Initializing home page');
  await refreshFolders();
}

// Refresh folder display
export async function refreshFolders() {
  if (isRefreshing) {
    showToast('Already refreshing...', 'info');
    return;
  }
  
  isRefreshing = true;
  console.log('[Home] Refreshing folders');
  
  try {
    // Get all selected folders
    const folders = await storage.getAllFoldersWithMetadata();
    
    // Scan metadata for folders that don't have it yet or need updating
    for (const folder of folders) {
      if (!folder.coverImagePath || !folder.songCount) {
        await scanner.scanFolderMetadata(folder.path);
      }
    }
    
    // Reload folders with updated metadata
    allFolders = await storage.getAllFoldersWithMetadata();
    
    // Build folder cards including subfolders
    await buildFolderCollection();
    
    console.log(`[Home] Displayed ${allFolders.length} folders`);
    
  } catch (error) {
    console.error('[Home] Error refreshing folders:', error);
    showToast('Error loading folders', 'error');
  } finally {
    isRefreshing = false;
  }
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
  
  // Process each selected folder
  for (const folder of allFolders) {
    // Add parent folder card if not already added
    if (!seenPaths.has(folder.path)) {
      allFolderCards.push(folder);
      seenPaths.add(folder.path);
    }
    
    // Check for subfolders with audio files
    if (folder.subfolders && folder.subfolders.length > 0) {
      for (const subfolderPath of folder.subfolders) {
        // Skip if we've already added this subfolder
        if (seenPaths.has(subfolderPath)) {
          continue;
        }
        
        try {
          // Check if subfolder has audio files
          const tracks = await storage.getAllTracks();
          const songsInSubfolder = tracks.filter(track => track.path.startsWith(subfolderPath));
          
          if (songsInSubfolder.length > 0) {
            // Get or create metadata for subfolder
            let subfolderData = await storage.getFolderByPath(subfolderPath);
            
            if (!subfolderData || !subfolderData.songCount) {
              // Scan subfolder metadata
              subfolderData = await scanner.scanFolderMetadata(subfolderPath);
            }
            
            if (subfolderData) {
              allFolderCards.push(subfolderData);
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
    <div class="folder-card-info">
      <h3 class="folder-card-name">${escapeHtml(folder.name)}</h3>
      <p class="folder-card-count">${songCount} ${songCount === 1 ? 'song' : 'songs'}</p>
    </div>
  `;
  
  // Click handler - filter library to this folder
  card.addEventListener('click', () => handleFolderClick(folder.path));
  
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

// Handle folder card click - filter library to this folder
async function handleFolderClick(folderPath) {
  console.log('[Home] Folder clicked:', folderPath);
  
  // Navigate to library screen
  showScreen('library');
  
  // Filter library to this folder
  const library = await import('./library.js');
  library.filterByFolder(folderPath);
}

// Refresh folder metadata (called by refresh button)
export async function refreshFolderMetadata() {
  console.log('[Home] Manually refreshing folder metadata');
  showToast('Refreshing folders...', 'info');
  
  try {
    // Re-scan metadata for all folders
    const folders = await storage.getAllFoldersWithMetadata();
    
    for (const folder of folders) {
      await scanner.scanFolderMetadata(folder.path);
    }
    
    // Reload display
    await refreshFolders();
    
    showToast('✓ Folders refreshed!', 'success');
    
  } catch (error) {
    console.error('[Home] Error refreshing folder metadata:', error);
    showToast('Error refreshing folders', 'error');
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
