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

  const { story, sceneId, history, shufflers } = player

  useEffect(() => {
    if (view !== 'player' || !story || !sceneId) return
    const scene = story.scenes[sceneId]
    if (!scene) return

    setChoicesRevealed(false)
    setIsPlaying(true)

    // Start ambient on first scene
    if (!ambientStarted.current && story.ambient?.default) {
      audioEngine.startAmbient(story.ambient.default)
      ambientStarted.current = true
    }

    // Handle scene-level ambient override
    if (scene.ambient) {
      audioEngine.switchAmbient(scene.ambient)
    }

    // Save state
    goToScene(sceneId)

    // Get clip from shuffler
    const shuffler = shufflers[sceneId]
    if (!shuffler) return

    const clipSrc = shuffler.next()

    audioEngine.playScene(scene, clipSrc, {
      onRevealChoices: () => setChoicesRevealed(true),
      onNarrationEnd: () => {
        setIsPlaying(false)
        // If no choices, reveal end message
        if (scene.choices.length === 0) {
          setChoicesRevealed(true)
        }
        // If choices weren't revealed yet (secondsBeforeEnd was 0), reveal now
        if (!scene.secondsBeforeEnd || scene.secondsBeforeEnd <= 0) {
          setChoicesRevealed(true)
        }
      },
    })

    return () => {
      // Cleanup handled by next scene or closePlayer
    }
  }, [view, sceneId, story?.id])

  const handleChoose = useCallback((targetId) => {
    if (!targetId) {
      // End of story
      audioEngine.stop()
      ambientStarted.current = false
      closePlayer()
      return
    }
    // Flash transition
    setFlashOn(true)
    setTimeout(() => {
      setFlashOn(false)
      setInstant(false)
      // Update scene through store
      useStore.getState().player.sceneId = targetId
      goToScene(targetId)
      // Force re-render by updating sceneId
      const currentPlayer = useStore.getState().player
      useStore.setState({
        player: { ...currentPlayer, sceneId: targetId }
      })
    }, 240)
  }, [goToScene, closePlayer])

  const handleClose = () => {
    audioEngine.stop()
    ambientStarted.current = false
    closePlayer()
  }

  if (view !== 'player' || !story || !sceneId) return null

  const scene = story.scenes[sceneId]
  if (!scene) return null

  const sceneIds = Object.keys(story.scenes)

  return (
    <div className="fixed inset-0 overflow-hidden z-10">
      <Background scene={scene} bgs={story.bgs} instant={instant} />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between"
        style={{ padding: 'max(18px, env(safe-area-inset-top)) 20px 0' }}
      >
        {/* Close */}
        <button
          className="w-[42px] h-[42px] rounded-full flex items-center justify-center cursor-pointer text-[15px] transition-all active:scale-90"
          style={{
            background: 'rgba(7,7,15,0.55)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--sub)',
          }}
          onClick={handleClose}
        >
          ✕
        </button>

        {/* Scene chip */}
        <div
          className="text-[11px] tracking-[0.14em] uppercase rounded-full px-4 py-[7px]"
          style={{
            color: 'rgba(240,237,230,0.55)',
            background: 'rgba(7,7,15,0.45)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {scene.title}
        </div>

        {/* Progress dots */}
        <div className="flex gap-[5px] items-center">
          {sceneIds.map(id => (
            <div
              key={id}
              className="rounded-full transition-all duration-300"
              style={{
                width: 5,
                height: 5,
                background: id === sceneId ? '#fff' : history.includes(id) ? 'var(--gold)' : 'rgba(255,255,255,0.18)',
                transform: id === sceneId ? 'scale(1.35)' : 'scale(1)',
                transitionTimingFunction: 'var(--silk)',
              }}
            />
          ))}
        </div>
      </div>

      <Portrait scene={scene} narrator={story.narrator} isPlaying={isPlaying} />
      <Choices scene={scene} onChoose={handleChoose} revealed={choicesRevealed} />

      {/* Flash overlay */}
      <div
        className="fixed inset-0 z-[150] pointer-events-none"
        style={{
          background: 'var(--bg)',
          opacity: flashOn ? 1 : 0,
          transition: flashOn ? 'opacity 0.24s var(--silk)' : 'opacity 0.5s var(--silk)',
        }}
      />
    </div>
  )
}
