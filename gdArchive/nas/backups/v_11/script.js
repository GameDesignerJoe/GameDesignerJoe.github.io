// ============================================
// NOT ALL SURVIVE
// An Antarctic Exploration Survival Game
// ============================================

/*
TABLE OF CONTENTS
1. IMPORTS
2. CANVAS INITIALIZATION
3. GRID SETUP
4. DECLARE VARIABLES
5. TERRAIN SYSTEMS
6. CANVAS / VIEWPORT FUNCTIONS
7. GAME STATE FUNCTIONS
8. DETAILS PANEL UI
9. VISIBILITY SYSTEM
10. INPUT HANDLING
11. DEBUG
12. GAME INITIALIZATION
*/


// --------------------------------------------
// IMPORTS //
// --------------------------------------------
// External dependencies and configuration imports
// Contains game settings and terrain type definitions

import { GAME_CONFIG, TERRAIN_TYPES } from './config.js';


// --------------------------------------------
// DEBUG FLAGS //
// --------------------------------------------

// Debug flags - set these to true to enable different types of logging
const DEBUG = {
    TERRAIN: {
        INITIALIZATION: false,  // For initial terrain assignment
        DISTRIBUTION: false,    // For terrain distribution stats
        SELECTION: false      // For terrain checks during rendering
    },
    HEX_SELECTION: {
        HOVER: false,         // For hover checks
        CLICK: false          // For click/selection events
    },
    GAME_STATE: {
        INITIALIZATION: false, // For game start
        MOVEMENT: false       // For movement events
    }
};



// --------------------------------------------
// CANVAS INITIALIZATION //
// --------------------------------------------
// Sets up the game's canvas element and context
// Initializes basic canvas dimensions for the game view

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Initialize basic canvas size
canvas.width = GAME_CONFIG.CANVAS_WIDTH;
canvas.height = GAME_CONFIG.CANVAS_HEIGHT;



// --------------------------------------------
// GRID SETUP //
// --------------------------------------------
// Initializes the hexagonal grid system using Honeycomb.js
// Creates the game world's structure and layout

// Initialize Honeycomb grid
const Honeycomb = window.Honeycomb;
const Hex = Honeycomb.extendHex({
    size: GAME_CONFIG.HEX_SIZE,
    terrain: null
});
const Grid = Honeycomb.defineGrid(Hex);

// Create initial grid
const grid = Grid.rectangle({ 
    width: GAME_CONFIG.GRID_WIDTH, 
    height: GAME_CONFIG.GRID_HEIGHT 
});

// Add a debug check for grid creation
if (DEBUG.TERRAIN.INITIALIZATION) {
    // Test if we can set and get a property
    const testHex = grid[0];
    testHex.terrain = 'TEST';
    console.log('Property test:', {
        set: 'TEST',
        get: testHex.terrain,
        hexProps: Object.keys(testHex)
    });
}


// --------------------------------------------
// DECLARE VARIABLES //
// --------------------------------------------
// Defines all game state variables including:
// - UI element references
// - Game state tracking
// - Player stats and position
// - Viewport and display state

// Add these variables at the top of script.js with other state variables
let selectedHex = null;
let detailsPanel = null;
let confirmButton = null;
let cancelButton = null;

// Game state initialization
let playerHex = grid.filter(hex => hex.y === 0)[Math.floor(grid.filter(hex => hex.y === 0).length / 2)];
const baseCamp = playerHex;
let southPole = grid.filter(hex => hex.y >= GAME_CONFIG.GRID_HEIGHT - 2)[Math.floor(Math.random() * GAME_CONFIG.GRID_WIDTH)];
let hoveredHex = null;
let southPoleVisited = false;

// Stats
let stamina = GAME_CONFIG.STARTING_STATS.STAMINA;
let health = GAME_CONFIG.STARTING_STATS.HEALTH;
let hunger = GAME_CONFIG.STARTING_STATS.HUNGER;
let gameRunning = true;
let lastStatUpdate = Date.now();
let lastMoveTime = Date.now();

// Viewport state
let viewportX = 0;
let viewportY = 0;

// Initialize hover check timing
let lastHoverCheck = 0;

// Track visited hexes
let visitedHexes = new Set([playerHex.toString()]); // Initialize with starting position

// Calculate grid boundaries
let gridBounds = {
    minX: Math.min(...grid.map(hex => hex.toPoint().x)),
    maxX: Math.max(...grid.map(hex => hex.toPoint().x)),
    minY: Math.min(...grid.map(hex => hex.toPoint().y)),
    maxY: Math.max(...grid.map(hex => hex.toPoint().y))
};



