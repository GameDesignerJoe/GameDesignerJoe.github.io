// src/game/stats.js

import { GameState, PLAYER_STATS } from './core/gameState.js';
import { WeatherState, WEATHER_CONFIG } from './core/weatherState.js';
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';
import { PLAYER_COLORS } from './constants.js';
import { MovementManager } from './movement.js';  // Added for getHexCenter in handleRestart

export const StatsManager = {
    updateStats() {
        if (!GameState.game.running || GameState.game.won) return;

        const currentTime = Date.now();
        const deltaTime = (currentTime - GameState.player.lastStatUpdate) / 1000;
        
        // Update only if enough time has passed
        if (deltaTime < 0.05) return;

        // Check if at base camp
        const atBaseCamp = GameState.player.position.q === GameState.world.baseCamp.q && 
                          GameState.player.position.r === GameState.world.baseCamp.r;

        if (atBaseCamp) {
            // At base camp: Heal everything at accelerated rate
            GameState.player.stats.health = Math.min(
                PLAYER_STATS.MAX_VALUE,
                GameState.player.stats.health + (PLAYER_STATS.HEAL_RATE * 3 * deltaTime)
            );
            GameState.player.stats.stamina = Math.min(
                PLAYER_STATS.MAX_VALUE,
                GameState.player.stats.stamina + (PLAYER_STATS.STAMINA_RECOVERY_RATE * 3 * deltaTime)
            );
            GameState.player.stats.hunger = Math.min(
                PLAYER_STATS.MAX_VALUE,
                GameState.player.stats.hunger + (PLAYER_STATS.HUNGER_DECAY_RATE * 3 * deltaTime)
            );
        } else {
            // Away from base camp: Normal mechanics
            let healthDecayMultiplier = 1;
            if (WeatherState.current.type === 'WHITEOUT') {
                healthDecayMultiplier = WEATHER_CONFIG.WHITEOUT.healthDecayMultiplier;
            } else if (WeatherState.current.type === 'BLIZZARD') {
                healthDecayMultiplier = WEATHER_CONFIG.BLIZZARD.healthDecayMultiplier;
            }

            // Update health based on hunger and weather
            if (GameState.player.stats.hunger <= 0) {
                this.handleStarvation();
            } else {
                // Changed to use a fixed decay rate instead of HEAL_RATE
                const HEALTH_DECAY_RATE = 0.5; // 0.5 health lost per second
                const healthLoss = HEALTH_DECAY_RATE * deltaTime * healthDecayMultiplier;
                GameState.player.stats.health = Math.max(
                    0, 
                    GameState.player.stats.health - healthLoss
                );
            }

            // Update stamina recovery
            const timeSinceLastMove = (currentTime - GameState.player.lastMoveTime) / 1000;
            if (timeSinceLastMove > 2) {  // Start recovering stamina after 2 seconds of no movement
                GameState.player.stats.stamina = Math.min(
                    PLAYER_STATS.MAX_VALUE,
                    GameState.player.stats.stamina + (PLAYER_STATS.STAMINA_RECOVERY_RATE * deltaTime)
                );
            }
        }

        // Check for death condition
        if (GameState.player.stats.health <= 0) {
            this.handleDeath();
            return;
        }

        // Update time tracking and UI
        GameState.player.lastStatUpdate = currentTime;
        this.updateStatsDisplay();
    },

    handleStarvation() {
        GameState.player.stats.health = Math.max(
            0,
            GameState.player.stats.health - 0.5
        );
        GameState.player.stats.stamina = Math.max(
            0,
            GameState.player.stats.stamina - 0.5
        );

        this.checkStarvationThresholds();
    },

    checkStarvationThresholds() {
        const { health } = GameState.player.stats;
        const thresholdsToShow = new Set([75, 50, 25, 10]);
        
        thresholdsToShow.forEach(threshold => {
            if (health <= threshold && !GameState.hasShownThreshold(threshold)) {
                GameState.markThresholdShown(threshold);
                
                const messages = {
                    75: "Your strength begins to fade as hunger gnaws at you...",
                    50: "The lack of food is taking its toll. Your vision swims...",
                    25: "Every step is agony. The hunger is unbearable...",
                    10: "You can barely move. Death's icy grip tightens..."
                };

                MessageManager.showPlayerMessage(messages[threshold], MESSAGE_TYPES.STATUS);
            }
        });
    },

    handleDeath() {
        GameState.game.running = false;
        
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute("fill", PLAYER_COLORS.DEAD);
        }

        // Show and enable restart button
        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            restartBtn.classList.remove('hidden');
            restartBtn.style.display = 'block';
            
            // Remove any existing event listener
            const newRestartBtn = restartBtn.cloneNode(true);
            restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
            
            // Add new event listener
            newRestartBtn.addEventListener('click', () => {
                this.handleRestart();
            });
        }
        
        document.getElementById('game-message').className = 'narrative';
        document.getElementById('game-message').innerHTML = 
            "The bitter Antarctic winds howl a mournful dirge as your frozen form becomes " +
            "one with the endless white expanse. Your journey ends here, but the South Pole " +
            "remains, waiting for the next brave soul to challenge its deadly embrace.";
    },

    handleRestart() {
        // Reset game state
        GameState.resetGame();
        
        // Reset UI elements
        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            restartBtn.classList.add('hidden');
            restartBtn.style.display = 'none';
        }

        // Reset player marker
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute("fill", PLAYER_COLORS.DEFAULT);
            const center = MovementManager.getHexCenter(
                GameState.world.baseCamp.q, 
                GameState.world.baseCamp.r
            );
            player.setAttribute("cx", center.x);
            player.setAttribute("cy", center.y);
        }

        // Reset other UI elements
        this.updateStatsDisplay();
        MessageManager.showInitialMessage();
    },

    updateStatsDisplay() {
        const { health, stamina, hunger } = GameState.player.stats;
        
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

        // Update hunger bar
        const hungerBar = document.getElementById('hunger-bar');
        if (hungerBar) {
            hungerBar.style.width = `${hunger}%`;
            hungerBar.style.backgroundColor = this.getHungerColor(hunger);
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

    getHungerColor(value) {
        if (value > 66) return '#D2691E';    // Chocolate
        if (value > 33) return '#CD853F';    // Peru
        return '#8B4513';                    // Saddle Brown
    }
};

export default StatsManager;