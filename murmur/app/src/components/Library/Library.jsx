import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'

function StoryCard({ story, index, totalStories }) {
  const selectStory = useStore(s => s.selectStory)
  const setView = useStore(s => s.setView)
  const cardRef = useRef(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle('in-view', entry.isIntersecting)
      },
      { threshold: 0.55, root: el.parentElement }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleClick = () => {
    selectStory(story)
    setView('detail')
  }

  return (
    <div
      ref={cardRef}
      className="relative w-full h-[100dvh] cursor-pointer overflow-hidden"
      style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      onClick={handleClick}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[7s] ease-out will-change-transform"
        style={{
          background: story.coverImage ? undefined : story.bg,
          backgroundImage: story.coverImage ? `url(${story.coverImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.07)',
        }}
        ref={el => {
          if (!el) return
          const parent = el.parentElement
          const update = () => {
            if (parent.classList.contains('in-view')) el.style.transform = 'scale(1)'
            else el.style.transform = 'scale(1.07)'
          }
          const obs = new MutationObserver(update)
          obs.observe(parent, { attributes: true, attributeFilter: ['class'] })
          update()
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(7,7,15,0.35) 0%, transparent 28%, rgba(7,7,15,0.15) 55%, rgba(7,7,15,0.88) 82%, rgba(7,7,15,0.99) 100%)',
        }}
      />

      {/* Content */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-transform duration-700"
        style={{
          padding: '36px 28px max(36px, env(safe-area-inset-bottom))',
          transitionTimingFunction: 'var(--silk)',
        }}
      >
        {/* Tags */}
        <div className="flex gap-[7px] flex-wrap mb-[14px]">
          {story.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] tracking-[0.13em] uppercase border rounded-full px-[13px] py-[5px]"
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
        <h2
          className="font-display italic font-semibold leading-[1.04] mb-[10px]"
          style={{ fontSize: 'clamp(36px, 10vw, 52px)', color: 'var(--text)' }}
        >
          {story.title}
        </h2>

        {/* Tagline */}
        <p className="text-sm font-light leading-relaxed mb-5" style={{ color: 'var(--sub)' }}>
          {story.tagline}
        </p>

        {/* Scroll hint */}
        {index < totalStories - 1 && (
          <div className="flex items-center gap-2 text-[10px] tracking-[0.13em] uppercase" style={{ color: 'var(--mute)' }}>
            <span className="block w-5 h-px" style={{ background: 'var(--mute)' }} />
            Scroll to explore
          </div>
        )}
      </div>
    </div>
  )
}

export default function Library() {
  const stories = useStore(s => s.stories)
  const view = useStore(s => s.view)
  const scrollRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const scrollTop = el.scrollTop
      const cardHeight = el.clientHeight
      const idx = Math.round(scrollTop / cardHeight)
      setActiveIndex(idx)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  if (view !== 'library') return null

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 overflow-y-scroll hide-scrollbar"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {stories.map((story, i) => (
        <StoryCard key={story.id} story={story} index={i} totalStories={stories.length} />
      ))}

      {/* Scroll dots */}
      <div className="fixed right-[18px] top-1/2 -translate-y-1/2 flex flex-col gap-[7px] z-50">
        {stories.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-350"
            style={{
              width: '4px',
              height: i === activeIndex ? '22px' : '4px',
              background: i === activeIndex ? 'var(--gold)' : 'var(--mute)',
              transitionTimingFunction: 'var(--silk)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
