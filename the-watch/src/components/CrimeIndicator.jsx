import React from 'react';

/**
 * CrimeIndicator Component
 * Shows crime markers on grid squares
 */
export default function CrimeIndicator({ crimes }) {
  if (!crimes || crimes.length === 0) return null;

  // Count crimes by status
  const prevented = crimes.filter(c => c.status === 'prevented').length;
  const responded = crimes.filter(c => c.status === 'responded').length;
  const reported = crimes.filter(c => c.status === 'reported').length;
  const unreported = crimes.filter(c => c.status === 'unreported').length;

  return (
    <div className="absolute top-1 right-1 flex gap-0.5 z-20">
      {/* Prevented - Green */}
      {prevented > 0 && (
        <div className="w-2 h-2 rounded-full bg-green-500 border border-white" title={`${prevented} prevented`}></div>
      )}
      
      {/* Responded - Blue */}
      {responded > 0 && (
        <div className="w-2 h-2 rounded-full bg-blue-500 border border-white" title={`${responded} responded`}></div>
      )}
      
      {/* Reported - Yellow */}
      {reported > 0 && (
        <div className="w-2 h-2 rounded-full bg-yellow-500 border border-white" title={`${reported} reported`}></div>
      )}
      
      {/* Unreported - Red */}
      {unreported > 0 && (
        <div className="w-2 h-2 rounded-full bg-red-500 border border-white animate-pulse" title={`${unreported} unreported`}></div>
      )}
    </div>
  );
}
