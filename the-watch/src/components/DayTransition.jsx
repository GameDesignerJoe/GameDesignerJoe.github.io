import React, { useEffect } from 'react';

/**
 * DayTransition Component
 * Fullscreen animation showing "Day X" text
 * Auto-advances after delay
 */
export default function DayTransition({ day, onComplete }) {
  useEffect(() => {
    // Auto-advance after 2 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 animate-fade-in">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">
          Day {day}
        </h1>
        <div className="flex space-x-2 justify-center">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
