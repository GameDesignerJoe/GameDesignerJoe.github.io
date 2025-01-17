import { useEffect, useRef } from 'react'
import GameLayout from './components/GameLayout'
import { initGame } from './game/engine.js'

function App() {
  const canvasRef = useRef(null)

  useEffect(() => {
    // Make sure canvas exists
    if (!canvasRef.current) return

    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        initGame(canvasRef.current)
      } catch (error) {
        console.error('Error initializing game:', error)
      }
    })

    // Cleanup function
    return () => {
      // Add any cleanup needed when component unmounts
    }
  }, []) // Empty dependency array means this runs once on mount

  return <GameLayout canvasRef={canvasRef} />
}

export default App