// src/config/terrain.js

export const TERRAIN_TYPES = {
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
        staminaCost: 10,
        passable: true,
        description: "Loose, deep snow that drains stamina more quickly.",
        quote: "Each step sinks deep into the powder, making progress exhausting."
    },
    CLIFF: {
        name: "Cliff",
        color: "#6c7d8c",
        staminaCost: 20,
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
        color: "#CCE5FF",
        staminaCost: 0,
        healthRisk: 0.03,
        passable: true,
        description: "Smooth ice that's easy to traverse but dangerously cold.",
        quote: "The ice stretches out like polished glass, beautiful but punishing when you slip."
    }
};

export const SPECIAL_LOCATIONS = {
    BASE_CAMP: {
        name: "Base Camp",
        color: "gold",
        staminaCost: 0,
        passable: true,
        quote: "The relative safety of base camp offers a moment of respite."
    },
    SOUTH_POLE: {
        name: "South Pole",
        color: "#CCE5FF", // CCE5FF, 000080
        staminaCost: 5,
        passable: true,
        quote: "Could this be it? The goal of your expedition stands before you."
    }
};

// Helper function for random terrain generation
export const assignRandomTerrain = () => {
    const terrainTypes = Object.keys(TERRAIN_TYPES);
    const weights = {
        NORMAL_SNOW: 0.4,
        DEEP_SNOW: 0.3,
        CLIFF: 0.1,
        CREVASSE: 0.1,
        ICE_FIELD: 0.1
    };

    const random = Math.random();
    let cumulativeWeight = 0;

    for (const terrain of terrainTypes) {
        cumulativeWeight += weights[terrain];
        if (random < cumulativeWeight) {
            return terrain;
        }
    }
    
    return 'NORMAL_SNOW'; // Default fallback
};