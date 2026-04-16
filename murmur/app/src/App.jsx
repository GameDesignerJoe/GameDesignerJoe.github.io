import { useEffect } from 'react'
import { useStore } from './store'
import Nav from './components/Nav/Nav'
import Library from './components/Library/Library'
import Detail from './components/Detail/Detail'
import Player from './components/Player/Player'
import Creator from './components/Creator/Creator'
import { loadStoryImages } from './engine/ImageStore'

export default function App() {
  const view = useStore(s => s.view)

  // On boot:
  // 1. Fetch the stories manifest to discover user-created stories (e.g. the-black-door)
  //    that aren't in DEMO_STORIES. Only adds stories not already in localStorage.
  // 2. Restore image blobs from IndexedDB for all stories.
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      // 1. Load stories from the manifest (stories saved to public/stories/ via Save to Project)
      try {
        const base = import.meta.env.BASE_URL || '/'
        const manifestRes = await fetch(`${base}stories/manifest.json`)
        if (manifestRes.ok) {
          const ids = await manifestRes.json()
          const fetched = []
          for (const id of ids) {
            try {
              const res = await fetch(`${base}stories/${id}/${id}.json`)
              if (res.ok) fetched.push(await res.json())
            } catch { /* skip unloadable stories */ }
          }
          if (fetched.length > 0 && !cancelled) {
            useStore.getState().mergeManifestStories(fetched)
            console.log(`[Murmur] Manifest: merged ${fetched.length} stories from disk`)
          }
        }
      } catch (e) {
        console.warn('[Murmur] Failed to load stories manifest:', e?.message || e)
      }

      // 2. Restore image blobs from IndexedDB
      const { stories, hydrateImagesForStory } = useStore.getState()
      for (const st of stories) {
        if (cancelled) return
        try {
          const blobs = await loadStoryImages(st.id)
          if (!blobs || Object.keys(blobs).length === 0) continue
          const patch = { scenes: {} }
          if (blobs['cover']) patch.coverImage = URL.createObjectURL(blobs['cover'])
          if (blobs['default-bg']) patch.defaultBgImage = URL.createObjectURL(blobs['default-bg'])
          for (const [slot, blob] of Object.entries(blobs)) {
            if (!slot.startsWith('scene/')) continue
            const sceneId = slot.slice(6)
            patch.scenes[sceneId] = URL.createObjectURL(blob)
          }
          const restoredCount = (patch.coverImage ? 1 : 0) + (patch.defaultBgImage ? 1 : 0) + Object.keys(patch.scenes).length
          if (restoredCount > 0) {
            console.log(`[Murmur] Restored ${restoredCount} image(s) for "${st.id}"`)
            hydrateImagesForStory(st.id, patch)
          }
        } catch (e) {
          console.warn(`[Murmur] Image hydration failed for "${st.id}":`, e?.message || e)
        }
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <Nav />
      <Library />
      <Detail />
      <Player />
      <Creator />
    </>
  )
}
