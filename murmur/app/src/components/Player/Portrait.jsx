import { useState, useEffect } from 'react'
import Waveform from './Waveform'

export default function Portrait({ scene, narrator, isPlaying }) {
  const [pop, setPop] = useState(false)

  useEffect(() => {
    setPop(true)
    const t = setTimeout(() => setPop(false), 400)
    return () => clearTimeout(t)
  }, [scene?.emotion])

  if (!scene) return null

  const portraitSrc = narrator?.portraits?.[scene.emotion] || null

  return (
    <div className="absolute top-1/2 left-1/2 z-20 flex flex-col items-center gap-[14px]" style={{ transform: 'translate(-50%, -58%)' }}>
      <div
        className={`w-28 h-28 rounded-full flex items-center justify-center text-[54px] overflow-hidden transition-all duration-500 em-${scene.emotion}`}
        style={{
          background: 'var(--s2)',
          border: '2px solid rgba(255,255,255,0.08)',
          transitionTimingFunction: pop ? 'var(--spring)' : 'var(--silk)',
          transform: pop ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {portraitSrc ? (
          <img src={portraitSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          narrator?.emoji || '🎭'
        )}
      </div>
      <div className="flex items-center gap-[10px]">
        <Waveform visible={isPlaying} />
        <span className="text-[11px] tracking-[0.12em] uppercase" style={{ color: 'var(--sub)' }}>
          {scene.emotion}
        </span>
      </div>
    </div>
  )
}
