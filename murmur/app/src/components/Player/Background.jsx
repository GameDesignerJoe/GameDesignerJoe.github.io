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
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1100ms]"
        style={{ ...bgA, opacity: slot === 'a' ? 1 : 0, transitionTimingFunction: 'var(--silk)' }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1100ms]"
        style={{ ...bgB, opacity: slot === 'b' ? 1 : 0, transitionTimingFunction: 'var(--silk)' }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(7,7,15,0.5) 0%, rgba(7,7,15,0.1) 35%, rgba(7,7,15,0.4) 65%, rgba(7,7,15,0.92) 100%)',
        }}
      />
    </>
  )
}
