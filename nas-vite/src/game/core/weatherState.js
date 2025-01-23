// src/game/core/weatherState.js

const isDevelopment = true;

// Initialize a factory function to ensure proper state initialization
const createWeatherState = () => ({
    // Current weather conditions
    current: {
        type: null,          // Current weather type (WHITEOUT or BLIZZARD)
        startTime: null,     // When the current weather event started
        phase: null,         // Current phase (fadeIn, hold, fadeOut)
        intensity: 0,        // Current intensity (0-1)
        nextScheduled: null  // Timestamp for next weather event
    },

    // Visibility tracking
    visibility: {
        temporaryFog: new Set(),  // Hexes temporarily hidden by weather
        affectedHexes: new Set(), // Hexes currently affected by weather
        lastUpdate: null          // Last visibility update timestamp
    },

    // Active effects
    effects: {
        whiteoutActive: false,
        blizzardActive: false,
        whiteoutPhase: false,
        weatherTimeout: null
    },

    // Methods for state updates - bind them to the state object
    methods: {
        startWeatherEvent(type) {
            this.current.type = type;
            this.current.startTime = Date.now();
            this.current.phase = 'fadeIn';
            this.current.intensity = 0;
            
            if (type === 'WHITEOUT') {
                this.effects.whiteoutActive = true;
                this.effects.whiteoutPhase = true;
            } else if (type === 'BLIZZARD') {
                this.effects.blizzardActive = true;
            }
        },

        updateWeatherPhase(phase) {
            this.current.phase = phase;
            
            switch (phase) {
                case 'fadeIn':
                    this.current.intensity = 0;
                    break;
                case 'hold':
                    this.current.intensity = 1;
                    break;
                case 'fadeOut':
                    this.current.intensity = 1;
                    break;
                default:
                    this.current.intensity = 0;
            }
        },

        scheduleNextWeather(timestamp) {
            if (!this.current) {
                this.current = { nextScheduled: null };
            }
            this.current.nextScheduled = timestamp;
        },

        clearWeather() {
            this.current.type = null;
            this.current.startTime = null;
            this.current.phase = null;
            this.current.intensity = 0;
            
            this.effects.whiteoutActive = false;
            this.effects.blizzardActive = false;
            this.effects.whiteoutPhase = false;
            
            if (this.effects.weatherTimeout) {
                clearTimeout(this.effects.weatherTimeout);
                this.effects.weatherTimeout = null;
            }
            
            this.visibility.temporaryFog.clear();
            this.visibility.affectedHexes.clear();
        },

        updateVisibility(hexId, isVisible) {
            if (isVisible) {
                this.visibility.temporaryFog.add(hexId);
            } else {
                this.visibility.temporaryFog.delete(hexId);
            }
            this.visibility.lastUpdate = Date.now();
        },

        reset() {
            this.current = {
                type: null,
                startTime: null,
                phase: null,
                intensity: 0,
                nextScheduled: null
            };
            this.visibility.temporaryFog.clear();
            this.visibility.affectedHexes.clear();
            this.visibility.lastUpdate = null;
            this.effects.whiteoutActive = false;
            this.effects.blizzardActive = false;
            this.effects.whiteoutPhase = false;
            this.effects.weatherTimeout = null;
        }
    }
});

// Weather type configurations
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

// Visual effects configuration
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

// Create and export the WeatherState instance with properly bound methods
const weatherState = createWeatherState();
Object.keys(weatherState.methods).forEach(method => {
    weatherState.methods[method] = weatherState.methods[method].bind(weatherState);
});

export const WeatherState = weatherState;

if (!isDevelopment) {
    Object.freeze(WEATHER_CONFIG);
    Object.freeze(WEATHER_EFFECTS);
}

export default WeatherState;