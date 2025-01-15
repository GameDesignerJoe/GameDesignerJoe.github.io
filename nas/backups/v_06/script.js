// JavaScript for Hex Grid Game Using Honeycomb.js

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 450;
canvas.height = 450;

const Honeycomb = window.Honeycomb;
const Hex = Honeycomb.extendHex({
    size: 30
});
const Grid = Honeycomb.defineGrid(Hex);

// Create a grid (15x30 hex grid)
const grid = Grid.rectangle({ width: 15, height: 30 });

// Calculate grid boundaries
const gridBounds = {
    minX: Math.min(...grid.map(hex => hex.toPoint().x)),
    maxX: Math.max(...grid.map(hex => hex.toPoint().x)),
    minY: Math.min(...grid.map(hex => hex.toPoint().y)),
    maxY: Math.max(...grid.map(hex => hex.toPoint().y))
};

// Define player position
let playerHex = grid.filter(hex => hex.y === 0)[Math.floor(grid.filter(hex => hex.y === 0).length / 2)];
const baseCamp = playerHex;
let southPole = grid.filter(hex => hex.y === Math.max(...grid.map(h => h.y)))[Math.floor(Math.random() * 15)];
let hoveredHex = null;
let southPoleVisited = false;

// Stats
let stamina = 100;
let health = 100;
let hunger = 100;
let gameRunning = true;

// Viewport state
let viewportX = 0;
let viewportY = 0;

function calculateViewportPosition() {
    const playerPos = playerHex.toPoint();
    const horizontalMargin = 200; // Doubled from 60 to 120
    const verticalMargin = 200;  // Added vertical margin
    
    // Calculate ideal centered position
    let idealX = canvas.width / 2 - playerPos.x;
    let idealY = canvas.height / 2 - playerPos.y;
    
    // Constrain viewport to grid boundaries
    const maxOffsetX = canvas.width - gridBounds.maxX - horizontalMargin;
    const minOffsetX = -gridBounds.minX + horizontalMargin;
    const maxOffsetY = canvas.height - gridBounds.maxY - verticalMargin;
    const minOffsetY = -gridBounds.minY + verticalMargin;
    
    idealX = Math.min(minOffsetX, Math.max(maxOffsetX, idealX));
    idealY = Math.min(minOffsetY, Math.max(maxOffsetY, idealY));
    
    // Check if player is near viewport edges
    const currentPlayerScreenX = playerPos.x + viewportX;
    const currentPlayerScreenY = playerPos.y + viewportY;
    
    // Update horizontal position
    if (currentPlayerScreenX < horizontalMargin || 
        currentPlayerScreenX > canvas.width - horizontalMargin) {
        viewportX = idealX;
    }
    
    // Update vertical position
    if (currentPlayerScreenY < verticalMargin || 
        currentPlayerScreenY > canvas.height - verticalMargin) {
        viewportY = idealY;
    }
    
    // Start at top of viewport
    if (playerHex === baseCamp) {
        viewportY = 20;
    }
    
    return { x: viewportX, y: viewportY };
}

function updateViewport() {
    const { x, y } = calculateViewportPosition();
    ctx.setTransform(1, 0, 0, 1, x, y);
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
    if (hex === hoveredHex && isAdjacent) {
        // Darken the color for hoverable hexes
        color = adjustColor(baseColor, -30);
    }
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.stroke();
}

function initializeGrid() {
    ctx.clearRect(-viewportX, -viewportY, canvas.width, canvas.height);
    updateViewport();

    // Draw all hexes
    grid.forEach(hex => {
        const { x, y } = hex.toPoint();
        const isVisible = playerHex.distance(hex) <= 1;
        const color = isVisible ? "lightgray" : "darkgray";
        drawHex(x, y, hex, color);
    });

    // Draw special hexes
    drawHex(baseCamp.toPoint().x, baseCamp.toPoint().y, baseCamp, "gold");
    drawHex(southPole.toPoint().x, southPole.toPoint().y, southPole, "blue");
    drawHex(playerHex.toPoint().x, playerHex.toPoint().y, playerHex, "green");
}

function updateStatsDisplay() {
    const healthBar = document.getElementById("health-bar");
    const staminaBar = document.getElementById("stamina-bar");
    const hungerBar = document.getElementById("hunger-bar");
    
    // Update width and add transition
    healthBar.style.width = `${Math.max(0, Math.min(100, health))}%`;
    staminaBar.style.width = `${Math.max(0, Math.min(100, stamina))}%`;
    hungerBar.style.width = `${Math.max(0, Math.min(100, hunger))}%`;
    
    // Update colors based on values
    healthBar.style.backgroundColor = `rgb(${255 - (health * 2.55)}, ${health * 2.55}, 0)`;
    staminaBar.style.backgroundColor = `rgb(0, ${stamina * 2.55}, ${255 - (stamina * 2.55)})`;
    hungerBar.style.backgroundColor = `rgb(${hunger * 2.55}, ${hunger * 1.5}, 0)`;
}

function updateStats() {
    if (!gameRunning) return;

    if (playerHex === baseCamp) {
        stamina = Math.min(100, stamina + 1);
        hunger = Math.min(100, hunger + 0.5);
        health = Math.min(100, health + 0.5);
    } else {
        health = Math.max(0, health - 0.1);
        hunger = Math.max(0, hunger - 0.05);
        stamina = Math.min(100, stamina + 0.2);
    }

    if (hunger <= 0) {
        alert("You starved to death!");
        restartGame();
    }
    if (health <= 0) {
        alert("You froze to death!");
        restartGame();
    }

    updateStatsDisplay();
}

function movePlayer(newHex) {
    if (!newHex || stamina <= 0 || playerHex.distance(newHex) > 1 || !gameRunning) return;

    playerHex = newHex;
    stamina = Math.max(0, stamina - 5);

    if (playerHex === southPole) {
        southPoleVisited = true;
        alert("You found the South Pole! Return to base camp to win!");
    } else if (playerHex === baseCamp && southPoleVisited) {
        alert("You returned to base camp and won the game!");
        restartGame();
    }

    initializeGrid();
}

function restartGame() {
    stamina = 100;
    health = 100;
    hunger = 100;
    playerHex = baseCamp;
    southPoleVisited = false;
    gameRunning = true;
    initializeGrid();
}

// Event listeners
canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to hex coordinates, accounting for viewport transform
    const adjustedX = mouseX - viewportX;
    const adjustedY = mouseY - viewportY;
    
    const newHoveredHex = Grid.pointToHex([adjustedX, adjustedY]);
    
    if (!hoveredHex || !newHoveredHex || hoveredHex.q !== newHoveredHex.q || hoveredHex.r !== newHoveredHex.r) {
        hoveredHex = newHoveredHex;
        initializeGrid();
    }
});

canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to hex coordinates, accounting for viewport transform
    const adjustedX = mouseX - viewportX;
    const adjustedY = mouseY - viewportY;
    
    const clickedHex = Grid.pointToHex([adjustedX, adjustedY]);
    movePlayer(clickedHex);
});

// Start game
viewportX = canvas.width / 2 - playerHex.toPoint().x;
viewportY = 20;
initializeGrid();
setInterval(updateStats, 100);