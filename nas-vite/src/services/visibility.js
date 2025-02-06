// src/services/visibility.js
import { gameStore } from '../state/store.js';
import { WeatherState } from '../state/game/weatherState.js';
import { WEATHER_CONFIG } from '../core/weather.js';
import { TERRAIN_TYPES } from '../config/terrain.js';
import perfMonitor from '../core/performanceMonitor.js';

export const VisibilityManager = {
    init() {
        // Wrap key methods for performance monitoring
        const methodsToTrack = [
            'updateVisibility',
            'getHexesInRadius',
            'isHexVisible',
            'updateTemporaryFog',
            'updateVisibleHexes',
            'initCache',
            'getHexDistance',
            'updateFogElements',
            'clearCaches',
            'isAdjacent'
        ];

        methodsToTrack.forEach(method => {
            const original = this[method];
            this[method] = (...args) => {
                const start = performance.now();
                const result = original.apply(this, args);
                const end = performance.now();
                
                // Track method execution time
                perfMonitor.trackMethod(method, 'visibility.js', end - start);
                
                // Track DOM operations separately
                if (method === 'updateFogElements' || method === 'updateVisibility') {
                    const domOperations = {
                        method,
                        type: 'DOM_Update',
                        elements: this._cache.fogElements?.length || 0,
                        updates: this._cache.pendingUpdates?.size || 0,
                        visibleSections: this._cache.visibleSections?.size || 0
                    };
                    perfMonitor.trackEvent('DOMOperation', domOperations, end - start);
                }

                // Track batched updates separately
                if (method === 'processPendingUpdates') {
                    perfMonitor.trackEvent('BatchUpdate', {
                        updates: this._cache.pendingUpdates?.size || 0,
                        type: 'DOM_Batch'
                    }, end - start);
                }
                
                // Track expensive operations
                if (end - start > 16) {
                    perfMonitor.trackEvent('LongOperation', {
                        method,
                        file: 'visibility.js',
                        duration: end - start,
                        cacheSize: this._cache.fogElementsMap.size
                    }, end - start);
                }
                
                return result;
            };
        });

        // Enhanced RAF wrapper with more detailed tracking
        this._wrappedRAF = (callback) => {
            return requestAnimationFrame((timestamp) => {
                const start = performance.now();
                const frameStart = performance.now();
                
                callback(timestamp);
                
                const frameEnd = performance.now();
                const frameDuration = frameEnd - frameStart;
                
                // Track frame execution
                perfMonitor.trackMethod('animationFrame', 'visibility.js', frameDuration);
                
                // Track if frame took too long
                if (frameDuration > 16) {
                    perfMonitor.trackEvent('LongFrame', {
                        duration: frameDuration,
                        timestamp: Date.now(),
                        visibleHexes: gameStore.game.world.visibleHexes.size,
                        weatherType: WeatherState.current.type
                    }, frameDuration);
                }
            });
        };
    },

    // Cache for DOM elements and calculations
    _cache: {
        fogElements: null,
        fogElementsMap: new Map(),
        hexDistances: new Map(),
        stateCache: new Map(), // Replace lastUpdate with numeric state codes
        radiusCache: new Map(), // Cache for hex radius calculations
        temporaryFogCache: new Map(), // Cache for temporary fog calculations
        visibleSections: new Set(), // Track visible viewport sections
        pendingUpdates: new Map(), // Queue for batched updates
    },

    // State codes for faster comparison
    _stateCode: {
        VISIBLE: 1,
        HIDDEN: 2,
        MOUNTAIN: 3,
        BLIZZARD: 4,
        WHITEOUT: 5
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

            // Initialize visible sections based on player position
            const pos = gameStore.playerPosition;
            const playerSection = Math.floor(pos.q/10) + ',' + Math.floor(pos.r/10);
            this._cache.visibleSections.add(playerSection);
            
            // Add adjacent sections
            const adjacentSections = [
                `${Math.floor(pos.q/10)-1},${Math.floor(pos.r/10)}`,
                `${Math.floor(pos.q/10)+1},${Math.floor(pos.r/10)}`,
                `${Math.floor(pos.q/10)},${Math.floor(pos.r/10)-1}`,
                `${Math.floor(pos.q/10)},${Math.floor(pos.r/10)+1}`,
                // Add diagonals for smoother transitions
                `${Math.floor(pos.q/10)-1},${Math.floor(pos.r/10)-1}`,
                `${Math.floor(pos.q/10)-1},${Math.floor(pos.r/10)+1}`,
                `${Math.floor(pos.q/10)+1},${Math.floor(pos.r/10)-1}`,
                `${Math.floor(pos.q/10)+1},${Math.floor(pos.r/10)+1}`
            ];
            adjacentSections.forEach(s => this._cache.visibleSections.add(s));
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
        this._cache.stateCache.clear();
        this._cache.visibleSections.clear();
        this._cache.pendingUpdates.clear();
        this._updateScheduled = false;
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

    // Get state code for a hex
    getHexState(hexId, isVisible, isMountain) {
        if (WeatherState.current.type === 'BLIZZARD') {
            if (isMountain) return this._stateCode.MOUNTAIN;
            return isVisible ? this._stateCode.BLIZZARD : this._stateCode.HIDDEN;
        } else if (WeatherState.current.type === 'WHITEOUT') {
            return this._stateCode.WHITEOUT;
        } else {
            if (isMountain || isVisible) return this._stateCode.VISIBLE;
            return this._stateCode.HIDDEN;
        }
    },

    // Update fog element classes based on state
    updateFogElementClasses(fogHex, state, isWeatherEvent) {
        // Remove existing state classes
        fogHex.classList.remove('fog-visible', 'fog-hidden', 'fog-mountain', 'fog-blizzard', 'fog-whiteout');
        
        // Add transition class based on weather
        fogHex.classList.remove('movement-fade', 'blizzard-fade', 'instant');
        if (isWeatherEvent) {
            fogHex.classList.add(WeatherState.current.type === 'BLIZZARD' ? 'blizzard-fade' : 'instant');
        } else {
            fogHex.classList.add('movement-fade');
        }

        // Add new state class
        switch (state) {
            case this._stateCode.VISIBLE:
                fogHex.classList.add('fog-visible');
                break;
            case this._stateCode.HIDDEN:
                fogHex.classList.add('fog-hidden');
                break;
            case this._stateCode.MOUNTAIN:
                fogHex.classList.add('fog-mountain');
                break;
            case this._stateCode.BLIZZARD:
                fogHex.classList.add('fog-blizzard');
                break;
            case this._stateCode.WHITEOUT:
                fogHex.classList.add('fog-whiteout');
                break;
        }
    },

    // Optimized method for updating fog elements
    updateFogElements(isWeatherEvent) {
        const updates = new Map();
        const visibleSections = new Set();
        
        this._cache.fogElementsMap.forEach((fogHex, hexId) => {
            const [q, r] = hexId.split(',').map(Number);
            
            const isVisible = this.isHexVisible(hexId);
            const isMountain = this.isMountainHex(q, r);
            const newState = this.getHexState(hexId, isVisible, isMountain);
            
            // Only update if state has changed
            if (this._cache.stateCache.get(hexId) !== newState) {
                updates.set(hexId, {
                    element: fogHex,
                    state: newState,
                    isWeatherEvent
                });
                this._cache.stateCache.set(hexId, newState);
                
                // Track section for visible hexes and their neighbors
                const section = Math.floor(q/10) + ',' + Math.floor(r/10);
                visibleSections.add(section);
                
                // Also add adjacent sections to ensure smooth transitions
                const adjacentSections = [
                    `${Math.floor(q/10)-1},${Math.floor(r/10)}`,
                    `${Math.floor(q/10)+1},${Math.floor(r/10)}`,
                    `${Math.floor(q/10)},${Math.floor(r/10)-1}`,
                    `${Math.floor(q/10)},${Math.floor(r/10)+1}`
                ];
                adjacentSections.forEach(s => visibleSections.add(s));
                
                if (isWeatherEvent && (isVisible || isMountain) && 
                    WeatherState.current.type === 'BLIZZARD') {
                    WeatherState.visibility.affectedHexes.add(hexId);
                }
            }
            
        });
        
        // Queue updates for next animation frame
        if (updates.size > 0) {
            this._cache.pendingUpdates = updates;
            this.scheduleUpdate();
        }
        
        this._cache.visibleSections = visibleSections;
        return updates;
    },

    // Schedule batched update
    scheduleUpdate() {
        if (!this._updateScheduled) {
            this._updateScheduled = true;
            this._wrappedRAF(() => {
                this.processPendingUpdates();
                this._updateScheduled = false;
            });
        }
    },

    // Process queued updates
    processPendingUpdates() {
        const updates = this._cache.pendingUpdates;
        if (!updates || updates.size === 0) return;

        // Batch DOM reads/writes
        updates.forEach(({element, state, isWeatherEvent}) => {
            this.updateFogElementClasses(element, state, isWeatherEvent);
        });

        this._cache.pendingUpdates.clear();
    },

    updateVisibility(isWeatherEvent = false) {
        this.initCache();
        this.updateVisibleHexes();
        this.updateFogElements(isWeatherEvent);

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

    // Cache for adjacent hex calculations
    _adjacencyCache: new Map(),

    // Get cached key for adjacency check
    getAdjacencyKey(hex1, hex2) {
        return `${hex1.q},${hex1.r}-${hex2.q},${hex2.r}`;
    },

    isAdjacent(hex1, hex2) {
        const key = this.getAdjacencyKey(hex1, hex2);
        const reverseKey = this.getAdjacencyKey(hex2, hex1);
        
        // Check cache first
        if (this._adjacencyCache.has(key)) {
            return this._adjacencyCache.get(key);
        }
        if (this._adjacencyCache.has(reverseKey)) {
            return this._adjacencyCache.get(reverseKey);
        }

        // For adjacent hexes, at least one coordinate difference must be 1
        // and the sum of absolute differences must be either 1 or 2
        const qDiff = Math.abs(hex1.q - hex2.q);
        const rDiff = Math.abs(hex1.r - hex2.r);
        const result = (qDiff + rDiff === 1) || (qDiff === 1 && rDiff === 1);
        
        // Cache the result
        this._adjacencyCache.set(key, result);
        
        // Limit cache size
        if (this._adjacencyCache.size > 1000) {
            const firstKey = this._adjacencyCache.keys().next().value;
            this._adjacencyCache.delete(firstKey);
        }
        
        return result;
    },

    // Clear adjacency cache when position changes
    clearAdjacencyCache() {
        this._adjacencyCache.clear();
    },

    updateVisibleHexes() {
        const currentPosition = gameStore.playerPosition;
        const positionKey = `${currentPosition.q},${currentPosition.r}`;
        
        // Clear caches when position changes
        if (this._lastPosition !== positionKey) {
            this.clearCaches();
            this.clearAdjacencyCache();
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
