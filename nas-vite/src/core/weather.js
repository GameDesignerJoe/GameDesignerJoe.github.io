// src/core/weather.js
import perfMonitor from './performanceMonitor.js';

export const WEATHER_CONFIG = {
    WHITEOUT: {
        name: "Whiteout",
        healthDecayMultiplier: 1.20,
        transitions: {
            fadeIn: 15000,
            hold: 10000,
            fadeOut: 8000
        },
        scheduling: {
            minInterval: 120000,
            maxInterval: 240000
        },
        visibility: {
            range: 1,
            fogDensity: 1.0
        }
    },
    BLIZZARD: {
        name: "Blizzard",
        healthDecayMultiplier: 1.10,
        transitions: {
            fadeIn: 5000,
            hold: 15000,
            fadeOut: 10000
        },
        scheduling: {
            minInterval: 45000,
            maxInterval: 90000
        },
        visibility: {
            range: 2,
            fogDensity: 0.8
        }
    }
};

export const WEATHER_EFFECTS = {
    OVERLAY_OPACITY: {
        BLIZZARD: 0.5,
        WHITEOUT: 1.0
    },
    PLAYER_OPACITY: {
        NORMAL: 1.0,
        BLIZZARD: 0.25,
        WHITEOUT: 0.0
    },
    TERRAIN_OPACITY: {
        NORMAL: 1.0,
        WEATHER_AFFECTED: 0.5,
        HIDDEN: 0.0
    }
};

export class WeatherSystem {
    constructor(gameStore, messageSystem, visibilityManager, statsService) {
        this.store = gameStore;
        this.messageSystem = messageSystem;
        this.visibilityManager = visibilityManager;
        this.statsService = statsService;
        
        // Initialize performance monitoring
        this.initPerformanceMonitoring();
        
        // Initialize weather overlays
        this.initWeatherElements();
    }

    initPerformanceMonitoring() {
        const methodsToTrack = [
            'triggerBlizzard',
            'triggerWhiteout',
            'handleBlizzardComplete',
            'handleWhiteoutComplete',
            'applyWeatherEffects',
            'removeWeatherEffects',
            'updateWeatherOverlay',
            'updateFogElements'
        ];

        methodsToTrack.forEach(method => {
            const original = this[method];
            this[method] = (...args) => {
                const start = performance.now();
                const result = original.apply(this, args);
                const end = performance.now();
                perfMonitor.trackMethod(method, 'weather.js', end - start);
                return result;
            };
        });

        // Create wrapped version of setTimeout for weather transitions
        this._wrappedTimeout = (callback, delay) => {
            return setTimeout(() => {
                const start = performance.now();
                callback();
                const end = performance.now();
                perfMonitor.trackMethod('weatherTransition', 'weather.js', end - start);
            }, delay);
        };
    }

    // New method to batch update fog elements
    updateFogElements(action) {
        const fogElements = document.querySelectorAll('.fog');
        const start = performance.now();
        
        requestAnimationFrame(() => {
            fogElements.forEach(fogHex => action(fogHex));
            const end = performance.now();
            perfMonitor.trackMethod('updateFogElements', 'weather.js', end - start);
        });
    }

    // New method to update weather overlay
    updateWeatherOverlay(type, opacity) {
        const overlay = document.getElementById(`${type.toLowerCase()}Overlay`);
        if (overlay) {
            requestAnimationFrame(() => {
                const start = performance.now();
                overlay.setAttribute("opacity", String(opacity));
                const end = performance.now();
                perfMonitor.trackMethod('updateOverlay', 'weather.js', end - start);
            });
        }
    }

    initWeatherElements() {
        const gameGrid = document.getElementById('gameGrid');
        if (!gameGrid) return;

        // Create blizzard overlay
        const blizzardRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        blizzardRect.setAttribute("id", "blizzardOverlay");
        blizzardRect.setAttribute("class", "blizzard-overlay");
        blizzardRect.setAttribute("x", "-150");
        blizzardRect.setAttribute("y", "-150");
        blizzardRect.setAttribute("width", "300");
        blizzardRect.setAttribute("height", "300");
        blizzardRect.setAttribute("fill", "white");
        blizzardRect.setAttribute("opacity", "0");

        // Create whiteout overlay
        const whiteoutRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        whiteoutRect.setAttribute("id", "whiteoutOverlay");
        whiteoutRect.setAttribute("class", "whiteout-overlay");
        whiteoutRect.setAttribute("x", "-150");
        whiteoutRect.setAttribute("y", "-150");
        whiteoutRect.setAttribute("width", "300");
        whiteoutRect.setAttribute("height", "300");
        whiteoutRect.setAttribute("fill", "white");
        whiteoutRect.setAttribute("opacity", "0");

        gameGrid.appendChild(blizzardRect);
        gameGrid.appendChild(whiteoutRect);
    }

