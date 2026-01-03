# Photo Puzzle Game - Design Specification

## Overview
A grid-based photo puzzle game where users upload an image that gets divided into a shuffled grid of pieces. Players drag pieces to swap positions and reassemble the image. When matching edges touch, pieces automatically connect and move together as a group.

## Core Mechanics

### Game Setup
1. **Image Upload**: User uploads a photo from their device
2. **Grid Division**: Image is divided into a 7×7 grid (49 pieces total)
3. **Aspect Ratio Preservation**: Grid scales to match the uploaded image's aspect ratio
   - Portrait images create tall grids
   - Landscape images create wide grids
   - Square images create square grids
4. **Piece Shuffling**: All pieces are randomly repositioned in the grid
5. **Display Scaling**: Grid scales to fit screen (max 600px) while maintaining aspect ratio

### Grid System
- **Fixed Grid Layout**: All pieces must occupy grid cells at all times
- **No Stacking**: Pieces never overlap or stack on top of each other
- **No Empty Cells**: Every grid cell always contains exactly one piece
- **Grid Lines**: Visible lines separate all cells for clarity

### Movement & Interaction

#### Drag Behavior
1. **Touch/Mouse Start**: User taps or clicks on any piece to begin drag
2. **Drag Tracking**: System continuously tracks finger/cursor position during drag
3. **Target Detection**: System identifies which grid cell the user drags to
4. **Swap on Release**: When user releases, pieces swap positions

#### Swap Logic
When a piece (or group) is dragged to a new position:
1. **Source → Target**: Dragged piece(s) move to target position(s)
2. **Displaced Pieces**: Any pieces occupying target cells are collected
3. **Target → Source**: Displaced pieces fill the vacated source cells
4. **Group Movement**: All connected pieces move together as a unit

#### Example Swap Scenarios

**Single Piece Swap:**
```
Before:          After:
[A][B][C]       [B][A][C]
```
- Drag A to B's position
- A moves to B's cell
- B moves to A's cell

