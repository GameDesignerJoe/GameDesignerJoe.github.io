import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { saveImageBlob } from '../../engine/ImageStore'
import { generateImages, ASPECT_RATIOS, DEFAULT_ASPECT_FOR_SLOT } from '../../engine/ImageGen'
import { getProjectFolder, ensurePermission, findFreeFilename } from '../../engine/ProjectFolderStore'

const API_KEY_LS = 'google_ai_api_key'

// Match the helpers in Creator.jsx — kept in sync manually.
function slugify(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
// Base filename (no extension / version suffix) for a slot. findFreeFilename
// adds "-02", "-03", etc. when a match is already on disk.
function imageBaseNameForSlot(story, slot) {
  const storyPart = slugify(story?.title) || slugify(story?.id) || 'story'
  if (slot === 'cover') return `${storyPart}-cover`
  if (slot === 'default-bg') return `${storyPart}-default-bg`
  if (slot.startsWith('scene/')) return `${storyPart}-scene-${slot.slice(6)}`
  if (slot.startsWith('portrait/')) return `${storyPart}-portrait-${slot.slice(9)}`
  return `${storyPart}-${slot}`
}

/**
 * ImageStudioModal — prompt-to-image generation for a specific story slot.
 *
 * Props:
 *   target: { slot: 'cover' | 'default-bg' | 'scene/{id}' | 'portrait/{emotion}', storyId }
 *   onClose: () => void
 */
export default function ImageStudioModal({ target, onClose }) {
  const updateStoryField = useStore(s => s.updateStoryField)
  const updateScene = useStore(s => s.updateScene)
  const story = useStore(s => s.creator.story)

  // Apply an image (URL or path) to whichever slot the modal is targeting.
  const applyToSlot = (slot, value) => {
    if (slot === 'cover') {
      updateStoryField('coverImage', value)
      updateStoryField('coverImageGeneratedAt', Date.now())
    } else if (slot === 'default-bg') {
      updateStoryField('defaultBgImage', value)
      updateStoryField('defaultBgImageGeneratedAt', Date.now())
    } else if (slot.startsWith('scene/')) {
      const sceneId = slot.slice(6)
      updateScene(sceneId, 'bgImage', value)
      updateScene(sceneId, 'bgImageGeneratedAt', Date.now())
    }
    // portrait/{emotion} would go here in a future phase
  }

  const slotRoot = target?.slot?.split('/')[0] || 'cover'
  const defaultAspect = DEFAULT_ASPECT_FOR_SLOT[slotRoot] || '1:1'

  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem(API_KEY_LS) || '' } catch { return '' }
  })
  const [showKey, setShowKey] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [stylePrefix, setStylePrefix] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sampleCount, setSampleCount] = useState(2)
  const [aspectRatio, setAspectRatio] = useState(defaultAspect)

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState([])   // [{ url, blob }]
  const [error, setError] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [preview, setPreview] = useState(null)  // { url, blob } | null — currently enlarged image

  // Track previously-created blob URLs so we can revoke them on regenerate / unmount
  const blobUrlsRef = useRef([])
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  const persistApiKey = (k) => {
    setApiKey(k)
    try { localStorage.setItem(API_KEY_LS, k) } catch {}
  }

  const handleGenerate = async () => {
    setError(null)
    if (!apiKey.trim()) { setError('Enter your Google AI Studio API key above.'); return }
    if (!prompt.trim()) { setError('Enter a prompt.'); return }

    setGenerating(true)
    try {
      const full = (stylePrefix.trim() ? stylePrefix.trim() + ', ' : '') + prompt.trim()
      const blobs = await generateImages(apiKey.trim(), {
        prompt: full,
        sampleCount,
        aspectRatio,
      })

      // Revoke old preview URLs
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      blobUrlsRef.current = []

      const next = blobs.map(b => {
        const url = URL.createObjectURL(b)
        blobUrlsRef.current.push(url)
        return { url, blob: b }
      })
      setResults(next)
    } catch (e) {
      setError(e.message || 'Generation failed.')
      setResults([])
    } finally {
      setGenerating(false)
    }
  }

  // Let the user pick a local file (e.g., one they dropped into the project folder
  // manually or generated elsewhere). Treated the same as an AI-generated blob.
  const handleLocalFile = async (e) => {
    setError(null)
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be re-picked
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    // Revoke any previous preview URLs and show the single selected file as the only result
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    blobUrlsRef.current = []
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setResults([{ url, blob: file }])
    // Auto-open the lightbox so the user can confirm immediately
    setPreview({ url, blob: file })
  }

  const handleUseImage = async ({ blob, url }) => {
    if (!target?.storyId || !target?.slot) return
    setAssigning(true)
    try {
      // 1. Always persist to IndexedDB so the image survives page refresh
      await saveImageBlob(target.storyId, target.slot, blob)

      // 2. Update the story object so the editor / library / detail render it
      const persistentUrl = URL.createObjectURL(blob)
      applyToSlot(target.slot, persistentUrl)

      // 3. If a project folder is set, write the PNG to disk automatically with
      //    a versioned filename (never overwriting earlier images — the user
      //    keeps a history on disk). On success, switch the in-memory field
      //    to the saved path so the JSON stays consistent and the file is the
      //    source of truth going forward.
      try {
        const handle = await getProjectFolder(target.storyId)
        if (!handle) {
          console.log('[Murmur] Auto-save skipped — no project folder set for this story. Save to Project will write the image instead.')
        } else if (!story) {
          console.log('[Murmur] Auto-save skipped — no story in memory.')
        } else {
          const ok = await ensurePermission(handle)
          if (!ok) {
            console.warn('[Murmur] Auto-save skipped — folder permission denied.')
          } else {
            const imagesDir = await handle.getDirectoryHandle('images', { create: true })
            const baseName = imageBaseNameForSlot(story, target.slot)
            const filename = await findFreeFilename(imagesDir, baseName, 'png')
            const fh = await imagesDir.getFileHandle(filename, { create: true })
            const w = await fh.createWritable()
            await w.write(blob)
            await w.close()
            console.log(`%c[Murmur] Image auto-saved to disk: ${handle.name}/images/${filename} (${(blob.size / 1024).toFixed(0)} KB)`, 'color: #4ade80')
            // Switch to path so next session uses the file directly (and subsequent
            // saves don't produce duplicate copies of the same image).
            applyToSlot(target.slot, `${target.storyId}/images/${filename}`)
          }
        }
      } catch (diskErr) {
        console.warn('[Murmur] Auto-save to disk failed (will be written on next Save):', diskErr?.message || diskErr)
      }

      onClose()
    } catch (e) {
      setError(`Failed to save image: ${e.message}`)
    } finally {
      setAssigning(false)
    }
  }

  const slotLabel = labelForSlot(target?.slot)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] overflow-y-auto hide-scrollbar"
        style={{ background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: '24px', padding: '32px 36px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '24px', color: 'var(--text)', fontWeight: 400, margin: 0 }}>
              Image Studio
            </h2>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--sub)', marginTop: '4px' }}>
              Generating: <span style={{ color: 'var(--gold)' }}>{slotLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* Use a local image — any PNG/JPG the user already has, e.g. one they
            dropped into the project folder manually. */}
        <Section label="Use a Local Image">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px',
                border: '1px dashed var(--s3)', background: 'transparent',
                color: 'var(--sub)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--s3)'; e.currentTarget.style.color = 'var(--sub)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
              Choose image from your computer…
              <input
                type="file"
                accept="image/*"
                onChange={handleLocalFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '6px' }}>
            Already have the image you want? Pick it here instead of generating.
          </div>
        </Section>

        <div style={{ margin: '8px 0 20px', textAlign: 'center', color: 'var(--sub)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
          — or generate with AI —
        </div>

        {/* API Key */}
        <Section label="Google AI Studio API Key">
          <div style={{ position: 'relative' }}>
            <input
              className="cr-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => persistApiKey(e.target.value)}
              placeholder="Paste your API key…"
              style={{ paddingRight: '40px' }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showKey ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '6px' }}>
            Stored in localStorage only — never sent to the repo. Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>aistudio.google.com/apikey</a>.
          </div>
        </Section>

        {/* Prompt */}
        <Section label="Prompt">
          <textarea
            className="cr-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image you want…"
            style={{ minHeight: '100px', resize: 'vertical', fontFamily: "'Public Sans', sans-serif", fontSize: '14px', lineHeight: 1.5, padding: '12px' }}
          />
        </Section>

        {/* Variations + aspect */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <Section label="Variations" style={{ flex: 1, marginBottom: 0 }}>
            <select
              className="cr-input"
              value={sampleCount}
              onChange={e => setSampleCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'image' : 'images'} (~${(n * 0.04).toFixed(2)})</option>
              ))}
            </select>
          </Section>
          <Section label="Aspect Ratio" style={{ flex: 1, marginBottom: 0 }}>
            <select
              className="cr-input"
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
            >
              {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Section>
        </div>

        {/* Advanced (style prefix) */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--sub)', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', transition: 'transform 0.2s', transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
            Advanced
          </button>
          {showAdvanced && (
            <div style={{ marginTop: '12px' }}>
              <Section label="Style Prefix (optional)">
                <input
                  className="cr-input"
                  value={stylePrefix}
                  onChange={e => setStylePrefix(e.target.value)}
                  placeholder="e.g. cinematic, atmospheric, dark fantasy illustration"
                />
                <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '6px' }}>
                  Prepended to every prompt for consistent style. Leave blank for no prefix.
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !apiKey.trim() || !prompt.trim()}
          style={{
            width: '100%', padding: '14px', borderRadius: '16px', border: 'none',
            background: (generating || !apiKey.trim() || !prompt.trim()) ? 'var(--s3)' : '#c9a96e',
            color: (generating || !apiKey.trim() || !prompt.trim()) ? 'var(--sub)' : '#412d00',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: (generating || !apiKey.trim() || !prompt.trim()) ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {generating ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>autorenew</span>
              Generating…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>
              Generate
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: '16px', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)',
            color: '#ff9b9b', fontSize: '13px', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <label style={{ color: 'var(--sub)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: '12px', display: 'block' }}>
              Click a result to preview it full-size
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {results.map((r, i) => (
                <button
                  key={i}
                  disabled={assigning}
                  onClick={() => setPreview(r)}
                  style={{
                    padding: 0, border: '1px solid var(--s3)', borderRadius: '12px',
                    background: 'var(--s2)', cursor: assigning ? 'wait' : 'zoom-in',
                    overflow: 'hidden', transition: 'border-color 0.2s, transform 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!assigning) e.currentTarget.style.borderColor = 'var(--gold)' }}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--s3)'}
                >
                  <img src={r.url} alt={`variation ${i + 1}`} style={{ width: '100%', display: 'block', aspectRatio: aspectRatio.replace(':', ' / ') }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Full-size preview lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px',
          }}
        >
          <img
            src={preview.url}
            alt="preview"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%', maxHeight: 'calc(100vh - 160px)',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', gap: '12px', marginTop: '24px' }}
          >
            <button
              onClick={() => setPreview(null)}
              style={{
                padding: '12px 24px', borderRadius: '12px',
                background: 'transparent', border: '1px solid var(--s3)',
                color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--sub)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--s3)'}
            >
              Cancel
            </button>
            <button
              disabled={assigning}
              onClick={() => { handleUseImage(preview); setPreview(null) }}
              style={{
                padding: '12px 28px', borderRadius: '12px',
                background: '#c9a96e', color: '#412d00', border: 'none',
                fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: assigning ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
              Use This Image
            </button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: "'DM Sans', sans-serif", marginTop: '16px' }}>
            Click outside to close
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, children, style }) {
  return (
    <div style={{ marginBottom: '20px', ...style }}>
      <label style={{ color: 'var(--sub)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function labelForSlot(slot) {
  if (!slot) return ''
  if (slot === 'cover') return 'Cover Image'
  if (slot === 'default-bg') return 'Default Background'
  if (slot.startsWith('scene/')) return `Scene Background (${slot.slice(6)})`
  if (slot.startsWith('portrait/')) return `Narrator Portrait (${slot.slice(9)})`
  return slot
}
