// Sources Module
// Handles the Sources screen for managing music source connections

import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as scanner from './scanner.js';
import { showToast } from './app.js';

// State
let selectedFolders = [];
let currentPath = '';
let currentFolders = [];
let activeSource = 'dropbox';

// Initialize Sources screen
export async function init() {
  console.log('[Sources] Initializing sources');
  
  // Load selected folders from storage
  selectedFolders = await storage.getSelectedFolders() || [];
  
  // Update counts
  updateFolderCounts();
  
  // Setup event listeners
  setupEventListeners();
  
  // If dropbox is connected, load root folders
  if (dropbox.isAuthenticated()) {
    await loadDropboxFolders('');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Source connection buttons
  document.getElementById('dropboxSourceBtn')?.addEventListener('click', () => {
    switchSource('dropbox');
  });
  
  // Breadcrumb navigation will be set up dynamically
}

// Switch between sources (Dropbox, Google Drive, etc.)
function switchSource(sourceName) {
  activeSource = sourceName;
  
  // Update active state on buttons
  document.querySelectorAll('.source-connection-btn').forEach(btn => {
    if (btn.dataset.source === sourceName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Show/hide appropriate browser
  document.querySelectorAll('.source-browser').forEach(browser => {
    browser.classList.remove('active');
  });
  
  const browserMap = {
    'dropbox': 'dropboxBrowser',
    'google-drive': 'googleDriveBrowser'
  };
  
  const browserId = browserMap[sourceName];
  if (browserId) {
    document.getElementById(browserId)?.classList.add('active');
  }
  
  // Load folders if switching to dropbox
  if (sourceName === 'dropbox' && dropbox.isAuthenticated()) {
    loadDropboxFolders(currentPath);
  }
}

// Load Dropbox folders
export async function loadDropboxFolders(path = '') {
  console.log('[Sources] Loading Dropbox folders:', path);
  
  currentPath = path;
  const folderList = document.getElementById('dropboxFolderList');
  
  if (!folderList) return;
  
  // Show loading
  folderList.innerHTML = '<div class="loading">Loading folders...</div>';
  
  try {
    // Get folders from Dropbox
    const result = await dropbox.listFolder(path);
    const folders = result.entries.filter(entry => entry['.tag'] === 'folder');
    
    currentFolders = folders;
    
    // Update breadcrumb
    updateBreadcrumb(path);
    
    // Display folders
    displayFolders(folders);
    
  } catch (error) {
    console.error('[Sources] Error loading folders:', error);
    folderList.innerHTML = `
      <div class="empty-state">
        <p>Error loading folders</p>
        <button class="btn-secondary" id="retryLoadFolders">Retry</button>
      </div>
    `;
    
    // Add event listener for retry button
    document.getElementById('retryLoadFolders')?.addEventListener('click', () => {
      loadDropboxFolders(path);
    });
  }
}

// Update breadcrumb navigation
function updateBreadcrumb(path) {
  const breadcrumb = document.getElementById('dropboxBreadcrumb');
  if (!breadcrumb) return;
  
  breadcrumb.innerHTML = '';
  
  // Add "All Files" root
  const rootItem = document.createElement('span');
  rootItem.className = 'breadcrumb-item';
  rootItem.textContent = 'All Files';
  rootItem.addEventListener('click', () => loadDropboxFolders(''));
  breadcrumb.appendChild(rootItem);
  
  // Add path segments
  if (path) {
    const segments = path.split('/').filter(s => s);
    let currentPath = '';
    
    segments.forEach(segment => {
      currentPath += '/' + segment;
      const item = document.createElement('span');
      item.className = 'breadcrumb-item';
      item.textContent = segment;
      const pathToLoad = currentPath;
      item.addEventListener('click', () => loadDropboxFolders(pathToLoad));
      breadcrumb.appendChild(item);
    });
  }
}

// Display folders
function displayFolders(folders) {
  const folderList = document.getElementById('dropboxFolderList');
  if (!folderList) return;
  
  if (folders.length === 0) {
    folderList.innerHTML = `
      <div class="empty-state">
        <p>No folders found</p>
      </div>
    `;
    return;
  }
  
  folderList.innerHTML = '';
  
  folders.forEach(folder => {
    const folderItem = createFolderItem(folder);
    folderList.appendChild(folderItem);
  });
}

// Create folder item element
function createFolderItem(folder) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  // Check if this folder is selected
  const isSelected = selectedFolders.includes(folder.path_lower);
  if (isSelected) {
    div.classList.add('selected');
  }
  
  // Check if this folder contains any selected subfolders
  const hasSelectedChildren = selectedFolders.some(selectedPath => 
    selectedPath.startsWith(folder.path_lower + '/') && selectedPath !== folder.path_lower
  );
  if (hasSelectedChildren) {
    div.classList.add('has-selected');
  }
  
  div.innerHTML = `
    <span class="folder-icon">📁</span>
    <div class="folder-info">
      <div class="folder-name">${escapeHtml(folder.name)}</div>
    </div>
    <div class="folder-actions">
      ${isSelected ? 
        '<span class="folder-checkmark">✓</span>' : 
        '<button class="folder-add-btn" title="Add folder">+</button>'
      }
    </div>
  `;
  
  // Click on folder name to navigate
  div.querySelector('.folder-info').addEventListener('click', async () => {
    await loadDropboxFolders(folder.path_lower);
  });
  
  // Click preview on folder
  div.addEventListener('click', async (e) => {
    if (!e.target.closest('.folder-actions') && !e.target.closest('.folder-info')) {
      await previewFolder(folder);
    }
  });
  
  // Add/Remove button
  const actionBtn = div.querySelector('.folder-add-btn, .folder-checkmark');
  if (actionBtn && actionBtn.classList.contains('folder-add-btn')) {
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFolderSelection(folder.path_lower);
    });
  } else if (actionBtn) {
    // Clicking checkmark removes
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFolderSelection(folder.path_lower);
    });
  }
  
  return div;
}

