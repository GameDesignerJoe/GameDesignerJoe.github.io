// Local Files Module
// Handles local file system access using File System Access API

import config from '../config.js';

// Check if File System Access API is supported
export function isSupported() {
  return 'showDirectoryPicker' in window;
}

// Request folder access from user
export async function requestFolderAccess() {
  if (!isSupported()) {
    throw new Error('File System Access API not supported in this browser');
  }
  
  try {
    // Show native folder picker
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
      startIn: 'music' // Suggest music folder if available
    });
    
    console.log('[LocalFiles] Folder selected:', dirHandle.name);
    return dirHandle;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[LocalFiles] User cancelled folder selection');
      return null;
    }
    throw error;
  }
}

// Verify folder access permission
export async function verifyPermission(dirHandle, readWrite = false) {
  const options = {
    mode: readWrite ? 'readwrite' : 'read'
  };
  
  // Check if permission was already granted
  if ((await dirHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Request permission
  if ((await dirHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

// List contents of a directory
export async function listDirectory(dirHandle) {
  const entries = {
    folders: [],
    files: []
  };
  
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        entries.folders.push({
          name: entry.name,
          handle: entry,
          kind: 'directory'
        });
      } else if (entry.kind === 'file') {
        // Check if it's an audio file
        if (isAudioFile(entry.name)) {
          entries.files.push({
            name: entry.name,
            handle: entry,
            kind: 'file'
          });
        }
      }
    }
    
    // Sort folders and files alphabetically
    entries.folders.sort((a, b) => a.name.localeCompare(b.name));
    entries.files.sort((a, b) => a.name.localeCompare(b.name));
    
  } catch (error) {
    console.error('[LocalFiles] Error listing directory:', error);
    throw error;
  }
  
  return entries;
}

// Get all audio files from a directory recursively
export async function getAllAudioFiles(dirHandle, basePath = '', allFiles = []) {
  try {
    for await (const entry of dirHandle.values()) {
      const currentPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.kind === 'directory') {
        // Recursively scan subdirectories
        await getAllAudioFiles(entry, currentPath, allFiles);
      } else if (entry.kind === 'file' && isAudioFile(entry.name)) {
        allFiles.push({
          name: entry.name,
          path: currentPath,
          handle: entry
        });
      }
    }
  } catch (error) {
    console.error('[LocalFiles] Error scanning directory:', error);
  }
  
  return allFiles;
}

// Get file as blob URL for playback
export async function getFileUrl(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    return url;
  } catch (error) {
    console.error('[LocalFiles] Error getting file URL:', error);
    throw error;
  }
}

// Get file object
export async function getFile(fileHandle) {
  try {
    return await fileHandle.getFile();
  } catch (error) {
    console.error('[LocalFiles] Error getting file:', error);
    throw error;
  }
}

// Check if file is an audio file
function isAudioFile(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return config.audioExtensions.includes(ext);
}

// Serialize directory handle for storage
export async function serializeHandle(handle) {
  // IndexedDB can store FileSystemHandle objects directly
  return {
    name: handle.name,
    handle: handle,
    kind: handle.kind,
    serializedAt: Date.now()
  };
}

// Build path string from navigation
export function buildPath(pathSegments) {
  return pathSegments.join('/');
}

// Navigate to subdirectory
export async function getSubdirectory(parentHandle, dirName) {
  try {
    return await parentHandle.getDirectoryHandle(dirName);
  } catch (error) {
    console.error('[LocalFiles] Error getting subdirectory:', error);
    throw error;
  }
}

// Check if a file exists in directory
export async function fileExists(dirHandle, fileName) {
  try {
    await dirHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

// Find image files in directory (for cover art)
export async function findImageFiles(dirHandle) {
  const imageFiles = [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const ext = '.' + entry.name.split('.').pop().toLowerCase();
        if (imageExtensions.includes(ext)) {
          imageFiles.push({
            name: entry.name,
            handle: entry
          });
        }
      }
    }
  } catch (error) {
    console.error('[LocalFiles] Error finding images:', error);
  }
  
  return imageFiles;
}

// Get cover image from folder (prefer "cover.*" files)
export async function getCoverImage(dirHandle) {
  const images = await findImageFiles(dirHandle);
  
  if (images.length === 0) return null;
  
  // Look for file named "cover" with any extension
  const coverFile = images.find(img => {
    const nameWithoutExt = img.name.substring(0, img.name.lastIndexOf('.'));
    return nameWithoutExt.toLowerCase() === 'cover';
  });
  
  if (coverFile) return coverFile;
  
  // Otherwise return first image
  return images[0];
}

// Revoke blob URL to free memory
export function revokeFileUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export default {
  isSupported,
  requestFolderAccess,
  verifyPermission,
  listDirectory,
  getAllAudioFiles,
  getFileUrl,
  getFile,
  serializeHandle,
  buildPath,
  getSubdirectory,
  findImageFiles,
  getCoverImage,
  revokeFileUrl
};
