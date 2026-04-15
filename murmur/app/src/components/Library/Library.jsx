import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'

function StoryCard({ story, index, totalStories }) {
  const selectStory = useStore(s => s.selectStory)
  const setView = useStore(s => s.setView)

  const handleClick = () => {
    selectStory(story)
    setView('detail')
  }

  return (
    <section
      data-card-index={index}
      style={{
        position: 'relative',
        height: '100dvh',
        overflow: 'hidden',
        cursor: 'pointer',
        scrollSnapAlign: 'start',
      }}
      onClick={handleClick}
    >
      {/* Background with Ken Burns */}
      <div
        className="transition-transform duration-[7s] ease-out"
        style={{ position: 'absolute', inset: 0, zIndex: 0, transform: 'scale(1.1)' }}
      >
        {story.coverImage ? (
          <img alt="" src={story.coverImage} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%) contrast(110%) brightness(0.7)' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: story.bg, filter: 'brightness(0.7)' }} />
        )}
      </div>

      {/* Cinematic vignette */}
      <div className="cinematic-vignette" style={{ position: 'absolute', inset: 0, zIndex: 10 }} />

      {/* Content — tight centered column */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
        paddingBottom: '180px', paddingLeft: '28px', paddingRight: '28px',
      }}>
        <div style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Genre tags */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {story.tags.map((tag, i) => (
              <span key={tag} style={{
                padding: '6px 16px', borderRadius: '9999px', fontSize: '10px',
                letterSpacing: '0.2em', textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif",
                color: i === 0 ? '#c9a96e' : 'rgba(255,255,255,0.7)',
                background: i === 0 ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${i === 0 ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "'EB Garamond', serif", fontStyle: 'italic',
            fontSize: 'clamp(32px, 7vw, 52px)', color: '#f0ede6',
            lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: '16px', textAlign: 'center',
          }}>
            {story.title}
          </h1>

          {/* Tagline */}
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '15px', color: '#928faa',
            lineHeight: 1.6, textAlign: 'center', maxWidth: '360px', marginBottom: '24px',
          }}>
            {story.tagline}
          </p>

          {/* Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>headphones</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{story.duration}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_stories</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{story.paths} Paths</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint — above the bottom nav */}
      {index < totalStories - 1 && (
        <div className="animate-pulse" style={{
          position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', opacity: 0.4,
        }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', color: 'white' }}>
            — Scroll to Explore
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_double_arrow_down</span>
        </div>
      )}
    </section>
  )
}

export default function Library() {
  const rawStories = useStore(s => s.stories)
  const view = useStore(s => s.view)
  const showHidden = useStore(s => s.showHiddenStories)
  const stories = [...rawStories]
    .filter(s => showHidden || !s.hidden)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const scrollRef = useRef(null)
  const activeIndex = useStore(s => s.activeStoryIndex)
  const setActiveIndex = useStore(s => s.setActiveStoryIndex)
  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const h = el.clientHeight
      if (h === 0) return
      const idx = Math.max(0, Math.min(Math.round(el.scrollTop / h), stories.length - 1))
      setActiveIndex(idx)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [stories.length, view])

  if (view !== 'library') return null

  return (
    <>
      <main
        ref={scrollRef}
        className="hide-scrollbar"
        style={{
          position: 'fixed', inset: 0,
          overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch',
          height: '100dvh', background: '#07070f', color: '#e5e3ff',
          fontFamily: "'Public Sans', sans-serif",
        }}
      >
        {stories.map((story, i) => (
          <StoryCard key={story.id} story={story} index={i} totalStories={stories.length} />
        ))}
      </main>

      {/* Scroll dots */}
      <div style={{
        position: 'fixed', right: '24px', top: '50%', transform: 'translateY(-50%)',
        zIndex: 46, display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {stories.map((_, i) => (
          <div
            key={i}
            onClick={() => {
              const el = scrollRef.current
              if (el) el.scrollTo({ top: i * el.clientHeight, behavior: 'smooth' })
            }}
            style={{
              width: '6px',
              height: i === activeIndex ? '24px' : '6px',
              borderRadius: '9999px',
              background: i === activeIndex ? '#c9a96e' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </>
  )
}
