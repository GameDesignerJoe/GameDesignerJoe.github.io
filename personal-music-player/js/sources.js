// Sources Module
// Handles the Sources screen for managing music source connections

import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import * as scanner from './scanner.js';
import * as localFiles from './local-files.js';
import { showToast, markFoldersModified, disconnectSource } from './app.js';

// State
let selectedFolders = [];
let currentPath = '';
let currentFolders = [];
let activeSource = 'dropbox';

// Local files state
let selectedLocalFolders = []; // Array of {name, handle, path}
let currentLocalHandle = null;
let localNavigationStack = []; // Stack of {name, handle} for breadcrumb navigation

// Initialize Sources screen
export async function init() {
  console.log('[Sources] Initializing sources');
  
  // Load selected folders from storage (returns objects with {path, addedAt})
  const folderObjects = await storage.getSelectedFolders() || [];
  // Extract just the paths as strings
  selectedFolders = folderObjects.map(f => f.path);
  
  // Update counts
  updateFolderCounts();
  
  // Setup event listeners
  setupEventListeners();
  
  // Always load dropbox UI (will show connect prompt if not authenticated)
  await loadDropboxFolders('');
  
  // Load local folders
  await loadLocalFolders();
}

// Setup event listeners
function setupEventListeners() {
  // Source connection buttons
  document.getElementById('dropboxSourceBtn')?.addEventListener('click', () => {
    switchSource('dropbox');
  });
  
  document.getElementById('localSourceBtn')?.addEventListener('click', () => {
    switchSource('local');
  });
  
  // Add current folder buttons
  document.getElementById('addCurrentFolderBtn')?.addEventListener('click', async () => {
    await addCurrentFolder();
  });
  
  document.getElementById('addCurrentLocalFolderBtn')?.addEventListener('click', async () => {
    await addCurrentLocalFolder();
  });
  
  // Select local folder button
  document.getElementById('selectLocalFolderBtn')?.addEventListener('click', async () => {
    await selectLocalFolder();
  });
  
  // Rescan local folders button
  document.getElementById('rescanLocalFoldersBtn')?.addEventListener('click', async () => {
    await rescanLocalFolders();
  });
  
  // Dropbox toggle button (Connect/Disconnect)
  document.getElementById('dropboxToggleBtn')?.addEventListener('click', async () => {
    const dropboxModule = await import('./dropbox.js');
    if (dropboxModule.isAuthenticated()) {
      // Currently connected - disconnect
      await disconnectSource('Dropbox');
    } else {
      // Not connected - initiate OAuth
      dropboxModule.initiateOAuth();
    }
  });
  
  // Reset All Data button (Nuclear option)
  document.getElementById('resetAllDataBtn')?.addEventListener('click', async () => {
    await resetAllData();
  });
  
  // Breadcrumb navigation will be set up dynamically
}

// Switch between sources (Dropbox, Local, etc.)
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
    'local': 'localBrowser',
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
  
  // Load local folders if switching to local
  if (sourceName === 'local') {
    displayLocalBrowser();
  }
}

