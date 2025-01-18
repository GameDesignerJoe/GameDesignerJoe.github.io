// Game Configuration
export const GAME_CONFIG = {
    // Grid settings
    HEX_SIZE: 40,
    GRID_WIDTH: 10,
    GRID_HEIGHT: 20,
    
    // Visual settings
    PLAYER_CIRCLE_SIZE: 0.4,
    
    // Colors
    COLORS: {
        PLAYER: "green",
        BASE_CAMP: "gold",
        SOUTH_POLE: "#663399",
        FOG_OF_WAR: "white",
        HEX_BORDER: "white"
    },

    // Starting stats
    STARTING_STATS: {
        HEALTH: 100,
        STAMINA: 100,
        HUNGER: 100
    },
    
    // Stats decay rates (per second)
    HEALTH_DECAY_RATE: 1,
    HUNGER_DECAY_RATE: 0.5,
    
    // Movement and stamina
    MOVE_STAMINA_COST: 5,
    STAMINA_REGEN_RATE: 3,
    
    // Recovery rates at base camp (per second)
    BASE_HEALTH_REGEN: 1,
    BASE_HUNGER_REGEN: 0.5,
    BASE_STAMINA_REGEN: 3,
    
    // Canvas dimensions
    CANVAS_WIDTH: 450,
    CANVAS_HEIGHT: 450
}

// Terrain Types Configuration
export const TERRAIN_TYPES = {
    NORMAL_SNOW: {
        name: "Normal Snow",
        color: "#B9D9EB",
        staminaCost: 5,
        passable: true,
        description: "A relatively firm snowpack that allows for steady progress.",
        quote: "The surface here is even, the snow packed firm beneath our feet."
    },
    DEEP_SNOW: {
        name: "Deep Snow",
        color: "#89CFF0",
        staminaCost: 8,
        passable: true,
        description: "Loose, deep snow that drains stamina more quickly.",
        quote: "Each step sinks deep into the powder, making progress exhausting."
    },
    CLIFF: {
        name: "Cliff",
        color: "#385F71",
        staminaCost: 15,
        passable: true,
        oneWay: true,
        description: "A steep descent that can only be traversed downward.",
        quote: "A sheer drop looms before us. Once we descend, there's no climbing back up."
    },
    CREVASSE: {
        name: "Crevasse",
        color: "#1B4B7C",
        passable: false,
        description: "A deep crack in the ice. Impossible to cross without proper equipment.",
        quote: "A yawning chasm splits the ice, far too wide to risk crossing."
    },
    ICE_FIELD: {
        name: "Ice Field",
        color: "#7CB9E8",
        staminaCost: 3,
        healthRisk: 0.2,
        passable: true,
        description: "Smooth ice that's easy to traverse but dangerously cold.",
        quote: "The ice stretches out like polished glass, beautiful but bitter cold."
    }
}