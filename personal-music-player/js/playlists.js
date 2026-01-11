// Playlists Module
// Handles playlist creation, editing, and playback

import * as storage from './storage.js';
import { showToast } from './app.js';

let allPlaylists = [];
let selectedTracks = new Set(); // Track IDs of selected tracks in playlist
let lastSelectedTrackId = null; // For shift-click range selection
let currentPlaylistData = null; // Current playlist being viewed
let currentSortOrder = 'custom'; // custom, title, artist, album, dateAdded, duration, source
let currentSortDirection = 'asc'; // asc or desc
let currentViewMode = 'list'; // list or compact
let draggedTrackIndex = null; // For drag and drop
let searchQuery = ''; // Current search query
let shuffleEnabled = false; // Shuffle toggle state
let savedCustomOrder = null; // Saved custom order for 3-click cycle

// Detect source location from track
function getTrackSource(track) {
  // Check source property first (most reliable)
  if (track.source) {
    if (track.source === 'dropbox') return 'Dropbox';
    if (track.source === 'google-drive') return 'Google Drive';
    if (track.source === 'onedrive') return 'OneDrive';
    if (track.source === 'network-drive') return 'Network Drive';
    if (track.source === 'plex') return 'Plex';
    if (track.source === 'local') return 'Local';
  }
  
  // Fallback to checking path
  const path = track.path.toLowerCase();
  if (path.includes('dropbox')) return 'Dropbox';
  if (path.includes('google drive') || path.includes('googledrive')) return 'Google Drive';
  if (path.includes('onedrive')) return 'OneDrive';
  if (path.includes('network') || path.includes('nas')) return 'Network Drive';
  if (path.includes('plex')) return 'Plex';
  return 'Local';
}

// Get source icon for display
function getSourceIcon(source) {
  const icons = {
    'Dropbox': 'assets/icons/dropbox.png',
    'Google Drive': 'assets/icons/googledrive.png',
    'OneDrive': 'assets/icons/onedrive.png',
    'Network Drive': 'assets/icons/networkdrive.png',
    'Plex': 'assets/icons/plex.png',
    'Local': '📁' // Folder emoji
  };
  return icons[source] || '📁';
}

// Generate subdued gradient for playlist based on ID
export function getPlaylistGradient(playlistId) {
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

// Generate album art collage HTML for a playlist
// Returns object with { html, hasImages } where hasImages indicates if any real album art was found
export async function getPlaylistCollageData(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) {
    return { albumArts: [], hasImages: false };
  }
  
  // Get unique album arts from playlist tracks (first 4)
  const albumArts = [];
  for (const playlistTrack of playlist.tracks) {
    if (albumArts.length >= 4) break;
    
    const track = await storage.getTrackById(playlistTrack.id);
    if (track && track.albumArt && !albumArts.includes(track.albumArt)) {
      albumArts.push(track.albumArt);
    }
  }
  
  return {
    albumArts,
    hasImages: albumArts.length > 0
  };
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
async function updateSidebarPlaylists() {
  const sidebarList = document.getElementById('sidebarPlaylistsList');
  if (!sidebarList) return;
  
  if (allPlaylists.length === 0) {
    sidebarList.innerHTML = `
      <div class="sidebar-playlists-empty">No playlists yet</div>
    `;
    return;
  }
  
  sidebarList.innerHTML = '';
  
  for (const playlist of allPlaylists) {
    const button = document.createElement('button');
    button.className = 'sidebar-playlist-item';
    button.dataset.playlistId = playlist.id;
    
    const trackCount = playlist.tracks.length;
    const gradient = getPlaylistGradient(playlist.id);
    
    // Get collage data
    const collageData = await getPlaylistCollageData(playlist.id);
    
    let iconHTML = '';
    if (collageData.hasImages) {
      const albumArts = collageData.albumArts;
      iconHTML = `
        <div class="sidebar-playlist-icon sidebar-playlist-collage" style="background: ${gradient};" title="${escapeHtml(playlist.name)}">
          <div class="sidebar-collage-grid">
            ${albumArts.map(art => `<div class="collage-item" style="background-image: url(${art});"></div>`).join('')}
            ${Array(4 - albumArts.length).fill('<div class="collage-item"></div>').join('')}
          </div>
        </div>
      `;
    } else {
      iconHTML = `<div class="sidebar-playlist-icon" style="background: ${gradient};" title="${escapeHtml(playlist.name)}"></div>`;
    }
    
    button.innerHTML = `
      ${iconHTML}
      <div class="sidebar-playlist-info">
        <div class="sidebar-playlist-name">${escapeHtml(playlist.name)}</div>
        <div class="sidebar-playlist-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
      </div>
    `;
    
    button.addEventListener('click', () => {
      viewPlaylist(playlist.id);
    });
    
    sidebarList.appendChild(button);
  }
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
  
  // Store current playlist data
  currentPlaylistData = playlist;
  
  // Reset view state
  currentSortOrder = playlist.sortOrder || 'custom';
  currentViewMode = playlist.viewMode || 'list';
  searchQuery = '';
  clearSelection();
  
  // Import showScreen from app
  const { showScreen } = await import('./app.js');
  
  // Get full track details
  const trackDetails = [];
  for (const playlistTrack of playlist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      // Add playlist-specific metadata
      track.addedAt = playlistTrack.addedAt;
      trackDetails.push(track);
    }
  }
  
  // Update enhanced playlist header
  updatePlaylistHeader(playlist, trackDetails);
  
  // Setup toolbar event listeners
  setupToolbarListeners(playlist.id);
  
  // Update sort/view button label
  updateSortViewLabel();
  
  // Render track list
  renderPlaylistTracks(playlist.id, trackDetails);
  
  // Store current playlist ID for event handlers
  window.currentPlaylistId = playlist.id;
  
  // Show the screen
  showScreen('playlistDetail');
}

