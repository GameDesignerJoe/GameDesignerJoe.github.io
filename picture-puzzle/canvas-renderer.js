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
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.lineWidth = 2;

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
     * Draw the entire puzzle
     */
    drawPuzzle(image, grid, pieceWidth, pieceHeight) {
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
