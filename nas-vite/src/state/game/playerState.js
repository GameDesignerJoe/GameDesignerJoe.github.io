// src/state/game/playerState.js

import { PLAYER_STATS } from '../../config/constants.js';

export const PlayerState = {
    position: { q: 0, r: 0 },
    lastMoveTime: Date.now(),
    lastStatUpdate: Date.now(),
    
    stats: {
        health: PLAYER_STATS.MAX_VALUE,
        stamina: PLAYER_STATS.MAX_VALUE,
        hunger: PLAYER_STATS.MAX_VALUE
    },

    inventory: {
        food: 100,
        fuel: 100,
        tools: 100
    },

    // Methods
    updatePosition(newPos) {
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
            hunger: PLAYER_STATS.MAX_VALUE
        };
        this.lastStatUpdate = Date.now();
    },

    consumeStamina(amount) {
        this.stats.stamina = Math.max(0, this.stats.stamina - amount);
    },

    consumeFood(amount) {
        this.stats.hunger = Math.max(0, this.stats.hunger - amount);
    },

    heal(amount) {
        this.stats.health = Math.min(
            PLAYER_STATS.MAX_VALUE,
            this.stats.health + amount
        );
    },

    isDead() {
        return this.stats.health <= 0;
    }
};

// Bind all methods to PlayerState
Object.getOwnPropertyNames(PlayerState)
    .filter(prop => typeof PlayerState[prop] === 'function')
    .forEach(method => {
        PlayerState[method] = PlayerState[method].bind(PlayerState);
    });

export default PlayerState;