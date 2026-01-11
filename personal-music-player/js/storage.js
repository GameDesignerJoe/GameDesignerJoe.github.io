// IndexedDB Storage Module
// Handles all database operations for the music player

const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 2; // Incremented for local folders support

// Store names
const STORES = {
  TRACKS: 'tracks',
  FOLDERS: 'folders',
  PLAYLISTS: 'playlists',
  SETTINGS: 'settings',
  LOCAL_FOLDERS: 'localFolders' // New store for local folder handles
};

let db = null;

// Initialize the database
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[Storage] Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('[Storage] Database initialized');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      console.log('[Storage] Upgrading database schema...');
      
      // Tracks store
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'id' });
        trackStore.createIndex('title', 'title', { unique: false });
        trackStore.createIndex('artist', 'artist', { unique: false });
        trackStore.createIndex('album', 'album', { unique: false });
        trackStore.createIndex('path', 'path', { unique: true });
        trackStore.createIndex('source', 'source', { unique: false }); // Track source (dropbox/local)
      }
      
      // Folders store (selected Dropbox folders)
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        db.createObjectStore(STORES.FOLDERS, { keyPath: 'path' });
      }
      
      // Local Folders store (selected local folder handles)
      if (!db.objectStoreNames.contains(STORES.LOCAL_FOLDERS)) {
        db.createObjectStore(STORES.LOCAL_FOLDERS, { keyPath: 'name' });
      }
      
      // Playlists store
      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id', autoIncrement: true });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      
      console.log('[Storage] Database schema created');
    };
  });
}

// === FOLDER OPERATIONS ===

export async function getSelectedFolders() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addFolder(folderPath) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.put({ 
      path: folderPath,
      addedAt: Date.now()
    });
    
    request.onsuccess = () => {
      console.log('[Storage] Folder added:', folderPath);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeFolder(folderPath) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.delete(folderPath);
    
    request.onsuccess = () => {
      console.log('[Storage] Folder removed:', folderPath);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSelectedFolders(folderPaths) {
  if (!db) await initDB();
  
  // Clear existing folders and add new ones
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([STORES.FOLDERS], 'readwrite');
      const store = transaction.objectStore(STORES.FOLDERS);
      
      // Clear all first
      await new Promise((res, rej) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => res();
        clearRequest.onerror = () => rej(clearRequest.error);
      });
      
      // Add all new folders
      for (const folderPath of folderPaths) {
        await new Promise((res, rej) => {
          const addRequest = store.put({
            path: folderPath,
            addedAt: Date.now()
          });
          addRequest.onsuccess = () => res();
          addRequest.onerror = () => rej(addRequest.error);
        });
      }
      
      console.log('[Storage] Saved', folderPaths.length, 'selected folders');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Save folder with metadata (cover image, song count, etc.)
export async function saveFolderMetadata(folderData) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.put(folderData);
    
    request.onsuccess = () => {
      console.log('[Storage] Folder metadata saved:', folderData.path);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Get folder by path
export async function getFolderByPath(path) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.get(path);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all folders with full metadata
export async function getAllFoldersWithMetadata() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// === TRACK OPERATIONS ===

export async function saveTrack(track) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TRACKS], 'readwrite');
    const store = transaction.objectStore(STORES.TRACKS);
    const request = store.put(track);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveTracks(tracks) {
  if (!db) await initDB();
  
  if (tracks.length === 0) {
    return;
  }
  
  let successCount = 0;
  let updateCount = 0;
  
  // Save each track individually to prevent one failure from aborting all
  for (const track of tracks) {
    try {
      const existing = await getTrackByPath(track.path);
      
      if (existing) {
        // Update existing track
        track.id = existing.id; // Keep same ID
        await saveTrack(track);
        updateCount++;
      } else {
        // New track
        await saveTrack(track);
        successCount++;
      }
    } catch (error) {
      console.error(`[Storage] Error saving track ${track.title}:`, error.message);
    }
  }
  
  console.log(`[Storage] Added ${successCount} new tracks, updated ${updateCount} existing tracks`);
}

// Helper to get track by path
async function getTrackByPath(path) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TRACKS], 'readonly');
    const store = transaction.objectStore(STORES.TRACKS);
    const index = store.index('path');
    const request = index.get(path);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTracks() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TRACKS], 'readonly');
    const store = transaction.objectStore(STORES.TRACKS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getTrackById(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TRACKS], 'readonly');
    const store = transaction.objectStore(STORES.TRACKS);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTracksByFolder(folderPath) {
  if (!db) await initDB();
  
  return new Promise(async (resolve, reject) => {
    try {
      const allTracks = await getAllTracks();
      const tracksToDelete = allTracks.filter(track => 
        track.path.startsWith(folderPath)
      );
      
      const transaction = db.transaction([STORES.TRACKS], 'readwrite');
      const store = transaction.objectStore(STORES.TRACKS);
      
      tracksToDelete.forEach(track => {
        store.delete(track.id);
      });
      
      transaction.oncomplete = () => {
        console.log(`[Storage] Deleted ${tracksToDelete.length} tracks from folder:`, folderPath);
        resolve(tracksToDelete.length);
      };
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
}

export async function clearAllTracks() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TRACKS], 'readwrite');
    const store = transaction.objectStore(STORES.TRACKS);
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('[Storage] All tracks cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// === PLAYLIST OPERATIONS ===

export async function savePlaylist(playlist) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PLAYLISTS], 'readwrite');
    const store = transaction.objectStore(STORES.PLAYLISTS);
    const request = store.put(playlist);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPlaylists() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PLAYLISTS], 'readonly');
    const store = transaction.objectStore(STORES.PLAYLISTS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePlaylist(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PLAYLISTS], 'readwrite');
    const store = transaction.objectStore(STORES.PLAYLISTS);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// === SETTINGS OPERATIONS ===

