// Playlists Module
// Handles playlist creation, editing, and playback

import * as storage from './storage.js';
import { showToast } from './app.js';

let allPlaylists = [];
let selectedTracks = new Set(); // Track IDs of selected tracks in playlist
let lastSelectedTrackId = null; // For shift-click range selection

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

// Initialize playlists
export async function init() {
  console.log('[Playlists] Initializing playlists');
  await refreshPlaylists();
}

// Refresh playlists from storage
export async function refreshPlaylists() {
  allPlaylists = await storage.getAllPlaylists();
  console.log(`[Playlists] Loaded ${allPlaylists.length} playlists`);
  displayPlaylists();
}

// Create new playlist
export async function createPlaylist(name) {
  if (!name || !name.trim()) {
    showToast('Please enter a playlist name', 'error');
    return null;
  }
  
  const playlist = {
    name: name.trim(),
    tracks: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const id = await storage.savePlaylist(playlist);
  playlist.id = id;
  
  console.log('[Playlists] Created playlist:', playlist.name);
  showToast(`Playlist "${playlist.name}" created!`, 'success');
  
  await refreshPlaylists();
  
  // Refresh home page to show new playlist
  const home = await import('./home.js');
  await home.refreshFolders();
  
  return playlist;
}

// Delete playlist
export async function deletePlaylist(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  if (!confirm(`Delete playlist "${playlist.name}"?`)) {
    return;
  }
  
  await storage.deletePlaylist(playlistId);
  console.log('[Playlists] Deleted playlist:', playlist.name);
  showToast(`Playlist "${playlist.name}" deleted`, 'success');
  
  await refreshPlaylists();
}

// Show duplicate confirmation modal
function showDuplicateConfirmation(playlistName, duplicateCount, totalCount) {
  return new Promise((resolve) => {
    const modal = document.getElementById('duplicateModal');
    const message = document.getElementById('duplicateModalMessage');
    const addAnywayBtn = document.getElementById('duplicateAddAnywayBtn');
    const cancelBtn = document.getElementById('duplicateCancelBtn');
    
    // Set message with proper singular/plural
    const songWord = duplicateCount === 1 ? 'This song is' : 'These songs are';
    message.textContent = `${songWord} already in your '${playlistName}' playlist.`;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Handle buttons
    const handleAddAnyway = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      modal.style.display = 'none';
      addAnywayBtn.removeEventListener('click', handleAddAnyway);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    
    addAnywayBtn.addEventListener('click', handleAddAnyway);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Add track to playlist (with duplicate detection)
export async function addTrackToPlaylist(playlistId, track, skipDuplicateCheck = false) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  // Check if track already in playlist
  const isDuplicate = playlist.tracks.some(t => t.id === track.id);
  
  if (isDuplicate && !skipDuplicateCheck) {
    // Show confirmation dialog
    const shouldAdd = await showDuplicateConfirmation(playlist.name, 1, 1);
    if (!shouldAdd) {
      console.log('[Playlists] User cancelled adding duplicate track');
      return;
    }
    // User confirmed - add the duplicate anyway!
  }
  
  // Add track (always add if we get here - user either confirmed or it's not a duplicate)
  playlist.tracks.push({
    id: track.id,
    addedAt: Date.now()
  });
  
  playlist.updatedAt = Date.now();
  
  await storage.savePlaylist(playlist);
  console.log('[Playlists] Added track to playlist:', playlist.name);
  
  if (!skipDuplicateCheck) {
    showToast(`Added to "${playlist.name}"`, 'success');
  }
  
  await refreshPlaylists();
}

// Add multiple tracks to playlist (with duplicate detection)
export async function addTracksToPlaylist(playlistId, tracks, skipDuplicateCheck = false) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  // Check for duplicates
  const duplicates = tracks.filter(track => 
    playlist.tracks.some(t => t.id === track.id)
  );
  
  if (duplicates.length > 0 && !skipDuplicateCheck) {
    // Show confirmation dialog
    const shouldAdd = await showDuplicateConfirmation(playlist.name, duplicates.length, tracks.length);
    if (!shouldAdd) {
      console.log('[Playlists] User cancelled adding duplicate tracks');
      return false;
    }
    // User confirmed - add all tracks including duplicates!
  }
  
  // Add all tracks (including duplicates if user confirmed or skipDuplicateCheck is true)
  let addedCount = 0;
  for (const track of tracks) {
    playlist.tracks.push({
      id: track.id,
      addedAt: Date.now()
    });
    addedCount++;
  }
  
  playlist.updatedAt = Date.now();
  await storage.savePlaylist(playlist);
  
  console.log(`[Playlists] Added ${addedCount} tracks to playlist:`, playlist.name);
  showToast(`Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'} to "${playlist.name}"`, 'success');
  
  await refreshPlaylists();
  return true;
}

// Remove track from playlist
export async function removeTrackFromPlaylist(playlistId, trackId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
  playlist.updatedAt = Date.now();
  
  await storage.savePlaylist(playlist);
  console.log('[Playlists] Removed track from playlist');
  showToast('Track removed from playlist', 'success');
  
  await refreshPlaylists();
}

// Rename playlist
export async function renamePlaylist(playlistId, newName) {
  if (!newName || !newName.trim()) {
    showToast('Please enter a playlist name', 'error');
    return;
  }
  
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  playlist.name = newName.trim();
  playlist.updatedAt = Date.now();
  
  await storage.savePlaylist(playlist);
  console.log('[Playlists] Renamed playlist to:', playlist.name);
  showToast('Playlist renamed', 'success');
  
  await refreshPlaylists();
}

// Display playlists in UI
function displayPlaylists() {
  const playlistsContent = document.getElementById('playlistsContent');
  if (!playlistsContent) return;
  
  if (allPlaylists.length === 0) {
    playlistsContent.innerHTML = `
      <div class="empty-state">
        <p>No playlists yet</p>
        <p class="empty-state-subtitle">Create a playlist to get started</p>
      </div>
    `;
    return;
  }
  
  playlistsContent.innerHTML = '';
  
  allPlaylists.forEach(playlist => {
    const playlistEl = createPlaylistElement(playlist);
    playlistsContent.appendChild(playlistEl);
  });
  
  // Also update sidebar
  updateSidebarPlaylists();
}

// Update sidebar playlists
function updateSidebarPlaylists() {
  const sidebarList = document.getElementById('sidebarPlaylistsList');
  if (!sidebarList) return;
  
  if (allPlaylists.length === 0) {
    sidebarList.innerHTML = `
      <div class="sidebar-playlists-empty">No playlists yet</div>
    `;
    return;
  }
  
  sidebarList.innerHTML = '';
  
  allPlaylists.forEach(playlist => {
    const button = document.createElement('button');
    button.className = 'sidebar-playlist-item';
    button.dataset.playlistId = playlist.id;
    
    const trackCount = playlist.tracks.length;
    const gradient = getPlaylistGradient(playlist.id);
    
    button.innerHTML = `
      <div class="sidebar-playlist-icon" style="background: ${gradient};" title="${escapeHtml(playlist.name)}"></div>
      <div class="sidebar-playlist-info">
        <div class="sidebar-playlist-name">${escapeHtml(playlist.name)}</div>
        <div class="sidebar-playlist-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
      </div>
    `;
    
    button.addEventListener('click', () => {
      viewPlaylist(playlist.id);
    });
    
    sidebarList.appendChild(button);
  });
}

// Create playlist element
function createPlaylistElement(playlist) {
  const div = document.createElement('div');
  div.className = 'playlist-card';
  div.dataset.playlistId = playlist.id;
  
  const trackCount = playlist.tracks.length;
  
  div.innerHTML = `
    <div class="playlist-card-icon">📋</div>
    <div class="playlist-card-info">
      <h3 class="playlist-card-name">${escapeHtml(playlist.name)}</h3>
      <p class="playlist-card-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</p>
    </div>
    <div class="playlist-card-actions">
      <button class="btn-icon" title="Play">▶</button>
      <button class="btn-icon" title="More">⋮</button>
    </div>
  `;
  
  // Click on card to view playlist
  div.addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-icon')) {
      viewPlaylist(playlist.id);
    }
  });
  
  // Play button
  div.querySelector('.playlist-card-actions .btn-icon[title="Play"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await playPlaylist(playlist.id);
  });
  
  // More menu button
  div.querySelector('.playlist-card-actions .btn-icon[title="More"]').addEventListener('click', (e) => {
    e.stopPropagation();
    showPlaylistMenu(playlist.id, e.target);
  });
  
  return div;
}

