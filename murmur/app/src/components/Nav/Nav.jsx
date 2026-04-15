import { useStore } from '../../store'

export default function Nav() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const setCreatorStory = useStore(s => s.setCreatorStory)

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
          bgKey: 'a', bgImage: null, clips: [],
          secondsBeforeEnd: 5, defaultChoice: null, countdown: 0, choices: [],
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
        <NavItem icon="settings" label="Settings" onClick={() => {}} />
      </nav>
    </>
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
