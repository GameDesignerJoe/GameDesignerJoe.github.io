// src/utils/debug.js

import { debugPanel } from '../../../core/debugPanel.js';

export class DebugManager {
    constructor(gameStore, WeatherSystem) {
        this.store = gameStore;
        this.WeatherSystem = WeatherSystem;
        this.godModeActive = false;
        this.zoomLevel = 1;  // Add initial zoom level
        this.fogRevealActive = false;  // Add initial fog reveal state
        this.southPoleHighlightActive = false;  // Add initial south pole highlight state
        this.originalSouthPoleColor = null;  // Store original color for toggling
        
        // Create persistent god mode indicator
        this.createGodModeIndicator();
        
        // Bind the event listener
        this.handleDebugCommand = this.handleDebugCommand.bind(this);
        document.addEventListener('keydown', this.handleDebugCommand);

        // Connect to debug panel
        debugPanel.setDebugManager(this);
        debugPanel.setWeatherSystem(WeatherSystem);
    }

    showDebugMessage(message) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        const debugMessage = document.createElement('p');
        debugMessage.className = 'debug-message';
        debugMessage.textContent = message;
        debugMessage.style.color = 'yellow';
        debugMessage.style.fontWeight = 'bold';

        // Remove existing debug messages
        const existingMessages = messageContainer.querySelectorAll('.debug-message');
        existingMessages.forEach(msg => msg.remove());

        messageContainer.appendChild(debugMessage);
        setTimeout(() => debugMessage.remove(), 2000);
    }

    toggleFogOfWar() {
        if (!this.fogRevealActive) {
            // Store original visited hexes before revealing all
            this.originalVisitedHexes = new Set(this.store.game.world.visitedHexes);
            
            // Reveal all hexes
            const allHexes = document.querySelectorAll('.fog');
            allHexes.forEach(fogHex => {
                const q = parseInt(fogHex.getAttribute('data-q'));
                const r = parseInt(fogHex.getAttribute('data-r'));
                fogHex.setAttribute('fill-opacity', '0');
                this.store.game.world.visitedHexes.add(`${q},${r}`);
            });
        } else {
            // Restore original state
            this.store.game.world.visitedHexes = new Set(this.originalVisitedHexes);
            
            // Reset fog
            document.querySelectorAll('.fog').forEach(fogHex => {
                const q = parseInt(fogHex.getAttribute('data-q'));
                const r = parseInt(fogHex.getAttribute('data-r'));
                const hexId = `${q},${r}`;
                if (!this.store.game.world.visitedHexes.has(hexId)) {
                    fogHex.setAttribute('fill-opacity', '1');
                }
            });
        }
        
        this.fogRevealActive = !this.fogRevealActive;
        this.showDebugMessage(this.fogRevealActive ? 'FOG OF WAR DISABLED' : 'FOG OF WAR ENABLED');
    }

    createGodModeIndicator() {
        // Create a persistent indicator for god mode
        const indicator = document.createElement('div');
        indicator.id = 'god-mode-indicator';
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = 'rgba(255, 215, 0, 0.8)'; // Golden color
        indicator.style.padding = '5px 10px';
        indicator.style.borderRadius = '5px';
        indicator.style.fontWeight = 'bold';
        indicator.style.display = 'none';
        indicator.textContent = 'GOD MODE';
        document.body.appendChild(indicator);
    }

    toggleGodMode() {
        // Update store's debug state
        this.store.debug.godModeActive = !this.store.debug.godModeActive;
        // Keep local reference in sync
        this.godModeActive = this.store.debug.godModeActive;
        
        if (this.godModeActive) {
            // Enable god mode
            const stats = this.store.player.stats;
            stats.health = 100;
            stats.stamina = 100;
            stats.food = 100;
        }
        
        // Show temporary message
        this.showDebugMessage(this.godModeActive ? 'GOD MODE ACTIVATED' : 'GOD MODE DEACTIVATED');
        
        // Update persistent indicator
        const indicator = document.getElementById('god-mode-indicator');
        if (indicator) {
            indicator.style.display = this.godModeActive ? 'block' : 'none';
        }
    }

    adjustZoom(direction) {
        const gameGrid = document.getElementById('gameGrid');
        if (!gameGrid) return;

        const zoomSteps = [0.75, 1, 1.25, 1.5, 2, 3];
        const currentIndex = zoomSteps.findIndex(step => Math.abs(this.zoomLevel - step) < 0.01);
        
        if (direction === 'in' && currentIndex > 0) {
            this.zoomLevel = zoomSteps[currentIndex - 1];
        } else if (direction === 'out' && currentIndex < zoomSteps.length - 1) {
            this.zoomLevel = zoomSteps[currentIndex + 1];
        }

        gameGrid.style.transform = `scale(${this.zoomLevel})`;
        this.showDebugMessage(`ZOOM: ${this.zoomLevel.toFixed(2)}x`);
    }

    toggleSouthPoleHighlight() {
        const { q, r } = this.store.southPole;
        const southPoleHex = document.querySelector(`polygon[data-q="${q}"][data-r="${r}"]`);
        
        if (!southPoleHex) return;

        if (!this.southPoleHighlightActive) {
            // Store original color if not already stored
            if (!this.originalSouthPoleColor) {
                this.originalSouthPoleColor = southPoleHex.getAttribute('fill');
            }
            // Set to bright purple
            southPoleHex.setAttribute('fill', '#FF00FF');
            this.southPoleHighlightActive = true;
            this.showDebugMessage('SOUTH POLE HIGHLIGHTED');
        } else {
            // Restore original color
            southPoleHex.setAttribute('fill', this.originalSouthPoleColor);
            this.southPoleHighlightActive = false;
            this.showDebugMessage('SOUTH POLE HIGHLIGHT REMOVED');
        }
    }

    handleDebugCommand(e) {
        if (e.ctrlKey && e.altKey) {
            e.preventDefault();
            e.stopPropagation();

            switch (e.key) {
                case 's': // Toggle South Pole highlight
                    this.toggleSouthPoleHighlight();
                    break;
                case 'f': // Fog reveal toggle
                    this.toggleFogOfWar();
                    break;
                case 'g': // God mode toggle
                    this.toggleGodMode();
                    break;
                case 'b': // Trigger blizzard
                    this.WeatherSystem.triggerBlizzard();
                    this.showDebugMessage('TRIGGERED BLIZZARD');
                    break;
                case 'w': // Trigger whiteout
                    this.WeatherSystem.triggerWhiteout();
                    this.showDebugMessage('TRIGGERED WHITEOUT');
                    break;
                case 'c': // Clear weather
                    this.WeatherSystem.resetWeatherState();
                    this.showDebugMessage('CLEARED WEATHER');
                    break;
                case '-': // Zoom out
                    this.adjustZoom('out');
                    break;
                case '=': // Zoom in
                    this.adjustZoom('in');
                    break;
                case 'h': // Reduce health
                    if (!this.godModeActive) {
                        const currentHealth = this.store.player.stats.health;
                        const reduction = 20;  // 20% reduction
                        this.store.player.stats.health = Math.max(0, currentHealth - reduction);
                        this.showDebugMessage(`HEALTH REDUCED BY ${reduction}%`);
                    } else {
                        this.showDebugMessage('HEALTH REDUCTION BLOCKED BY GOD MODE');
                    }
                    break;
            }
        }
    }

    cleanup() {
        document.removeEventListener('keydown', this.handleDebugCommand);
        const indicator = document.getElementById('god-mode-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}
