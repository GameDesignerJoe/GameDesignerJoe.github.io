// src/services/visibility.js
import { gameStore } from '../state/store.js';
import { WeatherState } from '../state/game/weatherState.js';
import { WEATHER_CONFIG } from '../core/weather.js';
import { TERRAIN_TYPES } from '../config/terrain.js';

export const VisibilityManager = {
    // Cache for DOM elements and calculations
    _cache: {
        fogElements: null,
        fogElementsMap: new Map(),
        hexDistances: new Map(),
        lastUpdate: new Set(),
        radiusCache: new Map(), // Cache for hex radius calculations
        temporaryFogCache: new Map(), // Cache for temporary fog calculations
    },

    // Initialize cache
    initCache() {
        if (!this._cache.fogElements) {
            this._cache.fogElements = document.querySelectorAll('.fog');
            this._cache.fogElements.forEach(element => {
                const q = parseInt(element.getAttribute('data-q'));
                const r = parseInt(element.getAttribute('data-r'));
                this._cache.fogElementsMap.set(`${q},${r}`, element);
            });
        }
    },

    // New method to get hexes within a radius
    getHexesInRadius(position, radius) {
        const cacheKey = `${position.q},${position.r}-${radius}`;
        if (this._cache.radiusCache.has(cacheKey)) {
            return [...this._cache.radiusCache.get(cacheKey)];
        }

        const hexes = [];
        // Pre-calculate the cube coordinates for the center position
        const centerCube = {
            x: position.q,
            y: -position.q - position.r,
            z: position.r
        };

        // Use cube coordinates for more efficient distance calculation
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = Math.max(-radius, -dx-radius); dy <= Math.min(radius, -dx+radius); dy++) {
                const dz = -dx - dy;
                if (Math.abs(dz) <= radius) {
                    const hex = {
                        q: centerCube.x + dx,
                        r: centerCube.z + dz
                    };
                    hexes.push(hex);
                }
            }
        }

        // Cache the result
        this._cache.radiusCache.set(cacheKey, [...hexes]);
        
        // Limit cache size to prevent memory issues
        if (this._cache.radiusCache.size > 100) {
            const firstKey = this._cache.radiusCache.keys().next().value;
            this._cache.radiusCache.delete(firstKey);
        }

        return hexes;
    },

    // Modified to use radius parameter, defaulting to 1 for backwards compatibility
    getAdjacentHexes(position, radius = 1) {
        if (radius === 1) {
            // Original adjacent hex logic for radius 1
            const directions = [
                {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
                {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
            ];
            return directions.map(dir => ({
                q: position.q + dir.q,
                r: position.r + dir.r
            }));
        }
        // Use new radius-based method for larger visibility
        return this.getHexesInRadius(position, radius);
    },

    isMountainHex(q, r) {
        const hexId = `${q},${r}`;
        return gameStore.game.world.terrain[hexId] === 'MOUNTAIN';
    },

    clearCaches() {
        this._cache.hexDistances.clear();
        this._cache.radiusCache.clear();
        this._cache.temporaryFogCache.clear();
        this._cache.lastUpdate.clear();
    },

    isHexVisible(hexId) {
        // Use cached visibility result if available
        const visibilityCacheKey = `visibility-${hexId}-${WeatherState.current.type}`;
        if (this._cache.hexDistances.has(visibilityCacheKey)) {
            return this._cache.hexDistances.get(visibilityCacheKey);
        }

        let isVisible = false;
        const [q, r] = hexId.split(',').map(Number);
        const isMountain = this.isMountainHex(q, r);

        if (isMountain) {
            isVisible = WeatherState.current.type !== 'WHITEOUT';
        } else if (gameStore.game.world.visitedHexes.has(hexId)) {
            isVisible = true;
        } else if (WeatherState.current.type === 'WHITEOUT') {
            const distance = this.getHexDistance(
                {q, r},
                gameStore.playerPosition
            );
            isVisible = distance <= WEATHER_CONFIG.WHITEOUT.visibility.range;
        } else if (WeatherState.current.type === 'BLIZZARD') {
            isVisible = WeatherState.visibility.temporaryFog.has(hexId);
        } else {
            isVisible = gameStore.game.world.visibleHexes.has(hexId);
        }

        // Cache the result
        this._cache.hexDistances.set(visibilityCacheKey, isVisible);
        
        return isVisible;
    },

    getHexDistance(hex1, hex2) {
        const cacheKey = `${hex1.q},${hex1.r}-${hex2.q},${hex2.r}`;
        if (this._cache.hexDistances.has(cacheKey)) {
            return this._cache.hexDistances.get(cacheKey);
        }
        
        const distance = (Math.abs(hex1.q - hex2.q) + 
                Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
                Math.abs(hex1.r - hex2.r)) / 2;
        
        this._cache.hexDistances.set(cacheKey, distance);
        return distance;
    },

    updateVisibility(isWeatherEvent = false) {
        this.initCache();
        this.updateVisibleHexes();
        
        // Track which hexes need updates
        const currentUpdate = new Set();
        
        requestAnimationFrame(() => {
            this._cache.fogElementsMap.forEach((fogHex, hexId) => {
                const [q, r] = hexId.split(',').map(Number);
                const isVisible = this.isHexVisible(hexId);
                const isMountain = this.isMountainHex(q, r);
                
                // Only update if visibility state has changed
                const stateKey = `${hexId}-${isVisible}-${isMountain}-${WeatherState.current.type}`;
                if (this._cache.lastUpdate.has(stateKey)) {
                    return;
                }
                
                currentUpdate.add(stateKey);
                
                if (isWeatherEvent) {
                    if (WeatherState.current.type === 'BLIZZARD') {
                        const opacity = isMountain ? '0.5' : (isVisible ? '0.8' : '1');
                        fogHex.style.fillOpacity = opacity;
                        if (isVisible || isMountain) {
                            WeatherState.visibility.affectedHexes.add(hexId);
                        }
                    } else if (WeatherState.current.type === 'WHITEOUT') {
                        fogHex.style.fillOpacity = '1';
                    }
                } else {
                    fogHex.style.fillOpacity = isVisible || isMountain ? '0' : '1';
                }
            });
            
            // Update cache for next comparison
            this._cache.lastUpdate = currentUpdate;
        });

        if (isWeatherEvent && WeatherState.current.type === 'BLIZZARD') {
            this.updateTemporaryFog();
        }
    },

    updateTemporaryFog() {
        const position = gameStore.playerPosition;
        const cacheKey = `${position.q},${position.r}`;
        
        // Check if we have a cached result for this position
        if (this._cache.temporaryFogCache.has(cacheKey)) {
            const cachedFog = this._cache.temporaryFogCache.get(cacheKey);
            WeatherState.visibility.temporaryFog = new Set(cachedFog);
            return;
        }
        
        // Get visible hexes with optimized radius calculation
        const visibleHexes = this.getAdjacentHexes(position, 2);
        const fogHexes = new Set([`${position.q},${position.r}`]);
        
        // Batch add visible hexes
        visibleHexes.forEach(hex => {
            fogHexes.add(`${hex.q},${hex.r}`);
        });
        
        // Update state and cache
        WeatherState.visibility.temporaryFog = fogHexes;
        this._cache.temporaryFogCache.set(cacheKey, [...fogHexes]);
        
        // Limit cache size
        if (this._cache.temporaryFogCache.size > 50) {
            const firstKey = this._cache.temporaryFogCache.keys().next().value;
            this._cache.temporaryFogCache.delete(firstKey);
        }
    },

    isAdjacent(hex1, hex2) {
        const distance = this.getHexDistance(hex1, hex2);
        return distance === 1;
    },

    updateVisibleHexes() {
        const currentPosition = gameStore.playerPosition;
        const positionKey = `${currentPosition.q},${currentPosition.r}`;
        
        // Clear visibility cache when position changes
        if (this._lastPosition !== positionKey) {
            this.clearCaches();
            this._lastPosition = positionKey;
        }
        
        gameStore.game.world.visibleHexes.clear();
        
        // Always add current position
        gameStore.game.world.visibleHexes.add(positionKey);
        
        // Add hexes within visibility radius using cached results
        const visibleHexes = this.getAdjacentHexes(currentPosition, 2);
        
        // Batch update visible hexes
        const hexesToAdd = visibleHexes.map(hex => `${hex.q},${hex.r}`);
        hexesToAdd.forEach(hexId => {
            gameStore.game.world.visibleHexes.add(hexId);
        });
    }
};

export default VisibilityManager;
