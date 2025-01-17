import { GAME_CONFIG } from '../config/config.js'
import { grid, playerStartHex, hexHelpers } from './core/grid.js'
import { gameState, viewport } from './core/state.js'
import { initializeHexTerrain } from './core/terrain.js'
import { updateViewport } from './core/viewport.js'
import { handlePointerEvent, addEventListeners } from './input.js'
import { updateGameMessage } from './ui/messages.js'
import { renderGame } from './render.js'

function initGame(canvas) {
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize canvas
    canvas.width = GAME_CONFIG.CANVAS_WIDTH
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT

    // Initialize game state
    gameState.playerHex = playerStartHex
    grid.forEach(initializeHexTerrain)

    // Use hexHelpers instead of direct method calls
    const point = hexHelpers.toPoint(playerStartHex)
    viewport.x = canvas.width / 2 - point.x
    viewport.y = canvas.height / 2 - point.y

    // Initialize game message
    updateGameMessage("Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.", true)

    // Add event listeners
    addEventListeners(canvas)

    // Start game loop
    function gameLoop(timestamp) {
        renderGame(ctx, timestamp)
        requestAnimationFrame(gameLoop)
    }

    requestAnimationFrame(gameLoop)
}

export { initGame }