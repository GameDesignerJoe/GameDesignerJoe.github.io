import { useState, useEffect, useRef } from 'react'
import { resolveAssetPath } from '../../engine/assetPath'

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.ogg']
function isVideo(src) {
  if (!src) return false
  const lower = src.split('?')[0].toLowerCase()
  return VIDEO_EXTS.some(ext => lower.endsWith(ext))
}

const emotionGlows = {
  default:      { border: '#928faa', ring: 'rgba(146,143,170,0.4)' },
  curious:      { border: '#7ba8ff', ring: 'rgba(123,168,255,0.4)' },
  afraid:       { border: '#ff4b4b', ring: 'rgba(255,75,75,0.4)' },
  happy:        { border: '#c9a96e', ring: 'rgba(201,169,110,0.4)' },
  sad:          { border: '#8c64d2', ring: 'rgba(140,100,210,0.4)' },
  determined:   { border: 'rgba(255,255,255,0.6)', ring: 'rgba(255,255,255,0.3)' },
  unsettled:    { border: '#b0884e', ring: 'rgba(176,136,78,0.4)' },
  dissociated:  { border: '#6e7b8b', ring: 'rgba(110,123,139,0.4)' },
  hollow:       { border: '#3d3d52', ring: 'rgba(61,61,82,0.4)' },
  controlled:   { border: '#4aa89a', ring: 'rgba(74,168,154,0.4)' },
}

export default function Portrait({ scene, narrator, isPlaying }) {
  const [pop, setPop] = useState(false)
  const videoRef = useRef(null)

  const portraitSrc = narrator?.portraits?.[scene?.emotion] || narrator?.portraits?.default || null
  const glow = emotionGlows[scene?.emotion] || emotionGlows.default

  useEffect(() => {
    setPop(true)
    const t = setTimeout(() => setPop(false), 400)
    return () => clearTimeout(t)
  }, [scene?.emotion])


  // Spawn ripple rings at random intervals (0.4–1.2s) for an organic, speech-like feel.
  const [ripples, setRipples] = useState([])
  const rippleId = useRef(0)
  useEffect(() => {
    if (!isPlaying) { setRipples([]); return }
    let timer
    const spawn = () => {
      const id = ++rippleId.current
      setRipples(prev => [...prev, id])
      // Auto-remove after the animation completes (2.4s)
      setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 2400)
      // Schedule the next ripple at a random interval
      const delay = 400 + Math.random() * 800 // 0.4–1.2s
      timer = setTimeout(spawn, delay)
    }
    spawn()
    return () => clearTimeout(timer)
  }, [isPlaying, scene?.id])

  if (!scene) return null

  return (
    <div className="relative group flex items-center justify-center">
      {/* Ripple rings — spawn at random intervals for organic speech-like pulses */}
      {ripples.map(id => (
        <div key={id} className="portrait-ripple" style={{ borderColor: glow.border }} />
      ))}

      {/* Outer glow ring — gentle pulse when playing */}
      <div
        className={isPlaying ? 'portrait-glow-pulse' : ''}
        style={{
          position: 'absolute', inset: '-4px', borderRadius: '50%',
          border: `2px solid ${glow.border}30`,
          boxShadow: `0 0 20px 2px ${glow.ring}`,
          '--glow-color': glow.ring,
          '--glow-border': glow.border,
        }}
      />

      {/* Portrait circle */}
      <div
        className="w-[336px] h-[336px] rounded-full overflow-hidden relative transition-transform duration-500"
        style={{
          border: `2px solid ${glow.border}`,
          transitionTimingFunction: pop ? 'var(--spring)' : 'var(--silk)',
          transform: pop ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {portraitSrc ? (
          isVideo(portraitSrc)
            ? <video
                ref={videoRef}
                src={resolveAssetPath(portraitSrc)}
                className="w-full h-full object-cover"
                autoPlay loop muted playsInline
                onLoadedData={(e) => { e.target.currentTime = 0.5 }}
                onSeeked={(e) => { if (e.target.currentTime < 0.5) e.target.currentTime = 0.5 }}
              />
            : <img src={resolveAssetPath(portraitSrc)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[54px]" style={{ background: '#17182c' }}>
            {narrator?.emoji || '🎭'}
          </div>
        )}
      </div>

      <style>{`
        .portrait-ripple {
          position: absolute;
          width: 336px;
          height: 336px;
          border-radius: 50%;
          border: 2px solid;
          opacity: 0;
          pointer-events: none;
          animation: ripple-out 2.4s ease-out forwards;
        }
        @keyframes ripple-out {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        .portrait-glow-pulse {
          animation: glow-breathe 3s ease-in-out infinite;
        }
        @keyframes glow-breathe {
          0%, 100% { box-shadow: 0 0 20px 2px var(--glow-color); border-width: 2px; }
          50%      { box-shadow: 0 0 35px 8px var(--glow-color); border-width: 3px; }
        }
      `}</style>
    </div>
  )
}
