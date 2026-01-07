// Playlists Module
// Handles playlist creation, editing, and playback

import * as storage from './storage.js';
import { showToast } from './app.js';

let allPlaylists = [];

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

// Add track to playlist
export async function addTrackToPlaylist(playlistId, track) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  // Check if track already in playlist
  if (playlist.tracks.some(t => t.id === track.id)) {
    showToast('Track already in playlist', 'info');
    return;
  }
  
  // Add track
  playlist.tracks.push({
    id: track.id,
    addedAt: Date.now()
  });
  
  playlist.updatedAt = Date.now();
  
  await storage.savePlaylist(playlist);
  console.log('[Playlists] Added track to playlist:', playlist.name);
  showToast(`Added to "${playlist.name}"`, 'success');
  
  await refreshPlaylists();
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
  
  // Create playlist detail modal
  const modal = document.createElement('div');
  modal.id = 'playlistDetailModal';
  modal.className = 'modal active';
  
  // Get full track details
  const trackDetails = [];
  for (const playlistTrack of playlist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      trackDetails.push(track);
    }
  }
  
  modal.innerHTML = `
    <div class="modal-content playlist-detail">
      <div class="modal-header">
        <button id="closePlaylistDetail" class="icon-btn">←</button>
        <h2>${escapeHtml(playlist.name)}</h2>
        <button class="icon-btn" id="playlistMenuBtn">⋮</button>
      </div>
      
      <div class="modal-body">
        <div class="playlist-stats">
          <span>${trackDetails.length} ${trackDetails.length === 1 ? 'song' : 'songs'}</span>
        </div>
        
        ${trackDetails.length > 0 ? `
          <button id="playPlaylistBtn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
            ▶ Play All
          </button>
        ` : ''}
        
        <div id="playlistTracks" class="playlist-tracks">
          ${trackDetails.length === 0 ? 
            '<div class="empty-state"><p>No songs in this playlist</p></div>' :
            trackDetails.map(track => `
              <div class="track-item" data-track-id="${track.id}">
                <div class="track-item-cover">
                  <img src="assets/placeholder-cover.svg" alt="Album art">
                </div>
                <div class="track-item-info">
                  <div class="track-item-title">${escapeHtml(track.title)}</div>
                  <div class="track-item-artist">${escapeHtml(track.artist)}</div>
                </div>
                <button class="btn-icon track-remove-btn" title="Remove">✕</button>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('closePlaylistDetail').addEventListener('click', () => modal.remove());
  document.getElementById('playlistMenuBtn').addEventListener('click', (e) => {
    showPlaylistMenu(playlist.id, e.target);
  });
  
  if (trackDetails.length > 0) {
    document.getElementById('playPlaylistBtn').addEventListener('click', () => {
      modal.remove();
      playPlaylist(playlist.id);
    });
  }
  
  // Track click and remove handlers
  modal.querySelectorAll('.track-item').forEach(trackEl => {
    const trackId = trackEl.dataset.trackId;
    
    trackEl.addEventListener('click', (e) => {
      if (!e.target.classList.contains('track-remove-btn')) {
        modal.remove();
        playPlaylistFromTrack(playlist.id, trackId);
      }
    });
    
    trackEl.querySelector('.track-remove-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeTrackFromPlaylist(playlist.id, trackId);
      modal.remove();
      viewPlaylist(playlist.id); // Reopen with updated data
    });
  });
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
  
  // Import and play
  const queue = await import('./queue.js');
  await queue.playTrackWithQueue(tracks[0], tracks);
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
  
  // Import and play
  const queue = await import('./queue.js');
  await queue.playTrackWithQueue(startTrack, tracks);
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
