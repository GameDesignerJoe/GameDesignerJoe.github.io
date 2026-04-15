import { useState } from 'react'
import { useStore } from '../../store'

export default function Nav() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const setCreatorStory = useStore(s => s.setCreatorStory)
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
    // Read current state at click time to avoid stale closures
    const { activeStoryIndex, stories } = useStore.getState()
    const idx = Math.max(0, Math.min(activeStoryIndex, stories.length - 1))
    const storyToEdit = stories[idx]
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
          id: 'start', title: 'Opening Scene', emotion: 'curious',
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
        <NavItem icon="edit_note" label="Edit" onClick={handleEdit} />
        <NavItem icon="add_circle" label="Create" onClick={handleCreate} />
        <NavItem icon="settings" label="Settings" onClick={() => setShowSettings(true)} />
      </nav>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

function SettingsPanel({ onClose }) {
  const stories = useStore(s => s.stories)
  const deleteStory = useStore(s => s.deleteStory)
  const activeIndex = useStore(s => s.activeStoryIndex)

  const handleDelete = (storyId, title) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    deleteStory(storyId)
    onClose()
  }

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
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#928faa', fontWeight: 600 }}>
            Settings
          </span>
          <span className="material-symbols-outlined cursor-pointer" style={{ fontSize: '20px', color: '#928faa' }} onClick={onClose}>close</span>
        </div>

        {/* Stories list with delete */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#928faa', marginBottom: '12px' }}>
            Your Stories
          </div>
          {stories.map(st => (
            <div
              key={st.id}
              className="flex justify-between items-center"
              style={{ padding: '12px 0', borderBottom: '1px solid rgba(34,34,54,0.5)' }}
            >
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#e5e3ff' }}>{st.title}</span>
              <span
                className="material-symbols-outlined cursor-pointer"
                style={{ fontSize: '18px', color: '#928faa', transition: 'color 0.2s' }}
                onClick={() => handleDelete(st.id, st.title)}
                onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                onMouseLeave={e => e.currentTarget.style.color = '#928faa'}
              >
                delete
              </span>
            </div>
          ))}
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
