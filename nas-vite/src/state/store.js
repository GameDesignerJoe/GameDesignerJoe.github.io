// src/state/store.js - Updated initialization
import { GameState } from './game/gameState.js';
import { WeatherState } from './game/weatherState.js';
import { PlayerState } from './game/playerState.js';
import { CompassState } from './game/compassState.js';
import { PackingState } from './game/packingState.js';
import { foodState } from './game/foodState.js';

// Ensure all states are properly initialized before use
const initializeGameStore = () => {
    // Create and initialize states
    const store = {
        // Core states
        game: GameState,
        weather: WeatherState,
        player: PlayerState,
        compass: CompassState,
        packing: PackingState,
        food: foodState,
        debug: {
            fogRevealActive: false,
            godModeActive: false,
            zoomLevel: 1,
            originalVisitedHexes: new Set()
        },
        
        // Systems that will be set later
        messages: null,
        compassSystem: null,
        packingSystem: null,
        foodSystem: null,
        inventorySystem: null,

        // Getters
        get playerPosition() {
            return this.player.position;
        },
        get visitedHexes() {
            return this.game.world.visitedHexes;
        },
        get visibleHexes() {
            return this.game.world.visibleHexes;
        },
        get baseCamp() {
            return this.game.world.baseCamp;
        },
        get southPole() {
            return this.game.world.southPole;
        },
        get gameRunning() {
            return this.game.running;
        },
        get gameWon() {
            return this.game.won;
        },
        get isUsingCompass() {
            return this.compass.isActive;
        },
        get selectedItems() {
            return Array.from(this.packing.selectedItems.values());
        },
        get isCamping() {
            return this.game.isCamping;
        },

        // Debug utilities
        DEBUG: {
            getFullState() {
                return {
                    game: { ...store.game },
                    weather: { ...store.weather },
                    player: { ...store.player },
                    compass: { ...store.compass },
                    packing: { ...store.packing },
                    food: { ...store.food },
                    debug: { ...store.debug }
                };
            },
            logState() {
                console.log('Current Game State:', this.getFullState());
            }
        }
    };

    // Initialize states with reference to store
    if (store.packing.init) {
        store.packing.init(store);
    }

    return store;
};

export const gameStore = initializeGameStore();

// Make gameStore globally available
if (typeof window !== 'undefined') {
    window.gameStore = gameStore;
}
