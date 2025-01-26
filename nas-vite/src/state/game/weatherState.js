// src/state/game/weatherState.js

// src/state/game/weatherState.js
import { WEATHER_CONFIG } from '../config/weatherConfig.js';

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

    // Methods for state updates
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

// Create and export the WeatherState instance with properly bound methods
const weatherState = createWeatherState();
Object.keys(weatherState.methods).forEach(method => {
    weatherState.methods[method] = weatherState.methods[method].bind(weatherState);
});

export const WeatherState = weatherState;
export default WeatherState;