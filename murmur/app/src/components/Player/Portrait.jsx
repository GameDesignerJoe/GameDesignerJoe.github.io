import { useState, useEffect } from 'react'
import Waveform from './Waveform'

const emotionGlows = {
  curious:    { border: '#7ba8ff', ring: 'rgba(123,168,255,0.4)' },
  afraid:     { border: '#ff4b4b', ring: 'rgba(255,75,75,0.4)' },
  happy:      { border: '#c9a96e', ring: 'rgba(201,169,110,0.4)' },
  sad:        { border: '#8c64d2', ring: 'rgba(140,100,210,0.4)' },
  determined: { border: 'rgba(255,255,255,0.6)', ring: 'rgba(255,255,255,0.3)' },
}

export default function Portrait({ scene, narrator, isPlaying }) {
  const [pop, setPop] = useState(false)

  useEffect(() => {
    setPop(true)
    const t = setTimeout(() => setPop(false), 400)
    return () => clearTimeout(t)
  }, [scene?.emotion])

  if (!scene) return null

  const portraitSrc = narrator?.portraits?.[scene.emotion] || null
  const glow = emotionGlows[scene.emotion] || emotionGlows.curious

  return (
    <>
      {/* Portrait container — matches Stitch structure */}
      <div className="relative group">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${glow.border}30`,
            boxShadow: `0 0 20px 2px ${glow.ring}`,
          }}
        />
        {/* Portrait circle */}
        <div
          className="w-[112px] h-[112px] rounded-full overflow-hidden relative transition-transform duration-500"
          style={{
            border: `2px solid ${glow.border}`,
            transitionTimingFunction: pop ? 'var(--spring)' : 'var(--silk)',
            transform: pop ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {portraitSrc ? (
            <img src={portraitSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[54px]" style={{ background: '#17182c' }}>
              {narrator?.emoji || '🎭'}
            </div>
          )}
        </div>
      </div>

      {/* Emotion metadata */}
      <div className="mt-6 flex flex-col items-center space-y-3">
        <span className="font-classic text-[11px] tracking-[0.3em] font-bold text-[#a9a8ca] uppercase">
          {scene.emotion}
        </span>
        <Waveform visible={isPlaying} />
      </div>
    </>
  )
}
