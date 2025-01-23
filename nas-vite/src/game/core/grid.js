// src/game/core/grid.js

import { WeatherManager } from '../weather.js';
import { MovementManager } from '../movement.js';
import { MessageManager } from '../ui/messages.js';
import { VisibilityManager } from '../visibility.js';
import { GameState, TERRAIN_TYPES, SPECIAL_LOCATIONS } from './gameState.js';
import { GRID, PLAYER_COLORS } from '../constants.js';
import { assignRandomTerrain } from '../../config/config.js';  

export const GridManager = {
    hexDistance(hex1, hex2) {
        return (Math.abs(hex1.q - hex2.q) + 
                Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
                Math.abs(hex1.r - hex2.r)) / 2;
    },

    isAdjacent(hex1, hex2) {
        return this.hexDistance(hex1, hex2) === 1;
    },

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
        const center = MovementManager.getHexCenter(
            GameState.player.position.q,
            GameState.player.position.r
        );
        
        player.setAttribute("cx", center.x);
        player.setAttribute("cy", center.y);
        player.setAttribute("r", GRID.HEX_SIZE * 0.3);      // Player radius is 30% of hex size
        player.setAttribute("fill", PLAYER_COLORS.DEFAULT);
        player.setAttribute("id", "player");
        player.setAttribute("stroke", "white");
        player.setAttribute("stroke-width", "2");
        
        document.getElementById('hexGroup').appendChild(player);
    },

    centerViewport() {
        const hexGroup = document.getElementById('hexGroup');
        const playerCenter = MovementManager.getHexCenter(
            GameState.player.position.q,
            GameState.player.position.r
        );
        hexGroup.setAttribute('transform', 
            `translate(${-playerCenter.x}, ${-playerCenter.y})`
        );
    },

    initializeSpecialLocations() {
        // Position Base Camp
        const minQ = Math.max(-GRID.SIZE, -GRID.SIZE - (-GRID.SIZE));
        const maxQ = Math.min(GRID.SIZE, GRID.SIZE - (-GRID.SIZE));
        const baseQ = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
        
        GameState.world.baseCamp = { q: baseQ, r: -GRID.SIZE };
        GameState.player.position = { ...GameState.world.baseCamp };

        // Position South Pole with variation
        const variation = Math.floor(GRID.SIZE * 0.2);
        let southQ, southR;
        
        do {
            southQ = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
            southR = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        } while (southQ === GameState.world.baseCamp.q && 
                 southR === GameState.world.baseCamp.r);
        
        GameState.world.southPole = { q: southQ, r: southR };
    },

    getTerrainType(q, r) {
        // Check for special locations first
        if (q === GameState.world.baseCamp.q && r === GameState.world.baseCamp.r) {
            return 'BASE_CAMP';
        }
        if (q === GameState.world.southPole.q && r === GameState.world.southPole.r) {
            return 'SOUTH_POLE';
        }

        // Get or generate terrain for this hex
        const hexId = `${q},${r}`;
        if (!GameState.world.terrain[hexId]) {
            GameState.world.terrain[hexId] = assignRandomTerrain();
        }
        return GameState.world.terrain[hexId];
    },

    createHexGrid() {
        const group = document.getElementById('hexGroup');
        
        WeatherManager.createWeatherElements();
        WeatherManager.scheduleNextWeather();
        
        this.initializeSpecialLocations();
        
        // Create terrain hexes
        for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
            for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
                if (Math.abs(q + r) <= GRID.SIZE) {
                    this.createHexAtPosition(group, q, r);
                }
            }
        }

        // Initialize visibility for base camp
        GameState.world.visitedHexes.add(
            `${GameState.player.position.q},${GameState.player.position.r}`
        );
        
        // Make sure adjacent hexes are visible
        const adjacentHexes = VisibilityManager.getAdjacentHexes(GameState.player.position);
        adjacentHexes.forEach(hex => {
            GameState.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });

        this.createPlayerMarker();
        this.centerViewport();

        VisibilityManager.updateVisibility(false);
        MessageManager.updateCurrentLocationInfo();
    },

    createHexAtPosition(group, q, r) {
        const x = GRID.HEX_WIDTH * (q + r/2);
        const y = GRID.HEX_HEIGHT * (r * 3/4);
        
        const hex = this.createTerrainHex(q, r, x, y);
        group.appendChild(hex);
        
        const fog = this.createFogOverlay(q, r, x, y);
        group.appendChild(fog);
    },

    createTerrainHex(q, r, x, y) {
        const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        let terrain;
        
        if (q === GameState.world.baseCamp.q && r === GameState.world.baseCamp.r) {
            terrain = 'BASE_CAMP';
            hex.setAttribute("fill", SPECIAL_LOCATIONS.BASE_CAMP.color);
        } else if (q === GameState.world.southPole.q && r === GameState.world.southPole.r) {
            terrain = 'SOUTH_POLE';
            hex.setAttribute("fill", SPECIAL_LOCATIONS.SOUTH_POLE.color);
        } else {
            // Use the imported assignRandomTerrain function directly, not as a method
            terrain = assignRandomTerrain();
            hex.setAttribute("fill", TERRAIN_TYPES[terrain].color);
        }
        
        hex.setAttribute("points", this.createHexPoints(GRID.HEX_SIZE));
        hex.setAttribute("transform", `translate(${x}, ${y})`);
        hex.setAttribute("stroke", "#ffffff");
        hex.setAttribute("stroke-width", "1");
        hex.setAttribute("data-q", q);
        hex.setAttribute("data-r", r);
        hex.setAttribute("data-terrain", terrain);
        
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
        fog.setAttribute("fill", "white");
        return fog;
    }
};

export default GridManager;