// View playlist details
export async function viewPlaylist(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  console.log('[Playlists] Viewing playlist:', playlist.name);
  
  // Import showScreen from app
  const { showScreen } = await import('./app.js');
  
  // Get full track details
  const trackDetails = [];
  for (const playlistTrack of playlist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      trackDetails.push(track);
    }
  }
  
  // Update screen elements
  document.getElementById('playlistDetailTitle').textContent = playlist.name;
  document.getElementById('playlistDetailStats').textContent = 
    `${trackDetails.length} ${trackDetails.length === 1 ? 'song' : 'songs'}`;
  
  // Show/hide play button
  const playBtn = document.getElementById('playPlaylistDetailBtn');
  if (trackDetails.length > 0) {
    playBtn.style.display = 'block';
  } else {
    playBtn.style.display = 'none';
  }
  
  // Populate track list
  const content = document.getElementById('playlistDetailContent');
  if (trackDetails.length === 0) {
    content.innerHTML = '<div class="empty-state"><p>No songs in this playlist</p></div>';
  } else {
    content.innerHTML = '';
    trackDetails.forEach(track => {
      const trackEl = createPlaylistTrackElement(track, playlist.id);
      content.appendChild(trackEl);
    });
  }
  
  // Store current playlist ID for event handlers
  window.currentPlaylistId = playlist.id;
  
  // Show the screen
  showScreen('playlistDetail');
}

