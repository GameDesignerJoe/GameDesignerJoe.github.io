// Main Game Logic
class PuzzleGame {
    constructor() {
        this.gridSize = 5; // Default: Medium difficulty
        this.maxCanvasSize = 600;
        this.image = null;
        this.grid = [];
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.renderer = null;
        this.dragHandler = null;
        
        // Gallery images
        this.galleryImages = [
            'aurora_image.png',
            'gamedesignerjoe_a_1920s_cartographer_in_khakis_field_vest_and_822c1924-60dd-4e50-befd-91f24c50e4c1_1.png',
            'gamedesignerjoe_httpss.mj.runAx6hOrnbYoE_A_water_color_forest_b1212379-8d3a-4a49-b4cb-a57a8b30e3fa_0.png',
            'gamedesignerjoe_httpss.mj.runfyRTDDpdNx8_a_small_space_ship_f_1aeb4289-9bf1-4dd0-8d98-1eef36d69058_2.png',
            'gamedesignerjoe_httpss.mj.runXGnwus1etOw_An_anchor_in_the_sky_ff851a86-32cb-4378-9250-f045c532f32d_1.png',
            'gamedesignerjoe_Two_fae_entities_in_heated_discussion_in_myst_68808a57-dae0-432b-9999-61a0614d02dd_1.png',
            'image (3).png',
            'Image from iOS (1).jpg',
            'Image from iOS (5).jpg',
            'Image from iOS (6).jpg',
            'joe_512.png',
            'manandmoon.png',
            'nas_b_512.png',
            'Slide12.JPG'
        ];
        
        this.initializeUI();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Get DOM elements
        this.menuScreen = document.getElementById('menu-screen');
        this.uploadScreen = document.getElementById('upload-screen');
        this.galleryScreen = document.getElementById('gallery-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.imageUpload = document.getElementById('image-upload');
        this.canvas = document.getElementById('puzzle-canvas');
        this.quitBtn = document.getElementById('quit-btn');
        this.quitModal = document.getElementById('quit-modal');
        this.confirmQuitBtn = document.getElementById('confirm-quit-btn');
        this.cancelQuitBtn = document.getElementById('cancel-quit-btn');
        this.previewModal = document.getElementById('preview-modal');
        this.previewImage = document.getElementById('preview-image');
        this.closePreview = document.getElementById('close-preview');
        this.winMessage = document.getElementById('win-message');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.galleryOptions = document.getElementById('gallery-options');
        this.startPuzzleBtn = document.getElementById('start-puzzle-btn');

        // Menu buttons
        this.uploadOptionBtn = document.getElementById('upload-option-btn');
        this.galleryOptionBtn = document.getElementById('gallery-option-btn');
        this.backToMenuUpload = document.getElementById('back-to-menu-upload');
        this.backToMenuGallery = document.getElementById('back-to-menu-gallery');

        // Difficulty buttons
        this.galleryDifficultyButtons = document.querySelectorAll('.gallery-difficulty-btn');
        this.uploadDifficultyButtons = document.querySelectorAll('.upload-difficulty-btn');

        // State
        this.selectedGalleryImage = null;
        this.uploadedImage = null;
        this.uploadOptions = document.getElementById('upload-options');
        this.startUploadPuzzleBtn = document.getElementById('start-upload-puzzle-btn');

        // Event listeners
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        this.quitBtn.addEventListener('click', () => this.showQuitConfirmation());
        this.confirmQuitBtn.addEventListener('click', () => this.confirmQuit());
        this.cancelQuitBtn.addEventListener('click', () => this.cancelQuit());
        this.closePreview.addEventListener('click', () => this.hidePreview());
        this.previewModal.addEventListener('click', (e) => {
            if (e.target === this.previewModal) this.hidePreview();
        });
        this.winMessage.addEventListener('click', () => this.hideWinMessage());

        // Menu navigation
        this.uploadOptionBtn.addEventListener('click', () => this.showUploadScreen());
        this.galleryOptionBtn.addEventListener('click', () => this.showGalleryScreen());
        this.backToMenuUpload.addEventListener('click', () => {
            this.uploadedImage = null;
            this.uploadOptions.classList.add('hidden');
            this.showMenuScreen();
        });
        this.backToMenuGallery.addEventListener('click', () => {
            this.selectedGalleryImage = null;
            this.galleryOptions.classList.add('hidden');
            this.showMenuScreen();
        });

        // Difficulty selection (upload)
        this.uploadDifficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectUploadDifficulty(btn));
        });

        // Difficulty selection (gallery)
        this.galleryDifficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectGalleryDifficulty(btn));
        });

        // Start puzzle buttons
        this.startPuzzleBtn.addEventListener('click', () => this.startPuzzleFromGallery());
        this.startUploadPuzzleBtn.addEventListener('click', () => this.startPuzzleFromUpload());

        // Initialize renderer
        this.renderer = new CanvasRenderer(this.canvas);

        // Load gallery images
        this.loadGallery();
    }

    /**
     * Select difficulty level
     */
    selectDifficulty(selectedBtn) {
        // Remove active class from all buttons
        this.difficultyButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        selectedBtn.classList.add('active');
        
        // Update grid size
        this.gridSize = parseInt(selectedBtn.getAttribute('data-difficulty'));
        
        // Update renderer grid size
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }
    }

    /**
     * Load gallery images
     */
    loadGallery() {
        this.galleryGrid.innerHTML = '';
        
        this.galleryImages.forEach(imageName => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const img = document.createElement('img');
            img.src = `sample-pics/${imageName}`;
            img.alt = imageName;
            img.loading = 'lazy';
            
            item.appendChild(img);
            item.addEventListener('click', () => this.selectGalleryImage(imageName));
            
            this.galleryGrid.appendChild(item);
        });
    }

    /**
     * Select an image from the gallery
     */
    selectGalleryImage(imageName) {
        // Store selected image
        this.selectedGalleryImage = imageName;

        // Remove selected class from all items
        const allItems = this.galleryGrid.querySelectorAll('.gallery-item');
        allItems.forEach(item => item.classList.remove('selected'));

        // Add selected class to clicked item
        const clickedItem = event.target.closest('.gallery-item');
        if (clickedItem) {
            clickedItem.classList.add('selected');
        }

        // Show options section
        this.galleryOptions.classList.remove('hidden');
    }

    /**
     * Select difficulty in gallery
     */
    selectGalleryDifficulty(selectedBtn) {
        // Remove active class from all gallery difficulty buttons
        this.galleryDifficultyButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        selectedBtn.classList.add('active');
        
        // Update grid size
        this.gridSize = parseInt(selectedBtn.getAttribute('data-difficulty'));
        
        // Update renderer grid size
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }
    }

    /**
     * Start puzzle from gallery selection
     */
    startPuzzleFromGallery() {
        console.log('startPuzzleFromGallery called');
        console.log('Selected gallery image:', this.selectedGalleryImage);
        console.log('Grid size:', this.gridSize);
        
        if (!this.selectedGalleryImage) {
            console.error('No gallery image selected!');
            return;
        }

        // Make sure renderer gridSize is synced
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }

        const img = new Image();
        img.onload = () => {
            console.log('Gallery image loaded successfully');
            this.image = img;
            this.initializePuzzle();
            this.showGameScreen();
        };
        img.onerror = (e) => {
            console.error('Failed to load gallery image:', e);
        };
        img.src = `sample-pics/${this.selectedGalleryImage}`;
        console.log('Image source set to:', img.src);
    }

    /**
     * Show menu screen
     */
    showMenuScreen() {
        this.menuScreen.classList.remove('hidden');
        this.uploadScreen.classList.add('hidden');
        this.galleryScreen.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.quitBtn.classList.add('hidden');
    }

    /**
     * Show gallery screen
     */
    showGalleryScreen() {
        this.menuScreen.classList.add('hidden');
        this.galleryScreen.classList.remove('hidden');
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
                this.uploadedImage = img;
                this.uploadOptions.classList.remove('hidden');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Select difficulty for uploaded image
     */
    selectUploadDifficulty(selectedBtn) {
        // Remove active class from all upload difficulty buttons
        this.uploadDifficultyButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        selectedBtn.classList.add('active');
        
        // Update grid size
        this.gridSize = parseInt(selectedBtn.getAttribute('data-difficulty'));
        
        // Update renderer grid size
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }
    }

    /**
     * Start puzzle from uploaded image
     */
    startPuzzleFromUpload() {
        console.log('startPuzzleFromUpload called');
        console.log('Uploaded image:', this.uploadedImage);
        console.log('Grid size:', this.gridSize);
        
        if (!this.uploadedImage) {
            console.error('No uploaded image!');
            return;
        }

        // Make sure renderer gridSize is synced
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }

        this.image = this.uploadedImage;
        console.log('Starting puzzle initialization...');
        this.initializePuzzle();
        this.showGameScreen();
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
        this.menuScreen.classList.add('hidden');
        this.uploadScreen.classList.add('hidden');
        this.galleryScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.quitBtn.classList.remove('hidden');
    }

    /**
     * Show the upload screen
     */
    showUploadScreen() {
        this.menuScreen.classList.add('hidden');
        this.galleryScreen.classList.add('hidden');
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
     * Show quit confirmation modal
     */
    showQuitConfirmation() {
        this.quitModal.classList.remove('hidden');
    }

    /**
     * Confirm quit and return to menu
     */
    confirmQuit() {
        this.quitModal.classList.add('hidden');
        this.resetGame();
    }

    /**
     * Cancel quit and continue playing
     */
    cancelQuit() {
        this.quitModal.classList.add('hidden');
    }

    /**
     * Reset the game
     */
    resetGame() {
        this.image = null;
        this.grid = [];
        this.imageUpload.value = '';
        this.hideWinMessage();
        this.showMenuScreen();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PuzzleGame();
});
