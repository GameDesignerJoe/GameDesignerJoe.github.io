// src/config/constants.js

// Player-related constants
export const PLAYER_COLORS = {
    DEFAULT: "green",
    DEAD: "#000066"
};

// Movement-related constants
export const MOVEMENT = {
    BASE_DURATION: 500,     // Base duration in milliseconds
    STAMINA_FACTOR: 50,     // Additional ms per stamina point cost
    MIN_DURATION: 500,      // Minimum animation duration
    MAX_DURATION: 2000,     // Maximum animation duration
    STAMINA_COST: 2        // Base stamina cost for movement
};

// Grid-related constants
export const GRID = {
    SIZE: 24,  // Number of hexes from center hex to edge
    HEX_SIZE: 20,
    get HEX_HEIGHT() { return this.HEX_SIZE * 2; },
    get HEX_WIDTH() { return Math.sqrt(3) * this.HEX_SIZE; }
};

// Player stats constants
export const PLAYER_STATS = {
    MAX_VALUE: 100,
    MIN_VALUE: 0,
    MOVE_STAMINA_COST: 10,
    HEAL_RATE: 0.5,             // Default health drop rate
    STAMINA_RECOVERY_RATE: 0.4,
    FOOD_DECAY_RATE: 0.5
};

// Game configuration constants
export const GAME_CONFIG = {
    GRID_SIZE: 10,
    BASE_HEAL_AMOUNT: 0.1,
    STARVATION_THRESHOLDS: new Set([75, 50, 25, 10]),
    FOG_OF_WAR: true
};

// UI Constants
export const UI = {
    MESSAGE_TYPES: {
        STATUS: 'status',
        TERRAIN: 'terrain',
        WEATHER: 'weather'
    },
    ANIMATION_DURATIONS: {
        MESSAGE_FADE: 300,
        WEATHER_TRANSITION: 1000
    }
};