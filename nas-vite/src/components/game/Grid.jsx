// src/components/game/Grid.jsx
import React from 'react';
import { useDebugManager } from '../../hooks/useDebugManager';

const Grid = () => {
    const { zoomLevel } = useDebugManager();
    
    return (
        <div style={{ 
            width: '100%', 
            height: '100%',
            transformOrigin: 'center center'
        }}>
            <svg 
                id="gameGrid" 
                width="100%" 
                height="100%" 
                viewBox="-150 -150 300 300"
                style={{ 
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center'
                }}
            >
                <defs>
                    <linearGradient id="blizzardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{stopColor: 'white', stopOpacity: 0.8}} />
                        <stop offset="100%" style={{stopColor: 'white', stopOpacity: 0.6}} />
                    </linearGradient>
                </defs>
                <rect 
                    id="blizzardOverlay" 
                    x="-150" 
                    y="-150" 
                    width="300" 
                    height="300" 
                    fill="url(#blizzardGradient)"
                    opacity="0"
                    pointerEvents="none"
                />
                <rect 
                    id="whiteoutOverlay" 
                    x="-150" 
                    y="-150" 
                    width="300" 
                    height="300" 
                    fill="white"
                    opacity="0"
                    pointerEvents="none"
                />
                <g id="hexGroup">
                    {/* Hexes will be added by GridManager */}
                </g>
            </svg>
        </div>
    );
};

export default Grid;