// Create track element for playlist detail
function createPlaylistTrackElement(track, playlistId) {
  const div = document.createElement('div');
  div.className = 'track-item';
  div.dataset.trackId = track.id;
  
  // Mark as selected if in selection set
  if (selectedTracks.has(track.id)) {
    div.classList.add('selected');
  }
  
  // Use album art if available, otherwise default icon
  const albumArtSrc = track.albumArt || 'assets/icons/icon-song-black..png';
  
  div.innerHTML = `
    <div class="track-selection-indicator">✓</div>
    <div class="track-item-cover">
      <img src="${albumArtSrc}" alt="Album art">
      <button class="track-play-btn">▶</button>
    </div>
    <div class="track-item-info">
      <div class="track-item-title">${escapeHtml(track.title)}</div>
      <div class="track-item-artist">${escapeHtml(track.artist)}</div>
    </div>
    <div class="track-item-album">${escapeHtml(track.album)}</div>
    <button class="track-more-btn">⋮</button>
  `;
  
  // Prevent text selection on shift-click (but allow the click event to fire)
  div.addEventListener('mousedown', (e) => {
    if (e.shiftKey) {
      e.preventDefault(); // Prevent text selection
    }
  });
  
  // Single click = select/deselect (desktop only)
  // Double click = play track
  let clickTimer = null;
  div.addEventListener('click', (e) => {
    // Ignore clicks on buttons
    if (e.target.classList.contains('track-more-btn') || 
        e.target.classList.contains('track-play-btn')) {
      return;
    }
    
    // Check if this is a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile: single click plays immediately
      playPlaylistFromTrack(playlistId, track.id);
      return;
    }
    
    // Desktop: distinguish single vs double click
    if (clickTimer === null) {
      // Capture modifier keys immediately (they become stale in setTimeout)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      
      clickTimer = setTimeout(() => {
        // Single click - handle selection with captured modifiers
        const syntheticEvent = { ctrlKey: isCtrlOrCmd, metaKey: isCtrlOrCmd, shiftKey: isShift };
        handleTrackSelection(track.id, div, syntheticEvent);
        clickTimer = null;
      }, 300); // 300ms window for double click
    } else {
      // Double click - play track
      clearTimeout(clickTimer);
      clickTimer = null;
      playPlaylistFromTrack(playlistId, track.id);
    }
  });
  
  // More button - shows remove option or bulk operations
  div.querySelector('.track-more-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (selectedTracks.size > 0) {
      showBulkRemoveMenu(playlistId, e.target);
    } else {
      showRemoveTrackMenu(playlistId, track.id, e.target);
    }
  });
  
  return div;
}

// Handle track selection with modifier keys
function handleTrackSelection(trackId, trackElement, event) {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const isShift = event.shiftKey;
  
  if (isShift && lastSelectedTrackId) {
    selectRange(lastSelectedTrackId, trackId);
  } else if (isCtrlOrCmd) {
    toggleTrackSelection(trackId, trackElement);
    lastSelectedTrackId = trackId;
  } else {
    clearSelection();
    selectedTracks.add(trackId);
    trackElement.classList.add('selected');
    lastSelectedTrackId = trackId;
  }
}

