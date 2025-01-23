// src/game/visibility.js

import { GameState } from './core/gameState.js';
import { WeatherState, WEATHER_CONFIG } from './core/weatherState.js';

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
        if (GameState.world.visitedHexes.has(hexId)) {
            return true;
        }

        // Handle weather conditions
        if (WeatherState.current.type === 'WHITEOUT') {
            const [q, r] = hexId.split(',').map(Number);
            const distance = this.getHexDistance(
                {q, r}, 
                GameState.player.position
            );
            return distance <= WEATHER_CONFIG.WHITEOUT.visibility.range;
        }

        if (WeatherState.current.type === 'BLIZZARD') {
            return WeatherState.visibility.temporaryFog.has(hexId);
        }

        // Default visibility rules
        return GameState.world.visibleHexes.has(hexId);
    },

    getHexDistance(hex1, hex2) {
        return (Math.abs(hex1.q - hex2.q) + 
                Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
                Math.abs(hex1.r - hex2.r)) / 2;
    },

    updateVisibility(isWeatherEvent = false) {
        // First, update visible hexes
        this.updateVisibleHexes();
        
        console.log('Updating visibility. Visible hexes:', Array.from(GameState.world.visibleHexes));
        
        const fogElements = document.querySelectorAll('.fog');
        
        fogElements.forEach(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            
            // Check if hex should be visible
            const isVisible = this.isHexVisible(hexId);
            
            // Update fog opacity based on visibility and weather
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

        // Update temporary fog for weather events
        if (isWeatherEvent && WeatherState.current.type === 'BLIZZARD') {
            this.updateTemporaryFog();
        }
    },

    updateTemporaryFog() {
        // Get adjacent hexes for blizzard visibility
        const adjacentHexes = this.getAdjacentHexes(GameState.player.position);
        
        // Add current and adjacent hexes to temporary fog
        WeatherState.visibility.temporaryFog.add(
            `${GameState.player.position.q},${GameState.player.position.r}`
        );
        
        adjacentHexes.forEach(hex => {
            WeatherState.visibility.temporaryFog.add(`${hex.q},${hex.r}`);
        });
    },

    // Helper function to check if a hex is adjacent to current position
    isAdjacent(hex1, hex2) {
        const distance = this.getHexDistance(hex1, hex2);
        return distance === 1;
    },

    // Function to update visible hexes based on current position
    updateVisibleHexes() {
        GameState.world.visibleHexes.clear();
        
        // Always add current position
        GameState.world.visibleHexes.add(
            `${GameState.player.position.q},${GameState.player.position.r}`
        );
        
        // Add adjacent hexes
        const adjacentHexes = this.getAdjacentHexes(GameState.player.position);
        adjacentHexes.forEach(hex => {
            GameState.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });
    }
};

export default VisibilityManager;