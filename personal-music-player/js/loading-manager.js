// Loading Manager Module
// Controls the loading sources overlay with progress tracking

let isLoading = false;

// Show loading overlay
export function showLoading() {
  const overlay = document.getElementById('loadingSourcesOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    isLoading = true;
    
    // Reset state
    updateProgress(0);
    updateActivity('Initializing...', 'Preparing to scan folders');
  }
}

// Hide loading overlay
export function hideLoading() {
  const overlay = document.getElementById('loadingSourcesOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    isLoading = false;
  }
}

// Update progress bar (0-100)
export function updateProgress(percent) {
  const progressFill = document.getElementById('loadingProgressFill');
  const progressText = document.getElementById('loadingProgressPercent');
  
  if (progressFill) {
    progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${Math.round(percent)}%`;
  }
}

// Update current activity text
export function updateActivity(folderName, stats) {
  const folderNameEl = document.getElementById('loadingCurrentFolder');
  const statsEl = document.getElementById('loadingStats');
  
  if (folderNameEl) {
    folderNameEl.textContent = folderName;
  }
  
  if (statsEl) {
    statsEl.textContent = stats;
  }
}

// Update for scanning phase (folders list)
export function updateScanningFolder(currentIndex, totalFolders, folderName) {
  const percent = totalFolders > 0 ? ((currentIndex / totalFolders) * 50) : 0; // 0-50% for folder scanning
  updateProgress(percent);
  updateActivity(
    `Scanning: ${folderName}`,
    `Folder ${currentIndex} of ${totalFolders}`
  );
}

// Update for metadata phase (subfolders)
export function updateMetadataFolder(currentIndex, totalFolders, folderName, filesFound = 0) {
  const percent = 50 + (totalFolders > 0 ? ((currentIndex / totalFolders) * 50) : 0); // 50-100% for metadata
  updateProgress(percent);
  
  const stats = filesFound > 0 
    ? `${filesFound} files found • Folder ${currentIndex} of ${totalFolders}`
    : `Folder ${currentIndex} of ${totalFolders}`;
    
  updateActivity(
    `Scanning metadata: ${folderName}`,
    stats
  );
}

// Check if currently loading
export function isCurrentlyLoading() {
  return isLoading;
}

export default {
  showLoading,
  hideLoading,
  updateProgress,
  updateActivity,
  updateScanningFolder,
  updateMetadataFolder,
  isCurrentlyLoading
};
