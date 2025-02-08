// src/state/game/gameState.js

import { GAME_CONFIG } from '../../config/constants.js';

export const GameState = {
    // Game status
    running: true,
    won: false,
    difficultyLevel: 1,
    timeElapsed: 0,
    lastUpdate: Date.now(),
    isCamping: false,

    // World state
    world: {
        southPole: null,
        southPoleSpotted: false,
        southPoleVisited: false,
        baseCamp: null,
        selectedHex: null,
        visibleHexes: new Set(),
        visitedHexes: new Set(),
        terrain: {},  // Will be populated with hex coordinates and their terrain types
        shownThresholds: new Set()  // Track shown starvation thresholds
    },

    // Methods
    resetGame() {
        this.won = false;
        this.running = true;
        this.timeElapsed = 0;
        this.isCamping = false;
        this.world.southPoleSpotted = false;
        this.world.southPoleVisited = false;
        this.world.visitedHexes.clear();
        this.world.shownThresholds.clear();
        this.lastUpdate = Date.now();
    },

    pauseGame() {
        this.running = false;
    },

    resumeGame() {
        this.running = true;
        this.lastUpdate = Date.now();
    },

    winGame() {
        this.won = true;
        this.running = false;
    },

    hasShownThreshold(threshold) {
        return this.world.shownThresholds.has(threshold);
    },

    markThresholdShown(threshold) {
        this.world.shownThresholds.add(threshold);
    },

    updateTimeElapsed() {
        if (!this.running) return;
        const now = Date.now();
        this.timeElapsed += now - this.lastUpdate;
        this.lastUpdate = now;
    }
};

// Bind all methods to GameState
Object.getOwnPropertyNames(GameState)
    .filter(prop => typeof GameState[prop] === 'function')
    .forEach(method => {
        GameState[method] = GameState[method].bind(GameState);
    });

export default GameState;
