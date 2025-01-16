// Game Configuration
export const GAME_CONFIG = {
    // Grid settings
    HEX_SIZE: 40,
    GRID_WIDTH: 5, // 20
    GRID_HEIGHT: 5, // 40
    
    // Visual settings
    PLAYER_CIRCLE_SIZE: 0.4,   // Size of player circle relative to hex size (0-1)
    
    // Colors
    COLORS: {
        PLAYER: "green",           // Player circle color
        BASE_CAMP: "gold",         // Base camp hex color
        SOUTH_POLE: "blue",        // South pole hex color
        FOG_OF_WAR: "darkgray",    // Color of unexplored hexes
        HEX_BORDER: "white"        // Color of hex borders
    },

    // Starting stats
    STARTING_STATS: {
        HEALTH: 100,
        STAMINA: 100,
        HUNGER: 100
    },
    
    // Stats decay rates (per second)
    HEALTH_DECAY_RATE: 0.5,    // Lose 0.5% health per second when not at base
    HUNGER_DECAY_RATE: 0.25,   // Lose 0.25% hunger per second
    
    // Movement and stamina
    MOVE_STAMINA_COST: 5,      // Stamina cost per move
    STAMINA_REGEN_RATE: 2,     // Gain 2% stamina per second when not moving
    
    // Recovery rates at base camp (per second)
    BASE_HEALTH_REGEN: 1,      // Gain 1% health per second at base
    BASE_HUNGER_REGEN: 0.5,    // Gain 0.5% hunger per second at base
    BASE_STAMINA_REGEN: 3,     // Gain 3% stamina per second at base
    
    // Canvas dimensions
    CANVAS_WIDTH: 450,
    CANVAS_HEIGHT: 450
};

// Terrain Types Configuration
export const TERRAIN_TYPES = {
    NORMAL_SNOW: {
        name: "Normal Snow",
        color: "#FFFFFF",
        staminaCost: 5,
        passable: true,
        description: "A relatively firm snowpack that allows for steady progress.",
        quote: "The surface here is even, the snow packed firm beneath our feet."
    },
    DEEP_SNOW: {
        name: "Deep Snow",
        color: "#CCCCCC",
        staminaCost: 8,
        passable: true,
        description: "Loose, deep snow that drains stamina more quickly.",
        quote: "Each step sinks deep into the powder, making progress exhausting."
    },
    CLIFF: {
        name: "Cliff",
        color: "#666666",
        staminaCost: 15,
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
        color: "#CCE5FF",
        staminaCost: 3,
        healthRisk: 0.2,
        passable: true,
        description: "Smooth ice that's easy to traverse but dangerously cold.",
        quote: "The ice stretches out like polished glass, beautiful but bitter cold."
    }
};