    triggerBlizzard() {
        if (!this.store.gameRunning || 
            this.store.weather.effects.blizzardActive || 
            this.store.weather.effects.whiteoutActive) return;

        // Initialize blizzard state
        this.store.weather.methods.startWeatherEvent('BLIZZARD');
        
        const blizzardOverlay = document.getElementById('blizzardOverlay');
        const player = document.getElementById('player');
        
        if (!player || !blizzardOverlay) return;
        
        // Store visibility state before blizzard
        this.store.weather.visibility.temporaryFog = new Set([...this.store.visitedHexes]);
        
        // Apply fog effects with performance tracking
        this.updateFogElements(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            const isCurrentPosition = hexId === `${this.store.playerPosition.q},${this.store.playerPosition.r}`;
            
            if (!isCurrentPosition) {
                fogHex.classList.add('blizzard-fade');
                fogHex.setAttribute('fill-opacity', '1');
            }
        });
        
        // Player fade effect
        player.classList.add('blizzard-player-fade-in');
        
        this.store.messages.showPlayerMessage("A blizzard sweeps in...", "STATUS");
        
        // Blizzard phases with performance tracking
        this._wrappedTimeout(() => {
            this.store.weather.methods.updateWeatherPhase('fadeIn');
            this.updateWeatherOverlay('blizzard', WEATHER_EFFECTS.OVERLAY_OPACITY.BLIZZARD);
            
            this._wrappedTimeout(() => {
                player.classList.remove('blizzard-player-fade-in');
                player.classList.add('blizzard-player-hold');
                player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.BLIZZARD);
                
                this.store.weather.methods.updateWeatherPhase('hold');
                this.visibilityManager.updateVisibility(true);
                
                this._wrappedTimeout(() => {
                    this.store.weather.methods.updateWeatherPhase('fadeOut');
                    this.updateWeatherOverlay('blizzard', 0);
                    
                    player.classList.remove('blizzard-player-hold');
                    player.classList.add('blizzard-player-fade-out');
                    
                    this.updateFogElements(fogHex => {
                        fogHex.classList.remove('blizzard-fade');
                    });
                    
                    this.store.weather.effects.weatherTimeout = this._wrappedTimeout(() => {
                        player.classList.remove('blizzard-player-fade-out');
                        player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
                        
                        this.handleBlizzardComplete();
                    }, WEATHER_CONFIG.BLIZZARD.transitions.fadeOut);
                    
                }, WEATHER_CONFIG.BLIZZARD.transitions.hold);
                
            }, WEATHER_CONFIG.BLIZZARD.transitions.fadeIn);
        }, 100);
    }

    // New method to batch update terrain elements
    updateTerrainElements(opacity) {
        const terrainElements = document.querySelectorAll('polygon[data-terrain]');
        requestAnimationFrame(() => {
            const start = performance.now();
            terrainElements.forEach(hex => {
                hex.style.opacity = String(opacity);
            });
            const end = performance.now();
            perfMonitor.trackMethod('updateTerrainElements', 'weather.js', end - start);
        });
    }

    // New method to update background colors
    updateBackgroundColors(isWhiteout) {
        requestAnimationFrame(() => {
            const start = performance.now();
            if (isWhiteout) {
                document.body.style.backgroundColor = '#FFFFFF';
                document.querySelector('.game-container').style.backgroundColor = '#FFFFFF';
                document.querySelector('.grid-container').style.backgroundColor = '#FFFFFF';
                document.getElementById('gameGrid').style.background = 'white';
            } else {
                document.body.style.backgroundColor = '#1B4B7C';
                document.querySelector('.game-container').style.backgroundColor = '';
                document.querySelector('.grid-container').style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                document.getElementById('gameGrid').style.background = '';
            }
            const end = performance.now();
            perfMonitor.trackMethod('updateBackgroundColors', 'weather.js', end - start);
        });
    }

    triggerWhiteout() {
        if (!this.store.gameRunning || 
            this.store.weather.effects.whiteoutActive || 
            this.store.weather.effects.blizzardActive) return;

        this.store.weather.methods.startWeatherEvent('WHITEOUT');
        
        const whiteoutOverlay = document.getElementById('whiteoutOverlay');
        const player = document.getElementById('player');
        const statsContainer = document.querySelector('.stats-container');
        
        if (!whiteoutOverlay || !player || !statsContainer) return;
        
        this.store.messages.showPlayerMessage("The air grows thick with snow...", "STATUS");
        player.classList.add('whiteout-fade');
        
        const applyWhiteoutEffects = () => {
            // Batch update terrain elements
            this.updateTerrainElements(WEATHER_EFFECTS.TERRAIN_OPACITY.HIDDEN);
            
            // Batch update fog elements
            this.updateFogElements(fogHex => {
                fogHex.classList.remove('movement-fade', 'blizzard-fade');
                fogHex.setAttribute('fill-opacity', '1');
                fogHex.setAttribute('fill', 'white');
                fogHex.parentElement.appendChild(fogHex);
            });
            
            // Update overlay and player
            this.updateWeatherOverlay('whiteout', WEATHER_EFFECTS.OVERLAY_OPACITY.WHITEOUT);
            player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.WHITEOUT);
            statsContainer.classList.add('whiteout-stats');
            
            // Update background colors
            this.updateBackgroundColors(true);
        };
        
        const removeWhiteoutEffects = () => {
            // Update overlay and player
            this.updateWeatherOverlay('whiteout', 0);
            player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
            statsContainer.classList.remove('whiteout-stats');
            
            // Update background colors
            this.updateBackgroundColors(false);
            
            // Batch update terrain elements
            this.updateTerrainElements(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
            
            // Batch update fog elements
            this.updateFogElements(fogHex => {
                fogHex.classList.add('movement-fade');
                fogHex.setAttribute('fill', 'white');
                fogHex.setAttribute('fill-opacity', '1');
            });
        };
        
        // Use wrapped timeouts for performance tracking
        this._wrappedTimeout(() => {
            applyWhiteoutEffects();
            
            this._wrappedTimeout(() => {
                this._wrappedTimeout(() => {
                    removeWhiteoutEffects();
                    
                    this._wrappedTimeout(() => {
                        player.classList.remove('whiteout-fade');
                        this.handleWhiteoutComplete();
                    }, WEATHER_CONFIG.WHITEOUT.transitions.fadeOut);
                    
                }, WEATHER_CONFIG.WHITEOUT.transitions.hold);
                
            }, WEATHER_CONFIG.WHITEOUT.transitions.fadeIn);
        }, 100);
    }

    handleBlizzardComplete() {
        if (!this.store.weather.effects.blizzardActive) return;
        
        // Clear weather state
        this.store.weather.methods.clearWeather();
        
        // Instead of directly setting visitedHexes, we should update through the store
        // OLD: this.store.visitedHexes = new Set([...this.store.weather.visibility.temporaryFog]);
        // Instead, we should either:
        this.store.game.world.visitedHexes = new Set([...this.store.weather.visibility.temporaryFog]);
        // OR use a method if one exists:
        // this.store.game.methods.updateVisitedHexes(this.store.weather.visibility.temporaryFog);
        
        this.store.weather.visibility.temporaryFog.clear();
        this.visibilityManager.updateVisibility(false);
        
        this.statsService.updateStatsDisplay();
        this.store.messages.updateCurrentLocationInfo();
        this.store.messages.showPlayerMessage(
            "The blizzard subsides, your surroundings becoming familiar once again...", 
            "TERRAIN"
        );
        
        this.scheduleNextWeather();
    }

    handleWhiteoutComplete() {
        this.store.weather.methods.clearWeather();
        this.statsService.updateStatsDisplay();
        this.store.messages.updateCurrentLocationInfo();
        this.scheduleNextWeather();
        this.store.messages.showPlayerMessage(
            "The white out phenomenon clears, but nothing looks familiar anymore...", 
            "TERRAIN"
        );
    }

    scheduleNextWeather() {
        if (!this.store.gameRunning || this.store.gameWon) return;

        if (this.store.weather.effects.weatherTimeout) {
            clearTimeout(this.store.weather.effects.weatherTimeout);
        }
        
        const isBlizzard = Math.random() < 0.7;
        const config = isBlizzard ? WEATHER_CONFIG.BLIZZARD : WEATHER_CONFIG.WHITEOUT;
        
        const nextInterval = config.scheduling.minInterval + 
            Math.random() * (config.scheduling.maxInterval - config.scheduling.minInterval);
        
        this.store.weather.methods.scheduleNextWeather(Date.now() + nextInterval);
        
        this.store.weather.effects.weatherTimeout = setTimeout(
            () => isBlizzard ? this.triggerBlizzard() : this.triggerWhiteout(),
            nextInterval
        );
    }

    resetWeatherState() {
        const start = performance.now();
        
        this.store.weather.methods.clearWeather();
        
        // Reset overlays and player state in a single frame
        requestAnimationFrame(() => {
            const player = document.getElementById('player');
            const statsContainer = document.querySelector('.stats-container');
            
            // Reset overlays
            this.updateWeatherOverlay('blizzard', 0);
            this.updateWeatherOverlay('whiteout', 0);
            
            // Reset player state
            if (player) {
                player.classList.remove(
                    'blizzard-player-fade-in',
                    'blizzard-player-hold',
                    'blizzard-player-fade-out',
                    'whiteout-fade'
                );
                player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
            }
            if (statsContainer) {
                statsContainer.classList.remove('whiteout-stats');
            }
            
            // Reset terrain and fog in batches
            this.updateTerrainElements(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
            this.updateFogElements(fogHex => {
                fogHex.classList.remove('blizzard-fade', 'movement-fade');
                fogHex.classList.add('movement-fade');
                fogHex.setAttribute('fill-opacity', '1');
            });
            
            // Reset background colors
            this.updateBackgroundColors(false);
            
            const end = performance.now();
            perfMonitor.trackMethod('resetWeatherState', 'weather.js', end - start);
        });
    }
}
