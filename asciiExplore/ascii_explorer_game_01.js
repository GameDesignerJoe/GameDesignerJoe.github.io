// Basic setup for an ASCII top-down exploration game
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

document.body.style.margin = '0';
document.body.style.overflow = 'hidden'; // Remove scrollbars

// Canvas dimensions and world setup
const worldWidth = 1000;
const worldHeight = 1000;
const cameraWidth = 400;
const cameraHeight = 400;
canvas.width = cameraWidth;
canvas.height = cameraHeight;
document.body.appendChild(canvas);

// Style canvas
canvas.style.backgroundColor = 'white';
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Character setup
let character = {
    x: Math.floor(worldWidth / 2),
    y: Math.floor(worldHeight / 2),
    size: 20, // size in pixels (approximate for font rendering)
    symbol: '@',
};

// Random objects setup
const symbols = ['*', '^', '~', '|'];
let objects = [];
const objectCount = 50; // Number of objects to place

for (let i = 0; i < objectCount; i++) {
    objects.push({
        x: Math.floor(Math.random() * worldWidth),
        y: Math.floor(Math.random() * worldHeight),
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
    });
}

// Camera setup
let camera = {
    x: (worldWidth - cameraWidth) / 2,
    y: (worldHeight - cameraHeight) / 2,
    width: cameraWidth,
    height: cameraHeight,
};

// Collision detection
function checkCollision(newX, newY) {
    for (let obj of objects) {
        if (newX === obj.x && newY === obj.y) {
            return true;
        }
    }
    return false;
}

// Update function
function update() {
    // Keep the camera centered on the character
    camera.x = Math.max(0, Math.min(worldWidth - camera.width, character.x - camera.width / 2));
    camera.y = Math.max(0, Math.min(worldHeight - camera.height, character.y - camera.height / 2));
    draw();
}

// Draw function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    // Draw the world boundary (edges in black)
    ctx.fillStyle = 'black';
    ctx.fillRect(-camera.x, -camera.y, worldWidth, worldHeight);

    // Draw the world (white background)
    ctx.fillStyle = 'white';
    ctx.fillRect(-camera.x, -camera.y, worldWidth, worldHeight);

    // Draw random objects
    ctx.fillStyle = 'black';
    objects.forEach(obj => {
        ctx.fillText(obj.symbol, obj.x - camera.x, obj.y - camera.y);
    });

    // Draw the character
    ctx.fillStyle = 'green';
    ctx.fillText(character.symbol, character.x - camera.x, character.y - camera.y);
}

// Movement controls
const moveDistance = 20; // Adjust movement to match character size

window.addEventListener('keydown', (e) => {
    let newX = character.x;
    let newY = character.y;

    switch (e.key) {
        case 'w':
            newY = Math.max(0, character.y - moveDistance);
            break;
        case 's':
            newY = Math.min(worldHeight, character.y + moveDistance);
            break;
        case 'a':
            newX = Math.max(0, character.x - moveDistance);
            break;
        case 'd':
            newX = Math.min(worldWidth, character.x + moveDistance);
            break;
        case 'q':
            newX = Math.max(0, character.x - moveDistance); // Diagonal up-left
            newY = Math.max(0, character.y - moveDistance);
            break;
        case 'e':
            newX = Math.min(worldWidth, character.x + moveDistance); // Diagonal up-right
            newY = Math.max(0, character.y - moveDistance);
            break;
        case 'z':
            newX = Math.max(0, character.x - moveDistance); // Diagonal down-left
            newY = Math.min(worldHeight, character.y + moveDistance);
            break;
        case 'c':
            newX = Math.min(worldWidth, character.x + moveDistance); // Diagonal down-right
            newY = Math.min(worldHeight, character.y + moveDistance);
            break;
    }

    if (!checkCollision(newX, newY)) {
        character.x = newX;
        character.y = newY;
    }
    update();
});

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left + camera.x;
    const touchY = touch.clientY - rect.top + camera.y;

    const deltaX = touchX - character.x;
    const deltaY = touchY - character.y;

    const angle = Math.atan2(deltaY, deltaX);
    const newX = Math.min(worldWidth, Math.max(0, character.x + Math.cos(angle) * moveDistance));
    const newY = Math.min(worldHeight, Math.max(0, character.y + Math.sin(angle) * moveDistance));

    if (!checkCollision(newX, newY)) {
        character.x = newX;
        character.y = newY;
    }

    update();
}, { passive: false });

// Mouse click controls
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left + camera.x;
    const clickY = e.clientY - rect.top + camera.y;

    const deltaX = clickX - character.x;
    const deltaY = clickY - character.y;

    const angle = Math.atan2(deltaY, deltaX);
    const newX = Math.min(worldWidth, Math.max(0, character.x + Math.cos(angle) * moveDistance));
    const newY = Math.min(worldHeight, Math.max(0, character.y + Math.sin(angle) * moveDistance));

    if (!checkCollision(newX, newY)) {
        character.x = newX;
        character.y = newY;
    }

    update();
});

// Handle resizing
window.addEventListener('resize', () => {
    canvas.width = cameraWidth;
    canvas.height = cameraHeight;
    update();
});

// Initial draw
update();
