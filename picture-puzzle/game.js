// Main Game Logic
class PuzzleGame {
    constructor() {
        this.gridSize = 7;
        this.maxCanvasSize = 600;
        this.image = null;
        this.grid = [];
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.renderer = null;
        this.dragHandler = null;
        
        this.initializeUI();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Get DOM elements
        this.uploadScreen = document.getElementById('upload-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.imageUpload = document.getElementById('image-upload');
        this.canvas = document.getElementById('puzzle-canvas');
        this.newPuzzleBtn = document.getElementById('new-puzzle-btn');
        this.showPreviewBtn = document.getElementById('show-preview-btn');
        this.previewModal = document.getElementById('preview-modal');
        this.previewImage = document.getElementById('preview-image');
        this.closePreview = document.getElementById('close-preview');
        this.winMessage = document.getElementById('win-message');

        // Event listeners
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        this.newPuzzleBtn.addEventListener('click', () => this.resetGame());
        this.showPreviewBtn.addEventListener('click', () => this.showPreview());
        this.closePreview.addEventListener('click', () => this.hidePreview());
        this.previewModal.addEventListener('click', (e) => {
            if (e.target === this.previewModal) this.hidePreview();
        });
        this.winMessage.addEventListener('click', () => this.hideWinMessage());

        // Initialize renderer
        this.renderer = new CanvasRenderer(this.canvas);
    }

    /**
     * Handle image upload
     */
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.previewImage.src = event.target.result;
                this.initializePuzzle();
                this.showGameScreen();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Initialize the puzzle with shuffled pieces
     */
    initializePuzzle() {
        // Calculate piece dimensions from the image
        const pieceWidth = this.image.width / this.gridSize;
        const pieceHeight = this.image.height / this.gridSize;

        // Calculate display scale
        const canvasWidth = this.gridSize * pieceWidth;
        const canvasHeight = this.gridSize * pieceHeight;
        const scale = Math.min(
            this.maxCanvasSize / canvasWidth,
            this.maxCanvasSize / canvasHeight,
            1
        );

        this.pieceWidth = pieceWidth * scale;
        this.pieceHeight = pieceHeight * scale;

        // Set canvas size
        this.renderer.setCanvasSize(
            this.pieceWidth * this.gridSize,
            this.pieceHeight * this.gridSize
        );

        // Create pieces array
        const pieces = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                pieces.push({
                    id: row * this.gridSize + col,
                    originalRow: row,
                    originalCol: col,
                    sx: col * pieceWidth,
                    sy: row * pieceHeight,
                    sw: pieceWidth,
                    sh: pieceHeight,
                    group: row * this.gridSize + col // Each piece starts as its own group
                });
            }
        }

        // Shuffle pieces
        const shuffled = [...pieces].sort(() => Math.random() - 0.5);

