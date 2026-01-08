// Search Module
// Global search across folders, songs, artists, albums, and playlists

import * as storage from './storage.js';
import * as home from './home.js';
import * as library from './library.js';
import { showScreen, showToast } from './app.js';

let searchTimeout = null;
let isSearchOpen = false;

// Initialize search
export function init() {
  console.log('[Search] Initializing search module');
  setupSearchModal();
  setupKeyboardShortcuts();
}

// Setup search modal event listeners
function setupSearchModal() {
  const searchModal = document.getElementById('searchModal');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('globalSearchInput');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  
  // Close on overlay click
  searchOverlay?.addEventListener('click', closeSearch);
  
  // Close on close button
  closeSearchBtn?.addEventListener('click', closeSearch);
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchOpen) {
      closeSearch();
    }
  });
  
  // Search input handler with debounce
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  // Prevent modal close when clicking inside
  searchModal?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Setup keyboard shortcuts (Ctrl/Cmd + K)
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
  });
}

// Open search modal
export function openSearch() {
  console.log('[Search] Opening search');
  
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('globalSearchInput');
  
  if (searchOverlay) {
    searchOverlay.classList.add('active');
    isSearchOpen = true;
    
    // Focus input after animation
    setTimeout(() => {
      searchInput?.focus();
    }, 100);
    
    // Show recent/popular if empty
    if (!searchInput?.value) {
      showDefaultResults();
    }
  }
}

// Close search modal
export function closeSearch() {
  console.log('[Search] Closing search');
  
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('globalSearchInput');
  
  if (searchOverlay) {
    searchOverlay.classList.remove('active');
    isSearchOpen = false;
    
    // Clear input and results
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Clear results after animation
    setTimeout(() => {
      const resultsContainer = document.getElementById('searchResults');
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
      }
    }, 300);
  }
}

// Show default results (recent folders, suggestions)
async function showDefaultResults() {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;
  
  const folders = home.getAllFolders();
  
  resultsContainer.innerHTML = `
    <div class="search-section">
      <h3 class="search-section-title">Quick Access</h3>
      <p class="search-hint">Try searching for songs, artists, albums, folders, or playlists</p>
      ${folders.length > 0 ? `
        <p class="search-hint">💡 Tip: Press <kbd>Ctrl+K</kbd> or <kbd>Cmd+K</kbd> to quickly open search</p>
      ` : ''}
    </div>
  `;
}

// Perform search across all data
async function performSearch(query) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;
  
  // Show loading
  if (query.length === 0) {
    showDefaultResults();
    return;
  }
  
  if (query.length < 2) {
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <p>Type at least 2 characters to search</p>
      </div>
    `;
    return;
  }
  
  resultsContainer.innerHTML = `
    <div class="search-loading">
      <div class="spinner"></div>
      <p>Searching...</p>
    </div>
  `;
  
  console.log('[Search] Searching for:', query);
  const lowerQuery = query.toLowerCase();
  
  try {
    // Get all data
    const [tracks, folders, playlists] = await Promise.all([
      storage.getAllTracks(),
      storage.getAllFoldersWithMetadata(),
      storage.getAllPlaylists()
    ]);
    
    // Search folders
    const folderResults = folders.filter(folder =>
      folder.name.toLowerCase().includes(lowerQuery)
    );
    
    // Search songs
    const songResults = tracks.filter(track =>
      track.title.toLowerCase().includes(lowerQuery) ||
      (track.artist && track.artist.toLowerCase().includes(lowerQuery)) ||
      (track.album && track.album.toLowerCase().includes(lowerQuery))
    );
    
    // Search artists (unique)
    const artistMap = {};
    tracks.forEach(track => {
      const artist = track.artist || 'Unknown Artist';
      const artistLower = artist.toLowerCase();
      if (artistLower.includes(lowerQuery) && !artistMap[artist]) {
        artistMap[artist] = tracks.filter(t => (t.artist || 'Unknown Artist') === artist);
      }
    });
    const artistResults = Object.entries(artistMap);
    
    // Search albums (unique)
    const albumMap = {};
    tracks.forEach(track => {
      const album = track.album || 'Unknown Album';
      const albumLower = album.toLowerCase();
      if (albumLower.includes(lowerQuery) && !albumMap[album]) {
        albumMap[album] = {
          artist: track.artist || 'Unknown Artist',
          tracks: tracks.filter(t => (t.album || 'Unknown Album') === album)
        };
      }
    });
    const albumResults = Object.entries(albumMap);
    
    // Search playlists
    const playlistResults = playlists.filter(playlist =>
      playlist.name.toLowerCase().includes(lowerQuery)
    );
    
    // Display results
    displaySearchResults({
      folders: folderResults,
      songs: songResults.slice(0, 10), // Limit to 10 songs
      artists: artistResults.slice(0, 5), // Limit to 5 artists
      albums: albumResults.slice(0, 5), // Limit to 5 albums
      playlists: playlistResults
    }, query);
    
  } catch (error) {
    console.error('[Search] Error searching:', error);
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <p>Error searching. Please try again.</p>
      </div>
    `;
  }
}

