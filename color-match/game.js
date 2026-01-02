// Game State
const gameState = {
    level: 1,
    pairsMatched: 0,
    circles: [],
    selected: null,
    gameOver: false,
    baseColor: null,
    animating: false,
    isNewHighScore: false,
    nextExpectedShade: null,
    failedCircles: [],
    gameMode: null, // 'random' or 'sequential'
    highScores: {
        random: 0,
        sequential: 0
    }
};

// Storage API wrapper
const storage = {
    get: (key) => {
        return new Promise((resolve) => {
            const value = localStorage.getItem(key);
            resolve(value ? { value } : null);
        });
    },
    set: (key, value) => {
        return new Promise((resolve) => {
            localStorage.setItem(key, value);
            resolve();
        });
    }
};

// DOM Elements
let gameBoard, gameArea, levelDisplay, instructionText, connectionLines;
let gameOverSection, finalScore, newHighScoreText, highScoreDisplay;
let newGameBtn, tryAgainBtn;
let startMenu, randomModeBtn, sequentialModeBtn;

// Initialize DOM elements
function initDOMElements() {
    gameBoard = document.getElementById('game-board');
    gameArea = document.getElementById('game-area');
    levelDisplay = document.getElementById('level-display');
    instructionText = document.getElementById('instruction-text');
    connectionLines = document.getElementById('connection-lines');
    
    gameOverSection = document.getElementById('game-over');
    finalScore = document.getElementById('final-score');
    newHighScoreText = document.getElementById('new-high-score');
    highScoreDisplay = document.getElementById('high-score-display');
    
    newGameBtn = document.getElementById('new-game-btn');
    tryAgainBtn = document.getElementById('try-again-btn');
    
    startMenu = document.getElementById('start-menu');
    randomModeBtn = document.getElementById('random-mode-btn');
    sequentialModeBtn = document.getElementById('sequential-mode-btn');
}

// Load high scores from localStorage
async function loadHighScores() {
    try {
        const randomResult = await storage.get('colorMatchHighScore_random');
        if (randomResult && randomResult.value) {
            gameState.highScores.random = parseFloat(randomResult.value);
        }
        
        const sequentialResult = await storage.get('colorMatchHighScore_sequential');
        if (sequentialResult && sequentialResult.value) {
            gameState.highScores.sequential = parseFloat(sequentialResult.value);
        }
    } catch (error) {
        console.log('No previous high scores found');
    }
}

// Save high score to localStorage
async function saveHighScore(mode, score) {
    try {
        await storage.set(`colorMatchHighScore_${mode}`, score.toString());
    } catch (error) {
        console.log('Error saving high score:', error);
    }
}

// Generate a random base color (avoiding purple range for sequential mode)
function generateBaseColor() {
    if (gameState.gameMode === 'sequential') {
        // For sequential mode, avoid purple range
        const avoidStart = 270;
        const avoidEnd = 310;
        const availableRange = 360 - (avoidEnd - avoidStart);
        
        let hue = Math.floor(Math.random() * availableRange);
        
        if (hue >= avoidStart) {
            hue += (avoidEnd - avoidStart);
        }
        
        return { h: hue, s: 70, l: 50 };
    } else {
        // For random mode, any hue is fine
        return { h: Math.floor(Math.random() * 360), s: 70, l: 50 };
    }
}

// Calculate number of shades for a level (consistent across both modes)
function getShadesCount(lvl) {
    return lvl; // Level 1 = 1 pair, Level 2 = 2 pairs, etc.
}

// Generate shades for the current level (lightest to darkest)
function generateShades(baseHSL, count) {
    const shades = [];
    const minL = 20;
    const maxL = 80;
    
    // Handle single shade case
    if (count === 1) {
        shades.push({
            h: baseHSL.h,
            s: baseHSL.s,
            l: Math.round((maxL + minL) / 2)
        });
        return shades;
    }
    
    for (let i = 0; i < count; i++) {
        const lightness = maxL - (maxL - minL) * (i / (count - 1));
        shades.push({
            h: baseHSL.h,
            s: baseHSL.s,
            l: Math.round(lightness)
        });
    }
    return shades;
}

// Calculate circle size based on count
function calculateCircleSize(count) {
    if (count <= 6) return 60;
    if (count <= 10) return 50;
    if (count <= 18) return 40;
    if (count <= 26) return 35;
    return 30;
}

// Generate random non-overlapping positions
function generatePositions(count) {
    const positions = [];
    const circleSize = calculateCircleSize(count);
    const circleSizePercent = circleSize / 6;
    const padding = circleSizePercent;
    const minDistance = circleSizePercent * 2.2;
    const maxAttempts = 1000;

    for (let i = 0; i < count; i++) {
        let attempts = 0;
        let pos;
        let validPosition = false;
        
        while (!validPosition && attempts < maxAttempts) {
            pos = {
                x: padding + Math.random() * (100 - 2 * padding),
                y: padding + Math.random() * (100 - 2 * padding)
            };
            
            validPosition = positions.every(p => {
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return distance >= minDistance;
            });
            
            attempts++;
        }
        
        if (!validPosition) {
            pos = {
                x: padding + Math.random() * (100 - 2 * padding),
                y: padding + Math.random() * (100 - 2 * padding)
            };
        }
        
        positions.push(pos);
    }
    
    return positions;
}

