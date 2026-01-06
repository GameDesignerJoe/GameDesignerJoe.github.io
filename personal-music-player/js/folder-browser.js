// Folder Browser Module
// Handles browsing Dropbox folders and folder selection

import * as dropbox from './dropbox.js';
import * as storage from './storage.js';
import { showToast } from './app.js';

let currentPath = '';
let selectedFolders = [];

// Initialize folder browser
export async function init() {
  // Load previously selected folders
  selectedFolders = await storage.getSelectedFolders();
  console.log('[FolderBrowser] Loaded selected folders:', selectedFolders);
}

// Show folder browser modal
export async function showFolderBrowser() {
  // Check if modal already exists
  const existingModal = document.getElementById('folderBrowserModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'folderBrowserModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content folder-browser">
      <div class="modal-header">
        <h2>Select Music Folders</h2>
        <button id="closeFolderBrowser" class="icon-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Breadcrumb Navigation -->
        <div id="breadcrumb" class="breadcrumb"></div>
        
        <!-- Folder List -->
        <div id="folderList" class="folder-list">
          <div class="loading">Loading folders...</div>
        </div>
        
        <!-- Selected Folders -->
        <div class="selected-folders-section">
          <h3>Selected Folders (<span id="selectedCount">0</span>)</h3>
          <div id="selectedFoldersList" class="selected-folders-list"></div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button id="cancelFolderBrowser" class="btn-secondary">Cancel</button>
        <button id="startScanningBtn" class="btn-primary" disabled>
          Add Folders
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set up event listeners
  document.getElementById('closeFolderBrowser').addEventListener('click', closeFolderBrowser);
  document.getElementById('cancelFolderBrowser').addEventListener('click', closeFolderBrowser);
  document.getElementById('startScanningBtn').addEventListener('click', startScanning);
  
  // Load root folder
  await navigateToFolder('');
  
  // Display selected folders
  updateSelectedFoldersList();
}

// Navigate to a folder
async function navigateToFolder(path) {
  currentPath = path;
  
  const folderList = document.getElementById('folderList');
  const breadcrumb = document.getElementById('breadcrumb');
  
  // Update breadcrumb
  updateBreadcrumb(path);
  
  // Show loading
  folderList.innerHTML = '<div class="loading">Loading folders...</div>';
  
  try {
    // List folder contents
    const response = await dropbox.listFolder(path, false); // false = non-recursive
    
    // Filter to only show folders
    const folders = response.entries.filter(entry => entry['.tag'] === 'folder');
    
    if (folders.length === 0) {
      folderList.innerHTML = '<div class="empty-state"><p>No subfolders found</p></div>';
      return;
    }
    
    // Render folders
    folderList.innerHTML = '';
    folders.forEach(folder => {
      const folderItem = createFolderItem(folder);
      folderList.appendChild(folderItem);
    });
    
  } catch (error) {
    console.error('[FolderBrowser] Error loading folder:', error);
    folderList.innerHTML = '<div class="error-state"><p>Error loading folders</p></div>';
    showToast('Error loading folders', 'error');
  }
}

// Create folder item element
function createFolderItem(folder) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  const isSelected = selectedFolders.some(f => f.path === folder.path_lower);
  
  div.innerHTML = `
    <div class="folder-item-icon">📁</div>
    <div class="folder-item-info">
      <div class="folder-item-name">${folder.name}</div>
      <div class="folder-item-path">${folder.path_lower}</div>
    </div>
    <div class="folder-item-actions">
      ${isSelected ? 
        '<button class="btn-text selected-indicator">✓ Selected</button>' :
        '<button class="btn-text add-folder-btn">Add</button>'
      }
      <button class="btn-text browse-folder-btn">Browse →</button>
    </div>
  `;
  
  // Add event listeners
  const addBtn = div.querySelector('.add-folder-btn');
  const browseBtn = div.querySelector('.browse-folder-btn');
  
  if (addBtn) {
    addBtn.addEventListener('click', () => addFolderToSelection(folder.path_lower));
  }
  
  browseBtn.addEventListener('click', () => navigateToFolder(folder.path_lower));
  
  return div;
}

