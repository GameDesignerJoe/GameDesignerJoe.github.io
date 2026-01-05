import React from 'react';

/**
 * GridSquare Component
 * Renders a single cell in the grid
 * Shows crime density visually (for debugging, will be hidden later)
 */
export default function GridSquare({ square, onClick }) {
  // Determine background color based on crime density (debugging aid)
  const getDensityColor = () => {
    if (square.crimeDensity === 0.2) return 'bg-gray-50';
    if (square.crimeDensity === 0.5) return 'bg-gray-100';
    if (square.crimeDensity === 0.8) return 'bg-gray-200';
    return 'bg-gray-50';
  };

  return (
    <div
      className={`
        aspect-square 
        border border-gray-300 
        ${getDensityColor()}
        hover:bg-blue-50
        cursor-pointer
        transition-colors
        flex items-center justify-center
        text-xs text-gray-400
      `}
      onClick={onClick}
      title={`Grid [${square.x}, ${square.y}] - Density: ${square.crimeDensity}`}
    >
      {/* Show coordinates for debugging */}
      <span className="opacity-50">
        {square.x},{square.y}
      </span>
    </div>
  );
}
