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

// Attempt to move the player to a new position
function attemptMove(newX, newY) {
    // Check if the target position is within bounds
    if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
        const index = newY * gridWidth + newX;
        const cell = gridElement.children[index];

        // Ensure the target tile is revealed (not hidden)
        if (!cell.classList.contains("hidden")) {
            playerPosition.x = newX;
            playerPosition.y = newY;
            updatePlayerPosition();
        }
    }
}

// Handle tile clicks or touch inputs
function handleTileClick(x, y) {
    // Validate that the clicked/tapped tile is adjacent
    const dx = Math.abs(x - playerPosition.x);
    const dy = Math.abs(y - playerPosition.y);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        attemptMove(x, y);
    }
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
    }
});

// Initialize the grid
initializeGrid();
updatePlayerPosition();
