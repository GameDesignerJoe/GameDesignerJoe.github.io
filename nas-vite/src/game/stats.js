// src/game/stats.js

import { WeatherManager } from './weather.js';
import { DebugManager } from './debug.js';
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';

// Stats system constants
export const STATS = {
    MAX_VALUE: 100,
    HEALTH_DECAY: 0.5,    // % per second
    HUNGER_DECAY: 0.0,   // % per second 0.25
    MOVE_STAMINA_COST: 5,
    STAMINA_REGEN: 5      // % per second 0.8
};

export const BASE_HEALING = {
    HEALTH_REGEN: 1,    // % per second
    HUNGER_REGEN: 0.5,  // % per second
    STAMINA_REGEN: 3    // % per second
};

// Starvation system
export const STARVATION_THRESHOLDS = {
    75: "Your stomach gnaws with emptiness, making each step a struggle.",
    50: "The hunger is all-consuming now, your thoughts growing dim like the Antarctic twilight.",
    25: "Your body cannibalizes itself, strength fading with each painful heartbeat.",
    10: "Death's cold embrace feels warmer now than this endless, gnawing emptiness."
};

// Track shown starvation messages
export let shownStarvationThresholds = new Set();
window.shownStarvationThresholds = shownStarvationThresholds;

// Stats timing
let lastStatUpdate = Date.now();
export let lastMoveTime = Date.now();  // We export this because movement.js will need it

// Stats state
export const stats = {
    health: STATS.MAX_VALUE,
    stamina: STATS.MAX_VALUE,
    hunger: STATS.MAX_VALUE
};

export const StatsManager = {
    updateStats() {
        // Only exit if health is zero, not if hunger is zero
        if (!gameRunning || gameWon || stats.health <= 0) return;

        const now = Date.now();
        const deltaTime = (now - lastStatUpdate) / 1000;

        // Apply weather effects if active
        if (WEATHER.state.whiteoutActive) {
            stats.health = Math.max(0, stats.health - 
                (STATS.HEALTH_DECAY * WEATHER.CONFIG.WHITEOUT.HEALTH_DECAY_MULTIPLIER * deltaTime));
        } else if (WEATHER.state.blizzardActive) {
            stats.health = Math.max(0, stats.health - 
                (STATS.HEALTH_DECAY * WEATHER.CONFIG.BLIZZARD.HEALTH_DECAY_MULTIPLIER * deltaTime));
        }

        lastStatUpdate = now;

        // Check current terrain for effects
        const currentHex = document.querySelector(`polygon[data-q="${playerPosition.q}"][data-r="${playerPosition.r}"]`);
        const currentTerrain = currentHex ? TERRAIN_TYPES[currentHex.getAttribute('data-terrain')] : null;

        // Check if at base camp
        const atBaseCamp = playerPosition.q === baseCamp.q && playerPosition.r === baseCamp.r;
        
        if (atBaseCamp) {
            this.applyBaseCampHealing(deltaTime);
        } else {
            this.applyNormalDecay(deltaTime, currentTerrain);
        }
        
        // Update stats display after all calculations
        this.updateStatsDisplay();
        this.checkDeathCondition();
    },

    clearStarvationThresholds() {
        shownStarvationThresholds.clear();
    },

    getShownStarvationThresholds() {
        return shownStarvationThresholds;
    },

    applyBaseCampHealing(deltaTime) {
        stats.health = Math.min(STATS.MAX_VALUE, stats.health + BASE_HEALING.HEALTH_REGEN * deltaTime);
        stats.hunger = Math.min(STATS.MAX_VALUE, stats.hunger + BASE_HEALING.HUNGER_REGEN * deltaTime);
        stats.stamina = Math.min(STATS.MAX_VALUE, stats.stamina + BASE_HEALING.STAMINA_REGEN * deltaTime);

        // Reset starvation thresholds if health recovers above 75%
        if (stats.health > 75 && stats.hunger > 0) {
            shownStarvationThresholds.clear();
        }
    },

    applyNormalDecay(deltaTime, currentTerrain) {
        stats.health = Math.max(0, stats.health - STATS.HEALTH_DECAY * deltaTime);
        
        if (currentTerrain?.healthRisk) {
            stats.health = Math.max(0, stats.health - (currentTerrain.healthRisk * 100 * deltaTime));
        }
        
        const timeSinceLastMove = (Date.now() - lastMoveTime) / 1000;
        if (timeSinceLastMove > 0.5) {
            stats.stamina = Math.min(STATS.MAX_VALUE, 
                stats.stamina + STATS.STAMINA_REGEN * deltaTime);
        }
    },

    updateStatsDisplay() {
        stats.health = Math.max(0, stats.health);
        stats.stamina = Math.max(0, stats.stamina);
        stats.hunger = Math.max(0, stats.hunger);
        
        document.getElementById('health-bar').style.width = `${stats.health}%`;
        document.getElementById('stamina-bar').style.width = `${stats.stamina}%`;
        document.getElementById('hunger-bar').style.width = `${stats.hunger}%`;
    },

    checkDeathCondition() {
        // Always check health first, since zero health means death regardless of hunger
        if (stats.health <= 0) {
            console.log('Death condition triggered'); 
            if (!gameRunning) return true; // Don't trigger death multiple times
            gameRunning = false;
            if (stats.hunger <= 0) {
                this.handleDeath("Starvation claims another victim. Your frozen body becomes one with the endless white of Antarctica.");
            } else {
                this.handleDeath("The bitter cold claims another victim. Your journey ends here, in the endless white of Antarctica.");
            }
            return true;
        }
    
        // Handle hunger warnings, but only if we're still alive
        if (stats.hunger <= 0) {
            const healthPercent = Math.floor(stats.health);
            
            for (const threshold of [75, 50, 25, 10]) {
                if (healthPercent <= threshold && !shownStarvationThresholds.has(threshold)) {
                    MessageManager.showPlayerMessage(STARVATION_THRESHOLDS[threshold], MESSAGE_TYPES.STATUS);
                    shownStarvationThresholds.add(threshold);
                    break;
                }
            }
            return true;
        }
        return false;
    },

    handleDeath(message) {
        console.log('Handling death...');
        // Stop the game
        window.gameRunning = false;
        
        // Clean up any active weather
        WeatherManager.resetWeatherState();
    
        // Change player marker to dark blue
        const deadColor = window.PLAYER_COLORS?.DEAD || "#000066";  // Fallback color if undefined
    player.setAttribute("fill", deadColor);
        
        // Show death message in game message area
        document.getElementById('game-message').className = 'narrative';
        document.getElementById('game-message').innerHTML = 
            "The freezing wind howls no more of glory or challenge, for it has claimed its prize. In this vast Antarctic expanse that once promised immortality, you have found only that eternal rest beneath the ice.";
        
        // Show and setup restart button
        const restartBtn = document.getElementById('restart-button');
        restartBtn.classList.remove('hidden');
        restartBtn.style.display = 'block';
        
        // Clear any existing event listeners and create new button
        const newRestartBtn = restartBtn.cloneNode(true);
        restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
        
        // Add new event listener
        newRestartBtn.addEventListener('click', () => {
            if (typeof window.restartGame === 'function') {
                window.restartGame();
                MessageManager.clearTerrainMessage();
            } else {
                console.error('Restart game function not found');
            }
        });
    }
};