// src/services/gameInit.js
import { gameStore } from '../state/store.js';
import { WeatherSystem } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { GridManager } from './gridManager.js';
import { VisibilityManager } from './visibility.js';
import { StatsService } from './stats.js';
import { DebugManager } from "../components/game/utils/debug.js";
import { RestartSystem } from '../core/restart.js';
import { CompassSystem } from '../core/compass.js';
import { PackingManager } from './packingManager.js';

export const GameInit = {
    debugManager: null,
    packingManager: null,

    init() {
        // Hide game container initially
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        // Initialize core game state
        this.initializeState();
        
        // Initialize message system first
        this.messageSystem = new MessageSystem(gameStore);
        gameStore.messages = this.messageSystem;

        // Initialize packing screen
        this.initializePackingScreen();
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
    
        // Initialize restart system and store it in gameStore
        this.restartSystem = new RestartSystem(
            gameStore,
            this.weatherSystem,
            StatsService
        );
        gameStore.restartSystem = this.restartSystem;
        
        // Initialize StatsService with restart system
        StatsService.init(this.restartSystem);
        
        // Set up the game grid and camping system
        GridManager.initializeGrid();
        GridManager.initializeCampingButton();
        
        // Initialize debug features
        this.setupDebugFeatures();
        
        // Start game loops
        this.startGameLoops();
        
        // Show initial message
        gameStore.messages.showInitialMessage();
    },

    // startGame(selectedItems) {
    //     // Hide packing screen
    //     const packingScreen = document.getElementById('packing-screen');
    //     if (packingScreen) {
    //         packingScreen.style.display = 'none';
    //     }

    //     // Show game elements
    //     const gameElements = document.querySelectorAll('.game-element');
    //     gameElements.forEach(el => el.style.display = 'block');

    //     // Initialize player inventory with selected items
    //     gameStore.player.initializeInventory(selectedItems);

    //     // Initialize rest of game systems
    //     this.initializeGameSystems();
    // },

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
        setTimeout(() => {
            if (gameStore.gameRunning && !gameStore.gameWon) {
                this.weatherSystem.scheduleNextWeather();
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
            getPackingState: () => ({ ...gameStore.packing }),
            toggleFogOfWar: () => this.debugManager.toggleFogOfWar(),
            toggleGodMode: () => this.debugManager.toggleGodMode(),
            adjustZoom: (direction) => this.debugManager.adjustZoom(direction)
        };
    }
};

export default GameInit;