// src/config/weatherConfig.js

export const WEATHER_CONFIG = {
    WHITEOUT: {
        name: "Whiteout",
        healthDecayMultiplier: 1.05,
        transitions: {
            fadeIn: 15000,    // 15 seconds
            hold: 10000,      // 10 seconds
            fadeOut: 8000     // 8 seconds
        },
        scheduling: {
            minInterval: 120000,  // 2 minutes
            maxInterval: 240000   // 4 minutes
        },
        visibility: {
            range: 1,            // Visible hex distance during whiteout
            fogDensity: 1.0      // Maximum fog density
        }
    },
    
    BLIZZARD: {
        name: "Blizzard",
        healthDecayMultiplier: 1.02,
        transitions: {
            fadeIn: 5000,     // 5 seconds
            hold: 15000,      // 15 seconds
            fadeOut: 10000    // 10 seconds
        },
        scheduling: {
            minInterval: 45000,   // 45 seconds
            maxInterval: 90000    // 1.5 minutes
        },
        visibility: {
            range: 2,            // Visible hex distance during blizzard
            fogDensity: 0.8      // Maximum fog density
        }
    }
};

export const WEATHER_EFFECTS = {
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