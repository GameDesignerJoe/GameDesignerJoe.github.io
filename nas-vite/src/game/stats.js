import { GAME_CONFIG } from '../config/config.js'
import { gameState } from './core/state.js'
import { updateGameMessage } from './ui/messages.js'

function updateStats() {
    if (!gameState.gameRunning) return

    const now = Date.now()
    const deltaTime = (now - gameState.lastStatUpdate) / 1000
    gameState.lastStatUpdate = now

    if (gameState.playerHex.toString() === gameState.baseCamp.toString()) {
        // Recovery at base camp
        gameState.health = Math.min(100, gameState.health + GAME_CONFIG.BASE_HEALTH_REGEN * deltaTime)
        gameState.hunger = Math.min(100, gameState.hunger + GAME_CONFIG.BASE_HUNGER_REGEN * deltaTime)
        gameState.stamina = Math.min(100, gameState.stamina + GAME_CONFIG.STAMINA_REGEN_RATE * deltaTime)
    } else {
        // Regular decay
        gameState.health = Math.max(0, gameState.health - GAME_CONFIG.HEALTH_DECAY_RATE * deltaTime)
        gameState.hunger = Math.max(0, gameState.hunger - GAME_CONFIG.HUNGER_DECAY_RATE * deltaTime)
        
        // Only regenerate stamina if we haven't moved recently
        const timeSinceLastMove = (now - gameState.lastMoveTime) / 1000
        if (timeSinceLastMove > 0.5) {
            gameState.stamina = Math.min(100, gameState.stamina + GAME_CONFIG.STAMINA_REGEN_RATE * deltaTime)
        }
    }

    // Check death conditions
    if (gameState.hunger <= 0) {
        updateGameMessage("Your strength fails as hunger overtakes you. Your frozen body will remain here, a grim testament to the merciless Antarctic wasteland.", true)
        restartGame()
        return
    }
    if (gameState.health <= 0) {
        updateGameMessage("The bitter cold claims another victim. Your journey ends here, in the endless white of Antarctica.", true)
        restartGame()
        return
    }

    updateStatsDisplay()
}

function updateStatsDisplay() {
    const healthBar = document.getElementById("health-bar")
    const staminaBar = document.getElementById("stamina-bar")
    const hungerBar = document.getElementById("hunger-bar")
    
    if (healthBar) healthBar.style.width = `${Math.max(0, Math.min(100, gameState.health))}%`
    if (staminaBar) staminaBar.style.width = `${Math.max(0, Math.min(100, gameState.stamina))}%`
    if (hungerBar) hungerBar.style.width = `${Math.max(0, Math.min(100, gameState.hunger))}%`
}

function restartGame() {
    gameState.stamina = GAME_CONFIG.STARTING_STATS.STAMINA
    gameState.health = GAME_CONFIG.STARTING_STATS.HEALTH
    gameState.hunger = GAME_CONFIG.STARTING_STATS.HUNGER
    gameState.playerHex = gameState.baseCamp
    gameState.southPoleVisited = false
    gameState.gameRunning = true
    gameState.visitedHexes = new Set([gameState.baseCamp.toString()])
    gameState.lastStatUpdate = Date.now()
    gameState.lastMoveTime = Date.now()
    
    updateGameMessage("Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.", true)
    document.getElementById('restart-button').classList.add('hidden')
}

export {
    updateStats,
    restartGame
}