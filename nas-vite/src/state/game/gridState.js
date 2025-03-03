// src/state/game/gridState.js

import { assignRandomTerrain, mountainUtils } from '../../config/terrain.js';
import { GRID } from '../../config/constants.js';

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

    // First pass: Try to place mountains
    for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
        for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
            if (Math.abs(q + r) <= GRID.SIZE) {
                const position = { q, r };
                
                // Skip if near special locations
                if (Math.abs(q - baseCamp.q) <= 1 && Math.abs(r - baseCamp.r) <= 1) continue;
                if (Math.abs(q - southPole.q) <= 1 && Math.abs(r - southPole.r) <= 1) continue;

                // Attempt to place mountain with low probability
                if (Math.random() < 0.02 && mountainUtils.canPlaceMountain(position, terrain)) {
                    mountainUtils.placeMountain(position, terrain);
                }
            }
        }
    }

    // Second pass: Fill remaining empty spaces with regular terrain
    for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
        for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
            if (Math.abs(q + r) <= GRID.SIZE) {
                const hexId = `${q},${r}`;
                
                // Skip if already has terrain or is a special location
                if (terrain[hexId] || 
                    (q === baseCamp.q && r === baseCamp.r) || 
                    (q === southPole.q && r === southPole.r)) {
                    continue;
                }

                terrain[hexId] = assignRandomTerrain();
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