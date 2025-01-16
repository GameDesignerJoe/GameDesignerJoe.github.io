import { GAME_CONFIG, TERRAIN_TYPES } from './config.js';

// Add these variables at the top of script.js with other state variables
let selectedHex = null;
let detailsPanel = null;
let confirmButton = null;
let cancelButton = null;

// JavaScript for Hex Grid Game Using Honeycomb.js

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Initialize basic canvas size
canvas.width = GAME_CONFIG.CANVAS_WIDTH;
canvas.height = GAME_CONFIG.CANVAS_HEIGHT;

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

    // Get terrain type (we'll implement this in the next step)
    const terrain = getHexTerrainType(hex);
    
    // Update panel content
    document.getElementById('terrain-name').textContent = terrain.name;
    document.getElementById('stamina-cost').textContent = terrain.staminaCost || 'None';
    document.getElementById('health-risk').textContent = terrain.healthRisk ? `${terrain.healthRisk * 100}%` : 'None';
    document.getElementById('terrain-description').textContent = terrain.description;
    document.getElementById('terrain-quote').innerHTML = `<em>"${terrain.quote}"</em>`;

    // Enable/disable move button based on passable and stamina
    confirmButton.disabled = !terrain.passable || stamina < (terrain.staminaCost || 0);

    // Position panel
    if (window.innerWidth >= 768) {
        // Desktop positioning - near the cursor
        const rect = canvas.getBoundingClientRect();
        const hexCenter = hex.toPoint();
        const viewportAdjustedX = hexCenter.x + viewportX + rect.left;
        const viewportAdjustedY = hexCenter.y + viewportY + rect.top;

        // Ensure panel stays within viewport
        const panelWidth = 300; // Match CSS width
        const panelHeight = 400; // Match CSS max-height
        
        let left = Math.min(
            Math.max(20, viewportAdjustedX), 
            window.innerWidth - panelWidth - 20
        );
        let top = Math.min(
            Math.max(20, viewportAdjustedY), 
            window.innerHeight - panelHeight - 20
        );

        detailsPanel.style.left = `${left}px`;
        detailsPanel.style.top = `${top}px`;
    }

    // Show panel with animation
    detailsPanel.classList.add('show');
}

// Hide the details panel
function hideDetailsPanel() {
    if (!detailsPanel) return;
    detailsPanel.classList.remove('show');
    selectedHex = null;
    hoveredHex = null;
}

// Get terrain type for a hex (placeholder until we implement terrain)
function getHexTerrainType(hex) {
    if (hex.toString() === baseCamp.toString()) {
        return {
            name: "Base Camp",
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "A safe haven where you can rest and recover.",
            quote: "The familiar sight of base camp brings a sense of relief."
        };
    } else if (hex.toString() === southPole.toString() && isHexVisible(hex)) {
        return {
            name: "South Pole",
            passable: true,
            staminaCost: GAME_CONFIG.MOVE_STAMINA_COST,
            description: "The ultimate goal of your expedition.",
            quote: "Could this be it? The South Pole itself?"
        };
    }
    
    // Default to normal snow for now (we'll expand this later)
    return TERRAIN_TYPES.NORMAL_SNOW;
}

// Initialize Honeycomb grid
const Honeycomb = window.Honeycomb;
const Hex = Honeycomb.extendHex({
    size: GAME_CONFIG.HEX_SIZE
});
const Grid = Honeycomb.defineGrid(Hex);

// Create initial grid
const grid = Grid.rectangle({ 
    width: GAME_CONFIG.GRID_WIDTH, 
    height: GAME_CONFIG.GRID_HEIGHT 
});

// Game state initialization
let playerHex = grid.filter(hex => hex.y === 0)[Math.floor(grid.filter(hex => hex.y === 0).length / 2)];
const baseCamp = playerHex;
let southPole = grid.filter(hex => hex.y === Math.max(...grid.map(h => h.y)))[Math.floor(Math.random() * GAME_CONFIG.GRID_WIDTH)];
let hoveredHex = null;
let southPoleVisited = false;

