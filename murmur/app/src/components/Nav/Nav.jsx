import { useState } from 'react'
import { useStore } from '../../store'

export default function Nav() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const creatorMode = useStore(s => s.creatorMode)
  const [showSettings, setShowSettings] = useState(false)

  if (view === 'player' || view === 'creator') return null

  // Detail view: back link only, no bottom nav
  if (view === 'detail') {
    return (
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 50,
        display: 'flex', alignItems: 'center', padding: '0 16px', height: '64px',
        background: 'transparent',
      }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
            padding: '8px', borderRadius: '8px', transition: 'background 0.3s',
          }}
          onClick={() => setView('library')}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="material-symbols-outlined" style={{ color: '#c9a96e' }}>arrow_back</span>
          <span style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '18px', color: '#c9a96e', letterSpacing: '-0.01em' }}>Murmur</span>
        </div>
      </header>
    )
  }

  const handleEdit = () => {
    // Read current state at click time to avoid stale closures.
    // Library filters hidden stories and sorts by updatedAt — mirror that here so
    // the active index points to the same story the user is currently viewing.
    const { activeStoryIndex, stories, showHiddenStories } = useStore.getState()
    const visible = stories
      .filter(s => showHiddenStories || !s.hidden)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const idx = Math.max(0, Math.min(activeStoryIndex, visible.length - 1))
    const storyToEdit = visible[idx]
    if (storyToEdit) setCreatorStory(storyToEdit)
    setView('creator')
  }

  const handleCreate = () => {
    // Create a brand new empty story and open it in the editor
    const id = 'story-' + Date.now()
    const newStory = {
      id,
      title: 'Untitled Story',
      tagline: '',
      description: '',
      tags: [],
      bg: 'linear-gradient(160deg, #0a0a1a 0%, #1a1828 100%)',
      bgs: {
        a: 'linear-gradient(160deg, #0a0a1a, #1a1828)',
        b: 'linear-gradient(160deg, #080818, #141420)',
        c: 'linear-gradient(160deg, #0d0510, #1a0818)',
        d: 'linear-gradient(160deg, #050508, #0a0a10)',
      },
      narrator: { name: 'Narrator', emoji: '🎭' },
      duration: '~0 min',
      paths: 1,
      startScene: 'start',
      scenes: {
        start: {
          id: 'start', title: 'Opening Scene', emotion: 'default',
          bgKey: 'a', bgImage: null, script: '', scriptUpdatedAt: null, audioGeneratedAt: null,
          clips: [], secondsBeforeEnd: 5, defaultChoice: null, countdown: 0, choices: [],
        },
      },
    }
    setCreatorStory(newStory)
    setView('creator')
  }

  // Library view
  return (
    <>
      {/* Top: just the wordmark */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        display: 'flex', alignItems: 'center', padding: '16px 28px',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        background: 'rgba(0,0,0,0.1)',
      }}>
        <div
          style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '24px', color: '#c9a96e', letterSpacing: '0.05em', cursor: 'pointer' }}
          onClick={() => setView('library')}
        >
          Murmur
        </div>
      </header>

      {/* Gradient fade behind bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, width: '100%', height: '120px', zIndex: 49,
        background: 'linear-gradient(to top, #07070f 40%, transparent)',
        pointerEvents: 'none',
      }} />

      {/* Bottom nav — Library, Edit, Create, Settings */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        maxWidth: '420px', width: '100%', zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0 28px',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <NavItem icon="explore" label="Library" active onClick={() => setView('library')} />
        {creatorMode && <NavItem icon="edit_note" label="Edit" onClick={handleEdit} />}
        {creatorMode && <NavItem icon="add_circle" label="Create" onClick={handleCreate} />}
        <NavItem icon="settings" label="Settings" onClick={() => setShowSettings(true)} />
      </nav>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

function SettingsPanel({ onClose }) {
  const stories = useStore(s => s.stories)
  const deleteStory = useStore(s => s.deleteStory)
  const showHidden = useStore(s => s.showHiddenStories)
  const setShowHidden = useStore(s => s.setShowHiddenStories)
  const creatorMode = useStore(s => s.creatorMode)
  const setCreatorMode = useStore(s => s.setCreatorMode)
  const [tab, setTab] = useState('main') // 'main' | 'hidden'

  const handleDelete = (storyId, title) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    deleteStory(storyId)
    onClose()
  }

  // Filter stories for the main tab — hidden stories only appear if the toggle is on
  const visibleStories = showHidden ? stories : stories.filter(s => !s.hidden)

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-[440px] rounded-t-2xl"
        style={{ background: '#12121f', border: '1px solid #222236', borderBottom: 'none', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center flex-shrink-0" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #222236' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.15em',
                textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
                color: tab === 'main' ? '#c9a96e' : '#928faa',
              }}
              onClick={() => setTab('main')}
            >
              Settings
            </span>
            {/* Invisible hidden-tab button — right of "Settings" */}
            <span
              onClick={() => setTab('hidden')}
              style={{
                display: 'inline-block', width: '32px', height: '20px',
                cursor: 'pointer', background: 'transparent', border: 'none',
              }}
              aria-label=""
            />
            {/* Show the hidden tab label only after it's been activated */}
            {tab === 'hidden' && (
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.15em',
                  textTransform: 'uppercase', fontWeight: 600, color: '#c9a96e',
                }}
              >
                Hidden
              </span>
            )}
          </div>
          <span className="material-symbols-outlined cursor-pointer" style={{ fontSize: '20px', color: '#928faa' }} onClick={onClose}>close</span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto' }}>
          {tab === 'main' ? (
            <>
              {creatorMode && (
                <>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#928faa', marginBottom: '12px' }}>
                    API Keys
                  </div>
                  <ApiKeyRow label="Google AI Studio" storageKey="google_ai_api_key" placeholder="For Imagen image generation…" hint={<>Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#c9a96e' }}>aistudio.google.com/apikey</a></>} />
                  <ApiKeyRow label="ElevenLabs" storageKey="elevenlabs_api_key" placeholder="For TTS narration…" hint="Used by the TTS modal in the editor." />
                </>
              )}

              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#928faa', marginTop: creatorMode ? '28px' : '0', marginBottom: '12px' }}>
                Your Stories
              </div>
              {visibleStories.map(st => (
                <div
                  key={st.id}
                  className="flex justify-between items-center"
                  style={{ padding: '12px 0', borderBottom: '1px solid rgba(34,34,54,0.5)' }}
                >
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#e5e3ff' }}>{st.title}</span>
                  {creatorMode && (
                    <span
                      className="material-symbols-outlined cursor-pointer"
                      title="Delete"
                      style={{ fontSize: '18px', color: '#928faa', transition: 'color 0.2s' }}
                      onClick={() => handleDelete(st.id, st.title)}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                      onMouseLeave={e => e.currentTarget.style.color = '#928faa'}
                    >
                      delete
                    </span>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Creator Mode toggle */}
              <ToggleRow
                label="Enable Creator Mode"
                hint="Unlocks the editor, TTS, AI image generation, and project save."
                value={creatorMode}
                onChange={() => setCreatorMode(!creatorMode)}
              />

              {/* Show Hidden Stories toggle */}
              <ToggleRow
                label="Show Hidden Stories"
                value={showHidden}
                onChange={() => setShowHidden(!showHidden)}
                style={{ marginTop: '14px' }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'transform 0.2s',
        color: active ? '#c9a96e' : 'rgba(255,255,255,0.4)',
        transform: active ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '24px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: '10px', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginTop: '4px',
      }}>
        {label}
      </span>
    </div>
  )
}

function ApiKeyRow({ label, storageKey, placeholder, hint }) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(storageKey) || '' } catch { return '' }
  })
  const [revealed, setRevealed] = useState(false)

  const onChange = (v) => {
    setValue(v)
    try {
      if (v) localStorage.setItem(storageKey, v)
      else localStorage.removeItem(storageKey)
    } catch {}
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#e5e3ff', marginBottom: '6px' }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 36px 10px 12px',
            background: '#0f0f1c', border: '1px solid #222236', borderRadius: '8px',
            color: '#e5e3ff', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => setRevealed(r => !r)}
          title={revealed ? 'Hide' : 'Show'}
          style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#928faa',
            display: 'flex', alignItems: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{revealed ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      {hint && (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#706c8a', marginTop: '4px' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, hint, value, onChange, style }) {
  return (
    <div
      className="flex justify-between items-center"
      style={{ padding: '14px 16px', background: '#1a1a28', borderRadius: '10px', border: '1px solid #222236', ...style }}
    >
      <div>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#e5e3ff' }}>{label}</span>
        {hint && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#706c8a', marginTop: '4px' }}>{hint}</div>}
      </div>
      <span
        onClick={onChange}
        style={{
          width: '44px', height: '24px', borderRadius: '9999px', flexShrink: 0,
          background: value ? '#c9a96e' : '#2a2a3e',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px', left: value ? '22px' : '2px',
          width: '20px', height: '20px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </span>
    </div>
  )
}