// Update enhanced playlist header
function updatePlaylistHeader(playlist, tracks) {
  // Update title
  const titleEl = document.getElementById('playlistDetailTitle');
  if (titleEl) {
    titleEl.textContent = playlist.name;
  }
  
  // Update gradient background
  const gradient = getPlaylistGradient(playlist.id);
  const header = document.getElementById('playlistHeader');
  if (header) {
    header.style.background = gradient;
  }
  
  // Create album art collage (first 4 unique album arts)
  const collage = document.getElementById('playlistArtCollage');
  if (collage) {
    const uniqueAlbumArts = [...new Set(tracks.map(t => t.albumArt))].filter(Boolean).slice(0, 4);
    
    const collageItems = collage.querySelectorAll('.collage-item');
    collageItems.forEach((item, index) => {
      if (uniqueAlbumArts[index]) {
        item.style.backgroundImage = `url(${uniqueAlbumArts[index]})`;
      } else {
        item.style.backgroundImage = '';
      }
    });
  }
  
  // Calculate total duration
  const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const durationText = formatPlaylistDuration(totalDuration);
  
  // Detect all unique sources from tracks
  const sources = new Set();
  tracks.forEach(track => {
    const source = getTrackSource(track);
    sources.add(source);
  });
  // Sort sources: Local first, then alphabetically
  const sortedSources = Array.from(sources).sort((a, b) => {
    if (a === 'Local') return -1;
    if (b === 'Local') return 1;
    return a.localeCompare(b);
  });
  
  const sourceText = sortedSources.length > 0 ? sortedSources.join(' / ') : 'Unknown';
  
  // Format date created (will be replaced by source in the UI)
  const dateCreated = sourceText;
  
  // Update metadata - use specific selectors within playlistHeader
  const songCount = tracks.length;
  const songText = `${songCount} ${songCount === 1 ? 'song' : 'songs'}`;
  
  const playlistHeader = document.getElementById('playlistHeader');
  if (playlistHeader) {
    const songCountEl = playlistHeader.querySelector('.playlist-song-count');
    const dateCreatedEl = playlistHeader.querySelector('.playlist-date-created');
    const durationEl = playlistHeader.querySelector('.playlist-duration');
    
    if (songCountEl) songCountEl.textContent = songText;
    if (dateCreatedEl) dateCreatedEl.textContent = sourceText;
    if (durationEl) durationEl.textContent = durationText;
  }
}

// Format playlist duration
function formatPlaylistDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds === 0) {
    return '0 min';
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  } else {
    return `${minutes} min`;
  }
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Created today';
  } else if (diffDays === 1) {
    return 'Created yesterday';
  } else if (diffDays < 7) {
    return `Created ${diffDays} days ago`;
  } else {
    const options = { month: 'short', year: 'numeric' };
    return `Created ${date.toLocaleDateString('en-US', options)}`;
  }
}

