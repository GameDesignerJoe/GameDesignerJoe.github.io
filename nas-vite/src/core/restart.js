// src/core/restart.js

const RESTART_CONFIG = {
    BUTTON_ID: 'restart-button',
    GAME_CONTAINER_ID: 'game-container',
    DEATH_MESSAGES: {
        HEALTH: "The Antarctic's Icy Embrace Claims Another...",
        BLIZZARD: "Lost to the Fury of the Storm...",
        WHITEOUT: "Vanished into the Endless White..."
    }
};

export class RestartSystem {
    constructor(gameStore, weatherSystem, statsService) {
        this.store = gameStore;
        this.weatherSystem = weatherSystem;
        this.statsService = statsService;
    }

    initRestartButton() {
        // Get or create the button
        let button = document.getElementById(RESTART_CONFIG.BUTTON_ID);
        if (!button) {
            button = document.createElement('button');
            button.id = RESTART_CONFIG.BUTTON_ID;
            button.className = 'restart-button hidden';
            button.textContent = 'ANSWER THE CALL AGAIN';
            button.style.display = 'none';
            document.body.appendChild(button);
        }

        // Add click handler
        button.addEventListener('click', () => this.handleRestart());
        return button;
    }

    showRestartButton() {
        // Initialize and style the button
        const button = this.initRestartButton();
        button.classList.remove('hidden');
        button.style.display = 'block';
        button.style.zIndex = '9999';
    }

