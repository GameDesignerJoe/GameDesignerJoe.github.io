import React, { useState, useEffect } from 'react';
import MapView from './MapView.jsx';
import ControlPanel from './ControlPanel.jsx';
import { initializeGame } from '../systems/initialization.js';
import { isPositionOccupied } from '../utils/gridUtils.js';

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

  /**
   * Handle warden selection
   */
  const handleWardenClick = (wardenId) => {
    console.log(`Selected Warden #${wardenId + 1}`);
    setGameState(prev => ({
      ...prev,
      selectedWardenId: prev.selectedWardenId === wardenId ? null : wardenId
    }));
  };

  /**
   * Handle square click - move selected warden or select warden
   */
  const handleSquareClick = (x, y) => {
    if (gameState.selectedWardenId === null) {
      console.log(`No warden selected. Clicked square [${x}, ${y}]`);
      return;
    }

    // Check if another warden is already at this position
    const otherWardens = gameState.wardens.filter(w => w.id !== gameState.selectedWardenId);
    if (isPositionOccupied({ x, y }, otherWardens)) {
      console.log(`Cannot place warden - position occupied`);
      return;
    }

    // Move the selected warden
    console.log(`Moving Warden #${gameState.selectedWardenId + 1} to [${x}, ${y}]`);
    setGameState(prev => ({
      ...prev,
      wardens: prev.wardens.map(warden =>
        warden.id === prev.selectedWardenId
          ? { ...warden, position: { x, y } }
          : warden
      ),
      selectedWardenId: null // Deselect after moving
    }));
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
          wardens={gameState.wardens}
          selectedWardenId={gameState.selectedWardenId}
          onSquareClick={handleSquareClick}
          onWardenClick={handleWardenClick}
        />
        
        <ControlPanel 
          gameState={gameState}
          onRunDay={() => console.log('Run Day - Coming in M3')}
        />
      </main>

      {/* Debug Info */}
      <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg text-xs max-w-xs">
        <h3 className="font-bold mb-2">Debug Info (M2)</h3>
        <div className="space-y-1">
          <p>Phase: {gameState.phase}</p>
          <p>Citizens: {gameState.citizens.length}</p>
          <p>Wardens: {gameState.wardens.length}</p>
          <p>Selected: {gameState.selectedWardenId !== null ? `W${gameState.selectedWardenId + 1}` : 'None'}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">Warden Positions</summary>
            <ul className="mt-1 ml-4">
              {gameState.wardens.map(w => (
                <li key={w.id}>
                  W{w.id + 1}: [{w.position.x}, {w.position.y}]
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
