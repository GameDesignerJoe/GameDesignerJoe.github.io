// state.js
import { GAME_CONFIG } from '../../config/config.js'
import { playerStartHex, baseCamp, hexHelpers } from './grid.js'

// Game state
const gameState = {
    playerHex: playerStartHex,
    selectedHex: null,
    hoveredHex: null,
    baseCamp: baseCamp,
    southPoleVisited: false,
    gameRunning: true,
    stamina: GAME_CONFIG.STARTING_STATS.STAMINA,
    health: GAME_CONFIG.STARTING_STATS.HEALTH,
    hunger: GAME_CONFIG.STARTING_STATS.HUNGER,
    lastStatUpdate: Date.now(),
    lastMoveTime: Date.now(),
    visitedHexes: new Set([hexHelpers.toString(playerStartHex)]),
    viewport: {
        x: 0,
        y: 0
    }
}

// Timing state
const timing = {
    lastRenderTime: 0,
    lastHoverCheck: 0
}

// Viewport state (moved from a separate export)
const viewport = gameState.viewport

export {
    gameState,
    timing,
    viewport
}