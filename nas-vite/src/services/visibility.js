// src/services/visibility.js
import { gameStore } from '../state/store.js';
import { WeatherState } from '../state/game/weatherState.js';
import { WEATHER_CONFIG } from '../core/weather.js';

export const VisibilityManager = {
    // New method to get hexes within a radius
    getHexesInRadius(position, radius) {
        const hexes = [];
        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                const hex = {
                    q: position.q + q,
                    r: position.r + r
                };
                // Only add if within the specified radius
                if (this.getHexDistance(position, hex) <= radius) {
                    hexes.push(hex);
                }
            }
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

    isHexVisible(hexId) {
        // Base case: hex is visited
        if (gameStore.game.world.visitedHexes.has(hexId)) {
            return true;
        }

        // Handle weather conditions
        if (WeatherState.current.type === 'WHITEOUT') {
            const [q, r] = hexId.split(',').map(Number);
            const distance = this.getHexDistance(
                {q, r}, 
                gameStore.playerPosition
            );
            return distance <= WEATHER_CONFIG.WHITEOUT.visibility.range;
        }

        if (WeatherState.current.type === 'BLIZZARD') {
            return WeatherState.visibility.temporaryFog.has(hexId);
        }

        // Default visibility rules
        return gameStore.game.world.visibleHexes.has(hexId);
    },

    getHexDistance(hex1, hex2) {
        return (Math.abs(hex1.q - hex2.q) + 
                Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
                Math.abs(hex1.r - hex2.r)) / 2;
    },

    updateVisibility(isWeatherEvent = false) {
        // First, update visible hexes
        this.updateVisibleHexes();
        
        const fogElements = document.querySelectorAll('.fog');
        
        fogElements.forEach(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            
            const isVisible = this.isHexVisible(hexId);
            
            if (isWeatherEvent) {
                if (WeatherState.current.type === 'BLIZZARD') {
                    const opacity = isVisible ? '0.8' : '1';
                    fogHex.setAttribute('fill-opacity', opacity);
                    if (isVisible) {
                        WeatherState.visibility.affectedHexes.add(hexId);
                    }
                } else if (WeatherState.current.type === 'WHITEOUT') {
                    fogHex.setAttribute('fill-opacity', '1');
                }
            } else {
                fogHex.setAttribute('fill-opacity', isVisible ? '0' : '1');
            }
        });

        if (isWeatherEvent && WeatherState.current.type === 'BLIZZARD') {
            this.updateTemporaryFog();
        }
    },

    updateTemporaryFog() {
        // Use the same visibility radius for temporary fog
        const visibleHexes = this.getAdjacentHexes(gameStore.playerPosition, 2); // You can adjust this radius
        
        WeatherState.visibility.temporaryFog.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        visibleHexes.forEach(hex => {
            WeatherState.visibility.temporaryFog.add(`${hex.q},${hex.r}`);
        });
    },

    isAdjacent(hex1, hex2) {
        const distance = this.getHexDistance(hex1, hex2);
        return distance === 1;
    },

    updateVisibleHexes() {
        gameStore.game.world.visibleHexes.clear();
        
        // Always add current position
        gameStore.game.world.visibleHexes.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        // Add hexes within visibility radius (change this number to adjust visibility range)
        const visibleHexes = this.getAdjacentHexes(gameStore.playerPosition, 2); // Adjust this number to change visibility radius
        visibleHexes.forEach(hex => {
            gameStore.game.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });
    }
};

export default VisibilityManager;