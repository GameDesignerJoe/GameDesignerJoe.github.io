// src/game/config/config.js

import { TERRAIN_TYPES, SPECIAL_LOCATIONS } from '../state/game/gameState.js';

// Function to randomly assign terrain to a hex
export function assignRandomTerrain() {
    // Terrain distribution weights
    const weights = {
        NORMAL_SNOW: 35,
        DEEP_SNOW: 25,
        ICE_FIELD: 15,
        CLIFF: 7,
        CREVASSE: 18
    };

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (const [terrain, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            return terrain;
        }
    }
    return 'NORMAL_SNOW'; // Fallback
}

// Get details for a terrain type
export function getTerrainDetails(terrainType) {
    return TERRAIN_TYPES[terrainType] || TERRAIN_TYPES.SNOW;
}

// Function to update info panel with terrain details
export function updateTerrainInfo(terrainType) {
    const terrain = getTerrainDetails(terrainType);
    const infoPanel = document.getElementById('infoPanel');
    
    if (infoPanel) {
        infoPanel.innerHTML = `
            <h3>${terrain.name}</h3>
            <p><em>"${terrain.quote}"</em></p>
        `;
    }
}