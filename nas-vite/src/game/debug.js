import { WeatherManager } from './weather.js';
import { StatsManager } from './stats.js';
import { STATS } from './stats.js';
import { VisibilityManager } from './visibility.js';

export const DebugManager = {
    // Track god mode state
    godModeActive: false,
    fogRevealActive: false,
    originalUpdateStats: null,
    lastGodModeToggleTime: 0,

    setupListeners() {
        document.addEventListener('keydown', (e) => {
            // Prevent default and stop propagation for debug keys
            if (e.ctrlKey && e.altKey) {
                switch (e.key) {
                    case 'w': // Whiteout trigger
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Debug: Triggering whiteout');
                        const originalWhiteoutGameRunning = window.gameRunning;
                        window.gameRunning = true;
                        WeatherManager.triggerWhiteout();
                        window.gameRunning = originalWhiteoutGameRunning;
                        break;

                    case 'b': // Blizzard trigger
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Debug: Triggering blizzard');
                        const originalBlizzardGameRunning = window.gameRunning;
                        window.gameRunning = true;
                        WeatherManager.triggerBlizzard();
                        window.gameRunning = originalBlizzardGameRunning;
                        break;

                    case 'h': // Reduce health
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Debug: Reducing player health');
                        if (window.stats) {
                            window.stats.health = Math.max(0, window.stats.health - 20);
                            console.log('Current health:', window.stats.health);
                            
                            const healthBar = document.getElementById('health-bar');
                            if (healthBar) {
                                healthBar.style.width = `${window.stats.health}%`;
                            }
                            
                            StatsManager.updateStatsDisplay();
                            StatsManager.checkDeathCondition();
                        }
                        break;

                    case 'g': // God Mode toggle
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const now = Date.now();
                        if (now - this.lastGodModeToggleTime < 300) {
                            console.log('God Mode: Rapid toggle prevented');
                            return;
                        }
                        this.lastGodModeToggleTime = now;

                        console.log('Debug: Toggling God Mode');
                        this.toggleGodMode();
                        break;

                    case 'f': // Fog of War toggle
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Debug: Toggling Fog of War');
                        this.toggleFogOfWar();
                        break;
                }
            }
        });

        console.log('Debug controls initialized');
    },

    toggleFogOfWar() {
        // Prevent rapid toggling
        const now = Date.now();
        if (now - this.lastFogToggleTime < 300) {
            console.log('Fog Reveal: Rapid toggle prevented');
            return;
        }
        this.lastFogToggleTime = now;
    
        this.fogRevealActive = !this.fogRevealActive;
    
        if (this.fogRevealActive) {
            console.log('Fog of War DISABLED: Revealing entire map');
    
            // Store the current state of visited and visible hexes
            this.originalVisitedHexes = new Set(window.visitedHexes);
    
            // Reveal all hexes
            document.querySelectorAll('.fog').forEach(fogHex => {
                const q = parseInt(fogHex.getAttribute('data-q'));
                const r = parseInt(fogHex.getAttribute('data-r'));
                const hexId = `${q},${r}`;
                
                // Always show this hex
                fogHex.setAttribute('fill-opacity', '0');
                
                // Add to visited hexes
                window.visitedHexes.add(hexId);
            });
    
            // Force update visibility
            window.visibleHexes.clear();
            VisibilityManager.updateVisibility();
    
            // Provide visual feedback
            const messageContainer = document.getElementById('message-container');
            const fogMessage = document.createElement('p');
            fogMessage.id = 'fog-debug-message';
            fogMessage.textContent = 'FOG OF WAR DISABLED';
            fogMessage.style.color = 'yellow';
            fogMessage.style.fontWeight = 'bold';
            messageContainer.appendChild(fogMessage);
        } else {
            console.log('Fog of War ENABLED: Restoring original visibility');
    
            // Restore original visited hexes
            if (this.originalVisitedHexes) {
                window.visitedHexes = new Set(this.originalVisitedHexes);
            }
    
            // Reset fog
            document.querySelectorAll('.fog').forEach(fogHex => {
                const q = parseInt(fogHex.getAttribute('data-q'));
                const r = parseInt(fogHex.getAttribute('data-r'));
                const hexId = `${q},${r}`;
                
                // Only show hexes that were originally hidden
                if (!window.visitedHexes.has(hexId)) {
                    fogHex.setAttribute('fill-opacity', '1');
                }
            });
    
            // Force update visibility
            window.visibleHexes.clear();
            VisibilityManager.updateVisibility();
    
            // Remove debug message
            const fogMessage = document.getElementById('fog-debug-message');
            if (fogMessage) {
                fogMessage.remove();
            }
        }
    
        // Log the current state of fog reveal
        console.log('Fog of War is now:', this.fogRevealActive ? 'DISABLED' : 'ENABLED');
    },

    toggleGodMode() {
        // Safely check if all required objects exist
        if (!window.stats || !StatsManager || !STATS) {
            console.error('Cannot toggle god mode: Unable to find stats object');
            return;
        }
    
        // Toggle god mode state
        this.godModeActive = !this.godModeActive;
        
        if (this.godModeActive) {
            console.log('God Mode ACTIVATED: Stat changes disabled');
            
            // Store original method if not already stored
            if (!this.originalUpdateStats) {
                this.originalUpdateStats = StatsManager.updateStats;
            }
    
            // Override the stats update method to prevent stat changes
            StatsManager.updateStats = () => {
                // Completely lock stats at max
                window.stats.health = STATS.MAX_VALUE;
                window.stats.stamina = STATS.MAX_VALUE;
                window.stats.hunger = STATS.MAX_VALUE;
    
                // Ensure display is updated to max
                const statBars = {
                    health: document.getElementById('health-bar'),
                    stamina: document.getElementById('stamina-bar'),
                    hunger: document.getElementById('hunger-bar')
                };
    
                // Directly set bar widths to 100%
                Object.values(statBars).forEach(bar => {
                    if (bar) bar.style.width = '100%';
                });
    
                // Prevent any decay or changes
                return false;
            };
    
            // Provide visual feedback
            const messageContainer = document.getElementById('message-container');
            const godModeMessage = document.createElement('p');
            godModeMessage.id = 'god-mode-message';
            godModeMessage.textContent = 'GOD MODE ACTIVATED';
            godModeMessage.style.color = 'yellow';
            godModeMessage.style.fontWeight = 'bold';
            messageContainer.appendChild(godModeMessage);
    
            // Force update to max stats
            window.stats.health = STATS.MAX_VALUE;
            window.stats.stamina = STATS.MAX_VALUE;
            window.stats.hunger = STATS.MAX_VALUE;
            StatsManager.updateStatsDisplay();
        } else {
            console.log('God Mode DEACTIVATED: Normal stat changes resumed');
            
            // Restore original updateStats method
            if (this.originalUpdateStats) {
                StatsManager.updateStats = this.originalUpdateStats;
            }
    
            // Remove god mode message
            const godModeMessage = document.getElementById('god-mode-message');
            if (godModeMessage) {
                godModeMessage.remove();
            }
        }
    
        // Log the current state of god mode
        console.log('God Mode is now:', this.godModeActive ? 'ON' : 'OFF');
    }
};