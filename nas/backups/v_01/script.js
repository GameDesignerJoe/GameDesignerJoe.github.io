const gridContainer = document.getElementById("grid-container");

const gridWidth = 10; // 10
const gridHeight = 20; // 20
const grid = [];
let playerPosition = { x: Math.floor(gridWidth / 2), y: 0 }; // Top-center starting position
const startingPosition = { ...playerPosition }; // Store the static starting position
let southPolePosition;
let gameInitialized = false; // Track initialization
let hasVisitedSouthPole = false;

// Ensure South Pole is not at the starting position
do {
    southPolePosition = {
        x: Math.floor(Math.random() * gridWidth), // Random column
        y: gridHeight - 1 // Last row (bottom-most)
    };
} while (southPolePosition.x === startingPosition.x && southPolePosition.y === startingPosition.y);

// Initialize the grid
function initializeGrid() {
    for (let row = 0; row < gridHeight; row++) {
        grid[row] = [];
        for (let col = 0; col < gridWidth; col++) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell", "hidden");
            cell.dataset.x = col;
            cell.dataset.y = row;
            grid[row][col] = cell;
            gridContainer.appendChild(cell);

            // Enable click-to-move
            cell.addEventListener("click", () => handleClick(col, row));
        }
    }

    // Highlight starting position
    grid[startingPosition.y][startingPosition.x].classList.add("starting-point");

    // Mark the South Pole
    grid[southPolePosition.y][southPolePosition.x].classList.add("south-pole");

    // Reveal starting position
    revealTile(playerPosition.x, playerPosition.y);
    updatePlayerPosition();

    gameInitialized = true; // Mark the game as fully initialized
}

// Update player position on the grid
function updatePlayerPosition() {
    // Clear previous player position
    grid.flat().forEach((cell) => cell.classList.remove("player"));

    // Set current position
    const playerCell = grid[playerPosition.y][playerPosition.x];
    playerCell.classList.add("player");

    // Check for events
    checkEvents();
}

// Handle movement
function movePlayer(dx, dy) {
    const newX = playerPosition.x + dx;
    const newY = playerPosition.y + dy;

    if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
        playerPosition.x = newX;
        playerPosition.y = newY;
        revealTile(newX, newY);
        updatePlayerPosition();
    }
}

// Reveal a tile
function revealTile(x, y) {
    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        grid[y][x].classList.remove("hidden");
    }
}

// Handle click-to-move
function handleClick(x, y) {
    const dx = x - playerPosition.x;
    const dy = y - playerPosition.y;

    // Allow only adjacent moves
    if (Math.abs(dx) + Math.abs(dy) === 1) {
        movePlayer(dx, dy);
    }
}

// Check for special events
function checkEvents() {
    if (!gameInitialized) return; // Prevent premature checks

    const { x, y } = playerPosition;

    // Check if player reaches the South Pole
    if (x === southPolePosition.x && y === southPolePosition.y) {
        if (!hasVisitedSouthPole) {
            hasVisitedSouthPole = true; // Mark as visited
            alert("Congratulations! You have reached the South Pole! Now, return to your starting position to win.");
        }
    }

    // Check if player returns to the starting position after visiting the South Pole
    if (x === startingPosition.x && y === startingPosition.y) {
        if (hasVisitedSouthPole) {
            alert("Victory! You have successfully completed your journey to the South Pole and back.");
            hasVisitedSouthPole = false; // Reset for replayability (optional)
        }
    }
}

// Event listener for keyboard controls
document.addEventListener("keydown", (event) => {
    switch (event.key) {
        case "ArrowUp":
        case "w":
            movePlayer(0, -1);
            break;
        case "ArrowDown":
        case "s":
            movePlayer(0, 1);
            break;
        case "ArrowLeft":
        case "a":
            movePlayer(-1, 0);
            break;
        case "ArrowRight":
        case "d":
            movePlayer(1, 0);
            break;
    }
});

// Initialize the game
initializeGrid();