// Convert HSL to string
function hslToString(hsl) {
    return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

// Get border color for a circle
function getBorderColor(hsl) {
    const borderL = hsl.l > 50 ? 20 : 90;
    return `hsl(${hsl.h}, ${hsl.s}%, ${borderL}%)`;
}

// Update UI
function updateUI() {
    // Update level display with mode
    const modeName = gameState.gameMode === 'random' ? 'Random' : 'Sequential';
    const levelText = `Level ${gameState.level}${gameState.pairsMatched > 0 ? `.${gameState.pairsMatched}` : ''} - ${modeName}`;
    levelDisplay.textContent = levelText;
    
    // Update background based on mode
    if (gameState.gameMode === 'sequential') {
        gameBoard.classList.add('order-level');
        instructionText.textContent = 'Match pairs from lightest to darkest';
    } else {
        gameBoard.classList.remove('order-level');
        instructionText.textContent = 'Match any pairs in any order';
    }
    
    // Show/hide instructions based on game over
    document.getElementById('instructions').style.display = gameState.gameOver ? 'none' : 'flex';
}

// Render circles
function renderCircles() {
    // Clear existing circles
    const existingCircles = gameArea.querySelectorAll('.circle');
    existingCircles.forEach(circle => circle.remove());
    
    // Clear connection lines
    connectionLines.innerHTML = '';
    
    // Draw connection lines if game over
    if (gameState.gameOver) {
        gameState.circles.forEach(circle => {
            const match = gameState.circles.find(c => c.pairId === circle.pairId && c.id !== circle.id);
            if (!match || circle.id > match.id) return;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', `${circle.x}%`);
            line.setAttribute('y1', `${circle.y}%`);
            line.setAttribute('x2', `${match.x}%`);
            line.setAttribute('y2', `${match.y}%`);
            line.setAttribute('stroke', 'white');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.7');
            connectionLines.appendChild(line);
        });
    }
    
    // Create circle elements
    const size = calculateCircleSize(gameState.circles.length);
    
    gameState.circles.forEach(circle => {
        const circleEl = document.createElement('div');
        circleEl.className = 'circle';
        circleEl.dataset.circleId = circle.id;
        
        // Add classes based on state
        if (circle.matched) {
            circleEl.classList.add('matched');
        }
        if (gameState.selected && gameState.selected.id === circle.id) {
            circleEl.classList.add('selected');
        }
        if (gameState.failedCircles.includes(circle.id)) {
            circleEl.classList.add('failed');
        }
        if (gameState.gameOver) {
            circleEl.classList.add('game-over');
        }
        
        // Set position and size
        circleEl.style.left = `${circle.x}%`;
        circleEl.style.top = `${circle.y}%`;
        circleEl.style.width = `${size}px`;
        circleEl.style.height = `${size}px`;
        circleEl.style.backgroundColor = hslToString(circle.shade);
        circleEl.style.transform = 'translate(-50%, -50%)';
        
        // Set border for selected circles
        if (gameState.selected && gameState.selected.id === circle.id) {
            circleEl.style.border = `4px solid ${getBorderColor(circle.shade)}`;
        }
        
        // Show numbers for sequential mode when game is over
        if (gameState.gameOver && gameState.gameMode === 'sequential') {
            const span = document.createElement('span');
            span.textContent = circle.pairId + 1;
            circleEl.appendChild(span);
        }
        
        // Add click handler
        circleEl.addEventListener('click', () => handleCircleClick(circle));
        
        gameArea.appendChild(circleEl);
    });
}

// Handle circle click
function handleCircleClick(circle) {
    if (gameState.animating || circle.matched || gameState.gameOver) return;

    if (gameState.selected === null) {
        gameState.selected = circle;
        renderCircles();
    } else if (gameState.selected.id === circle.id) {
        gameState.selected = null;
        renderCircles();
    } else if (gameState.selected.pairId === circle.pairId) {
        // Check if this is sequential mode and if they're matching in the right order
        if (gameState.gameMode === 'sequential' && circle.pairId !== gameState.nextExpectedShade) {
            // Wrong order - game over
            endGame(gameState.selected.id, circle.id);
            return;
        }
        
        // Correct match!
        gameState.animating = true;
        
        // Mark circles as matched
        gameState.circles = gameState.circles.map(c => {
            if (c.id === gameState.selected.id || c.id === circle.id) {
                return { ...c, matched: true };
            }
            return c;
        });
        
        renderCircles();
        
        setTimeout(() => {
            const remaining = gameState.circles.filter(c => !c.matched);
            
            if (remaining.length === 0) {
                // Level complete!
                setTimeout(() => {
                    const nextLevel = gameState.level + 1;
                    gameState.level = nextLevel;
                    initLevel(nextLevel, gameState.baseColor);
                    gameState.animating = false;
                }, 500);
            } else {
                gameState.circles = remaining;
                gameState.selected = null;
                gameState.pairsMatched++;
                
                // Update next expected shade for sequential mode
                if (gameState.gameMode === 'sequential') {
                    gameState.nextExpectedShade++;
                }
                
                gameState.animating = false;
                updateUI();
                renderCircles();
            }
        }, 600);
    } else {
        // Wrong match - game over
        endGame(gameState.selected.id, circle.id);
    }
}

// End game
function endGame(circleId1, circleId2) {
    const currentScore = gameState.level + (gameState.pairsMatched / 10);
    const currentHighScore = gameState.highScores[gameState.gameMode];
    const newHighScore = currentScore > currentHighScore;
    
    if (newHighScore) {
        gameState.highScores[gameState.gameMode] = currentScore;
        gameState.isNewHighScore = true;
        saveHighScore(gameState.gameMode, currentScore);
    } else {
        gameState.isNewHighScore = false;
    }
    
    gameState.failedCircles = [circleId1, circleId2];
    gameState.gameOver = true;
    
    updateUI();
    renderCircles();
    showGameOver();
}

// Show game over section
function showGameOver() {
    const modeName = gameState.gameMode === 'random' ? 'Random Mode' : 'Sequential Mode';
    const scoreText = `${modeName} - Level ${gameState.level}${gameState.pairsMatched > 0 ? `.${gameState.pairsMatched}` : ''}`;
    finalScore.textContent = scoreText;
    
    if (gameState.isNewHighScore) {
        newHighScoreText.classList.remove('hidden');
    } else {
        newHighScoreText.classList.add('hidden');
    }
    
    const currentHighScore = gameState.highScores[gameState.gameMode];
    if (currentHighScore > 0) {
        highScoreDisplay.textContent = `${modeName} High Score: ${currentHighScore.toFixed(1)}`;
        highScoreDisplay.classList.remove('hidden');
    } else {
        highScoreDisplay.classList.add('hidden');
    }
    
    gameOverSection.classList.remove('hidden');
}

// Initialize level
function initLevel(lvl, color) {
    const shadesCount = getShadesCount(lvl);
    const shades = generateShades(color, shadesCount);
    
    // For sequential mode, set the first expected shade (lightest)
    if (gameState.gameMode === 'sequential') {
        gameState.nextExpectedShade = 0;
    } else {
        gameState.nextExpectedShade = null;
    }
    
    // Create pairs
    const pairs = [];
    shades.forEach((shade, idx) => {
        pairs.push({ id: idx * 2, shade, pairId: idx });
        pairs.push({ id: idx * 2 + 1, shade, pairId: idx });
    });
    
    // Shuffle and add positions
    const shuffled = pairs.sort(() => Math.random() - 0.5);
    const positions = generatePositions(shuffled.length);
    
    const circlesData = shuffled.map((circle, idx) => ({
        ...circle,
        x: positions[idx].x,
        y: positions[idx].y,
        matched: false
    }));
    
    gameState.circles = circlesData;
    gameState.selected = null;
    gameState.pairsMatched = 0;
    gameState.gameOver = false;
    
    updateUI();
    renderCircles();
}

// Start game with selected mode
function startGameWithMode(mode) {
    gameState.gameMode = mode;
    const color = generateBaseColor();
    gameState.baseColor = color;
    gameState.level = 1;
    gameState.failedCircles = [];
    gameState.isNewHighScore = false;
    
    // Hide menu and show game
    startMenu.classList.add('hidden');
    gameBoard.classList.remove('hidden');
    gameOverSection.classList.add('hidden');
    
    initLevel(1, color);
}

// Return to menu
function returnToMenu() {
    startMenu.classList.remove('hidden');
    gameBoard.classList.add('hidden');
    gameOverSection.classList.add('hidden');
    gameState.gameMode = null;
}

// Start new game (same mode)
function startNewGame() {
    if (!gameState.gameMode) {
        returnToMenu();
        return;
    }
    
    const color = generateBaseColor();
    gameState.baseColor = color;
    gameState.level = 1;
    gameState.failedCircles = [];
    gameState.isNewHighScore = false;
    
    gameOverSection.classList.add('hidden');
    
    initLevel(1, color);
}

// Event Listeners
function setupEventListeners() {
    // Mode selection buttons
    randomModeBtn.addEventListener('click', () => startGameWithMode('random'));
    sequentialModeBtn.addEventListener('click', () => startGameWithMode('sequential'));
    
    // Game buttons
    newGameBtn.addEventListener('click', returnToMenu);
    tryAgainBtn.addEventListener('click', returnToMenu);
}

// Initialize game on page load
window.addEventListener('DOMContentLoaded', async () => {
    initDOMElements();
    await loadHighScores();
    setupEventListeners();
});
