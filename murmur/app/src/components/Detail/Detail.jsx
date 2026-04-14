import { useState } from 'react'
import { useStore } from '../../store'
import ResumeModal from '../Player/ResumeModal'

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
        className="fixed inset-0 flex flex-col overflow-y-auto hide-scrollbar transition-all duration-400"
        style={{
          background: 'var(--bg)',
          transitionTimingFunction: 'var(--silk)',
        }}
      >
        {/* Hero */}
        <div className="relative w-full flex-shrink-0 overflow-hidden" style={{ height: '52dvh' }}>
          <div
            className="absolute bg-cover bg-center"
            style={{
              inset: '-12px',
              background: story.coverImage ? undefined : story.bg,
              backgroundImage: story.coverImage ? `url(${story.coverImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(7,7,15,0.55) 0%, transparent 45%, rgba(7,7,15,0.92) 80%, var(--bg) 100%)',
            }}
          />
        </div>

        {/* Body */}
        <div
          className="flex-1"
          style={{
            padding: '0 28px max(48px, env(safe-area-inset-bottom))',
            maxWidth: '640px',
          }}
        >
          {/* Tags */}
          <div className="flex gap-[8px] flex-wrap mb-4">
            {story.tags.map(tag => (
              <span
                key={tag}
                className="text-[11px] tracking-[0.1em] uppercase border rounded-full px-[14px] py-[6px]"
                style={{
                  color: 'var(--gold)',
                  background: 'var(--gold10)',
                  borderColor: 'rgba(201,169,110,0.22)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1
            className="font-display italic font-semibold leading-[1.05] mb-2"
            style={{ fontSize: 'clamp(34px, 8vw, 46px)', color: 'var(--text)' }}
          >
            {story.title}
          </h1>

          {/* Tagline */}
          <p className="text-[15px] italic font-light mb-5" style={{ color: 'var(--gold)' }}>
            {story.tagline}
          </p>

          {/* Meta row */}
          <div className="flex gap-6 mb-6">
            {[
              { label: 'Duration', val: story.duration },
              { label: 'Paths', val: story.paths },
              { label: 'Voice', val: story.narrator.name },
            ].map(m => (
              <div key={m.label} className="flex flex-col gap-[3px]">
                <span className="text-[10px] tracking-[0.13em] uppercase" style={{ color: 'var(--mute)' }}>{m.label}</span>
                <span className="font-display text-[22px]" style={{ color: 'var(--text)' }}>{m.val}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          <p className="text-[15px] font-light leading-[1.78] mb-10" style={{ color: 'var(--sub)' }}>
            {story.description}
          </p>

          {/* CTA */}
          <button
            className="w-full py-5 border-none text-[15px] font-medium tracking-[0.04em] cursor-pointer transition-all active:scale-[0.97] active:brightness-90"
            style={{
              background: 'var(--gold)',
              color: 'var(--bg)',
              borderRadius: 'var(--rl)',
            }}
            onClick={handleBegin}
          >
            Begin Your Journey →
          </button>
        </div>
      </div>

      <ResumeModal
        show={showResume}
        sceneTitle={resumeSceneTitle}
        onResume={handleResume}
        onFresh={handleFresh}
      />
    </>
  )
}
