// Drag Handler - Manages drag and drop interactions for puzzle pieces
class DragHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.isDragging = false;
        this.draggedGroup = null;
        this.dragStart = null;
        this.currentDragPos = null;

        // Zoom and pan state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.5;
        this.maxZoom = 3.0;

        // Multi-touch state
        this.lastTouchDistance = null;
        this.lastTouchCenter = null;
        this.isPinching = false;
        this.isPanning = false;

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
     * Calculate distance between two touches
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get center point between two touches
     */
    getTouchCenter(touch1, touch2) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
            y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
        };
    }

    /**
     * Transform screen coordinates to canvas coordinates (accounting for zoom/pan)
     * Note: x and y are already relative to the canvas's visual position (from getBoundingClientRect)
     * which includes the pan offset, so we only need to reverse the zoom scale.
     */
    screenToCanvas(x, y) {
        return {
            x: x / this.zoom,
            y: y / this.zoom
        };
    }

    /**
     * Apply zoom and pan transformation to canvas
     */
    applyTransform() {
        const container = this.canvas.parentElement;
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.canvas.style.transformOrigin = '0 0';
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
     * Handle drag/touch start
     */
    handleStart(e) {
        // Multi-touch: pinch or pan
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            this.isPinching = true;
            this.isPanning = true;
            
            // Cancel any ongoing drag
            if (this.isDragging) {
                this.resetDrag();
            }
            
            this.lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            this.lastTouchCenter = this.getTouchCenter(e.touches[0], e.touches[1]);
            return;
        }

        // Single touch: piece drag
        e.preventDefault();
        
        const { x, y } = this.getEventPosition(e);
        
        // Transform screen coordinates to canvas coordinates
        const canvasCoords = this.screenToCanvas(x, y);
        const pos = this.getGridPosition(canvasCoords.x, canvasCoords.y);
        
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
     * Handle drag/touch move
     */
    handleMove(e) {
        // Multi-touch: handle pinch zoom and pan
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            
            if (!this.isPinching) return;
            
            const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            const currentCenter = this.getTouchCenter(e.touches[0], e.touches[1]);
            
            // Calculate zoom change
            if (this.lastTouchDistance) {
                const distanceChange = currentDistance / this.lastTouchDistance;
                const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * distanceChange));
                
                // Zoom around the pinch center
                const zoomChange = newZoom / this.zoom;
                this.panX = currentCenter.x - (currentCenter.x - this.panX) * zoomChange;
                this.panY = currentCenter.y - (currentCenter.y - this.panY) * zoomChange;
                this.zoom = newZoom;
            }
            
            // Calculate pan change
            if (this.lastTouchCenter) {
                this.panX += (currentCenter.x - this.lastTouchCenter.x);
                this.panY += (currentCenter.y - this.lastTouchCenter.y);
            }
            
            this.lastTouchDistance = currentDistance;
            this.lastTouchCenter = currentCenter;
            
            // Apply the transformation
            this.applyTransform();
            return;
        }

        // Single touch: piece drag
        if (!this.isDragging || !this.draggedGroup || !this.dragStart) return;
        
        e.preventDefault();
        
        const { x, y } = this.getEventPosition(e);
        const canvasCoords = this.screenToCanvas(x, y);
        const pos = this.getGridPosition(canvasCoords.x, canvasCoords.y);
        
        if (pos) {
            this.currentDragPos = pos;
        }
    }

    /**
     * Handle drag/touch end
     */
    handleEnd(e) {
        // Multi-touch ended
        if (this.isPinching || this.isPanning) {
            this.isPinching = false;
            this.isPanning = false;
            this.lastTouchDistance = null;
            this.lastTouchCenter = null;
            return;
        }

        // Single touch piece drag
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
