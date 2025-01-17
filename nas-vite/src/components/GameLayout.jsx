import { useState, useEffect } from 'react'

function GameLayout({ canvasRef }) {
   // Debug log to verify the ref
   console.log('GameLayout rendering with canvasRef:', canvasRef);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="game-container">
      <h1>NOT ALL SURVIVE</h1>
      <div id="message-container">
        <p id="game-message">Locate the South Pole and return to base camp without dying.</p>
      </div>
      <div className="game-layout">
        <div id="main-container">
          <div id="stats-container">
            <div className="stat">
              <img src="/art/health.svg" alt="Health" className="stat-icon" />
              <div className="stat-bar">
                <div className="stat-fill" id="health-bar"></div>
              </div>
            </div>
            <div className="stat">
              <img src="/art/stamina.svg" alt="Stamina" className="stat-icon" />
              <div className="stat-bar">
                <div className="stat-fill" id="stamina-bar"></div>
              </div>
            </div>
            <div className="stat">
              <img src="/art/food.svg" alt="Hunger" className="stat-icon" />
              <div className="stat-bar">
                <div className="stat-fill" id="hunger-bar"></div>
              </div>
            </div>
          </div>
          <canvas 
                    ref={canvasRef} 
                    id="canvas"
                    // Add key attributes for debugging
                    data-testid="game-canvas"
                ></canvas>
        </div>
        
        <div id="details-panel" className="details-sidebar">
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
              <button id="move-confirm" className="move-button">Move Here</button>
              <button id="move-cancel" className="move-button cancel">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameLayout