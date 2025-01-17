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

  // At the top of GameLayout with other useEffect hooks
  useEffect(() => {
    console.log('Setting up updateGameMessage');
    window.updateGameMessage = (newMessage, showRestartButton = false) => {
      console.log('updateGameMessage called:', { newMessage, showRestartButton });
      setMessage(newMessage);
      setShowRestart(showRestartButton);
    };

    return () => {
      console.log('Cleaning up updateGameMessage');
      delete window.updateGameMessage;
    };
  }, []);

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

          {/* Update the RestartButton component in GameLayout.jsx */}
          <RestartButton 
            visible={showRestart} 
            onClick={() => {
              console.log('Restart clicked, current state:', { showRestart });
              setShowRestart(false);
              window.restartGame && window.restartGame();
            }}
          />
        </div>
        
        {/* In GameLayout.jsx, update the details panel content: */}
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
    </div>
  </div>
) : (
  // Copy the same content for desktop
  <div id="details-panel" className={`details-sidebar ${detailsPanelVisible ? 'show' : ''}`}>
    <div className="details-content">
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
    </div>
  </div>
)}
      </div>
    </div>
  )
}

export default GameLayout  // Make sure this line exists