// Display search results
function displaySearchResults(results, query) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;
  
  const { folders, songs, artists, albums, playlists } = results;
  const totalResults = folders.length + songs.length + artists.length + albums.length + playlists.length;
  
  if (totalResults === 0) {
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <p>No results found for "${escapeHtml(query)}"</p>
        <p class="search-hint">Try searching for something else</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  // Folders
  if (folders.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">📁 Folders (${folders.length})</h3>
        <div class="search-results-list">
          ${folders.map(folder => createFolderResult(folder)).join('')}
        </div>
      </div>
    `;
  }
  
  // Songs
  if (songs.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">🎵 Songs (${songs.length}${songs.length === 10 ? '+' : ''})</h3>
        <div class="search-results-list">
          ${songs.map(song => createSongResult(song)).join('')}
        </div>
      </div>
    `;
  }
  
  // Artists
  if (artists.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">👤 Artists (${artists.length}${artists.length === 5 ? '+' : ''})</h3>
        <div class="search-results-list">
          ${artists.map(([artist, tracks]) => createArtistResult(artist, tracks)).join('')}
        </div>
      </div>
    `;
  }
  
  // Albums
  if (albums.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">💿 Albums (${albums.length}${albums.length === 5 ? '+' : ''})</h3>
        <div class="search-results-list">
          ${albums.map(([album, data]) => createAlbumResult(album, data)).join('')}
        </div>
      </div>
    `;
  }
  
  // Playlists
  if (playlists.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">📋 Playlists (${playlists.length})</h3>
        <div class="search-results-list">
          ${playlists.map(playlist => createPlaylistResult(playlist)).join('')}
        </div>
      </div>
    `;
  }
  
  resultsContainer.innerHTML = html;
  
  // Attach click handlers
  attachResultHandlers();
}

// Create folder result HTML
function createFolderResult(folder) {
  const imageUrl = folder.coverImageUrl || 'assets/icons/icon-tape-black.png';
  return `
    <div class="search-result-item" data-type="folder" data-path="${escapeHtml(folder.path)}">
      <img src="${imageUrl}" alt="${escapeHtml(folder.name)}" class="search-result-image">
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(folder.name)}</div>
        <div class="search-result-subtitle">${folder.songCount} songs</div>
      </div>
      <div class="search-result-action">→</div>
    </div>
  `;
}

// Create song result HTML
function createSongResult(song) {
  return `
    <div class="search-result-item" data-type="song" data-id="${song.id}">
      <img src="assets/icons/icon-song-black..png" alt="Song" class="search-result-image">
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(song.title)}</div>
        <div class="search-result-subtitle">${escapeHtml(song.artist)} • ${escapeHtml(song.album)}</div>
      </div>
      <div class="search-result-action">▶</div>
    </div>
  `;
}

// Create artist result HTML
function createArtistResult(artist, tracks) {
  return `
    <div class="search-result-item" data-type="artist" data-name="${escapeHtml(artist)}">
      <div class="search-result-image search-result-icon">👤</div>
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(artist)}</div>
        <div class="search-result-subtitle">${tracks.length} songs</div>
      </div>
      <div class="search-result-action">→</div>
    </div>
  `;
}

// Create album result HTML
function createAlbumResult(album, data) {
  return `
    <div class="search-result-item" data-type="album" data-name="${escapeHtml(album)}">
      <img src="assets/icons/icon-song-black..png" alt="Album" class="search-result-image">
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(album)}</div>
        <div class="search-result-subtitle">${escapeHtml(data.artist)} • ${data.tracks.length} songs</div>
      </div>
      <div class="search-result-action">→</div>
    </div>
  `;
}

// Create playlist result HTML
function createPlaylistResult(playlist) {
  return `
    <div class="search-result-item" data-type="playlist" data-id="${playlist.id}">
      <div class="search-result-image search-result-icon">📋</div>
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(playlist.name)}</div>
        <div class="search-result-subtitle">${playlist.trackIds.length} songs</div>
      </div>
      <div class="search-result-action">→</div>
    </div>
  `;
}

// Attach click handlers to results
function attachResultHandlers() {
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', async () => {
      const type = item.dataset.type;
      
      switch (type) {
        case 'folder':
          handleFolderClick(item.dataset.path);
          break;
        case 'song':
          await handleSongClick(item.dataset.id);
          break;
        case 'artist':
          handleArtistClick(item.dataset.name);
          break;
        case 'album':
          handleAlbumClick(item.dataset.name);
          break;
        case 'playlist':
          handlePlaylistClick(item.dataset.id);
          break;
      }
    });
  });
}

// Handle folder click
function handleFolderClick(folderPath) {
  closeSearch();
  showScreen('library');
  library.filterByFolder(folderPath);
}

// Handle song click
async function handleSongClick(songId) {
  const tracks = await storage.getAllTracks();
  const track = tracks.find(t => t.id === songId);
  
  if (track) {
    closeSearch();
    const queue = await import('./queue.js');
    await queue.playTrackWithQueue(track, tracks);
  }
}

// Handle artist click
function handleArtistClick(artistName) {
  closeSearch();
  showScreen('library');
  
  // Switch to Artists tab and search
  library.switchTab('artists');
  
  // Update search to filter to this artist
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = artistName;
    library.setSearchQuery(artistName);
  }
}

// Handle album click
function handleAlbumClick(albumName) {
  closeSearch();
  showScreen('library');
  
  // Switch to Albums tab and search
  library.switchTab('albums');
  
  // Update search to filter to this album
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = albumName;
    library.setSearchQuery(albumName);
  }
}

// Handle playlist click
async function handlePlaylistClick(playlistId) {
  closeSearch();
  showScreen('playlists');
  
  // TODO: Open the specific playlist
  showToast('Playlist opened', 'success');
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
