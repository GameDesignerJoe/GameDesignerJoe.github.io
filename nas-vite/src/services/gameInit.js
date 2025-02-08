// src/services/gameInit.js
import { gameStore } from '../state/store.js';
import perfMonitor from '../core/performanceMonitor.js';
import { WeatherSystem } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { GridManager } from './gridManager.js';
import { FoodSystem } from '../core/foodSystem.js';
import { VisibilityManager } from './visibility.js';
import { MovementManager } from './movement.js';
import { StatsService } from './stats.js';
import { DebugManager } from "../components/game/utils/debug.js";
import { RestartSystem } from '../core/restart.js';
import { CompassSystem } from '../core/compass.js';
import { PackingManager } from './packingManager.js';
import { debugPanel } from '../core/debugPanel.js';

export const GameInit = {
    debugManager: null,
    packingManager: null,

    init() {
        // Hide all game elements initially
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        const packingScreen = document.getElementById('packing-screen');
        if (packingScreen) {
            packingScreen.style.display = 'none';
        }

        // Initialize core game state
        this.initializeState();
        
        // Initialize message system first
        this.messageSystem = new MessageSystem(gameStore);
        gameStore.messages = this.messageSystem;

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            // Initialize packing screen
            this.initializePackingScreen();
            
            // Show packing screen with a slight delay to ensure smooth transition
            setTimeout(() => {
                if (packingScreen) {
                    packingScreen.style.display = 'block';
                }
            }, 100);
        });
    },

    initializePackingScreen() {
        const packingContainer = document.getElementById('packing-screen');
        if (!packingContainer) return;

        // Initialize packing manager
        this.packingManager = new PackingManager(packingContainer);
        
        // Set up embark callback
        this.packingManager.onEmbarked = (gameItems) => {
            // Show game container
            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                gameContainer.style.display = 'flex';
            }
            
            // Initialize game with selected items
            this.initializeGameWithItems(gameItems);
        };
        
        gameStore.packingSystem = this.packingManager;
    },

    initializeGameWithItems(gameItems) {
        // Set player inventory
        if (gameStore?.player) {
            if (typeof gameStore.player.initializeInventory === 'function') {
                gameStore.player.initializeInventory(gameItems);
            } else {
                gameStore.player.inventory = gameItems;
            }
        }
        
        // Initialize game systems
        this.initializeGameSystems();
        
        // Start the game
        if (gameStore?.game) {
            gameStore.game.running = true;
        }
    },

    initializeGameSystems() {
        // Initialize performance monitoring for core systems
        VisibilityManager.init();
        GridManager.init();
        // Make GridManager globally accessible
        if (typeof window !== 'undefined') {
            window.gridManager = GridManager;
        }
        MovementManager.init();

        // Initialize weather system
        this.weatherSystem = new WeatherSystem(
            gameStore,
            this.messageSystem,
            VisibilityManager,
            StatsService
        );
    
        // Initialize compass system
        this.compassSystem = new CompassSystem(gameStore, this.messageSystem);
        gameStore.compassSystem = this.compassSystem;

        // Initialize food system
        this.foodSystem = new FoodSystem(gameStore, this.messageSystem);
        gameStore.foodSystem = this.foodSystem;
    
        // Initialize restart system and store it in gameStore
        this.restartSystem = new RestartSystem(
            gameStore,
            this.weatherSystem,
            StatsService
        );
        gameStore.restartSystem = this.restartSystem;
        
        // Initialize StatsService with restart system and set initial stats
        StatsService.init(this.restartSystem);
        gameStore.player.stats = {
            health: 100,
            stamina: 100,
            food: 100
        };
        StatsService.updateStatsDisplay();
        
        // Set up the game grid and UI
        GridManager.initializeGrid();
        GridManager.initializeGameControls();
        
        // Force an initial stats display update
        StatsService.updateStatsDisplay();
        
        // Initialize debug features
        this.setupDebugFeatures();
        
        // Start game loops with performance monitoring
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
        // Start the stats update loop with performance monitoring
        const statsInterval = setInterval(() => {
            const start = performance.now();
            StatsService.updateStats();
            const end = performance.now();
            perfMonitor.trackMethod('statsUpdate', 'stats.js', end - start);
        }, 250); // Reduced frequency to every 250ms instead of 50ms
        
        // Store interval for cleanup
        this.statsInterval = statsInterval;
        
        // Schedule first weather event with delay
        setTimeout(() => {
            if (gameStore.gameRunning && !gameStore.gameWon) {
                this.weatherSystem.scheduleNextWeather();
            }
        }, 5000);
    },

    setupDebugFeatures() {
        try {
            // Clean up existing debug manager if it exists
            if (this.debugManager) {
                this.debugManager.cleanup();
            }
        
            // Create new debug manager
            this.debugManager = new DebugManager(gameStore, this.weatherSystem);
        
            // Make debug functions available in console for direct access
            const debugFunctions = {
                ...gameStore.DEBUG,
                triggerBlizzard: () => this.weatherSystem.triggerBlizzard(),
                triggerWhiteout: () => this.weatherSystem.triggerWhiteout(),
                getGameState: () => ({ ...gameStore.game }),
                getWeatherState: () => ({ ...gameStore.weather }),
                getPackingState: () => ({ ...gameStore.packing }),
                toggleFogOfWar: () => this.debugManager.toggleFogOfWar(),
                toggleGodMode: () => this.debugManager.toggleGodMode(),
                adjustZoom: (direction) => this.debugManager.adjustZoom(direction),
                toggleSouthPoleHighlight: () => this.debugManager.toggleSouthPoleHighlight()
            };

            // Ensure all debug functions are properly bound
            Object.entries(debugFunctions).forEach(([key, func]) => {
                debugFunctions[key] = func.bind(this);
            });

            window.DEBUG = debugFunctions;
        } catch (error) {
            console.error('Failed to initialize debug features:', error);
        }
    }
};

export default GameInit;