// Load Dropbox folders
export async function loadDropboxFolders(path = '') {
  console.log('[Sources] Loading Dropbox folders:', path);
  
  currentPath = path;
  const folderList = document.getElementById('dropboxFolderList');
  
  if (!folderList) return;
  
  // Update toggle button based on connection status
  const toggleBtn = document.getElementById('dropboxToggleBtn');
  
  // Update sidebar button appearance based on connection status
  const dropboxBtn = document.getElementById('dropboxSourceBtn');
  
  if (!dropbox.isAuthenticated()) {
    // Not connected - show connect prompt
    folderList.innerHTML = `
      <div class="connect-prompt">
        <div class="connect-icon">📦</div>
        <h3>Connect to Dropbox</h3>
        <p>Link your Dropbox account to access your music files</p>
        <button class="btn-primary" id="connectDropboxFromSources">Connect to Dropbox</button>
      </div>
    `;
    
    // Wire up connect button
    document.getElementById('connectDropboxFromSources')?.addEventListener('click', () => {
      dropbox.initiateOAuth();
    });
    
    // Update toggle button to show "Connect" with GREEN styling
    if (toggleBtn) {
      toggleBtn.textContent = 'Connect to Dropbox';
      toggleBtn.className = 'btn-connect';
    }
    
    // Remove green border/checkmark from sidebar button when NOT connected
    if (dropboxBtn) {
      dropboxBtn.classList.remove('active');
      const statusIndicator = dropboxBtn.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.style.display = 'none';
      }
    }
    
    return;
  }
  
  // Connected - update toggle button to show "Disconnect" with RED styling
  if (toggleBtn) {
    toggleBtn.textContent = 'Disconnect Dropbox';
    toggleBtn.className = 'btn-disconnect';
  }
  
  // Show green border/checkmark when connected
  if (dropboxBtn) {
    dropboxBtn.classList.add('active');
    const statusIndicator = dropboxBtn.querySelector('.status-indicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'inline';
    }
  }
  
  // Show loading
  folderList.innerHTML = '<div class="loading">Loading folders...</div>';
  
  // Show/hide "+ Add Folder" button (hide on root, show when in a folder)
  const addBtn = document.getElementById('addCurrentFolderBtn');
  if (addBtn) {
    if (path && path !== '') {
      addBtn.style.display = 'block';
    } else {
      addBtn.style.display = 'none';
    }
  }
  
  try {
    // Get folders from Dropbox (recursive: false to only get immediate children)
    const result = await dropbox.listFolder(path, false);
    const folders = result.entries.filter(entry => entry['.tag'] === 'folder');
    const files = result.entries.filter(entry => entry['.tag'] === 'file' && isAudioFile(entry.name));
    
    currentFolders = folders;
    
    // Update breadcrumb
    updateBreadcrumb(path);
    
    // Display folders and files
    displayFoldersAndFiles(folders, files);
    
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

// Display folders and files
function displayFoldersAndFiles(folders, files) {
  const folderList = document.getElementById('dropboxFolderList');
  if (!folderList) return;
  
  if (folders.length === 0 && files.length === 0) {
    folderList.innerHTML = `
      <div class="empty-state">
        <p>No items found</p>
      </div>
    `;
    return;
  }
  
  folderList.innerHTML = '';
  
  // Show folders first
  folders.forEach(folder => {
    const folderItem = createFolderItem(folder);
    folderList.appendChild(folderItem);
  });
  
  // Then show audio files
  files.forEach(file => {
    const fileItem = createFileItem(file);
    folderList.appendChild(fileItem);
  });
}

// Display folders only (fallback for compatibility)
function displayFolders(folders) {
  displayFoldersAndFiles(folders, []);
}

// Create file item element
function createFileItem(file) {
  const div = document.createElement('div');
  div.className = 'folder-item'; // Reuse folder-item styling
  
  div.innerHTML = `
    <span class="folder-icon">🎵</span>
    <div class="folder-info">
      <div class="folder-name">${escapeHtml(file.name)}</div>
    </div>
    <div class="folder-actions">
      <!-- Files don't have actions, just display -->
    </div>
  `;
  
  return div;
}

// Create folder item element
function createFolderItem(folder) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  // Check if this folder is directly selected
  const isDirectlySelected = selectedFolders.some(selectedPath => {
    const pathStr = typeof selectedPath === 'string' ? selectedPath : selectedPath?.path || '';
    return pathStr === folder.path_lower;
  });
  
  // Check if this folder is included via a parent folder selection
  const isIncludedViaParent = selectedFolders.some(selectedPath => {
    const pathStr = typeof selectedPath === 'string' ? selectedPath : selectedPath?.path || '';
    return folder.path_lower.startsWith(pathStr + '/') && pathStr !== folder.path_lower;
  });
  
  // Check if this folder contains any selected subfolders
  const hasSelectedChildren = selectedFolders.some(selectedPath => {
    const pathStr = typeof selectedPath === 'string' ? selectedPath : selectedPath?.path || '';
    return pathStr.startsWith(folder.path_lower + '/') && pathStr !== folder.path_lower;
  });
  
  const isSelected = isDirectlySelected || isIncludedViaParent;
  
  if (isSelected) {
    div.classList.add('selected');
  }
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
  // Find index handling both string and object formats
  const index = selectedFolders.findIndex(selectedPath => {
    const pathStr = typeof selectedPath === 'string' ? selectedPath : selectedPath?.path || '';
    return pathStr === folderPath;
  });
  
  if (index === -1) {
    // Add folder (always as string)
    selectedFolders.push(folderPath);
    showToast(`Folder added`, 'success');
  } else {
    // Remove folder
    selectedFolders.splice(index, 1);
    showToast(`Folder removed`, 'info');
  }
  
  // Save to storage (ensure all entries are strings)
  const cleanedFolders = selectedFolders.map(f => typeof f === 'string' ? f : f?.path || '').filter(f => f);
  selectedFolders = cleanedFolders;
  await storage.saveSelectedFolders(selectedFolders);
  
  // Update UI
  updateFolderCounts();
  // Reload the current folder to refresh the display
  await loadDropboxFolders(currentPath);
  
  // Trigger rescan if folders changed
  if (selectedFolders.length > 0) {
    // Automatically scan when folders change
    await scanSelectedFolders();
  }
}