export async function saveSetting(key, value) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.put({ key, value });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting(key) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SETTINGS], 'readonly');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// === LOCAL FOLDER HANDLE OPERATIONS ===

// Save local folder handles (with FileSystemHandle objects)
export async function saveLocalFolderHandles(localFolders) {
  if (!db) await initDB();
  
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([STORES.LOCAL_FOLDERS], 'readwrite');
      const store = transaction.objectStore(STORES.LOCAL_FOLDERS);
      
      // Clear existing
      await new Promise((res, rej) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => res();
        clearRequest.onerror = () => rej(clearRequest.error);
      });
      
      // Add all folders
      for (const folder of localFolders) {
        await new Promise((res, rej) => {
          const addRequest = store.put(folder);
          addRequest.onsuccess = () => res();
          addRequest.onerror = () => rej(addRequest.error);
        });
      }
      
      console.log('[Storage] Saved', localFolders.length, 'local folder handles');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Get all local folder handles
export async function getLocalFolderHandles() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.LOCAL_FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.LOCAL_FOLDERS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      console.log('[Storage] Retrieved', request.result.length, 'local folder handles');
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear all local folder handles
export async function clearLocalFolderHandles() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.LOCAL_FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.LOCAL_FOLDERS);
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('[Storage] Cleared all local folder handles');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// === DISCONNECT/CLEAR OPERATIONS ===

// Clear all Dropbox-specific data
export async function clearDropboxData() {
  if (!db) await initDB();
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[Storage] Clearing Dropbox data...');
      
      // Delete all Dropbox tracks
      const allTracks = await getAllTracks();
      const dropboxTracks = allTracks.filter(track => track.source === 'dropbox');
      
      const trackTx = db.transaction([STORES.TRACKS], 'readwrite');
      const trackStore = trackTx.objectStore(STORES.TRACKS);
      
      for (const track of dropboxTracks) {
        trackStore.delete(track.id);
      }
      
      await new Promise((res, rej) => {
        trackTx.oncomplete = () => res();
        trackTx.onerror = () => rej(trackTx.error);
      });
      
      console.log(`[Storage] Deleted ${dropboxTracks.length} Dropbox tracks`);
      
      // Clear selected folders
      const folderTx = db.transaction([STORES.FOLDERS], 'readwrite');
      const folderStore = folderTx.objectStore(STORES.FOLDERS);
      await new Promise((res, rej) => {
        const clearRequest = folderStore.clear();
        clearRequest.onsuccess = () => res();
        clearRequest.onerror = () => rej(clearRequest.error);
      });
      
      console.log('[Storage] Cleared all Dropbox folders');
      
      // Remove Dropbox tracks from playlists
      const allPlaylists = await getAllPlaylists();
      if (allPlaylists && allPlaylists.length > 0) {
        for (const playlist of allPlaylists) {
          if (playlist.trackIds && Array.isArray(playlist.trackIds)) {
            const originalCount = playlist.trackIds.length;
            playlist.trackIds = playlist.trackIds.filter(trackId => {
              // Check if track is NOT a Dropbox track
              const track = dropboxTracks.find(t => t.id === trackId);
              return !track;
            });
            
            if (playlist.trackIds.length !== originalCount) {
              await savePlaylist(playlist);
              console.log(`[Storage] Removed Dropbox tracks from playlist: ${playlist.name}`);
            }
          }
        }
      }
      
      console.log('[Storage] Dropbox data cleared successfully');
      resolve({
        tracksDeleted: dropboxTracks.length,
        foldersCleared: true
      });
    } catch (error) {
      console.error('[Storage] Error clearing Dropbox data:', error);
      reject(error);
    }
  });
}

// Clear all Local Drive-specific data
export async function clearLocalData() {
  if (!db) await initDB();
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[Storage] Clearing Local Drive data...');
      
      // Delete all local tracks
      const allTracks = await getAllTracks();
      const localTracks = allTracks.filter(track => track.source === 'local');
      
      const trackTx = db.transaction([STORES.TRACKS], 'readwrite');
      const trackStore = trackTx.objectStore(STORES.TRACKS);
      
      for (const track of localTracks) {
        trackStore.delete(track.id);
      }
      
      await new Promise((res, rej) => {
        trackTx.oncomplete = () => res();
        trackTx.onerror = () => rej(trackTx.error);
      });
      
      console.log(`[Storage] Deleted ${localTracks.length} local tracks`);
      
      // Clear local folder handles
      await clearLocalFolderHandles();
      
      // Remove local tracks from playlists
      const allPlaylists = await getAllPlaylists();
      if (allPlaylists && allPlaylists.length > 0) {
        for (const playlist of allPlaylists) {
          if (playlist.trackIds && Array.isArray(playlist.trackIds)) {
            const originalCount = playlist.trackIds.length;
            playlist.trackIds = playlist.trackIds.filter(trackId => {
              // Check if track is NOT a local track
              const track = localTracks.find(t => t.id === trackId);
              return !track;
            });
            
            if (playlist.trackIds.length !== originalCount) {
              await savePlaylist(playlist);
              console.log(`[Storage] Removed local tracks from playlist: ${playlist.name}`);
            }
          }
        }
      }
      
      console.log('[Storage] Local Drive data cleared successfully');
      resolve({
        tracksDeleted: localTracks.length,
        foldersCleared: true
      });
    } catch (error) {
      console.error('[Storage] Error clearing Local Drive data:', error);
      reject(error);
    }
  });
}

// Initialize database on module load
initDB().catch(err => {
  console.error('[Storage] Failed to initialize database:', err);
});
