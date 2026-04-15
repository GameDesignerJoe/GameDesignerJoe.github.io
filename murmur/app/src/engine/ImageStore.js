/**
 * ImageStore — IndexedDB persistence for generated image blobs.
 * Keyed by "storyId/slot" so images survive page refresh.
 *
 * Slots for MVP: "cover"
 * Future slots: "default-bg", "scene/{sceneId}", "portrait/{emotion}"
 */

const DB_NAME = 'murmur_images'
const DB_VERSION = 1
const STORE_NAME = 'images'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Save an image blob for a story slot */
export async function saveImageBlob(storyId, slot, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, `${storyId}/${slot}`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load an image blob for a story slot; returns null if not found */
export async function loadImageBlob(storyId, slot) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(`${storyId}/${slot}`)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/** Load all image blobs for a story; returns { slot: blob } map */
export async function loadStoryImages(storyId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    const results = {}
    const prefix = `${storyId}/`
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        if (cursor.key.startsWith(prefix)) {
          const slot = cursor.key.slice(prefix.length)
          results[slot] = cursor.value
        }
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/** Delete a stored image blob */
export async function deleteImageBlob(storyId, slot) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(`${storyId}/${slot}`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