// Toggle folder selection
async function toggleFolderSelection(folderPath) {
  const index = selectedFolders.indexOf(folderPath);
  
  if (index === -1) {
    // Add folder
    selectedFolders.push(folderPath);
    showToast(`Folder added`, 'success');
  } else {
    // Remove folder
    selectedFolders.splice(index, 1);
    showToast(`Folder removed`, 'info');
  }
  
  // Save to storage
  await storage.saveSelectedFolders(selectedFolders);
  
  // Update UI
  updateFolderCounts();
  displayFolders(currentFolders);
  
  // Trigger rescan if folders changed
  if (selectedFolders.length > 0) {
    // Automatically scan when folders change
    await scanSelectedFolders();
  }
}

// Preview folder contents
async function previewFolder(folder) {
  console.log('[Sources] Previewing folder:', folder.name);
  
  const previewTitle = document.getElementById('previewTitle');
  const previewContent = document.getElementById('previewContent');
  
  if (!previewTitle || !previewContent) return;
  
  // Update title
  previewTitle.textContent = folder.name;
  
  // Show loading
  previewContent.innerHTML = '<div class="loading">Loading...</div>';
  
  try {
    // List folder contents
    const result = await dropbox.listFolder(folder.path_lower);
    
    // Separate folders and audio files
    const subfolders = result.entries.filter(e => e['.tag'] === 'folder');
    const audioFiles = result.entries.filter(e => 
      e['.tag'] === 'file' && isAudioFile(e.name)
    );
    
    // Display contents
    if (subfolders.length === 0 && audioFiles.length === 0) {
      previewContent.innerHTML = '<div class="empty-state"><p>Empty folder</p></div>';
      return;
    }
    
    previewContent.innerHTML = '';
    
    // Show subfolders first
    subfolders.forEach(subfolder => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon">📁</span>
        <span class="file-name subfolder">${escapeHtml(subfolder.name)}</span>
      `;
      previewContent.appendChild(item);
    });
    
    // Show audio files
    audioFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon">🎵</span>
        <span class="file-name audio-file">${escapeHtml(file.name)}</span>
      `;
      previewContent.appendChild(item);
    });
    
  } catch (error) {
    console.error('[Sources] Error previewing folder:', error);
    previewContent.innerHTML = '<div class="empty-state"><p>Error loading contents</p></div>';
  }
}

// Check if file is audio
function isAudioFile(filename) {
  const audioExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac', '.wma'];
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return audioExtensions.includes(ext);
}

// Update folder and song counts
async function updateFolderCounts() {
  const countEl = document.getElementById('dropboxCount');
  if (!countEl) return;
  
  const folderCount = selectedFolders.length;
  
  // Get song count from storage
  const tracks = await storage.getAllTracks();
  const songCount = tracks.length;
  
  countEl.textContent = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} • ${songCount} ${songCount === 1 ? 'song' : 'songs'}`;
}

// Scan selected folders
async function scanSelectedFolders() {
  if (selectedFolders.length === 0) {
    showToast('No folders selected', 'info');
    return;
  }
  
  console.log('[Sources] Scanning selected folders:', selectedFolders);
  showToast('Loading new songs...', 'info');
  
  try {
    // Use scanner module to scan folders
    await scanner.scanFolders(selectedFolders);
    
    // Update counts
    await updateFolderCounts();
    
    // Refresh library
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    showToast('Library updated!', 'success');
    
  } catch (error) {
    console.error('[Sources] Error scanning folders:', error);
    showToast('Error scanning folders', 'error');
  }
}

// Get selected folders
export function getSelectedFolders() {
  return selectedFolders;
}

// Check if we should show Sources screen on launch
export function shouldShowSourcesOnLaunch() {
  return selectedFolders.length === 0;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default {
  init,
  loadDropboxFolders,
  getSelectedFolders,
  shouldShowSourcesOnLaunch
};
