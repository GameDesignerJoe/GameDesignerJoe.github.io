// src/core/messages.js
import { TERRAIN_TYPES, SPECIAL_LOCATIONS } from '../config/terrain.js';
import perfMonitor from '../core/performanceMonitor.js';

export const MESSAGE_CONFIG = {
    DISPLAY_TIME: 3000,
    FADE_TIME: 300,
    TYPES: {
        STATUS: 'status',
        TERRAIN: 'terrain-info',
        NARRATIVE: 'narrative',
        WEATHER: 'weather',
        DEBUG: 'debug'
    }
};

export class MessageSystem {
    constructor(gameStore) {
        this.store = gameStore;
        this.initializeElements();
        this.currentPlayerMessage = null;
        this.playerMessageTimeout = null;
        
        // Initialize performance monitoring
        this.initPerformanceMonitoring();
    }

    initPerformanceMonitoring() {
        const methodsToTrack = [
            'showGameMessage',
            'showPlayerMessage',
            'updateCurrentLocationInfo',
            'showWeatherMessage',
            'clearMessages'
        ];

        methodsToTrack.forEach(method => {
            const original = this[method];
            this[method] = (...args) => {
                const start = performance.now();
                const result = original.apply(this, args);
                const end = performance.now();
                perfMonitor.trackMethod(`messages.${method}`, 'messages.js', end - start);
                return result;
            };
        });

        // Create wrapped version of DOM updates
        this._wrappedDOMUpdate = (callback) => {
            requestAnimationFrame(() => {
                const start = performance.now();
                callback();
                const end = performance.now();
                perfMonitor.trackMethod('messagesDOMUpdate', 'messages.js', end - start);
            });
        };
    }

    initializeElements() {
        // Set up game message container
        this.gameMessageContainer = document.getElementById('message-container');
        this.gameMessageElement = document.getElementById('game-message');
        
        if (!this.gameMessageContainer || !this.gameMessageElement) {
            console.error('Message elements not found');
            return;
        }
    
        // Get references to existing player message elements
        this.playerMessageContainer = document.getElementById('player-message-container');
        this.playerMessageText = document.getElementById('player-message-text');
        
        // Only create if they don't exist (shouldn't happen now that they're in HTML)
        if (!this.playerMessageContainer || !this.playerMessageText) {
            console.warn('Player message elements not found, creating them...');
            
            const playerMessageContainer = document.createElement('div');
            playerMessageContainer.id = 'player-message-container';
            playerMessageContainer.className = 'player-message';
            
            const messageText = document.createElement('p');
            messageText.id = 'player-message-text';
            playerMessageContainer.appendChild(messageText);
            
            document.querySelector('.grid-container').appendChild(playerMessageContainer);
            
            this.playerMessageContainer = playerMessageContainer;
            this.playerMessageText = messageText;
        }
    }

    showGameMessage(message, type = MESSAGE_CONFIG.TYPES.STATUS) {
        if (!this.gameMessageElement) return;
        
        // Batch DOM updates
        this._wrappedDOMUpdate(() => {
            this.gameMessageElement.className = type;
            this.gameMessageElement.innerHTML = message;
            this.gameMessageContainer.classList.add('has-message');
            
            // Store in game state
            this.store.messages.currentMessage = message;
        });
    }

    showPlayerMessage(message, type = MESSAGE_CONFIG.TYPES.STATUS) {
        if (!this.playerMessageContainer || !this.playerMessageText) return;
    
        // Clear any existing timeout
        if (this.playerMessageTimeout) {
            clearTimeout(this.playerMessageTimeout);
        }
    
        // Batch DOM updates
        this._wrappedDOMUpdate(() => {
            // Split message into lines and wrap each in a span
            const lines = message.split('\n');
            const wrappedText = lines.map(line => `<span>${line}</span>`).join('<br>');
            this.playerMessageText.innerHTML = wrappedText;
            this.playerMessageContainer.className = `player-message ${type}-message visible`;
        });
    
        // Only set timeout for non-narrative messages
        if (type !== MESSAGE_CONFIG.TYPES.NARRATIVE) {
            this.playerMessageTimeout = setTimeout(() => {
                this._wrappedDOMUpdate(() => {
                    this.playerMessageContainer.classList.remove('visible');
                });
                
                setTimeout(() => {
                    if (this.playerMessageText) {
                        this._wrappedDOMUpdate(() => {
                            this.playerMessageText.innerHTML = '';
                        });
                    }
                }, MESSAGE_CONFIG.FADE_TIME);
            }, MESSAGE_CONFIG.DISPLAY_TIME);
        }
    }

