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

  // First useEffect for resize handling
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth, document.documentElement.clientWidth)
      const height = Math.min(window.innerHeight, document.documentElement.clientHeight)
      
      console.log('🔍 Layout Debug:', { 
        width,
        height,
        pixelRatio: window.devicePixelRatio,
        isMobile: width <= 768
      });
      
      setIsMobile(width <= 768)
      setDimensions({ width, height })
      
      // Force canvas resize if it exists
      if (canvasRef.current) {
        const maxWidth = Math.min(width - 40, 450)
        const currentWidth = canvasRef.current.width
        canvasRef.current.width = maxWidth
        canvasRef.current.height = maxWidth
        console.log('📱 Canvas Resized:', { 
          oldWidth: currentWidth,
          newWidth: maxWidth,
          newHeight: maxWidth,
          style: {
            width: canvasRef.current.style.width,
            height: canvasRef.current.style.height
          }
        });
      } else {
        console.warn('❌ Canvas ref not available during resize');
      }
    }

    // Set up window.updateGameMessage
    window.updateGameMessage = (newMessage, showRestartButton = false) => {
      console.log('updateGameMessage called:', { newMessage, showRestartButton });
      setMessage(newMessage);
      setShowRestart(showRestartButton);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', () => {
      console.log('Orientation changed');
      setTimeout(handleResize, 100)
    })

    // Initial setup
    handleResize()
    console.log('Initial mobile state:', isMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      delete window.updateGameMessage;
    }
  }, [canvasRef])

  // Second useEffect for touch events
  useEffect(() => {
    const logTouch = (e) => {
      console.log('👆 Touch Event:', {
        type: e.type,
        touches: e.touches.length,
        target: e.target.id,
        coordinates: e.touches[0] ? {
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
          screenX: e.touches[0].screenX,
          screenY: e.touches[0].screenY
        } : null
      });
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

  // Rest of your component remains the same...
  return (
    <div className="game-container" style={{ 
      width: '100%',
      minHeight: '100vh',
      maxWidth: isMobile ? '100%' : '450px',
      backgroundColor: 'rgba(255, 0, 0, 0.1)' // Debug background
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
              border: '1px solid red' // Debug border
            }}
          />
          <RestartButton 
            visible={showRestart} 
            onClick={() => {
              console.log('Restart clicked, current state:', { showRestart });
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
              {/* Terrain panel content */}
              <TerrainPanelContent />
            </div>
          </div>
        ) : (
          <div id="details-panel" className={`details-sidebar ${detailsPanelVisible ? 'show' : ''}`}>
            <div className="details-content">
              {/* Terrain panel content */}
              <TerrainPanelContent />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Separate component for terrain panel content to avoid duplication
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