import { useState, useEffect, useRef, useCallback } from 'react'

function ChoiceButton({ choice, index, isDefault, countdown, onPick, disabled }) {
  const [visible, setVisible] = useState(false)
  const [countdownLeft, setCountdownLeft] = useState(countdown)
  const [barPct, setBarPct] = useState(100)
  const intervalRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100 + index * 85)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    if (!isDefault || !countdown || disabled) return
    const totalMs = countdown * 1000
    let elapsed = 0
    const interval = 80
    intervalRef.current = setInterval(() => {
      elapsed += interval
      const pct = Math.max(0, 1 - elapsed / totalMs)
      setBarPct(pct * 100)
      setCountdownLeft(Math.ceil(Math.max(0, totalMs - elapsed) / 1000))
      if (elapsed >= totalMs) {
        clearInterval(intervalRef.current)
        onPick()
      }
    }, interval)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isDefault, countdown, disabled])

  const handleClick = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    onPick()
  }

  const baseStyle = {
    width: '100%',
    padding: '20px 24px',
    borderRadius: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    transition: 'opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(22px)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }

  if (isDefault) {
    return (
      <button
        onClick={handleClick}
        style={{
          ...baseStyle,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid #c9a96e',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
          <p style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '18px', color: '#ffffff', margin: 0 }}>
            {choice.text}
          </p>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c9a96e', fontWeight: 700, marginLeft: '12px', flexShrink: 0 }}>
            {countdownLeft}s
          </span>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0 0' }}>
          Auto-selecting if no choice
        </p>
        {/* Gold countdown bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          background: '#c9a96e',
          width: `${barPct}%`,
          transition: 'width 0.08s linear',
        }} />
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      style={{
        ...baseStyle,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <p style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '18px', color: '#f0ede6', margin: 0 }}>
        {choice.text}
      </p>
    </button>
  )
}

export default function Choices({ scene, onChoose, revealed }) {
  const [chosen, setChosen] = useState(false)
  const [promptVisible, setPromptVisible] = useState(false)

  useEffect(() => {
    setChosen(false)
    setPromptVisible(false)
    if (revealed) {
      requestAnimationFrame(() => setPromptVisible(true))
    }
  }, [scene?.id, revealed])

  const handlePick = useCallback((targetId) => {
    if (chosen) return
    setChosen(true)
    onChoose(targetId)
  }, [chosen, onChoose])

  if (!revealed) return null

  const hasChoices = scene.choices.length > 0
  const isEnd = !hasChoices

  return (
    <section style={{
      width: '100%',
      maxWidth: '448px',
      paddingLeft: '24px',
      paddingRight: '24px',
      paddingBottom: '32px',
    }}>
      {/* Prompt */}
      <div style={{
        textAlign: 'center',
        marginBottom: '24px',
        opacity: promptVisible ? 0.6 : 0,
        transform: promptVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.45s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          letterSpacing: '0.2em',
          fontWeight: 600,
          color: '#a9a8ca',
          textTransform: 'uppercase',
        }}>
          {isEnd ? 'Your story ends here.' : 'What will you do?'}
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isEnd ? (
          <EndButton onReturn={handlePick} />
        ) : (
          scene.choices.map((choice, i) => (
            <ChoiceButton
              key={`${scene.id}-${i}`}
              choice={choice}
              index={i}
              isDefault={scene.defaultChoice != null && i === scene.defaultChoice}
              countdown={scene.defaultChoice != null && i === scene.defaultChoice ? scene.countdown : 0}
              onPick={() => handlePick(choice.target)}
              disabled={chosen}
            />
          ))
        )}
      </div>
    </section>
  )
}

function EndButton({ onReturn }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <button
      onClick={() => onReturn(null)}
      style={{
        width: '100%',
        padding: '20px 24px',
        borderRadius: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: 'opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      <p style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '18px', color: '#f0ede6', margin: 0 }}>
        Return to the library…
      </p>
    </button>
  )
}