// Setup toolbar event listeners
function setupToolbarListeners(playlistId) {
  // Play button
  const playBtn = document.getElementById('playPlaylistBtn');
  playBtn.replaceWith(playBtn.cloneNode(true)); // Remove old listeners
  document.getElementById('playPlaylistBtn').addEventListener('click', () => {
    playPlaylist(playlistId);
  });
  
  // Shuffle button - toggle only, doesn't play
  const shuffleBtn = document.getElementById('shufflePlaylistBtn');
  shuffleBtn.replaceWith(shuffleBtn.cloneNode(true));
  // Set initial state
  if (shuffleEnabled) {
    document.getElementById('shufflePlaylistBtn').classList.add('active');
  }
  document.getElementById('shufflePlaylistBtn').addEventListener('click', () => {
    toggleShuffle();
  });
  
  // Add to playlist button
  const addToPlaylistBtn = document.getElementById('addPlaylistToPlaylistBtn');
  addToPlaylistBtn.replaceWith(addToPlaylistBtn.cloneNode(true));
  document.getElementById('addPlaylistToPlaylistBtn').addEventListener('click', () => {
    showAddPlaylistToPlaylistModal(playlistId);
  });
  
  // Search button
  const searchBtn = document.getElementById('searchPlaylistBtn');
  searchBtn.replaceWith(searchBtn.cloneNode(true));
  document.getElementById('searchPlaylistBtn').addEventListener('click', () => {
    togglePlaylistSearch();
  });
  
  // Sort/View button
  const sortViewBtn = document.getElementById('sortViewBtn');
  sortViewBtn.replaceWith(sortViewBtn.cloneNode(true));
  document.getElementById('sortViewBtn').addEventListener('click', () => {
    showSortViewModal();
  });
  
  // Close playlist detail button
  const closeBtn = document.getElementById('closePlaylistDetailBtn');
  closeBtn.replaceWith(closeBtn.cloneNode(true));
  document.getElementById('closePlaylistDetailBtn').addEventListener('click', async () => {
    const { showScreen } = await import('./app.js');
    showScreen('playlists');
  });
  
  // Search input listeners
  const searchInput = document.getElementById('playlistSearchInput');
  searchInput.replaceWith(searchInput.cloneNode(true));
  document.getElementById('playlistSearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    refreshCurrentPlaylist();
  });
  
  const closeSearchBtn = document.getElementById('closePlaylistSearchBtn');
  closeSearchBtn.replaceWith(closeSearchBtn.cloneNode(true));
  document.getElementById('closePlaylistSearchBtn').addEventListener('click', () => {
    searchQuery = '';
    document.getElementById('playlistSearchInput').value = '';
    togglePlaylistSearch();
  });
}

// Toggle playlist search bar
function togglePlaylistSearch() {
  const searchBar = document.getElementById('playlistSearchBar');
  const searchBtn = document.getElementById('searchPlaylistBtn');
  
  if (searchBar.style.display === 'none' || !searchBar.style.display) {
    searchBar.style.display = 'flex';
    searchBtn.classList.add('active');
    document.getElementById('playlistSearchInput').focus();
  } else {
    searchBar.style.display = 'none';
    searchBtn.classList.remove('active');
    searchQuery = '';
    document.getElementById('playlistSearchInput').value = '';
    refreshCurrentPlaylist();
  }
}

// Update sort/view label
function updateSortViewLabel() {
  const label = document.getElementById('sortViewLabel');
  const sortLabels = {
    custom: 'Custom order',
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    dateAdded: 'Recently added',
    duration: 'Duration',
    source: 'Source'
  };
  label.textContent = sortLabels[currentSortOrder] || 'Custom order';
}

// Setup column header click listeners for sorting
function setupColumnHeaderListeners() {
  const headers = document.querySelectorAll('.playlist-column-headers .column-header[data-sort]');
  
  headers.forEach(header => {
    const sortType = header.dataset.sort;
    
    header.onclick = () => {
      handleColumnHeaderClick(sortType);
    };
  });
  
  // Update visual indicators
  updateColumnHeaderIndicators();
}

// Handle column header click for sorting
function handleColumnHeaderClick(sortType) {
  // Save custom order before switching away from it (first time only)
  if (currentSortOrder === 'custom' && !savedCustomOrder && currentPlaylistData) {
    savedCustomOrder = [...currentPlaylistData.tracks];
  }
  
  // 3-click cycle: ascending → descending → custom
  if (currentSortOrder === sortType) {
    if (currentSortDirection === 'asc') {
      // First click was asc, now go to desc
      currentSortDirection = 'desc';
    } else {
      // Second click was desc, now return to custom
      currentSortOrder = 'custom';
      currentSortDirection = 'asc';
      
      // Restore saved custom order
      if (savedCustomOrder && currentPlaylistData) {
        currentPlaylistData.tracks = [...savedCustomOrder];
        savedCustomOrder = null; // Clear saved order
      }
    }
  } else {
    // New column - start with ascending
    currentSortOrder = sortType;
    currentSortDirection = 'asc';
  }
  
  // Save sort preferences to playlist
  if (currentPlaylistData) {
    currentPlaylistData.sortOrder = currentSortOrder;
    storage.savePlaylist(currentPlaylistData);
  }
  
  // Update UI
  updateSortViewLabel();
  updateColumnHeaderIndicators();
  refreshCurrentPlaylist();
}

