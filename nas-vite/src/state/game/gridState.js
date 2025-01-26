// src/state/game/gridState.js

import { assignRandomTerrain } from '../../config/terrain';
import { GRID, GAME_CONFIG } from '../../config/constants';

export const initializeGridState = () => {
    // Position Base Camp
    const minQ = Math.max(-GRID.SIZE, -GRID.SIZE - (-GRID.SIZE));
    const maxQ = Math.min(GRID.SIZE, GRID.SIZE - (-GRID.SIZE));
    const baseQ = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
    
    const baseCamp = { q: baseQ, r: -GRID.SIZE };

    // Position South Pole with variation
    const variation = Math.floor(GRID.SIZE * 0.2);
    let southQ, southR;
    
    do {
        southQ = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        southR = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
    } while (southQ === baseCamp.q && southR === baseCamp.r);
    
    const southPole = { q: southQ, r: southR };

    // Initialize terrain grid
    const terrain = {};
    for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
        for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
            if (Math.abs(q + r) <= GRID.SIZE) {
                // Skip special locations
                if ((q === baseCamp.q && r === baseCamp.r) || 
                    (q === southPole.q && r === southPole.r)) {
                    continue;
                }
                terrain[`${q},${r}`] = assignRandomTerrain();
            }
        }
    }

    return {
        baseCamp,
        southPole,
        terrain,
        visitedHexes: new Set([`${baseCamp.q},${baseCamp.r}`]),
        visibleHexes: new Set()
    };
};

export default initializeGridState;