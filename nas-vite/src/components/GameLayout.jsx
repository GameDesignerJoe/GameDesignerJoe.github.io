import { useState, useEffect } from 'react'
import TypewriterMessage from './TypewriterMessage'
import Stats from './Stats'
import RestartButton from './RestartButton'

function GameLayout({ canvasRef }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [detailsPanelVisible, setDetailsPanelVisible] = useState(false)
  const [message, setMessage] = useState("Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.")
  const [showRestart, setShowRestart] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Effect to handle game messages
  useEffect(() => {
    window.updateGameMessage = (newMessage, showRestartButton = false) => {
      setMessage(newMessage);
      setShowRestart(showRestartButton);
    }
    return () => {
      delete window.updateGameMessage;
    }
  }, [])

  // Add observer for terrain selection
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('terrain-details')) {
          // If terrain details are shown (no longer hidden), show panel
          if (!mutation.target.classList.contains('hidden')) {
            setDetailsPanelVisible(true)
          } else {
            setDetailsPanelVisible(false)
          }
        }
      })
    })

    const terrainDetails = document.querySelector('.terrain-details')
    if (terrainDetails) {
      observer.observe(terrainDetails, { 
        attributes: true, 
        attributeFilter: ['class'] 
      })
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="game-container">
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
          />
          <RestartButton 
            visible={showRestart} 
            onClick={() => {
              setShowRestart(false);
              window.restartGame && window.restartGame();
            }}
          />
        </div>
        
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
      </div>
    </div>
  )
}

export default GameLayout