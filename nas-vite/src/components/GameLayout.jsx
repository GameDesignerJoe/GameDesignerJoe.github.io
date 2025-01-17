import { useState, useEffect } from 'react'
import TypewriterMessage from './TypewriterMessage'
import Stats from './Stats'
import RestartButton from './RestartButton'

function GameLayout({ canvasRef }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [detailsPanelVisible, setDetailsPanelVisible] = useState(false)
  const [message, setMessage] = useState("Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.")
  const [showRestart, setShowRestart] = useState(false)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth, document.documentElement.clientWidth)
      const height = Math.min(window.innerHeight, document.documentElement.clientHeight)
      
      setIsMobile(width <= 768)
      setDimensions({ width, height })
      
      // Force canvas resize if it exists
      if (canvasRef.current) {
        const maxWidth = Math.min(width - 40, 450)
        canvasRef.current.width = maxWidth
        canvasRef.current.height = maxWidth
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100)
    })

    // Initial size setup
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [canvasRef])

  return (
    <div className="game-container" style={{ 
      width: '100%',
      minHeight: '100vh',
      maxWidth: isMobile ? '100%' : '450px'
    }}>
      <h1>NOT ALL SURVIVE</h1>
      <div id="message-container">
        <TypewriterMessage 
          message={message} 
          speed={50} 
        />
      </div>
      <div className="game-layout">
        <div id="main-container">
          <Stats />
          <canvas 
            ref={canvasRef} 
            id="canvas"
            data-testid="game-canvas"
            style={{
              width: '100%',
              height: 'auto',
              touchAction: 'none',
              display: 'block'
            }}
          />
          <RestartButton 
            visible={showRestart} 
            onClick={() => {
              setShowRestart(false);
              window.restartGame && window.restartGame();
            }}
          />
        </div>
        
        {isMobile ? (
          <div id="details-panel" className={`details-sidebar ${detailsPanelVisible ? 'show' : ''}`}
               style={{
                 position: 'fixed',
                 bottom: 0,
                 left: 0,
                 width: '100%',
                 maxHeight: '50vh',
                 backgroundColor: 'white',
                 transform: detailsPanelVisible ? 'translateY(0)' : 'translateY(100%)',
                 transition: 'transform 0.3s ease-in-out',
                 zIndex: 1000
               }}>
            <div className="details-content">
              {/* Details panel content */}
            </div>
          </div>
        ) : (
          <div id="details-panel" className={`details-sidebar ${detailsPanelVisible ? 'show' : ''}`}>
            <div className="details-content">
              {/* Details panel content */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GameLayout  // Make sure this line exists