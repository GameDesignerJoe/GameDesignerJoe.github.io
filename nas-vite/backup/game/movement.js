import { GAME_CONFIG } from '../config/config.js'
import { gameState } from './core/state.js'
import { getHexTerrainType } from './core/terrain.js'
import { updateGameMessage } from './ui/messages.js'

function movePlayer(newHex) {
    if (!newHex || !gameState.gameRunning) return
    
    if (gameState.playerHex.distance(newHex) > 1) return
    
    const terrain = getHexTerrainType(newHex)
    
    if (gameState.stamina < terrain.staminaCost) {
        const staminaBar = document.getElementById("stamina-bar")
        staminaBar.classList.add("pulse-warning")
        setTimeout(() => {
            staminaBar.classList.remove("pulse-warning")
        }, 1500)
        return
    }

    gameState.playerHex = newHex
    gameState.visitedHexes.add(newHex.toString())
    gameState.stamina = Math.max(0, gameState.stamina - terrain.staminaCost)
    
    if (terrain.healthRisk) {
        gameState.health = Math.max(0, gameState.health - terrain.healthRisk * 100)
    }
    
    gameState.lastMoveTime = Date.now()

    checkLocations()
}

function checkLocations() {
    if (gameState.playerHex.toString() === gameState.southPole.toString() && !gameState.southPoleVisited) {
        gameState.southPoleVisited = true
        updateGameMessage("At last! Through bitter cold and endless white, you've reached the South Pole! You plant your flag in triumph, but your journey is far from over. You must now make the perilous trek back to base camp to tell the world.", true)
    } else if (gameState.playerHex.toString() === gameState.baseCamp.toString() && gameState.southPoleVisited) {
        updateGameMessage("Against all odds, you've done it! You've reached the South Pole and returned. Your name will be forever etched in the annals of exploration. Future generations will speak of your incredible feat.", true)
        gameState.gameRunning = false
        document.getElementById('restart-button').classList.remove('hidden')
    }
}

export { movePlayer }