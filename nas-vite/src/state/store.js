// src/state/store.js
import { GameState } from './game/gameState.js';
import { WeatherState } from './game/weatherState.js';
import { PlayerState } from './game/playerState.js';
import { CompassState } from './game/compassState.js';

// Simplified Debug State - only stores state, no functionality
const DebugState = {
    fogRevealActive: false,
    godModeActive: false,
    zoomLevel: 1,
    originalVisitedHexes: new Set()
};

// Create a central store object that will replace window assignments
export const gameStore = {
    // Core states
    game: GameState,
    weather: WeatherState,
    player: PlayerState,
    compass: CompassState,
    debug: DebugState,

    // Commonly accessed properties (for convenience)
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

    messages: null,
    compassSystem: null,
    
    // Simplified DEBUG object - just for state inspection
    DEBUG: {
        getFullState() {
            return {
                game: { ...gameStore.game },
                weather: { ...gameStore.weather },
                player: { ...gameStore.player },
                compass: { ...gameStore.compass },
                debug: { ...gameStore.debug }
            };
        },
        logState() {
            console.log('Current Game State:', this.getFullState());
        }
    }
};

// Prevent direct modifications in production
const isDevelopment = true;  // Match your existing development flag
if (!isDevelopment) {
    Object.freeze(gameStore);
}