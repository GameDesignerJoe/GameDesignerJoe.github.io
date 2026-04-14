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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isDefault, countdown, disabled])

  const handleClick = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    onPick()
  }

  return (
    <button
      className="w-full mb-[10px] text-left cursor-pointer relative overflow-hidden transition-all duration-500"
      style={{
        padding: '17px 22px',
        background: isDefault ? 'rgba(7,7,15,0.6)' : 'rgba(7,7,15,0.52)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: `1px solid ${isDefault ? 'rgba(201,169,110,0.28)' : 'rgba(255,255,255,0.075)'}`,
        borderRadius: 'var(--rl)',
        color: 'var(--text)',
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontSize: '19px',
        fontWeight: 400,
        lineHeight: 1.3,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transitionTimingFunction: 'var(--silk)',
      }}
      onClick={handleClick}
    >
      <span className="block">{choice.text}</span>
      {isDefault && (
        <>
          <div className="flex items-center justify-between mt-[7px]">
            <span
              className="text-[10px] tracking-[0.12em] uppercase"
              style={{ fontFamily: "'DM Sans', sans-serif", fontStyle: 'normal', color: 'var(--gold)', opacity: 0.7 }}
            >
              Auto-selecting if no choice
            </span>
            <span
              className="text-[10px] tracking-[0.08em] min-w-5 text-right"
              style={{ fontFamily: "'DM Sans', sans-serif", fontStyle: 'normal', color: 'var(--gold)', opacity: 0.6 }}
            >
              {countdownLeft}s
            </span>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{ height: 2, background: 'rgba(201,169,110,0.1)', borderRadius: '0 0 var(--rl) var(--rl)' }}
          >
            <div
              style={{
                height: '100%',
                width: `${barPct}%`,
                background: 'var(--gold)',
                borderRadius: 'inherit',
                transition: 'width 0.08s linear',
              }}
            />
          </div>
        </>
      )}
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
    <div
      className="absolute bottom-0 left-0 right-0 z-20"
      style={{ padding: '20px 20px max(32px, env(safe-area-inset-bottom))' }}
    >
      {/* Prompt */}
      <div
        className="text-[10px] tracking-[0.15em] uppercase text-center mb-[13px] transition-all duration-450"
        style={{
          color: 'var(--mute)',
          opacity: promptVisible ? 1 : 0,
          transform: promptVisible ? 'translateY(0)' : 'translateY(8px)',
          transitionTimingFunction: 'var(--silk)',
        }}
      >
        {isEnd ? 'Your story ends here.' : 'What will you do?'}
      </div>

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
      className="w-full text-center cursor-pointer transition-all duration-500"
      style={{
        padding: '17px 22px',
        background: 'rgba(7,7,15,0.52)',
        backdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.075)',
        borderRadius: 'var(--rl)',
        color: 'var(--text)',
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontSize: '19px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transitionTimingFunction: 'var(--silk)',
      }}
      onClick={() => onReturn(null)}
    >
      Return to the library…
    </button>
  )
}