// Track visited hexes
let visitedHexes = new Set([playerHex.toString()]); // Initialize with starting position

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

// Calculate grid boundaries
let gridBounds = {
    minX: Math.min(...grid.map(hex => hex.toPoint().x)),
    maxX: Math.max(...grid.map(hex => hex.toPoint().x)),
    minY: Math.min(...grid.map(hex => hex.toPoint().y)),
    maxY: Math.max(...grid.map(hex => hex.toPoint().y))
};

function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 40, 450); // 40px for padding
    
    canvas.width = maxWidth;
    canvas.height = maxWidth;
    
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

function drawHex(x, y, hex, baseColor) {
    // Draw the hex shape
    ctx.beginPath();
    const corners = hex.corners();
    corners.forEach((corner, index) => {
        const cornerX = x + corner.x;
        const cornerY = y + corner.y;
        if (index === 0) ctx.moveTo(cornerX, cornerY);
        else ctx.lineTo(cornerX, cornerY);
    });
    ctx.closePath();
    
    // Determine if hex is adjacent to player
    const isAdjacent = playerHex.distance(hex) === 1;
    
    // Apply different shades based on hover and adjacency
    let color = baseColor;
    if (hex === hoveredHex && isAdjacent && stamina >= GAME_CONFIG.MOVE_STAMINA_COST) {
        // Darken the color for hoverable hexes
        color = adjustColor(baseColor, -30);
    }
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER;
    ctx.stroke();
}

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

    // Draw all regular hexes first
    grid.forEach(hex => {
        if (hex !== baseCamp && hex !== playerHex) {
            const { x, y } = hex.toPoint();
            const visible = isHexVisible(hex);
            
            // For south pole
            if (hex === southPole) {
                if (visible) {
                    drawHex(x, y, hex, GAME_CONFIG.COLORS.SOUTH_POLE);
                } else {
                    drawHex(x, y, hex, GAME_CONFIG.COLORS.FOG_OF_WAR);
                }
            }
            // For all other hexes
            else {
                const color = visible ? GAME_CONFIG.COLORS.VISITED_HEX : GAME_CONFIG.COLORS.FOG_OF_WAR;
                drawHex(x, y, hex, color);
            }
        }
    });

    // Draw base camp
    drawHex(baseCamp.toPoint().x, baseCamp.toPoint().y, baseCamp, GAME_CONFIG.COLORS.BASE_CAMP);
    
    // Draw player circle (always on top)
    const { x, y } = playerHex.toPoint();
    ctx.beginPath();
    const center = playerHex.center();
    ctx.arc(x + center.x, y + center.y, GAME_CONFIG.HEX_SIZE * GAME_CONFIG.PLAYER_CIRCLE_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = GAME_CONFIG.COLORS.PLAYER;
    ctx.fill();
    ctx.strokeStyle = GAME_CONFIG.COLORS.HEX_BORDER;
    ctx.stroke();
    
    requestAnimationFrame(initializeGrid);
}

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
function movePlayer(newHex) {
    if (!newHex || !gameRunning) return;
    
    // Check if trying to move too far
    if (playerHex.distance(newHex) > 1) return;
    
    const terrain = getHexTerrainType(newHex);
    
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


// It died here:

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

// Initialize game
function initGame() {
    resizeCanvas();
    viewportX = canvas.width / 2 - playerHex.toPoint().x;
    viewportY = canvas.height / 2 - playerHex.toPoint().y;
    lastStatUpdate = Date.now();
    lastMoveTime = Date.now();
    addEventListeners();
    requestAnimationFrame(initializeGrid);
    setInterval(updateStats, 50);
}

// Initialize hover check timing
let lastHoverCheck = 0;

// Start the game
initGame();