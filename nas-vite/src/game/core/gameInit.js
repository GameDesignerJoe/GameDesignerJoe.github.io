// src/game/core/gameInit.js

const isDevelopment = true;  // Will be false in production builds

import { gameStore } from '../../state/store';
import { GameState, TERRAIN_TYPES, SPECIAL_LOCATIONS } from './gameState.js';
import { WeatherState } from './weatherState.js';
import { GridManager } from './grid.js';
import { StatsManager } from '../stats.js';
import { MessageManager } from '../ui/messages.js';
import { WeatherManager } from '../weather.js';
import { MovementManager } from '../movement.js';
import { VisibilityManager } from '../visibility.js';
import { PLAYER_COLORS } from '../constants.js';

export const GameInitializer = {
    init() {
        // Initialize core game state
        this.initializeState();
        
        // Create weather overlays
        WeatherManager.createWeatherElements();
        
        // Set up the game grid
        GridManager.createHexGrid();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Update initial visibility
        VisibilityManager.updateVisibleHexes();
        VisibilityManager.updateVisibility(false);
        
        // Start game loops
        this.startGameLoops();
        
        // Show initial message
        MessageManager.showInitialMessage();
        
        // Set up debug features if in development
        if (isDevelopment) {
            this.setupDebugFeatures();
        }
    },

    initializeState() {
        // Initialize world state
        GameState.world.baseCamp = { q: 0, r: 0 };
        GameState.player.position = { ...GameState.world.baseCamp };
        GameState.world.visitedHexes.add(`${GameState.world.baseCamp.q},${GameState.world.baseCamp.r}`);
    
    },

    setupEventListeners() {
        // Restart button functionality
        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            restartBtn.addEventListener('click', this.handleRestart.bind(this));
        }

        // Set up hex click handlers
        const gameGrid = document.getElementById('gameGrid');
        if (gameGrid) {
            gameGrid.addEventListener('click', (event) => {
                const hex = event.target.closest('polygon');
                if (hex) {
                    const q = parseInt(hex.getAttribute('data-q'));
                    const r = parseInt(hex.getAttribute('data-r'));
                    const terrain = hex.getAttribute('data-terrain');
                    const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                                      terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                                      TERRAIN_TYPES[terrain];
                    
                    MovementManager.handleHexSelection(hex, q, r, terrainInfo);
                }
            });
        }

        // Prevent default touch behavior for mobile
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('#gameGrid')) {
                e.preventDefault();
            }
        }, { passive: false });
    },

    startGameLoops() {
        // Start the stats update loop
        setInterval(() => StatsManager.updateStats(), 50);
        
        // Schedule first weather event with delay
        setTimeout(() => {
            if (GameState.game.running && !GameState.game.won) {
                WeatherManager.scheduleNextWeather();
            }
        }, 5000);
    },

    handleRestart() {
        // Reset game state
        GameState.game.won = false;
        GameState.game.running = true;
        GameState.world.southPoleSpotted = false;
        GameState.world.southPoleVisited = false;

        // Reset player state
        GameState.player.position = { ...GameState.world.baseCamp };
        GameState.world.visitedHexes.clear();
        GameState.world.visitedHexes.add(`${GameState.world.baseCamp.q},${GameState.world.baseCamp.r}`);
        GameState.world.selectedHex = null;

        // Reset UI elements
        const restartBtn = document.getElementById('restart-button');
        restartBtn.classList.add('hidden');
        restartBtn.style.display = 'none';

        // Reset player marker
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute("fill", PLAYER_COLORS.DEFAULT);
            const center = MovementManager.getHexCenter(
                GameState.world.baseCamp.q, 
                GameState.world.baseCamp.r
            );
            player.setAttribute("cx", center.x);
            player.setAttribute("cy", center.y);
        }

        // Reset weather and visibility
        WeatherManager.resetWeatherState();
        VisibilityManager.updateVisibility(false);
        
        // Reset UI and start new game loop
        StatsManager.updateStatsDisplay();
        MessageManager.updateCurrentLocationInfo();
        MessageManager.showInitialMessage();
        
        // Schedule new weather events
        setTimeout(() => {
            if (GameState.game.running && !GameState.game.won) {
                WeatherManager.scheduleNextWeather();
            }
        }, 5000);
    },

    setupDebugFeatures() {
        // Make key functions available in console for debugging
        if (process.env.NODE_ENV === 'development') {
            window.DEBUG = gameStore.DEBUG;
            console.log('Debug mode active - use window.DEBUG to access debug functions');
        }

        console.log('Debug mode active - use window.DEBUG to access debug functions');
    }
};

export default GameInitializer;