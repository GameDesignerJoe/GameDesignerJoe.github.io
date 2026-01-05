import React from 'react';

/**
 * WardenMarker Component
 * Displays a warden icon on the grid
 */
export default function WardenMarker({ warden, isSelected, onClick }) {
  return (
    <div
      className={`
        absolute inset-0 
        flex items-center justify-center
        cursor-pointer
        z-10
        ${isSelected ? 'ring-4 ring-yellow-400' : ''}
      `}
      onClick={(e) => {
        e.stopPropagation(); // Prevent square click
        onClick(warden.id);
      }}
      title={`Warden #${warden.id + 1} - Click to select`}
    >
      <div className={`
        w-8 h-8 rounded-full
        flex items-center justify-center
        font-bold text-white text-sm
        ${isSelected ? 'bg-yellow-500' : 'bg-blue-600'}
        shadow-lg
        hover:scale-110
        transition-transform
      `}>
        W{warden.id + 1}
      </div>
    </div>
  );
}
