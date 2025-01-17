import { GAME_CONFIG } from '../../config/config.js'
import { gameState } from './state.js'
import { grid, hexHelpers } from './grid.js'

function calculateViewportPosition(canvas) {
    const playerPoint = hexHelpers.toPoint(gameState.playerHex)
    
    let targetX = canvas.width / 2 - playerPoint.x
    let targetY = canvas.height / 2 - playerPoint.y
    
    const margin = GAME_CONFIG.HEX_SIZE * 2
    
    const gridBounds = {
        minX: Math.min(...grid.map(hex => hexHelpers.toPoint(hex).x)),
        maxX: Math.max(...grid.map(hex => hexHelpers.toPoint(hex).x)),
        minY: Math.min(...grid.map(hex => hexHelpers.toPoint(hex).y)),
        maxY: Math.max(...grid.map(hex => hexHelpers.toPoint(hex).y))
    }
    
    const rightBoundary = canvas.width - gridBounds.maxX - margin
    const leftBoundary = -gridBounds.minX + margin
    const bottomBoundary = canvas.height - gridBounds.maxY - margin
    const topBoundary = -gridBounds.minY + margin
    
    if (gridBounds.maxX - gridBounds.minX + margin * 2 > canvas.width) {
        targetX = Math.min(leftBoundary, Math.max(rightBoundary, targetX))
    }
    
    if (gridBounds.maxY - gridBounds.minY + margin * 2 > canvas.height) {
        targetY = Math.min(topBoundary, Math.max(bottomBoundary, targetY))
    }
    
    return { x: targetX, y: targetY }
}

function updateViewport(ctx) {
    const { x, y } = calculateViewportPosition(ctx.canvas)
    gameState.viewport.x = gameState.viewport.x + (x - gameState.viewport.x) * 0.1
    gameState.viewport.y = gameState.viewport.y + (y - gameState.viewport.y) * 0.1
    ctx.setTransform(1, 0, 0, 1, Math.round(gameState.viewport.x), Math.round(gameState.viewport.y))
}

export {
    updateViewport
}