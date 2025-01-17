// Player stats object
const playerStats = {
    health: 100, // Max: 100
    stamina: 100, // Max: 100
    hunger: 100 // Max: 100
};

// Grid and viewport dimensions
const gridWidth = 10; // Total columns
const gridHeight = 20; // Total rows
const tileSize = 42; // Tile size (including gap)
const viewportWidth = 7; // Number of visible columns
const viewportHeight = 9; // Number of visible rows

// Player, Base Camp, and South Pole positions
let playerPosition = { x: Math.floor(gridWidth / 2), y: 0 }; // Start at top-center
const startingPosition = { ...playerPosition }; // Base Camp
let southPolePosition;
let hasVisitedSouthPole = false; // Track if the South Pole has been visited

// Viewport position
let viewportX = 0; // Top-left corner of the viewport
let viewportY = 0;

// Player movement
let isMoving = false; // Track if the player is currently moving

// Game over
let gameOver = false;

// Ensure South Pole is not at the starting position
do {
    southPolePosition = {
        x: Math.floor(Math.random() * gridWidth),
        y: gridHeight - 1 // Last row
    };
} while (southPolePosition.x === startingPosition.x && southPolePosition.y === startingPosition.y);

// DOM Elements
const gridContainer = document.getElementById("grid-container");
const gridElement = document.createElement("div");
gridElement.classList.add("grid");
gridContainer.appendChild(gridElement);

// Initialize the grid
function initializeGrid() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell", "hidden"); // All cells start hidden

            if (x === startingPosition.x && y === startingPosition.y) {
                cell.classList.add("base-camp"); // Mark Base Camp
            } else if (x === playerPosition.x && y === playerPosition.y) {
                cell.classList.add("player"); // Mark the player
            }

            // Add click and touch event listeners for movement
            cell.addEventListener("click", () => handleTileClick(x, y));
            cell.addEventListener("touchstart", () => handleTileClick(x, y));

            gridElement.appendChild(cell);
        }
    }

    // Reveal initial tiles around the player
    revealTiles(playerPosition.x, playerPosition.y);
    updateViewport();
}

// Reveal a tile and its neighbors
function revealTiles(x, y) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            // Ensure the tile is within bounds
            if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                const index = ny * gridWidth + nx;
                const cell = gridElement.children[index];
                cell.classList.remove("hidden");

                // Dynamically reveal the South Pole
                if (nx === southPolePosition.x && ny === southPolePosition.y) {
                    cell.classList.add("south-pole");
                }
            }
        }
    }
}

// Function to update stat bars
function updateStatBars() {
    document.getElementById("health-bar").style.width = `${playerStats.health}%`;
    document.getElementById("stamina-bar").style.width = `${playerStats.stamina}%`;
    document.getElementById("hunger-bar").style.width = `${playerStats.hunger}%`;

    // Update colors based on values
    updateStatColor("health-bar", playerStats.health);
    updateStatColor("stamina-bar", playerStats.stamina);
    updateStatColor("hunger-bar", playerStats.hunger);
}

// Function to change bar color based on value
function updateStatColor(barId, value) {
    const bar = document.getElementById(barId);
    if (value > 50) {
        bar.style.backgroundColor = "green";
    } else if (value > 20) {
        bar.style.backgroundColor = "yellow";
    } else {
        bar.style.backgroundColor = "red";
    }
}

// Regenerate stamina over time
setInterval(() => {
    regenerateStamina();
}, 1000); // Trigger every second

// Check for health decay over time
setInterval(() => {
    checkHealthDecay();
}, 1000); // Trigger every second

// Function to regenerate stamina
function regenerateStamina() {
    if (playerStats.stamina < 100) {
        playerStats.stamina = Math.min(100, playerStats.stamina + 5); // Regenerate 5% per second
        updateStatBars(); // Update the UI
    }
}

function checkHealthDecay() {
    // Check if the player is NOT on Base Camp
    if (playerPosition.x !== startingPosition.x || playerPosition.y !== startingPosition.y) {
        playerStats.health = Math.max(0, playerStats.health - 1); // Reduce health by 1 per second
        updateStatBars(); // Update the UI
    }

    // Check for player death
    if (playerStats.health <= 0 && !gameOver) {
        gameOver = true; // Ensure the alert only happens once
        alert("You have perished in the icy wilderness!");
        restartGame(); // Trigger restart
    }
}

// Apply effects when the player performs an action
function applyStatEffects(action) {
    if (action === "move") {
        playerStats.stamina = Math.max(0, playerStats.stamina - 10); // Reduce stamina by 20%
    }

    // Gradual hunger decrease
    playerStats.hunger = Math.max(0, playerStats.hunger - 0.5);

    // Update the stat bars
    updateStatBars();
}



