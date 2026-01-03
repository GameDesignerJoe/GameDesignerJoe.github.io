/*
 * DEPRECATED PROTOTYPE - DO NOT USE
 * 
 * This file is kept for reference only. The working game has been 
 * rebuilt from scratch in the parent directory using vanilla JavaScript.
 * 
 * See: ../index.html, ../game.js, ../canvas-renderer.js, ../drag-handler.js
 * 
 * Original prototype had 9+ errors and has been replaced with a fully
 * functional implementation.
 */

/*
import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';

const PuzzleGame = () => {
  const [image, setImage] = useState(null);
  const [grid, setGrid] = useState([]);
  const [draggedGroup, setDraggedGroup] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [currentDragPos, setCurrentDragPos] = useState(null);
  const [pieceSize, setPieceSize] = useState({ width: 80, height: 80 });
  const canvasRef = useRef(null);
  const GRID_SIZE = 7;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          initializePuzzle(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const initializePuzzle = (img) => {
    const newGrid = [];
    
    // Calculate piece size based on image dimensions
    const pieceWidth = img.width / GRID_SIZE;
    const pieceHeight = img.height / GRID_SIZE;
    
    // Use a max display size to keep it reasonable on screen
    const maxCanvasSize = 600;
    const canvasWidth = GRID_SIZE * pieceWidth;
    const canvasHeight = GRID_SIZE * pieceHeight;
    const scale = Math.min(maxCanvasSize / canvasWidth, maxCanvasSize / canvasHeight, 1);
    
    const displayPieceWidth = pieceWidth * scale;
    const displayPieceHeight = pieceHeight * scale;
    
    setPieceSize({ width: displayPieceWidth, height: displayPieceHeight });

    // Create pieces with their original positions
    const pieces = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        pieces.push({
          id: row * GRID_SIZE + col,
          originalRow: row,
          originalCol: col,
          sx: col * pieceWidth,
          sy: row * pieceHeight,
          sw: pieceWidth,
          sh: pieceHeight,
          group: row * GRID_SIZE + col
        });
      }
    }

    // Shuffle pieces
    const shuffled = [...pieces].sort(() => Math.random() - 0.5);

    // Place shuffled pieces in grid
    for (let row = 0; row < GRID_SIZE; row++) {
      newGrid[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        newGrid[row][col] = shuffled[row * GRID_SIZE + col];
      }
    }

    setGrid(newGrid);
  };

  const drawPuzzle = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image || grid.length === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * pieceSize.width, 0);
      ctx.lineTo(i * pieceSize.width, GRID_SIZE * pieceSize.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * pieceSize.height);
      ctx.lineTo(GRID_SIZE * pieceSize.width, i * pieceSize.height);
      ctx.stroke();
    }

    // Draw pieces
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const piece = grid[row][col];
        if (piece) {
          ctx.drawImage(
            image,
            piece.sx, piece.sy, piece.sw, piece.sh,
            col * pieceSize.width, row * pieceSize.height, pieceSize.width, pieceSize.height
          );
          
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 2;
          ctx.strokeRect(col * pieceSize.width, row * pieceSize.height, pieceSize.width, pieceSize.height);
        }
      }
    }
  };

  useEffect(() => {
    drawPuzzle();
  }, [grid, image]);

  const getGridPosition = (x, y) => {
    const col = Math.floor(x / pieceSize.width);
    const row = Math.floor(y / pieceSize.height);
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      return { row, col };
    }
    return null;
  };

  const getGroupCells = (groupId) => {
    const cells = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col]?.group === groupId) {
          cells.push({ row, col, piece: grid[row][col] });
        }
      }
    }
    return cells;
  };

  const areAdjacent = (piece1, piece2) => {
    const rowDiff = Math.abs(piece1.originalRow - piece2.originalRow);
    const colDiff = Math.abs(piece1.originalCol - piece2.originalCol);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  };

  const checkConnections = () => {
    let changed = false;
    const newGrid = grid.map(row => [...row]);

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const piece = newGrid[row][col];
        if (!piece) continue;

        // Check right neighbor
        if (col < GRID_SIZE - 1) {
          const rightPiece = newGrid[row][col + 1];
          if (rightPiece && piece.group !== rightPiece.group && areAdjacent(piece, rightPiece)) {
            if (piece.originalCol + 1 === rightPiece.originalCol && piece.originalRow === rightPiece.originalRow) {
              const oldGroup = rightPiece.group;
              const newGroup = Math.min(piece.group, rightPiece.group);
              for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                  if (newGrid[r][c] && (newGrid[r][c].group === piece.group || newGrid[r][c].group === oldGroup)) {
                    newGrid[r][c] = { ...newGrid[r][c], group: newGroup };
                  }
                }
              }
              changed = true;
            }
          }
        }

        // Check bottom neighbor
        if (row < GRID_SIZE - 1) {
          const bottomPiece = newGrid[row + 1][col];
          if (bottomPiece && piece.group !== bottomPiece.group && areAdjacent(piece, bottomPiece)) {
            if (piece.originalRow + 1 === bottomPiece.originalRow && piece.originalCol === bottomPiece.originalCol) {
              const oldGroup = bottomPiece.group;
              const newGroup = Math.min(piece.group, bottomPiece.group);
              for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                  if (newGrid[r][c] && (newGrid[r][c].group === piece.group || newGrid[r][c].group === oldGroup)) {
                    newGrid[r][c] = { ...newGrid[r][c], group: newGroup };
                  }
                }
              }
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      setGrid(newGrid);
    }
  };

  const getEventPosition = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleStart = (e) => {
    e.preventDefault();
    const { x, y } = getEventPosition(e);
    
    const pos = getGridPosition(x, y);
    if (pos && grid[pos.row][pos.col]) {
      const piece = grid[pos.row][pos.col];
      setDraggedGroup(piece.group);
      setDragStart(pos);
      setCurrentDragPos(pos);
    }
  };

  const handleMove = (e) => {
    if (!draggedGroup || !dragStart) return;
    e.preventDefault();
    
    const { x, y } = getEventPosition(e);
    const pos = getGridPosition(x, y);
    
    if (pos) {
      setCurrentDragPos(pos);
    }
  };

  const handleEnd = (e) => {
    if (!draggedGroup || !dragStart || !currentDragPos) return;
    e.preventDefault();

    const endPos = currentDragPos;
    
    // Only process if we've moved to a different cell
    if (endPos.row === dragStart.row && endPos.col === dragStart.col) {
      setDraggedGroup(null);
      setDragStart(null);
      setCurrentDragPos(null);
      return;
    }

    // Get all cells in the dragged group
    const groupCells = getGroupCells(draggedGroup);
    
    // Calculate offset
    const offsetRow = endPos.row - dragStart.row;
    const offsetCol = endPos.col - dragStart.col;

    // Create new grid - deep copy
    const newGrid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      newGrid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        newGrid[r][c] = grid[r][c];
      }
    }

    // Calculate target positions for all pieces in the group
    const moves = groupCells.map(cell => ({
      piece: cell.piece,
      fromRow: cell.row,
      fromCol: cell.col,
      toRow: cell.row + offsetRow,
      toCol: cell.col + offsetCol
    }));

    // Check if all moves are valid
    const allValid = moves.every(move => 
      move.toRow >= 0 && move.toRow < GRID_SIZE && 
      move.toCol >= 0 && move.toCol < GRID_SIZE
    );

    if (!allValid) {
      setDraggedGroup(null);
      setDragStart(null);
      setCurrentDragPos(null);
      return;
    }

    // Collect all pieces that will be displaced (not part of dragged group)
    const displacedPieces = [];
    const seenIds = new Set();
    
    moves.forEach(move => {
      const targetPiece = grid[move.toRow][move.toCol];
      if (targetPiece && targetPiece.group !== draggedGroup && !seenIds.has(targetPiece.id)) {
        displacedPieces.push(targetPiece);
        seenIds.add(targetPiece.id);
      }
    });

    // Clear all source positions
    moves.forEach(move => {
      newGrid[move.fromRow][move.fromCol] = null;
    });

    // Place dragged pieces in their new positions
    moves.forEach(move => {
      newGrid[move.toRow][move.toCol] = move.piece;
    });

    // Place displaced pieces into the vacated source positions
    moves.forEach((move, index) => {
      if (index < displacedPieces.length && newGrid[move.fromRow][move.fromCol] === null) {
        newGrid[move.fromRow][move.fromCol] = displacedPieces[index];
      }
    });

    setGrid(newGrid);
    setTimeout(checkConnections, 100);

    setDraggedGroup(null);
    setDragStart(null);
    setCurrentDragPos(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e) => e.preventDefault();
    canvas.addEventListener('touchmove', preventDefault, { passive: false });
    
    return () => {
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-teal-500 to-emerald-600 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">Photo Puzzle</h1>
        
        {!image ? (
          <div className="flex flex-col items-center justify-center p-12 border-4 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <Upload className="w-16 h-16 text-gray-400 mb-4" />
            <label className="cursor-pointer bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              Upload Photo
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            <p className="mt-4 text-gray-500">7x7 Grid Challenge</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={pieceSize.width * GRID_SIZE}
              height={pieceSize.height * GRID_SIZE}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              onTouchCancel={handleEnd}
              className="border-4 border-gray-800 rounded-lg cursor-move shadow-lg touch-none"
            />
            <button
              onClick={() => {
                setImage(null);
                setGrid([]);
              }}
              className="mt-6 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              New Puzzle
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PuzzleGame;
*/
