// src/core/restart.js

const RESTART_CONFIG = {
    BUTTON_ID: 'restart-button',
    GAME_CONTAINER_ID: 'game-container',
    DEATH_MESSAGES: {
        HEALTH: "You've succumbed to the harsh Antarctic conditions...",
        BLIZZARD: "Lost in the blizzard, you fade into the endless white...",
        WHITEOUT: "In the whiteout, all sense of direction vanishes as consciousness slips away..."
    }
};

export class RestartSystem {
    constructor(gameStore, weatherSystem, statsService) {
        this.store = gameStore;
        this.weatherSystem = weatherSystem;
        this.statsService = statsService;
        
        this.initRestartButton();
    }

    initRestartButton() {
        // Remove any existing button first
        const existingButton = document.getElementById(RESTART_CONFIG.BUTTON_ID);
        if (existingButton) {
            existingButton.remove();
        }

        // Create new button
        const button = document.createElement('button');
        button.id = RESTART_CONFIG.BUTTON_ID;
        button.className = 'restart-button hidden';
        button.textContent = 'Begin A New Expedition';
        button.addEventListener('click', () => this.handleRestart());

        // Add to game container
        const container = document.getElementById(RESTART_CONFIG.GAME_CONTAINER_ID);
        if (container) {
            container.appendChild(button);
        }
    }

    showRestartButton() {
        const button = document.getElementById(RESTART_CONFIG.BUTTON_ID);
        if (!button) {
            // Create button if it doesn't exist
            this.initRestartButton();
        }
        
        // Try to get button again (either existing or newly created)
        const restartButton = document.getElementById(RESTART_CONFIG.BUTTON_ID);
        if (restartButton) {
            restartButton.classList.remove('hidden');
            restartButton.style.display = 'block';
            
            // Ensure button is visible and at the front
            restartButton.style.zIndex = '1000';
            restartButton.style.position = 'absolute';
            
            // Add click handler if it doesn't exist
            if (!restartButton.onclick) {
                restartButton.addEventListener('click', () => this.handleRestart());
            }
        }
    }

    hideRestartButton() {
        const button = document.getElementById(RESTART_CONFIG.BUTTON_ID);
        if (button) {
            button.classList.add('hidden');
            button.style.display = 'none';
        }
    }

    handlePlayerDeath(cause = 'HEALTH') {
        // Stop the game using existing method
        this.store.game.pauseGame();

        // Clear any active weather effects
        if (this.weatherSystem) {
            this.weatherSystem.resetWeatherState();
        }

        // Show appropriate death message
        const message = RESTART_CONFIG.DEATH_MESSAGES[cause] || RESTART_CONFIG.DEATH_MESSAGES.HEALTH;
        this.store.messages.showPlayerMessage(message, 'narrative');  // Changed from this.messageManager

        this.showRestartButton();
    }

    handleRestart() {
        // Reset core game state
        this.store.game.resetGame();
        this.store.player.resetStats();
        
        // Reset victory-specific states
        this.store.game.world.southPoleVisited = false;
        this.store.game.won = false;
        
        // Reset player position to base camp
        this.store.player.position = {
            q: this.store.baseCamp.q,
            r: this.store.baseCamp.r
        };
        
        // Reset player appearance
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute('fill', '#0000FF');  // Reset to default color
        }

        // Reset weather effects
        if (this.weatherSystem) {
            this.weatherSystem.resetWeatherState();
        }

        // Reset UI elements
        this.hideRestartButton();
        this.statsService.updateStatsDisplay();
        this.store.messages.showInitialMessage();

        // Resume game
        this.store.game.running = true;

        // Schedule new weather after delay
        setTimeout(() => {
            if (this.store.game.running && !this.store.game.won) {
                this.weatherSystem.scheduleNextWeather();
            }
        }, 5000);
    }

    // Method to check for death conditions - can be called from stats update loop
    checkDeathConditions() {
        if (!this.store.game.running || this.store.game.won) return;

        if (this.store.player.stats.health <= 0) {
            let cause = 'HEALTH';
            
            // Determine if death occurred during weather event
            if (this.store.weather.effects.blizzardActive) {
                cause = 'BLIZZARD';
            } else if (this.store.weather.effects.whiteoutActive) {
                cause = 'WHITEOUT';
            }

            this.handlePlayerDeath(cause);
        }
    }
}