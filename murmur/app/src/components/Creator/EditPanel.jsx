import { useState, useEffect, useRef } from 'react'
import { useStore, END_STORY } from '../../store'
import ImageInputWithGenerate from './ImageInputWithGenerate'
import { listAudioFiles } from '../../engine/ProjectFolderStore'
import { resolveAssetPath } from '../../engine/assetPath'

const EMOTIONS = ['default', 'curious', 'happy', 'sad', 'afraid', 'determined', 'unsettled', 'dissociated', 'hollow', 'controlled']

// Match the helpers in Creator.jsx — kept in sync for the targetPath display.
function slugify(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function sceneBgFilename(story, sceneId) {
  const storyPart = slugify(story?.title) || slugify(story?.id) || 'story'
  return `${storyPart}-scene-${sceneId}.png`
}

/** Extract a readable filename from a clip source (blob URL or path) */
function clipDisplayName(src, sceneId) {
  if (src.startsWith('blob:')) return `${sceneId}-a.mp3`
  const parts = src.split('/')
  return parts[parts.length - 1]
}

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ClipRow({ src, sceneId, onRemove }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [dragging, setDragging] = useState(false)
  const audioRef = useRef(null)
  const trackRef = useRef(null)

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = resolveAssetPath(src)
    audioRef.current = audio

    const onMeta = () => setDuration(audio.duration)
    const onTime = () => setCurrentTime(audio.currentTime)
    const onEnd = () => { setPlaying(false); setCurrentTime(0) }

    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audio.pause()
      audio.src = ''
    }
  }, [src])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().catch(() => {}); setPlaying(true) }
  }

  const seekToClientX = (clientX) => {
    const el = trackRef.current
    const audio = audioRef.current
    if (!el || !audio || !duration) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const t = pct * duration
    audio.currentTime = t
    setCurrentTime(t)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => seekToClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, duration])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const name = clipDisplayName(src, sceneId)

  return (
    <div className="rounded-[10px] px-3 py-[10px]" style={{ background: 'var(--s2)' }}>
      <div className="flex items-center gap-3">
        {/* Play / Pause button */}
        <button
          onClick={toggle}
          className="flex-shrink-0 flex items-center justify-center cursor-pointer"
          style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: 'none', color: 'var(--gold)', padding: 0,
          }}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5v11l10-5.5z" />
            </svg>
          )}
        </button>

        {/* Filename */}
        <span className="flex-1 text-[14px] truncate" style={{ color: 'var(--text)' }}>{name}</span>

        {/* Duration */}
        <span className="text-[13px] flex-shrink-0 tabular-nums" style={{ color: 'var(--sub)' }}>
          {formatTime(duration)}
        </span>

        {/* Remove */}
        <span
          className="cursor-pointer text-[16px] transition-colors hover:text-red-400 flex-shrink-0"
          style={{ color: 'var(--sub)' }}
          onClick={onRemove}
        >×</span>
      </div>

      {/* Progress bar — click or drag to seek */}
      <div
        ref={trackRef}
        onMouseDown={e => { setDragging(true); seekToClientX(e.clientX) }}
        className="mt-2 py-[6px] cursor-pointer"
      >
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--s3)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'var(--gold)',
              transition: dragging ? 'none' : 'width 0.15s linear',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function EditPanel({ onOpenImageStudio }) {
  const creator = useStore(s => s.creator)
  const updateScene = useStore(s => s.updateScene)
  const setStartScene = useStore(s => s.setStartScene)
  const deleteScene = useStore(s => s.deleteScene)
  const selectNode = useStore(s => s.selectNode)
  const launchStory = useStore(s => s.launchStory)

  const { story, selectedNodeId } = creator
  const storyId = story?.id

  // Audio files discovered in the project folder's audio/ subdirectory.
  // null = no folder linked / no permission (fall back to text input).
  const [audioFiles, setAudioFiles] = useState(null)
  useEffect(() => {
    if (!storyId) return
    let cancelled = false
    listAudioFiles(storyId).then(files => {
      if (!cancelled) setAudioFiles(files)
    })
    return () => { cancelled = true }
  }, [storyId])

  if (!story || !selectedNodeId) return null
  const scene = story.scenes[selectedNodeId]
  if (!scene) return null

  // Natural sort by title (fallback to id) so "Scene 2" < "Scene 10" in dropdowns.
  const allSceneIds = Object.keys(story.scenes).sort((a, b) => {
    const la = story.scenes[a]?.title || a
    const lb = story.scenes[b]?.title || b
    return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' })
  })
  const otherScenes = allSceneIds.filter(k => k !== selectedNodeId)

  const handleClipAdd = (e) => {
    if (e.key !== 'Enter') return
    const val = e.target.value.trim()
    if (!val) return
    updateScene(selectedNodeId, 'clips', [...scene.clips, val])
    e.target.value = ''
  }

  const handleClipPick = (filename) => {
    if (!filename) return
    updateScene(selectedNodeId, 'clips', [...scene.clips, `${story.id}/audio/${filename}`])
  }

  const removeClip = (i) => {
    const clips = [...scene.clips]
    clips.splice(i, 1)
    updateScene(selectedNodeId, 'clips', clips)
  }

  const updateChoice = (i, key, value) => {
    const choices = JSON.parse(JSON.stringify(scene.choices))
    choices[i][key] = value
    updateScene(selectedNodeId, 'choices', choices)
  }

  const addChoice = () => {
    const choices = [...scene.choices, { text: 'Choose…', target: otherScenes[0] || selectedNodeId }]
    updateScene(selectedNodeId, 'choices', choices)
  }

  const removeChoice = (i) => {
    const choices = [...scene.choices]
    choices.splice(i, 1)
    updateScene(selectedNodeId, 'choices', choices)
  }

  return (
    <div className="flex flex-col overflow-hidden w-full h-full">
      {/* Header */}
      <div
        className="flex justify-between items-center flex-shrink-0"
        style={{ padding: '16px 20px', borderBottom: '1px solid var(--s2)', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sub)' }}
      >
        <span>Edit Scene</span>
        <span className="cursor-pointer text-xl hover:text-[var(--text)] transition-colors" onClick={() => selectNode(null)}>×</span>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--s3) transparent' }}>
        {/* Title */}
        <Field label="Scene Title">
          <input className="cr-input" value={scene.title} onChange={e => updateScene(selectedNodeId, 'title', e.target.value)} />
        </Field>

        {/* Narration script (collapsible) */}
        <ScriptField scene={scene} onChange={val => updateScene(selectedNodeId, 'script', val)} />

        {/* Emotion */}
        <Field label="Emotion / Portrait State">
          <select className="cr-input" value={scene.emotion} onChange={e => updateScene(selectedNodeId, 'emotion', e.target.value)}>
            {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
        </Field>

        {/* Background */}
        <Field label="Background">
          <div className="text-[13px] mb-2" style={{ color: 'var(--sub)', lineHeight: 1.5 }}>
            Per-scene image (overrides the story's Default Scene Background). Click ✨ to generate with AI. GIFs loop automatically.
          </div>
          <div className="mb-3">
            <ImageInputWithGenerate
              value={scene.bgImage || ''}
              placeholder="https://… or path/to/scene.gif"
              onChange={url => updateScene(selectedNodeId, 'bgImage', url || null)}
              onGenerate={onOpenImageStudio ? () => onOpenImageStudio(`scene/${selectedNodeId}`) : null}
              aspectRatio="16/9"
              targetPath={`${story.id}/images/${sceneBgFilename(story, selectedNodeId)}`}
            />
          </div>
          <div className="text-[13px] mb-2" style={{ color: 'var(--sub)' }}>Gradient fallback slot</div>
          <select className="cr-input" value={scene.bgKey} onChange={e => updateScene(selectedNodeId, 'bgKey', e.target.value)}>
            {Object.keys(story.bgs || {}).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>

        {/* Timing */}
        <Field label="Choice Timing">
          <div className="text-[13px] mb-2" style={{ color: 'var(--sub)', lineHeight: 1.5 }}>
            Reveal choices N seconds before clip ends. Countdown: time to pick before default fires.
          </div>
          <div className="flex gap-3 mb-2">
            <div className="flex-1">
              <div className="text-[13px] mb-1" style={{ color: 'var(--sub)' }}>Reveal (s before end)</div>
              <input
                className="cr-input"
                type="number"
                min="0"
                value={scene.secondsBeforeEnd || 0}
                onChange={e => updateScene(selectedNodeId, 'secondsBeforeEnd', Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <div className="text-[13px] mb-1" style={{ color: 'var(--sub)' }}>Player countdown (s)</div>
              <input
                className="cr-input"
                type="number"
                min="0"
                value={scene.countdown || 5}
                onChange={e => updateScene(selectedNodeId, 'countdown', Number(e.target.value))}
              />
            </div>
          </div>
        </Field>

        {/* Audio clips */}
        <Field label={<>Audio Clips <span className="text-[13px] normal-case tracking-normal" style={{ color: 'var(--sub)' }}>(smart shuffle)</span></>}>
          <div className="flex flex-col gap-2 mt-2">
            {scene.clips.map((c, i) => (
              <ClipRow key={`${selectedNodeId}-${i}`} src={c} sceneId={selectedNodeId} onRemove={() => removeClip(i)} />
            ))}
          </div>
          {audioFiles && audioFiles.length > 0 ? (
            <select
              className="cr-input mt-2"
              value=""
              onChange={e => handleClipPick(e.target.value)}
            >
              <option value="">+ Add audio clip from {storyId}/audio/…</option>
              {audioFiles.map(fn => <option key={fn} value={fn}>{fn}</option>)}
            </select>
          ) : (
            <input className="cr-input mt-2" placeholder="path/to/clip.mp3" onKeyDown={handleClipAdd} />
          )}
        </Field>

        {/* Choices */}
        <Field label="Choices">
          <div className="text-[13px] mb-2" style={{ color: 'var(--sub)' }}>★ = default (auto-fires when countdown ends)</div>
          <div className="flex flex-col gap-3 mt-2">
            {scene.choices.map((ch, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{
                  background: 'var(--s2)',
                  border: `1px solid ${i === scene.defaultChoice ? 'rgba(201,169,110,0.3)' : 'transparent'}`,
                }}
              >
                <input
                  className="cr-choice-input"
                  placeholder="Choice text…"
                  value={ch.text}
                  onChange={e => updateChoice(i, 'text', e.target.value)}
                />
                <select
                  className="cr-choice-input"
                  value={ch.target}
                  onChange={e => updateChoice(i, 'target', e.target.value)}
                >
                  <option value={END_STORY}>⏹ End Story (Return to Library)</option>
                  {allSceneIds.map(oid => (
                    <option key={oid} value={oid}>
                      {oid === selectedNodeId ? '↻ ' : ''}{story.scenes[oid]?.title || oid}{oid === selectedNodeId ? ' (loop)' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between mt-1">
                  <label className="text-[13px] tracking-[0.04em] cursor-pointer flex items-center gap-2" style={{ color: 'var(--gold)' }}>
                    <input
                      type="radio"
                      name={`def-${selectedNodeId}`}
                      checked={i === scene.defaultChoice}
                      onChange={() => updateScene(selectedNodeId, 'defaultChoice', i)}
                      style={{ accentColor: 'var(--gold)', width: 16, height: 16 }}
                    />
                    Default
                  </label>
                  <span className="text-[13px] cursor-pointer transition-colors hover:text-red-400" style={{ color: 'var(--sub)' }} onClick={() => removeChoice(i)}>
                    Remove
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            className="w-full mt-3 text-[13px] tracking-[0.06em] uppercase px-4 py-[10px] rounded-full cursor-pointer transition-all hover:text-[var(--text)] hover:border-[var(--sub)]"
            style={{ color: 'var(--text)', background: 'var(--s2)', border: '1px solid var(--s3)' }}
            onClick={addChoice}
          >
            + Add Choice
          </button>
        </Field>

        {/* Actions */}
        <div className="flex flex-col gap-3" style={{ padding: '16px 20px' }}>
          <button
            className="w-full p-3 rounded-xl text-center text-[14px] cursor-pointer transition-all hover:border-[var(--sub)] hover:text-[var(--text)]"
            style={{ color: 'var(--gold)', background: 'var(--s2)', border: '1px solid rgba(201,169,110,0.25)' }}
            onClick={() => launchStory(story, selectedNodeId)}
          >
            ▶ Play from Here
          </button>
          <button
            className="w-full p-3 rounded-xl text-center text-[14px] cursor-pointer transition-all hover:border-[var(--sub)] hover:text-[var(--text)]"
            style={{
              color: story.startScene === selectedNodeId ? 'rgba(100,200,120,0.9)' : 'var(--text)',
              background: 'var(--s2)',
              border: `1px solid ${story.startScene === selectedNodeId ? 'rgba(100,200,120,0.25)' : 'var(--s3)'}`,
            }}
            onClick={() => setStartScene(selectedNodeId)}
          >
            {story.startScene === selectedNodeId ? '★ First Scene' : 'Set as First Scene'}
          </button>
          <button
            className="w-full p-3 rounded-xl text-center text-[14px] cursor-pointer transition-all hover:border-[var(--sub)] hover:text-[var(--text)]"
            style={{ color: '#ff6b6b', background: 'var(--s2)', border: '1px solid rgba(255,107,107,0.2)' }}
            onClick={() => { if (confirm('Delete this scene?')) deleteScene(selectedNodeId) }}
          >
            Delete Scene
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--s2)' }}>
      <label className="block text-[13px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--sub)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ScriptField({ scene, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const script = scene.script || ''
  const charCount = script.length
  const preview = script.trim().slice(0, 60) + (script.length > 60 ? '…' : '')

  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--s2)' }}>
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        style={{ marginBottom: expanded ? '12px' : 0 }}
      >
        <label className="block text-[13px] tracking-[0.1em] uppercase" style={{ color: 'var(--sub)', cursor: 'pointer' }}>
          Narration Script {charCount > 0 && <span className="normal-case tracking-normal" style={{ color: 'var(--sub)' }}>({charCount} chars)</span>}
        </label>
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--sub)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </div>

      {!expanded && script && (
        <div className="text-[13px]" style={{ color: 'var(--sub)', fontStyle: 'italic', lineHeight: 1.5 }}>
          "{preview}"
        </div>
      )}

      {expanded && (
        <>
          <div className="text-[13px] mb-2" style={{ color: 'var(--sub)', lineHeight: 1.5 }}>
            Full narration text (e.g. imported from CSV). Editable — regenerate audio if you change it.
          </div>
          <textarea
            className="cr-input"
            value={script}
            placeholder="Enter narration text…"
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: '160px',
              maxHeight: '400px',
              resize: 'vertical',
              fontFamily: "'Public Sans', sans-serif",
              fontSize: '14px',
              lineHeight: 1.6,
              padding: '12px',
            }}
          />
        </>
      )}
    </div>
  )
}
