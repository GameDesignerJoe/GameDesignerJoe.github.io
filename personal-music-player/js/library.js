// Library Module
// Handles displaying tracks in the library

import * as storage from './storage.js';
import { showToast } from './app.js';

let allTracks = [];
let displayedTracks = []; // Currently displayed/filtered tracks
let currentTab = 'songs';
let searchQuery = '';
let updateInterval = null;
let selectedTracks = new Set(); // Track IDs of selected tracks
let lastSelectedTrackId = null; // For shift-click range selection
let currentFolderPath = null; // Currently viewed folder path
let currentSortOrder = 'title'; // title, artist, album, dateAdded, duration
let currentViewMode = 'list'; // list or compact
let shuffleEnabled = false;

// Generate gradient for folder based on path hash
function getFolderGradient(folderPath) {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < folderPath.length; i++) {
    hash = ((hash << 5) - hash) + folderPath.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// Detect source location from track path
function getTrackSource(track) {
  const path = track.path.toLowerCase();
  if (path.includes('dropbox')) return 'Dropbox';
  if (path.includes('google drive') || path.includes('googledrive')) return 'Google Drive';
  if (path.includes('onedrive')) return 'OneDrive';
  return 'Local';
}

// Get folder art (cover.jpg → collage → cassette icon)
async function getFolderArt(tracks, folderPath) {
  // Priority 1: Check for cover.jpg/png in folder
  const coverImages = tracks.filter(t => {
    const filename = t.path.split('/').pop().toLowerCase();
    return filename === 'cover.jpg' || filename === 'cover.png';
  });
  
  if (coverImages.length > 0 && coverImages[0].albumArt) {
    return { type: 'cover', art: coverImages[0].albumArt };
  }
  
  // Priority 2: Create collage from first 4 unique album arts
  const uniqueAlbumArts = [...new Set(tracks.map(t => t.albumArt))].filter(Boolean).slice(0, 4);
  if (uniqueAlbumArts.length > 0) {
    return { type: 'collage', arts: uniqueAlbumArts };
  }
  
  // Priority 3: Default cassette icon
  return { type: 'icon', art: 'assets/icons/icon-tape-black.png' };
}

// Initialize library
export async function init() {
  console.log('[Library] Initializing library');
  await refreshLibrary();
  
  // Start polling for current track updates
  startTrackPolling();
}

// Start polling to update now playing indicators
function startTrackPolling() {
  // Clear any existing interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  // Poll every 500ms to update now playing state
  updateInterval = setInterval(() => {
    updateNowPlayingIndicators();
  }, 500);
  
  console.log('[Library] Started now playing polling');
}

// Update now playing indicators for all visible tracks
async function updateNowPlayingIndicators() {
  const player = await import('./player.js');
  const currentTrack = player.getCurrentTrack();
  const isCurrentlyPlaying = player.isPlaying();
  
  // Update all track elements
  document.querySelectorAll('.track-item').forEach(trackEl => {
    const trackId = trackEl.dataset.trackId;
    
    if (currentTrack && trackId === currentTrack.id) {
      // This is the current track
      trackEl.classList.add('now-playing');
      
      if (isCurrentlyPlaying) {
        trackEl.classList.add('playing');
      } else {
        trackEl.classList.remove('playing');
      }
    } else {
      // Not the current track
      trackEl.classList.remove('now-playing', 'playing');
    }
  });
}

// Refresh library display
export async function refreshLibrary() {
  console.log('[Library] Refreshing library');
  
  // Load all tracks from storage
  allTracks = await storage.getAllTracks();
  console.log(`[Library] Loaded ${allTracks.length} tracks`);
  
  // Display based on current tab
  displayLibrary(currentTab);
}

// Set search query and refresh display
export function setSearchQuery(query) {
  searchQuery = query.toLowerCase().trim();
  displayLibrary(currentTab);
}

// Filter tracks based on search query
function getFilteredTracks() {
  if (!searchQuery) {
    return allTracks;
  }
  
  return allTracks.filter(track => {
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const album = (track.album || '').toLowerCase();
    
    return title.includes(searchQuery) ||
           artist.includes(searchQuery) ||
           album.includes(searchQuery);
  });
}

// Display library content based on tab
function displayLibrary(tab) {
  currentTab = tab;
  const libraryContent = document.getElementById('libraryContent');
  
  if (!libraryContent) return;
  
  const filteredTracks = getFilteredTracks();
  
  if (allTracks.length === 0) {
    // Show empty state
    libraryContent.innerHTML = `
      <div class="empty-state">
        <p>No tracks found</p>
        <button id="addSongsBtn" class="btn-secondary">Add Songs</button>
      </div>
    `;
    
    // Re-attach event listener
    document.getElementById('addSongsBtn')?.addEventListener('click', async () => {
      const folderBrowser = await import('./folder-browser.js');
      await folderBrowser.showFolderBrowser();
    });
    
    return;
  }
  
  // Check if search returned no results
  if (searchQuery && filteredTracks.length === 0) {
    libraryContent.innerHTML = `
      <div class="empty-state">
        <p>No tracks found matching "${escapeHtml(searchQuery)}"</p>
      </div>
    `;
    return;
  }
  
  // Display based on tab
  switch (tab) {
    case 'songs':
      displaySongs(filteredTracks);
      break;
    case 'artists':
      displayArtists(filteredTracks);
      break;
    case 'albums':
      displayAlbums(filteredTracks);
      break;
  }
}

// Display all songs
function displaySongs(tracks) {
  const libraryContent = document.getElementById('libraryContent');
  
  libraryContent.innerHTML = '';
  
  // Sort tracks with natural/alphanumeric sorting (1, 2, 3... 10, 11 instead of 1, 10, 11, 2)
  const sortedTracks = [...tracks].sort((a, b) => 
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
  );
  
  // Update displayed tracks for queue
  displayedTracks = sortedTracks;
  
  sortedTracks.forEach(track => {
    const trackElement = createTrackElement(track);
    libraryContent.appendChild(trackElement);
  });
}

// Display grouped by artists
function displayArtists(tracks) {
  const libraryContent = document.getElementById('libraryContent');
  
  libraryContent.innerHTML = '';
  
  // Group tracks by artist
  const artistMap = {};
  tracks.forEach(track => {
    const artist = track.artist || 'Unknown Artist';
    if (!artistMap[artist]) {
      artistMap[artist] = [];
    }
    artistMap[artist].push(track);
  });
  
  // Sort artists alphabetically
  const sortedArtists = Object.keys(artistMap).sort();
  
  sortedArtists.forEach(artist => {
    const tracks = artistMap[artist];
    const artistElement = createArtistGroup(artist, tracks);
    libraryContent.appendChild(artistElement);
  });
}

// Display grouped by albums
function displayAlbums(tracks) {
  const libraryContent = document.getElementById('libraryContent');
  
  libraryContent.innerHTML = '';
  
  // Group tracks by album
  const albumMap = {};
  tracks.forEach(track => {
    const album = track.album || 'Unknown Album';
    if (!albumMap[album]) {
      albumMap[album] = {
        artist: track.artist || 'Unknown Artist',
        tracks: []
      };
    }
    albumMap[album].tracks.push(track);
  });
  
  // Sort albums alphabetically
  const sortedAlbums = Object.keys(albumMap).sort();
  
  sortedAlbums.forEach(album => {
    const { artist, tracks } = albumMap[album];
    const albumElement = createAlbumGroup(album, artist, tracks);
    libraryContent.appendChild(albumElement);
  });
}

// Create track element
function createTrackElement(track) {
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
      <div class="sound-bars">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
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
      // Mobile: single click plays immediately (no multi-select)
      playTrack(track);
      return;
    }
    
    // Desktop: distinguish single vs double click
    if (clickTimer === null) {
      // Capture modifier keys immediately (they become stale in setTimeout)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      
      // First click - wait to see if it's a double click
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
      playTrack(track);
    }
  });
  
  // More button click handler
  const moreBtn = div.querySelector('.track-more-btn');
  moreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    showTrackMenu(track, moreBtn);
  });
  
  return div;
}

// Handle track selection with modifier keys
function handleTrackSelection(trackId, trackElement, event) {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const isShift = event.shiftKey;
  
  if (isShift && lastSelectedTrackId) {
    // Shift-click: Select range from last selected to this track
    selectRange(lastSelectedTrackId, trackId);
  } else if (isCtrlOrCmd) {
    // Ctrl/Cmd-click: Toggle this track (add/remove from selection)
    toggleTrackSelection(trackId, trackElement);
    lastSelectedTrackId = trackId;
  } else {
    // Normal click: Clear selection and select only this track
    clearSelection();
    selectedTracks.add(trackId);
    trackElement.classList.add('selected');
    lastSelectedTrackId = trackId;
    console.log(`[Library] ${selectedTracks.size} track selected`);
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
  
  console.log(`[Library] ${selectedTracks.size} tracks selected`);
}

// Select range of tracks (for shift-click)
function selectRange(fromTrackId, toTrackId) {
  // Only select tracks within the library view
  const libraryContent = document.getElementById('libraryContent');
  if (!libraryContent) return;
  
  // Get all visible track elements in order within library content only
  const trackElements = Array.from(libraryContent.querySelectorAll('.track-item'));
  
  // Find indices of from and to tracks
  const fromIndex = trackElements.findIndex(el => el.dataset.trackId === fromTrackId);
  const toIndex = trackElements.findIndex(el => el.dataset.trackId === toTrackId);
  
  if (fromIndex === -1 || toIndex === -1) return;
  
  // Determine range (handle selection in either direction)
  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  
  // Select all tracks in range
  for (let i = startIndex; i <= endIndex; i++) {
    const trackEl = trackElements[i];
    const trackId = trackEl.dataset.trackId;
    
    if (!selectedTracks.has(trackId)) {
      selectedTracks.add(trackId);
      trackEl.classList.add('selected');
    }
  }
  
  console.log(`[Library] ${selectedTracks.size} tracks selected (range)`);
}

// Show track menu (either for single track or selected tracks)
async function showTrackMenu(track, buttonElement) {
  const playlists = await import('./playlists.js');
  
  // Check if we have selected tracks
  if (selectedTracks.size > 0) {
    // Show menu for multiple selected tracks
    showMultiTrackMenu(buttonElement);
  } else {
    // Show menu for single track
    playlists.showAddToPlaylistMenu(track, buttonElement);
  }
}

// Show menu for multiple selected tracks
async function showMultiTrackMenu(buttonElement) {
  const playlists = await import('./playlists.js');
  const allPlaylists = playlists.getAllPlaylists();
  
  // Remove existing menu
  const existingMenu = document.getElementById('multiTrackMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'multiTrackMenu';
  menu.className = 'context-menu active';
  
  const count = selectedTracks.size;
  
  if (allPlaylists.length === 0) {
    menu.innerHTML = `
      <div class="context-menu-header">${count} songs selected</div>
      <div class="context-menu-item disabled">No playlists yet</div>
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="clear">
        ✕ Clear Selection
      </button>
    `;
  } else {
    menu.innerHTML = `
      <div class="context-menu-header">${count} songs selected</div>
      <button class="context-menu-item" data-action="create">
        ➕ Create New Playlist
      </button>
      <div class="context-menu-divider"></div>
      ${allPlaylists.map(playlist => `
        <button class="context-menu-item" data-playlist-id="${playlist.id}">
          📋 ${escapeHtml(playlist.name)}
        </button>
      `).join('')}
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="clear">
        ✕ Clear Selection
      </button>
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
          const newPlaylist = await playlists.createPlaylist(name);
          if (newPlaylist) {
            await addSelectedTracksToPlaylist(newPlaylist.id);
          }
        }
      } else if (action === 'clear') {
        clearSelection();
      } else if (playlistId) {
        await addSelectedTracksToPlaylist(parseInt(playlistId));
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

// Add selected tracks to playlist
async function addSelectedTracksToPlaylist(playlistId) {
  const playlists = await import('./playlists.js');
  
  // Get full track objects for selected IDs
  const selectedTrackObjects = allTracks.filter(t => selectedTracks.has(t.id));
  
  // Use the new bulk add function with duplicate detection
  const added = await playlists.addTracksToPlaylist(playlistId, selectedTrackObjects);
  
  // Clear selection if tracks were added
  if (added !== false) {
    clearSelection();
  }
}

// Clear all selections
export function clearSelection() {
  selectedTracks.clear();
  
  // Remove selected class from all tracks
  document.querySelectorAll('.track-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  console.log('[Library] Selection cleared');
}

// Create artist group element
function createArtistGroup(artist, tracks) {
  const div = document.createElement('div');
  div.className = 'artist-group';
  
  const header = document.createElement('div');
  header.className = 'artist-group-header';
  header.innerHTML = `
    <h3>${escapeHtml(artist)}</h3>
    <span class="artist-track-count">${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}</span>
  `;
  div.appendChild(header);
  
  const trackList = document.createElement('div');
  trackList.className = 'artist-track-list';
  
  tracks.forEach(track => {
    const trackEl = createTrackElement(track);
    trackList.appendChild(trackEl);
  });
  
  div.appendChild(trackList);
  
  return div;
}

// Create album group element
function createAlbumGroup(album, artist, tracks) {
  const div = document.createElement('div');
  div.className = 'album-group';
  
  // Find first track with album art, or use default
  const trackWithArt = tracks.find(t => t.albumArt);
  const albumArtSrc = trackWithArt?.albumArt || 'assets/icons/icon-song-black..png';
  
  const header = document.createElement('div');
  header.className = 'album-group-header';
  header.innerHTML = `
    <img src="${albumArtSrc}" alt="Album art" class="album-art-thumb">
    <div class="album-info">
      <h3>${escapeHtml(album)}</h3>
      <p>${escapeHtml(artist)} • ${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}</p>
    </div>
    <button class="album-play-all-btn">▶ Play All</button>
  `;
  
  // Add click handler for Play All button
  header.querySelector('.album-play-all-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    console.log('[Library] Playing all tracks from album:', album);
    const queue = await import('./queue.js');
    await queue.playTrackWithQueue(tracks[0], tracks);
  });
  
  div.appendChild(header);
  
  const trackList = document.createElement('div');
  trackList.className = 'album-track-list';
  
  tracks.forEach(track => {
    const trackEl = createTrackElement(track);
    trackList.appendChild(trackEl);
  });
  
  div.appendChild(trackList);
  
  return div;
}

// Play a track
async function playTrack(track) {
  console.log('[Library] Playing track:', track.title);
  const queue = await import('./queue.js');
  // Pass currently displayed tracks so it continues playing through the filtered list
  await queue.playTrackWithQueue(track, displayedTracks.length > 0 ? displayedTracks : allTracks);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle tab switching
export function switchTab(tab) {
  // Clear selection when switching tabs
  clearSelection();
  currentTab = tab;
  displayLibrary(tab);
}

// Get all tracks
export function getAllTracks() {
  return allTracks;
}

// Show enhanced folder header
async function showEnhancedHeader(folderPath, tracks) {
  const header = document.getElementById('libraryHeader');
  const toolbar = document.getElementById('libraryToolbar');
  const columnHeaders = document.getElementById('libraryColumnHeaders');
  const tabs = document.querySelector('.library-tabs');
  
  if (!header || !toolbar) return;
  
  // Show header and toolbar, hide old tabs
  header.style.display = 'block';
  toolbar.style.display = 'flex';
  columnHeaders.style.display = 'grid';
  tabs.style.display = 'none';
  
  // Get folder name from path and remove "local:" prefix
  let folderName;
  if (folderPath === 'library:all') {
    folderName = 'Library';
  } else {
    folderName = folderPath.split('/').filter(p => p).pop() || 'Library';
    folderName = folderName.replace(/^local:/i, '').trim();
  }
  
  // Update title
  document.getElementById('libraryTitle').textContent = folderName;
  
  // Set gradient background
  const gradient = getFolderGradient(folderPath);
  header.style.background = gradient;
  
  // Get and display folder art
  const artData = await getFolderArt(tracks, folderPath);
  const collageEl = document.getElementById('libraryArtCollage');
  const collageItems = collageEl.querySelectorAll('.collage-item');
  
  if (artData.type === 'cover') {
    // Single cover image
    collageItems.forEach((item, i) => {
      item.style.backgroundImage = i === 0 ? `url(${artData.art})` : '';
    });
  } else if (artData.type === 'collage') {
    // 2x2 collage
    artData.arts.forEach((art, i) => {
      if (collageItems[i]) {
        collageItems[i].style.backgroundImage = `url(${art})`;
      }
    });
    // Clear unused slots
    for (let i = artData.arts.length; i < 4; i++) {
      collageItems[i].style.backgroundImage = '';
    }
  } else {
    // Icon fallback
    collageItems[0].style.backgroundImage = `url(${artData.art})`;
    for (let i = 1; i < 4; i++) {
      collageItems[i].style.backgroundImage = '';
    }
  }
  
  // Calculate metadata
  const trackCount = tracks.length;
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const durationText = formatDuration(totalDuration);
  
  // Detect source (check first track)
  const source = tracks.length > 0 ? getTrackSource(tracks[0]) : 'Unknown';
  
  // Update metadata
  document.querySelector('#libraryStats .playlist-song-count').textContent = 
    `${trackCount} ${trackCount === 1 ? 'song' : 'songs'}`;
  document.querySelector('#libraryStats .playlist-duration').textContent = durationText;
  document.querySelector('#libraryStats .playlist-date-created').textContent = source;
  
  // Setup toolbar listeners
  setupToolbarListeners(folderPath, tracks);
  
  // Store current folder
  currentFolderPath = folderPath;
}

// Format duration
function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds === 0) return '0 min';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}

// Setup toolbar event listeners
function setupToolbarListeners(folderPath, tracks) {
  // Back button - go to home
  const backBtn = document.getElementById('libraryBackBtn');
  backBtn.replaceWith(backBtn.cloneNode(true));
  document.getElementById('libraryBackBtn').addEventListener('click', async () => {
    hideEnhancedHeader();
    clearFilter();
    // Navigate to home screen
    const app = await import('./app.js');
    app.showScreen('home');
  });
  
  // Play All button
  const playBtn = document.getElementById('playLibraryBtn');
  playBtn.replaceWith(playBtn.cloneNode(true));
  document.getElementById('playLibraryBtn').addEventListener('click', async () => {
    if (tracks.length > 0) {
      const queue = await import('./queue.js');
      await queue.playTrackWithQueue(tracks[0], tracks);
    }
  });
  
  // Shuffle button
  const shuffleBtn = document.getElementById('shuffleLibraryBtn');
  shuffleBtn.replaceWith(shuffleBtn.cloneNode(true));
  const newShuffleBtn = document.getElementById('shuffleLibraryBtn');
  if (shuffleEnabled) {
    newShuffleBtn.classList.add('active');
  }
  newShuffleBtn.addEventListener('click', () => {
    shuffleEnabled = !shuffleEnabled;
    if (shuffleEnabled) {
      newShuffleBtn.classList.add('active');
      showToast('Shuffle on', 'info');
    } else {
      newShuffleBtn.classList.remove('active');
      showToast('Shuffle off', 'info');
    }
  });
  
  // Search button
  const searchBtn = document.getElementById('searchLibraryBtn');
  searchBtn.replaceWith(searchBtn.cloneNode(true));
  document.getElementById('searchLibraryBtn').addEventListener('click', () => {
    toggleLibrarySearch();
  });
  
  // Sort/View button
  const sortBtn = document.getElementById('sortViewLibraryBtn');
  sortBtn.replaceWith(sortBtn.cloneNode(true));
  document.getElementById('sortViewLibraryBtn').addEventListener('click', () => {
    // For now, just show toast - full implementation would need modal
    showToast('Sort options coming soon', 'info');
  });
  
  // Search input
  const searchInput = document.getElementById('librarySearchInput');
  searchInput.replaceWith(searchInput.cloneNode(true));
  document.getElementById('librarySearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    filterByFolder(folderPath); // Re-filter with search
  });
  
  // Close search button
  const closeSearchBtn = document.getElementById('closeLibrarySearchBtn');
  closeSearchBtn.replaceWith(closeSearchBtn.cloneNode(true));
  document.getElementById('closeLibrarySearchBtn').addEventListener('click', () => {
    searchQuery = '';
    document.getElementById('librarySearchInput').value = '';
    toggleLibrarySearch();
    filterByFolder(folderPath);
  });
}

// Toggle library search bar
function toggleLibrarySearch() {
  const searchBar = document.getElementById('librarySearchBar');
  const searchBtn = document.getElementById('searchLibraryBtn');
  
  if (searchBar.style.display === 'none' || !searchBar.style.display) {
    searchBar.style.display = 'flex';
    searchBtn.classList.add('active');
    document.getElementById('librarySearchInput').focus();
  } else {
    searchBar.style.display = 'none';
    searchBtn.classList.remove('active');
  }
}

// Hide enhanced header
function hideEnhancedHeader() {
  const tabs = document.querySelector('.library-tabs');
  
  document.getElementById('libraryHeader').style.display = 'none';
  document.getElementById('libraryToolbar').style.display = 'none';
  document.getElementById('libraryColumnHeaders').style.display = 'none';
  document.getElementById('librarySearchBar').style.display = 'none';
  tabs.style.display = 'flex'; // Restore tabs
  currentFolderPath = null;
}

// Filter library by folder path
export async function filterByFolder(folderPath) {
  console.log('[Library] Filtering by folder:', folderPath);
  
  // Filter tracks to this folder
  let filteredTracks = allTracks.filter(track => 
    track.path.startsWith(folderPath)
  );
  
  // Apply search query if exists
  if (searchQuery) {
    filteredTracks = filteredTracks.filter(track => {
      const title = (track.title || '').toLowerCase();
      const artist = (track.artist || '').toLowerCase();
      const album = (track.album || '').toLowerCase();
      return title.includes(searchQuery) || artist.includes(searchQuery) || album.includes(searchQuery);
    });
  }
  
  console.log(`[Library] Found ${filteredTracks.length} tracks in folder`);
  
  // Show enhanced header
  await showEnhancedHeader(folderPath, filteredTracks);
  
  // Display filtered tracks
  currentTab = 'songs';
  displayedTracks = filteredTracks;
  
  const libraryContent = document.getElementById('libraryContent');
  libraryContent.innerHTML = '';
  
  if (filteredTracks.length === 0) {
    libraryContent.innerHTML = '<div class="empty-state"><p>No tracks in this folder</p></div>';
    return;
  }
  
  // Sort and display tracks
  const sortedTracks = sortTracks(filteredTracks);
  sortedTracks.forEach((track, index) => {
    const trackEl = createEnhancedTrackElement(track, index + 1);
    libraryContent.appendChild(trackEl);
  });
  
  // Update tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'songs');
  });
}

// Sort tracks based on current order
function sortTracks(tracks) {
  const sorted = [...tracks];
  
  switch (currentSortOrder) {
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'artist':
      sorted.sort((a, b) => a.artist.localeCompare(b.artist));
      break;
    case 'album':
      sorted.sort((a, b) => a.album.localeCompare(b.album));
      break;
    case 'duration':
      sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    default:
      break;
  }
  
  return sorted;
}

// Create enhanced track element (grid layout like playlists)
function createEnhancedTrackElement(track, trackNumber) {
  const div = document.createElement('div');
  div.className = 'track-item playlist-track-item';
  div.dataset.trackId = track.id;
  
  const albumArtSrc = track.albumArt || 'assets/icons/icon-song-black..png';
  const durationText = formatTrackDuration(track.duration);
  
  div.innerHTML = `
    <div class="track-number-cell">
      <div class="track-number">${trackNumber}</div>
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
      <div class="track-item-info">
        <div class="track-item-title">${escapeHtml(track.title)}</div>
        <div class="track-item-artist">${escapeHtml(track.artist)}</div>
      </div>
    </div>
    <div class="track-item-album">${escapeHtml(track.album)}</div>
    <div class="track-item-artist">${escapeHtml(track.artist)}</div>
    <div class="track-item-duration">${durationText}</div>
    <button class="track-more-btn">⋮</button>
  `;
  
  // Play button - single click to play/pause
  const playBtn = div.querySelector('.track-play-btn');
  playBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const player = await import('./player.js');
    const currentTrack = player.getCurrentTrack();
    
    // Check if this is the current track
    if (currentTrack && currentTrack.id === track.id) {
      // Same track - toggle play/pause
      player.togglePlayPause();
    } else {
      // Different track - play it
      playTrack(track);
    }
  });
  
  // Update play button text dynamically when hovering
  div.addEventListener('mouseenter', async () => {
    const player = await import('./player.js');
    const currentTrack = player.getCurrentTrack();
    const isPlaying = player.isPlaying();
    
    if (currentTrack && currentTrack.id === track.id && isPlaying) {
      playBtn.textContent = '⏸';
    } else {
      playBtn.textContent = '▶';
    }
  });
  
  // Click handling (same as before)
  let clickTimer = null;
  div.addEventListener('click', (e) => {
    if (e.target.classList.contains('track-more-btn') || 
        e.target.classList.contains('track-play-btn')) {
      return;
    }
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      playTrack(track);
      return;
    }
    
    if (clickTimer === null) {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      clickTimer = setTimeout(() => {
        const syntheticEvent = { ctrlKey: isCtrlOrCmd, metaKey: isCtrlOrCmd, shiftKey: isShift };
        handleTrackSelection(track.id, div, syntheticEvent);
        clickTimer = null;
      }, 300);
    } else {
      clearTimeout(clickTimer);
      clickTimer = null;
      playTrack(track);
    }
  });
  
  // More button
  div.querySelector('.track-more-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    showTrackMenu(track, e.target);
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

// Filter library by artist
export function filterByArtist(artistName) {
  console.log('[Library] Filtering by artist:', artistName);
  
  // Filter tracks to this artist
  const filteredTracks = allTracks.filter(track => 
    track.artist === artistName
  );
  
  console.log(`[Library] Found ${filteredTracks.length} tracks by artist`);
  
  // Display filtered tracks in Artists view
  currentTab = 'artists';
  displayArtists(filteredTracks);
  
  // Update tabs to show Artists is active
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'artists') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Scroll to the artist section
  setTimeout(() => {
    const artistGroup = document.querySelector('.artist-group');
    if (artistGroup) {
      artistGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight the artist group
      artistGroup.style.backgroundColor = 'rgba(29, 185, 84, 0.1)';
      setTimeout(() => {
        artistGroup.style.backgroundColor = '';
      }, 1500);
    }
  }, 100);
  
  // Update search input placeholder to show filter
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.placeholder = `Showing ${artistName}...`;
  }
}

// Show all tracks with enhanced header (called when clicking Library nav button)
export async function showAllTracks() {
  console.log('[Library] Showing all tracks with enhanced header');
  
  // Clear search query
  searchQuery = '';
  
  // Get all tracks
  const tracks = allTracks;
  
  if (tracks.length === 0) {
    console.log('[Library] No tracks to display');
    return;
  }
  
  // Show enhanced header for "All Library"
  await showEnhancedHeader('library:all', tracks);
  
  // Display tracks
  currentTab = 'songs';
  displayedTracks = tracks;
  
  const libraryContent = document.getElementById('libraryContent');
  libraryContent.innerHTML = '';
  
  // Sort and display tracks
  const sortedTracks = sortTracks(tracks);
  sortedTracks.forEach((track, index) => {
    const trackEl = createEnhancedTrackElement(track, index + 1);
    libraryContent.appendChild(trackEl);
  });
  
  // Update tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'songs');
  });
}

// Update all metadata from ID3 tags for local tracks
export async function updateMissingDurations() {
  console.log('[Library] Refreshing metadata from ID3 tags...');
  
  const tracks = await storage.getAllTracks();
  
  // Filter to local files only
  const localTracks = tracks.filter(t => t.source === 'local' || t.path?.startsWith('local:'));
  
  if (localTracks.length === 0) {
    console.log('[Library] No local tracks to update');
    showToast('No local tracks found', 'info');
    return 0;
  }
  
  console.log(`[Library] Updating metadata for ${localTracks.length} local tracks...`);
  
  const id3Reader = await import('./id3-reader.js');
  const localFilesModule = await import('./local-files.js');
  let updatedCount = 0;
  let processedCount = 0;
  
  // Process tracks in batches
  for (const track of localTracks) {
    try {
      processedCount++;
      
      // Show progress every 10 tracks
      if (processedCount % 10 === 0) {
        showToast(`Updating metadata... (${processedCount}/${localTracks.length})`, 'info');
      }
      
      // Get file handle
      let fileHandle = track.fileHandle;
      if (!fileHandle) {
        const fullTrack = await storage.getTrackById(track.id);
        fileHandle = fullTrack?.fileHandle;
      }
      
      if (!fileHandle) {
        console.warn(`[Library] No file handle for: ${track.title}`);
        continue;
      }
      
      // Verify permission
      const hasPermission = await localFilesModule.verifyPermission(fileHandle);
      if (!hasPermission) {
        console.warn(`[Library] No permission for: ${track.title}`);
        continue;
      }
      
      // Get file and read ID3 tags
      const file = await fileHandle.getFile();
      const metadata = await id3Reader.readAudioFileMetadata(file);
      
      // Get duration from audio element
      const duration = await getDurationFromFile(fileHandle);
      
      // Check if any metadata needs updating
      let needsUpdate = false;
      const updates = {};
      
      // Title
      if (metadata.title && metadata.title !== track.title) {
        updates.title = metadata.title;
        needsUpdate = true;
      }
      
      // Artist
      if (metadata.artist && metadata.artist !== track.artist) {
        updates.artist = metadata.artist;
        needsUpdate = true;
      }
      
      // Album
      if (metadata.album && metadata.album !== track.album) {
        updates.album = metadata.album;
        needsUpdate = true;
      }
      
      // Album Art
      if (metadata.albumArt && metadata.albumArt !== track.albumArt) {
        updates.albumArt = metadata.albumArt;
        needsUpdate = true;
      }
      
      // Duration - always update if we can get it from the file
      if (duration && duration > 0) {
        // Update if missing, zero, or different from stored value
        if (!track.duration || track.duration === 0 || Math.abs(track.duration - duration) > 1) {
          updates.duration = duration;
          needsUpdate = true;
        }
      }
      
      // Save if anything changed
      if (needsUpdate) {
        const updatedTrack = { ...track, ...updates };
        await storage.saveTrack(updatedTrack);
        updatedCount++;
        console.log(`[Library] Updated metadata for: ${track.title}`, updates);
      }
      
    } catch (error) {
      console.error(`[Library] Failed to update metadata for ${track.title}:`, error);
    }
  }
  
  console.log(`[Library] Updated ${updatedCount}/${localTracks.length} tracks`);
  return updatedCount;
}

// Get duration from audio file using audio element
async function getDurationFromFile(fileHandle) {
  return new Promise(async (resolve, reject) => {
    try {
      const localFiles = await import('./local-files.js');
      const fileUrl = await localFiles.getFileUrl(fileHandle);
      
      const audio = new Audio();
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        audio.src = ''; // Clean up
        localFiles.revokeFileUrl(fileUrl);
        resolve(duration);
      });
      
      audio.addEventListener('error', () => {
        audio.src = ''; // Clean up
        localFiles.revokeFileUrl(fileUrl);
        reject(new Error('Failed to load audio'));
      });
      
      audio.src = fileUrl;
      audio.load();
      
      // Timeout after 3 seconds
      setTimeout(() => {
        audio.src = '';
        localFiles.revokeFileUrl(fileUrl);
        reject(new Error('Timeout loading audio'));
      }, 3000);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Clear folder filter
export function clearFilter() {
  // Reset search placeholder
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.placeholder = 'Search songs, artists, albums...';
  }
  
  // Redisplay full library
  displayLibrary(currentTab);
}
