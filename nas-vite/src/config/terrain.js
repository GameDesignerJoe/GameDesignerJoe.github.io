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
    },
    MOUNTAIN: {
        name: "Mountain",
        color: "#E8E9EB",
        passable: false,
        description: "A towering mountain of ice and rock, impossible to traverse.",
        quote: "The mountain rises before us, its peak lost in the swirling snow.",
        isMultiHex: true,
        alwaysVisible: true
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
        color: "#CCE5FF",
        staminaCost: 5,
        passable: true,
        quote: "Could this be it? The goal of your expedition stands before you."
    }
};

// Helper function to get adjacent hex coordinates
const getAdjacentHexes = (center) => {
    const directions = [
        {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
        {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
    ];
    
    return directions.map(dir => ({
        q: center.q + dir.q,
        r: center.r + dir.r
    }));
};

// Function to check if a position can be a mountain center
const canPlaceMountain = (position, existingTerrain) => {
    // Check center position
    const centerKey = `${position.q},${position.r}`;
    if (existingTerrain[centerKey]) return false;

    // Check all adjacent positions
    const adjacentHexes = getAdjacentHexes(position);
    return adjacentHexes.every(hex => {
        const hexKey = `${hex.q},${hex.r}`;
        return !existingTerrain[hexKey];
    });
};

// Function to place a mountain and its surrounding tiles
const placeMountain = (center, terrain) => {
    // Place center
    terrain[`${center.q},${center.r}`] = 'MOUNTAIN';
    
    // Place surrounding mountain tiles
    const adjacentHexes = getAdjacentHexes(center);
    adjacentHexes.forEach(hex => {
        terrain[`${hex.q},${hex.r}`] = 'MOUNTAIN';
    });
};

// Updated random terrain generation (rolling a weighted die)
export const assignRandomTerrain = () => {
    const weights = {
        NORMAL_SNOW: 0.35,
        DEEP_SNOW: 0.25,
        CLIFF: 0.1,
        CREVASSE: 0.1,
        ICE_FIELD: 0.1,
        MOUNTAIN: 0.02
    };

    const random = Math.random();
    let cumulativeWeight = 0;

    for (const [terrain, weight] of Object.entries(weights)) {
        cumulativeWeight += weight;
        if (random < cumulativeWeight) {
            return terrain;
        }
    }
    
    return 'NORMAL_SNOW';
};

// Export mountain-specific functions for use in grid generation
export const mountainUtils = {
    canPlaceMountain,
    placeMountain,
    getAdjacentHexes
};