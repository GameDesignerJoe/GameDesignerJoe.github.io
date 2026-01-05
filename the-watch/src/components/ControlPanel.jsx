import React from 'react';

/**
 * ControlPanel Component
 * Shows game controls, warden info, and action buttons
 */
export default function ControlPanel({ gameState, onRunDay }) {
  return (
    <div className="max-w-4xl mx-auto px-8 py-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          {/* Left side - Warden Info */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Warden Deployment</h3>
            <div className="space-y-2">
              {gameState.wardens.map(warden => (
                <div 
                  key={warden.id}
                  className="flex items-center space-x-3 text-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    W{warden.id + 1}
                  </div>
                  <span className="text-gray-700">
                    Position: [{warden.position.x}, {warden.position.y}]
                  </span>
                  <span className="text-gray-500 text-xs">
                    Patrol: {warden.patrolRadius}x{warden.patrolRadius * 2 + 1} ({Math.pow(warden.patrolRadius * 2 + 1, 2)} squares)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - Instructions and Button */}
          <div className="text-right space-y-3">
            <div className="text-sm text-gray-600">
              <p className="font-semibold">How to play:</p>
              <p>1. Click a warden to select it</p>
              <p>2. Click a square to move it</p>
              <p>3. Blue zones show patrol coverage</p>
            </div>
            
            <button
              onClick={onRunDay}
              className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors"
            >
              Run Day {gameState.currentDay}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
