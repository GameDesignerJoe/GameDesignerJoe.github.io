import React, { useState, useEffect } from 'react';
import MapView from './MapView.jsx';
import { initializeGame } from '../systems/initialization.js';

/**
 * GameController Component
 * Main game orchestrator - manages state and renders appropriate views
 */
export default function GameController() {
  const [gameState, setGameState] = useState(null);

  // Initialize game on mount
  useEffect(() => {
    const initialState = initializeGame();
    setGameState(initialState);
  }, []);

  const handleSquareClick = (x, y) => {
    console.log(`Clicked square [${x}, ${y}]`);
    // Warden placement logic will go here in Milestone 2
  };

  // Show loading until game is initialized
  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-gray-600">Initializing game...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white py-4 px-8 shadow-md">
        <h1 className="text-3xl font-bold">The Watch</h1>
        <p className="text-blue-200 text-sm mt-1">Day {gameState.currentDay} - {gameState.phase}</p>
      </header>

      {/* Main Content */}
      <main>
        <MapView 
          grid={gameState.grid} 
          onSquareClick={handleSquareClick}
        />
      </main>

      {/* Debug Info */}
      <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg text-xs max-w-xs">
        <h3 className="font-bold mb-2">Debug Info (M1)</h3>
        <div className="space-y-1">
          <p>Phase: {gameState.phase}</p>
          <p>Citizens: {gameState.citizens.length}</p>
          <p>Wardens: {gameState.wardens.length}</p>
          <p>Grid Squares: {gameState.grid.length}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">Crime Density</summary>
            <ul className="mt-1 ml-4">
              <li>Low (0.2): {gameState.grid.filter(s => s.crimeDensity === 0.2).length}</li>
              <li>Med (0.5): {gameState.grid.filter(s => s.crimeDensity === 0.5).length}</li>
              <li>High (0.8): {gameState.grid.filter(s => s.crimeDensity === 0.8).length}</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
