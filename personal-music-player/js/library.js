// Library Module
// Handles displaying tracks in the library

import * as storage from './storage.js';

let allTracks = [];
let displayedTracks = []; // Currently displayed/filtered tracks
let currentTab = 'songs';
let searchQuery = '';
let updateInterval = null;

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
  
  // Use album art if available, otherwise default icon
  const albumArtSrc = track.albumArt || 'assets/icons/icon-song-black..png';
  
  div.innerHTML = `
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
  
  // Add click event to play track
  div.addEventListener('click', (e) => {
    if (!e.target.classList.contains('track-more-btn')) {
      playTrack(track);
    }
  });
  
  // More button click handler
  const moreBtn = div.querySelector('.track-more-btn');
  moreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const playlists = await import('./playlists.js');
    playlists.showAddToPlaylistMenu(track, moreBtn);
  });
  
  return div;
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
  currentTab = tab;
  displayLibrary(tab);
}

// Get all tracks
export function getAllTracks() {
  return allTracks;
}

// Filter library by folder path
export function filterByFolder(folderPath) {
  console.log('[Library] Filtering by folder:', folderPath);
  
  // Filter tracks to this folder
  const filteredTracks = allTracks.filter(track => 
    track.path.startsWith(folderPath)
  );
  
  console.log(`[Library] Found ${filteredTracks.length} tracks in folder`);
  
  // Display filtered tracks in Songs view
  currentTab = 'songs';
  displaySongs(filteredTracks);
  
  // Update tabs to show Songs is active
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'songs') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update search input placeholder to show filter
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const folderName = folderPath.split('/').filter(p => p).pop() || 'folder';
    searchInput.placeholder = `Search in ${folderName}...`;
  }
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
