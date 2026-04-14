import { useRef, useEffect, useState } from 'react'

function applyBg(style, gradient, imageUrl) {
  if (imageUrl) {
    return { ...style, backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { ...style, background: gradient }
}

export default function Background({ scene, bgs, instant }) {
  const [slot, setSlot] = useState('a')
  const [bgA, setBgA] = useState({})
  const [bgB, setBgB] = useState({})
  const prevSceneRef = useRef(null)

  useEffect(() => {
    if (!scene || !bgs) return
    const grad = bgs[scene.bgKey] || bgs.a || ''

    if (instant || !prevSceneRef.current) {
      setBgA(applyBg({}, grad, scene.bgImage))
      setSlot('a')
    } else if (slot === 'a') {
      setBgB(applyBg({}, grad, scene.bgImage))
      setSlot('b')
    } else {
      setBgA(applyBg({}, grad, scene.bgImage))
      setSlot('a')
    }
    prevSceneRef.current = scene.id
  }, [scene?.id])

  return (
    <>
      {/* Base color */}
      <div className="absolute inset-0" style={{ background: '#07070f' }} />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1100ms]"
        style={{ ...bgA, opacity: slot === 'a' ? 1 : 0, transitionTimingFunction: 'var(--silk)' }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1100ms]"
        style={{ ...bgB, opacity: slot === 'b' ? 1 : 0, transitionTimingFunction: 'var(--silk)' }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, transparent 20%, rgba(7,7,15,0.95) 100%)',
        }}
      />
    </>
  )
}