// Update breadcrumb navigation
function updateBreadcrumb(path) {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '';
  
  // Home button
  const homeBtn = document.createElement('button');
  homeBtn.className = 'breadcrumb-item';
  homeBtn.textContent = '🏠 Home';
  homeBtn.addEventListener('click', () => navigateToFolder(''));
  breadcrumb.appendChild(homeBtn);
  
  if (!path) return;
  
  // Add current folder button to select it
  const addCurrentBtn = document.createElement('button');
  addCurrentBtn.className = 'breadcrumb-item add-current-folder';
  addCurrentBtn.textContent = '+ Add Current Folder';
  addCurrentBtn.addEventListener('click', () => addFolderToSelection(path));
  breadcrumb.appendChild(addCurrentBtn);
  
  // Path segments
  const segments = path.split('/').filter(s => s);
  let builtPath = '';
  
  segments.forEach((segment, index) => {
    builtPath += '/' + segment;
    const pathCopy = builtPath;
    
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '/';
    breadcrumb.appendChild(sep);
    
    if (index === segments.length - 1) {
      // Current folder (not clickable)
      const span = document.createElement('span');
      span.className = 'breadcrumb-item current';
      span.textContent = segment;
      breadcrumb.appendChild(span);
    } else {
      // Parent folders (clickable)
      const btn = document.createElement('button');
      btn.className = 'breadcrumb-item';
      btn.textContent = segment;
      btn.addEventListener('click', () => navigateToFolder(pathCopy));
      breadcrumb.appendChild(btn);
    }
  });
}

// Add folder to selection
async function addFolderToSelection(folderPath) {
  // Check if already selected
  if (selectedFolders.some(f => f.path === folderPath)) {
    showToast('Folder already selected', 'info');
    return;
  }
  
  // Add to storage
  await storage.addFolder(folderPath);
  
  // Update local array
  selectedFolders = await storage.getSelectedFolders();
  
  // Update UI
  updateSelectedFoldersList();
  
  // Refresh current folder view to update buttons
  await navigateToFolder(currentPath);
  
  showToast('Folder added!', 'success');
}

// Remove folder from selection
async function removeFolderFromSelection(folderPath) {
  await storage.removeFolder(folderPath);
  selectedFolders = await storage.getSelectedFolders();
  
  // Also remove tracks from that folder
  const deletedCount = await storage.deleteTracksByFolder(folderPath);
  console.log(`[FolderBrowser] Removed ${deletedCount} tracks from folder`);
  
  updateSelectedFoldersList();
  
  // Refresh current folder view
  await navigateToFolder(currentPath);
  
  showToast('Folder removed', 'success');
}

// Update selected folders list
function updateSelectedFoldersList() {
  const list = document.getElementById('selectedFoldersList');
  const count = document.getElementById('selectedCount');
  const startBtn = document.getElementById('startScanningBtn');
  
  count.textContent = selectedFolders.length;
  
  if (selectedFolders.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No folders selected yet</p></div>';
    startBtn.disabled = true;
    return;
  }
  
  startBtn.disabled = false;
  list.innerHTML = '';
  
  selectedFolders.forEach(folder => {
    const div = document.createElement('div');
    div.className = 'selected-folder-item';
    div.innerHTML = `
      <span class="selected-folder-path">📁 ${folder.path}</span>
      <button class="btn-text remove-folder-btn" data-path="${folder.path}">Remove</button>
    `;
    
    const removeBtn = div.querySelector('.remove-folder-btn');
    removeBtn.addEventListener('click', () => removeFolderFromSelection(folder.path));
    
    list.appendChild(div);
  });
}

// Start scanning selected folders
async function startScanning() {
  if (selectedFolders.length === 0) {
    showToast('Please select at least one folder', 'error');
    return;
  }
  
  // Close modal
  closeFolderBrowser();
  
  // Import and start the scanner
  const scanner = await import('./scanner.js');
  await scanner.scanSelectedFolders(selectedFolders);
}

// Close folder browser
function closeFolderBrowser() {
  const modal = document.getElementById('folderBrowserModal');
  if (modal) {
    modal.remove();
  }
}

// Export selected folders getter
export function getSelectedFolders() {
  return selectedFolders;
}