// --------------------------------------------
// TERRAIN SYSTEMS
// --------------------------------------------
// Handles all terrain-related functionality including:
// - Terrain type initialization and distribution
// - Terrain property lookups
// - Special location handling (base camp, south pole)

// Initialize terrain for the entire grid
function initializeGridTerrain() {
    console.log('Starting terrain initialization');
    grid.forEach(initializeHexTerrain);
    console.log('Finished terrain initialization');
    debugTerrainInitialization();
    debugTerrainDistribution();
}

// Initialize hex with terrain type
function initializeHexTerrain(hex) {
    // Don't assign terrain to base camp or south pole
    if (hex.toString() === baseCamp.toString()) {
        hex.terrain = 'BASE_CAMP';
        debugTerrainAssignment(hex, 'BASE_CAMP');
        return;
    }
    if (hex.toString() === southPole.toString()) {
        hex.terrain = 'SOUTH_POLE';
        debugTerrainAssignment(hex, 'SOUTH_POLE');
        return;
    }

    // Terrain distribution weights
    const weights = {
        NORMAL_SNOW: 50,
        DEEP_SNOW: 25,
        ICE_FIELD: 15,
        CLIFF: 7,
        CREVASSE: 3
    };

    // Random weighted selection
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (const [terrain, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            hex.terrain = terrain;
            debugTerrainAssignment(hex, terrain);
            break;
        }
    }
}

// Get terrain type for a hex
function getHexTerrainType(hex) {
    debugHexDetails(hex, 'Getting Terrain');
    
    if (hex.terrain === 'BASE_CAMP') {
        return {
            name: "Base Camp",
            color: GAME_CONFIG.COLORS.BASE_CAMP,
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "A safe haven where you can rest and recover.",
            quote: "The familiar sight of base camp brings a sense of relief."
        };
    }
    
    if (hex.terrain === 'SOUTH_POLE') {
        return {
            name: "South Pole",
            color: GAME_CONFIG.COLORS.SOUTH_POLE,
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "The ultimate goal of your expedition.",
            quote: "Could this be it? The South Pole itself?"
        };
    }

    // Get the terrain type from config
    if (!hex.terrain) {
        console.warn('Hex has no terrain assigned:', hex);
        return TERRAIN_TYPES.NORMAL_SNOW; // Fallback
    }
    const terrainType = TERRAIN_TYPES[hex.terrain];
    if (!terrainType) {
        console.error('Unknown terrain type:', hex.terrain);
        return TERRAIN_TYPES.NORMAL_SNOW;
    }
    return terrainType;
    
}


// --------------------------------------------
// CANVAS / VIEWPORT FUNCTIONS
// --------------------------------------------
// Manages the game's visual presentation including:
// - Canvas sizing and viewport calculations
// - Hex rendering and color management
// - Main rendering loop

// Canvas Management
// Update canvas resizing to match sidebar height
function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 40, 450); // 40px for padding
    
    canvas.width = maxWidth;
    canvas.height = maxWidth; // Keep it square
    
    // Get the canvas's actual position relative to the viewport
    const canvasRect = canvas.getBoundingClientRect();
    
    // Update the details sidebar height and position to exactly match canvas
    const detailsSidebar = document.querySelector('.details-sidebar');
    if (detailsSidebar) {
        detailsSidebar.style.height = `${canvas.height}px`;
        detailsSidebar.style.marginTop = `${canvasRect.top}px`;
    }
    
    // Update the hex size based on the new canvas size
    const newHexSize = Math.floor(maxWidth / (GAME_CONFIG.GRID_WIDTH * 2));
    Hex.prototype.size = newHexSize;
    
    // Recalculate grid boundaries
    gridBounds = {
        minX: Math.min(...grid.map(hex => hex.toPoint().x)),
        maxX: Math.max(...grid.map(hex => hex.toPoint().x)),
        minY: Math.min(...grid.map(hex => hex.toPoint().y)),
        maxY: Math.max(...grid.map(hex => hex.toPoint().y))
    };
}