    showInitialMessage() {
        this.showGameMessage(
            "Before you lies the vast Antarctic expanse, untamed and unforgiving. " +
            "The freezing wind howls a challenge promising either immortal glory " +
            "or eternal rest beneath the ice.",
            MESSAGE_CONFIG.TYPES.NARRATIVE
        );
    }

    showDeathMessage(cause = 'exposure') {
        const messages = {
            exposure: "The bitter Antarctic winds howl a mournful dirge as your frozen form becomes " +
                     "one with the endless white expanse. Your journey ends here, but the South Pole " +
                     "remains, waiting for the next brave soul to challenge its deadly embrace.",
            blizzard: "Lost in the blizzard, you fade into the endless white...",
            whiteout: "In the whiteout, all sense of direction vanishes as consciousness slips away..."
        };

        this.showGameMessage(messages[cause], MESSAGE_CONFIG.TYPES.NARRATIVE);
    }

    showVictoryMessage() {
        const victoryMessage = 
            "Against all odds, you've done it! You've reached the South Pole " +
            "and returned to tell the tale. Your name will be forever etched " +
            "in the annals of polar exploration.";

        // Show the message both in the game message area and as a player message
        this.showGameMessage(victoryMessage, MESSAGE_CONFIG.TYPES.NARRATIVE);
        this.showPlayerMessage("Victory! You have conquered Antarctica!", MESSAGE_CONFIG.TYPES.NARRATIVE);
        
        // Add victory class to message container for potential special styling
        if (this.gameMessageContainer) {
            this.gameMessageContainer.classList.add('victory');
        }
    }

    updateCurrentLocationInfo() {
        // Get current position
        const { q, r } = this.store.playerPosition;
        const hex = document.querySelector(`polygon[data-q="${q}"][data-r="${r}"]`);
        if (!hex) return;

        const terrain = hex.getAttribute('data-terrain');
        const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                        terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                        TERRAIN_TYPES[terrain];

        if (!terrainInfo) return;

        this.showGameMessage(
            `<h3>${terrainInfo.name}</h3>
            <p><em>${terrainInfo.quote}</em></p>`,
            MESSAGE_CONFIG.TYPES.TERRAIN
        );
    }

    showWeatherMessage(type) {
        const messages = {
            BLIZZARD: "A blizzard sweeps in, obscuring your view...",
            WHITEOUT: "The air grows thick with snow...",
            BLIZZARD_END: "The blizzard subsides, your surroundings becoming familiar once again...",
            WHITEOUT_END: "The white out phenomenon clears, but nothing looks familiar anymore..."
        };

        if (messages[type]) {
            this.showPlayerMessage(messages[type], MESSAGE_CONFIG.TYPES.WEATHER);
        }
    }

    clearMessages() {
        if (this.gameMessageElement) {
            this.gameMessageElement.innerHTML = '';
            this.gameMessageContainer.classList.remove('has-message');
            this.gameMessageContainer.classList.remove('terrain-info');
            this.gameMessageContainer.classList.remove('narrative');
        }
        
        if (this.playerMessageContainer) {
            this.playerMessageContainer.classList.remove('visible');
        }
        
        if (this.playerMessageTimeout) {
            clearTimeout(this.playerMessageTimeout);
        }
        
        this.currentMessage = '';  // Fixed: was trying to use undefined 'message' variable
    }
}
