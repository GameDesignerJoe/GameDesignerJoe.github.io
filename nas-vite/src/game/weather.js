// Import dependencies
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';
import { StatsManager } from './stats.js';
import { VisibilityManager } from './visibility.js';

// Weather configuration
export const WEATHER = {
    CONFIG: {
        WHITEOUT: {
            HEALTH_DECAY_MULTIPLIER: 1.05,
            FADE_IN_DURATION: 15000,
            HOLD_DURATION: 10000,
            FADE_OUT_DURATION: 8000,
            MIN_INTERVAL: 120000,     // 2 minutes
            MAX_INTERVAL: 240000      // 4 minutes
        },
        BLIZZARD: {
            HEALTH_DECAY_MULTIPLIER: 1.02,
            FADE_IN_DURATION: 5000,   // Faster transition
            HOLD_DURATION: 15000,     // Longer period of reduced visibility
            FADE_OUT_DURATION: 10000,  // Faster transition
            MIN_INTERVAL: 45000,      // 45 seconds
            MAX_INTERVAL: 90000       // 1.5 minutes
        }
    },
    state: {
        whiteoutActive: false,
        blizzardActive: false,
        whiteoutPhase: false,
        temporaryFog: new Set(),
        weatherTimeout: null
    }
};

export const WeatherManager = {
    createWeatherElements() {
        // Create blizzard overlay
        const blizzardRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        blizzardRect.setAttribute("id", "blizzardOverlay");
        blizzardRect.setAttribute("class", "blizzard-overlay");
        blizzardRect.setAttribute("x", "-150");
        blizzardRect.setAttribute("y", "-150");
        blizzardRect.setAttribute("width", "300");
        blizzardRect.setAttribute("height", "300");
        blizzardRect.setAttribute("fill", "white");
    
        // Create whiteout overlay
        const whiteoutRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        whiteoutRect.setAttribute("id", "whiteoutOverlay");
        whiteoutRect.setAttribute("class", "whiteout-overlay");
        whiteoutRect.setAttribute("x", "-150");
        whiteoutRect.setAttribute("y", "-150");
        whiteoutRect.setAttribute("width", "300");
        whiteoutRect.setAttribute("height", "300");
        whiteoutRect.setAttribute("fill", "white");
    
        // Add both overlays to the game grid
        const gameGrid = document.getElementById('gameGrid');
        gameGrid.appendChild(blizzardRect);
        gameGrid.appendChild(whiteoutRect);
    },

    triggerBlizzard() {
        // Access global variables using window
        if (!window.gameRunning || WEATHER.state.blizzardActive || WEATHER.state.whiteoutActive) return;
        
        console.log('Weather Debug: Starting blizzard');
        WEATHER.state.blizzardActive = true;
        const blizzardOverlay = document.getElementById('blizzardOverlay');
        const player = document.getElementById('player');
        
        // Explicitly set initial opacity to ensure CSS takes control
        player.style.opacity = '1';
        
        // Store current visibility state
        WEATHER.state.temporaryFog = new Set([...window.visitedHexes]);
        
        // Start the blizzard fade effect
        document.querySelectorAll('.fog').forEach(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            const isCurrentPosition = hexId === `${window.playerPosition.q},${window.playerPosition.r}`;
            
            if (!isCurrentPosition) {
                fogHex.classList.add('blizzard-fade');
                fogHex.setAttribute('fill-opacity', '1');
            }
        });
        
        // Fade out the player
        player.classList.add('blizzard-player-fade-in');
        
        MessageManager.showPlayerMessage("A blizzard sweeps in, obscuring your view...", MESSAGE_TYPES.STATUS);
        setTimeout(() => MessageManager.clearTerrainMessage(), 5000);
        
        setTimeout(() => {
            console.log('Weather Debug: Blizzard fade in');
            blizzardOverlay.setAttribute("opacity", "0.5");
            
            // Switch to full blizzard opacity
            setTimeout(() => {
                // Remove fade-in, add hold class
                player.classList.remove('blizzard-player-fade-in');
                player.classList.add('blizzard-player-hold');
                
                // Explicitly set opacity via style to counteract any global resets
                player.style.opacity = '0.25';
                
                console.log('Weather Debug: Blizzard peak intensity');
                VisibilityManager.updateVisibility(true);
                
                // Start fade out
                setTimeout(() => {
                    console.log('Weather Debug: Blizzard starting fade out');
                    blizzardOverlay.setAttribute("opacity", "0");
                    
                    player.classList.remove('blizzard-player-hold');
                    player.classList.add('blizzard-player-fade-out');
                    
                    document.querySelectorAll('.fog').forEach(fogHex => {
                        fogHex.classList.remove('blizzard-fade');
                    });
                    
                    WEATHER.state.weatherTimeout = setTimeout(() => {
                        // Completely remove blizzard classes
                        player.classList.remove('blizzard-player-fade-out');
                        player.style.opacity = '1';  // Ensure full opacity at end
                        
                        this.handleBlizzardComplete();
                    }, WEATHER.CONFIG.BLIZZARD.FADE_OUT_DURATION);
                    
                }, WEATHER.CONFIG.BLIZZARD.HOLD_DURATION);
                
            }, WEATHER.CONFIG.BLIZZARD.FADE_IN_DURATION);
        }, 100);
    },

    handleBlizzardComplete() {
        if (!WEATHER.state.blizzardActive) return;
        
        WEATHER.state.blizzardActive = false;
        
        // Restore previous visibility including adjacent hexes
        visitedHexes = new Set([...WEATHER.state.temporaryFog]);
        WEATHER.state.temporaryFog.clear();
        VisibilityManager.updateVisibility(false);
        
        StatsManager.updateStatsDisplay();
        MessageManager.updateCurrentLocationInfo();
        
        if (WEATHER.state.weatherTimeout) {
            clearTimeout(WEATHER.state.weatherTimeout);
            WEATHER.state.weatherTimeout = null;
        }
        
        this.scheduleNextWeather();
        MessageManager.showPlayerMessage("The blizzard subsides, your surroundings becoming familiar once again...", MESSAGE_TYPES.TERRAIN);
    },

    triggerWhiteout() {
        // Access global variables using window
        if (!window.gameRunning || WEATHER.state.whiteoutActive || WEATHER.state.blizzardActive) return;
        
        WEATHER.state.whiteoutActive = true;
        WEATHER.state.whiteoutPhase = true;
        const whiteoutOverlay = document.getElementById('whiteoutOverlay');
        const player = document.getElementById('player');
        const statsContainer = document.querySelector('.stats-container');
        
        MessageManager.showPlayerMessage("The air grows thick with snow...", MESSAGE_TYPES.STATUS);
        player.classList.add('whiteout-fade');
        
        setTimeout(() => {
            document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
                hex.style.opacity = '0';
            });
            whiteoutOverlay.setAttribute("opacity", "1");
            player.style.opacity = '0';
            statsContainer.classList.add('whiteout-stats');
            
            document.body.style.backgroundColor = '#FFFFFF';
            document.querySelector('.game-container').style.backgroundColor = '#FFFFFF';
            document.querySelector('.grid-container').style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            
            VisibilityManager.updateVisibility(false);
            MessageManager.updateCurrentLocationInfo();
            
            setTimeout(() => {
                setTimeout(() => {
                    window.visitedHexes.clear();
                    window.visitedHexes.add(`${window.playerPosition.q},${window.playerPosition.r}`);
                    
                    document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
                        hex.style.opacity = '1';
                    });
                    player.style.opacity = '1';
                    whiteoutOverlay.setAttribute("opacity", "0");
                    WEATHER.state.whiteoutPhase = false;
                    
                    statsContainer.classList.remove('whiteout-stats');
                    
                    document.body.style.backgroundColor = '#1B4B7C';
                    document.querySelector('.game-container').style.backgroundColor = '';
                    document.querySelector('.grid-container').style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                    
                    VisibilityManager.updateVisibility(false);
                    
                    setTimeout(() => {
                        player.classList.remove('whiteout-fade');
                        this.handleWhiteoutComplete();
                    }, WEATHER.CONFIG.WHITEOUT.FADE_OUT_DURATION);
                    
                }, WEATHER.CONFIG.WHITEOUT.HOLD_DURATION);
                
            }, WEATHER.CONFIG.WHITEOUT.FADE_IN_DURATION);
        }, 100);
    },

    handleWhiteoutComplete() {
        WEATHER.state.whiteoutActive = false;
        StatsManager.updateStatsDisplay();
        MessageManager.updateCurrentLocationInfo();
        this.scheduleNextWeather();
        MessageManager.showPlayerMessage("The white out phenomenon clears, but nothing looks familiar anymore...", MESSAGE_TYPES.TERRAIN);
    },

    scheduleNextWeather() {
        // Access global variables using window
        if (!window.gameRunning || window.gameWon) return;
    
        if (WEATHER.state.weatherTimeout) {
            clearTimeout(WEATHER.state.weatherTimeout);
        }
        
        const isBlizzard = Math.random() < 0.7;
        const config = isBlizzard ? WEATHER.CONFIG.BLIZZARD : WEATHER.CONFIG.WHITEOUT;
        
        const nextInterval = config.MIN_INTERVAL + 
            Math.random() * (config.MAX_INTERVAL - config.MIN_INTERVAL);
        
        // Expose triggerBlizzard and triggerWhiteout to window for debug access
        window.triggerBlizzard = () => this.triggerBlizzard();
        window.triggerWhiteout = () => this.triggerWhiteout();
        
        WEATHER.state.weatherTimeout = setTimeout(
            () => isBlizzard ? this.triggerBlizzard() : this.triggerWhiteout(),
            nextInterval
        );
    },

    resetWeatherState() {
        // Clear timeouts
        if (WEATHER.state.weatherTimeout) {
            clearTimeout(WEATHER.state.weatherTimeout);
            WEATHER.state.weatherTimeout = null;
        }
    
        // Reset state flags
        WEATHER.state.whiteoutActive = false;
        WEATHER.state.blizzardActive = false;
        WEATHER.state.whiteoutPhase = false;
        WEATHER.state.temporaryFog.clear();
    
        // Reset overlays
        const blizzardOverlay = document.getElementById('blizzardOverlay');
        const whiteoutOverlay = document.getElementById('whiteoutOverlay');
        const player = document.getElementById('player'); // Add player reference
        if (blizzardOverlay) blizzardOverlay.setAttribute("opacity", "0");
        if (whiteoutOverlay) whiteoutOverlay.setAttribute("opacity", "0");
        
        // Reset player visual state
        if (player) {
            player.classList.remove('blizzard-player-fade-in', 'blizzard-player-hold', 'blizzard-player-fade-out', 'whiteout-fade');
            player.style.opacity = '1';
        }
        
        // Reset terrain visibility
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.style.opacity = '1';
        });
        
        // Reset stats container
        const statsContainer = document.querySelector('.stats-container');
        if (statsContainer) {
            statsContainer.classList.remove('whiteout-stats');
        }
        
        // Reset fog
        document.querySelectorAll('.fog').forEach(fogHex => {
            fogHex.classList.remove('blizzard-fade');
            fogHex.classList.remove('movement-fade');
            fogHex.classList.add('movement-fade');
            fogHex.setAttribute('fill-opacity', '1');
        });
    
        // Reset body and container colors
        document.body.style.backgroundColor = '#1B4B7C';
        const gameContainer = document.querySelector('.game-container');
        const gridContainer = document.querySelector('.grid-container');
        if (gameContainer) gameContainer.style.backgroundColor = '';
        if (gridContainer) gridContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    },

    // Add debug method to manually trigger weather
    debugTriggerWeather(type) {
        if (type === 'blizzard') {
            this.triggerBlizzard();
        } else if (type === 'whiteout') {
            this.triggerWhiteout();
        }
    }
};