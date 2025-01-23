// src/state/store.js

import { GameState } from './game/gameState';
import { WeatherState } from './core/weatherState';

// Create a central store object that will replace window assignments
export const gameStore = {
    // Core state
    game: GameState,
    weather: WeatherState,

    // Commonly accessed properties (for convenience and backward compatibility)
    get playerPosition() {
        return this.game.player.position;
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

    // Debug helpers (only in development)
    ...(process.env.NODE_ENV === 'development' ? {
        DEBUG: {
            getFullState() {
                return {
                    game: { ...gameStore.game },
                    weather: { ...gameStore.weather }
                };
            }
        }
    } : {})
};

// Prevent direct modifications in production
if (process.env.NODE_ENV === 'production') {
    Object.freeze(gameStore);
}