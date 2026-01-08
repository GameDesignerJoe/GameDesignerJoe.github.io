// Main App Entry Point
import config from '../config.js';
import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as folderBrowser from './folder-browser.js';
import * as sources from './sources.js';
import * as home from './home.js';
import * as library from './library.js';
import * as playlists from './playlists.js';
import * as player from './player.js';
import * as queue from './queue.js';
import * as mediaSession from './media-session.js';
import * as search from './search.js';

// App State
const appState = {
  isAuthenticated: false,
  currentScreen: 'auth',
  accessToken: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Initializing Music Player PWA');
  
  // Register service worker
  registerServiceWorker();
  
  // Check authentication status
  checkAuthentication();
  
  // Setup event listeners
  setupEventListeners();
  
  // Handle OAuth callback if present
  handleOAuthCallback();
});

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error);
      });
  }
}

// Check if user is authenticated
async function checkAuthentication() {
  if (dropbox.isAuthenticated()) {
    appState.isAuthenticated = true;
    appState.accessToken = dropbox.getAccessToken();
    console.log('[App] User is authenticated');
    
    // Test connection
    testDropboxConnection();
    
    // Initialize modules
    player.init();
    queue.init();
    mediaSession.init();
    search.init();
    await folderBrowser.init();
    await sources.init();
    await home.init();
    await library.init();
    await playlists.init();
    
    // Check if we should show Sources screen on first launch
    if (sources.shouldShowSourcesOnLaunch()) {
      showScreen('sources');
      showToast('👋 Add music folders to get started', 'info');
    } else {
      showScreen('home');
    }
    
    showHeaderActions();
  } else {
    console.log('[App] User not authenticated');
    showScreen('auth');
  }
}

// Test Dropbox connection
async function testDropboxConnection() {
  try {
    const isConnected = await dropbox.testConnection();
    if (isConnected) {
      console.log('[App] Dropbox connection verified');
    }
  } catch (error) {
    console.error('[App] Dropbox connection test failed:', error);
    
    // Check if it's an auth error
    if (error.message.includes('Authentication expired') || error.message.includes('Authentication expired')) {
      showToast('⚠️ Session expired. Please reconnect to Dropbox.', 'error');
      
      // Wait a moment then redirect to auth screen
      setTimeout(() => {
        disconnect(false); // Pass false to skip confirmation
      }, 2000);
    } else {
      showToast('Connection to Dropbox failed. Please try reconnecting.', 'error');
    }
  }
}

// Handle OAuth callback
async function handleOAuthCallback() {
  const accessToken = dropbox.handleOAuthCallback();
  
  if (accessToken) {
    appState.isAuthenticated = true;
    appState.accessToken = accessToken;
    
    console.log('[App] Authentication successful');
    
    // Initialize modules (same as checkAuthentication)
    player.init();
    queue.init();
    mediaSession.init();
    search.init();
    await folderBrowser.init();
    await sources.init();
    await home.init();
    await library.init();
    await playlists.init();
    
    // Check if we should show Sources screen on first launch
    if (sources.shouldShowSourcesOnLaunch()) {
      showScreen('sources');
      showToast('👋 Add music folders to get started', 'info');
    } else {
      showScreen('home');
    }
    
    showHeaderActions();
    
    // Show success toast
    showToast('Connected to Dropbox!', 'success');
    
    // Test connection
    testDropboxConnection();
  }
}

// Show specific screen
function showScreen(screenName) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show requested screen
  const screen = document.getElementById(`${screenName}Screen`);
  if (screen) {
    screen.classList.add('active');
    appState.currentScreen = screenName;
  }
  
  // Update nav buttons
  updateNavButtons(screenName);
}

// Update navigation button states
function updateNavButtons(activeScreen) {
  // Update bottom nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const screenName = btn.dataset.screen;
    if (screenName === activeScreen) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update sidebar nav buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    const screenName = btn.dataset.screen;
    if (screenName === activeScreen) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Show header actions after authentication
function showHeaderActions() {
  // Show sidebar on desktop
  const sidebar = document.getElementById('appSidebar');
  const appContainer = document.getElementById('app');
  
  if (sidebar) {
    sidebar.style.display = 'flex';
    
    // Restore saved collapse state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      appContainer?.classList.add('sidebar-collapsed');
    }
  }
}

