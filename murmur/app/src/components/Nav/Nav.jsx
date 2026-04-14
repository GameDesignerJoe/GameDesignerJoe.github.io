import { useStore } from '../../store'

export default function Nav() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const creator = useStore(s => s.creator)
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const stories = useStore(s => s.stories)

  if (view === 'player' || view === 'creator') return null

  const isCreator = view === 'creator'
  const isDetail = view === 'detail'

  const toggleCreator = () => {
    if (isCreator) {
      setView('library')
    } else {
      if (!creator.story && stories.length > 0) {
        setCreatorStory(stories[0])
      }
      setView('creator')
    }
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-80 flex items-center justify-between pointer-events-none"
      style={{ padding: 'max(20px, env(safe-area-inset-top)) 24px 0' }}
    >
      <div
        className="pointer-events-auto font-display italic font-light text-2xl tracking-wider cursor-pointer flex items-center gap-1"
        style={{ color: 'var(--text)' }}
        onClick={() => setView('library')}
      >
        {isDetail && <span className="text-lg" style={{ color: 'var(--sub)', marginRight: '4px' }}>‹</span>}
        Murmur
      </div>
      {!isDetail && (
        <button
          className="pointer-events-auto text-[11px] tracking-[0.14em] uppercase border border-[var(--s3)] rounded-full px-[18px] py-[9px] cursor-pointer transition-all duration-250"
          style={{
            color: isCreator ? 'var(--gold)' : 'var(--sub)',
            background: isCreator ? 'var(--gold10)' : 'rgba(15,15,28,0.7)',
            backdropFilter: 'blur(12px)',
            borderColor: isCreator ? 'rgba(201,169,110,0.4)' : undefined,
          }}
          onClick={toggleCreator}
        >
          ✦ Create
        </button>
      )}
    </nav>
  )
}
