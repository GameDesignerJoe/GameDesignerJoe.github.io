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
        // Add small tolerance for edge cases (1 pixel)
        const tolerance = 1;
        const adjustedX = Math.max(0, Math.min(x, this.game.canvas.width - tolerance));
        const adjustedY = Math.max(0, Math.min(y, this.game.canvas.height - tolerance));
        
        const col = Math.floor(adjustedX / this.game.pieceWidth);
        const row = Math.floor(adjustedY / this.game.pieceHeight);
        
        // Clamp to grid bounds to handle floating point edge cases
        const clampedCol = Math.max(0, Math.min(col, this.game.gridSize - 1));
        const clampedRow = Math.max(0, Math.min(row, this.game.gridSize - 1));
        
        // Debug: Log if clamping occurred (indicates boundary issue)
        if (col !== clampedCol || row !== clampedRow) {
            console.log(`⚠️ Coordinate clamping: (${row},${col}) → (${clampedRow},${clampedCol})`);
        }
        
        if (clampedRow >= 0 && clampedRow < this.game.gridSize && 
            clampedCol >= 0 && clampedCol < this.game.gridSize) {
            return { row: clampedRow, col: clampedCol };
        }
        
        console.log(`❌ Invalid grid position: x=${x}, y=${y}, row=${row}, col=${col}`);
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
            
            // Highlight the selected group
            this.game.setHighlightedGroup(piece.group);
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
            // Debug: Log why drag was cancelled
            if (this.isDragging && !this.currentDragPos) {
                console.log('⚠️ Drag cancelled: currentDragPos is null');
            }
            this.resetDrag();
            return;
        }
        
        e.preventDefault();

        const endPos = this.currentDragPos;
        
        // Debug: Log drop attempt
        console.log(`🎯 Drop attempt: (${this.dragStart.row},${this.dragStart.col}) → (${endPos.row},${endPos.col})`);
        
        // Only process if we've moved to a different cell
        if (endPos.row === this.dragStart.row && endPos.col === this.dragStart.col) {
            console.log('↩️ Same cell, no swap needed');
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
        
        // Clear highlight
        this.game.clearHighlightedGroup();
    }
}
