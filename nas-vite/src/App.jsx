import { useEffect, useRef } from 'react'
import { GAME_CONFIG } from './config/config.js'
import GameLayout from './components/GameLayout'
import { initGame } from './game/engine.js'

function App() {
  // We'll use this ref to access the canvas element
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Here we'll initialize the game
    // This is where we'll move the game initialization logic
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Initialize canvas size
    canvas.width = GAME_CONFIG.CANVAS_WIDTH
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT

    // We'll move the game initialization here

    return () => {
      // Cleanup if needed
    }
  }, [])

  return (
    <GameLayout canvasRef={canvasRef} />
  )
}

export default App