// src/state/game/playerState.js

import { PLAYER_STATS, UI } from '../../config/constants.js';

export const PlayerState = {
    position: { q: 0, r: 0 },
    lastMoveTime: Date.now(),
    lastStatUpdate: Date.now(),
    
    // Add camping state
    isCamping: false,
    campingInterval: null,
    
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

    // Camping Methods
    startCamping() {
        if (this.isCamping) return false;
        
        // Check if player has Canvas Tent
        const hasTent = Array.from(window.gameStore.packing.selectedItems.values())
            .some(item => item.name === "Canvas Tent");
        
        if (!hasTent) {
            window.gameStore.messages.showPlayerMessage(
                "You need a Canvas Tent to make camp",
                UI.MESSAGE_TYPES.STATUS
            );
            return false;
        }
        
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
        return true;  // Return true to indicate successful stop
    },

    toggleCamping() {
        if (this.isCamping) {
            return this.stopCamping();  // Will return true when successfully stopped
        } else {
            return this.startCamping(); // Already returns true/false
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
