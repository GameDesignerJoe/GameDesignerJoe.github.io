// src/services/gridManager.js
import { gameStore } from '../state/store.js';
import { WeatherSystem } from '../core/weather.js';
import { MessageSystem } from '../core/messages.js';
import { VisibilityManager } from './visibility.js';
import { InventorySystem } from '../core/inventorySystem.js';
import { TERRAIN_TYPES, SPECIAL_LOCATIONS, assignRandomTerrain } from '../config/terrain.js';
import { initializeGridState } from '../state/game/gridState.js';
import { GRID, UI } from '../config/constants.js';  // Add UI to the import
import { MovementManager } from './movement.js';
import perfMonitor from '../core/performanceMonitor.js';

const getAssetPath = (filename) => {
    return `./public/art/${filename}`;
};

export const GridManager = {
    init() {
        // Wrap key methods for performance monitoring
        const methodsToTrack = [
            'createHexGrid',
            'createHexAtPosition',
            'updatePlayerMarker',
            'centerViewport',
            'createTerrainHex',
            'updateVisibility'
        ];

        methodsToTrack.forEach(method => {
            perfMonitor.wrapMethod(this, method, 'gridManager.js');
        });
    },

    initializeGrid() {
        // Remove any existing grid elements
        const hexGroup = document.getElementById('hexGroup');
        if (hexGroup) {
            while (hexGroup.firstChild) {
                hexGroup.removeChild(hexGroup.firstChild);
            }
        }
        
        // Initialize grid state
        const gridState = initializeGridState();
        
        // Update player position first
        gameStore.player.position = { ...gridState.baseCamp };
        
        // Then update game world
        Object.assign(gameStore.game.world, gridState);
        
        // Create the actual grid hexes
        this.createHexGrid();
        
        // Now we can use player position safely
        gameStore.game.world.visitedHexes.add(
            `${gameStore.playerPosition.q},${gameStore.playerPosition.r}`
        );
        
        // Make adjacent hexes visible
        const adjacentHexes = VisibilityManager.getAdjacentHexes(gameStore.playerPosition);
        adjacentHexes.forEach(hex => {
            gameStore.game.world.visibleHexes.add(`${hex.q},${hex.r}`);
        });

        // Initialize visibility
        VisibilityManager.clearCaches();
        VisibilityManager.init();
        
        // Update visible hexes
        VisibilityManager.updateVisibleHexes();
        
        // Force a full visibility update
        VisibilityManager.updateVisibility(false);
        
        // Update fog elements
        VisibilityManager.updateFogElements(false);
        
        // Process any pending updates immediately
        VisibilityManager.processPendingUpdates();
        
        // Update location info
        gameStore.messages.updateCurrentLocationInfo();
        
        // Center viewport on player
        this.centerViewport();
    },

    getTerrainType(q, r) {
        // Cache special locations for faster lookup
        const baseCamp = gameStore.game.world.baseCamp;
        const southPole = gameStore.game.world.southPole;
        const terrain = gameStore.game.world.terrain;

        // Check for special locations first using direct comparison
        if (q === baseCamp.q && r === baseCamp.r) return 'BASE_CAMP';
        if (q === southPole.q && r === southPole.r) return 'SOUTH_POLE';

        // Get or generate terrain for this hex
        const hexId = `${q},${r}`;
        return terrain[hexId] || (terrain[hexId] = assignRandomTerrain());
    },

    // Pre-calculate hex points since they're constant
    hexPoints: (() => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (60 * i - 30) * Math.PI / 180;
            points.push(`${GRID.HEX_SIZE * Math.cos(angle)},${GRID.HEX_SIZE * Math.sin(angle)}`);
        }
        return points.join(' ');
    })(),

    createHexGrid() {
        const group = document.getElementById('hexGroup');
        if (!group) {
            console.error('No hexGroup element found');
            return;
        }
        
        // Create document fragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        
        // Cache constants for coordinate calculations
        const halfGridSize = GRID.SIZE;
        const hexWidth = GRID.HEX_WIDTH;
        const hexHeight = GRID.HEX_HEIGHT;
        
        // Create all hexes and fog overlays
        for (let q = -halfGridSize; q <= halfGridSize; q++) {
            for (let r = -halfGridSize; r <= halfGridSize; r++) {
                if (Math.abs(q + r) <= halfGridSize) {
                    const x = hexWidth * (q + r/2);
                    const y = hexHeight * (r * 3/4);
                    
                    // Create terrain hex
                    const terrain = this.getTerrainType(q, r);
                    const terrainInfo = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                                      terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                                      TERRAIN_TYPES[terrain];
                    
                    // Create hex and fog elements
                    const [hex, fog] = this.createHexElements(q, r, x, y, terrain, terrainInfo);
                    
                    fragment.appendChild(hex);
                    fragment.appendChild(fog);
                }
            }
        }
        
        // Batch append all elements
        group.appendChild(fragment);
        
        // Create player marker and center view
        this.createPlayerMarker();
        this.centerViewport();
    },

    createHexElements(q, r, x, y, terrain, terrainInfo) {
        // Create hex element
        const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const transform = `translate(${x}, ${y})`;
        
        // Set hex attributes in batch
        const hexAttrs = {
            "points": this.hexPoints,
            "transform": transform,
            "fill": terrainInfo.color,
            "stroke": "#ffffff",
            "stroke-width": "1",
            "data-q": q,
            "data-r": r,
            "data-terrain": terrain
        };
        
        Object.entries(hexAttrs).forEach(([key, value]) => {
            hex.setAttribute(key, value);
        });
        
        // Add click handler
        hex.addEventListener('click', () => {
            MovementManager.handleHexSelection(hex, q, r, terrainInfo);
        });
        
        // Create fog element
        const fog = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        
        // Set fog attributes in batch
        const fogAttrs = {
            "points": this.hexPoints,
            "transform": transform,
            "class": "fog",
            "data-q": q,
            "data-r": r,
            "fill-opacity": "1",
            "id": `fog-${q},${r}`,
            "fill": "white"
        };
        
        Object.entries(fogAttrs).forEach(([key, value]) => {
            fog.setAttribute(key, value);
        });
        
        return [hex, fog];
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

    // Cache hex dimensions since they're constant
    hexDimensions: {
        width: Math.sqrt(3) * GRID.HEX_SIZE,
        height: GRID.HEX_SIZE * 2
    },

    getHexCenter(q, r) {
        return {
            x: this.hexDimensions.width * (q + r/2),
            y: this.hexDimensions.height * (r * 3/4)
        };
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


    isAtBaseCamp(position) {
        const baseCamp = gameStore.game.world.baseCamp;
        return position.q === baseCamp.q && position.r === baseCamp.r;
    },

    initializeGameControls() {
        // Create game controls area if it doesn't exist
        let controlsArea = document.querySelector('.game-controls-area');
        if (!controlsArea) {
            controlsArea = document.createElement('div');
            controlsArea.className = 'game-controls-area';
            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                gameContainer.appendChild(controlsArea);
            }
        }

        // Create controls container if it doesn't exist
        let controlsContainer = document.querySelector('.controls-container');
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.className = 'controls-container';
            controlsArea.appendChild(controlsContainer);
        }

        // Initialize all buttons in a single frame
        requestAnimationFrame(() => {
            this.initializeInventoryButton(controlsContainer);
            this.initializeCampingButton(controlsContainer);
            this.initializeCompassButton(controlsContainer);
            this.initializeFoodButton(controlsContainer);
            this.initializeSettingsButton(controlsContainer);
            
            // Update button states
            this.updateCampingButton();
            this.updateCompassButton();
            this.updateFoodButton();
        });
    },

    initializeCampingButton(controlsContainer) {
        if (document.getElementById('camp-button')) return;

        const campButton = document.createElement('button');
        campButton.id = 'camp-button';
        campButton.className = 'game-button camp-button';
        
        // Set initial icon based on tent availability
        const hasTent = gameStore.player.hasTent();
        campButton.innerHTML = `<img src="./public/art/${hasTent ? 'camp' : 'sleep-icon'}.svg" alt="${hasTent ? 'Camp' : 'Rest'}" class="camp-icon">`;

        // Add click handler
        campButton.addEventListener('click', () => {
            if (this.isAtBaseCamp(gameStore.player.position)) {
                gameStore.messages.showPlayerMessage(
                    "You can't rest here.", 
                    UI.MESSAGE_TYPES.STATUS
                );
                return;
            }
            
            // Store current states before toggling
            const wasCamping = gameStore.player.isCamping;
            const wasResting = gameStore.player.isResting;
            const success = gameStore.player.toggleCamping();
            
            if (success) {
                this.updateCampingButton();
                this.createCampingVisual();
                
                // Show appropriate message based on state
                if (!wasCamping && !wasResting) {
                    const hasTent = gameStore.player.hasTent();
                    gameStore.messages.showPlayerMessage(
                        hasTent ? 
                            "You set up camp, taking shelter from the bitter cold..." :
                            "You try to find a moment's rest in the bitter cold...",
                        UI.MESSAGE_TYPES.STATUS
                    );
                } else {
                    gameStore.messages.showPlayerMessage(
                        "You prepare to move on...",
                        UI.MESSAGE_TYPES.STATUS
                    );
                }
            }
        });

        controlsContainer.appendChild(campButton);
    },

    updateCampingButton() {
        const campButton = document.getElementById('camp-button');
        if (!campButton) return;

        const campIcon = campButton.querySelector('.camp-icon');
        const isAtBase = this.isAtBaseCamp(gameStore.player.position);
        const hasTent = gameStore.player.hasTent();
        
        // Update icon based on tent availability
        campIcon.src = `./public/art/${hasTent ? 'camp' : 'sleep-icon'}.svg`;
        campIcon.alt = hasTent ? 'Camp' : 'Rest';
        
        // Remove disabled state first
        campButton.classList.remove('disabled');
        campIcon.classList.remove('grayscale');
        
        // Then add if needed
        if (isAtBase) {
            campButton.classList.add('disabled');
            campIcon.classList.add('grayscale');
        }
        
        if (gameStore.player.isCamping || gameStore.player.isResting) {
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

        if (!gameStore.player.isCamping && !gameStore.player.isResting) return;

        const center = this.getHexCenter(
            gameStore.player.position.q,
            gameStore.player.position.r
        );

        if (gameStore.player.isCamping) {
            // Create camp hex with batched attributes
            const campHex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const campSize = GRID.HEX_SIZE * 0.75; // 75% of normal hex size
            
            // Pre-calculate camp hex points
            const campPoints = (() => {
                const points = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (60 * i - 30) * Math.PI / 180;
                    points.push(`${campSize * Math.cos(angle)},${campSize * Math.sin(angle)}`);
                }
                return points.join(' ');
            })();
            
            // Set attributes in batch
            const campAttrs = {
                "points": campPoints,
                "transform": `translate(${center.x}, ${center.y})`,
                "fill": "#DAA520",
                "stroke": "#B8860B",
                "stroke-width": "2",
                "id": "camp-hex"
            };
            
            Object.entries(campAttrs).forEach(([key, value]) => {
                campHex.setAttribute(key, value);
            });

            // Insert before player marker for proper layering
            const hexGroup = document.getElementById('hexGroup');
            const player = document.getElementById('player');
            hexGroup.insertBefore(campHex, player);
        } else if (gameStore.player.isResting) {
            // Create rest circle
            const restCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            
            // Set attributes in batch
            const restAttrs = {
                "cx": center.x,
                "cy": center.y,
                "r": GRID.HEX_SIZE * 0.56, // 70% of previous size (was 0.8)
                "fill": "#D3D3D3", // Light grey
                "id": "camp-hex" // Keep same ID for consistency with removal
            };
            
            Object.entries(restAttrs).forEach(([key, value]) => {
                restCircle.setAttribute(key, value);
            });

            // Insert before player marker for proper layering
            const hexGroup = document.getElementById('hexGroup');
            const player = document.getElementById('player');
            hexGroup.insertBefore(restCircle, player);
        }
    },

    initializeCompassButton(controlsContainer) {
        if (document.querySelector('.compass-button')) return;
        
        // Only show compass button if player has a compass
        const hasCompass = Array.from(gameStore.packing.selectedItems.values())
            .some(item => item.name === "Compass");
            
        if (!hasCompass) return;
    
        const compassButton = document.createElement('button');
        compassButton.className = 'game-button compass-button';
        compassButton.innerHTML = `<img src="./public/art/compass-icon.svg" alt="Compass" class="compass-icon">`;
    
        // Add click handler that will use the CompassSystem
        compassButton.addEventListener('click', () => {
            if (gameStore.compassSystem) {
                gameStore.compassSystem.toggleCompass();
            }
        });
    
        controlsContainer.appendChild(compassButton);
    },

    initializeSettingsButton(controlsContainer) {
        if (document.querySelector('.settings-button')) return;

        const settingsButton = document.createElement('button');
        settingsButton.className = 'game-button settings-button';
        settingsButton.innerHTML = `<img src="./public/art/settings-icon.svg" alt="Settings" class="settings-icon">`;
        
        // Add click handler
        settingsButton.addEventListener('click', () => {
            perfMonitor.togglePanel();
        });

        controlsContainer.appendChild(settingsButton);
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
    },

    initializeInventoryButton(controlsContainer) {
        if (document.querySelector('.inventory-button')) return;

        const inventoryButton = document.createElement('button');
        inventoryButton.className = 'game-button inventory-button';
        inventoryButton.innerHTML = `<img src="./public/art/backpack-icon.svg" alt="Inventory" class="inventory-icon">`;

        // Add click handler
        inventoryButton.addEventListener('click', () => {
            if (!gameStore.inventorySystem) {
                gameStore.inventorySystem = new InventorySystem(gameStore);
            }
            gameStore.inventorySystem.handleInventoryIconClick();
        });

        controlsContainer.appendChild(inventoryButton);
    },

    initializeFoodButton(controlsContainer) {
        if (document.querySelector('.food-button')) return;

        const foodButton = document.createElement('button');
        foodButton.className = 'game-button food-button';
        foodButton.innerHTML = `<img src="./public/art/food.svg" alt="Food" class="food-icon">`;

        // Add click handler
        foodButton.addEventListener('click', () => {
            if (gameStore.foodSystem) {
                gameStore.foodSystem.handleFoodIconClick();
            }
        });

        controlsContainer.appendChild(foodButton);
    },

    updateFoodButton() {
        const foodButton = document.querySelector('.food-button');
        if (!foodButton) return;

        const foodIcon = foodButton.querySelector('.food-icon');
        
        // Update active state based on food system
        if (gameStore.food.isEating) {
            foodButton.classList.add('active');
        } else {
            foodButton.classList.remove('active');
        }

        // Show/hide based on camping/resting state
        if (gameStore.player.isCamping || gameStore.player.isResting) {
            foodButton.style.display = 'flex';
        } else {
            foodButton.style.display = 'none';
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