        // Place shuffled pieces in grid
        this.grid = [];
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                this.grid[row][col] = shuffled[row * this.gridSize + col];
            }
        }

        // Initialize drag handler
        if (this.dragHandler) {
            this.dragHandler.resetDrag();
        } else {
            this.dragHandler = new DragHandler(this.canvas, this);
        }

        // Draw initial puzzle
        this.draw();
    }

    /**
     * Get all cells that belong to a group
     */
    getGroupCells(groupId) {
        const cells = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col]?.group === groupId) {
                    cells.push({ row, col, piece: this.grid[row][col] });
                }
            }
        }
        return cells;
    }

    /**
     * Swap pieces based on drag operation
     */
    swapPieces(draggedGroup, startPos, endPos) {
        // Get all cells in the dragged group
        const groupCells = this.getGroupCells(draggedGroup);

        // Calculate offset
        const offsetRow = endPos.row - startPos.row;
        const offsetCol = endPos.col - startPos.col;

        // Calculate target positions for all pieces in the group
        const moves = groupCells.map(cell => ({
            piece: cell.piece,
            fromRow: cell.row,
            fromCol: cell.col,
            toRow: cell.row + offsetRow,
            toCol: cell.col + offsetCol
        }));

        // Check if all moves are valid (in bounds)
        const allValid = moves.every(move =>
            move.toRow >= 0 && move.toRow < this.gridSize &&
            move.toCol >= 0 && move.toCol < this.gridSize
        );

        if (!allValid) return;

        // Create new grid
        const newGrid = [];
        for (let r = 0; r < this.gridSize; r++) {
            newGrid[r] = [];
            for (let c = 0; c < this.gridSize; c++) {
                newGrid[r][c] = this.grid[r][c];
            }
        }

        // Collect displaced pieces (pieces that will be moved from target positions)
        const displacedPieces = [];
        const seenIds = new Set();

        moves.forEach(move => {
            const targetPiece = this.grid[move.toRow][move.toCol];
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

        // Find all empty positions after placing dragged pieces
        const emptyPositions = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (newGrid[r][c] === null) {
                    emptyPositions.push({ row: r, col: c });
                }
            }
        }

        // Place displaced pieces into empty positions
        displacedPieces.forEach((piece, index) => {
            if (index < emptyPositions.length) {
                const pos = emptyPositions[index];
                newGrid[pos.row][pos.col] = piece;
            }
        });

        // Update grid
        this.grid = newGrid;

        // Reset all pieces to individual groups after swap
        // This ensures pieces that are no longer correctly adjacent lose their connections
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c]) {
                    this.grid[r][c] = { ...this.grid[r][c], group: this.grid[r][c].id };
                }
            }
        }

        // Redraw
        this.draw();

        // Check for connections after a short delay to rebuild groups
        setTimeout(() => this.checkConnections(), 100);
    }

    /**
     * Check if two pieces are adjacent in the original image
     */
    areAdjacent(piece1, piece2) {
        const rowDiff = Math.abs(piece1.originalRow - piece2.originalRow);
        const colDiff = Math.abs(piece1.originalCol - piece2.originalCol);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    /**
     * Check and create connections between adjacent matching pieces
     */
    checkConnections() {
        let changed = false;
        const newGrid = this.grid.map(row => [...row]);

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = newGrid[row][col];
                if (!piece) continue;

                // Check right neighbor
                if (col < this.gridSize - 1) {
                    const rightPiece = newGrid[row][col + 1];
                    if (rightPiece && piece.group !== rightPiece.group) {
                        // Check if these pieces should be adjacent
                        if (piece.originalCol + 1 === rightPiece.originalCol &&
                            piece.originalRow === rightPiece.originalRow) {
                            // Merge groups
                            const oldGroup = rightPiece.group;
                            const newGroup = Math.min(piece.group, rightPiece.group);
                            
                            for (let r = 0; r < this.gridSize; r++) {
                                for (let c = 0; c < this.gridSize; c++) {
                                    if (newGrid[r][c] && 
                                        (newGrid[r][c].group === piece.group || 
                                         newGrid[r][c].group === oldGroup)) {
                                        newGrid[r][c] = { ...newGrid[r][c], group: newGroup };
                                    }
                                }
                            }
                            changed = true;
                        }
                    }
                }

                // Check bottom neighbor
                if (row < this.gridSize - 1) {
                    const bottomPiece = newGrid[row + 1][col];
                    if (bottomPiece && piece.group !== bottomPiece.group) {
                        // Check if these pieces should be adjacent
                        if (piece.originalRow + 1 === bottomPiece.originalRow &&
                            piece.originalCol === bottomPiece.originalCol) {
                            // Merge groups
                            const oldGroup = bottomPiece.group;
                            const newGroup = Math.min(piece.group, bottomPiece.group);
                            
                            for (let r = 0; r < this.gridSize; r++) {
                                for (let c = 0; c < this.gridSize; c++) {
                                    if (newGrid[r][c] && 
                                        (newGrid[r][c].group === piece.group || 
                                         newGrid[r][c].group === oldGroup)) {
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
            this.grid = newGrid;
            this.draw();
            this.checkWinCondition();
        }
    }

    /**
     * Check if the puzzle is complete
     */
    checkWinCondition() {
        if (this.grid.length === 0) return;

        // Get the group of the first piece
        const firstGroup = this.grid[0][0].group;

        // Check if all pieces are in the same group
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col].group !== firstGroup) {
                    return; // Not all pieces are connected
                }
            }
        }

        // All pieces are in one group - check if they're in correct positions
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece.originalRow !== row || piece.originalCol !== col) {
                    return; // Pieces connected but not in correct positions
                }
            }
        }

        // Puzzle is complete!
        this.showWinMessage();
    }

    /**
     * Draw the current puzzle state
     */
    draw() {
        if (!this.image || this.grid.length === 0) return;
        this.renderer.drawPuzzle(this.image, this.grid, this.pieceWidth, this.pieceHeight);
    }

    /**
     * Show the game screen
     */
    showGameScreen() {
        this.uploadScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
    }

    /**
     * Show the upload screen
     */
    showUploadScreen() {
        this.gameScreen.classList.add('hidden');
        this.uploadScreen.classList.remove('hidden');
    }

    /**
     * Show preview modal
     */
    showPreview() {
        this.previewModal.classList.remove('hidden');
    }

    /**
     * Hide preview modal
     */
    hidePreview() {
        this.previewModal.classList.add('hidden');
    }

    /**
     * Show win message
     */
    showWinMessage() {
        setTimeout(() => {
            this.winMessage.classList.remove('hidden');
        }, 300);
    }

    /**
     * Hide win message
     */
    hideWinMessage() {
        this.winMessage.classList.add('hidden');
    }

    /**
     * Reset the game
     */
    resetGame() {
        this.image = null;
        this.grid = [];
        this.imageUpload.value = '';
        this.hideWinMessage();
        this.showUploadScreen();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PuzzleGame();
});
