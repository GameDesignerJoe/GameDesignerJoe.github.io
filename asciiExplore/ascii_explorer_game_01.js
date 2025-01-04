// Basic setup for an ASCII top-down exploration game
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Canvas dimensions
canvas.width = 400;
canvas.height = 400;
document.body.appendChild(canvas);

// Style canvas
canvas.style.backgroundColor = 'white';
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Character setup
let character = {
    x: Math.floor(canvas.width / 2),
    y: Math.floor(canvas.height / 2),
    size: 20, // size in pixels (approximate for font rendering)
    symbol: '@',
};

// Update function
function update() {
    draw();
}

// Draw function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    ctx.fillStyle = 'black';
    ctx.fillText(character.symbol, character.x, character.y);
}

// Movement controls
const moveDistance = 20; // Adjust movement to match character size

window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'w':
            character.y -= moveDistance;
            break;
        case 's':
            character.y += moveDistance;
            break;
        case 'a':
            character.x -= moveDistance;
            break;
        case 'd':
            character.x += moveDistance;
            break;
    }
    update();
});

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement
        if (deltaX > 0) {
            character.x += moveDistance; // Move right
        } else {
            character.x -= moveDistance; // Move left
        }
    } else {
        // Vertical movement
        if (deltaY > 0) {
            character.y += moveDistance; // Move down
        } else {
            character.y -= moveDistance; // Move up
        }
    }

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    update();
}, { passive: false });

// Initial draw
update();
