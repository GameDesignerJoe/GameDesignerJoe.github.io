// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game with container
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        console.error('Game container not found!');
        return;
    }

    // Create game instance
    const game = new GameUI(gameContainer);

    // Add success message styles
    const style = document.createElement('style');
    style.textContent = `
        .success-message {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--dark-navy);
            color: var(--text-light);
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
        }

        .success-message button {
            margin-top: 15px;
            padding: 10px 20px;
            background-color: var(--primary-blue);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .success-message button:hover {
            background-color: #2980b9;
        }

        .puzzle-row {
            display: flex;
            gap: var(--grid-gap);
            justify-content: center;
            margin-bottom: var(--grid-gap);
        }
    `;
    document.head.appendChild(style);

    // Optional: Start with a default theme
    game.elements.themeInput.value = 'Chinese Food';
    game.handleNewTheme();
});
