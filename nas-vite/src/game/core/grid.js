// Import dependencies
import { WeatherManager } from '../weather.js';
import { MovementManager } from '../movement.js';
import { MessageManager } from '../ui/messages.js';
import { VisibilityManager } from '../visibility.js';
import { GRID, PLAYER_COLORS } from '../constants.js';

// Hex grid utility functions
export function hexDistance(hex1, hex2) {
    return (Math.abs(hex1.q - hex2.q) + 
            Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
            Math.abs(hex1.r - hex2.r)) / 2;
}

export function isAdjacent(hex1, hex2) {
    return hexDistance(hex1, hex2) === 1;
}

export const GridManager = {
    // Add the utility functions to the manager as well for convenience
    hexDistance,
    isAdjacent,

    createHexPoints(size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (60 * i - 30) * Math.PI / 180;
            points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
        }
        return points.join(' ');
    },

    createPlayerMarker() {
        const player = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const center = MovementManager.getHexCenter(window.playerPosition.q, window.playerPosition.r);
        
        player.setAttribute("cx", center.x);
        player.setAttribute("cy", center.y);
        player.setAttribute("r", GRID.HEX_SIZE * 0.3);
        player.setAttribute("fill", PLAYER_COLORS.DEFAULT);  // Changed this line
        player.setAttribute("id", "player");
        player.setAttribute("stroke", "white");
        player.setAttribute("stroke-width", "2");
        
        document.getElementById('hexGroup').appendChild(player);
    },

    centerViewport() {
        const hexGroup = document.getElementById('hexGroup');
        const playerCenter = MovementManager.getHexCenter(
            window.playerPosition.q, 
            window.playerPosition.r
        );
        hexGroup.setAttribute('transform', `translate(${-playerCenter.x}, ${-playerCenter.y})`);
    },

    positionBaseCamp() {
        // Calculate valid q range for base camp in top row
        const minQ = Math.max(-GRID.SIZE, -GRID.SIZE - (-GRID.SIZE));
        const maxQ = Math.min(GRID.SIZE, GRID.SIZE - (-GRID.SIZE));
        const baseQ = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
        
        window.baseCamp = { q: baseQ, r: -GRID.SIZE };
        window.playerPosition = { q: baseQ, r: -GRID.SIZE };
    },

    positionSouthPole() {
        const variation = Math.floor(GRID.SIZE * 0.2);
        let southQ, southR;
        
        do {
            southQ = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
            southR = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        } while (southQ === window.baseCamp.q && southR === window.baseCamp.r);
        
        window.southPole = { q: southQ, r: southR };
    },

    createHexGrid() {
        const group = document.getElementById('hexGroup');
        
        // Initialize weather elements and scheduling
        WeatherManager.createWeatherElements();
        WeatherManager.scheduleNextWeather();
        
        // Position special locations
        this.positionBaseCamp();
        this.positionSouthPole();
        
        // Create terrain hexes
        for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
            for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
                if (Math.abs(q + r) <= GRID.SIZE) {
                    this.createHexAtPosition(group, q, r);
                }
            }
        }

        // Initialize game state
        window.visitedHexes.add(`${window.playerPosition.q},${window.playerPosition.r}`);
        this.createPlayerMarker();
        this.centerViewport();

        VisibilityManager.updateVisibility();
        MessageManager.updateCurrentLocationInfo();
    },

    createHexAtPosition(group, q, r) {
        const x = GRID.HEX_WIDTH * (q + r/2);
        const y = GRID.HEX_HEIGHT * (r * 3/4);
        
        // Create terrain hex
        const hex = this.createTerrainHex(q, r, x, y);
        group.appendChild(hex);
        
        // Create fog overlay
        const fog = this.createFogOverlay(q, r, x, y);
        group.appendChild(fog);
    },

    createTerrainHex(q, r, x, y) {
        const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        let terrain;
        
        if (q === window.baseCamp.q && r === window.baseCamp.r) {
            terrain = 'BASE_CAMP';
            hex.setAttribute("fill", window.SPECIAL_LOCATIONS.BASE_CAMP.color);
        } else if (q === window.southPole.q && r === window.southPole.r) {
            terrain = 'SOUTH_POLE';
            hex.setAttribute("fill", window.SPECIAL_LOCATIONS.SOUTH_POLE.color);
        } else {
            terrain = window.assignRandomTerrain();
            hex.setAttribute("fill", window.TERRAIN_TYPES[terrain].color);
        }
        
        hex.setAttribute("points", this.createHexPoints(GRID.HEX_SIZE));
        hex.setAttribute("transform", `translate(${x}, ${y})`);
        hex.setAttribute("stroke", "#ffffff");
        hex.setAttribute("stroke-width", "1");
        hex.setAttribute("data-q", q);
        hex.setAttribute("data-r", r);
        hex.setAttribute("data-terrain", terrain);
        
        hex.addEventListener('pointerdown', (event) => MovementManager.handleHexClick(event));
        return hex;
    },

    createFogOverlay(q, r, x, y) {
        const fog = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        fog.setAttribute("points", this.createHexPoints(GRID.HEX_SIZE));
        fog.setAttribute("transform", `translate(${x}, ${y})`);
        fog.setAttribute("class", "fog");
        fog.setAttribute("data-q", q);
        fog.setAttribute("data-r", r);
        fog.setAttribute("fill-opacity", "1");
        fog.setAttribute("id", `fog-${q},${r}`);
        return fog;
    }
};