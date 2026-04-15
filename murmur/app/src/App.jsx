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

  // On boot, restore image blobs from IndexedDB into the stories array so
  // Library and Detail can render covers without having to enter the editor
  // first. Blob URLs are stripped from localStorage on save, so we rebuild
  // them from the persisted blobs on each load.
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
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
