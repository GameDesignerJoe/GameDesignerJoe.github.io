import { useState, useEffect } from 'react'
import TypewriterMessage from '../TypewriterMessage'
import Stats from '../ui/Stats'  // Updated import path
import RestartButton from '../RestartButton.jsx.bak'
import DebugUI from '../debug/DebugUI'

function GameLayout({ canvasRef }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [detailsPanelVisible, setDetailsPanelVisible] = useState(false)
  const [message, setMessage] = useState("Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.")
  const [showRestart, setShowRestart] = useState(false)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  // First useEffect for resize handling
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth, document.documentElement.clientWidth)
      const height = Math.min(window.innerHeight, document.documentElement.clientHeight)
      
      setIsMobile(width <= 768)
      setDimensions({ width, height })
      
      if (canvasRef.current) {
        const maxWidth = Math.min(width - 40, 450)
        const currentWidth = canvasRef.current.width
        canvasRef.current.width = maxWidth
        canvasRef.current.height = maxWidth
      } else {
        console.warn('❌ Canvas ref not available during resize');
      }
    }

    window.updateGameMessage = (newMessage, showRestartButton = false) => {
      setMessage(newMessage);
      setShowRestart(showRestartButton);
    };

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100)
    })

    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      delete window.updateGameMessage;
    }
  }, [canvasRef])

  useEffect(() => {
    const logTouch = (e) => {
      // Touch logging code...
      console.log('Touch event:', e.type);
    };
  
    document.addEventListener('touchstart', logTouch);
    document.addEventListener('touchend', logTouch);
    document.addEventListener('touchmove', logTouch);
  
    return () => {
      document.removeEventListener('touchstart', logTouch);
      document.removeEventListener('touchend', logTouch);
      document.removeEventListener('touchmove', logTouch);
    };
  }, []);

  return (
    <div className="game-container" style={{ 
      width: '100%',
      minHeight: '100vh',
      maxWidth: isMobile ? '100%' : '450px',
      backgroundColor: 'rgba(255, 0, 0, 0.1)'
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
              display: 'block',
              border: '1px solid red'
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
              <TerrainPanelContent />
            </div>
          </div>
        ) : (
          <div id="details-panel" className={`details-sidebar ${detailsPanelVisible ? 'show' : ''}`}>
            <div className="details-content">
              <TerrainPanelContent />
            </div>
          </div>
        )}
      </div>
      
      <DebugUI />
    </div>
  )
}

function TerrainPanelContent() {
  return (
    <>
      <div className="empty-state">
        Select a hex to view details
      </div>
      <div className="terrain-details hidden">
        <h2 id="terrain-name">Terrain Name</h2>
        <div className="terrain-costs">
          <div className="cost-item">
            <span className="cost-label">Stamina Cost:</span>
            <span id="stamina-cost">5</span>
          </div>
          <div className="cost-item">
            <span className="cost-label">Health Risk:</span>
            <span id="health-risk">None</span>
          </div>
        </div>
        <p id="terrain-description" className="terrain-description">
          Terrain description will appear here.
        </p>
        <p id="terrain-quote" className="terrain-quote">
          <em>"Explorer's quote will appear here."</em>
        </p>
      </div>
    </>
  )
}

export default GameLayout