// Update column header visual indicators
function updateColumnHeaderIndicators() {
  const headers = document.querySelectorAll('.playlist-column-headers .column-header[data-sort]');
  
  headers.forEach(header => {
    const sortType = header.dataset.sort;
    
    // Remove existing indicators
    const existingIndicator = header.querySelector('.sort-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Remove sorted class
    header.classList.remove('sorted');
    
    // Add indicator if this column is currently sorted
    if (currentSortOrder === sortType && currentSortOrder !== 'custom') {
      header.classList.add('sorted');
      
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator';
      indicator.textContent = currentSortDirection === 'asc' ? '▲' : '▼';
      header.appendChild(indicator);
    }
  });
}

// Render playlist tracks
function renderPlaylistTracks(playlistId, tracks) {
  const content = document.getElementById('playlistDetailContent');
  
  // Apply view mode class
  content.className = 'playlist-detail-content';
  if (currentViewMode === 'compact') {
    content.classList.add('compact-view');
  }
  if (currentSortOrder === 'custom') {
    content.classList.add('custom-order');
  }
  
  // Filter tracks by search query
  let filteredTracks = tracks;
  if (searchQuery) {
    filteredTracks = tracks.filter(track =>
      track.title.toLowerCase().includes(searchQuery) ||
      track.artist.toLowerCase().includes(searchQuery) ||
      track.album.toLowerCase().includes(searchQuery)
    );
  }
  
  // Sort tracks
  const sortedTracks = sortTracks(filteredTracks);
  
  if (sortedTracks.length === 0) {
    content.innerHTML = searchQuery 
      ? '<div class="empty-state"><p>No songs match your search</p></div>'
      : '<div class="empty-state"><p>No songs in this playlist</p></div>';
    return;
  }
  
  content.innerHTML = '';
  sortedTracks.forEach((track, index) => {
    const trackEl = createEnhancedTrackElement(track, index + 1, playlistId);
    content.appendChild(trackEl);
  });
  
  // Setup column header click listeners
  setupColumnHeaderListeners();
  
  // Setup drag and drop for custom order
  if (currentSortOrder === 'custom' && !searchQuery) {
    setupDragAndDrop();
  }
}

// Sort tracks based on current sort order and direction
function sortTracks(tracks) {
  const sorted = [...tracks];
  
  // For custom order, return as-is
  if (currentSortOrder === 'custom') {
    return sorted;
  }
  
  // Sort based on order
  switch (currentSortOrder) {
    case 'title':
      sorted.sort((a, b) => {
        const result = a.title.localeCompare(b.title);
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
    case 'artist':
      sorted.sort((a, b) => {
        const result = a.artist.localeCompare(b.artist);
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
    case 'album':
      sorted.sort((a, b) => {
        const result = a.album.localeCompare(b.album);
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
    case 'dateAdded':
      sorted.sort((a, b) => {
        const result = (a.addedAt || 0) - (b.addedAt || 0);
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
    case 'duration':
      sorted.sort((a, b) => {
        const result = (a.duration || 0) - (b.duration || 0);
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
    case 'source':
      sorted.sort((a, b) => {
        const result = getTrackSource(a).localeCompare(getTrackSource(b));
        return currentSortDirection === 'asc' ? result : -result;
      });
      break;
  }
  
  return sorted;
}

// Sort tracks for playback (used by Play All button)
function sortTracksForPlayback(tracks, sortOrder) {
  const sorted = [...tracks];
  
  switch (sortOrder) {
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'artist':
      sorted.sort((a, b) => a.artist.localeCompare(b.artist));
      break;
    case 'album':
      sorted.sort((a, b) => a.album.localeCompare(b.album));
      break;
    case 'dateAdded':
      sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      break;
    case 'duration':
      sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case 'custom':
    default:
      // Keep original order
      break;
  }
  
  return sorted;
}

// Refresh current playlist view
async function refreshCurrentPlaylist() {
  if (!currentPlaylistData) return;
  
  // Get fresh track details
  const trackDetails = [];
  for (const playlistTrack of currentPlaylistData.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      track.addedAt = playlistTrack.addedAt;
      trackDetails.push(track);
    }
  }
  
  // Update header with current track details
  updatePlaylistHeader(currentPlaylistData, trackDetails);
  
  // Render track list
  renderPlaylistTracks(currentPlaylistData.id, trackDetails);
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
  
  // Get track index in playlist for numbering
  const playlist = allPlaylists.find(p => p.id === playlistId);
  const trackIndex = playlist ? playlist.tracks.findIndex(t => t.id === track.id) + 1 : 1;
  
  div.innerHTML = `
    <div class="track-number-container">
      <div class="track-selection-indicator">✓</div>
      <div class="track-number">${trackIndex}</div>
      <div class="sound-bars">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    </div>
    <div class="track-title-cell">
      <div class="track-item-cover">
        <img src="${albumArtSrc}" alt="Album art">
      </div>
      <div class="track-item-info">
        <div class="track-item-title">${escapeHtml(track.title)}</div>
        <div class="track-item-artist">${escapeHtml(track.artist)}</div>
      </div>
      <button class="track-play-btn">▶</button>
    </div>
    <div class="track-item-album">${escapeHtml(track.album)}</div>
    <div class="track-item-duration">${formatDuration(track.duration || 0)}</div>
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
  // Only select tracks within the playlist detail view
  const playlistContent = document.getElementById('playlistDetailContent');
  if (!playlistContent) return;
  
  const trackElements = Array.from(playlistContent.querySelectorAll('.track-item'));
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
  
  console.log(`[Playlists] Selected range: ${selectedTracks.size} tracks`);
}

// Clear all selections
export function clearSelection() {
  selectedTracks.clear();
  lastSelectedTrackId = null;
  
  // Only clear selections in playlist content
  const playlistContent = document.getElementById('playlistDetailContent');
  if (playlistContent) {
    playlistContent.querySelectorAll('.track-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
  }
  
  console.log('[Playlists] Selection cleared');
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

// Show remove track menu with add to playlist options
async function showRemoveTrackMenu(playlistId, trackId, buttonElement) {
  // Get the track
  const track = await storage.getTrackById(trackId);
  if (!track) return;
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'trackOptionsModal';
  
  // Get other playlists (exclude current one)
  const otherPlaylists = allPlaylists.filter(p => p.id !== playlistId);
  
  // Build playlist options HTML
  let playlistsHTML = '';
  
  if (otherPlaylists.length > 0) {
    for (const playlist of otherPlaylists) {
      const gradient = getPlaylistGradient(playlist.id);
      const trackCount = playlist.tracks.length;
      
      // Get collage data
      const collageData = await getPlaylistCollageData(playlist.id);
      
      let iconHTML = '';
      if (collageData.hasImages) {
        const albumArts = collageData.albumArts;
        iconHTML = `
          <div class="playlist-selection-icon playlist-selection-collage" style="background: ${gradient};">
            <div class="playlist-selection-collage-grid">
              ${albumArts.map(art => `<div class="collage-item" style="background-image: url(${art});"></div>`).join('')}
              ${Array(4 - albumArts.length).fill('<div class="collage-item"></div>').join('')}
            </div>
          </div>
        `;
      } else {
        iconHTML = `<div class="playlist-selection-icon" style="background: ${gradient};"></div>`;
      }
      
      playlistsHTML += `
        <button class="playlist-selection-item" data-playlist-id="${playlist.id}">
          ${iconHTML}
          <div class="playlist-selection-info">
            <div class="playlist-selection-name">${escapeHtml(playlist.name)}</div>
            <div class="playlist-selection-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
          </div>
        </button>
      `;
    }
  }
  
  modal.innerHTML = `
    <div class="modal-content sort-view-modal">
      <div class="modal-header">
        <h2>Song Options</h2>
        <button class="modal-close-btn" id="closeTrackOptionsModalBtn">✕</button>
      </div>
      <div class="modal-body">
        <div class="sort-section">
          <button class="playlist-selection-item remove-from-playlist-btn" data-action="remove">
            <div class="playlist-selection-icon" style="background: rgba(220, 38, 38, 0.8);">
              <span style="font-size: 1.5rem;">✕</span>
            </div>
            <div class="playlist-selection-info">
              <div class="playlist-selection-name">Remove from Playlist</div>
            </div>
          </button>
        </div>
        <div class="sort-section-title">ADD TO PLAYLIST</div>
        <div class="sort-section">
          <button class="playlist-selection-item create-playlist-btn" data-action="create">
            <div class="playlist-selection-icon" style="background: var(--color-accent);">
              <span style="font-size: 1.5rem;">+</span>
            </div>
            <div class="playlist-selection-info">
              <div class="playlist-selection-name">Create New Playlist</div>
            </div>
          </button>
        </div>
        ${otherPlaylists.length > 0 ? '<div class="sort-section-title">YOUR PLAYLISTS</div>' : ''}
        <div class="playlist-selection-list">
          ${playlistsHTML.length > 0 ? playlistsHTML : '<div class="empty-state"><p>No other playlists</p></div>'}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle close button
  const closeBtn = modal.querySelector('#closeTrackOptionsModalBtn');
  closeBtn.onclick = () => modal.remove();
  
  // Handle remove from playlist
  const removeBtn = modal.querySelector('.remove-from-playlist-btn');
  if (removeBtn) {
    removeBtn.onclick = async () => {
      modal.remove();
      await removeTrackFromPlaylist(playlistId, trackId);
      viewPlaylist(playlistId);
    };
  }
  
  // Handle create new playlist
  const createBtn = modal.querySelector('.create-playlist-btn');
  if (createBtn) {
    createBtn.onclick = async () => {
      modal.remove();
      const name = prompt('Enter playlist name:');
      if (name) {
        const newPlaylist = await createPlaylist(name);
        if (newPlaylist) {
          await addTrackToPlaylist(newPlaylist.id, track);
        }
      }
    };
  }
  
  // Handle playlist selection
  modal.querySelectorAll('.playlist-selection-item[data-playlist-id]').forEach(item => {
    item.onclick = async () => {
      const targetPlaylistId = parseInt(item.dataset.playlistId);
      modal.remove();
      await addTrackToPlaylist(targetPlaylistId, track);
    };
  });
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
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
      // Add playlist-specific metadata for sorting
      track.addedAt = playlistTrack.addedAt;
      tracks.push(track);
    }
  }
  
  if (tracks.length === 0) {
    showToast('No valid tracks in playlist', 'error');
    return;
  }
  
  // Sort tracks based on the playlist's current sort order
  const sortOrder = playlist.sortOrder || 'custom';
  const sortedTracks = sortTracksForPlayback(tracks, sortOrder);
  
  // Import and play with playlist context
  const queue = await import('./queue.js');
  const context = {
    type: 'playlist',
    id: playlistId,
    name: playlist.name
  };
  await queue.playTrackWithQueue(sortedTracks[0], sortedTracks, context);
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

// Show "Add to Playlist" modal for a track
export async function showAddToPlaylistMenu(track, buttonElement) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'addToPlaylistModal';
  
  // Build playlist options HTML
  let playlistsHTML = '';
  
  if (allPlaylists.length === 0) {
    playlistsHTML = '<div class="empty-state"><p>No playlists yet</p></div>';
  } else {
    for (const playlist of allPlaylists) {
      const gradient = getPlaylistGradient(playlist.id);
      const trackCount = playlist.tracks.length;
      
      // Get collage data
      const collageData = await getPlaylistCollageData(playlist.id);
      
      let iconHTML = '';
      if (collageData.hasImages) {
        const albumArts = collageData.albumArts;
        iconHTML = `
          <div class="playlist-selection-icon playlist-selection-collage" style="background: ${gradient};">
            <div class="playlist-selection-collage-grid">
              ${albumArts.map(art => `<div class="collage-item" style="background-image: url(${art});"></div>`).join('')}
              ${Array(4 - albumArts.length).fill('<div class="collage-item"></div>').join('')}
            </div>
          </div>
        `;
      } else {
        iconHTML = `<div class="playlist-selection-icon" style="background: ${gradient};"></div>`;
      }
      
      playlistsHTML += `
        <button class="playlist-selection-item" data-playlist-id="${playlist.id}">
          ${iconHTML}
          <div class="playlist-selection-info">
            <div class="playlist-selection-name">${escapeHtml(playlist.name)}</div>
            <div class="playlist-selection-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
          </div>
        </button>
      `;
    }
  }
  
  modal.innerHTML = `
    <div class="modal-content sort-view-modal">
      <div class="modal-header">
        <h2>Add to Playlist</h2>
        <button class="modal-close-btn" id="closeAddToPlaylistModalBtn">✕</button>
      </div>
      <div class="modal-body">
        <div class="sort-section">
          <button class="playlist-selection-item create-playlist-btn" data-action="create">
            <div class="playlist-selection-icon" style="background: var(--color-accent);">
              <span style="font-size: 1.5rem;">+</span>
            </div>
            <div class="playlist-selection-info">
              <div class="playlist-selection-name">Create New Playlist</div>
            </div>
          </button>
        </div>
        ${allPlaylists.length > 0 ? '<div class="sort-section-title">YOUR PLAYLISTS</div>' : ''}
        <div class="playlist-selection-list">
          ${playlistsHTML}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle close button
  const closeBtn = modal.querySelector('#closeAddToPlaylistModalBtn');
  closeBtn.onclick = () => modal.remove();
  
  // Handle create new playlist
  const createBtn = modal.querySelector('.create-playlist-btn');
  if (createBtn) {
    createBtn.onclick = async () => {
      modal.remove();
      const name = prompt('Enter playlist name:');
      if (name) {
        const newPlaylist = await createPlaylist(name);
        if (newPlaylist) {
          await addTrackToPlaylist(newPlaylist.id, track);
        }
      }
    };
  }
  
  // Handle playlist selection
  modal.querySelectorAll('.playlist-selection-item[data-playlist-id]').forEach(item => {
    item.onclick = async () => {
      const playlistId = parseInt(item.dataset.playlistId);
      modal.remove();
      await addTrackToPlaylist(playlistId, track);
    };
  });
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// Get all playlists
export function getAllPlaylists() {
  return allPlaylists;
}

// Create enhanced track element with all columns
function createEnhancedTrackElement(track, trackNumber, playlistId) {
  const div = document.createElement('div');
  div.className = 'track-item playlist-track-item';
  div.dataset.trackId = track.id;
  div.dataset.trackIndex = trackNumber - 1;
  div.dataset.context = 'playlist';
  
  // Mark as selected if in selection set
  if (selectedTracks.has(track.id)) {
    div.classList.add('selected');
  }
  
  // Use album art if available
  const albumArtSrc = track.albumArt || 'assets/icons/icon-song-black..png';
  
  // Format duration
  const durationText = formatTrackDuration(track.duration);
  
  // Get source information
  const source = getTrackSource(track);
  const sourceIcon = getSourceIcon(source);
  const isEmoji = sourceIcon.length < 10; // Emoji vs image path
  
  div.innerHTML = `
    <div class="track-number-cell">
      <div class="track-number">${trackNumber}</div>
      <div class="track-drag-handle">⋮⋮</div>
      <div class="track-selection-indicator">✓</div>
      <button class="track-play-btn">▶</button>
      <div class="sound-bars">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    </div>
    <div class="track-title-cell">
      <div class="track-item-cover">
        <img src="${albumArtSrc}" alt="Album art">
      </div>
      <div class="track-item-title">${escapeHtml(track.title)}</div>
    </div>
    <div class="track-item-artist">${escapeHtml(track.artist)}</div>
    <div class="track-item-album">${escapeHtml(track.album)}</div>
    <div class="track-item-duration">${durationText}</div>
    <div class="track-item-source" title="${source}">
      ${isEmoji ? sourceIcon : `<img src="${sourceIcon}" alt="${source}" />`}
    </div>
    <button class="track-more-btn">⋮</button>
  `;
  
  // Prevent text selection on shift-click
  div.addEventListener('mousedown', (e) => {
    if (e.shiftKey) {
      e.preventDefault();
    }
  });
  
  // Click handling
  let clickTimer = null;
  div.addEventListener('click', (e) => {
    // Debug logging
    console.log('[Playlist Click]', {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      target: e.target.className,
      trackId: track.id
    });
    
    if (e.target.classList.contains('track-more-btn') || 
        e.target.classList.contains('track-play-btn') ||
        e.target.classList.contains('track-drag-handle')) {
      return;
    }
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      playPlaylistFromTrack(playlistId, track.id);
      return;
    }
    
    // Shift or Ctrl/Cmd click - immediate selection, no timer
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      console.log('[Playlist] Modifier key detected, calling handleTrackSelection');
      handleTrackSelection(track.id, div, e);
      return;
    }
    
    // Regular click - use timer for single/double click detection
    if (clickTimer === null) {
      clickTimer = setTimeout(() => {
        handleTrackSelection(track.id, div, e);
        clickTimer = null;
      }, 300);
    } else {
      clearTimeout(clickTimer);
      clickTimer = null;
      
      // Double click - play or pause if already playing
      (async () => {
        const player = await import('./player.js');
        const currentTrack = player.getCurrentTrack();
        const isPlaying = player.isPlaying();
        
        if (currentTrack && currentTrack.id === track.id && isPlaying) {
          player.togglePlayPause();
        } else {
          playPlaylistFromTrack(playlistId, track.id);
        }
      })();
    }
  });
  
  // Play button - single click plays/pauses immediately
  const playBtn = div.querySelector('.track-play-btn');
  if (playBtn) {
    // Update button icon on mouse enter based on track state
    div.addEventListener('mouseenter', async () => {
      const player = await import('./player.js');
      const currentTrack = player.getCurrentTrack();
      const isPlaying = player.isPlaying();
      
      if (currentTrack && currentTrack.id === track.id && isPlaying) {
        playBtn.textContent = '⏸'; // Show pause for playing track
      } else {
        playBtn.textContent = '▶'; // Show play for non-playing track
      }
    });
    
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Check if this track is currently playing
      const player = await import('./player.js');
      const currentTrack = player.getCurrentTrack();
      const isPlaying = player.isPlaying();
      
      if (currentTrack && currentTrack.id === track.id && isPlaying) {
        // Pause if this track is currently playing
        player.togglePlayPause();
      } else {
        // Play this track
        playPlaylistFromTrack(playlistId, track.id);
      }
    });
  }
  
  // More button
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

// Format track duration
function formatTrackDuration(seconds) {
  if (!seconds || seconds === 0) return '—';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format duration (alias)
function formatDuration(seconds) {
  return formatTrackDuration(seconds);
}

// Shuffle and play playlist
async function shuffleAndPlayPlaylist(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist || playlist.tracks.length === 0) {
    showToast('Playlist is empty', 'info');
    return;
  }
  
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
  
  // Shuffle tracks
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  
  // Import and play with playlist context
  const queue = await import('./queue.js');
  const context = {
    type: 'playlist',
    id: playlistId,
    name: playlist.name
  };
  await queue.playTrackWithQueue(shuffled[0], shuffled, context);
  showToast('Playing shuffled', 'info');
}

// Show sort/view modal
function showSortViewModal() {
  const modal = document.getElementById('sortViewModal');
  modal.style.display = 'flex';
  
  // Set current values
  document.querySelectorAll('input[name="sortBy"]').forEach(input => {
    input.checked = input.value === currentSortOrder;
  });
  
  document.querySelectorAll('input[name="viewAs"]').forEach(input => {
    input.checked = input.value === currentViewMode;
  });
  
  // Handle close button
  const closeBtn = document.getElementById('closeSortViewModal');
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };
  
  // Handle sort option changes
  document.querySelectorAll('input[name="sortBy"]').forEach(input => {
    input.onchange = async () => {
      currentSortOrder = input.value;
      
      // Save to playlist
      if (currentPlaylistData) {
        currentPlaylistData.sortOrder = currentSortOrder;
        await storage.savePlaylist(currentPlaylistData);
      }
      
      updateSortViewLabel();
      await refreshCurrentPlaylist();
    };
  });
  
  // Handle view option changes
  document.querySelectorAll('input[name="viewAs"]').forEach(input => {
    input.onchange = async () => {
      currentViewMode = input.value;
      
      // Save to playlist
      if (currentPlaylistData) {
        currentPlaylistData.viewMode = currentViewMode;
        await storage.savePlaylist(currentPlaylistData);
      }
      
      await refreshCurrentPlaylist();
    };
  });
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Show add playlist to playlist modal
async function showAddPlaylistToPlaylistModal(sourcePlaylistId) {
  const modal = document.getElementById('addPlaylistToPlaylistModal');
  const list = document.getElementById('playlistSelectionList');
  
  // Get other playlists (exclude current one)
  const otherPlaylists = allPlaylists.filter(p => p.id !== sourcePlaylistId);
  
  if (otherPlaylists.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No other playlists available</p></div>';
  } else {
    list.innerHTML = '';
    for (const playlist of otherPlaylists) {
      const item = document.createElement('button');
      item.className = 'playlist-selection-item';
      
      const gradient = getPlaylistGradient(playlist.id);
      const trackCount = playlist.tracks.length;
      
      // Get collage data
      const collageData = await getPlaylistCollageData(playlist.id);
      
      let iconHTML = '';
      if (collageData.hasImages) {
        const albumArts = collageData.albumArts;
        iconHTML = `
          <div class="playlist-selection-icon playlist-selection-collage" style="background: ${gradient};">
            <div class="playlist-selection-collage-grid">
              ${albumArts.map(art => `<div class="collage-item" style="background-image: url(${art});"></div>`).join('')}
              ${Array(4 - albumArts.length).fill('<div class="collage-item"></div>').join('')}
            </div>
          </div>
        `;
      } else {
        iconHTML = `<div class="playlist-selection-icon" style="background: ${gradient};"></div>`;
      }
      
      item.innerHTML = `
        ${iconHTML}
        <div class="playlist-selection-info">
          <div class="playlist-selection-name">${escapeHtml(playlist.name)}</div>
          <div class="playlist-selection-count">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
        </div>
      `;
      
      item.onclick = async () => {
        modal.style.display = 'none';
        await addAllTracksToPlaylist(sourcePlaylistId, playlist.id);
      };
      
      list.appendChild(item);
    }
  }
  
  modal.style.display = 'flex';
  
  // Handle close button
  const closeBtn = document.getElementById('closeAddPlaylistToPlaylistModal');
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };
  
  // Handle create new playlist button
  const createBtn = document.getElementById('createNewPlaylistFromModal');
  createBtn.onclick = async () => {
    const name = prompt('Enter playlist name:');
    if (name) {
      const newPlaylist = await createPlaylist(name);
      if (newPlaylist) {
        modal.style.display = 'none';
        await addAllTracksToPlaylist(sourcePlaylistId, newPlaylist.id);
      }
    }
  };
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Add all tracks from one playlist to another
async function addAllTracksToPlaylist(sourcePlaylistId, targetPlaylistId) {
  const sourcePlaylist = allPlaylists.find(p => p.id === sourcePlaylistId);
  if (!sourcePlaylist) return;
  
  // Get all tracks from source playlist
  const tracks = [];
  for (const playlistTrack of sourcePlaylist.tracks) {
    const track = await storage.getTrackById(playlistTrack.id);
    if (track) {
      tracks.push(track);
    }
  }
  
  if (tracks.length === 0) {
    showToast('Source playlist is empty', 'info');
    return;
  }
  
  // Add to target playlist
  await addTracksToPlaylist(targetPlaylistId, tracks);
}

// Setup drag and drop for custom order
function setupDragAndDrop() {
  const trackItems = document.querySelectorAll('.track-item');
  
  trackItems.forEach((item, index) => {
    item.setAttribute('draggable', true);
    
    item.addEventListener('dragstart', (e) => {
      draggedTrackIndex = index;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      draggedTrackIndex = null;
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = getDragAfterElement(document.getElementById('playlistDetailContent'), e.clientY);
      if (afterElement == null) {
        document.getElementById('playlistDetailContent').appendChild(item);
      } else {
        document.getElementById('playlistDetailContent').insertBefore(item, afterElement);
      }
    });
    
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      await handleTrackReorder();
    });
  });
}

// Get drag after element
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.track-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Handle track reorder after drag and drop
async function handleTrackReorder() {
  if (!currentPlaylistData) return;
  
  // Get new order of track IDs from DOM
  const trackElements = document.querySelectorAll('.track-item');
  const newTrackOrder = [];
  
  trackElements.forEach(el => {
    const trackId = el.dataset.trackId;
    const existingTrack = currentPlaylistData.tracks.find(t => t.id === trackId);
    if (existingTrack) {
      newTrackOrder.push(existingTrack);
    }
  });
  
  // Update playlist with new order
  currentPlaylistData.tracks = newTrackOrder;
  currentPlaylistData.updatedAt = Date.now();
  
  await storage.savePlaylist(currentPlaylistData);
  console.log('[Playlists] Updated track order');
  
  // Refresh to show new track numbers
  await refreshCurrentPlaylist();
}

// Toggle shuffle state
function toggleShuffle() {
  shuffleEnabled = !shuffleEnabled;
  const btn = document.getElementById('shufflePlaylistBtn');
  
  if (shuffleEnabled) {
    btn.classList.add('active');
    showToast('Shuffle on', 'info');
  } else {
    btn.classList.remove('active');
    showToast('Shuffle off', 'info');
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
