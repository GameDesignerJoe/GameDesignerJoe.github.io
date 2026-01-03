# Photo Puzzle Game

A fully functional 7×7 grid-based photo puzzle game where players upload an image, solve the shuffled puzzle by dragging and swapping pieces, and watch as matching pieces automatically connect!

## Features

✨ **Image Upload** - Upload any photo from your device  
🎲 **Automatic Shuffling** - 49 pieces randomly arranged in a 7×7 grid  
🖱️ **Drag & Drop** - Intuitive mouse and touch controls  
🔗 **Auto-Connect** - Correctly placed adjacent pieces automatically group together  
👥 **Group Movement** - Connected pieces move as a single unit  
🏆 **Win Detection** - Automatic celebration when puzzle is complete  
📱 **Mobile Responsive** - Works on phones, tablets, and desktop  
👁️ **Preview Feature** - View the original image for reference

## How to Play

1. **Upload a Photo** - Click "Upload Photo" and select an image
2. **Drag to Swap** - Click/tap and drag any piece to a new location
3. **Auto-Connect** - When pieces with matching edges touch, they stick together
4. **Move Groups** - Drag any piece in a connected group to move the entire group
5. **Complete the Puzzle** - Connect all pieces to form the original image
6. **Use Preview** - Click "Preview" button to see the original image

## Game Mechanics

### Swapping System
- Drag any piece (or group) to a new position
- Pieces in the target position swap to the source location
- Groups move together as a single unit
- All 49 grid cells always contain exactly one piece

### Auto-Connection
- Pieces automatically connect when:
  - They are adjacent (horizontal or vertical)
  - Their original positions in the source image were adjacent
  - Edges align correctly
- Connected pieces form groups that move together
- Groups can grow as more pieces connect

### Win Condition
- All 49 pieces must be in a single connected group
- All pieces must be in their correct original positions

## Technical Details

### Architecture
- **Vanilla JavaScript** - No frameworks, runs directly in browser
- **HTML5 Canvas** - Smooth rendering and visual feedback
- **Modular Design** - Separated concerns:
  - `game.js` - Core game logic and state management
  - `canvas-renderer.js` - All drawing operations
  - `drag-handler.js` - Mouse and touch event handling

### Browser Support
- Modern browsers with HTML5 Canvas support
- Touch-enabled devices (phones and tablets)
- Mouse and trackpad support

### Performance
- Optimized canvas rendering
- Max canvas size of 600px to prevent performance issues
- Efficient grid lookup algorithms
- Debounced connection checking

## File Structure

```
picture-puzzle/
├── index.html          # Main HTML structure
├── styles.css          # Game styling and animations
├── game.js             # Core game logic
├── canvas-renderer.js  # Canvas drawing operations
├── drag-handler.js     # Drag and drop handling
├── pp-proto/           # Original prototype (reference only)
│   ├── picture-puzzle.tsx
│   └── puzzle-game-spec.md
└── README.md           # This file
```

## Development Notes

This game was rebuilt from scratch from a React/TSX prototype to create a clean, dependency-free vanilla JavaScript implementation that matches the architecture of the other games in this project.

### Key Improvements Over Prototype
- ✅ No build tools required - runs immediately
- ✅ No React dependencies
- ✅ Fixed drag and drop issues
- ✅ Proper swap logic implementation
- ✅ Working auto-connection system
- ✅ Mobile-first responsive design
- ✅ Clean modular architecture

## Future Enhancements

- Adjustable difficulty (3×3, 5×5, 7×7 grids)
- Move counter and timer
- Hint system
- Undo/redo functionality
- Photo library with sample images
- Save/load game state

## Credits

Game Design & Development: GameDesignerJoe  
Version: 1.0  
Date: January 2026