**Group Swap:**
```
Before:          After:
[A-B][C][D]     [C][A-B][D]
```
- A and B are connected (shown as A-B)
- Drag A-B group to C's position
- A-B moves right (occupying C and D's old positions)
- C moves to A's old position

### Auto-Connection System

#### Connection Rules
Pieces automatically connect when:
1. **Adjacent Positioning**: Pieces are in neighboring grid cells (horizontally or vertically)
2. **Correct Match**: Their original positions in the source image were adjacent
3. **Proper Alignment**: Edges align correctly (e.g., piece from row 2, col 3 next to piece from row 2, col 4)

#### Connection Behavior
- **Group Formation**: Connected pieces share a group ID
- **Unified Movement**: Entire group moves as single unit when any member is dragged
- **Transitive Connections**: If A connects to B, and B connects to C, then A-B-C form one group
- **Group Breaking**: Groups can break apart if displaced pieces interrupt connections

#### Connection Check Timing
- Connections are checked after every swap completes
- Check occurs with ~100ms delay to allow visual settling

### Visual Design

#### Piece Display
- Each piece shows its portion of the original image
- Dark borders (#374151) around each piece for definition
- Light grid lines (#e5e7eb) showing cell boundaries

#### Canvas Rendering
- HTML5 Canvas for rendering
- Pieces drawn in grid order (row by row)
- Border overlay for each piece
- Grid lines drawn across entire canvas

## Technical Implementation

### Data Structure

#### Piece Object
```javascript
{
  id: number,              // Unique identifier (0-48 for 7×7)
  originalRow: number,     // Source row in original image (0-6)
  originalCol: number,     // Source column in original image (0-6)
  sx: number,             // Source X in original image (pixels)
  sy: number,             // Source Y in original image (pixels)
  sw: number,             // Source width (pixels)
  sh: number,             // Source height (pixels)
  group: number           // Group ID for connected pieces
}
```

#### Grid Structure
```javascript
// 2D array: grid[row][col] = piece
const grid = [
  [piece0, piece1, piece2, ...],
  [piece7, piece8, piece9, ...],
  ...
]
```

### State Management

**React State Variables:**
- `image`: Loaded Image object
- `grid`: 2D array of pieces
- `draggedGroup`: Group ID being dragged (null when not dragging)
- `dragStart`: Grid position where drag started
- `currentDragPos`: Current grid position during drag
- `pieceSize`: { width, height } for rendered piece dimensions

### Key Algorithms

#### 1. Initialize Puzzle
```
1. Calculate piece dimensions from image (width/7, height/7)
2. Determine display scale (max 600px, maintain aspect ratio)
3. Create array of 49 pieces with original positions
4. Shuffle piece array
5. Place shuffled pieces into grid[row][col]
6. Each piece starts as its own group
```

#### 2. Swap Pieces
```
1. Validate drag moved to different cell
2. Get all pieces in dragged group
3. Calculate offset (target - source)
4. For each piece in group, calculate new position
5. Validate all new positions are in bounds
6. Collect displaced pieces (not in dragged group)
7. Clear all source cells
8. Place dragged pieces in target cells
9. Place displaced pieces in vacated source cells
10. Check for new connections
```

#### 3. Check Connections
```
For each piece in grid:
  Check right neighbor:
    If adjacent in original image:
      If originalCol + 1 == neighbor.originalCol:
        If originalRow == neighbor.originalRow:
          Merge groups
  
  Check bottom neighbor:
    If adjacent in original image:
      If originalRow + 1 == neighbor.originalRow:
        If originalCol == neighbor.originalCol:
          Merge groups
```

### Touch & Mouse Support

**Event Handlers:**
- `onMouseDown` / `onTouchStart`: Begin drag
- `onMouseMove` / `onTouchMove`: Track drag position
- `onMouseUp` / `onTouchEnd`: Complete swap
- `onMouseLeave` / `onTouchCancel`: Cancel drag

**Position Calculation:**
```javascript
// Convert screen coordinates to grid position
const getGridPosition = (screenX, screenY) => {
  const col = Math.floor(screenX / pieceWidth);
  const row = Math.floor(screenY / pieceHeight);
  return { row, col };
};
```

**Touch Optimization:**
- Prevent default touch behavior to avoid scrolling
- Use `touch-none` CSS class
- Add passive: false to touchmove listener

## Game Flow

### 1. Start Screen
- Upload button
- "7×7 Grid Challenge" label
- Clean, minimal interface

### 2. Active Puzzle
- Canvas with shuffled pieces
- Drag any piece to swap
- Visual feedback during drag
- Auto-connect on correct placement

### 3. Reset
- "New Puzzle" button
- Clears current puzzle
- Returns to upload screen

## Win Condition
Game is complete when all pieces are connected in a single group (all 49 pieces share the same group ID) and form the original image.

## Future Enhancements (Not Currently Implemented)
- Adjustable difficulty (3×3 to 7×7 grid)
- Victory detection and celebration
- Timer/move counter
- Preview image reference
- Photo library integration (hybrid approach)
- Undo/redo functionality
- Hint system

## Technical Requirements

### Libraries & Tools
- React for UI and state management
- HTML5 Canvas for rendering
- Lucide React for icons
- Tailwind CSS for styling

### Browser Support
- Modern browsers with Canvas support
- Touch-enabled devices
- Mouse/trackpad devices

### Performance Considerations
- Efficient grid redraw on every state change
- Debounced connection checking
- Optimized piece lookup algorithms
- Maximum canvas size of 600px to prevent performance issues

## Known Limitations
- Cannot access device photo library directly (browser security)
- Requires manual photo upload each session
- No persistence between sessions
- Fixed 7×7 grid size (difficulty adjustment not implemented)

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Game Type**: Puzzle, Grid-based, Photo manipulation