// Add the current folder being viewed
async function addCurrentFolder() {
  if (!currentPath || currentPath === '') {
    showToast('No folder to add', 'info');
    return;
  }
  
  // Use toggleFolderSelection to add the current folder
  await toggleFolderSelection(currentPath);
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
  
  // Get Dropbox song count from storage (only Dropbox tracks)
  const tracks = await storage.getAllTracks();
  const dropboxTracks = tracks.filter(t => t.source === 'dropbox');
  const songCount = dropboxTracks.length;
  
  countEl.textContent = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} • ${songCount} ${songCount === 1 ? 'song' : 'songs'}`;
}

// Scan selected folders
async function scanSelectedFolders() {
  if (selectedFolders.length === 0) {
    showToast('No folders selected', 'info');
    return;
  }
  
  console.log('[Sources] Scanning selected folders:', selectedFolders);
  showToast('Scanning folders and tracks...', 'info');
  
  try {
    // First, scan for audio files (this finds all the tracks)
    await scanner.scanSelectedFolders(selectedFolders);
    
    // Then, trigger full metadata scan (cover images, deep subfolders, etc.)
    showToast('Scanning folder structure and artwork...', 'info');
    
    // Import home module and trigger its full scan which handles deep folders
    const home = await import('./home.js');
    await home.forceRescanMetadata();
    
    // Update counts
    await updateFolderCounts();
    
    // Refresh library
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    // Mark folders as modified so home will auto-refresh  
    markFoldersModified();
    
    showToast('✓ Library updated with folder structure!', 'success');
    
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

// ==========================================
// LOCAL FILE SYSTEM FUNCTIONS
// ==========================================

// Select a local folder using File System Access API
async function selectLocalFolder() {
  if (!localFiles.isSupported()) {
    showToast('Local file access not supported in this browser. Please use Chrome or Edge.', 'error');
    return;
  }
  
  try {
    const dirHandle = await localFiles.requestFolderAccess();
    
    if (!dirHandle) {
      // User cancelled
      return;
    }
    
    // Verify permission
    const hasPermission = await localFiles.verifyPermission(dirHandle);
    if (!hasPermission) {
      showToast('Permission denied', 'error');
      return;
    }
    
    // Set as current folder and display
    currentLocalHandle = dirHandle;
    localNavigationStack = [{name: dirHandle.name, handle: dirHandle}];
    
    await displayLocalDirectory(dirHandle);
    
  } catch (error) {
    console.error('[Sources] Error selecting local folder:', error);
    showToast('Error accessing folder', 'error');
  }
}

// Display local directory contents
async function displayLocalDirectory(dirHandle) {
  const folderList = document.getElementById('localFolderList');
  if (!folderList) return;
  
  // Show loading
  folderList.innerHTML = '<div class="loading">Loading...</div>';
  
  // Update breadcrumb
  updateLocalBreadcrumb();
  
  // Show/hide "+ Add Folder" button
  const addBtn = document.getElementById('addCurrentLocalFolderBtn');
  if (addBtn && dirHandle) {
    addBtn.style.display = 'block';
  }
  
  try {
    const entries = await localFiles.listDirectory(dirHandle);
    
    currentLocalHandle = dirHandle;
    
    // Display folders and files
    displayLocalFoldersAndFiles(entries.folders, entries.files);
    
  } catch (error) {
    console.error('[Sources] Error loading local directory:', error);
    folderList.innerHTML = `
      <div class="empty-state">
        <p>Error loading directory</p>
        <button class="btn-secondary" id="retryLoadLocal">Retry</button>
      </div>
    `;
    
    document.getElementById('retryLoadLocal')?.addEventListener('click', async () => {
      await displayLocalDirectory(dirHandle);
    });
  }
}

// Display local folders and files
function displayLocalFoldersAndFiles(folders, files) {
  const folderList = document.getElementById('localFolderList');
  if (!folderList) return;
  
  if (folders.length === 0 && files.length === 0) {
    folderList.innerHTML = `
      <div class="empty-state">
        <p>No items found</p>
      </div>
    `;
    return;
  }
  
  folderList.innerHTML = '';
  
  // Show folders first
  folders.forEach(folder => {
    const folderItem = createLocalFolderItem(folder);
    folderList.appendChild(folderItem);
  });
  
  // Then show audio files
  files.forEach(file => {
    const fileItem = createLocalFileItem(file);
    folderList.appendChild(fileItem);
  });
}

// Create local folder item
function createLocalFolderItem(folder) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  // Check if selected
  const isSelected = selectedLocalFolders.some(f => f.name === folder.name);
  
  if (isSelected) {
    div.classList.add('selected');
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
    await navigateToLocalFolder(folder);
  });
  
  // Add/Remove button
  const actionBtn = div.querySelector('.folder-add-btn, .folder-checkmark');
  if (actionBtn && actionBtn.classList.contains('folder-add-btn')) {
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleLocalFolderSelection(folder);
    });
  } else if (actionBtn) {
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleLocalFolderSelection(folder);
    });
  }
  
  return div;
}

// Create local file item
function createLocalFileItem(file) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  div.innerHTML = `
    <span class="folder-icon">🎵</span>
    <div class="folder-info">
      <div class="folder-name">${escapeHtml(file.name)}</div>
    </div>
    <div class="folder-actions">
      <!-- Files don't have actions -->
    </div>
  `;
  
  return div;
}

// Navigate to local subfolder
async function navigateToLocalFolder(folder) {
  // Add to navigation stack
  localNavigationStack.push({name: folder.name, handle: folder.handle});
  
  // Display the folder
  await displayLocalDirectory(folder.handle);
}

// Update local breadcrumb
function updateLocalBreadcrumb() {
  const breadcrumb = document.getElementById('localBreadcrumb');
  if (!breadcrumb) return;
  
  breadcrumb.innerHTML = '';
  
  // Add "My Computer" root
  const rootItem = document.createElement('span');
  rootItem.className = 'breadcrumb-item';
  rootItem.textContent = 'My Computer';
  rootItem.addEventListener('click', () => {
    localNavigationStack = [];
    currentLocalHandle = null;
    displayLocalBrowser();
  });
  breadcrumb.appendChild(rootItem);
  
  // Add navigation path
  localNavigationStack.forEach((item, index) => {
    const breadcrumbItem = document.createElement('span');
    breadcrumbItem.className = 'breadcrumb-item';
    breadcrumbItem.textContent = item.name;
    breadcrumbItem.addEventListener('click', async () => {
      // Navigate back to this level
      localNavigationStack = localNavigationStack.slice(0, index + 1);
      await displayLocalDirectory(item.handle);
    });
    breadcrumb.appendChild(breadcrumbItem);
  });
}

// Display local browser initial state
function displayLocalBrowser() {
  const folderList = document.getElementById('localFolderList');
  const addBtn = document.getElementById('addCurrentLocalFolderBtn');
  
  if (!folderList) return;
  
  // Hide add button on initial view
  if (addBtn) {
    addBtn.style.display = 'none';
  }
  
  // Show selected folders if any
  if (selectedLocalFolders.length > 0) {
    folderList.innerHTML = '';
    
    selectedLocalFolders.forEach(folder => {
      const div = document.createElement('div');
      div.className = 'folder-item selected';
      div.innerHTML = `
        <span class="folder-icon">📁</span>
        <div class="folder-info">
          <div class="folder-name">${escapeHtml(folder.name)}</div>
        </div>
        <div class="folder-actions">
          <span class="folder-checkmark">✓</span>
        </div>
      `;
      folderList.appendChild(div);
    });
    
    // Add select button at bottom
    const selectDiv = document.createElement('div');
    selectDiv.className = 'empty-state';
    selectDiv.style.marginTop = '20px';
    selectDiv.innerHTML = '<button id="selectAnotherFolderBtn" class="btn-primary">📁 Select Another Folder</button>';
    folderList.appendChild(selectDiv);
    
    document.getElementById('selectAnotherFolderBtn')?.addEventListener('click', selectLocalFolder);
  } else {
    folderList.innerHTML = `
      <div class="empty-state">
        <p>Click "Select Folder" to browse your computer</p>
        <button id="selectLocalFolderBtn2" class="btn-primary">📁 Select Folder</button>
      </div>
    `;
    
    document.getElementById('selectLocalFolderBtn2')?.addEventListener('click', selectLocalFolder);
  }
  
  updateLocalBreadcrumb();
}

// Toggle local folder selection
async function toggleLocalFolderSelection(folder) {
  const index = selectedLocalFolders.findIndex(f => f.name === folder.name);
  
  if (index === -1) {
    // Add folder
    const folderData = {
      name: folder.name,
      handle: folder.handle,
      path: buildLocalPath(),
      addedAt: Date.now()
    };
    
    selectedLocalFolders.push(folderData);
    showToast(`Folder "${folder.name}" added`, 'success');
    
    // Save to storage
    await storage.saveLocalFolderHandles(selectedLocalFolders);
    
    // Trigger scan
    await scanLocalFolders();
  } else {
    // Remove folder
    selectedLocalFolders.splice(index, 1);
    showToast(`Folder removed`, 'info');
    
    // Save to storage
    await storage.saveLocalFolderHandles(selectedLocalFolders);
  }
  
  // Update UI
  await updateLocalFolderCounts();
  await displayLocalDirectory(currentLocalHandle);
}

// Add current local folder
async function addCurrentLocalFolder() {
  if (!currentLocalHandle) {
    showToast('No folder to add', 'info');
    return;
  }
  
  await toggleLocalFolderSelection({
    name: currentLocalHandle.name,
    handle: currentLocalHandle
  });
}

// Build local path string from navigation stack
function buildLocalPath() {
  return localNavigationStack.map(item => item.name).join('/');
}

// Update local folder counts
async function updateLocalFolderCounts() {
  const countEl = document.getElementById('localCount');
  if (!countEl) return;
  
  const folderCount = selectedLocalFolders.length;
  
  // Get local song count from storage
  const tracks = await storage.getAllTracks();
  const localTracks = tracks.filter(t => t.source === 'local');
  const songCount = localTracks.length;
  
  countEl.textContent = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} • ${songCount} ${songCount === 1 ? 'song' : 'songs'}`;
}

