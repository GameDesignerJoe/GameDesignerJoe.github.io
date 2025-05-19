# Themed Cryptogram Game - Project Documentation

## Project Overview
This project is a JavaScript-based cryptogram puzzle game with a thematic quote retrieval system. The game allows players to:
1. Enter a theme/topic of interest
2. Receive a quote related to that theme
3. Solve the cryptogram puzzle (letter substitution cipher)
4. Get feedback on their solution
5. Try another puzzle with the same or different theme

## Core Components

### 1. Quote Retrieval System
The game uses external APIs to fetch quotes based on user-provided themes:

```javascript
async function fetchQuoteByTheme(theme) {
  try {
    const response = await fetch(`https://api.quotable.io/random?tags=${encodeURIComponent(theme)}`);
    const data = await response.json();
    
    // Returns quote data or fallback if theme not found
    // Format: { text: "Quote text", author: "Author name", success: true/false }
  } catch (error) {
    // Fallback handling
  }
}
```

Key API alternatives:
- **Quotable API**: `https://api.quotable.io/random?tags=${theme}`
- **API Ninjas**: `https://api.api-ninjas.com/v1/quotes?category=${theme}` (requires API key)
- **ZenQuotes**: `https://zenquotes.io/api/quotes/your-key&keyword=${theme}` (premium)

### 2. Cryptogram Creation
The system creates a letter substitution cipher:

```javascript
function createCryptogram(text) {
  // Creates substitution map (A→X, B→Q, etc.)
  // Returns: { original, encoded, substitutionMap, solutionMap }
}
```

### 3. Game UI and Logic
Main class that manages the gameplay:

```javascript
class CryptogramGame {
  // Handles: 
  // - UI creation
  // - Quote fetching
  // - Puzzle display
  // - User input tracking
  // - Solution checking
}
```

## Implementation Notes

### Quote API Integration Considerations
- Choose appropriate API based on quote variety and theme support
- Implement fallbacks when theme not found
- Consider rate limits and API key requirements
- Add caching for previously used themes to reduce API calls

### Cryptogram Algorithm Improvements
- Ensure letter substitution is one-to-one (each letter maps to exactly one other letter)
- Consider difficulty levels (maintaining word boundaries for easier puzzles)
- Make sure punctuation and spaces remain unchanged

### UI Enhancement Ideas
- Add visual feedback for correct/incorrect letters
- Implement keyboard shortcuts
- Add difficulty settings
- Create theme suggestions
- Add hint system (reveal a few letters)

## Getting Started
1. Include the provided JavaScript and CSS in your HTML file
2. Create a container with id="cryptogram-game-container"
3. Initialize the game:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const gameContainer = document.getElementById('cryptogram-game-container');
  if (gameContainer) {
    const game = new CryptogramGame(gameContainer);
  }
});
```

## API Selection Guide
- For robust theme matching: Use Quotable API (free, good tag system)
- For extensive quote database: API Ninjas (requires API key)
- For custom collection: Consider creating a JSON database
- For advanced implementation: Use fuzzy search to match themes to available tags

## Next Development Steps
1. Implement preferred API integration with proper error handling
2. Add local storage to save game state and theme history
3. Improve UI responsiveness for mobile devices
4. Consider adding achievement/streak system for player retention
5. Implement theme suggestions based on popular categories
