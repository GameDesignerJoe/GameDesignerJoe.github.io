import { GAME_CONFIG } from '../config/config.js'
import { gameState, timing } from './core/state.js'
import { grid, hexHelpers } from './core/grid.js'
import { getHexTerrainType } from './core/terrain.js'
import { updateViewport } from './core/viewport.js'

function drawHex(ctx, x, y, hex, overrideColor = null) {
    ctx.beginPath()
    const corners = hexHelpers.corners(hex)
    corners.forEach((corner, index) => {
        const cornerX = x + corner.x
        const cornerY = y + corner.y
        if (index === 0) ctx.moveTo(cornerX, cornerY)
        else ctx.lineTo(cornerX, cornerY)
    })
    ctx.closePath()
    
    let color = overrideColor
    if (!color) {
        if (!isHexVisible(hex)) {
            color = GAME_CONFIG.COLORS.FOG_OF_WAR
        } else {
            const terrain = getHexTerrainType(hex)
            color = terrain.color
        }
    }

    const isAdjacent = hexHelpers.distance(gameState.playerHex, hex) === 1
    if (hex === gameState.hoveredHex && isAdjacent && gameState.stamina >= GAME_CONFIG.MOVE_STAMINA_COST) {
        color = adjustColor(color, -30)
    }
    
    ctx.fillStyle = color
    ctx.fill()

    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER
    ctx.lineWidth = 1
    ctx.stroke()
    
    if (gameState.selectedHex && hexHelpers.toString(hex) === hexHelpers.toString(gameState.selectedHex)) {
        ctx.save()
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
    }
}

function isHexVisible(hex) {
    if (hexHelpers.toString(hex) === hexHelpers.toString(gameState.baseCamp)) {
        return true
    }
    return hexHelpers.distance(gameState.playerHex, hex) <= 1 || 
           gameState.visitedHexes.has(hexHelpers.toString(hex))
}

function adjustColor(color, amount) {
    if (color.startsWith('#')) {
        color = color.slice(1)
    } else if (color === 'lightgray') {
        return `rgb(${169 + amount}, ${169 + amount}, ${169 + amount})`
    } else if (color === 'gray') {
        return `rgb(${128 + amount}, ${128 + amount}, ${128 + amount})`
    }
    return color
}

function renderGame(ctx, timestamp) {
    if (timestamp - timing.lastRenderTime < 16) {
        requestAnimationFrame(() => renderGame(ctx, timestamp))
        return
    }
    timing.lastRenderTime = timestamp
    
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "#1B4B7C"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
    
    updateViewport(ctx)

    grid.forEach(hex => {
        const point = hexHelpers.toPoint(hex)
        drawHex(ctx, point.x, point.y, hex)
    })

    const playerPoint = hexHelpers.toPoint(gameState.playerHex)
    const playerCenter = hexHelpers.center(gameState.playerHex)
    ctx.beginPath()
    ctx.arc(
        playerPoint.x + playerCenter.x, 
        playerPoint.y + playerCenter.y,
        GAME_CONFIG.HEX_SIZE * GAME_CONFIG.PLAYER_CIRCLE_SIZE, 
        0, 
        Math.PI * 2
    )
    ctx.fillStyle = GAME_CONFIG.COLORS.PLAYER
    ctx.fill()
    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER
    ctx.stroke()
}

export { renderGame }