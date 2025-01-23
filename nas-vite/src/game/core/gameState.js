// src/game/core/gameState.js
const isDevelopment = true;

// Player related constants - removed export
const PLAYER_STATS = {
    MAX_VALUE: 100,
    MIN_VALUE: 0,
    MOVE_STAMINA_COST: 10,
    HEAL_RATE: 0.5,             // Default health drop rate
    STAMINA_RECOVERY_RATE: 0.4,
    HUNGER_DECAY_RATE: 0.5
};

// Base configuration for game mechanics - removed export
const GAME_CONFIG = {
    GRID_SIZE: 10,
    BASE_HEAL_AMOUNT: 0.1,
    STARVATION_THRESHOLDS: new Set([75, 50, 25, 10]),
    FOG_OF_WAR: true
};

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

// Special locations configuration - removed export
const SPECIAL_LOCATIONS = {
    BASE_CAMP: {
        name: "Base Camp",
        color: "gold",     // Changed to gold
        staminaCost: 0,
        passable: true,
        quote: "The relative safety of base camp offers a moment of respite."
    },
    SOUTH_POLE: {
        name: "South Pole",
        color: "#000080",
        staminaCost: 5,
        passable: true,
        quote: "Could this be it? The goal of your expedition stands before you."
    }
};

// Core game state object
const GameState = {
    // Game status
    game: {
        won: false,
        running: true,
        difficultyLevel: 1,
        timeElapsed: 0,
        lastUpdate: Date.now()
    },

    // Player state
    player: {
        position: { q: 0, r: 0 },
        lastMoveTime: Date.now(),
        lastStatUpdate: Date.now(),
        stats: {
            health: PLAYER_STATS.MAX_VALUE,
            stamina: PLAYER_STATS.MAX_VALUE,
            hunger: PLAYER_STATS.MAX_VALUE
        },
        inventory: {
            food: 100,
            fuel: 100,
            tools: 100
        }
    },

    // World state
    world: {
        southPole: null,
        southPoleSpotted: false,
        southPoleVisited: false,
        baseCamp: null,
        selectedHex: null,
        visibleHexes: new Set(),
        visitedHexes: new Set(),
        terrain: {},  // Will be populated with hex coordinates and their terrain types
        shownThresholds: new Set()  // Track shown starvation thresholds
    },

    // Methods
    updatePlayerPosition(newPos) {
        this.player.position = { ...newPos };
        this.player.lastMoveTime = Date.now();
        this.world.visitedHexes.add(`${newPos.q},${newPos.r}`);
    },

    updatePlayerStats(statUpdates) {
        Object.assign(this.player.stats, statUpdates);
        this.player.lastStatUpdate = Date.now();
    },

    resetGame() {
        this.game.won = false;
        this.game.running = true;
        this.game.timeElapsed = 0;
        this.player.stats = {
            health: PLAYER_STATS.MAX_VALUE,
            stamina: PLAYER_STATS.MAX_VALUE,
            hunger: PLAYER_STATS.MAX_VALUE
        };
        this.world.southPoleSpotted = false;
        this.world.southPoleVisited = false;
        this.world.visitedHexes.clear();
        this.world.shownThresholds.clear();
        if (this.world.baseCamp) {
            this.world.visitedHexes.add(`${this.world.baseCamp.q},${this.world.baseCamp.r}`);
        }
    },

    hasShownThreshold(threshold) {
        return this.world.shownThresholds.has(threshold);
    },

    markThresholdShown(threshold) {
        this.world.shownThresholds.add(threshold);
    }
};

// Bind all methods to GameState
Object.getOwnPropertyNames(GameState)
    .filter(prop => typeof GameState[prop] === 'function')
    .forEach(method => {
        GameState[method] = GameState[method].bind(GameState);
    });

// For development, we'll skip freezing to allow for easier debugging
if (!isDevelopment) {
    Object.freeze(PLAYER_STATS);
    Object.freeze(GAME_CONFIG);
    Object.freeze(TERRAIN_TYPES);
    Object.freeze(SPECIAL_LOCATIONS);
}

// Single export of all needed items
export { 
    GameState as default,
    GameState,
    PLAYER_STATS,
    GAME_CONFIG,
    TERRAIN_TYPES,
    SPECIAL_LOCATIONS 
};