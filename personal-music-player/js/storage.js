// IndexedDB Storage Module
// Handles all database operations for the music player

const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  TRACKS: 'tracks',
  FOLDERS: 'folders',
  PLAYLISTS: 'playlists',
  SETTINGS: 'settings'
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
      }
      
      // Folders store (selected music folders)
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        db.createObjectStore(STORES.FOLDERS, { keyPath: 'path' });
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

// Initialize database on module load
initDB().catch(err => {
  console.error('[Storage] Failed to initialize database:', err);
});
