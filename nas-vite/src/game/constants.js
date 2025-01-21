// constants.js

// Player-related constants
export const PLAYER_COLORS = {
    DEFAULT: "green",
    DEAD: "#000066"
};

// Movement-related constants
export const MOVEMENT = {
    BASE_DURATION: 500,  // Base duration in milliseconds
    STAMINA_FACTOR: 50,  // Additional ms per stamina point cost
    MIN_DURATION: 500,   // Minimum animation duration
    MAX_DURATION: 2000   // Maximum animation duration
};

// Grid-related constants
export const GRID = {
    SIZE: 12,  // Number of hexes from center hex to edge
    HEX_SIZE: 30,
    get HEX_HEIGHT() { return this.HEX_SIZE * 2; },
    get HEX_WIDTH() { return Math.sqrt(3) * this.HEX_SIZE; }
};