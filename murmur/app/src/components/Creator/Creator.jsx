import { useStore } from '../../store'
import NodeGraph from './NodeGraph'
import EditPanel from './EditPanel'
import CsvImporter from './CsvImporter'
import ImageStudioModal from './ImageStudioModal'
import ImageInputWithGenerate from './ImageInputWithGenerate'
import { saveAudioBlob, loadStoryAudio } from '../../engine/AudioStore'
import { loadStoryImages } from '../../engine/ImageStore'
import { getProjectFolder, setProjectFolder, clearProjectFolder, ensurePermission, findFreeFilename } from '../../engine/ProjectFolderStore'
import { resolveAssetPath } from '../../engine/assetPath'
import { useState, useRef, useEffect, useCallback } from 'react'

// Build a descriptive audio filename: "{story-title}-{narrator-name}-{sceneId}-a.mp3"
// Example: "the-black-door-eleanor-the_arrival-a.mp3"
function slugify(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function audioFilename(story, sceneId) {
  const storyPart = slugify(story.title) || slugify(story.id) || 'story'
  const narratorPart = slugify(story.narrator?.name) || 'narrator'
  return `${storyPart}-${narratorPart}-${sceneId}-a.mp3`
}

// Build a filename for a generated image slot. Imagen returns PNG so we keep .png.
// Slots: "cover", "default-bg", "scene/{sceneId}", "portrait/{emotion}"
function imageFilename(story, slot) {
  return `${imageBaseName(story, slot)}.png`
}

// Base filename (no extension) — pairs with findFreeFilename for versioned saves.
function imageBaseName(story, slot) {
  const storyPart = slugify(story.title) || slugify(story.id) || 'story'
  if (slot === 'cover') return `${storyPart}-cover`
  if (slot === 'default-bg') return `${storyPart}-default-bg`
  if (slot.startsWith('scene/')) return `${storyPart}-scene-${slot.slice(6)}`
  if (slot.startsWith('portrait/')) return `${storyPart}-portrait-${slot.slice(9)}`
  return `${storyPart}-${slot}`
}

// Read the currently-set field value for an image slot on a story.
// Used to decide whether a slot was already persisted to disk (path) vs still
// needs to be written from IndexedDB (blob: URL or null).
function currentValueForSlot(story, slot) {
  if (slot === 'cover') return story.coverImage
  if (slot === 'default-bg') return story.defaultBgImage
  if (slot.startsWith('scene/')) {
    const sid = slot.slice(6)
    return story.scenes?.[sid]?.bgImage
  }
  if (slot.startsWith('portrait/')) {
    const em = slot.slice(9)
    return story.narrator?.portraits?.[em]
  }
  return null
}

export default function Creator() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const creator = useStore(s => s.creator)
  const allStories = useStore(s => s.stories)
  const showHiddenStories = useStore(s => s.showHiddenStories)
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const launchStory = useStore(s => s.launchStory)
  const addScene = useStore(s => s.addScene)
  const selectNode = useStore(s => s.selectNode)
  const updateScene = useStore(s => s.updateScene)
  const deleteScene = useStore(s => s.deleteScene)
  const updateStoryField = useStore(s => s.updateStoryField)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showTtsModal, setShowTtsModal] = useState(false)
  const [showStorySettings, setShowStorySettings] = useState(false)
  const [imageStudioTarget, setImageStudioTarget] = useState(null) // { slot, storyId } | null

  // The dropdown should keep displaying the currently-edited story even if it's hidden
  // and the toggle is off — otherwise the user would get stuck unable to see which
  // story they're editing. We still exclude other hidden stories from the list.
  const stories = allStories.filter(s => showHiddenStories || !s.hidden || s.id === creator.story?.id)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sceneSidebarWidth, setSceneSidebarWidth] = useState(250)
  const sceneDragging = useRef(false)

  // Delete key removes the selected node (when focus isn't in an input/textarea)
  useEffect(() => {
    if (view !== 'creator') return
    const handleKey = (e) => {
      if (e.key !== 'Delete') return
      const { selectedNodeId: sel, story: st } = useStore.getState().creator
      if (!sel || !st) return
      const tag = document.activeElement?.tagName
      const editable = document.activeElement?.isContentEditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return
      const scene = st.scenes[sel]
      if (!scene) return
      if (confirm(`Delete scene "${scene.title}"?`)) {
        deleteScene(sel)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [view, deleteScene])

  useEffect(() => {
    const handleMove = (e) => {
      if (!sceneDragging.current) return
      setSceneSidebarWidth(Math.max(180, Math.min(500, e.clientX)))
    }
    const handleUp = () => { sceneDragging.current = false; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])
  const [panelWidth, setPanelWidth] = useState(360)
  const [audioRestored, setAudioRestored] = useState(null)
  const [imagesRestored, setImagesRestored] = useState(null)

  // Restore audio from IndexedDB when story loads in creator
  useEffect(() => {
    if (view !== 'creator' || !creator.story) return
    const storyId = creator.story.id
    if (audioRestored === storyId) return // already restored for this story
    loadStoryAudio(storyId).then(blobs => {
      const sceneIds = Object.keys(blobs)
      if (sceneIds.length === 0) return
      console.log(`[Murmur] Restoring ${sceneIds.length} audio clips from IndexedDB for "${storyId}"`)
      sceneIds.forEach(sceneId => {
        const scene = creator.story.scenes[sceneId]
        if (scene && (scene.clips.length === 0 || scene.clips.every(c => c.startsWith('blob:')))) {
          const clipUrl = URL.createObjectURL(blobs[sceneId])
          updateScene(sceneId, 'clips', [clipUrl])
        }
      })
      setAudioRestored(storyId)
    }).catch(err => console.warn('[Murmur] Failed to restore audio:', err.message))
  }, [view, creator.story?.id])

  // Restore generated images from IndexedDB when a story loads in the creator.
  // Blob URLs in localStorage are stripped on save, so we re-create them here.
  useEffect(() => {
    if (view !== 'creator' || !creator.story) return
    const storyId = creator.story.id
    if (imagesRestored === storyId) return
    loadStoryImages(storyId).then(blobs => {
      const slots = Object.keys(blobs)
      if (slots.length === 0) { setImagesRestored(storyId); return }
      console.log(`[Murmur] Restoring ${slots.length} image(s) from IndexedDB for "${storyId}"`)
      if (blobs['cover'] && !creator.story.coverImage) {
        updateStoryField('coverImage', URL.createObjectURL(blobs['cover']))
      }
      if (blobs['default-bg'] && !creator.story.defaultBgImage) {
        updateStoryField('defaultBgImage', URL.createObjectURL(blobs['default-bg']))
      }
      setImagesRestored(storyId)
    }).catch(err => console.warn('[Murmur] Failed to restore images:', err.message))
  }, [view, creator.story?.id])

  if (view !== 'creator') return null

  const { story, selectedNodeId } = creator

  const saveToProject = async () => {
    if (!story) return
    try {
      // Prefer a previously-chosen folder for this story (stored in IndexedDB).
      // On first use, prompt for a folder and remember it.
      let storyDir = null
      const stored = await getProjectFolder(story.id)
      if (stored) {
        const ok = await ensurePermission(stored)
        if (ok) storyDir = stored
        else console.warn('[Murmur] Permission denied on stored project folder — falling back to picker')
      }

      if (!storyDir) {
        const pickedDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        // If the user picked the story folder itself (common mistake), use it directly.
        // Otherwise, create/get a subfolder named {story.id} inside the picked folder.
        if (pickedDir.name === story.id) {
          storyDir = pickedDir
          console.log(`[Murmur] Picked folder is named "${story.id}" — saving directly into it (no nesting)`)
        } else {
          storyDir = await pickedDir.getDirectoryHandle(story.id, { create: true })
        }
        // Remember for next time so we don't ask again.
        await setProjectFolder(story.id, storyDir)
      }

      // 1. Write any pending image blobs (those the story still references as
      //    blob: URLs) to disk with versioned filenames. Collects the final
      //    paths so we can bake them into the JSON below. Slots whose story
      //    field is already a path (set by auto-save) are treated as already
      //    on disk — we skip them.
      const imageBlobs = await loadStoryImages(story.id)
      const imageSlots = Object.keys(imageBlobs)
      const imagePathBySlot = {} // slot -> "storyId/images/filename"
      if (imageSlots.length > 0) {
        const imagesDir = await storyDir.getDirectoryHandle('images', { create: true })
        for (const slot of imageSlots) {
          const currentFieldValue = currentValueForSlot(story, slot)
          if (typeof currentFieldValue === 'string' && !currentFieldValue.startsWith('blob:') && currentFieldValue.length > 0) {
            // Already a path — auto-save wrote this earlier, nothing to do.
            console.log(`[Murmur]   ${slot}: already persisted at "${currentFieldValue}" (skip)`)
            continue
          }
          const baseName = imageBaseName(story, slot)
          const filename = await findFreeFilename(imagesDir, baseName, 'png')
          const fh = await imagesDir.getFileHandle(filename, { create: true })
          const w = await fh.createWritable()
          await w.write(imageBlobs[slot])
          await w.close()
          const newPath = `${story.id}/images/${filename}`
          imagePathBySlot[slot] = newPath
          console.log(`[Murmur]   ${slot} → ${filename}: WRITTEN (${(imageBlobs[slot].size / 1024).toFixed(0)} KB)`)
        }
      }

      // Build a fast scene-id → blob URL map for the JSON replacer (so we can
      // tell which scene owns a particular bgImage blob URL during serialization).
      const scenePathByBlob = {}
      for (const slot of Object.keys(imagePathBySlot)) {
        if (slot.startsWith('scene/')) {
          const sceneId = slot.slice(6)
          const blobUrl = story.scenes?.[sceneId]?.bgImage
          if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
            scenePathByBlob[blobUrl] = imagePathBySlot[slot]
          }
        }
      }

      // 2. Write story JSON — with blob URLs rewritten to the just-written paths
      const clean = JSON.parse(JSON.stringify(story, (key, val) => {
        // Replace blob URLs in audio clip arrays with local file paths
        if (key === 'clips' && Array.isArray(val)) {
          return val.map((c) => {
            if (!c.startsWith('blob:')) return c
            const owner = Object.values(story.scenes).find(s => s.clips?.includes(c))
            const sid = owner?.id || 'clip'
            return `${story.id}/audio/${audioFilename(story, sid)}`
          })
        }
        // Replace blob URLs in image fields with the versioned path we just wrote
        if (key === 'coverImage' && typeof val === 'string' && val.startsWith('blob:')) {
          return imagePathBySlot['cover'] || val
        }
        if (key === 'defaultBgImage' && typeof val === 'string' && val.startsWith('blob:')) {
          return imagePathBySlot['default-bg'] || val
        }
        if (key === 'bgImage' && typeof val === 'string' && val.startsWith('blob:')) {
          return scenePathByBlob[val] || val
        }
        return val
      }))
      delete clean._pos
      const jsonBlob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
      const jsonHandle = await storyDir.getFileHandle(`${story.id}.json`, { create: true })
      const jsonWriter = await jsonHandle.createWritable()
      await jsonWriter.write(jsonBlob)
      await jsonWriter.close()
      console.log(`[Murmur] Saved ${story.id}.json`)

      // After JSON is written, sync the in-memory fields to the new paths too,
      // so the editor state reflects what's on disk (and the next save doesn't
      // re-write the same blob to another versioned file).
      if (imagePathBySlot['cover']) updateStoryField('coverImage', imagePathBySlot['cover'])
      if (imagePathBySlot['default-bg']) updateStoryField('defaultBgImage', imagePathBySlot['default-bg'])
      for (const slot of Object.keys(imagePathBySlot)) {
        if (slot.startsWith('scene/')) {
          const sceneId = slot.slice(6)
          updateScene(sceneId, 'bgImage', imagePathBySlot[slot])
        }
      }

      // 2. Write audio from IndexedDB — only scenes whose audio is newer than the file on disk
      const blobs = await loadStoryAudio(story.id)
      const audioIds = Object.keys(blobs)
      if (audioIds.length > 0) {
        const audioDir = await storyDir.getDirectoryHandle('audio', { create: true })
        let written = 0
        let skipped = 0
        for (const sceneId of audioIds) {
          const scene = story.scenes[sceneId]
          const generatedAt = scene?.audioGeneratedAt || 0
          const filename = audioFilename(story, sceneId)

          // Check if an up-to-date file already exists on disk
          let shouldWrite = true
          try {
            const existingHandle = await audioDir.getFileHandle(filename)
            const existingFile = await existingHandle.getFile()
            // File on disk is newer (or same age) as the generated audio — skip
            if (existingFile.lastModified >= generatedAt) {
              shouldWrite = false
              skipped++
            }
          } catch {
            // File doesn't exist yet — will create it below
          }

          if (shouldWrite) {
            const fh = await audioDir.getFileHandle(filename, { create: true })
            const w = await fh.createWritable()
            await w.write(blobs[sceneId])
            await w.close()
            written++
          }
        }
        console.log(`[Murmur] Audio: ${written} written, ${skipped} skipped (up to date) in ${story.id}/audio/`)
      }

      // (Images were written in step 1 — before the JSON — so the versioned
      // paths could be baked into the JSON output.)

      console.log(`%c[Murmur] Project saved: ${story.id}/`, 'color: #4ade80; font-weight: bold')
    } catch (err) {
      if (err?.name === 'AbortError') return // user cancelled picker
      console.error('[Murmur] Save failed:', err)
      // Surface the failure to the user so they don't think the app is broken
      try { alert(`Save failed: ${err?.message || err}\n\nSee the console for details.`) } catch {}
    }
  }

  const importJson = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      try {
        const story = JSON.parse(text)
        if (story.scenes && story.id) {
          setCreatorStory(story)
          useStore.getState().addStory(story)
        } else {
          alert('Invalid story JSON')
        }
      } catch {
        alert('Failed to parse JSON file')
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header — matches Stitch creator-main.html */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 24px', height: '56px', flexShrink: 0,
        background: '#07070f', borderBottom: '1px solid #222236',
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '20px',
              color: '#c9a96e', letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', fontWeight: 700,
            }}
            onClick={() => setView('library')}
          >
            ‹ Murmur
          </div>
          <div style={{ height: '16px', width: '1px', background: '#222236' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <select
              value={story?.id || ''}
              onChange={e => {
                const found = stories.find(s => s.id === e.target.value)
                if (found) setCreatorStory(found)
              }}
              style={{
                background: 'transparent', border: 'none',
                color: '#a9a8ca', fontSize: '14px', fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', outline: 'none',
                paddingRight: '24px',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23706c8a'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
            >
              {stories.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#0f0f1c', color: '#f0ede6' }}>{s.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: action groups */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Grouped text buttons */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#0f0f1c', border: '1px solid #222236', borderRadius: '6px',
            padding: '4px 12px', gap: '16px',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: '#a9a8ca',
          }}>
            <HeaderTextBtn icon="add" label="Scene" onClick={addScene} />
            <HeaderTextBtn label="Import JSON" onClick={importJson} />
            <HeaderTextBtn label="Import CSV" onClick={() => setShowCsvModal(true)} />
            <HeaderTextBtn icon="volume_up" label="TTS" onClick={() => setShowTtsModal(true)} />
          </div>

          {/* Icon buttons: Play, Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HeaderIconBtn icon="play_arrow" title="Play story" onClick={() => {
              if (story) launchStory(story, story.startScene)
            }} />
            <HeaderIconBtn icon="tune" title="Story settings" onClick={() => setShowStorySettings(true)} />
          </div>

          {/* Save to Project */}
          <button
            onClick={saveToProject}
            style={{
              background: '#c9a96e', color: '#412d00',
              padding: '6px 20px', borderRadius: '9999px', border: 'none',
              fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
            Save to Project
          </button>
        </div>
      </header>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden relative z-10"
          style={{
            width: sidebarOpen ? sceneSidebarWidth : 40,
            borderRight: '1px solid var(--s3)',
            transition: sceneDragging.current ? 'none' : 'width 0.2s ease',
          }}
        >
          {/* Drag handle (only when open) */}
          {sidebarOpen && (
            <div
              className="absolute top-0 bottom-0 w-[5px] cursor-col-resize z-20 hover:bg-[rgba(201,169,110,0.2)] transition-colors"
              style={{ right: 0 }}
              onMouseDown={() => { sceneDragging.current = true; document.body.style.cursor = 'col-resize' }}
            />
          )}
          {/* Header with collapse toggle */}
          <div
            className="flex items-center flex-shrink-0"
            style={{ padding: sidebarOpen ? '14px 18px 10px' : '14px 8px 10px', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sub)', justifyContent: sidebarOpen ? 'space-between' : 'center' }}
          >
            {sidebarOpen && <span>Scenes</span>}
            <div className="flex items-center gap-2">
              {sidebarOpen && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-[16px]"
                  style={{ background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--sub)' }}
                  onClick={addScene}
                >+</div>
              )}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--sub)' }}
                onClick={() => setSidebarOpen(o => !o)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
              </div>
            </div>
          </div>
          {sidebarOpen && (
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--s3) transparent' }}>
              {story && Object.values(story.scenes).map(sc => (
                <div
                  key={sc.id}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: '13px 18px',
                    borderBottom: '1px solid var(--s2)',
                    background: selectedNodeId === sc.id ? 'var(--gold10)' : 'transparent',
                    borderLeft: selectedNodeId === sc.id ? '3px solid var(--gold)' : 'none',
                  }}
                  onClick={() => selectNode(sc.id)}
                  onMouseEnter={e => e.currentTarget.style.background = selectedNodeId === sc.id ? 'var(--gold10)' : 'var(--s1)'}
                  onMouseLeave={e => e.currentTarget.style.background = selectedNodeId === sc.id ? 'var(--gold10)' : 'transparent'}
                >
                  <div className="text-[15px] font-medium" style={{ color: 'var(--text)', marginBottom: 3 }}>
                    {sc.title}{sc.id === story.startScene ? ' ★' : ''}
                  </div>
                  <div className="text-[12px]" style={{ color: 'var(--sub)' }}>
                    {sc.emotion} · {sc.clips.length} clip{sc.clips.length !== 1 ? 's' : ''} · -{sc.secondsBeforeEnd || 0}s · {sc.countdown || 0}s cd
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <NodeGraph />
        {selectedNodeId && (
          <ResizablePanel width={panelWidth} onResize={setPanelWidth}>
            <EditPanel onOpenImageStudio={(slot) => setImageStudioTarget({ slot, storyId: story?.id })} />
          </ResizablePanel>
        )}
      </div>

      {showCsvModal && <CsvImporter onClose={() => setShowCsvModal(false)} />}
      {showTtsModal && <TtsModal onClose={() => setShowTtsModal(false)} />}
      {showStorySettings && <StorySettingsModal onClose={() => setShowStorySettings(false)} onOpenImageStudio={(slot) => setImageStudioTarget({ slot, storyId: story?.id })} />}
      {imageStudioTarget && <ImageStudioModal target={imageStudioTarget} onClose={() => setImageStudioTarget(null)} />}
    </div>
  )
}

function ResizablePanel({ width, onResize, children }) {
  const dragRef = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragging.current) return
      const newW = window.innerWidth - e.clientX
      onResize(Math.max(300, Math.min(700, newW)))
    }
    const handleUp = () => { dragging.current = false; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [onResize])

  return (
    <div className="relative flex flex-shrink-0 z-10" style={{ width }}>
      {/* Drag handle */}
      <div
        ref={dragRef}
        className="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-[rgba(201,169,110,0.2)] transition-colors"
        style={{ borderLeft: '1px solid var(--s3)' }}
        onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize' }}
      />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function HeaderTextBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        background: 'none', border: 'none', color: '#a9a8ca',
        cursor: 'pointer', transition: 'color 0.15s',
        fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
      onMouseLeave={e => e.currentTarget.style.color = '#a9a8ca'}
    >
      {icon && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>}
      {label}
    </button>
  )
}

function HeaderIconBtn({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#928faa', transition: 'color 0.15s',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#f0ede6'}
      onMouseLeave={e => e.currentTarget.style.color = '#928faa'}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
    </button>
  )
}

function TtsModal({ onClose }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('elevenlabs_api_key') || '')
  const [showKey, setShowKey] = useState(false)
  const [personalVoices, setPersonalVoices] = useState([])
  const [libraryVoices, setLibraryVoices] = useState([])
  const [libraryTotal, setLibraryTotal] = useState(0)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('')
  const [filters, setFilters] = useState({ language: 'en', accent: '', gender: '', age: '', use_case: '' })
  const [generating, setGenerating] = useState(false)
  const [model, setModel] = useState('eleven_multilingual_v2')
  const [stability, setStability] = useState(0.5)
  const [similarity, setSimilarity] = useState(0.75)
  const [progress, setProgress] = useState({ current: 0, total: 0, scene: '', errors: 0 })
  const [error, setError] = useState('')

  const models = [
    { id: 'eleven_v3', name: 'Eleven v3 — Most Expressive' },
    { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2 — Stable' },
    { id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5 — Low Latency' },
  ]

  // Filter options — languages use ISO codes, rest are ElevenLabs label values
  const LANG_OPTIONS = [
    { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' }, { value: 'it', label: 'Italian' }, { value: 'pt', label: 'Portuguese' },
    { value: 'pl', label: 'Polish' }, { value: 'hi', label: 'Hindi' }, { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' }, { value: 'zh', label: 'Chinese' }, { value: 'ar', label: 'Arabic' },
    { value: 'nl', label: 'Dutch' }, { value: 'ru', label: 'Russian' }, { value: 'sv', label: 'Swedish' },
    { value: 'tr', label: 'Turkish' }, { value: 'id', label: 'Indonesian' }, { value: 'fil', label: 'Filipino' },
  ]
  const GENDER_OPTIONS = ['male', 'female']
  const AGE_OPTIONS = ['young', 'middle_aged', 'old']
  const ACCENT_OPTIONS = ['american', 'british', 'australian', 'irish', 'indian', 'african', 'canadian', 'scottish', 'latin american']
  const USE_CASE_OPTIONS = [
    { value: 'conversational', label: 'Conversational' },
    { value: 'narrative_story', label: 'Narration' },
    { value: 'characters_animation', label: 'Characters' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'informative_educational', label: 'Educational' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'entertainment_tv', label: 'Entertainment' },
  ]

  const fetchLibrary = useCallback(async (currentFilters) => {
    if (!apiKey) return
    setLoadingLibrary(true)
    try {
      const params = new URLSearchParams({ page_size: '100' })
      if (currentFilters.language) params.set('language', currentFilters.language)
      if (currentFilters.gender) params.set('gender', currentFilters.gender)
      if (currentFilters.age) params.set('age', currentFilters.age)
      if (currentFilters.accent) params.set('accent', currentFilters.accent)
      if (currentFilters.use_case) params.set('use_cases', currentFilters.use_case)
      const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, {
        headers: { 'xi-api-key': apiKey }
      })
      const data = await res.json()
      const normalized = (data.voices || []).map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        preview_url: v.preview_url,
        description: v.description || '',
        gender: v.gender || '',
        accent: v.accent || '',
        age: v.age || '',
        use_case: v.use_case || '',
        _source: 'library',
      }))
      setLibraryVoices(normalized)
      setLibraryTotal(data.total_count || normalized.length)
    } catch { /* silent */ }
    setLoadingLibrary(false)
  }, [apiKey])

  const fetchVoices = async () => {
    if (!apiKey) { setError('Enter API key first'); return }
    localStorage.setItem('elevenlabs_api_key', apiKey)
    setError('')
    try {
      // Personal voices
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      })
      const data = await res.json()
      setPersonalVoices((data.voices || []).map(v => ({ ...v, _source: 'personal' })))
      setVoicesLoaded(true)
      // Shared library (with current filters)
      await fetchLibrary(filters)
    } catch (err) {
      setError(err.message)
    }
  }

  // Re-fetch library voices when filters change (only after initial load)
  useEffect(() => {
    if (!voicesLoaded) return
    fetchLibrary(filters)
  }, [filters, voicesLoaded, fetchLibrary])

  // Combined voice list: personal first, then library
  const allVoices = [
    ...personalVoices,
    ...libraryVoices.filter(lv => !personalVoices.some(pv => pv.voice_id === lv.voice_id)),
  ]

  const previewVoice = async () => {
    if (!selectedVoice) return
    const voice = allVoices.find(v => v.voice_id === selectedVoice)
    if (voice?.preview_url) {
      new Audio(voice.preview_url).play()
    }
  }

  // Scan story scenes for TTS status
  const story = useStore.getState().creator.story
  const updateScene = useStore.getState().updateScene
  const scenes = story ? Object.values(story.scenes) : []
  const scenesWithScript = scenes.filter(s => s.script?.trim())
  const scenesNeedingAudio = scenesWithScript.filter(s =>
    s.clips.length === 0 || (s.scriptUpdatedAt && (!s.audioGeneratedAt || s.scriptUpdatedAt > s.audioGeneratedAt))
  )
  const scenesUpToDate = scenesWithScript.filter(s =>
    s.clips.length > 0 && s.audioGeneratedAt && (!s.scriptUpdatedAt || s.audioGeneratedAt >= s.scriptUpdatedAt)
  )

  const generateAudio = async () => {
    const toGenerate = scenesNeedingAudio
    if (!apiKey || !selectedVoice || toGenerate.length === 0) {
      setError('Need API key, voice, and scenes with scripts')
      return
    }

    // Pick save folder — one prompt, then everything is automatic
    let audioDir = null
    if (window.showDirectoryPicker) {
      try {
        audioDir = await window.showDirectoryPicker({ mode: 'readwrite' })
      } catch (err) {
        if (err.name === 'AbortError') return // user cancelled — don't spend tokens
        console.warn('[Murmur TTS] Folder picker failed, saving to IndexedDB only:', err.message)
      }
    }

    setGenerating(true)
    setError('')
    let completed = 0
    let errors = 0
    const total = toGenerate.length
    setProgress({ current: 0, total, scene: '', errors: 0 })

    // Concurrency-limited queue (Creator plan = 5 concurrent)
    const CONCURRENCY = 5
    const RETRY_DELAYS = [2000, 5000, 10000] // exponential backoff
    const queue = [...toGenerate]
    const active = new Set()

    console.group(`%c[Murmur TTS] Starting generation: ${total} scenes`, 'color: #c9a96e; font-weight: bold')
    console.log(`Voice: ${selectedVoice} | Model: ${model} | Stability: ${stability} | Similarity: ${similarity}`)
    console.log(`Concurrency limit: ${CONCURRENCY}`)

    const processScene = async (scene) => {
      const sceneId = scene.id
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`  [${sceneId}] Retry ${attempt}/${RETRY_DELAYS.length} after ${RETRY_DELAYS[attempt - 1]}ms`)
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
          }
          console.log(`  [${sceneId}] Sending "${scene.title}" (${scene.script.length} chars)...`)

          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: scene.script,
              model_id: model,
              voice_settings: { stability, similarity_boost: similarity }
            })
          })

          const concurrent = res.headers.get('current-concurrent-requests')
          const maxConcurrent = res.headers.get('maximum-concurrent-requests')
          if (concurrent) console.log(`  [${sceneId}] Concurrency: ${concurrent}/${maxConcurrent}`)

          if (res.status === 429) {
            const body = await res.json().catch(() => ({}))
            console.warn(`  [${sceneId}] Rate limited (429): ${body.detail?.message || res.statusText}`)
            if (attempt < RETRY_DELAYS.length) continue
            throw new Error(`Rate limited after ${attempt + 1} attempts`)
          }

          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(`${res.status}: ${body.detail?.message || res.statusText}`)
          }

          const blob = await res.blob()
          const clipUrl = URL.createObjectURL(blob)
          console.log(`  [${sceneId}] ✓ Audio received (${(blob.size / 1024).toFixed(0)} KB)`)

          // Save to IndexedDB (persistence across refreshes)
          await saveAudioBlob(story.id, sceneId, blob)

          // Write to the folder the user picked
          if (audioDir) {
            try {
              const filename = audioFilename(story, sceneId)
              const fh = await audioDir.getFileHandle(filename, { create: true })
              const w = await fh.createWritable()
              await w.write(blob)
              await w.close()
              console.log(`  [${sceneId}] → saved: ${filename}`)
            } catch (e) { console.warn(`  [${sceneId}] Disk write failed: ${e.message}`) }
          }

          // Auto-assign audio to the scene
          updateScene(sceneId, 'clips', [clipUrl])
          updateScene(sceneId, 'audioGeneratedAt', Date.now())

          completed++
          setProgress({ current: completed, total, scene: '', errors })
          return

        } catch (err) {
          if (attempt >= RETRY_DELAYS.length) {
            console.error(`  [${sceneId}] ✗ FAILED: ${err.message}`)
            errors++
            setProgress({ current: completed, total, scene: sceneId, errors })
          }
        }
      }
    }

    // Process queue with concurrency limit
    const processQueue = async () => {
      while (queue.length > 0 || active.size > 0) {
        while (queue.length > 0 && active.size < CONCURRENCY) {
          const scene = queue.shift()
          setProgress(p => ({ ...p, scene: scene.id }))
          const promise = processScene(scene).finally(() => active.delete(promise))
          active.add(promise)
        }
        if (active.size > 0) await Promise.race(active)
      }
    }

    await processQueue()

    console.log(`%c[Murmur TTS] Done: ${completed} generated, ${errors} failed`, completed === total ? 'color: #4ade80' : 'color: #f97758')
    console.groupEnd()

    setProgress({ current: completed, total, scene: '', errors })
    setGenerating(false)
  }

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const labelStyle = { color: 'var(--sub)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: '10px', display: 'block' }
  const sectionGap = { marginBottom: '28px' }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(10px)' }}>
      <div
        className="w-full max-w-[560px] overflow-y-auto hide-scrollbar"
        style={{
          background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: '24px',
          padding: '36px 40px', maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '26px', color: 'var(--text)', fontWeight: 400 }}>
            ElevenLabs TTS
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* API Key */}
        <div style={sectionGap}>
          <label style={labelStyle}>API Key</label>
          <div className="flex" style={{ gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="cr-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="xi-..."
                style={{ paddingRight: '40px' }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showKey ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <button
              onClick={fetchVoices}
              style={{
                background: 'transparent', border: '1px solid var(--gold)', borderRadius: '12px',
                color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600,
                padding: '0 20px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gold)' }}
            >
              Load Voices
            </button>
          </div>
        </div>

        {/* Voice */}
        {voicesLoaded && (
          <div style={sectionGap}>
            <label style={labelStyle}>Voice</label>

            {/* Filter chips row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <FilterChip label="Language" value={filters.language} options={LANG_OPTIONS} onChange={v => setFilter('language', v)} />
              <FilterChip label="Accent" value={filters.accent} options={ACCENT_OPTIONS} onChange={v => setFilter('accent', v)} />
              <FilterChip label="Category" value={filters.use_case} options={USE_CASE_OPTIONS} onChange={v => setFilter('use_case', v)} />
              <FilterChip label="Gender" value={filters.gender} options={GENDER_OPTIONS} onChange={v => setFilter('gender', v)} />
              <FilterChip label="Age" value={filters.age} options={AGE_OPTIONS} onChange={v => setFilter('age', v)} />
            </div>

            {/* Voice count */}
            <div style={{ fontSize: '12px', color: 'var(--mute)', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px' }}>
              {loadingLibrary ? 'Loading voices...' : (
                <>
                  {allVoices.length} voice{allVoices.length !== 1 ? 's' : ''}
                  {libraryTotal > allVoices.length ? ` (of ${libraryTotal.toLocaleString()} matching)` : ''}
                </>
              )}
            </div>

            <select
              className="cr-input"
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23928faa'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
              }}
            >
              <option value="">Select a voice...</option>
              {personalVoices.length > 0 && <option disabled style={{ fontWeight: 700 }}>--- My Voices ---</option>}
              {personalVoices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}{v.labels?.description ? ` \u2014 ${v.labels.description}` : ''}
                </option>
              ))}
              {libraryVoices.length > 0 && <option disabled style={{ fontWeight: 700 }}>--- Voice Library ---</option>}
              {libraryVoices.filter(lv => !personalVoices.some(pv => pv.voice_id === lv.voice_id)).map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}{v.description ? ` \u2014 ${v.description}` : ''}
                </option>
              ))}
            </select>
            {selectedVoice && (
              <button
                onClick={previewVoice}
                style={{
                  marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: '10px',
                  padding: '8px 16px', cursor: 'pointer', color: 'var(--sub)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '13px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sub)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--s3)'; e.currentTarget.style.color = 'var(--sub)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Preview Voice
              </button>
            )}
          </div>
        )}

        {/* Scene Audio Status */}
        <div style={sectionGap}>
          <label style={labelStyle}>Narration Source</label>
          {!story || scenesWithScript.length === 0 ? (
            <div style={{
              borderRadius: '16px', padding: '36px 24px', textAlign: 'center',
              border: '2px dashed var(--s3)', background: 'transparent',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--mute)', display: 'block', marginBottom: '10px' }}>warning</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--sub)' }}>
                No scenes with narration scripts found.<br />Import a CSV with a <span style={{ color: 'var(--gold)' }}>narration_script</span> column first.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Needs audio */}
              {scenesNeedingAudio.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--s2)', borderRadius: '12px', padding: '14px 16px',
                  borderLeft: '3px solid var(--gold)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--gold)' }}>mic</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', flex: 1 }}>
                    <strong>{scenesNeedingAudio.length}</strong> scene{scenesNeedingAudio.length !== 1 ? 's' : ''} need{scenesNeedingAudio.length === 1 ? 's' : ''} audio
                  </span>
                </div>
              )}
              {/* Up to date */}
              {scenesUpToDate.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--s2)', borderRadius: '12px', padding: '14px 16px',
                  borderLeft: '3px solid #4ade80',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', flex: 1 }}>
                    <strong>{scenesUpToDate.length}</strong> scene{scenesUpToDate.length !== 1 ? 's' : ''} up to date
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generation Settings */}
        <div style={sectionGap}>
          <label style={{ ...labelStyle, marginBottom: '16px' }}>Generation Settings</label>

          {/* Model */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ ...labelStyle, fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>Model</label>
            <select
              className="cr-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23928faa'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
              }}
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Sliders row */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <SliderControl label="Stability" value={stability} onChange={setStability} />
            <SliderControl label="Similarity" value={similarity} onChange={setSimilarity} />
          </div>
        </div>

        {/* Progress (during/after generation) */}
        {progress.total > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {generating && progress.scene && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>
                Generating scene {progress.current + 1} of {progress.total} — {progress.scene}...
              </div>
            )}
            {!generating && progress.current > 0 && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>
                Done! Generated {progress.current} audio files.
              </div>
            )}
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--sub)', marginBottom: '8px' }}>
              {progress.current} complete · {progress.errors} error{progress.errors !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--s3)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'var(--gold)', transition: 'width 0.3s var(--silk)' }} />
              </div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--gold)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '16px', fontSize: '13px', color: '#f97758', fontFamily: "'DM Sans', sans-serif" }}>
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={generateAudio}
          disabled={generating || scenesNeedingAudio.length === 0}
          style={{
            width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
            cursor: (generating || scenesNeedingAudio.length === 0) ? 'default' : 'pointer',
            background: (generating || scenesNeedingAudio.length === 0) ? 'var(--s3)' : 'var(--gold)',
            color: (generating || scenesNeedingAudio.length === 0) ? 'var(--sub)' : 'var(--bg)',
            fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '0.03em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s', opacity: (generating || scenesNeedingAudio.length === 0) ? 0.6 : 1,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {scenesNeedingAudio.length === 0 ? 'check_circle' : 'download'}
          </span>
          {generating ? `Generating... ${pct}%` : scenesNeedingAudio.length === 0 ? 'No new lines to generate' : `Generate Audio (${scenesNeedingAudio.length} scene${scenesNeedingAudio.length !== 1 ? 's' : ''})`}
        </button>

      </div>
    </div>
  )
}

