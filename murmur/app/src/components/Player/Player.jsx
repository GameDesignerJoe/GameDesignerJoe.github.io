import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store'
import audioEngine from '../../engine/AudioEngine'
import Background from './Background'
import Portrait from './Portrait'
import Choices from './Choices'

export default function Player() {
  const view = useStore(s => s.view)
  const player = useStore(s => s.player)
  const goToScene = useStore(s => s.goToScene)
  const closePlayer = useStore(s => s.closePlayer)
  const [isPlaying, setIsPlaying] = useState(false)
  const [choicesRevealed, setChoicesRevealed] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [instant, setInstant] = useState(true)
  const ambientStarted = useRef(false)
  const fallbackTimer = useRef(null)

  const { story, sceneId, history, shufflers } = player

  useEffect(() => {
    if (view !== 'player' || !story || !sceneId) return
    const scene = story.scenes[sceneId]
    if (!scene) return

    setChoicesRevealed(false)
    setIsPlaying(true)

    if (!ambientStarted.current && story.ambient?.default) {
      audioEngine.startAmbient(story.ambient.default)
      ambientStarted.current = true
    }
    if (scene.ambient) {
      audioEngine.switchAmbient(scene.ambient)
    }

    const shuffler = shufflers[sceneId]
    if (!shuffler) return
    const clipSrc = shuffler.next()

    // Fallback: if audio fails to load, reveal choices after a short delay
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    fallbackTimer.current = setTimeout(() => {
      setChoicesRevealed(true)
      setIsPlaying(false)
    }, 3000)

    audioEngine.playScene(scene, clipSrc, {
      onRevealChoices: () => {
        if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
        setChoicesRevealed(true)
      },
      onNarrationEnd: () => {
        if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
        setIsPlaying(false)
        // Always reveal choices when narration ends (or fails to load)
        setChoicesRevealed(true)
      },
    })

    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    }
  }, [view, sceneId, story?.id])

  const handleChoose = useCallback((targetId) => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    if (!targetId) {
      audioEngine.stop()
      ambientStarted.current = false
      closePlayer()
      return
    }
    setFlashOn(true)
    setTimeout(() => {
      setFlashOn(false)
      setInstant(false)
      goToScene(targetId)
    }, 240)
  }, [goToScene, closePlayer])

  const handleClose = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    audioEngine.stop()
    ambientStarted.current = false
    closePlayer()
  }

  if (view !== 'player' || !story || !sceneId) return null
  const scene = story.scenes[sceneId]
  if (!scene) return null

  return (
    <div className="fixed inset-0 overflow-hidden z-10" style={{ background: '#07070f', color: '#f0ede6', fontFamily: "'Public Sans', sans-serif" }}>
      <Background scene={scene} bgs={story.bgs} instant={instant} />

      <main className="relative z-10 h-screen flex flex-col justify-between items-center" style={{ paddingTop: '32px', paddingBottom: '32px' }}>

        {/* Top bar — centered column layout, no dots */}
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px 24px',
        }}>
          {/* Close button — left aligned */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              left: '24px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c9a96e',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.3s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
          </button>

          {/* Scene title pill — centered with more padding */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '8px 24px',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '10px',
              letterSpacing: '0.2em',
              fontWeight: 700,
              color: '#c9a96e',
              textTransform: 'uppercase',
            }}>
              {scene.title}
            </span>
          </div>
        </header>

        {/* Center: Character & Mood */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '48px' }}>
          <Portrait scene={scene} narrator={story.narrator} isPlaying={isPlaying} />
        </div>

        {/* Bottom: Choices */}
        <Choices scene={scene} onChoose={handleChoose} revealed={choicesRevealed} />
      </main>

      {/* Flash overlay */}
      <div
        className="fixed inset-0 z-[150] pointer-events-none"
        style={{
          background: '#07070f',
          opacity: flashOn ? 1 : 0,
          transition: flashOn ? 'opacity 0.24s var(--silk)' : 'opacity 0.5s var(--silk)',
        }}
      />
    </div>
  )
}
