// Terrain configuration
const TERRAIN_TYPES = {
    NORMAL_SNOW: {
        name: "Normal Snow",
        color: "#E0F7FA",
        staminaCost: 5,
        passable: true,
        description: "A relatively firm snowpack that allows for steady progress.",
        quote: "The surface here is even, the snow packed firm beneath our feet."
    },
    DEEP_SNOW: {
        name: "Deep Snow",
        color: "#A3CFE0",
        staminaCost: 20,
        passable: true,
        description: "Loose, deep snow that drains stamina more quickly.",
        quote: "Each step sinks deep into the powder, making progress exhausting."
    },
    CLIFF: {
        name: "Cliff",
        color: "#666666",
        staminaCost: 30,
        passable: true,
        oneWay: true,
        description: "A steep descent that can only be traversed downward.",
        quote: "A sheer drop looms before us. Once we descend, there's no climbing back up."
    },
    CREVASSE: {
        name: "Crevasse",
        color: "#222222",
        passable: false,
        description: "A deep crack in the ice. Impossible to cross without proper equipment.",
        quote: "A yawning chasm splits the ice, far too wide to risk crossing."
    },
    ICE_FIELD: {
        name: "Ice Field",
        color: "#CCE5FF", // CCE5FF
        staminaCost: 3,
        healthRisk: 0.02,
        passable: true,
        description: "Smooth ice that's easy to traverse but dangerously cold.",
        quote: "The ice stretches out like polished glass, beautiful but punishing when you slip."
    }
};

// Special locations
const SPECIAL_LOCATIONS = {
    BASE_CAMP: {
        name: "Base Camp",
        color: "gold",
        passable: true,
        description: "A safe haven where you can rest and recover.",
        quote: "The familiar sight of base camp brings a sense of relief."
    },
    SOUTH_POLE: {
        name: "South Pole",
        color: "#4B0082",
        passable: true,
        description: "The ultimate goal of your expedition.",
        quote: "Could this be it? The South Pole itself?"
    }
};

// Function to randomly assign terrain to a hex
function assignRandomTerrain() {
    // Terrain distribution weights
    const weights = {
        NORMAL_SNOW: 50,
        DEEP_SNOW: 25,
        ICE_FIELD: 15,
        CLIFF: 7,
        CREVASSE: 3
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
function getTerrainDetails(terrainType) {
    return TERRAIN_TYPES[terrainType] || TERRAIN_TYPES.NORMAL_SNOW;
}

// Function to update info panel with terrain details
function updateTerrainInfo(terrainType) {
    const terrain = getTerrainDetails(terrainType);
    const infoPanel = document.getElementById('infoPanel');
    
    infoPanel.innerHTML = `
        <h3>${terrain.name}</h3>
        <p>${terrain.description}</p>
        <p><em>"${terrain.quote}"</em></p>
    `;
}

// Weather system configuration
// const WEATHER_CONFIG = {
//     STORM: {
//         HEALTH_DECAY_MULTIPLIER: 1.05, // Additional 5% decay
//         DURATION: 10000, // 10 seconds
//         MIN_INTERVAL: 30000, // 30 seconds
//         MAX_INTERVAL: 120000 // 2 minutes
//     }
// };

// // Add to existing game state
// let stormActive = false;
// let stormDirection = null; // 0=North, 1=East, 2=South, 3=West
// let stormProgress = 0;

// // Storm effect handler
// function handleStormEffects(deltaTime) {
//     if (stormActive) {
//         // Apply additional health decay during storm
//         stats.health = Math.max(0, stats.health - 
//             (STATS.HEALTH_DECAY * WEATHER_CONFIG.STORM.HEALTH_DECAY_MULTIPLIER * deltaTime));
//     }
// }

// // Storm completion handler
// function handleStormComplete() {
//     stormActive = false;
//     stormProgress = 0;
    
//     // Reset fog of war
//     visitedHexes.clear();
//     visitedHexes.add(`${playerPosition.q},${playerPosition.r}`);
//     updateVisibility();
    
//     // Update UI elements
//     updateStatsDisplay();
// }