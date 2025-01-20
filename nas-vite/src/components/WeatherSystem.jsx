import React, { useState, useEffect, useCallback } from 'react';

const WeatherSystem = ({ onStormComplete, gridSize = 3 }) => {
  const [stormActive, setStormActive] = useState(false);
  const [stormDirection, setStormDirection] = useState(null);
  const [stormProgress, setStormProgress] = useState(0);
  
  // Storm settings
  const STORM_DURATION = 10000; // 10 seconds
  const MIN_INTERVAL = 30000; // 30 seconds
  const MAX_INTERVAL = 120000; // 2 minutes

  // Debug command handler - Ctrl + Alt + W
  useEffect(() => {
    const handleDebugCommand = (e) => {
      if (e.ctrlKey && e.altKey && e.key === 'w') {
        triggerStorm();
      }
    };
    window.addEventListener('keydown', handleDebugCommand);
    return () => window.removeEventListener('keydown', handleDebugCommand);
  }, []);

  // Random storm interval
  useEffect(() => {
    const scheduleNextStorm = () => {
      const nextStorm = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
      return setTimeout(triggerStorm, nextStorm);
    };

    const timer = scheduleNextStorm();
    return () => clearTimeout(timer);
  }, []);

  const triggerStorm = useCallback(() => {
    if (stormActive) return;
    
    // Random direction: 0=North, 1=East, 2=South, 3=West
    const direction = Math.floor(Math.random() * 4);
    setStormDirection(direction);
    setStormActive(true);
    
    // Animate storm progress
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / STORM_DURATION, 1);
      setStormProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setStormActive(false);
        setStormProgress(0);
        if (onStormComplete) onStormComplete();
      }
    };
    requestAnimationFrame(animate);
  }, [stormActive, onStormComplete]);

  // Calculate storm mask path based on direction and progress
  const getStormMask = useCallback(() => {
    const viewSize = 300; // Matches the SVG viewBox size
    const diagonal = Math.sqrt(2 * viewSize * viewSize);
    
    let startX, startY, endX, endY;
    const progress = stormProgress * (diagonal + viewSize); // Add viewSize to ensure complete coverage
    
    switch (stormDirection) {
      case 0: // North
        startX = -viewSize/2;
        startY = -viewSize/2 + progress;
        endX = viewSize/2;
        endY = startY;
        break;
      case 1: // East
        startX = -viewSize/2 + progress;
        startY = -viewSize/2;
        endX = startX;
        endY = viewSize/2;
        break;
      case 2: // South
        startX = -viewSize/2;
        startY = -viewSize/2 - progress;
        endX = viewSize/2;
        endY = startY;
        break;
      case 3: // West
        startX = -viewSize/2 - progress;
        startY = -viewSize/2;
        endX = startX;
        endY = viewSize/2;
        break;
      default:
        return '';
    }
    
    return `M ${startX},${startY} L ${endX},${endY} L ${viewSize},${viewSize} L ${-viewSize},${viewSize} Z`;
  }, [stormDirection, stormProgress]);

  if (!stormActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="-150 -150 300 300" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="stormGradient">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0.7" />
          </radialGradient>
        </defs>
        <path
          d={getStormMask()}
          fill="url(#stormGradient)"
          className="transition-opacity duration-300"
        />
      </svg>
    </div>
  );
};

export default WeatherSystem;