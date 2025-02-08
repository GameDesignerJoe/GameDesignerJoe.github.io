// src/state/game/playerState.js

import { PLAYER_STATS, UI } from '../../config/constants.js';

export const PlayerState = {
    position: { q: 0, r: 0 },
    lastMoveTime: Date.now(),
    lastStatUpdate: Date.now(),
    
    // Add camping and resting states
    isCamping: false,
    isResting: false,
    campingInterval: null,
    restingInterval: null,
    
    stats: {
        health: PLAYER_STATS.MAX_VALUE,
        stamina: PLAYER_STATS.MAX_VALUE,
        food: PLAYER_STATS.MAX_VALUE  // Renamed from food
    },

    inventory: {
        fuel: 100,
        tools: 100
    },

    // Camping configuration
    campingConfig: {
        staminaRecoveryRate: 20,      // 5x normal stamina recovery
        fullHealthStaminaMultiplier: 40  // 3x faster than normal camping stamina recovery
    },

    // Methods
    updatePosition(newPos) {
        if (this.isCamping) {
            this.stopCamping();
        }
        if (this.isResting) {
            this.stopResting();
        }
        this.position = { ...newPos };
        this.lastMoveTime = Date.now();
    },

    updateStats(updates) {
        Object.assign(this.stats, updates);
        this.lastStatUpdate = Date.now();
    },

    resetStats() {
        this.stats = {
            health: PLAYER_STATS.MAX_VALUE,
            stamina: PLAYER_STATS.MAX_VALUE,
            food: PLAYER_STATS.MAX_VALUE
        };
        this.lastStatUpdate = Date.now();
        this.stopCamping();
    },

    consumeStamina(amount) {
        this.stats.stamina = Math.max(0, this.stats.stamina - amount);
    },

    consumeFood(amount) {
        this.stats.food = Math.max(0, this.stats.food - amount);
    },

    heal(amount) {
        this.stats.health = Math.min(
            PLAYER_STATS.MAX_VALUE,
            this.stats.health + amount
        );
    },

    isDead() {
        return this.stats.health <= 0;
    },

    // Helper method to check for tent
    hasTent() {
        return Array.from(window.gameStore.packing.selectedItems.values())
            .some(item => item.name === "Canvas Tent");
    },

    // Camping Methods
    startCamping() {
        if (this.isCamping || this.isResting) return false;
        
        this.isCamping = true;
        // Update game state camping
        if (window.gameStore?.game) {
            window.gameStore.game.isCamping = true;
        }
        // Update food button visibility
        const gridManager = window.gridManager;
        if (gridManager && typeof gridManager.updateFoodButton === 'function') {
            gridManager.updateFoodButton();
        }
        
        this.campingInterval = setInterval(() => {
            // Calculate stamina recovery rate based on health status
            const isHealthFull = this.stats.health >= PLAYER_STATS.MAX_VALUE;
            const baseStaminaGain = this.campingConfig.staminaRecoveryRate;
            const staminaGain = isHealthFull ? 
                baseStaminaGain * this.campingConfig.fullHealthStaminaMultiplier :
                baseStaminaGain;

            // Recover stamina
            this.stats.stamina = Math.min(
                PLAYER_STATS.MAX_VALUE,
                this.stats.stamina + staminaGain
            );
        }, 3000);

        return true;
    },

    stopCamping() {
        if (!this.isCamping) return false;
        
        this.isCamping = false;
        // Update game state camping
        if (window.gameStore?.game) {
            window.gameStore.game.isCamping = false;
        }
        // Update food button visibility
        const gridManager = window.gridManager;
        if (gridManager && typeof gridManager.updateFoodButton === 'function') {
            gridManager.updateFoodButton();
        }
        
        if (this.campingInterval) {
            clearInterval(this.campingInterval);
            this.campingInterval = null;
        }
        return true;
    },

    startResting() {
        if (this.isResting || this.isCamping) return false;
        
        this.isResting = true;
        // Update game state
        if (window.gameStore?.game) {
            window.gameStore.game.isResting = true;
        }
        // Update food button visibility
        const gridManager = window.gridManager;
        if (gridManager && typeof gridManager.updateFoodButton === 'function') {
            gridManager.updateFoodButton();
        }
        
        this.restingInterval = setInterval(() => {
            // Calculate stamina recovery rate based on health status
            const isHealthFull = this.stats.health >= PLAYER_STATS.MAX_VALUE;
            const baseStaminaGain = this.campingConfig.staminaRecoveryRate * 0.5; // Half as effective
            const staminaGain = isHealthFull ? 
                baseStaminaGain * this.campingConfig.fullHealthStaminaMultiplier :
                baseStaminaGain;

            // Recover stamina
            this.stats.stamina = Math.min(
                PLAYER_STATS.MAX_VALUE,
                this.stats.stamina + staminaGain
            );
        }, 3000);

        return true;
    },

    stopResting() {
        if (!this.isResting) return false;
        
        this.isResting = false;
        // Update game state
        if (window.gameStore?.game) {
            window.gameStore.game.isResting = false;
        }
        // Update food button visibility
        const gridManager = window.gridManager;
        if (gridManager && typeof gridManager.updateFoodButton === 'function') {
            gridManager.updateFoodButton();
        }
        
        if (this.restingInterval) {
            clearInterval(this.restingInterval);
            this.restingInterval = null;
        }
        return true;
    },

    toggleCamping() {
        // If already camping or resting, stop it
        if (this.isCamping) {
            return this.stopCamping();
        } else if (this.isResting) {
            return this.stopResting();
        }
        
        // Check for tent and start appropriate action
        if (this.hasTent()) {
            return this.startCamping();
        } else {
            return this.startResting();
        }
    }
};

// Bind all methods to PlayerState
Object.getOwnPropertyNames(PlayerState)
    .filter(prop => typeof PlayerState[prop] === 'function')
    .forEach(method => {
        PlayerState[method] = PlayerState[method].bind(PlayerState);
    });

export default PlayerState;