// Viewport Calcuations
function calculateViewportPosition() {
    const playerPos = playerHex.toPoint();
    
    // Always try to center the player
    let targetX = canvas.width / 2 - playerPos.x;
    let targetY = canvas.height / 2 - playerPos.y;
    
    // Calculate the boundaries where we should stop scrolling
    const rightBoundary = canvas.width - gridBounds.maxX - 50;  // 50px margin
    const leftBoundary = -gridBounds.minX + 50;
    const bottomBoundary = canvas.height - gridBounds.maxY - 50;
    const topBoundary = -gridBounds.minY + 50;
    
    // Constrain the viewport to the boundaries
    targetX = Math.min(leftBoundary, Math.max(rightBoundary, targetX));
    targetY = Math.min(topBoundary, Math.max(bottomBoundary, targetY));
    
    // Smooth transition for viewport movement
    viewportX = viewportX + (targetX - viewportX) * 0.1;
    viewportY = viewportY + (targetY - viewportY) * 0.1;
    
    return { x: viewportX, y: viewportY };
}

function updateViewport() {
    const { x, y } = calculateViewportPosition();
    ctx.setTransform(1, 0, 0, 1, Math.round(x), Math.round(y));
}

// Hex Drawing
function drawHex(x, y, hex, overrideColor = null) {
    if (DEBUG.TERRAIN.SELECTION) {
        console.log('Drawing hex:', hex.toString(), 'terrain:', hex.terrain);
    }
    ctx.beginPath();
    const corners = hex.corners();
    corners.forEach((corner, index) => {
        const cornerX = x + corner.x;
        const cornerY = y + corner.y;
        if (index === 0) ctx.moveTo(cornerX, cornerY);
        else ctx.lineTo(cornerX, cornerY);
    });
    ctx.closePath();
    
    // Determine hex color based on visibility and terrain
    let color;
    if (overrideColor) {
        color = overrideColor;
    } else if (!isHexVisible(hex)) {
        color = GAME_CONFIG.COLORS.FOG_OF_WAR;
    } else if (hex.toString() === baseCamp.toString()) {
        color = GAME_CONFIG.COLORS.BASE_CAMP;
    } else if (hex.toString() === southPole.toString() && isHexVisible(hex)) {
        color = GAME_CONFIG.COLORS.SOUTH_POLE;
    } else {
        const terrain = getHexTerrainType(hex);
        color = terrain.color;
    }

    // Apply hover effect if applicable
    const isAdjacent = playerHex.distance(hex) === 1;
    if (hex === hoveredHex && isAdjacent && stamina >= GAME_CONFIG.MOVE_STAMINA_COST) {
        color = adjustColor(color, -30);
    }
    
    // Draw selected hex indicator
    if (selectedHex && hex.toString() === selectedHex.toString()) {
        // Draw selection glow
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
}

// Helper function to adjust color brightness
function adjustColor(color, amount) {
    if (color.startsWith('#')) {
        color = color.slice(1);
    } else if (color === 'lightgray') {
        return `rgb(${169 + amount}, ${169 + amount}, ${169 + amount})`;
    } else if (color === 'gray') {
        return `rgb(${128 + amount}, ${128 + amount}, ${128 + amount})`;
    }
    return color;
}

// Render Loop
let lastRenderTime = 0;
function initializeGrid(timestamp) {
    // Limit rendering to 60 FPS
    if (timestamp - lastRenderTime < 16) {  // 16ms = ~60 FPS
        requestAnimationFrame(initializeGrid);
        return;
    }
    lastRenderTime = timestamp;
    
    ctx.clearRect(-viewportX, -viewportY, canvas.width, canvas.height);
    updateViewport();

    // Draw all hexes
    grid.forEach(hex => {
        const { x, y } = hex.toPoint();
        // console.log(hex.toString(), hex.terrain);
        
        // Always draw the hex with its proper terrain color
        // drawHex will handle visibility and special cases
        drawHex(x, y, hex);
    });

    // Draw player circle on top
    const { x, y } = playerHex.toPoint();
    const center = playerHex.center();
    ctx.beginPath();
    ctx.arc(x + center.x, y + center.y, GAME_CONFIG.HEX_SIZE * GAME_CONFIG.PLAYER_CIRCLE_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = GAME_CONFIG.COLORS.PLAYER;
    ctx.fill();
    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER;
    ctx.stroke();
    
    requestAnimationFrame(initializeGrid);
}



// --------------------------------------------
// GAME STATE FUNCTIONS
// --------------------------------------------
// Core game mechanics including:
// - Stats management (health, stamina, hunger)
// - Player movement and effects
// - Game state updates and checks

function updateStats() {
    if (!gameRunning) return;

    const now = Date.now();
    const deltaTime = (now - lastStatUpdate) / 1000; // Convert to seconds
    lastStatUpdate = now;

    if (playerHex.toString() === baseCamp.toString()) {
        // Recovery at base camp
        health = Math.min(100, health + GAME_CONFIG.BASE_HEALTH_REGEN * deltaTime);
        hunger = Math.min(100, hunger + GAME_CONFIG.BASE_HUNGER_REGEN * deltaTime);
        stamina = Math.min(100, stamina + GAME_CONFIG.STAMINA_REGEN_RATE * deltaTime);
    } else {
        // Regular decay
        health = Math.max(0, health - GAME_CONFIG.HEALTH_DECAY_RATE * deltaTime);
        hunger = Math.max(0, hunger - GAME_CONFIG.HUNGER_DECAY_RATE * deltaTime);
        
        // Only regenerate stamina if we haven't moved recently
        const timeSinceLastMove = (now - lastMoveTime) / 1000;
        if (timeSinceLastMove > 0.5) { // Small delay before regenerating stamina
            stamina = Math.min(100, stamina + GAME_CONFIG.STAMINA_REGEN_RATE * deltaTime);
        }
    }

    // Check death conditions
    if (hunger <= 0) {
        alert("You starved to death!");
        restartGame();
        return;
    }
    if (health <= 0) {
        alert("You froze to death!");
        restartGame();
        return;
    }

    updateStatsDisplay();
}

function updateStatsDisplay() {
    const healthBar = document.getElementById("health-bar");
    const staminaBar = document.getElementById("stamina-bar");
    const hungerBar = document.getElementById("hunger-bar");
    
    // Update width with smooth transition (CSS handles the animation)
    healthBar.style.width = `${Math.max(0, Math.min(100, health))}%`;
    staminaBar.style.width = `${Math.max(0, Math.min(100, stamina))}%`;
    hungerBar.style.width = `${Math.max(0, Math.min(100, hunger))}%`;
}

// Update the movePlayer function to handle the new movement system
// Update movePlayer to include current location update
function movePlayer(newHex) {
    if (!newHex || !gameRunning) return;
    
    // Check if trying to move too far
    if (playerHex.distance(newHex) > 1) return;
    
    const terrain = getHexTerrainType(newHex);
    debugMovement(playerHex, newHex, terrain);
    
    // If not enough stamina, show warning
    if (stamina < terrain.staminaCost) {
        const staminaBar = document.getElementById("stamina-bar");
        staminaBar.classList.add("pulse-warning");
        setTimeout(() => {
            staminaBar.classList.remove("pulse-warning");
        }, 1500);
        return;
    }

    // Apply terrain effects
    playerHex = newHex;
    visitedHexes.add(playerHex.toString());
    stamina = Math.max(0, stamina - terrain.staminaCost);
    
    if (terrain.healthRisk) {
        health = Math.max(0, health - terrain.healthRisk * 100);
    }
    
    lastMoveTime = Date.now();

    // Update current location in details panel
    updateCurrentLocationDetails();

    // Check for reaching important locations
    if (playerHex.toString() === southPole.toString()) {
        southPoleVisited = true;
        alert("At last! Through bitter cold and endless white, you've reached the South Pole! You plant your flag in triumph, but your journey is far from over. You must now make the perilous trek back to base camp if you hope to tell the world of your discovery.");
    } else if (playerHex.toString() === baseCamp.toString() && southPoleVisited) {
        alert("Against all odds, you've done it! You've not only reached the South Pole but survived the return journey. Your name will be forever etched in the annals of polar exploration. Future generations will speak of your incredible feat of survival and discovery.");
        restartGame();
    }
}

function restartGame() {
    stamina = GAME_CONFIG.STARTING_STATS.STAMINA;
    health = GAME_CONFIG.STARTING_STATS.HEALTH;
    hunger = GAME_CONFIG.STARTING_STATS.HUNGER;
    playerHex = baseCamp;
    southPoleVisited = false;
    gameRunning = true;
    visitedHexes = new Set([playerHex.toString()]); // Reset visited hexes
    lastStatUpdate = Date.now();
    lastMoveTime = Date.now();
}



// --------------------------------------------
// DETAILS PANEL UI
// --------------------------------------------
// Handles the terrain information panel including:
// - Panel initialization and content updates
// - Panel positioning and visibility
// - Move confirmation interface

// Update the updateCurrentLocationDetails function to show terrain details
function updateCurrentLocationDetails() {
    const currentTerrain = getHexTerrainType(playerHex);
    const currentDetailsElement = document.getElementById('current-terrain-details');
    
    if (currentDetailsElement) {
        currentDetailsElement.innerHTML = `
            <h4>${currentTerrain.name}</h4>
            <p>${currentTerrain.description}</p>
            <p class="terrain-quote"><em>"${currentTerrain.quote}"</em></p>
        `;
    }
}

// Initialize the details panel elements
function initializeDetailsPanel() {
    detailsPanel = document.getElementById('details-panel');
    confirmButton = document.getElementById('move-confirm');
    cancelButton = document.getElementById('move-cancel');

    confirmButton.addEventListener('click', () => {
        if (selectedHex) {
            movePlayer(selectedHex);
            hideDetailsPanel();
        }
    });

    cancelButton.addEventListener('click', hideDetailsPanel);
}

// Show the details panel for a hex
function showDetailsPanel(hex) {
    if (!detailsPanel) return;

    // Get terrain type
    const terrain = getHexTerrainType(hex);
    
    // Update current location
    updateCurrentLocationDetails();
    
    // Hide empty state and show terrain details
    detailsPanel.querySelector('.empty-state').classList.add('hidden');
    detailsPanel.querySelector('.terrain-details').classList.remove('hidden');
    
    // Update panel content
    document.getElementById('terrain-name').textContent = terrain.name;
    document.getElementById('stamina-cost').textContent = terrain.staminaCost || 'None';
    document.getElementById('health-risk').textContent = terrain.healthRisk ? `${terrain.healthRisk * 100}%` : 'None';
    document.getElementById('terrain-description').textContent = terrain.description;
    document.getElementById('terrain-quote').innerHTML = `<em>"${terrain.quote}"</em>`;

    // Enable/disable move button based on passable and stamina
    const confirmButton = document.getElementById('move-confirm');
    confirmButton.disabled = !terrain.passable || stamina < (terrain.staminaCost || 0);
}

function hideDetailsPanel() {
    if (!detailsPanel) return;
    
    // Show empty state and hide terrain details
    detailsPanel.querySelector('.empty-state').classList.remove('hidden');
    detailsPanel.querySelector('.terrain-details').classList.add('hidden');
    
    selectedHex = null;
    hoveredHex = null;
}



// --------------------------------------------
// VISIBILITY SYSTEM
// --------------------------------------------
// Manages fog of war mechanics:
// - Determines visible hexes
// - Handles base camp and visited hex visibility

function isHexVisible(hex) {
    // Base camp is always visible
    if (hex.toString() === baseCamp.toString()) {
        return true;
    }
    
    // For all other hexes (including south pole), they must be either:
    // 1. Adjacent to player, or
    // 2. Previously visited
    return playerHex.distance(hex) <= 1 || visitedHexes.has(hex.toString());
}




// --------------------------------------------
// INPUT HANDLING
// --------------------------------------------
// Manages all user interactions including:
// - Mouse and touch event handling
// - Two-step movement system
// - Window resize and orientation changes

// Update the handlePointerEvent function to implement two-step movement
function handlePointerEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
    const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
    
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    // Convert mouse position to hex coordinates, accounting for viewport transform
    const adjustedX = mouseX - viewportX;
    const adjustedY = mouseY - viewportY;
    
    return Grid.pointToHex([adjustedX, adjustedY]);
}

// Update event listeners for two-step movement
function addEventListeners() {
    let touchStartHex = null;
    
    // Initialize details panel
    initializeDetailsPanel();
    
    // Mouse events
    canvas.addEventListener('mousemove', (event) => {
        const now = performance.now();
        if (now - lastHoverCheck < 32) return; // Limit checks
        lastHoverCheck = now;
        
        hoveredHex = handlePointerEvent(event);
    });
    
    canvas.addEventListener('click', (event) => {
        const clickedHex = handlePointerEvent(event);
        
        // Don't allow selecting hexes that are too far
        if (!clickedHex || playerHex.distance(clickedHex) > 1) {
            hideDetailsPanel();
            return;
        }
        
        // If clicking the same hex that's selected, move there
        if (selectedHex && clickedHex.toString() === selectedHex.toString()) {
            movePlayer(clickedHex);
            hideDetailsPanel();
        } else {
            // Otherwise, show the details panel
            selectedHex = clickedHex;
            showDetailsPanel(clickedHex);
        }
    });
    
    // Touch events
    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        touchStartHex = handlePointerEvent(event);
        hoveredHex = touchStartHex;
        
        if (!touchStartHex || playerHex.distance(touchStartHex) > 1) {
            hideDetailsPanel();
            return;
        }
        
        selectedHex = touchStartHex;
        showDetailsPanel(touchStartHex);
    }, { passive: false });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        hideDetailsPanel(); // Hide panel on resize
        requestAnimationFrame(initializeGrid);
    });
    
    // Handle device orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            resizeCanvas();
            hideDetailsPanel(); // Hide panel on orientation change
            requestAnimationFrame(initializeGrid);
        }, 100);
    });
    
    // Handle clicks outside the canvas (to hide the panel)
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#canvas') && !event.target.closest('#details-panel')) {
            hideDetailsPanel();
        }
    });
}



