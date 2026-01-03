// Drag Handler - Manages drag and drop interactions for puzzle pieces
class DragHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.isDragging = false;
        this.draggedGroup = null;
        this.dragStart = null;
        this.currentDragPos = null;

        this.setupEventListeners();
    }

    /**
     * Set up mouse and touch event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleEnd(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleEnd(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleEnd(e), { passive: false });
    }

    /**
     * Get position from mouse or touch event
     */
    getEventPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        
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
    }

    /**
     * Convert canvas coordinates to grid position
     */
    getGridPosition(x, y) {
        const col = Math.floor(x / this.game.pieceWidth);
        const row = Math.floor(y / this.game.pieceHeight);
        
        if (row >= 0 && row < this.game.gridSize && col >= 0 && col < this.game.gridSize) {
            return { row, col };
        }
        
        return null;
    }

    /**
     * Handle drag start
     */
    handleStart(e) {
        e.preventDefault();
        
        const { x, y } = this.getEventPosition(e);
        const pos = this.getGridPosition(x, y);
        
        if (pos && this.game.grid[pos.row][pos.col]) {
            const piece = this.game.grid[pos.row][pos.col];
            this.isDragging = true;
            this.draggedGroup = piece.group;
            this.dragStart = pos;
            this.currentDragPos = pos;
        }
    }

    /**
     * Handle drag move
     */
    handleMove(e) {
        if (!this.isDragging || !this.draggedGroup || !this.dragStart) return;
        
        e.preventDefault();
        
        const { x, y } = this.getEventPosition(e);
        const pos = this.getGridPosition(x, y);
        
        if (pos) {
            this.currentDragPos = pos;
        }
    }

    /**
     * Handle drag end
     */
    handleEnd(e) {
        if (!this.isDragging || !this.draggedGroup || !this.dragStart || !this.currentDragPos) {
            this.resetDrag();
            return;
        }
        
        e.preventDefault();

        const endPos = this.currentDragPos;
        
        // Only process if we've moved to a different cell
        if (endPos.row === this.dragStart.row && endPos.col === this.dragStart.col) {
            this.resetDrag();
            return;
        }

        // Perform the swap
        this.game.swapPieces(this.draggedGroup, this.dragStart, endPos);
        
        this.resetDrag();
    }

    /**
     * Reset drag state
     */
    resetDrag() {
        this.isDragging = false;
        this.draggedGroup = null;
        this.dragStart = null;
        this.currentDragPos = null;
    }
}
