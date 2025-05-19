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

    // Start with a default theme
    game.elements.themeInput.value = 'Chinese Food';
    game.handleNewTheme();
});