// --------------------------------------------
// DEBUG
// --------------------------------------------
// Debugging and logging functions for:

function debugTerrainDistribution() {
    if (!DEBUG.TERRAIN.DISTRIBUTION) return;
    
    const distribution = {};
    let total = 0;
    
    grid.forEach(hex => {
        if (hex.terrain) {
            distribution[hex.terrain] = (distribution[hex.terrain] || 0) + 1;
            total++;
        }
    });
    
    console.log('=== Terrain Distribution ===');
    console.log('Total hexes:', total);
    console.log('Distribution:', distribution);
    
    // Calculate percentages
    console.log('Percentages:');
    Object.entries(distribution).forEach(([terrain, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        console.log(`${terrain}: ${percentage}%`);
    });
}

function debugTerrainInitialization() {
    if (!DEBUG.TERRAIN.INITIALIZATION) return;
    console.log('=== Terrain Initialization ===');
    
    // Check a few random hexes
    const sampleHexes = grid.slice(0, 5);
    sampleHexes.forEach((hex, i) => {
        console.log(`Sample hex ${i}:`, {
            position: hex.toString(),
            terrain: hex.terrain,
            isBaseCamp: hex.toString() === baseCamp.toString(),
            isSouthPole: hex.toString() === southPole.toString()
        });
    });
}

// Terrain assignment logging
function debugTerrainAssignment(hex, terrainType) {
    if (!DEBUG.TERRAIN.INITIALIZATION) return;
    console.log(`Assigned ${terrainType} to hex:`, hex.toString());
}

function debugHexDetails(hex, stage, terrainData) {
    // Only log for clicks/selection, not constant checks
    if (stage === 'Getting Terrain' && !DEBUG.TERRAIN.SELECTION) return;
    if (stage === 'Showing Details' && !DEBUG.HEX_SELECTION.CLICK) return;
    
    console.log(`=== Hex Details (${stage}) ===`);
    console.log('Hex:', hex.toString());
    console.log('Terrain property:', hex.terrain);
    if (terrainData) {
        console.log('Resolved terrain data:', terrainData);
    }
}

// Game state logging
function debugGameState(type, data) {
    if (!DEBUG.GAME_STATE.INITIALIZATION) return;
    
    console.log(`=== Game State Update (${type}) ===`);
    console.log(data);
}

// Debug initialization logging
function debugInitialization(stage, data) {
    if (!DEBUG.GAME_STATE.INITIALIZATION) return;
    console.log(`=== Initialization (${stage}) ===`);
    console.log(data);
}

// Debug movement logging
function debugMovement(fromHex, toHex, terrain) {
    if (!DEBUG.GAME_STATE.MOVEMENT) return;
    console.log('=== Movement ===');
    console.log('From:', fromHex.toString());
    console.log('To:', toHex.toString());
    console.log('Terrain:', terrain);
}


// --------------------------------------------
// GAME INITIALIZATION
// --------------------------------------------
// Handles game startup and setup:
// - Initial game state setup
// - System initialization
// - Game loop startup


// Update initGame to include debug info
// Update initGame to initialize current location display
function initGame() {
    console.log('=== Game Initialization Start ===');
    resizeCanvas();
    console.log('Canvas resized');
    initializeGridTerrain();
    console.log('Grid terrain initialized');
    debugInitialization('Grid Terrain', 'Terrain initialized');
    debugTerrainDistribution();
    viewportX = canvas.width / 2 - playerHex.toPoint().x;
    viewportY = canvas.height / 2 - playerHex.toPoint().y;
    lastStatUpdate = Date.now();
    lastMoveTime = Date.now();
    addEventListeners();
    updateCurrentLocationDetails(); // Initialize current location display
    requestAnimationFrame(initializeGrid);
    setInterval(updateStats, 50);
}

// Start the game
initGame();