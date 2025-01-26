// src/core/weather.js

const WEATHER_CONFIG = {
    WHITEOUT: {
        name: "Whiteout",
        healthDecayMultiplier: 1.05,
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
        healthDecayMultiplier: 1.02,
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

const WEATHER_EFFECTS = {
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
        
        // Initialize weather overlays
        this.initWeatherElements();
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
        
        // Apply fog effects
        document.querySelectorAll('.fog').forEach(fogHex => {
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
        
        // Blizzard phases
        setTimeout(() => {
            this.store.weather.methods.updateWeatherPhase('fadeIn');
            blizzardOverlay.setAttribute("opacity", String(WEATHER_EFFECTS.OVERLAY_OPACITY.BLIZZARD));
            
            setTimeout(() => {
                player.classList.remove('blizzard-player-fade-in');
                player.classList.add('blizzard-player-hold');
                player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.BLIZZARD);
                
                this.store.weather.methods.updateWeatherPhase('hold');
                this.visibilityManager.updateVisibility(true);
                
                setTimeout(() => {
                    this.store.weather.methods.updateWeatherPhase('fadeOut');
                    blizzardOverlay.setAttribute("opacity", "0");
                    
                    player.classList.remove('blizzard-player-hold');
                    player.classList.add('blizzard-player-fade-out');
                    
                    document.querySelectorAll('.fog').forEach(fogHex => {
                        fogHex.classList.remove('blizzard-fade');
                    });
                    
                    this.store.weather.effects.weatherTimeout = setTimeout(() => {
                        player.classList.remove('blizzard-player-fade-out');
                        player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
                        
                        this.handleBlizzardComplete();
                    }, WEATHER_CONFIG.BLIZZARD.transitions.fadeOut);
                    
                }, WEATHER_CONFIG.BLIZZARD.transitions.hold);
                
            }, WEATHER_CONFIG.BLIZZARD.transitions.fadeIn);
        }, 100);
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
            // Hide terrain
            document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
                hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.HIDDEN);
            });
            
            // Update fog
            document.querySelectorAll('.fog').forEach(fogHex => {
                fogHex.classList.remove('movement-fade', 'blizzard-fade');
                fogHex.setAttribute('fill-opacity', '1');
                fogHex.setAttribute('fill', 'white');
                fogHex.parentElement.appendChild(fogHex);
            });
            
            // Apply overlay effects
            whiteoutOverlay.setAttribute("opacity", String(WEATHER_EFFECTS.OVERLAY_OPACITY.WHITEOUT));
            player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.WHITEOUT);
            statsContainer.classList.add('whiteout-stats');
            
            // Whiten background
            document.body.style.backgroundColor = '#FFFFFF';
            document.querySelector('.game-container').style.backgroundColor = '#FFFFFF';
            document.querySelector('.grid-container').style.backgroundColor = '#FFFFFF';
            document.getElementById('gameGrid').style.background = 'white';
        };
        
        const removeWhiteoutEffects = () => {
            document.getElementById('gameGrid').style.background = '';
            player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
            whiteoutOverlay.setAttribute("opacity", "0");
            statsContainer.classList.remove('whiteout-stats');
            
            document.body.style.backgroundColor = '#1B4B7C';
            document.querySelector('.game-container').style.backgroundColor = '';
            document.querySelector('.grid-container').style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            
            document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
                hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
            });
            
            document.querySelectorAll('.fog').forEach(fogHex => {
                fogHex.classList.add('movement-fade');
                fogHex.setAttribute('fill', 'white');
                fogHex.setAttribute('fill-opacity', '1');
            });
        };
        
        setTimeout(() => {
            applyWhiteoutEffects();
            
            setTimeout(() => {
                setTimeout(() => {
                    removeWhiteoutEffects();
                    
                    setTimeout(() => {
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
        this.store.weather.methods.clearWeather();
        
        const blizzardOverlay = document.getElementById('blizzardOverlay');
        const whiteoutOverlay = document.getElementById('whiteoutOverlay');
        const player = document.getElementById('player');
        const statsContainer = document.querySelector('.stats-container');
        
        if (blizzardOverlay) blizzardOverlay.setAttribute("opacity", "0");
        if (whiteoutOverlay) whiteoutOverlay.setAttribute("opacity", "0");
        if (player) {
            player.classList.remove(
                'blizzard-player-fade-in',
                'blizzard-player-hold',
                'blizzard-player-fade-out',
                'whiteout-fade'
            );
            player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
        }
        if (statsContainer) statsContainer.classList.remove('whiteout-stats');
        
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
        });
        
        document.querySelectorAll('.fog').forEach(fogHex => {
            fogHex.classList.remove('blizzard-fade', 'movement-fade');
            fogHex.classList.add('movement-fade');
            fogHex.setAttribute('fill-opacity', '1');
        });
        
        document.body.style.backgroundColor = '#1B4B7C';
        const gameContainer = document.querySelector('.game-container');
        const gridContainer = document.querySelector('.grid-container');
        if (gameContainer) gameContainer.style.backgroundColor = '';
        if (gridContainer) gridContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    }
}