// Main App Entry Point
import config from '../config.js';
import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as folderBrowser from './folder-browser.js';
import * as library from './library.js';
import * as player from './player.js';

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
    await folderBrowser.init();
    await library.init();
    
    // Show library screen
    showScreen('library');
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
    showToast('Connection to Dropbox failed. Please try reconnecting.', 'error');
  }
}

// Handle OAuth callback
function handleOAuthCallback() {
  const accessToken = dropbox.handleOAuthCallback();
  
  if (accessToken) {
    appState.isAuthenticated = true;
    appState.accessToken = accessToken;
    
    // Show library
    showScreen('library');
    showHeaderActions();
    
    // Show success toast
    showToast('Connected to Dropbox!', 'success');
    
    console.log('[App] Authentication successful');
    
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
  document.querySelectorAll('.nav-btn').forEach(btn => {
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
  document.getElementById('refreshLibraryBtn').style.display = 'flex';
  document.getElementById('disconnectBtn').style.display = 'flex';
}

// Hide header actions
function hideHeaderActions() {
  document.getElementById('refreshLibraryBtn').style.display = 'none';
  document.getElementById('disconnectBtn').style.display = 'none';
}

// Setup all event listeners
function setupEventListeners() {
  // Connect to Dropbox button
  document.getElementById('connectDropboxBtn')?.addEventListener('click', connectToDropbox);
  
  // Disconnect button
  document.getElementById('disconnectBtn')?.addEventListener('click', disconnect);
  
  // Navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
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
  
  // Refresh Library button
  document.getElementById('refreshLibraryBtn')?.addEventListener('click', async () => {
    await folderBrowser.showFolderBrowser();
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
    // TODO: Implement search
  });
  
  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    // TODO: Clear search results
  });
  
  // Player controls
  document.getElementById('playPauseBtn')?.addEventListener('click', () => {
    player.togglePlayPause();
  });
  
  document.getElementById('skipBackBtn')?.addEventListener('click', () => {
    console.log('[App] Skip back clicked');
    // TODO: Implement skip back in Milestone 5
  });
  
  document.getElementById('skipForwardBtn')?.addEventListener('click', () => {
    console.log('[App] Skip forward clicked');
    // TODO: Implement skip forward in Milestone 5
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
    console.log('[App] Clear queue clicked');
    // TODO: Implement clear queue
  });
  
  // Playlist creation
  document.getElementById('createPlaylistBtn')?.addEventListener('click', () => {
    console.log('[App] Create playlist clicked');
    // TODO: Implement create playlist
  });
  
  // Volume control
  document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    player.setVolume(volume);
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
function disconnect() {
  if (confirm('Are you sure you want to disconnect from Dropbox?')) {
    // Clear stored token
    dropbox.clearAccessToken();
    
    // Clear app state
    appState.isAuthenticated = false;
    appState.accessToken = null;
    
    // Hide header actions
    hideHeaderActions();
    
    // Show auth screen
    showScreen('auth');
    
    // Show toast
    showToast('Disconnected from Dropbox', 'success');
    
    console.log('[App] User disconnected');
    
    // TODO: Clear IndexedDB data
  }
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

// Export for use in other modules
export { appState, showScreen, showToast, formatTime };
