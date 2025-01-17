// JavaScript for Hex Grid Game Using Honeycomb.js

// Game Configuration
const GAME_CONFIG = {
    // Grid settings
    HEX_SIZE: 30,
    GRID_WIDTH: 15,
    GRID_HEIGHT: 30,
    
    // Visual settings
    PLAYER_CIRCLE_SIZE: 0.4,   // Size of player circle relative to hex size (0-1)
    
    // Colors
    COLORS: {
        PLAYER: "green",           // Player circle color
        BASE_CAMP: "gold",         // Base camp hex color
        SOUTH_POLE: "blue",        // South pole hex color
        VISITED_HEX: "lightgray",  // Color of hexes player has visited
        FOG_OF_WAR: "darkgray",    // Color of unexplored hexes
        HEX_BORDER: "white"        // Color of hex borders
    },

    // Starting stats
    STARTING_STATS: {
        HEALTH: 100,
        STAMINA: 100,
        HUNGER: 100
    },
    
    // Stats decay rates (per second)
    HEALTH_DECAY_RATE: 1,    // Lose 0.5% health per second when not at base
    HUNGER_DECAY_RATE: 0.5,   // Lose 0.25% hunger per second
    
    // Movement and stamina
    MOVE_STAMINA_COST: 10,      // Stamina cost per move
    STAMINA_REGEN_RATE: 2,     // Gain 2% stamina per second when not moving
    
    // Recovery rates at base camp (per second)
    BASE_HEALTH_REGEN: 1,      // Gain 1% health per second at base
    BASE_HUNGER_REGEN: 0.5,    // Gain 0.5% hunger per second at base
    BASE_STAMINA_REGEN: 3,     // Gain 3% stamina per second at base
    
    // Canvas dimensions
    CANVAS_WIDTH: 450,
    CANVAS_HEIGHT: 450
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = GAME_CONFIG.CANVAS_WIDTH;
canvas.height = GAME_CONFIG.CANVAS_HEIGHT;

const Honeycomb = window.Honeycomb;
const Hex = Honeycomb.extendHex({
    size: GAME_CONFIG.HEX_SIZE
});
const Grid = Honeycomb.defineGrid(Hex);

// Create a grid
const grid = Grid.rectangle({ 
    width: GAME_CONFIG.GRID_WIDTH, 
    height: GAME_CONFIG.GRID_HEIGHT 
});

// Calculate grid boundaries
const gridBounds = {
    minX: Math.min(...grid.map(hex => hex.toPoint().x)),
    maxX: Math.max(...grid.map(hex => hex.toPoint().x)),
    minY: Math.min(...grid.map(hex => hex.toPoint().y)),
    maxY: Math.max(...grid.map(hex => hex.toPoint().y))
};

// Game state
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

function getHexUnderMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to hex coordinates, accounting for viewport transform
    const adjustedX = mouseX - viewportX;
    const adjustedY = mouseY - viewportY;
    
    return Grid.pointToHex([adjustedX, adjustedY]);
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

    // Draw regular hexes first
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

function movePlayer(newHex) {
    if (!newHex || stamina < GAME_CONFIG.MOVE_STAMINA_COST || 
        playerHex.distance(newHex) > 1 || !gameRunning) return;

    playerHex = newHex;
    visitedHexes.add(playerHex.toString()); // Add new position to visited hexes
    stamina = Math.max(0, stamina - GAME_CONFIG.MOVE_STAMINA_COST);
    lastMoveTime = Date.now();

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

// Throttled hover check
let lastHoverCheck = 0;
canvas.addEventListener("mousemove", (event) => {
    const now = performance.now();
    if (now - lastHoverCheck < 32) { // Limit to ~30 checks per second
        return;
    }
    lastHoverCheck = now;
    
    const newHoveredHex = getHexUnderMouse(event);
    if (!hoveredHex || !newHoveredHex || hoveredHex.q !== newHoveredHex.q || hoveredHex.r !== newHoveredHex.r) {
        hoveredHex = newHoveredHex;
    }
});

canvas.addEventListener("click", (event) => {
    const clickedHex = getHexUnderMouse(event);
    movePlayer(clickedHex);
});

// Start game
viewportX = canvas.width / 2 - playerHex.toPoint().x;
viewportY = canvas.height / 2 - playerHex.toPoint().y;
lastStatUpdate = Date.now();
lastMoveTime = Date.now();
requestAnimationFrame(initializeGrid);
setInterval(updateStats, 50); // Update stats more frequently (20 times per second)