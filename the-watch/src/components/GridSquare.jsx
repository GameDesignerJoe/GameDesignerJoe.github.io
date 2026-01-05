import React from 'react';
import WardenMarker from './WardenMarker.jsx';
import CrimeIndicator from './CrimeIndicator.jsx';

/**
 * GridSquare Component
 * Renders a single cell in the grid
 * Shows patrol zones, wardens, crimes, and handles clicks
 */
export default function GridSquare({ 
  square, 
  onClick, 
  isInPatrolZone,
  warden,
  selectedWardenId,
  onWardenClick,
  showCrimes = false
}) {
  // Determine background color based on crime density
  const getDensityColor = () => {
    if (isInPatrolZone) return 'bg-blue-100';
    
    // Show density more subtly
    if (square.crimeDensity === 0.2) return 'bg-green-50';
    if (square.crimeDensity === 0.5) return 'bg-yellow-50';
    if (square.crimeDensity === 0.8) return 'bg-orange-50';
    return 'bg-gray-50';
  };

  // Get border color based on crime count
  const getBorderColor = () => {
    if (!showCrimes || !square.crimes || square.crimes.length === 0) {
      return 'border-gray-300';
    }
    
    const crimeCount = square.crimes.length;
    if (crimeCount >= 3) return 'border-red-400 border-2';
    if (crimeCount >= 2) return 'border-orange-400 border-2';
    return 'border-yellow-400';
  };

  return (
    <div
      className={`
        aspect-square 
        ${getBorderColor()}
        ${getDensityColor()}
        hover:bg-blue-50
        cursor-pointer
        transition-colors
        flex items-center justify-center
        text-xs text-gray-400
        relative
      `}
      onClick={onClick}
      title={`Grid [${square.x}, ${square.y}] - Density: ${square.crimeDensity}${square.crimes && square.crimes.length > 0 ? ` - ${square.crimes.length} crimes` : ''}`}
    >
      {/* Show coordinates for debugging */}
      <span className="opacity-50">
        {square.x},{square.y}
      </span>
      
      {/* Render crime indicators if enabled */}
      {showCrimes && square.crimes && (
        <CrimeIndicator crimes={square.crimes} />
      )}
      
      {/* Render warden marker if present */}
      {warden && (
        <WardenMarker
          warden={warden}
          isSelected={warden.id === selectedWardenId}
          onClick={onWardenClick}
        />
      )}
    </div>
  );
}
