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
  const [paused, setPaused] = useState(false)
  const [choicesRevealed, setChoicesRevealed] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [instant, setInstant] = useState(true)
  const ambientStarted = useRef(false)
  const fallbackTimer = useRef(null)
  const queuedChoice = useRef(null)

  const { story, sceneId, history, shufflers } = player

  useEffect(() => {
    if (view !== 'player' || !story || !sceneId) return
    const scene = story.scenes[sceneId]
    if (!scene) return

    setChoicesRevealed(false)
    setIsPlaying(true)
    setPaused(false)
    queuedChoice.current = null

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
      onPlayStarted: () => {
        // Audio loaded and is playing — cancel the load-failure fallback
        if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null }
      },
      onRevealChoices: () => {
        if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
        setChoicesRevealed(true)
      },
      onNarrationEnd: () => {
        if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
        setIsPlaying(false)

        // If the player already picked a choice, transition seamlessly now
        if (queuedChoice.current) {
          const target = queuedChoice.current
          queuedChoice.current = null
          setFlashOn(true)
          setTimeout(() => {
            setFlashOn(false)
            setInstant(false)
            goToScene(target)
          }, 240)
          return
        }

        // No choice queued — reveal choices for user input
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

    // If narration is still playing, queue the choice for seamless transition
    if (audioEngine.isPlaying) {
      queuedChoice.current = targetId
      return
    }

    // Narration already finished — transition immediately
    setFlashOn(true)
    setTimeout(() => {
      setFlashOn(false)
      setInstant(false)
      goToScene(targetId)
    }, 240)
  }, [goToScene, closePlayer])

  const handleTogglePause = useCallback(() => {
    if (!isPlaying) return
    if (paused) {
      audioEngine.resume()
      setPaused(false)
    } else {
      audioEngine.pause()
      setPaused(true)
    }
  }, [isPlaying, paused])

  const handleClose = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    audioEngine.stop()
    ambientStarted.current = false
    closePlayer()
  }

  if (view !== 'player' || !story || !sceneId) return null
  const scene = story.scenes[sceneId]
  if (!scene) return null

  // Fall back to the story-wide default background image if this scene doesn't set its own
  const effectiveScene = scene.bgImage
    ? scene
    : { ...scene, bgImage: story.defaultBgImage || null }

  return (
    <div className="fixed inset-0 overflow-hidden z-10" style={{ background: '#07070f', color: '#f0ede6', fontFamily: "'Public Sans', sans-serif" }}>
      <Background scene={effectiveScene} bgs={story.bgs} instant={instant} />

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

        {/* Center: Character & Mood — tap to pause/resume */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '48px', cursor: isPlaying ? 'pointer' : 'default', position: 'relative' }}
          onClick={handleTogglePause}
        >
          <Portrait scene={scene} narrator={story.narrator} isPlaying={isPlaying && !paused} />
          {/* Pause indicator */}
          {paused && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              display: 'flex', gap: '8px', opacity: 0.6,
            }}>
              <div style={{ width: 8, height: 36, borderRadius: 2, background: '#c9a96e' }} />
              <div style={{ width: 8, height: 36, borderRadius: 2, background: '#c9a96e' }} />
            </div>
          )}
        </div>

        {/* Scrub bar — above choices. key={scene.id} forces a clean remount per scene so
            stale duration/currentTime state from the previous clip doesn't linger. */}
        <ScrubBar key={scene.id} scene={scene} isPlaying={isPlaying} paused={paused} />

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

function fmt(t) {
  if (!isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ScrubBar({ scene, isPlaying, paused }) {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [hoverX, setHoverX] = useState(null)
  const trackRef = useRef(null)

  // Poll the audio engine while playing (timeupdate events are a bit irregular; rAF is smoother)
  useEffect(() => {
    let raf
    const tick = () => {
      setCurrentTime(audioEngine.currentTime || 0)
      const d = audioEngine.duration
      setDuration(isFinite(d) ? d : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const seekToClientX = (clientX) => {
    const el = trackRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audioEngine.seek(pct * duration)
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

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const revealPct = (duration > 0 && scene.secondsBeforeEnd > 0)
    ? Math.max(0, Math.min(100, ((duration - scene.secondsBeforeEnd) / duration) * 100))
    : null
  // Once the playhead reaches (or passes) the choice-reveal point, fade the dot out.
  const revealReached = duration > 0 && scene.secondsBeforeEnd > 0 && currentTime >= (duration - scene.secondsBeforeEnd)

  // Hide entirely if we don't have a meaningful duration (autoplay blocked, etc.)
  const visible = duration > 0

  return (
    <section
      style={{
        width: '100%', maxWidth: '448px',
        padding: '0 28px 12px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        ref={trackRef}
        onMouseDown={e => { setDragging(true); seekToClientX(e.clientX) }}
        onMouseMove={e => {
          if (!trackRef.current) return
          const rect = trackRef.current.getBoundingClientRect()
          setHoverX(Math.max(0, Math.min(rect.width, e.clientX - rect.left)))
        }}
        onMouseLeave={() => setHoverX(null)}
        style={{
          position: 'relative',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        {/* Track (background line) */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'rgba(255,255,255,0.15)', borderRadius: '9999px',
        }} />
        {/* Fill (played portion) */}
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: '2px',
          background: '#c9a96e', borderRadius: '9999px',
        }} />
        {/* Choice-reveal marker dot — fades out once the playhead passes it */}
        {revealPct !== null && (
          <div
            title="Choices appear here"
            style={{
              position: 'absolute', left: `${revealPct}%`,
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'rgba(201,169,110,0.7)',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 0 2px rgba(7,7,15,0.9)',
              opacity: revealReached ? 0 : 1,
              transition: 'opacity 1s ease',
              pointerEvents: revealReached ? 'none' : 'auto',
            }}
          />
        )}
        {/* Playhead thumb — no CSS transition; position is updated per-frame by the
            rAF loop, so the thumb tracks the fill bar exactly. A transition here
            conflicts with the per-frame state updates and makes the thumb appear stuck. */}
        <div
          style={{
            position: 'absolute', left: `${pct}%`,
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#c9a96e',
            transform: 'translateX(-50%)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      {/* Time readout */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '6px',
        fontFamily: "'DM Sans', sans-serif", fontSize: '10px',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{fmt(currentTime)}</span>
        <span>-{fmt(Math.max(0, duration - currentTime))}</span>
      </div>
    </section>
  )
}
