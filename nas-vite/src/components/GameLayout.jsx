function GameLayout({ canvasRef }) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
      };
  
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  
    return (
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center py-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">NOT ALL SURVIVE</h1>
        </header>
  
        <div className="w-full max-w-xl mx-auto px-4 mb-4">
          <div id="message-container" 
            className="h-24 bg-white/10 border border-white/20 rounded p-4">
            <p id="game-message" className="italic text-base md:text-lg leading-relaxed whitespace-pre-line"></p>
          </div>
          <button id="restart-button" 
            className="hidden bg-blue-500 text-white px-6 py-2 rounded mt-4 mx-auto">
            BEGIN A NEW EXPEDITION
          </button>
        </div>
  
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row gap-6'}`}>
          <div className="flex-1">
            <div id="stats-container" className="flex justify-between gap-2 mb-2 px-2">
              {['health', 'stamina', 'food'].map((stat) => (
                <div key={stat} className="flex items-center gap-2 flex-1">
                  <img src={`/src/assets/${stat}.svg`} alt={stat} className="w-6 h-6 object-contain" />
                  <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                    <div id={`${stat}-bar`} className="h-full transition-all duration-300"></div>
                  </div>
                </div>
              ))}
            </div>
            <canvas ref={canvasRef} className="w-full border border-black touch-none"></canvas>
          </div>
  
          {/* Details Panel */}
          <div id="details-panel" 
            className={`bg-white ${
              isMobile 
                ? 'w-full border-t border-gray-200 mt-4' 
                : 'w-72 border-l border-gray-200'
            }`}>
            <div className="details-content p-4">
              <div className="empty-state">
                Select a hex to view details
              </div>
              <div className="terrain-details hidden">
                <h2 id="terrain-name" className="text-2xl text-center mb-4">Terrain Name</h2>
                <div className="terrain-costs bg-gray-50 rounded p-3 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-600">Stamina Cost:</span>
                      <span id="stamina-cost" className="block">5</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-600">Health Risk:</span>
                      <span id="health-risk" className="block">None</span>
                    </div>
                  </div>
                </div>
                <p id="terrain-description" className="mb-4"></p>
                <p id="terrain-quote" className="italic text-gray-600 text-center mb-6"></p>
                <button id="move-confirm" 
                  className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 disabled:bg-gray-300">
                  Move Here
                </button>
                <button id="move-cancel" 
                  className="w-full bg-gray-100 text-gray-600 py-3 rounded hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export default GameLayout;