// Scan local folders
async function scanLocalFolders() {
  if (selectedLocalFolders.length === 0) {
    return;
  }
  
  console.log('[Sources] Scanning local folders:', selectedLocalFolders);
  showToast('Scanning local files...', 'info');
  
  try {
    // Use scanner module
    await scanner.scanLocalFolders(selectedLocalFolders);
    
    // Update counts
    await updateLocalFolderCounts();
    await updateFolderCounts(); // Update total counts
    
    // Refresh library
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    showToast('Local files added!', 'success');
    
    // Mark folders as modified so home will auto-refresh
    markFoldersModified();
    
  } catch (error) {
    console.error('[Sources] Error scanning local folders:', error);
    showToast('Error scanning local files', 'error');
  }
}

// Load selected local folders from storage
export async function loadLocalFolders() {
  selectedLocalFolders = await storage.getLocalFolderHandles() || [];
  await updateLocalFolderCounts();
  console.log('[Sources] Loaded', selectedLocalFolders.length, 'local folders');
  
  // Show rescan button if we have local folders
  const rescanBtn = document.getElementById('rescanLocalFoldersBtn');
  if (rescanBtn && selectedLocalFolders.length > 0) {
    rescanBtn.style.display = 'block';
  }
}

// Rescan all local folders (re-extracts metadata including album art)
async function rescanLocalFolders() {
  if (selectedLocalFolders.length === 0) {
    showToast('No local folders to rescan', 'info');
    return;
  }
  
  if (!confirm(`This will rescan ${selectedLocalFolders.length} local folder(s) and update all metadata including album art. Continue?`)) {
    return;
  }
  
  console.log('[Sources] Rescanning local folders');
  showToast('Rescanning local folders...', 'info');
  
  try {
    // Delete existing local tracks
    const tracks = await storage.getAllTracks();
    const localTrackIds = tracks.filter(t => t.source === 'local').map(t => t.id);
    
    // Clear local tracks
    for (const track of tracks.filter(t => t.source === 'local')) {
      // Note: We'd need a deleteTrack function in storage for this
      // For now, we'll just rescan and let saveTracks update them
    }
    
    // Rescan with fresh metadata
    await scanner.scanLocalFolders(selectedLocalFolders);
    
    // Update counts
    await updateLocalFolderCounts();
    await updateFolderCounts();
    
    // Refresh library and home
    const library = await import('./library.js');
    await library.refreshLibrary();
    
    const home = await import('./home.js');
    await home.refreshFolders();
    
    showToast('✓ Local folders rescanned with fresh metadata!', 'success');
    
  } catch (error) {
    console.error('[Sources] Error rescanning local folders:', error);
    showToast('Error rescanning folders', 'error');
  }
}

// ==========================================
// RESET ALL DATA (NUCLEAR OPTION)
// ==========================================

async function resetAllData() {
  console.log('[Sources] Reset All Data requested');
  
  // Double confirmation - this is destructive!
  const confirmed = confirm(
    '⚠️ RESET ALL APP DATA\n\n' +
    'This will clear:\n' +
    '• All music library metadata (track info, album art)\n' +
    '• All playlists\n' +
    '• All source connections (Dropbox, Local)\n' +
    '• All cached data\n\n' +
    '✅ Your actual MP3 files on Dropbox and your hard drive are SAFE and will NOT be deleted!\n\n' +
    'The app will return to the welcome screen.\n\n' +
    'Continue?'
  );
  
  if (!confirmed) {
    return;
  }
  
  // Final confirmation
  const finalConfirm = confirm(
    'Final confirmation:\n\n' +
    'This will clear all app data but your MP3 files will remain safe.\n\n' +
    'Proceed with reset?'
  );
  if (!finalConfirm) {
    return;
  }
  
  console.log('[Sources] Proceeding with complete reset...');
  showToast('Resetting all data...', 'info');
  
  try {
    // 1. Clear Dropbox authentication token
    if (dropbox.isAuthenticated()) {
      console.log('[Sources] Clearing Dropbox authentication...');
      dropbox.clearAccessToken();
    }
    
    // 2. Clear all storage data (tracks, playlists, folders, etc.)
    console.log('[Sources] Clearing all IndexedDB data...');
    await storage.clearAllData();
    
    // 3. Clear service worker caches
    console.log('[Sources] Clearing service worker caches...');
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
    
    // 4. Clear localStorage
    console.log('[Sources] Clearing localStorage...');
    localStorage.clear();
    
    // 5. Reset all local state variables
    selectedFolders = [];
    selectedLocalFolders = [];
    currentPath = '';
    currentLocalHandle = null;
    localNavigationStack = [];
    
    console.log('[Sources] Reset complete - reloading app...');
    showToast('✓ All data cleared! Returning to welcome screen...', 'success');
    
    // Force complete page reload to return to welcome screen
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    
  } catch (error) {
    console.error('[Sources] Error resetting data:', error);
    showToast('Error resetting data. Please refresh the page manually.', 'error');
    
    // Still try to reload even if there was an error
    setTimeout(() => {
      if (confirm('Reset encountered an error. Reload the page anyway?')) {
        window.location.reload();
      }
    }, 2000);
  }
}

export default {
  init,
  loadDropboxFolders,
  getSelectedFolders,
  shouldShowSourcesOnLaunch,
  loadLocalFolders
};
