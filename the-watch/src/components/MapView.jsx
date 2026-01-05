import React from 'react';
import GridSquare from './GridSquare.jsx';
import { GRID_SIZE } from '../utils/constants.js';

/**
 * MapView Component
 * Renders the game grid as a 5x5 layout
 */
export default function MapView({ grid, onSquareClick }) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Command Map</h2>
      
      <div 
        className="grid gap-1 bg-gray-400 p-1 rounded"
        style={{ 
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          maxWidth: '500px',
          width: '100%'
        }}
      >
        {grid.map((square) => (
          <GridSquare
            key={`${square.x}-${square.y}`}
            square={square}
            onClick={() => onSquareClick(square.x, square.y)}
          />
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Grid Size: {GRID_SIZE} × {GRID_SIZE}</p>
        <p>Total Squares: {grid.length}</p>
      </div>
    </div>
  );
}
