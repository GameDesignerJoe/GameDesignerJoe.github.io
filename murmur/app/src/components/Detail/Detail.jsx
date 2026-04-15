import { useState } from 'react'
import { useStore } from '../../store'
import ResumeModal from '../Player/ResumeModal'
import { resolveAssetPath } from '../../engine/assetPath'

export default function Detail() {
  const view = useStore(s => s.view)
  const story = useStore(s => s.selectedStory)
  const setView = useStore(s => s.setView)
  const launchStory = useStore(s => s.launchStory)
  const getSave = useStore(s => s.getSave)
  const clearSave = useStore(s => s.clearSave)
  const [showResume, setShowResume] = useState(false)
  const [savedState, setSavedState] = useState(null)

  if (view !== 'detail' || !story) return null

  const handleBegin = () => {
    const saved = getSave(story.id)
    if (saved && saved.sceneId && saved.sceneId !== story.startScene) {
      setSavedState(saved)
      setShowResume(true)
    } else {
      launchStory(story, story.startScene)
    }
  }

  const handleResume = () => {
    setShowResume(false)
    launchStory(story, savedState.sceneId, savedState.history || [])
  }

  const handleFresh = () => {
    setShowResume(false)
    clearSave(story.id)
    launchStory(story, story.startScene)
  }

  const resumeSceneTitle = savedState ? (story.scenes[savedState.sceneId]?.title || 'a scene') : ''

  return (
    <>
      <div
        className="fixed inset-0 overflow-y-auto hide-scrollbar"
        style={{
          background: '#0d0d1a',
          color: '#e5e3ff',
          fontFamily: "'Public Sans', sans-serif",
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <main className="relative">
          {/* Hero — Stitch: h-[459px] */}
          <section className="relative w-full overflow-hidden" style={{ height: '459px' }}>
            {story.coverImage ? (
              <img alt="" className="absolute inset-0 w-full h-full object-cover" src={resolveAssetPath(story.coverImage)} />
            ) : (
              <div className="absolute inset-0 w-full h-full" style={{ background: story.bg }} />
            )}
            <div className="absolute inset-0 hero-vignette" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(13,13,26,0.4) 0%, transparent 20%, transparent 80%, rgba(13,13,26,0.4) 100%)' }} />
          </section>

          {/* Content — centered column with generous spacing */}
          <article style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: '640px',
            marginLeft: 'auto',
            marginRight: 'auto',
            marginTop: '-48px',
            paddingLeft: '28px',
            paddingRight: '28px',
            paddingBottom: '128px',
          }}>

            {/* Genre Pills — Stitch: px-3 py-1, but need more padding for readability */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
              {story.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    fontFamily: "'Public Sans', sans-serif",
                    color: '#c9a96e',
                    background: 'rgba(103,79,29,0.1)',
                    border: '1px solid rgba(228,194,133,0.3)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 'clamp(32px, 7vw, 48px)',
              lineHeight: 1.15,
              color: '#e5e3ff',
              marginBottom: '12px',
            }}>
              {story.title}
            </h1>

            {/* Tagline */}
            <p style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: 'italic',
              fontSize: '18px',
              color: '#c9a96e',
              opacity: 0.9,
              marginBottom: '36px',
            }}>
              &ldquo;{story.tagline}&rdquo;
            </p>

            {/* Metadata Row — Stitch: grid 3-col, py-8, border-y, generous internal spacing */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px',
              paddingTop: '32px',
              paddingBottom: '32px',
              marginBottom: '36px',
              borderTop: '1px solid rgba(69,69,98,0.3)',
              borderBottom: '1px solid rgba(69,69,98,0.3)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '9px', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(201,169,110,0.6)' }}>
                  Duration
                </span>
                <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: '20px', color: '#e5e3ff' }}>
                  {story.duration}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px', paddingRight: '16px', borderLeft: '1px solid rgba(69,69,98,0.2)', borderRight: '1px solid rgba(69,69,98,0.2)' }}>
                <span style={{ fontSize: '9px', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(201,169,110,0.6)' }}>
                  Paths
                </span>
                <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: '20px', color: '#e5e3ff' }}>
                  {story.paths}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'right' }}>
                <span style={{ fontSize: '9px', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(201,169,110,0.6)' }}>
                  Voice
                </span>
                <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: '20px', color: '#e5e3ff' }}>
                  {story.narrator.name}
                </span>
              </div>
            </div>

            {/* Description */}
            <p style={{
              fontFamily: "'Public Sans', sans-serif",
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: 1.75,
              letterSpacing: '0.02em',
              color: '#a9a8ca',
              marginBottom: '52px',
            }}>
              {story.description}
            </p>

            {/* CTA Button — Stitch: bg-gold, rounded-full, centered, shadow */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
              <button
                onClick={handleBegin}
                style={{
                  width: '85%',
                  maxWidth: '380px',
                  padding: '20px 32px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: '#c9a96e',
                  color: '#503a08',
                  fontFamily: "'Public Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 25px 50px -12px rgba(228,194,133,0.2)',
                  transition: 'all 0.3s ease',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span>Begin Your Journey</span>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_right_alt</span>
              </button>
            </div>
          </article>
        </main>

        {/* Bottom fade */}
        <div className="fixed bottom-0 left-0 w-full pointer-events-none z-0" style={{ height: '128px', background: 'linear-gradient(to top, #0d0d1a, transparent)' }} />

        {/* Film grain */}
        <div className="fixed inset-0 pointer-events-none z-[100]" style={{ opacity: 0.03 }}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
            <rect width="100%" height="100%" filter="url(#noise)" />
          </svg>
        </div>
      </div>

      <ResumeModal show={showResume} sceneTitle={resumeSceneTitle} onResume={handleResume} onFresh={handleFresh} />
    </>
  )
}