// Attempt to move the player to a new position
function attemptMove(newX, newY) {
    // Prevent movement if stamina is 0 or less
    if (playerStats.stamina <= 0) {
        alert("You are too exhausted to move! Wait to recover stamina.");
        return; // Exit the function early
    }

    // Check if the target position is within bounds
    if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
        const index = newY * gridWidth + newX;
        const cell = gridElement.children[index];

        // Ensure the target tile is revealed (not hidden)
        if (!cell.classList.contains("hidden")) {
            playerPosition.x = newX;
            playerPosition.y = newY;

            // Update player position and apply movement effects
            updatePlayerPosition();
            applyStatEffects("move"); // Reduce stamina on movement
        }
    }
}


// Handle tile clicks or touch inputs
function handleTileClick(x, y) {
    if (isMoving) return; // Ignore if already moving

    // Validate that the clicked/tapped tile is adjacent
    const dx = Math.abs(x - playerPosition.x);
    const dy = Math.abs(y - playerPosition.y);

    if ((dx <= 1 && dy <= 1) && (dx + dy > 0)) { // Allow diagonal and adjacent movement
        isMoving = true; // Lock movement
        attemptMove(x, y);

        // Add a small delay before allowing another move
        setTimeout(() => {
            isMoving = false;
        }, 300); // 300ms delay (adjust for your desired pace)
    }

    highlightTargetCell(x, y); // Highlight the target tile
}

// Update the player's position in the grid
function updatePlayerPosition() {
    const cells = gridElement.querySelectorAll(".grid-cell");
    cells.forEach((cell) => cell.classList.remove("player"));

    const index = playerPosition.y * gridWidth + playerPosition.x;
    cells[index].classList.add("player");

    revealTiles(playerPosition.x, playerPosition.y); // Reveal tiles around the player
    checkEvents();
    updateViewport();
}

gridElement.addEventListener("touchstart", (event) => {
    const touch = event.touches[0]; // Get the first touch point
    const rect = gridElement.getBoundingClientRect();

    // Calculate the grid coordinates from the touch position
    const x = Math.floor((touch.clientX - rect.left) / tileSize);
    const y = Math.floor((touch.clientY - rect.top) / tileSize);

    handleTileClick(x, y); // Handle the movement
    event.preventDefault(); // Prevent additional touch events
}, { passive: false });


// highlight the target cell during movement
function highlightTargetCell(x, y) {
    const index = y * gridWidth + x;
    const cells = gridElement.querySelectorAll(".grid-cell");

    cells.forEach((cell) => cell.classList.remove("highlight"));
    if (index >= 0 && index < cells.length) {
        cells[index].classList.add("highlight");
    }
}

// Update the viewport position
function updateViewport() {
    // Adjust viewport position if the player is near the edge
    if (playerPosition.x - viewportX <= 2 && viewportX > 0) {
        viewportX--; // Shift viewport left
    } else if (playerPosition.x - viewportX >= viewportWidth - 3 && viewportX + viewportWidth < gridWidth) {
        viewportX++; // Shift viewport right
    }
    if (playerPosition.y - viewportY <= 2 && viewportY > 0) {
        viewportY--; // Shift viewport up
    } else if (playerPosition.y - viewportY >= viewportHeight - 3 && viewportY + viewportHeight < gridHeight) {
        viewportY++; // Shift viewport down
    }

    // Apply the viewport position to the grid
    gridElement.style.transform = `translate(-${viewportX * tileSize}px, -${viewportY * tileSize}px)`;
}

// Check for events
function checkEvents() {
    // Reaching the South Pole
    if (!hasVisitedSouthPole && playerPosition.x === southPolePosition.x && playerPosition.y === southPolePosition.y) {
        hasVisitedSouthPole = true;
        alert("Congratulations! You have reached the South Pole! Now, return to your starting position to win.");
    }

    // Returning to Base Camp
    if (hasVisitedSouthPole && playerPosition.x === startingPosition.x && playerPosition.y === startingPosition.y) {
        alert("Victory! You have successfully completed your journey to the South Pole and back.");
        hasVisitedSouthPole = false; // Reset for replayability (optional)
        restartGame(); // Restart the game
    }
}

// Keyboard controls
document.addEventListener("keydown", (event) => {
    switch (event.key) {
        case "ArrowUp":
        case "w":
            attemptMove(playerPosition.x, playerPosition.y - 1);
            break;
        case "ArrowDown":
        case "s":
            attemptMove(playerPosition.x, playerPosition.y + 1);
            break;
        case "ArrowLeft":
        case "a":
            attemptMove(playerPosition.x - 1, playerPosition.y);
            break;
        case "ArrowRight":
        case "d":
            attemptMove(playerPosition.x + 1, playerPosition.y);
            break;
        case "q": // Diagonal Up-Left
            attemptMove(playerPosition.x - 1, playerPosition.y - 1);
            break;
        case "e": // Diagonal Up-Right
            attemptMove(playerPosition.x + 1, playerPosition.y - 1);
            break;
        case "z": // Diagonal Down-Left
            attemptMove(playerPosition.x - 1, playerPosition.y + 1);
            break;
        case "c": // Diagonal Down-Right
            attemptMove(playerPosition.x + 1, playerPosition.y + 1);
            break;
    }
});

// Restart the game
function restartGame() {
    location.reload(); // Refresh the page to restart the game
}


// Initialize the grid
initializeGrid();
updatePlayerPosition();