function SliderControl({ label, value, onChange }) {
  const trackRef = useRef(null)

  const handlePointer = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChange(Math.round(x * 100) / 100)
  }

  const handleMouseDown = (e) => {
    handlePointer(e)
    const move = (ev) => handlePointer(ev)
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>{label}</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--gold)' }}>{value}</span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{ position: 'relative', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'var(--s3)' }}>
          <div style={{ width: `${value * 100}%`, height: '100%', borderRadius: '2px', background: 'var(--gold25)' }} />
        </div>
        <div style={{
          position: 'absolute', left: `${value * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
          width: '14px', height: '14px', borderRadius: '50%', background: 'var(--gold)',
          boxShadow: '0 2px 8px rgba(201,169,110,0.4)',
        }} />
      </div>
    </div>
  )
}

function FilterChip({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Normalize options to { value, label } format
  const items = options.map(o => typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) } : o)

  const active = !!value
  const activeItem = items.find(i => i.value === value)
  const displayValue = activeItem?.label || (value ? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '')

  const chipStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
    padding: '5px 12px', borderRadius: '9999px', fontSize: '12px',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, whiteSpace: 'nowrap',
    border: active ? '1px solid var(--gold)' : '1px solid var(--s3)',
    background: active ? 'var(--gold10)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--sub)',
    transition: 'all 0.15s',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={chipStyle} onClick={() => setOpen(!open)}>
        {active ? (
          <>
            {label}: {displayValue}
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px', marginLeft: '2px' }}
              onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
            >close</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            {label}
          </>
        )}
      </button>

      {open && items.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 30,
          background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: '12px',
          padding: '4px', minWidth: '160px', maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }} className="hide-scrollbar">
          {active && (
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--sub)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >All</button>
          )}
          {items.map(item => {
            const selected = item.value === value
            return (
              <button
                key={item.value}
                onClick={() => { onChange(item.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: selected ? 'var(--gold10)' : 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                  fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
                  color: selected ? 'var(--gold)' : 'var(--text)', fontWeight: selected ? 600 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--s2)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'none' }}
              >{item.label}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const STORY_EMOTIONS = ['curious', 'happy', 'sad', 'afraid', 'determined']

function StorySettingsModal({ onClose, onOpenImageStudio }) {
  // — Project folder state (loaded from IndexedDB, refreshed on change)
  const storyIdForFolder = useStore(s => s.creator.story?.id) || null
  const [folderHandle, setFolderHandle] = useState(null)
  const [folderStatus, setFolderStatus] = useState('idle') // 'idle' | 'loading' | 'ready'

  useEffect(() => {
    let cancelled = false
    if (!storyIdForFolder) return
    setFolderStatus('loading')
    getProjectFolder(storyIdForFolder).then(h => {
      if (cancelled) return
      setFolderHandle(h || null)
      setFolderStatus('ready')
    }).catch(() => { if (!cancelled) setFolderStatus('ready') })
    return () => { cancelled = true }
  }, [storyIdForFolder])

  const chooseFolder = async () => {
    if (!storyIdForFolder) return
    try {
      const picked = await window.showDirectoryPicker({ mode: 'readwrite' })
      // Auto-handle the common mistake: if the user picked a folder already named
      // the story id, use it directly (prevents nesting).
      const target = (picked.name === storyIdForFolder)
        ? picked
        : await picked.getDirectoryHandle(storyIdForFolder, { create: true })
      await setProjectFolder(storyIdForFolder, target)
      setFolderHandle(target)
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[Murmur] Folder pick failed:', e)
    }
  }

  const clearFolder = async () => {
    if (!storyIdForFolder) return
    await clearProjectFolder(storyIdForFolder)
    setFolderHandle(null)
  }
  const story = useStore(s => s.creator.story)
  const updateStoryField = useStore(s => s.updateStoryField)
  const updateNarratorPortrait = useStore(s => s.updateNarratorPortrait)
  const updateNarratorField = useStore(s => s.updateNarratorField)
  const showHidden = useStore(s => s.showHiddenStories)

  if (!story) return null

  const defaults = story.defaults || { secondsBeforeEnd: 5, countdown: 10 }
  const portraits = story.narrator?.portraits || {}

  const updateDefault = (key, value) => {
    updateStoryField('defaults', { ...defaults, [key]: value })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-[640px] rounded-2xl"
        style={{ background: '#12121f', border: '1px solid #222236', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center flex-shrink-0" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #222236' }}>
          <span style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '22px', color: '#f0ede6' }}>
            Story Settings
          </span>
          <span className="material-symbols-outlined cursor-pointer" style={{ fontSize: '22px', color: '#928faa' }} onClick={onClose}>close</span>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', overflowY: 'auto' }}>
          {/* Project folder — where Save to Project writes JSON + audio + images */}
          <StorySettingsField
            label="Project Folder"
            hint={folderHandle
              ? "Assets save here automatically. Save Story writes the JSON + any pending audio."
              : "Choose the folder for this story once. Subsequent saves go there automatically — no more picker."}
          >
            {folderHandle ? (
              <div className="flex items-center justify-between" style={{
                padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--gold)' }}>folder</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {folderHandle.name || '(folder)'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={chooseFolder}
                    style={{ background: 'none', border: 'none', color: 'var(--sub)', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
                  >Change</button>
                  <button
                    onClick={clearFolder}
                    style={{ background: 'none', border: 'none', color: 'var(--sub)', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
                  >Forget</button>
                </div>
              </div>
            ) : (
              <button
                onClick={chooseFolder}
                disabled={folderStatus === 'loading'}
                style={{
                  width: '100%', padding: '12px',
                  background: 'transparent', border: '1px dashed var(--s3)', borderRadius: '10px',
                  color: 'var(--sub)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--s3)'; e.currentTarget.style.color = 'var(--sub)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder_open</span>
                Choose Project Folder…
              </button>
            )}
          </StorySettingsField>

          {/* Title */}
          <StorySettingsField label="Title">
            <input
              className="cr-input"
              value={story.title || ''}
              onChange={e => updateStoryField('title', e.target.value)}
            />
          </StorySettingsField>

          {/* Narrator name */}
          <StorySettingsField label="Narrator Name" hint="Used in audio filenames and display.">
            <input
              className="cr-input"
              value={story.narrator?.name || ''}
              placeholder="e.g. Eleanor"
              onChange={e => updateNarratorField('name', e.target.value)}
            />
          </StorySettingsField>

          {/* Cover image — rendered on Library card and Detail hero */}
          <StorySettingsField label="Cover Image" hint="Displayed on the library card and detail hero. Click ✨ to generate with AI.">
            <ImageInputWithGenerate
              value={story.coverImage || ''}
              placeholder="https://… or path/to/cover.jpg"
              onChange={url => updateStoryField('coverImage', url || null)}
              onGenerate={onOpenImageStudio ? () => onOpenImageStudio('cover') : null}
              aspectRatio="16/9"
              targetPath={`${story.id}/images/${imageFilename(story, 'cover')}`}
            />
          </StorySettingsField>

          {/* Default scene background */}
          <StorySettingsField label="Default Scene Background Image" hint="Applied to every scene unless the scene sets its own. Click ✨ to generate with AI.">
            <ImageInputWithGenerate
              value={story.defaultBgImage || ''}
              placeholder="https://… or path/to/background.jpg"
              onChange={url => updateStoryField('defaultBgImage', url || null)}
              onGenerate={onOpenImageStudio ? () => onOpenImageStudio('default-bg') : null}
              aspectRatio="16/9"
              targetPath={`${story.id}/images/${imageFilename(story, 'default-bg')}`}
            />
          </StorySettingsField>

          {/* Narrator portraits */}
          <StorySettingsField label="Narrator Portraits" hint="Per-emotion image URLs. Used across the whole story.">
            {STORY_EMOTIONS.map(em => (
              <div key={em} className="mb-2">
                <div className="text-[13px] mb-1 capitalize" style={{ color: 'var(--text)' }}>{em}</div>
                <input
                  className="cr-input"
                  value={portraits[em] || ''}
                  placeholder={`portrait-${em}.png`}
                  onChange={e => updateNarratorPortrait(em, e.target.value.trim())}
                />
              </div>
            ))}
          </StorySettingsField>

          {/* Default scene timing */}
          <StorySettingsField label="Default Scene Timing" hint="Used when creating new scenes. Existing scenes keep their own values.">
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-[13px] mb-1" style={{ color: 'var(--sub)' }}>Reveal (s before end)</div>
                <input
                  className="cr-input"
                  type="number"
                  min="0"
                  value={defaults.secondsBeforeEnd ?? 5}
                  onChange={e => updateDefault('secondsBeforeEnd', Number(e.target.value))}
                />
              </div>
              <div className="flex-1">
                <div className="text-[13px] mb-1" style={{ color: 'var(--sub)' }}>Player countdown (s)</div>
                <input
                  className="cr-input"
                  type="number"
                  min="0"
                  value={defaults.countdown ?? 10}
                  onChange={e => updateDefault('countdown', Number(e.target.value))}
                />
              </div>
            </div>
          </StorySettingsField>

          {/* Hidden toggle — only visible when the global "Show Hidden Stories" is on */}
          {showHidden && (
            <StorySettingsField label="Visibility">
              <div
                className="flex justify-between items-center"
                style={{ padding: '14px 16px', background: 'var(--s2)', borderRadius: '10px', border: '1px solid var(--s3)' }}
              >
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)' }}>
                    Hidden Story
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--sub)', marginTop: 2 }}>
                    Hidden stories only appear while "Show Hidden Stories" is enabled.
                  </div>
                </div>
                <span
                  onClick={() => updateStoryField('hidden', !story.hidden)}
                  style={{
                    width: '44px', height: '24px', borderRadius: '9999px',
                    background: story.hidden ? '#c9a96e' : '#2a2a3e',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '2px', left: story.hidden ? '22px' : '2px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }} />
                </span>
              </div>
            </StorySettingsField>
          )}
        </div>
      </div>
    </div>
  )
}

function StorySettingsField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label className="block text-[13px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--sub)' }}>
        {label}
      </label>
      {hint && (
        <div className="text-[13px] mb-2" style={{ color: 'var(--sub)', lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  )
}

// (ImageInputWithGenerate moved to ./ImageInputWithGenerate.jsx so EditPanel can share it.)
