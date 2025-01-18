import { GAME_CONFIG, TERRAIN_TYPES } from '../../config/config.js'
import { baseCamp, southPole, hexHelpers } from './grid.js'

function getHexTerrainType(hex) {    
    if (hexHelpers.toString(hex) === hexHelpers.toString(baseCamp)) {
        return {
            name: "Base Camp",
            color: GAME_CONFIG.COLORS.BASE_CAMP,
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "A safe haven where you can rest and recover.",
            quote: "The familiar sight of base camp brings a sense of relief."
        }
    }
    
    if (hexHelpers.toString(hex) === hexHelpers.toString(southPole)) {
        return {
            name: "South Pole",
            color: GAME_CONFIG.COLORS.SOUTH_POLE,
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "The ultimate goal of your expedition.",
            quote: "Could this be it? The South Pole itself?"
        }
    }

    if (!hex.terrain) {
        console.warn('Hex has no terrain assigned:', hex)
        return TERRAIN_TYPES.NORMAL_SNOW
    }
    
    return TERRAIN_TYPES[hex.terrain] || TERRAIN_TYPES.NORMAL_SNOW
}

function initializeHexTerrain(hex) {    
    if (hexHelpers.toString(hex) === hexHelpers.toString(baseCamp)) {
        hex.terrain = 'BASE_CAMP'
        return
    }
    if (hexHelpers.toString(hex) === hexHelpers.toString(southPole)) {
        hex.terrain = 'SOUTH_POLE'
        return
    }

    const weights = {
        NORMAL_SNOW: 50,
        DEEP_SNOW: 25,
        ICE_FIELD: 15,
        CLIFF: 7,
        CREVASSE: 3
    }

    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    let random = Math.random() * total

    for (const [terrain, weight] of Object.entries(weights)) {
        random -= weight
        if (random <= 0) {
            hex.terrain = terrain
            break
        }
    }
}

export {
    getHexTerrainType,
    initializeHexTerrain
}