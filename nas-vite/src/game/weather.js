// src/game/weather.js

import { WeatherState, WEATHER_CONFIG, WEATHER_EFFECTS } from './core/weatherState.js';
import { GameState } from './core/gameState.js';
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';
import { VisibilityManager } from './visibility.js';
import { StatsManager } from './stats.js';

export const WeatherManager = {
    createWeatherElements() {
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
    },

    triggerBlizzard() {
        if (!GameState.game.running || WeatherState.effects.blizzardActive || WeatherState.effects.whiteoutActive) return;

        // Initialize blizzard state
        WeatherState.methods.startWeatherEvent('BLIZZARD');
        
        const blizzardOverlay = document.getElementById('blizzardOverlay');
        const player = document.getElementById('player');
        
        // Store visibility state before blizzard
        WeatherState.visibility.temporaryFog = new Set([...GameState.world.visitedHexes]);
        
        // Start visual transition
        document.querySelectorAll('.fog').forEach(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            const isCurrentPosition = hexId === `${GameState.player.position.q},${GameState.player.position.r}`;
            
            if (!isCurrentPosition) {
                fogHex.classList.add('blizzard-fade');
                fogHex.setAttribute('fill-opacity', '1');
            }
        });
        
        // Player fade effect
        player.classList.add('blizzard-player-fade-in');
        
        MessageManager.showPlayerMessage("A blizzard sweeps in, obscuring your view...", MESSAGE_TYPES.STATUS);
        
        // Blizzard phases
        setTimeout(() => {
            WeatherState.methods.updateWeatherPhase('fadeIn');
            blizzardOverlay.setAttribute("opacity", String(WEATHER_EFFECTS.OVERLAY_OPACITY.BLIZZARD));
            
            setTimeout(() => {
                player.classList.remove('blizzard-player-fade-in');
                player.classList.add('blizzard-player-hold');
                player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.BLIZZARD);
                
                WeatherState.methods.updateWeatherPhase('hold');
                VisibilityManager.updateVisibility(true);
                
                setTimeout(() => {
                    WeatherState.methods.updateWeatherPhase('fadeOut');
                    blizzardOverlay.setAttribute("opacity", "0");
                    
                    player.classList.remove('blizzard-player-hold');
                    player.classList.add('blizzard-player-fade-out');
                    
                    document.querySelectorAll('.fog').forEach(fogHex => {
                        fogHex.classList.remove('blizzard-fade');
                    });
                    
                    WeatherState.effects.weatherTimeout = setTimeout(() => {
                        player.classList.remove('blizzard-player-fade-out');
                        player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
                        
                        this.handleBlizzardComplete();
                    }, WEATHER_CONFIG.BLIZZARD.transitions.fadeOut);
                    
                }, WEATHER_CONFIG.BLIZZARD.transitions.hold);
                
            }, WEATHER_CONFIG.BLIZZARD.transitions.fadeIn);
        }, 100);
    },

    handleBlizzardComplete() {
        if (!WeatherState.effects.blizzardActive) return;
        
        // Reset weather state
        WeatherState.methods.clearWeather();
        
        // Restore visibility
        GameState.world.visitedHexes = new Set([...WeatherState.visibility.temporaryFog]);
        WeatherState.visibility.temporaryFog.clear();
        VisibilityManager.updateVisibility(false);
        
        // Update UI
        StatsManager.updateStatsDisplay();
        MessageManager.updateCurrentLocationInfo();
        MessageManager.showPlayerMessage("The blizzard subsides, your surroundings becoming familiar once again...", MESSAGE_TYPES.TERRAIN);
        
        // Schedule next weather event
        this.scheduleNextWeather();
    },

    triggerWhiteout() {
        if (!GameState.game.running || WeatherState.effects.whiteoutActive || WeatherState.effects.blizzardActive) return;
        
        // Initialize whiteout state
        WeatherState.methods.startWeatherEvent('WHITEOUT');
        
        const whiteoutOverlay = document.getElementById('whiteoutOverlay');
        const player = document.getElementById('player');
        const statsContainer = document.querySelector('.stats-container');
        
        MessageManager.showPlayerMessage("The air grows thick with snow...", MESSAGE_TYPES.STATUS);
        player.classList.add('whiteout-fade');
        
        setTimeout(() => {
            this.applyWhiteoutEffects(player, whiteoutOverlay, statsContainer);
            
            setTimeout(() => {
                setTimeout(() => {
                    this.removeWhiteoutEffects(player, whiteoutOverlay, statsContainer);
                    
                    setTimeout(() => {
                        player.classList.remove('whiteout-fade');
                        this.handleWhiteoutComplete();
                    }, WEATHER_CONFIG.WHITEOUT.transitions.fadeOut);
                    
                }, WEATHER_CONFIG.WHITEOUT.transitions.hold);
                
            }, WEATHER_CONFIG.WHITEOUT.transitions.fadeIn);
        }, 100);
    },

    applyWhiteoutEffects(player, whiteoutOverlay, statsContainer) {
        // Hide terrain
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.HIDDEN);
        });

        // Update fog hexes
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
        
        // Whiten background elements
        document.body.style.backgroundColor = '#FFFFFF';
        document.querySelector('.game-container').style.backgroundColor = '#FFFFFF';
        document.querySelector('.grid-container').style.backgroundColor = '#FFFFFF';
        document.getElementById('gameGrid').style.background = 'white';
        
        VisibilityManager.updateVisibility(false);
        MessageManager.updateCurrentLocationInfo();
    },

    removeWhiteoutEffects(player, whiteoutOverlay, statsContainer) {
        // Reset visited hexes except current position
        GameState.world.visitedHexes.clear();
        GameState.world.visitedHexes.add(
            `${GameState.player.position.q},${GameState.player.position.r}`
        );
        
        // Restore terrain and fog visibility
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
        });

        document.querySelectorAll('.fog').forEach(fogHex => {
            fogHex.classList.add('movement-fade');
            fogHex.setAttribute('fill', 'white');
            fogHex.setAttribute('fill-opacity', '1');
        });

        // Reset visual effects
        document.getElementById('gameGrid').style.background = '';
        player.style.opacity = String(WEATHER_EFFECTS.PLAYER_OPACITY.NORMAL);
        whiteoutOverlay.setAttribute("opacity", "0");
        WeatherState.effects.whiteoutPhase = false;
        statsContainer.classList.remove('whiteout-stats');
        
        // Restore background colors
        document.body.style.backgroundColor = '#1B4B7C';
        document.querySelector('.game-container').style.backgroundColor = '';
        document.querySelector('.grid-container').style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        
        VisibilityManager.updateVisibility(false);
    },

    handleWhiteoutComplete() {
        WeatherState.methods.clearWeather();
        StatsManager.updateStatsDisplay();
        MessageManager.updateCurrentLocationInfo();
        this.scheduleNextWeather();
        MessageManager.showPlayerMessage(
            "The white out phenomenon clears, but nothing looks familiar anymore...", 
            MESSAGE_TYPES.TERRAIN
        );
    },

    scheduleNextWeather() {
        if (!GameState.game.running || GameState.game.won) return;

        if (WeatherState.effects.weatherTimeout) {
            clearTimeout(WeatherState.effects.weatherTimeout);
        }
        
        const isBlizzard = Math.random() < 0.7;
        const config = isBlizzard ? WEATHER_CONFIG.BLIZZARD : WEATHER_CONFIG.WHITEOUT;
        
        const nextInterval = config.scheduling.minInterval + 
            Math.random() * (config.scheduling.maxInterval - config.scheduling.minInterval);
        
        WeatherState.methods.scheduleNextWeather(Date.now() + nextInterval);
        
        WeatherState.effects.weatherTimeout = setTimeout(
            () => isBlizzard ? this.triggerBlizzard() : this.triggerWhiteout(),
            nextInterval
        );
    },

    resetWeatherState() {
        WeatherState.methods.clearWeather();
        
        // Reset visual elements
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
        if (statsContainer) {
            statsContainer.classList.remove('whiteout-stats');
        }
        
        // Reset terrain and fog
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.style.opacity = String(WEATHER_EFFECTS.TERRAIN_OPACITY.NORMAL);
        });
        
        document.querySelectorAll('.fog').forEach(fogHex => {
            fogHex.classList.remove('blizzard-fade');
            fogHex.classList.remove('movement-fade');
            fogHex.classList.add('movement-fade');
            fogHex.setAttribute('fill-opacity', '1');
        });
        
        // Reset colors
        document.body.style.backgroundColor = '#1B4B7C';
        const gameContainer = document.querySelector('.game-container');
        const gridContainer = document.querySelector('.grid-container');
        if (gameContainer) gameContainer.style.backgroundColor = '';
        if (gridContainer) gridContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    }
};

export default WeatherManager;