// Toggle track selection
function toggleTrackSelection(trackId, trackElement) {
  if (selectedTracks.has(trackId)) {
    selectedTracks.delete(trackId);
    trackElement.classList.remove('selected');
  } else {
    selectedTracks.add(trackId);
    trackElement.classList.add('selected');
  }
}

// Select range of tracks
function selectRange(fromTrackId, toTrackId) {
  const trackElements = Array.from(document.querySelectorAll('.track-item'));
  const fromIndex = trackElements.findIndex(el => el.dataset.trackId === fromTrackId);
  const toIndex = trackElements.findIndex(el => el.dataset.trackId === toTrackId);
  
  if (fromIndex === -1 || toIndex === -1) return;
  
  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  
  for (let i = startIndex; i <= endIndex; i++) {
    const trackEl = trackElements[i];
    const trackId = trackEl.dataset.trackId;
    
    if (!selectedTracks.has(trackId)) {
      selectedTracks.add(trackId);
      trackEl.classList.add('selected');
    }
  }
}

// Clear all selections
function clearSelection() {
  selectedTracks.clear();
  lastSelectedTrackId = null;
  document.querySelectorAll('.track-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
}

// Show bulk remove menu
function showBulkRemoveMenu(playlistId, buttonElement) {
  const existingMenu = document.getElementById('bulkRemoveMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const menu = document.createElement('div');
  menu.id = 'bulkRemoveMenu';
  menu.className = 'context-menu active';
  
  const count = selectedTracks.size;
  
  // Get other playlists (exclude current one)
  const otherPlaylists = allPlaylists.filter(p => p.id !== playlistId);
  
  let playlistsHTML = '';
  if (otherPlaylists.length > 0) {
    playlistsHTML = `
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
      <div class="context-menu-divider"></div>
      ${otherPlaylists.map(playlist => `
        <button class="context-menu-item" data-playlist-id="${playlist.id}">
          📋 ${escapeHtml(playlist.name)}
        </button>
      `).join('')}
      <div class="context-menu-divider"></div>
    `;
  } else {
    playlistsHTML = `
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
      <div class="context-menu-divider"></div>
    `;
  }
  
  menu.innerHTML = `
    <div class="context-menu-header">${count} songs selected</div>
    ${playlistsHTML}
    <button class="context-menu-item" data-action="remove">
      ✕ Remove from Playlist
    </button>
    <div class="context-menu-divider"></div>
    <button class="context-menu-item" data-action="clear">
      Clear Selection
    </button>
  `;
  
  const rect = buttonElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  
  document.body.appendChild(menu);
  
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      const targetPlaylistId = item.dataset.playlistId;
      menu.remove();
      
      if (action === 'remove') {
        await removeSelectedTracks(playlistId);
      } else if (action === 'clear') {
        clearSelection();
      } else if (action === 'create') {
        const name = prompt('Enter playlist name:');
        if (name) {
          const newPlaylist = await createPlaylist(name);
          if (newPlaylist) {
            await addSelectedTracksToPlaylist(newPlaylist.id, playlistId);
          }
        }
      } else if (targetPlaylistId) {
        await addSelectedTracksToPlaylist(parseInt(targetPlaylistId), playlistId);
      }
    });
  });
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Add selected tracks to another playlist
async function addSelectedTracksToPlaylist(targetPlaylistId, sourcePlaylistId) {
  // Get full track objects for selected IDs
  const selectedTrackIds = Array.from(selectedTracks);
  const tracks = [];
  for (const trackId of selectedTrackIds) {
    const track = await storage.getTrackById(trackId);
    if (track) {
      tracks.push(track);
    }
  }
  
  // Use the new bulk add function with duplicate detection
  const added = await addTracksToPlaylist(targetPlaylistId, tracks);
  
  // Clear selection if tracks were added
  if (added !== false) {
    clearSelection();
  }
}

// Remove selected tracks from playlist
async function removeSelectedTracks(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  const count = selectedTracks.size;
  
  // Remove all selected tracks
  playlist.tracks = playlist.tracks.filter(t => !selectedTracks.has(t.id));
  playlist.updatedAt = Date.now();
  
  await storage.savePlaylist(playlist);
  showToast(`Removed ${count} songs from playlist`, 'success');
  
  clearSelection();
  await refreshPlaylists();
  viewPlaylist(playlistId);
}

