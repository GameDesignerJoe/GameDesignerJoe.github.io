// Library Module
// Handles displaying tracks in the library

import * as storage from './storage.js';

let allTracks = [];
let currentTab = 'songs';
let searchQuery = '';

// Initialize library
export async function init() {
  console.log('[Library] Initializing library');
  await refreshLibrary();
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
  
  div.innerHTML = `
    <div class="track-item-cover">
      <img src="assets/placeholder-cover.svg" alt="Album art">
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
  
  const header = document.createElement('div');
  header.className = 'album-group-header';
  header.innerHTML = `
    <img src="assets/placeholder-cover.svg" alt="Album art" class="album-art-thumb">
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
  // Pass all tracks so it continues playing through the library
  await queue.playTrackWithQueue(track, allTracks);
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
