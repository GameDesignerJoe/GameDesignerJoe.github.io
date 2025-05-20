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

    // Start with a random theme
    const quoteService = new QuoteService();
    const randomTheme = quoteService.themes[Math.floor(Math.random() * quoteService.themes.length)];
    game.elements.themeInput.value = randomTheme;
    game.handleNewTheme();
});
