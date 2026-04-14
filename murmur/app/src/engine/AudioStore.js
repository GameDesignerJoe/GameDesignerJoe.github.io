/**
 * AudioStore — IndexedDB persistence for generated TTS audio blobs.
 * Keyed by "storyId/sceneId" so audio survives page refresh.
 */

const DB_NAME = 'murmur_audio'
const DB_VERSION = 1
const STORE_NAME = 'clips'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Save an audio blob for a scene */
export async function saveAudioBlob(storyId, sceneId, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, `${storyId}/${sceneId}`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load an audio blob for a scene, returns null if not found */
export async function loadAudioBlob(storyId, sceneId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(`${storyId}/${sceneId}`)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/** Load all audio blobs for a story, returns { sceneId: blob } map */
export async function loadStoryAudio(storyId) {
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
          const sceneId = cursor.key.slice(prefix.length)
          results[sceneId] = cursor.value
        }
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/** Get a blob as a downloadable File object */
export async function getAudioFile(storyId, sceneId) {
  const blob = await loadAudioBlob(storyId, sceneId)
  if (!blob) return null
  return new File([blob], `${sceneId}-a.mp3`, { type: 'audio/mpeg' })
}
