// src/services/visibility.js
import { gameStore } from '/src/state/store.js';
import { WeatherState } from '/src/state/game/weatherState.js';
import { WEATHER_CONFIG } from '/src/config/weatherConfig.js';

export const VisibilityManager = {
    getAdjacentHexes(position) {
        const directions = [
            {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
            {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
        ];
        
        return directions.map(dir => ({
            q: position.q + dir.q,
            r: position.r + dir.r
        }));
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
        const adjacentHexes = this.getAdjacentHexes(gameStore.playerPosition);
        
        WeatherState.visibility.temporaryFog.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        adjacentHexes.forEach(hex => {
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
        
        // Add adjacent hexes
        const adjacentHexes = this.getAdjacentHexes(gameStore.playerPosition);
        adjacentHexes.forEach(hex => {
            gameStore.game.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });
    }
};

export default VisibilityManager;