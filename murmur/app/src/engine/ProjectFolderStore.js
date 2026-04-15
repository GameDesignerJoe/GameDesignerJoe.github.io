/**
 * ProjectFolderStore — persistent storage of FileSystemDirectoryHandle per story.
 *
 * File System Access API directory handles are structured-cloneable, so we can
 * store them in IndexedDB. On page reload we can retrieve the handle and ask
 * the browser to re-verify permission (requires a user gesture).
 */

const DB_NAME = 'murmur_project_folders'
const DB_VERSION = 1
const STORE_NAME = 'handles'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Save a directory handle for a story */
export async function setProjectFolder(storyId, handle) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, storyId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get the stored handle for a story (or null). Does NOT re-verify permission. */
export async function getProjectFolder(storyId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(storyId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/** Remove the stored handle for a story */
export async function clearProjectFolder(storyId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(storyId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Find the first unused filename in a directory, using a sequence like:
 *   baseName.ext, baseName-02.ext, baseName-03.ext, …
 *
 * Lets us save generated images without overwriting earlier versions — so
 * the user keeps a history on disk and can revert to an older image later.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} baseName - filename without extension, e.g. "the-black-door-cover"
 * @param {string} ext - extension without dot, e.g. "png"
 * @returns {Promise<string>} the free filename, e.g. "the-black-door-cover-02.png"
 */
export async function findFreeFilename(dirHandle, baseName, ext) {
  // Try the unsuffixed name first
  const bare = `${baseName}.${ext}`
  try {
    await dirHandle.getFileHandle(bare)
    // exists — fall through to numbered search
  } catch {
    return bare
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseName}-${String(i).padStart(2, '0')}.${ext}`
    try {
      await dirHandle.getFileHandle(candidate)
      // exists — try next
    } catch {
      return candidate
    }
  }
  throw new Error(`No free filename found for ${baseName}.${ext} (tried up to 999)`)
}

/**
 * Ensure we have readwrite permission on the stored handle. Must be called
 * from within a user gesture (e.g. click handler) or the browser will throw
 * SecurityError on requestPermission. Returns true if permission granted,
 * false if denied / unavailable / the handle is stale.
 */
export async function ensurePermission(handle) {
  if (!handle || typeof handle.queryPermission !== 'function') return false
  const opts = { mode: 'readwrite' }
  try {
    const perm = await handle.queryPermission(opts)
    if (perm === 'granted') return true
  } catch (e) {
    // Handle is stale (folder moved/deleted) or browser doesn't implement the API
    console.warn('[Murmur] queryPermission failed:', e?.message || e)
    return false
  }
  try {
    const perm = await handle.requestPermission(opts)
    return perm === 'granted'
  } catch (e) {
    // Most commonly: SecurityError because we're not in a user gesture anymore
    console.warn('[Murmur] requestPermission failed:', e?.message || e)
    return false
  }
}