    hideRestartButton() {
        // Initialize and style the button
        const button = this.initRestartButton();
        button.classList.add('hidden');
        button.style.display = 'none';
        button.style.opacity = '0';
        
        // Move back to document body if it's in an overlay
        if (button.parentElement && button.parentElement.style.zIndex === '99998') {
            document.body.appendChild(button);
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
        this.store.messages.showPlayerMessage(message, 'narrative');

        // Create a new overlay for the death state
        const deathOverlay = document.createElement('div');
        deathOverlay.style.position = 'fixed';
        deathOverlay.style.top = '0';
        deathOverlay.style.left = '0';
        deathOverlay.style.width = '100%';
        deathOverlay.style.height = '100%';
        deathOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        deathOverlay.style.zIndex = '99998';
        deathOverlay.style.display = 'flex';
        deathOverlay.style.flexDirection = 'column';
        deathOverlay.style.justifyContent = 'center';
        deathOverlay.style.alignItems = 'center';
        deathOverlay.style.padding = '20px';
        document.body.appendChild(deathOverlay);

        // Create death message container
        const messageContainer = document.createElement('div');
        messageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        messageContainer.style.padding = '20px';
        messageContainer.style.borderRadius = '8px';
        messageContainer.style.marginBottom = '20px';
        messageContainer.style.maxWidth = '600px';
        messageContainer.style.textAlign = 'center';
        messageContainer.style.color = 'white';
        messageContainer.style.fontFamily = "'Old Standard TT', serif";
        messageContainer.style.fontSize = '18px';
        messageContainer.style.lineHeight = '1.6';

        // Calculate distance from base camp and south pole
        const distanceFromBase = this.calculateDistance(
            this.store.player.position,
            this.store.baseCamp
        );
        const distanceFromPole = this.calculateDistance(
            this.store.player.position,
            this.store.southPole
        );

        // Create detailed death message
        const baseMessage = RESTART_CONFIG.DEATH_MESSAGES[cause];
        const foundPole = this.store.game.world.southPoleVisited ? 
            "Your name shall be etched in history alongside the great explorers who conquered the South Pole. " :
            "The South Pole remains untamed, its secrets preserved in the endless white. ";

        // Create distance descriptions
        const baseDistance = distanceFromBase === 1 ? "a single hex" : `${distanceFromBase} hexes`;
        const poleDistance = distanceFromPole === 1 ? "a single hex" : `${distanceFromPole} hexes`;
        
        // Create cause-specific details
        let causeDetail = "";
        if (cause === 'BLIZZARD') {
            causeDetail = "The merciless Antarctic blizzard proved too fierce, its howling winds claiming another brave soul.";
        } else if (cause === 'WHITEOUT') {
            causeDetail = "In the pure white void, all sense of direction vanished, leaving you to the mercy of the eternal frost.";
        } else {
            causeDetail = "The harsh Antarctic conditions exacted their toll, proving once again the unforgiving nature of this frozen realm.";
        }
        
        messageContainer.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 28px; color: #ff4444;">
                ${baseMessage}
            </div>
            <div style="margin-bottom: 20px; font-size: 18px;">
                ${causeDetail}
            </div>
            <div style="margin-bottom: 20px;">
                Your journey ended ${baseDistance} from base camp, 
                and ${poleDistance} from the South Pole.
                ${foundPole}
            </div>
            <div style="font-style: italic; color: #aaaaaa; font-size: 16px;">
                Though the Antarctic claims another explorer, your courage will be remembered. 
                Your story joins the whispers carried by the endless winds across these frozen wastes...
            </div>
        `;

        deathOverlay.appendChild(messageContainer);

        // Ensure the button is initialized and shown with proper timing
        const showButton = () => {
            // Initialize and style the button
            const button = this.initRestartButton();
            button.style.display = 'block';
            button.style.opacity = '1';
            button.style.zIndex = '99999';
            button.classList.remove('hidden');
            
            // Move button to death overlay
            deathOverlay.appendChild(button);
        };

        // Add the restart button after a delay
        setTimeout(showButton, 1000);
    }

    handleRestart() {
        // Remove death overlay if it exists
        const existingOverlay = document.querySelector('div[style*="z-index: 99998"]');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Reset core game state
        this.store.game.resetGame();
        this.store.player.resetStats();
        
        // Reset victory-specific states
        this.store.game.world.southPoleVisited = false;
        this.store.game.won = false;

        // Hide game container
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        // Hide packing screen
        const packingScreen = document.getElementById('packing-screen');
        if (packingScreen) {
            packingScreen.style.display = 'none';
        }

        // Remove any existing loading screen
        const existingLoadingScreen = document.querySelector('.loading-screen');
        if (existingLoadingScreen) {
            existingLoadingScreen.remove();
        }

        // Clear any existing messages
        this.store.messages.clearMessages();

        // Reset player state and visibility
        this.store.player.position = {
            q: this.store.baseCamp.q,
            r: this.store.baseCamp.r
        };
        
        // Reset player appearance
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute('fill', '#0000FF');
        }

        // Reset visibility
        if (this.store.game.world) {
            this.store.game.world.visibleHexes.clear();
            this.store.game.world.visitedHexes.clear();
            
            // Add base camp hex to visited and visible
            const baseCampKey = `${this.store.baseCamp.q},${this.store.baseCamp.r}`;
            this.store.game.world.visitedHexes.add(baseCampKey);
            this.store.game.world.visibleHexes.add(baseCampKey);
            
            // Get adjacent hexes to base camp
            const adjacentHexes = this.getAdjacentHexes(this.store.baseCamp);
            adjacentHexes.forEach(hex => {
                const hexKey = `${hex.q},${hex.r}`;
                this.store.game.world.visibleHexes.add(hexKey);
            });
        }

        // Reset compass position
        const compass = document.querySelector('.compass');
        if (compass) {
            compass.style.transform = 'none';
            compass.style.left = '0';
            compass.style.top = '0';
            compass.style.position = 'absolute';
        }

        // Reset weather effects
        if (this.weatherSystem) {
            this.weatherSystem.resetWeatherState();
        }

        // Clear any existing weather timeouts
        if (this.store.weather.effects.weatherTimeout) {
            clearTimeout(this.store.weather.effects.weatherTimeout);
        }

        // Reset UI elements
        this.hideRestartButton();
        this.statsService.updateStatsDisplay();

        // Reset packing state
        this.store.packing.selectedItems.clear();
        this.store.packing.totalWeight = 0;
        
        // Initialize new loading screen
        import('../core/loadingScreen.js').then(module => {
            const LoadingScreen = module.default;
            const loadingScreen = new LoadingScreen();
            const self = this;
            
            loadingScreen.onComplete = function() {
                // Initialize packing screen
                const packingScreen = document.getElementById('packing-screen');
                if (packingScreen) {
                    packingScreen.style.display = 'block';
                    self.store.messages.showInitialMessage();
                }
            };
        }).catch(error => {
            console.error('Failed to load loading screen:', error);
        });

        // Game will be resumed when player starts a new game
        this.store.game.running = false;
    }

    // Get adjacent hexes for a position
    getAdjacentHexes(position) {
        const directions = [
            {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
            {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
        ];
        return directions.map(dir => ({
            q: position.q + dir.q,
            r: position.r + dir.r
        }));
    }

    // Calculate hex distance between two points
    calculateDistance(pos1, pos2) {
        if (!pos1 || !pos2) return 0;
        const dx = pos2.q - pos1.q;
        const dy = pos2.r - pos1.r;
        return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
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
