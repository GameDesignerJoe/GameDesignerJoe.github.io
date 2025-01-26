// src/services/gameInit.js
import { gameStore } from '../state/store.js';
import { WeatherSystem } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { GridManager } from './gridManager.js';
import { VisibilityManager } from './visibility.js';
import { StatsService } from './stats.js';
import { DebugManager } from '../utils/debug.js';
import { RestartSystem } from '../core/restart.js';

export const GameInit = {
    debugManager: null,

    init() {
        // Initialize core game state
        this.initializeState();
        
        // Initialize message system first (since other systems need it)
        this.messageSystem = new MessageSystem(gameStore);
        gameStore.messages = this.messageSystem;
        
        // Initialize weather system
        this.weatherSystem = new WeatherSystem(
            gameStore,
            this.messageSystem,
            VisibilityManager,
            StatsService
        );
    
        // Initialize restart system and store it in gameStore
        this.restartSystem = new RestartSystem(
            gameStore,
            this.weatherSystem,
            StatsService
        );
        gameStore.restartSystem = this.restartSystem;  // Add this line
        
        // Initialize StatsService with restart system
        StatsService.init(this.restartSystem);
        
        // Set up the game grid
        GridManager.initializeGrid();
        
        // Initialize debug features (which needs weatherSystem)
        this.setupDebugFeatures();
        
        // Start game loops
        this.startGameLoops();
        
        // Show initial message
        gameStore.messages.showInitialMessage();
    },

    initializeState() {
        // Initialize visibility for base camp
        gameStore.game.world.visitedHexes.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        // Make adjacent hexes visible
        const adjacentHexes = VisibilityManager.getAdjacentHexes(gameStore.playerPosition);
        adjacentHexes.forEach(hex => {
            gameStore.game.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });
    },

    startGameLoops() {
        // Start the stats update loop
        setInterval(() => StatsService.updateStats(), 50);
        
        // Schedule first weather event with delay
        const self = this;  // Store reference to 'this' for the timeout
        setTimeout(() => {
            if (gameStore.gameRunning && !gameStore.gameWon) {
                self.weatherSystem.scheduleNextWeather();
            }
        }, 5000);
    },

    setupDebugFeatures() {
        // Clean up existing debug manager if it exists
        if (this.debugManager) {
            this.debugManager.cleanup();
        }
    
        // Create new debug manager
        this.debugManager = new DebugManager(gameStore, this.weatherSystem);
    
        // Make debug functions available in console for direct access
        window.DEBUG = {
            ...gameStore.DEBUG,
            triggerBlizzard: () => this.weatherSystem.triggerBlizzard(),
            triggerWhiteout: () => this.weatherSystem.triggerWhiteout(),
            getGameState: () => ({ ...gameStore.game }),
            getWeatherState: () => ({ ...gameStore.weather }),
            toggleFogOfWar: () => this.debugManager.toggleFogOfWar(),
            toggleGodMode: () => this.debugManager.toggleGodMode(),
            adjustZoom: (direction) => this.debugManager.adjustZoom(direction)
        };
    },

    handleRestart() {
        // Reset game state
        gameStore.game.resetGame();
        gameStore.player.resetStats();
        
        // Reset grid and visibility
        GridManager.initializeGrid();
        VisibilityManager.updateVisibility(false);
        
        // Reset weather
        this.WeatherSystem.resetWeatherState();
        
        // Clean up and reinitialize debug manager
        if (this.debugManager) {
            this.debugManager.cleanup();
        }
        this.setupDebugFeatures();
        
        // Update UI
        StatsService.updateStatsDisplay();
        gameStore.messages.showInitialMessage();
        
        // Schedule new weather events
        setTimeout(() => {
            if (gameStore.gameRunning && !gameStore.gameWon) {
                this.WeatherSystem.scheduleNextWeather();
            }
        }, 5000);
    }
};

export default GameInit;