// Hide header actions
function hideHeaderActions() {
  // Hide sidebar
  const sidebar = document.getElementById('appSidebar');
  if (sidebar) {
    sidebar.style.display = 'none';
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Connect to Dropbox button
  document.getElementById('connectDropboxBtn')?.addEventListener('click', connectToDropbox);
  
  // Disconnect button
  document.getElementById('disconnectBtn')?.addEventListener('click', disconnect);
  
  // Global Search button
  document.getElementById('globalSearchBtn')?.addEventListener('click', () => {
    search.openSearch();
  });
  
  // Bottom Navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      showScreen(screen);
    });
  });
  
  // Sidebar Navigation buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      showScreen(screen);
    });
  });
  
  // Library tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active tab
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      console.log('[App] Switching to tab:', tab);
      library.switchTab(tab);
    });
  });
  
  // Add Songs button (will be created dynamically by library module)
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'addSongsBtn') {
      await folderBrowser.showFolderBrowser();
    }
  });
  
  // Refresh Library button - Rescan folders and update library
  document.getElementById('refreshLibraryBtn')?.addEventListener('click', async () => {
    showToast('Refreshing library...', 'info');
    
    try {
      // Test Dropbox connection first
      const isConnected = await dropbox.testConnection();
      if (!isConnected) {
        showToast('Connection failed. Please check Dropbox.', 'error');
        return;
      }
      
      // Get selected folders and rescan
      const selectedFolders = sources.getSelectedFolders();
      if (selectedFolders.length === 0) {
        showToast('No folders selected. Go to Sources to add music.', 'info');
        return;
      }
      
      // Rescan folders
      const scanner = await import('./scanner.js');
      await scanner.scanSelectedFolders(selectedFolders);
      
      // Refresh library display
      await library.refreshLibrary();
      
      showToast('✓ Library refreshed successfully!', 'success');
      
    } catch (error) {
      console.error('[App] Refresh failed:', error);
      showToast('Refresh failed. Please try again.', 'error');
    }
  });
  
  // Refresh Folders button on Home screen
  document.getElementById('refreshFoldersBtn')?.addEventListener('click', async () => {
    await home.refreshFolderMetadata();
  });
  
  // Search input
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value;
    if (query) {
      clearSearchBtn.style.display = 'flex';
    } else {
      clearSearchBtn.style.display = 'none';
    }
    // Update library search
    library.setSearchQuery(query);
  });
  
  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    // Clear library search
    library.setSearchQuery('');
  });
  
  // Player controls
  document.getElementById('playPauseBtn')?.addEventListener('click', () => {
    player.togglePlayPause();
  });
  
  document.getElementById('skipBackBtn')?.addEventListener('click', () => {
    queue.skipToPrevious();
  });
  
  document.getElementById('skipForwardBtn')?.addEventListener('click', () => {
    queue.skipToNext();
  });
  
  // Player screen navigation
  document.getElementById('closePlayerBtn')?.addEventListener('click', () => {
    document.getElementById('playerScreen').classList.remove('active');
  });
  
  document.getElementById('queueBtn')?.addEventListener('click', () => {
    showScreen('queue');
  });
  
  // Mini player
  document.getElementById('miniPlayerContent')?.addEventListener('click', () => {
    document.getElementById('playerScreen').classList.add('active');
  });
  
  document.getElementById('miniPlayPauseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    player.togglePlayPause();
  });
  
  // Queue screen
  document.getElementById('closeQueueBtn')?.addEventListener('click', () => {
    showScreen('library');
  });
  
  document.getElementById('clearQueueBtn')?.addEventListener('click', () => {
    queue.clearQueue();
  });
  
  // Playlist creation (main screen)
  document.getElementById('createPlaylistBtn')?.addEventListener('click', async () => {
    const name = prompt('Enter playlist name:');
    if (name) {
      const newPlaylist = await playlists.createPlaylist(name);
      if (newPlaylist) {
        // Open the playlist after creation
        playlists.viewPlaylist(newPlaylist.id);
      }
    }
  });
  
  // Playlist creation (sidebar)
  document.getElementById('sidebarCreatePlaylistBtn')?.addEventListener('click', async () => {
    const name = prompt('Enter playlist name:');
    if (name) {
      const newPlaylist = await playlists.createPlaylist(name);
      if (newPlaylist) {
        // Open the playlist after creation
        playlists.viewPlaylist(newPlaylist.id);
      }
    }
  });
  
  // Sidebar collapse/expand
  document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('appSidebar');
    const appContainer = document.getElementById('app');
    
    if (sidebar && appContainer) {
      sidebar.classList.toggle('collapsed');
      appContainer.classList.toggle('sidebar-collapsed');
      
      // Save state to localStorage
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
  });
  
  // Playlist detail screen
  document.getElementById('closePlaylistDetailBtn')?.addEventListener('click', () => {
    showScreen('playlists');
  });
  
  document.getElementById('playlistDetailMenuBtn')?.addEventListener('click', (e) => {
    if (window.currentPlaylistId) {
      // Import playlists dynamically to avoid circular dependency
      import('./playlists.js').then(({ getAllPlaylists }) => {
        const allPlaylists = getAllPlaylists();
        const playlist = allPlaylists.find(p => p.id === window.currentPlaylistId);
        if (playlist) {
          showPlaylistMenuForDetail(window.currentPlaylistId, playlist.name, e.target);
        }
      });
    }
  });
  
  document.getElementById('playPlaylistDetailBtn')?.addEventListener('click', () => {
    if (window.currentPlaylistId) {
      playlists.playPlaylist(window.currentPlaylistId);
    }
  });
  
  // Volume control
  document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    player.setVolume(volume);
  });
  
  // Shuffle button
  document.getElementById('shuffleBtn')?.addEventListener('click', () => {
    queue.toggleShuffle();
  });
  
  // Repeat button
  document.getElementById('repeatBtn')?.addEventListener('click', () => {
    queue.toggleRepeat();
  });
  
  // Timeline seeking
  setupTimelineControls();
}

