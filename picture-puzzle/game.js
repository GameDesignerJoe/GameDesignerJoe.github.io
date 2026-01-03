// Main Game Logic
class PuzzleGame {
    constructor() {
        this.gridSize = 5; // Default: Medium difficulty
        this.maxCanvasSize = 900;
        this.image = null;
        this.grid = [];
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.renderer = null;
        this.dragHandler = null;
        
        // Gallery images - loaded from manifest
        this.galleryImages = [];
        
        // Highlighted group for visual feedback
        this.highlightedGroup = null;
        
        // Completion tracking
        this.completions = this.loadCompletions();
        
        // Uploaded images storage
        this.uploadedImages = this.loadUploadedImages();
        
        this.initializeUI();
        this.loadGalleryManifest();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Get DOM elements
        this.gameWrapper = document.querySelector('.game-wrapper');
        this.menuScreen = document.getElementById('menu-screen');
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
        this.viewPictureBtn = document.getElementById('view-picture-btn');
        this.winMainMenuBtn = document.getElementById('win-main-menu-btn');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.galleryOptions = document.getElementById('gallery-options');
        this.startPuzzleBtn = document.getElementById('start-puzzle-btn');
        
        // Image selection modal elements
        this.imageSelectionModal = document.getElementById('image-selection-modal');
        this.selectionPreviewImage = document.getElementById('selection-preview-image');
        this.selectionDifficultyButtons = document.querySelectorAll('.selection-difficulty-btn');
        this.backToGalleryBtn = document.getElementById('back-to-gallery-btn');
        this.letsPuzzleBtn = document.getElementById('lets-puzzle-btn');

        // Settings modal elements
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.clearProgressBtn = document.getElementById('clear-progress-btn');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');

        // Difficulty buttons
        this.galleryDifficultyButtons = document.querySelectorAll('.gallery-difficulty-btn');

        // State
        this.selectedGalleryImage = null;
        this.uploadedImage = null;
        this.puzzleComplete = false;
        this.currentPuzzleImage = null; // Track which image is being played

        // Event listeners
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        this.quitBtn.addEventListener('click', () => this.showQuitConfirmation());
        this.confirmQuitBtn.addEventListener('click', () => this.confirmQuit());
        this.cancelQuitBtn.addEventListener('click', () => this.cancelQuit());
        
        // Debug solve button
        this.debugSolveBtn = document.getElementById('debug-solve-btn');
        this.debugSolveBtn.addEventListener('click', () => this.debugSolvePuzzle());
        this.closePreview.addEventListener('click', () => this.hidePreview());
        this.previewModal.addEventListener('click', (e) => {
            if (e.target === this.previewModal) this.hidePreview();
        });
        
        // Win message buttons
        this.viewPictureBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideWinMessage();
        });
        this.winMainMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideWinMessage();
            this.resetGame();
        });

        // Difficulty selection (gallery)
        this.galleryDifficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectGalleryDifficulty(btn));
        });

        // Start puzzle button
        this.startPuzzleBtn.addEventListener('click', () => this.startPuzzleFromGallery());
        
        // Selection modal difficulty buttons
        this.selectionDifficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectModalDifficulty(btn));
        });
        
        // Selection modal action buttons
        this.backToGalleryBtn.addEventListener('click', () => this.hideImageSelectionModal());
        this.letsPuzzleBtn.addEventListener('click', () => this.startPuzzleFromModal());
        
        // Close modal when clicking outside
        this.imageSelectionModal.addEventListener('click', (e) => {
            if (e.target === this.imageSelectionModal) this.hideImageSelectionModal();
        });

        // Settings menu buttons
        this.settingsBtn.addEventListener('click', () => this.showSettingsModal());
        this.clearProgressBtn.addEventListener('click', () => this.confirmClearProgress());
        this.closeSettingsBtn.addEventListener('click', () => this.hideSettingsModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.hideSettingsModal();
        });

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
     * Load gallery manifest from global variable
     */
    loadGalleryManifest() {
        // Check if manifest was loaded from gallery-manifest.js
        if (window.PUZZLE_GALLERY_IMAGES && Array.isArray(window.PUZZLE_GALLERY_IMAGES)) {
            this.galleryImages = window.PUZZLE_GALLERY_IMAGES;
            console.log(`✅ Loaded ${this.galleryImages.length} images from manifest`);
        } else {
            console.warn('⚠️ No gallery manifest found. Run: node generate-manifest.js');
            this.galleryImages = [];
        }
        
        // Reload gallery with images
        this.loadGallery();
    }

    /**
     * Load gallery images with upload tile first
     */
    loadGallery() {
        this.galleryGrid.innerHTML = '';
        
        // Add upload tile as first item
        const uploadTile = document.createElement('div');
        uploadTile.className = 'gallery-item upload-tile';
        uploadTile.innerHTML = `
            <div class="upload-tile-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Upload Photo</span>
            </div>
        `;
        uploadTile.addEventListener('click', () => this.imageUpload.click());
        this.galleryGrid.appendChild(uploadTile);
        
        // Add uploaded images (right after upload button)
        this.uploadedImages.forEach(uploadedImg => {
            const item = document.createElement('div');
            item.className = 'gallery-item uploaded-item';
            
            const img = document.createElement('img');
            img.src = uploadedImg.dataUrl;
            img.alt = 'Uploaded image';
            
            item.appendChild(img);
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-uploaded-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete this image';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteUploadedImage(uploadedImg.id);
            });
            item.appendChild(deleteBtn);
            
            // Add completion stars overlay
            const imageKey = `upload_${uploadedImg.id}`;
            const completions = this.getImageCompletions(imageKey);
            if (Object.keys(completions).length > 0) {
                const starsOverlay = document.createElement('div');
                starsOverlay.className = 'completion-stars';
                
                // Easy (3x3) - Bronze
                if (completions['3']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-easy';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Medium (5x5) - Silver
                if (completions['5']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-medium';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Hard (7x7) - Gold
                if (completions['7']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-hard';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Insane (9x9) - Purple
                if (completions['9']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-insane';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                item.appendChild(starsOverlay);
            }
            
            item.addEventListener('click', () => this.selectUploadedImage(uploadedImg));
            
            this.galleryGrid.appendChild(item);
        });
        
        // Add gallery images
        this.galleryImages.forEach(imageName => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const img = document.createElement('img');
            img.src = `sample-pics/${imageName}`;
            img.alt = imageName;
            img.loading = 'lazy';
            
            item.appendChild(img);
            
            // Add completion stars overlay
            const completions = this.getImageCompletions(imageName);
            if (Object.keys(completions).length > 0) {
                const starsOverlay = document.createElement('div');
                starsOverlay.className = 'completion-stars';
                
                // Top-left: Easy (3x3) - Bronze
                if (completions['3']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-easy';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Top-right: Medium (5x5) - Silver
                if (completions['5']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-medium';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Bottom-left: Hard (7x7) - Gold
                if (completions['7']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-hard';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                // Bottom-right: Insane (9x9) - Purple
                if (completions['9']) {
                    const star = document.createElement('div');
                    star.className = 'completion-star star-insane';
                    star.innerHTML = '●';
                    starsOverlay.appendChild(star);
                }
                
                item.appendChild(starsOverlay);
            }
            
            item.addEventListener('click', () => this.selectGalleryImage(imageName));
            
            this.galleryGrid.appendChild(item);
        });
    }

    /**
     * Select an image from the gallery - Show modal with preview
     */
    selectGalleryImage(imageName) {
        // Store selected image
        this.selectedGalleryImage = imageName;
        this.uploadedImage = null; // Clear uploaded image
        
        // Show the selection modal
        this.showImageSelectionModal(imageName);
    }

    /**
     * Show image selection modal
     */
    showImageSelectionModal(imageName) {
        // Set preview image
        this.selectionPreviewImage.src = `sample-pics/${imageName}`;
        
        // Get completions for this image
        const completions = this.getImageCompletions(imageName);
        
        // Reset difficulty to medium (default)
        this.gridSize = 5;
        this.selectionDifficultyButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-difficulty') === '5') {
                btn.classList.add('active');
            }
            
            // Remove any existing completion stars
            const existingStar = btn.querySelector('.difficulty-completion-star');
            if (existingStar) {
                existingStar.remove();
            }
            
            // Add completion star if completed
            const difficulty = btn.getAttribute('data-difficulty');
            if (completions[difficulty]) {
                const star = document.createElement('div');
                star.className = 'difficulty-completion-star';
                star.innerHTML = '●';
                
                // Add color class based on difficulty
                if (difficulty === '3') star.classList.add('star-easy');
                else if (difficulty === '5') star.classList.add('star-medium');
                else if (difficulty === '7') star.classList.add('star-hard');
                else if (difficulty === '9') star.classList.add('star-insane');
                
                btn.appendChild(star);
            }
        });
        
        // Show modal
        this.imageSelectionModal.classList.remove('hidden');
    }

    /**
     * Hide image selection modal
     */
    hideImageSelectionModal() {
        this.imageSelectionModal.classList.add('hidden');
        this.selectedGalleryImage = null;
    }

    /**
     * Select difficulty in modal
     */
    selectModalDifficulty(selectedBtn) {
        // Remove active class from all modal difficulty buttons
        this.selectionDifficultyButtons.forEach(btn => btn.classList.remove('active'));
        
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
     * Start puzzle from modal (works for both gallery and uploaded images)
     */
    startPuzzleFromModal() {
        // Make sure renderer gridSize is synced
        if (this.renderer) {
            this.renderer.gridSize = this.gridSize;
        }

        // Check if using uploaded image
        if (this.uploadedImage) {
            console.log('Starting puzzle with uploaded image');
            console.log('Grid size:', this.gridSize);
            
            this.image = this.uploadedImage;
            
            // Hide modal
            this.hideImageSelectionModal();
            
            this.initializePuzzle();
            this.showGameScreen();
            return;
        }

        // Using gallery image
        if (!this.selectedGalleryImage) {
            console.error('No image selected!');
            return;
        }

        // Store the image name before hiding modal (which clears it)
        const imageName = this.selectedGalleryImage;
        this.currentPuzzleImage = imageName; // Track current puzzle

        console.log('Starting puzzle from modal');
        console.log('Selected image:', imageName);
        console.log('Grid size:', this.gridSize);

        const img = new Image();
        img.onload = () => {
            console.log('Gallery image loaded successfully');
            this.image = img;
            
            // Hide modal after image loads
            this.hideImageSelectionModal();
            
            this.initializePuzzle();
            this.showGameScreen();
        };
        img.onerror = (e) => {
            console.error('Failed to load gallery image:', e);
            this.hideImageSelectionModal();
        };
        img.src = `sample-pics/${imageName}`;
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
     * Start puzzle from either gallery or upload
     */
    startPuzzleFromGallery() {
        console.log('startPuzzleFromGallery called');
        
        // Check if using uploaded image or gallery image
        if (this.uploadedImage) {
            console.log('Using uploaded image');
            console.log('Grid size:', this.gridSize);
            
            // Make sure renderer gridSize is synced
            if (this.renderer) {
                this.renderer.gridSize = this.gridSize;
            }
            
            this.image = this.uploadedImage;
            this.initializePuzzle();
            this.showGameScreen();
        } else if (this.selectedGalleryImage) {
            console.log('Selected gallery image:', this.selectedGalleryImage);
            console.log('Grid size:', this.gridSize);
            
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
        } else {
            console.error('No image selected!');
        }
    }

    /**
     * Show menu screen
     */
    showMenuScreen() {
        document.body.classList.remove('playing'); // Exit fullscreen
        this.gameWrapper.classList.remove('playing'); // Shrink wrapper back
        this.menuScreen.classList.remove('hidden');
        this.gameScreen.classList.add('hidden');
        this.quitBtn.classList.add('hidden');
        
        // Clear selections
        this.selectedGalleryImage = null;
        this.uploadedImage = null;
        this.galleryOptions.classList.add('hidden');
        
        // Remove selected class from all items
        const allItems = this.galleryGrid.querySelectorAll('.gallery-item');
        allItems.forEach(item => item.classList.remove('selected'));
    }

    /**
     * Select an uploaded image from gallery
     */
    selectUploadedImage(uploadedImg) {
        // Load the uploaded image
        const img = new Image();
        img.onload = () => {
            this.uploadedImage = img;
            this.selectedGalleryImage = null;
            this.currentPuzzleImage = `upload_${uploadedImg.id}`; // Track for completions
            
            // Show selection modal
            this.showUploadedImageSelectionModal(uploadedImg);
        };
        img.src = uploadedImg.dataUrl;
    }

    /**
     * Show image selection modal for uploaded image from gallery
     */
    showUploadedImageSelectionModal(uploadedImg) {
        // Set preview image
        this.selectionPreviewImage.src = uploadedImg.dataUrl;
        
        // Get completions for this uploaded image
        const imageKey = `upload_${uploadedImg.id}`;
        const completions = this.getImageCompletions(imageKey);
        
        // Reset difficulty to medium (default)
        this.gridSize = 5;
        this.selectionDifficultyButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-difficulty') === '5') {
                btn.classList.add('active');
            }
            
            // Remove any existing completion stars
            const existingStar = btn.querySelector('.difficulty-completion-star');
            if (existingStar) {
                existingStar.remove();
            }
            
            // Add completion star if completed
            const difficulty = btn.getAttribute('data-difficulty');
            if (completions[difficulty]) {
                const star = document.createElement('div');
                star.className = 'difficulty-completion-star';
                star.innerHTML = '●';
                
                // Add color class based on difficulty
                if (difficulty === '3') star.classList.add('star-easy');
                else if (difficulty === '5') star.classList.add('star-medium');
                else if (difficulty === '7') star.classList.add('star-hard');
                else if (difficulty === '9') star.classList.add('star-insane');
                
                btn.appendChild(star);
            }
        });
        
        // Show modal
        this.imageSelectionModal.classList.remove('hidden');
    }

    /**
     * Handle image upload
     */
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            
            // Add image to gallery storage
            const imageId = this.addUploadedImage(dataUrl);
            
            // Load the newly uploaded image
            const img = new Image();
            img.onload = () => {
                this.uploadedImage = img;
                this.selectedGalleryImage = null;
                this.currentPuzzleImage = `upload_${imageId}`; // Track for completions
                
                // Show the selection modal with uploaded image
                this.showUploadedImageModal(dataUrl);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        
        // Clear the input so same file can be uploaded again
        e.target.value = '';
    }

    /**
     * Show image selection modal for uploaded image
     */
    showUploadedImageModal(imageSrc) {
        // Set preview image
        this.selectionPreviewImage.src = imageSrc;
        
        // Reset difficulty to medium (default)
        this.gridSize = 5;
        this.selectionDifficultyButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-difficulty') === '5') {
                btn.classList.add('active');
            }
        });
        
        // Show modal
        this.imageSelectionModal.classList.remove('hidden');
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
        // Use FULL screen - no reservations
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const availableWidth = viewportWidth;
        const availableHeight = viewportHeight;
        
        // Calculate piece dimensions from the image
        const pieceWidth = this.image.width / this.gridSize;
        const pieceHeight = this.image.height / this.gridSize;

        // Calculate the full puzzle dimensions
        const puzzleWidth = this.gridSize * pieceWidth;
        const puzzleHeight = this.gridSize * pieceHeight;

        // Scale to fit within full viewport while maintaining aspect ratio
        const scale = Math.min(
            availableWidth / puzzleWidth,
            availableHeight / puzzleHeight
        );

        this.pieceWidth = pieceWidth * scale;
        this.pieceHeight = pieceHeight * scale;

        // Set canvas size to fill viewport
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

        // Track which piece IDs were in the dragged group (before reset)
        const draggedPieceIds = new Set();
        groupCells.forEach(cell => {
            draggedPieceIds.add(cell.piece.id);
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

        // Check for connections after a short delay, passing the dragged piece IDs
        setTimeout(() => this.checkConnections(draggedPieceIds), 100);
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
     * @param {Set} draggedPieceIds - Optional set of piece IDs that were just moved
     */
    checkConnections(draggedPieceIds = null) {
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
            
            // Check if any dragged pieces are now connected (in a group with other pieces)
            if (draggedPieceIds && draggedPieceIds.size > 0) {
                // Find the group that contains the dragged pieces
                let draggedPieceGroup = null;
                for (let row = 0; row < this.gridSize; row++) {
                    for (let col = 0; col < this.gridSize; col++) {
                        const piece = this.grid[row][col];
                        if (piece && draggedPieceIds.has(piece.id)) {
                            draggedPieceGroup = piece.group;
                            break;
                        }
                    }
                    if (draggedPieceGroup !== null) break;
                }
                
                // Count how many pieces are in this group
                let groupSize = 0;
                if (draggedPieceGroup !== null) {
                    for (let row = 0; row < this.gridSize; row++) {
                        for (let col = 0; col < this.gridSize; col++) {
                            const piece = this.grid[row][col];
                            if (piece && piece.group === draggedPieceGroup) {
                                groupSize++;
                            }
                        }
                    }
                }
                
                // Only animate if the group has more pieces than were dragged
                // (meaning new connections were made)
                if (groupSize > draggedPieceIds.size) {
                    this.playConnectionAnimation(draggedPieceGroup);
                } else {
                    // No new connections - just redraw
                    this.draw();
                }
            } else {
                // No dragged pieces tracked - silent rebuild
                this.draw();
            }
            
            this.checkWinCondition();
        }
    }
    
    /**
     * Play visual feedback animation when pieces connect
     */
    playConnectionAnimation(groupId, connectionEdges) {
        // Step 1: Pulse the border around merged group
        this.drawWithFlash(groupId);
        
        // Step 2: Bump animation (scale up then down) - twice as slow
        setTimeout(() => {
            this.drawWithBump(groupId, 1.05);
        }, 100);
        
        setTimeout(() => {
            this.drawWithBump(groupId, 1.025);
        }, 200);
        
        setTimeout(() => {
            this.draw(); // Return to normal
        }, 300);
    }
    
    /**
     * Draw puzzle with pulsing border around the merged group
     */
    drawWithFlash(groupId) {
        if (!this.image || this.grid.length === 0) return;
        
        // Clear and redraw normally first
        this.renderer.clear();
        this.renderer.drawGrid(this.pieceWidth, this.pieceHeight, false);
        
        // Draw all pieces
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece) {
                    this.renderer.drawPiece(this.image, piece, col, row, this.pieceWidth, this.pieceHeight, false);
                }
            }
        }
        
        // Draw bright pulsing border around the merged group
        const ctx = this.renderer.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 10;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 255, 255, 1)';

        // Draw borders for each piece in group, only on exterior edges
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece && piece.group === groupId) {
                    const x = col * this.pieceWidth;
                    const y = row * this.pieceHeight;

                    // Check each edge and draw if it's an exterior edge
                    
                    // Top edge
                    const hasTopNeighbor = row > 0 && this.grid[row - 1][col]?.group === groupId;
                    if (!hasTopNeighbor) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + this.pieceWidth, y);
                        ctx.stroke();
                    }

                    // Bottom edge
                    const hasBottomNeighbor = row < this.gridSize - 1 && this.grid[row + 1][col]?.group === groupId;
                    if (!hasBottomNeighbor) {
                        ctx.beginPath();
                        ctx.moveTo(x, y + this.pieceHeight);
                        ctx.lineTo(x + this.pieceWidth, y + this.pieceHeight);
                        ctx.stroke();
                    }

                    // Left edge
                    const hasLeftNeighbor = col > 0 && this.grid[row][col - 1]?.group === groupId;
                    if (!hasLeftNeighbor) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + this.pieceHeight);
                        ctx.stroke();
                    }

                    // Right edge
                    const hasRightNeighbor = col < this.gridSize - 1 && this.grid[row][col + 1]?.group === groupId;
                    if (!hasRightNeighbor) {
                        ctx.beginPath();
                        ctx.moveTo(x + this.pieceWidth, y);
                        ctx.lineTo(x + this.pieceWidth, y + this.pieceHeight);
                        ctx.stroke();
                    }
                }
            }
        }
        
        ctx.shadowBlur = 0;
    }
    
    /**
     * Draw puzzle with bump (scale) effect on a specific group
     */
    drawWithBump(groupId, scale) {
        if (!this.image || this.grid.length === 0) return;
        
        // Clear and redraw normally first
        this.renderer.clear();
        this.renderer.drawGrid(this.pieceWidth, this.pieceHeight, false);
        
        // Calculate group center for scaling origin
        let minRow = this.gridSize, maxRow = 0, minCol = this.gridSize, maxCol = 0;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece && piece.group === groupId) {
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                }
            }
        }
        
        const centerRow = (minRow + maxRow) / 2;
        const centerCol = (minCol + maxCol) / 2;
        const centerX = (centerCol + 0.5) * this.pieceWidth;
        const centerY = (centerRow + 0.5) * this.pieceHeight;
        
        const ctx = this.renderer.ctx;
        
        // Draw all pieces
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece) {
                    if (piece.group === groupId) {
                        // Draw scaled version of connected pieces
                        ctx.save();
                        ctx.translate(centerX, centerY);
                        ctx.scale(scale, scale);
                        ctx.translate(-centerX, -centerY);
                        
                        this.renderer.drawPiece(this.image, piece, col, row, this.pieceWidth, this.pieceHeight, false);
                        
                        ctx.restore();
                    } else {
                        // Draw other pieces normally
                        this.renderer.drawPiece(this.image, piece, col, row, this.pieceWidth, this.pieceHeight, false);
                    }
                }
            }
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
    draw(showGrid = true, flashGrid = false) {
        if (!this.image || this.grid.length === 0) return;
        
        // If puzzle is complete, never show grid
        if (this.puzzleComplete) {
            showGrid = false;
        }
        
        // Clear canvas
        this.renderer.clear();
        
        // Draw grid with optional flash effect
        if (showGrid) {
            this.renderer.drawGrid(this.pieceWidth, this.pieceHeight, flashGrid);
        }
        
        // Draw all pieces
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const piece = this.grid[row][col];
                if (piece) {
                    this.renderer.drawPiece(this.image, piece, col, row, this.pieceWidth, this.pieceHeight, !showGrid);
                }
            }
        }
        
        // Draw highlight for selected group
        if (this.highlightedGroup !== null) {
            this.renderer.highlightGroupBoundingBox(this.grid, this.pieceWidth, this.pieceHeight, this.highlightedGroup);
        }
    }

    /**
     * Set highlighted group and redraw
     */
    setHighlightedGroup(groupId) {
        this.highlightedGroup = groupId;
        this.draw();
    }

    /**
     * Clear highlighted group and redraw
     */
    clearHighlightedGroup() {
        this.highlightedGroup = null;
        this.draw();
    }

    /**
     * Show the game screen
     */
    showGameScreen() {
        this.puzzleComplete = false; // Reset completion flag
        document.body.classList.add('playing'); // Fullscreen mode
        this.gameWrapper.classList.add('playing'); // Expand wrapper
        this.menuScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.quitBtn.classList.remove('hidden');
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
     * Show win message with celebration sequence
     */
    showWinMessage() {
        this.puzzleComplete = true;
        
        // Save completion for gallery images
        if (this.currentPuzzleImage) {
            this.saveCompletion(this.currentPuzzleImage, this.gridSize);
            // Reload gallery to update stars
            this.loadGallery();
        }
        
        // Step 1: Flash the grid lines white
        this.draw(true, true); // Show grid with flash
        
        // Step 2: Remove grid after flash (300ms)
        setTimeout(() => {
            this.draw(false); // Hide grid completely
        }, 300);
        
        // Step 3: Wait 4 seconds before showing congratulations
        setTimeout(() => {
            this.winMessage.classList.remove('hidden');
        }, 4000);
    }


    /**
     * Hide win message
     */
    hideWinMessage() {
        this.winMessage.classList.add('hidden');
    }

    /**
     * Show quit confirmation modal (or go straight to menu if puzzle complete)
     */
    showQuitConfirmation() {
        if (this.puzzleComplete) {
            // Puzzle is complete, go straight to main menu
            this.resetGame();
        } else {
            // Puzzle in progress, show confirmation
            this.quitModal.classList.remove('hidden');
        }
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

    /**
     * Load uploaded images from localStorage
     */
    loadUploadedImages() {
        try {
            const data = localStorage.getItem('puzzleUploadedImages');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load uploaded images:', e);
            return [];
        }
    }

    /**
     * Save uploaded images to localStorage
     */
    saveUploadedImages() {
        try {
            localStorage.setItem('puzzleUploadedImages', JSON.stringify(this.uploadedImages));
            console.log(`💾 Saved ${this.uploadedImages.length} uploaded images`);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Storage limit reached! Unable to save more uploaded images. Try deleting some old uploads.');
                console.error('❌ Storage quota exceeded');
            } else {
                console.error('Failed to save uploaded images:', e);
            }
        }
    }

    /**
     * Add uploaded image to gallery
     */
    addUploadedImage(imageDataUrl) {
        const uploadedImage = {
            id: Date.now(), // Unique ID based on timestamp
            dataUrl: imageDataUrl,
            timestamp: Date.now()
        };
        
        // Add to beginning of array (most recent first)
        this.uploadedImages.unshift(uploadedImage);
        
        // Save to localStorage
        this.saveUploadedImages();
        
        // Reload gallery
        this.loadGallery();
        
        return uploadedImage.id;
    }

    /**
     * Delete uploaded image
     */
    deleteUploadedImage(imageId) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id !== imageId);
        this.saveUploadedImages();
        
        // Also remove completions for this image
        const imageKey = `upload_${imageId}`;
        if (this.completions[imageKey]) {
            delete this.completions[imageKey];
            try {
                localStorage.setItem('puzzleCompletions', JSON.stringify(this.completions));
            } catch (e) {
                console.error('Failed to update completions:', e);
            }
        }
        
        this.loadGallery();
    }

    /**
     * Load completions from localStorage
     */
    loadCompletions() {
        try {
            const data = localStorage.getItem('puzzleCompletions');
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load completions:', e);
            return {};
        }
    }

    /**
     * Save completion to localStorage
     */
    saveCompletion(imageName, difficulty) {
        if (!imageName) return;
        
        // Initialize image entry if it doesn't exist
        if (!this.completions[imageName]) {
            this.completions[imageName] = {};
        }
        
        // Mark difficulty as complete
        this.completions[imageName][difficulty.toString()] = true;
        
        // Save to localStorage
        try {
            localStorage.setItem('puzzleCompletions', JSON.stringify(this.completions));
            console.log(`✅ Saved completion: ${imageName} - ${difficulty}x${difficulty}`);
        } catch (e) {
            console.error('Failed to save completion:', e);
        }
    }

    /**
     * Get completions for a specific image
     */
    getImageCompletions(imageName) {
        return this.completions[imageName] || {};
    }

    /**
     * Clear all progress (debug function)
     */
    clearProgress() {
        this.completions = {};
        try {
            localStorage.removeItem('puzzleCompletions');
            console.log('🗑️ All progress cleared');
            // Reload gallery to update stars
            this.loadGallery();
        } catch (e) {
            console.error('Failed to clear progress:', e);
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        this.settingsModal.classList.remove('hidden');
    }

    /**
     * Hide settings modal
     */
    hideSettingsModal() {
        this.settingsModal.classList.add('hidden');
    }

    /**
     * Confirm and execute clear progress
     */
    confirmClearProgress() {
        this.clearProgress();
        this.hideSettingsModal();
    }

    /**
     * Debug: Solve puzzle instantly
     */
    debugSolvePuzzle() {
        console.log('🔧 Debug: Solving puzzle...');
        
        // Close the quit modal
        this.quitModal.classList.add('hidden');
        
        // Arrange all pieces in their correct positions
        const newGrid = [];
        for (let row = 0; row < this.gridSize; row++) {
            newGrid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                // Find the piece that belongs here
                let correctPiece = null;
                for (let r = 0; r < this.gridSize; r++) {
                    for (let c = 0; c < this.gridSize; c++) {
                        const piece = this.grid[r][c];
                        if (piece && piece.originalRow === row && piece.originalCol === col) {
                            correctPiece = piece;
                            break;
                        }
                    }
                    if (correctPiece) break;
                }
                newGrid[row][col] = correctPiece;
            }
        }
        
        // Update grid
        this.grid = newGrid;
        
        // Set all pieces to the same group (they're all connected now)
        const firstGroup = this.grid[0][0].id;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                this.grid[row][col] = { ...this.grid[row][col], group: firstGroup };
            }
        }
        
        // Redraw and trigger win
        this.draw();
        setTimeout(() => {
            this.showWinMessage();
        }, 100);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PuzzleGame();
});
