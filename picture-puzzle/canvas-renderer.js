// Canvas Renderer - Handles all drawing operations for the puzzle
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = 7;
    }

    /**
     * Set up canvas size based on piece dimensions
     */
    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Clear the entire canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw the puzzle grid background
     */
    drawGrid(pieceWidth, pieceHeight) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;

        // Vertical lines
        for (let i = 0; i <= this.gridSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * pieceWidth, 0);
            this.ctx.lineTo(i * pieceWidth, this.gridSize * pieceHeight);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= this.gridSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * pieceHeight);
            this.ctx.lineTo(this.gridSize * pieceWidth, i * pieceHeight);
            this.ctx.stroke();
        }
    }

    /**
     * Draw a single puzzle piece
     */
    drawPiece(image, piece, col, row, pieceWidth, pieceHeight) {
        // Draw the image portion
        this.ctx.drawImage(
            image,
            piece.sx, piece.sy, piece.sw, piece.sh,
            col * pieceWidth, row * pieceHeight, pieceWidth, pieceHeight
        );

        // Draw piece border
        this.ctx.strokeStyle = '#374151';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            col * pieceWidth, 
            row * pieceHeight, 
            pieceWidth, 
            pieceHeight
        );
    }

    /**
     * Draw the entire puzzle with optional highlighted group
     */
    drawPuzzle(image, grid, pieceWidth, pieceHeight, highlightedGroup = null) {
        // Clear canvas
        this.clear();

        // Draw grid lines
        this.drawGrid(pieceWidth, pieceHeight);

        // Draw all pieces
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = grid[row][col];
                if (piece) {
                    this.drawPiece(image, piece, col, row, pieceWidth, pieceHeight);
                }
            }
        }

        // Draw highlight for selected group (bounding box around entire group)
        if (highlightedGroup !== null) {
            this.highlightGroupBoundingBox(grid, pieceWidth, pieceHeight, highlightedGroup);
        }
    }

    /**
     * Highlight entire group by drawing outline around connected pieces
     */
    highlightGroupBoundingBox(grid, pieceWidth, pieceHeight, groupId) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 6;

        // Draw borders for each piece, but only on sides that are NOT connected to another piece in the group
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = grid[row][col];
                if (piece && piece.group === groupId) {
                    const x = col * pieceWidth;
                    const y = row * pieceHeight;

                    // Check each edge and draw if it's an exterior edge
                    
                    // Top edge
                    const hasTopNeighbor = row > 0 && grid[row - 1][col]?.group === groupId;
                    if (!hasTopNeighbor) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, y);
                        this.ctx.lineTo(x + pieceWidth, y);
                        this.ctx.stroke();
                    }

                    // Bottom edge
                    const hasBottomNeighbor = row < this.gridSize - 1 && grid[row + 1][col]?.group === groupId;
                    if (!hasBottomNeighbor) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, y + pieceHeight);
                        this.ctx.lineTo(x + pieceWidth, y + pieceHeight);
                        this.ctx.stroke();
                    }

                    // Left edge
                    const hasLeftNeighbor = col > 0 && grid[row][col - 1]?.group === groupId;
                    if (!hasLeftNeighbor) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, y);
                        this.ctx.lineTo(x, y + pieceHeight);
                        this.ctx.stroke();
                    }

                    // Right edge
                    const hasRightNeighbor = col < this.gridSize - 1 && grid[row][col + 1]?.group === groupId;
                    if (!hasRightNeighbor) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x + pieceWidth, y);
                        this.ctx.lineTo(x + pieceWidth, y + pieceHeight);
                        this.ctx.stroke();
                    }
                }
            }
        }
    }

    /**
     * Highlight a group of pieces (for visual feedback during drag)
     */
    highlightGroup(groupCells, pieceWidth, pieceHeight) {
        this.ctx.strokeStyle = '#14b8a6';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);

        groupCells.forEach(cell => {
            this.ctx.strokeRect(
                cell.col * pieceWidth,
                cell.row * pieceHeight,
                pieceWidth,
                pieceHeight
            );
        });

        this.ctx.setLineDash([]);
    }
}