// Setup timeline drag/seek controls
function setupTimelineControls() {
  const timeline = document.getElementById('timeline');
  let isDragging = false;
  
  if (!timeline) return;
  
  const startDrag = (e) => {
    isDragging = true;
    timeline.classList.add('dragging');
    seek(e);
  };
  
  const drag = (e) => {
    if (isDragging) {
      seek(e);
    }
  };
  
  const endDrag = () => {
    isDragging = false;
    timeline.classList.remove('dragging');
  };
  
  const seek = (e) => {
    const rect = timeline.getBoundingClientRect();
    const x = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    // Seek the player
    player.seekTo(percentage);
  };
  
  // Mouse events
  timeline.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', endDrag);
  
  // Touch events
  timeline.addEventListener('touchstart', startDrag);
  document.addEventListener('touchmove', drag);
  document.addEventListener('touchend', endDrag);
}

// Connect to Dropbox (initiate OAuth flow)
function connectToDropbox() {
  dropbox.initiateOAuth();
}

// Disconnect from Dropbox
function disconnect(showConfirmation = true) {
  if (showConfirmation && !confirm('Are you sure you want to disconnect from Dropbox?')) {
    return; // User cancelled
  }
  
  // Clear stored token
  dropbox.clearAccessToken();
  
  // Clear app state
  appState.isAuthenticated = false;
  appState.accessToken = null;
  
  // Hide header actions
  hideHeaderActions();
  
  // Show auth screen
  showScreen('auth');
  
  // Show toast if not auto-disconnect
  if (showConfirmation) {
    showToast('Disconnected from Dropbox', 'success');
  }
  
  console.log('[App] User disconnected');
  
  // TODO: Clear IndexedDB data
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Format time in seconds to MM:SS
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Show playlist menu for detail screen
function showPlaylistMenuForDetail(playlistId, playlistName, buttonElement) {
  // Remove existing menu
  const existingMenu = document.getElementById('playlistDetailMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.id = 'playlistDetailMenu';
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
        const newName = prompt('Enter new playlist name:', playlistName);
        if (newName) {
          await playlists.renamePlaylist(playlistId, newName);
          // Refresh the view
          playlists.viewPlaylist(playlistId);
        }
      } else if (action === 'delete') {
        await playlists.deletePlaylist(playlistId);
        // Go back to playlists screen
        showScreen('playlists');
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

// Export for use in other modules
export { appState, showScreen, showToast, formatTime };
