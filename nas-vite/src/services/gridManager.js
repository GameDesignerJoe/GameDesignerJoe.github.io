// src/services/gridManager.js
import { gameStore } from '../state/store.js';
import { WeatherSystem } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { VisibilityManager } from './visibility.js';
import { TERRAIN_TYPES, SPECIAL_LOCATIONS, assignRandomTerrain } from '../config/terrain.js';
import { initializeGridState } from '../state/game/gridState.js';
import { GRID, UI } from '../config/constants.js';  // Add UI to the import
import { MovementManager } from './movement.js';

const getAssetPath = (filename) => {
    const path = `/nas-vite/art/${filename}`;
    console.log('Attempting to load:', path); // Debug log
    return path;
};

export const GridManager = {
    initializeGrid() {
        // console.log("Starting grid initialization");
        
        // Initialize grid state
        const gridState = initializeGridState();
        // console.log("Grid state initialized:", gridState);
        
        // Update player position first
        gameStore.player.position = { ...gridState.baseCamp };
        // console.log("Player position set:", gameStore.player.position);
        
        // Then update game world
        Object.assign(gameStore.game.world, gridState);
        
        // Create the actual grid hexes
        this.createHexGrid();
        
        // Now we can use player position safely
        gameStore.game.world.visitedHexes.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        // console.log("Visited hexes:", gameStore.game.world.visitedHexes);
        
        // Make adjacent hexes visible
        const adjacentHexes = VisibilityManager.getAdjacentHexes(gameStore.playerPosition);
        adjacentHexes.forEach(hex => {
            gameStore.game.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });
        
        // console.log("Visible hexes:", gameStore.game.world.visibleHexes);

        VisibilityManager.updateVisibility(false);
        gameStore.messages.updateCurrentLocationInfo();
    },

    getTerrainType(q, r) {
        // Check for special locations first
        if (q === gameStore.game.world.baseCamp.q && r === gameStore.game.world.baseCamp.r) {
            return 'BASE_CAMP';
        }
        if (q === gameStore.game.world.southPole.q && r === gameStore.game.world.southPole.r) {
            return 'SOUTH_POLE';
        }

        // Get or generate terrain for this hex
        const hexId = `${q},${r}`;
        if (!gameStore.game.world.terrain[hexId]) {
            gameStore.game.world.terrain[hexId] = assignRandomTerrain();
        }
        return gameStore.game.world.terrain[hexId];
    },

    createHexGrid() {
        const group = document.getElementById('hexGroup');
        if (!group) {
            console.error('No hexGroup element found');
            return;
        }
        
        // Create terrain hexes
        for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
            for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
                if (Math.abs(q + r) <= GRID.SIZE) {
                    this.createHexAtPosition(group, q, r);
                }
            }
        }
    
        // Add click handlers
        // console.log('Setting up hex click handlers');
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.addEventListener('click', () => {
                const q = parseInt(hex.getAttribute('data-q'));
                const r = parseInt(hex.getAttribute('data-r'));
                // console.log('Hex clicked:', { q, r });
                const terrain = hex.getAttribute('data-terrain');
                const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                                 terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                                 TERRAIN_TYPES[terrain];
                MovementManager.handleHexSelection(hex, q, r, terrainInfo);
            });
        });
    
        // Create player marker and center view
        this.createPlayerMarker();  // Keep only the original marker, remove debug marker
        this.centerViewport();
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
        const terrain = this.getTerrainType(q, r);
        const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                           terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                           TERRAIN_TYPES[terrain];
        
        hex.setAttribute("points", this.createHexPoints(GRID.HEX_SIZE));
        hex.setAttribute("transform", `translate(${x}, ${y})`);
        hex.setAttribute("fill", terrainInfo.color);
        hex.setAttribute("stroke", "#ffffff");
        hex.setAttribute("stroke-width", "1");
        hex.setAttribute("data-q", q);
        hex.setAttribute("data-r", r);
        hex.setAttribute("data-terrain", terrain);
        
        return hex;
    },

    createHexPoints(size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (60 * i - 30) * Math.PI / 180;
            points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
        }
        return points.join(' ');
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
    },

    createPlayerMarker() {
        const existingPlayer = document.getElementById('player');
        if (existingPlayer) {
            existingPlayer.remove();
        }

        const player = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const center = this.getHexCenter(
            gameStore.player.position.q,
            gameStore.player.position.r
        );
        
        player.setAttribute("cx", center.x);
        player.setAttribute("cy", center.y);
        player.setAttribute("r", GRID.HEX_SIZE * 0.3);
        player.setAttribute("fill", "green");
        player.setAttribute("id", "player");
        player.setAttribute("stroke", "white");
        player.setAttribute("stroke-width", "2");
        
        document.getElementById('hexGroup').appendChild(player);
    },

    updatePlayerMarker() {
        const player = document.getElementById('player');
        if (!player) {
            this.createPlayerMarker();
            return;
        }

        const center = this.getHexCenter(
            gameStore.player.position.q,
            gameStore.player.position.r
        );
        
        player.setAttribute("cx", center.x);
        player.setAttribute("cy", center.y);
    },

    getHexCenter(q, r) {
        const hexWidth = Math.sqrt(3) * GRID.HEX_SIZE;
        const hexHeight = GRID.HEX_SIZE * 2;
        const x = hexWidth * (q + r/2);
        const y = hexHeight * (r * 3/4);
        return { x, y };
    },

    centerViewport() {
        const hexGroup = document.getElementById('hexGroup');
        const playerCenter = this.getHexCenter(
            gameStore.playerPosition.q,
            gameStore.playerPosition.r
        );
        hexGroup.setAttribute('transform', 
            `translate(${-playerCenter.x}, ${-playerCenter.y})`
        );
    },

    createHexGrid() {
        const group = document.getElementById('hexGroup');
        if (!group) {
            console.error('No hexGroup element found');
            return;
        }
        
        // Create terrain hexes
        for (let q = -GRID.SIZE; q <= GRID.SIZE; q++) {
            for (let r = -GRID.SIZE; r <= GRID.SIZE; r++) {
                if (Math.abs(q + r) <= GRID.SIZE) {
                    this.createHexAtPosition(group, q, r);
                }
            }
        }
    
        // Add click handlers
        // console.log('Setting up hex click handlers');
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            hex.addEventListener('click', () => {
                const q = parseInt(hex.getAttribute('data-q'));
                const r = parseInt(hex.getAttribute('data-r'));
                // console.log('Hex clicked:', { q, r });
                const terrain = hex.getAttribute('data-terrain');
                const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                                 terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                                 TERRAIN_TYPES[terrain];
                MovementManager.handleHexSelection(hex, q, r, terrainInfo);
            });
        });
    
        // Create player marker and center view
        this.createPlayerMarker();
        this.centerViewport();
    },

    isAtBaseCamp(position) {
        const baseCamp = gameStore.game.world.baseCamp;
        return position.q === baseCamp.q && position.r === baseCamp.r;
    },

    initializeCampingButton() {
        // First, find or create the game-controls-area
        let controlsArea = document.querySelector('.game-controls-area');
        if (!controlsArea) {
            controlsArea = document.createElement('div');
            controlsArea.className = 'game-controls-area';
            // Insert it after the game container
            const gameContainer = document.querySelector('.game-container');
            gameContainer.appendChild(controlsArea);
        }

        // Then find or create the controls container
        let controlsContainer = document.querySelector('.controls-container');
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.className = 'controls-container';
            controlsArea.appendChild(controlsContainer);
        }

        if (document.getElementById('camp-button')) {
            return;
        }

        const campButton = document.createElement('button');
        campButton.id = 'camp-button';
        campButton.className = 'game-button camp-button';
        campButton.innerHTML = `<img src="${getAssetPath('camp.svg')}" alt="Camp" class="camp-icon">`;

        // Add click handler
        campButton.addEventListener('click', () => {
            if (this.isAtBaseCamp(gameStore.player.position)) {
                gameStore.messages.showPlayerMessage(
                    "You can't camp here.", 
                    UI.MESSAGE_TYPES.STATUS
                );
                return;
            }
            
            // Store current camping state before toggling
            const wasCamping = gameStore.player.isCamping;
            const success = gameStore.player.toggleCamping();
            
            if (success) {
                this.updateCampingButton();
                this.createCampingVisual();
                
                // Show appropriate message based on camping state
                if (!wasCamping) {
                    gameStore.messages.showPlayerMessage(
                        "You set up camp, taking shelter from the bitter cold...",
                        UI.MESSAGE_TYPES.STATUS
                    );
                } else {
                    gameStore.messages.showPlayerMessage(
                        "You break camp and prepare to move on...",
                        UI.MESSAGE_TYPES.STATUS
                    );
                }
            }
        });

        controlsContainer.appendChild(campButton);
        // Initialize compass button after camp button
        this.initializeCompassButton();

        requestAnimationFrame(() => {
            this.updateCampingButton();
        });
    },

    updateCampingButton() {
        const campButton = document.getElementById('camp-button');
        if (!campButton) return;

        const campIcon = campButton.querySelector('.camp-icon');
        const isAtBase = this.isAtBaseCamp(gameStore.player.position);
        
        // Remove disabled state first
        campButton.classList.remove('disabled');
        campIcon.classList.remove('grayscale');
        
        // Then add if needed
        if (isAtBase) {
            campButton.classList.add('disabled');
            campIcon.classList.add('grayscale');
        }
        
        if (gameStore.player.isCamping) {
            campButton.classList.add('active');
        } else {
            campButton.classList.remove('active');
        }
    },

    createCampingVisual() {
        const existingCamp = document.getElementById('camp-hex');
        if (existingCamp) {
            existingCamp.remove();
        }

        if (!gameStore.player.isCamping) return;

        const center = this.getHexCenter(
            gameStore.player.position.q,
            gameStore.player.position.r
        );

        const campHex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const campSize = GRID.HEX_SIZE * 0.75; // 75% of normal hex size
        
        campHex.setAttribute("points", this.createHexPoints(campSize));
        campHex.setAttribute("transform", `translate(${center.x}, ${center.y})`);
        campHex.setAttribute("fill", "#DAA520"); // Same color as base camp
        campHex.setAttribute("stroke", "#B8860B");
        campHex.setAttribute("stroke-width", "2");
        campHex.setAttribute("id", "camp-hex");

        // Insert before player marker for proper layering
        const hexGroup = document.getElementById('hexGroup');
        const player = document.getElementById('player');
        hexGroup.insertBefore(campHex, player);
    },

    initializeCompassButton() {
        // Make sure controls container exists
        let controlsContainer = document.querySelector('.controls-container');
        if (!controlsContainer) return;
    
        // Don't create if already exists
        if (document.querySelector('.compass-button')) return;
    
        const compassButton = document.createElement('button');
        compassButton.className = 'game-button compass-button';
        compassButton.innerHTML = `<img src="${getAssetPath('compass-icon.svg')}" alt="Compass" class="compass-icon">`;
    
        // Add click handler that will use the CompassSystem
        compassButton.addEventListener('click', () => {
            if (gameStore.compassSystem) {
                gameStore.compassSystem.toggleCompass();
            }
        });
    
        controlsContainer.appendChild(compassButton);
    
        requestAnimationFrame(() => {
            this.updateCompassButton();
        });
    },
    
    updateCompassButton() {
        const compassButton = document.querySelector('.compass-button');
        if (!compassButton) return;
    
        const compassIcon = compassButton.querySelector('.compass-icon');
        
        // Update active state
        if (gameStore.compass.isActive) {
            compassButton.classList.add('active');
        } else {
            compassButton.classList.remove('active');
        }
    }
};

// Bind all methods to the GridManager object
Object.getOwnPropertyNames(GridManager)
    .filter(prop => typeof GridManager[prop] === 'function')
    .forEach(method => {
        GridManager[method] = GridManager[method].bind(GridManager);
    });

export default GridManager;