// Show remove track menu
function showRemoveTrackMenu(playlistId, trackId, buttonElement) {
  // Remove existing menu
  const existingMenu = document.getElementById('removeTrackMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'removeTrackMenu';
  menu.className = 'context-menu active';
  menu.innerHTML = `
    <button class="context-menu-item" data-action="remove">
      ✕ Remove from Playlist
    </button>
  `;
  
  // Position near button
  const rect = buttonElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  
  document.body.appendChild(menu);
  
  // Handle click
  menu.querySelector('.context-menu-item').addEventListener('click', async () => {
    menu.remove();
    await removeTrackFromPlaylist(playlistId, trackId);
    // Refresh the view
    viewPlaylist(playlistId);
  });
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Play entire playlist
export async function playPlaylist(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist || playlist.tracks.length === 0) {
    showToast('Playlist is empty', 'info');
    return;
  }
  
  console.log('[Playlists] Playing playlist:', playlist.name);
  
  // Get full track details
  const tracks = [];
  for (const playlistTrack of playlist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      tracks.push(track);
    }
  }
  
  if (tracks.length === 0) {
    showToast('No valid tracks in playlist', 'error');
    return;
  }
  
  // Import and play with playlist context
  const queue = await import('./queue.js');
  const context = {
    type: 'playlist',
    id: playlistId,
    name: playlist.name
  };
  await queue.playTrackWithQueue(tracks[0], tracks, context);
}

// Play playlist starting from specific track
async function playPlaylistFromTrack(playlistId, trackId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  // Get all tracks
  const tracks = [];
  for (const playlistTrack of playlist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      tracks.push(track);
    }
  }
  
  // Find starting track
  const startTrack = tracks.find(t => t.id === trackId);
  if (!startTrack) return;
  
  // Import and play with playlist context
  const queue = await import('./queue.js');
  const context = {
    type: 'playlist',
    id: playlistId,
    name: playlist.name
  };
  await queue.playTrackWithQueue(startTrack, tracks, context);
}

// Show playlist context menu
function showPlaylistMenu(playlistId, buttonElement) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  // Remove existing menu
  const existingMenu = document.getElementById('playlistContextMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'playlistContextMenu';
  menu.className = 'context-menu active';
  menu.innerHTML = `
    <button class="context-menu-item" data-action="rename">
      ✏️ Rename
    </button>
    <button class="context-menu-item" data-action="delete">
      🗑️ Delete
    </button>
  `;
  
  // Position near button
  const rect = buttonElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  
  document.body.appendChild(menu);
  
  // Handle menu clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      menu.remove();
      
      if (action === 'rename') {
        const newName = prompt('Enter new playlist name:', playlist.name);
        if (newName) {
          await renamePlaylist(playlistId, newName);
        }
      } else if (action === 'delete') {
        await deletePlaylist(playlistId);
      }
    });
  });
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Show "Add to Playlist" menu for a track
export function showAddToPlaylistMenu(track, buttonElement) {
  // Remove existing menu
  const existingMenu = document.getElementById('addToPlaylistMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'addToPlaylistMenu';
  menu.className = 'context-menu active';
  
  if (allPlaylists.length === 0) {
    menu.innerHTML = `
      <div class="context-menu-item disabled">No playlists yet</div>
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
    `;
  } else {
    menu.innerHTML = `
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
      <div class="context-menu-divider"></div>
      ${allPlaylists.map(playlist => `
        <button class="context-menu-item" data-playlist-id="${playlist.id}">
          📋 ${escapeHtml(playlist.name)}
        </button>
      `).join('')}
    `;
  }
  
  // Position near button
  const rect = buttonElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  
  document.body.appendChild(menu);
  
  // Handle menu clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const playlistId = item.dataset.playlistId;
      const action = item.dataset.action;
      menu.remove();
      
      if (action === 'create') {
        const name = prompt('Enter playlist name:');
        if (name) {
          const newPlaylist = await createPlaylist(name);
          if (newPlaylist) {
            await addTrackToPlaylist(newPlaylist.id, track);
          }
        }
      } else if (playlistId) {
        await addTrackToPlaylist(parseInt(playlistId), track);
      }
    });
  });
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Get all playlists
export function getAllPlaylists() {
  return allPlaylists;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
