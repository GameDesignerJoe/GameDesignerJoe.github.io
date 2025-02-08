// src/services/stats.js

import { gameStore } from '../state/store.js';
import perfMonitor from '../core/performanceMonitor.js';
import { PLAYER_STATS, UI } from '../config/constants.js';
import { WEATHER_CONFIG } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { RestartSystem } from '../core/restart.js';

export const StatsService = {
    restartSystem: null,  // Will be set during initialization

    init(restartSystem) {
        this.restartSystem = restartSystem;
    },

    // Cache for stats calculations
    _statsCache: {
        lastHealthUpdate: 0,
        lastStaminaUpdate: 0,
        lastFoodUpdate: 0,
        healthUpdateInterval: 50, // More frequent health updates for smoother depletion
        staminaUpdateInterval: 500, // Update stamina every 500ms
        foodUpdateInterval: 1000 // Update food every 1000ms
    },

    updateStats() {
        if (!gameStore.gameRunning || gameStore.gameWon) return;

        // Check for god mode - if active, ensure stats stay at max
        if (gameStore.debug.godModeActive || (window.DEBUG && window.DEBUG.godModeActive)) {
            const stats = gameStore.player.stats;
            stats.health = 100;
            stats.stamina = 100;
            stats.food = 100;
            this.updateStatsDisplay();
            return;
        }

        const currentTime = Date.now();
        
        // Update health on its interval
        if (currentTime - this._statsCache.lastHealthUpdate >= this._statsCache.healthUpdateInterval) {
            const deltaTime = (currentTime - this._statsCache.lastHealthUpdate) / 1000;
            this._statsCache.lastHealthUpdate = currentTime;

            // Check if at base camp
            const atBaseCamp = gameStore.playerPosition.q === gameStore.baseCamp.q && 
                             gameStore.playerPosition.r === gameStore.baseCamp.r;

            if (atBaseCamp) {
                this.handleBaseCampHealing(deltaTime);
            } else {
                this.handleFieldConditions(deltaTime);
            }

            // Check for death condition
            if (gameStore.player.stats.health <= 0) {
                this.handleDeath();
                return;
            }
        }

        // Update stamina on its interval
        if (currentTime - this._statsCache.lastStaminaUpdate >= this._statsCache.staminaUpdateInterval) {
            const deltaTime = (currentTime - this._statsCache.lastStaminaUpdate) / 1000;
            this._statsCache.lastStaminaUpdate = currentTime;

            // Update stamina recovery
            const timeSinceLastMove = (currentTime - gameStore.player.lastMoveTime) / 1000;
            if (timeSinceLastMove > 1) {
                const stats = gameStore.player.stats;
                stats.stamina = Math.min(
                    100,
                    stats.stamina + (PLAYER_STATS.STAMINA_RECOVERY_RATE * deltaTime)
                );
            }
        }

        // Update food on its interval
        if (currentTime - this._statsCache.lastFoodUpdate >= this._statsCache.foodUpdateInterval) {
            this._statsCache.lastFoodUpdate = currentTime;
            // Food updates can be less frequent since they're not as critical
            // Add food update logic here if needed
        }

        // Update display
        this.updateStatsDisplay();
    },

    handleBaseCampHealing(deltaTime) {
        const { stats } = gameStore.player;
        // At base camp: Heal everything at accelerated rate
        stats.health = Math.min(
            PLAYER_STATS.MAX_VALUE,
            stats.health + (PLAYER_STATS.HEAL_RATE * 3 * deltaTime)
        );
        stats.stamina = Math.min(
            PLAYER_STATS.MAX_VALUE,
            stats.stamina + (PLAYER_STATS.STAMINA_RECOVERY_RATE * 12 * deltaTime)
        );
        stats.food = Math.min(
            PLAYER_STATS.MAX_VALUE,
            stats.food + (PLAYER_STATS.FOOD_DECAY_RATE * 3 * deltaTime)
        );
    },

    handleFieldConditions(deltaTime) {
        // Add early return if god mode is active
        if (gameStore.debug.godModeActive || (window.DEBUG && window.DEBUG.godModeActive)) {
            return;
        }
        const { stats } = gameStore.player;
        let healthDecayMultiplier = 1;

        // Base health decay when not at base camp
        const BASE_HEALTH_DECAY = 2.25; // Base health loss per second

        // Calculate total weather protection from clothing (only count one of each type)
        const uniqueClothing = new Set();
        const protection = Array.from(gameStore.packing.selectedItems.values())
            .reduce((total, item) => {
                if (item.weatherProtection && !uniqueClothing.has(item.name)) {
                    uniqueClothing.add(item.name);
                    return total + item.weatherProtection;
                }
                return total;
            }, 0);

        // Apply weather effects and camping/resting reduction
        if (gameStore.weather.current.type === 'WHITEOUT') {
            if (gameStore.player.isCamping) {
                healthDecayMultiplier = WEATHER_CONFIG.WHITEOUT.healthDecayMultiplier * 0.3; // 70% reduction with tent
            } else if (gameStore.player.isResting) {
                healthDecayMultiplier = WEATHER_CONFIG.WHITEOUT.healthDecayMultiplier * 0.65; // 35% reduction without tent
            } else {
                healthDecayMultiplier = WEATHER_CONFIG.WHITEOUT.healthDecayMultiplier;
            }
        } else if (gameStore.weather.current.type === 'BLIZZARD') {
            if (gameStore.player.isCamping) {
                healthDecayMultiplier = WEATHER_CONFIG.BLIZZARD.healthDecayMultiplier * 0.3; // 70% reduction with tent
            } else if (gameStore.player.isResting) {
                healthDecayMultiplier = WEATHER_CONFIG.BLIZZARD.healthDecayMultiplier * 0.65; // 35% reduction without tent
            } else {
                healthDecayMultiplier = WEATHER_CONFIG.BLIZZARD.healthDecayMultiplier;
            }
        } else if (gameStore.player.isCamping) {
            healthDecayMultiplier = 0.3; // 70% reduction while camping in normal weather
        } else if (gameStore.player.isResting) {
            healthDecayMultiplier = 0.65; // 35% reduction while resting in normal weather
        }

        // Apply clothing protection before weather effects
        const protectedDecay = BASE_HEALTH_DECAY * (1 - protection);

        // Update health based on food and weather
        if (stats.food <= 0) {
            this.handleStarvation();
        } else {
            // Apply weather effects to protected decay rate
            const healthLoss = protectedDecay * deltaTime * healthDecayMultiplier;
            stats.health = Math.max(0, stats.health - healthLoss);
        }

        // Update stamina recovery
        const timeSinceLastMove = (Date.now() - gameStore.player.lastMoveTime) / 1000;
        if (timeSinceLastMove > 1) {
            stats.stamina = Math.min(
                PLAYER_STATS.MAX_VALUE,
                stats.stamina + (PLAYER_STATS.STAMINA_RECOVERY_RATE * deltaTime)
            );
        }
    },

    handleStarvation() {
        // Add early return if god mode is active
        if (gameStore.debug.godModeActive || (window.DEBUG && window.DEBUG.godModeActive)) {
            return;
        }
        const { stats } = gameStore.player;
        stats.health = Math.max(0, stats.health - 0.5);
        stats.stamina = Math.max(0, stats.stamina - 0.5);

        this.checkStarvationThresholds();
    },

    checkStarvationThresholds() {
        const { health } = gameStore.player.stats;
        const thresholdsToShow = new Set([75, 50, 25, 10]);
        
        thresholdsToShow.forEach(threshold => {
            if (health <= threshold && !gameStore.game.hasShownThreshold(threshold)) {
                gameStore.game.markThresholdShown(threshold);
                
                const messages = {
                    75: "Your strength begins to fade as food gnaws at you...",
                    50: "The lack of food is taking its toll. Your vision swims...",
                    25: "Every step is agony. The food is unbearable...",
                    10: "You can barely move. Death's icy grip tightens..."
                };

                gameStore.messages.showPlayerMessage(messages[threshold], UI.MESSAGE_TYPES.STATUS);
            }
        });
    },

    handleDeath() {
        // Get current weather state for death cause
        let cause = 'HEALTH';
        if (gameStore.weather.current.type === 'WHITEOUT') {
            cause = 'WHITEOUT';
        } else if (gameStore.weather.current.type === 'BLIZZARD') {
            cause = 'BLIZZARD';
        }

        // Use RestartSystem to handle death
        if (this.restartSystem) {
            this.restartSystem.handlePlayerDeath(cause);
        }
        
        // Update player appearance
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute("fill", "#000066"); // Dead color
        }
    },

    updateStatsDisplay() {
        const { health, stamina, food } = gameStore.player.stats;
        
        // Update health bar
        const healthBar = document.getElementById('health-bar');
        if (healthBar) {
            healthBar.style.width = `${health}%`;
            healthBar.style.backgroundColor = this.getHealthColor(health);
        }

        // Update stamina bar
        const staminaBar = document.getElementById('stamina-bar');
        if (staminaBar) {
            staminaBar.style.width = `${stamina}%`;
            staminaBar.style.backgroundColor = this.getStaminaColor(stamina);
        }

        // Update food bar
        const foodBar = document.getElementById('food-bar');
        if (foodBar) {
            foodBar.style.width = `${food}%`;
            foodBar.style.backgroundColor = this.getFoodColor(food);
        }
    },

    getHealthColor(value) {
        if (value > 66) return '#FF0000';    // Full red for high health
        if (value > 33) return '#FF4500';    // OrangeRed for medium health
        return '#8B0000';                    // DarkRed for low health
    },

    getStaminaColor(value) {
        if (value > 66) return '#2196F3';
        if (value > 33) return '#87CEEB';
        return '#B0E0E6';
    },

    getFoodColor(value) {
        if (value > 66) return '#D2691E';    // Chocolate
        if (value > 33) return '#CD853F';    // Peru
        return '#8B4513';                    // Saddle Brown
    }
};

export default StatsService;
