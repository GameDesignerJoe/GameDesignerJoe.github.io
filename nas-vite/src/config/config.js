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
        color: "#6c7d8c",
        staminaCost: 30,
        passable: true,
        oneWay: true,
        description: "A steep descent that can only be traversed downward.",
        quote: "A sheer drop looms before us. Once we descend, there's no climbing back up."
    },
    CREVASSE: {
        name: "Crevasse",
        color: "#1e3950",
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