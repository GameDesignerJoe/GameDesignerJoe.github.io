// src/state/game/playerState.js

import { PLAYER_STATS } from '../../config/constants.js';

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
        foodDrainInterval: 5000,    // 5 seconds
        foodDrainAmount: 10,        // 10% per interval
        healthRegainAmount: 20,     // 20% per food drain
        staminaRecoveryRate: 5,      // 5x normal stamina recovery
        fullHealthFoodRate: 0.05,   // 1/4 of normal food consumption
        fullHealthStaminaMultiplier: 5  // 3x faster than normal camping stamina recovery
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
        
        this.isCamping = true;
        this.campingInterval = setInterval(() => {
            // Determine if health is full
            const isHealthFull = this.stats.health >= PLAYER_STATS.MAX_VALUE;
            
            // Calculate food drain amount based on health status
            const foodDrainAmount = isHealthFull ? 
                this.campingConfig.foodDrainAmount * this.campingConfig.fullHealthFoodRate :
                this.campingConfig.foodDrainAmount;
            
            // Drain food
            this.consumeFood(foodDrainAmount);

            // Only heal if not at full health and have food
            if (!isHealthFull && this.stats.food > 0) {
                this.heal(this.campingConfig.healthRegainAmount);
            }

            // Calculate stamina recovery rate based on health status
            const baseStaminaGain = this.campingConfig.staminaRecoveryRate;
            const staminaGain = isHealthFull ? 
                baseStaminaGain * this.campingConfig.fullHealthStaminaMultiplier :
                baseStaminaGain;

            // Recover stamina
            this.stats.stamina = Math.min(
                PLAYER_STATS.MAX_VALUE,
                this.stats.stamina + staminaGain
            );

        }, this.campingConfig.foodDrainInterval);

        return true;
    },

    stopCamping() {
        if (!this.isCamping) return false;
        
        this.isCamping = false;
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