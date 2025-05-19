class GameUI {
    constructor(container) {
        this.container = container;
        this.quoteService = new QuoteService();
        this.cryptogramGenerator = new CryptogramGenerator();
        this.letterSwapHandler = new LetterSwapHandler(40); // 40 swaps allowed

        this.elements = {
            themeInput: document.getElementById('theme-input'),
            newThemeBtn: document.getElementById('new-theme-btn'),
            currentTheme: document.getElementById('current-theme'),
            swapsCounter: document.getElementById('swaps-counter'),
            puzzleGrid: document.getElementById('puzzle-grid'),
            currentClue: document.getElementById('current-clue')
        };

        this.currentPuzzle = null;
        this.bindEvents();
    }

    bindEvents() {
        // Theme input handling
        this.elements.newThemeBtn.addEventListener('click', () => this.handleNewTheme());
        this.elements.themeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleNewTheme();
        });

        // Puzzle grid click handling
        this.elements.puzzleGrid.addEventListener('click', (e) => {
            const tile = e.target.closest('.letter-tile');
            if (tile) this.handleTileClick(tile);
        });
    }

    async handleNewTheme() {
        const theme = this.elements.themeInput.value.trim();
        if (!theme) return;

        try {
            console.log('Handling new theme:', theme);
            this.elements.newThemeBtn.disabled = true;
            this.elements.currentTheme.textContent = theme;
            
            const quote = await this.quoteService.getQuoteByTheme(theme);
            console.log('Received quote:', quote);
            
            this.currentPuzzle = this.cryptogramGenerator.generatePuzzle(quote);
            console.log('Generated puzzle:', this.currentPuzzle);
            
            this.letterSwapHandler.initialize(this.currentPuzzle.structure);
            console.log('Initialized letter swap handler');
            
            this.renderPuzzle();
            this.updateSwapsCounter();
            
            // Clear input after successful theme change
            this.elements.themeInput.value = '';
        } catch (error) {
            console.error('Error creating new puzzle:', error);
        } finally {
            this.elements.newThemeBtn.disabled = false;
        }
    }

    renderPuzzle() {
        if (!this.currentPuzzle) {
            console.error('No puzzle to render');
            return;
        }

        console.log('Rendering puzzle structure:', this.currentPuzzle.structure);
        this.elements.puzzleGrid.innerHTML = '';
        
        this.currentPuzzle.structure.forEach((row, rowIndex) => {
            console.log(`Creating row ${rowIndex}:`, row);
            const rowElement = document.createElement('div');
            rowElement.className = 'puzzle-row';
            
            row.forEach((tile, tileIndex) => {
                console.log(`Creating tile ${rowIndex}-${tileIndex}:`, tile);
                const tileElement = this.createTileElement(tile);
                rowElement.appendChild(tileElement);
            });
            
            this.elements.puzzleGrid.appendChild(rowElement);
        });

        // Update clue with author
        this.elements.currentClue.textContent = `Quote by: ${this.currentPuzzle.author}`;
        console.log('Puzzle rendering complete');
    }

    createTileElement(tile) {
        const tileElement = document.createElement('div');
        tileElement.className = 'letter-tile';
        
        if (!tile.isLetter) {
            tileElement.classList.add('empty');
            tileElement.textContent = tile.char;
            return tileElement;
        }

        // Add position number if it exists
        if (tile.position !== null) {
            const numberElement = document.createElement('span');
            numberElement.className = 'number';
            numberElement.textContent = tile.position;
            tileElement.appendChild(numberElement);
        }

        // Add the letter
        const letterElement = document.createElement('span');
        letterElement.className = 'letter';
        letterElement.textContent = tile.char;
        tileElement.appendChild(letterElement);

        // Store tile data
        tileElement.dataset.char = tile.char;
        tileElement.dataset.position = tile.position;

        return tileElement;
    }

    handleTileClick(tileElement) {
        const tile = this.getTileData(tileElement);
        const result = this.letterSwapHandler.handleTileClick(tile);

        if (!result) return;

        switch (result.type) {
            case 'select':
                tileElement.classList.add('active');
                break;
            
            case 'deselect':
                tileElement.classList.remove('active');
                break;
            
            case 'swap':
                this.performSwapUI(result);
                this.updateSwapsCounter();
                this.checkSolution();
                break;
            
            case 'error':
                // Could add visual feedback for errors
                break;
        }
    }

    getTileData(tileElement) {
        return {
            char: tileElement.dataset.char,
            position: parseInt(tileElement.dataset.position),
            isLetter: true
        };
    }

    performSwapUI(swapResult) {
        const { tile1, tile2 } = swapResult;
        
        // Find and update the tile elements
        const elements = this.elements.puzzleGrid.querySelectorAll('.letter-tile');
        elements.forEach(element => {
            if (element.dataset.char === tile1.char || element.dataset.char === tile2.char) {
                element.classList.remove('active');
                const letterElement = element.querySelector('.letter');
                const currentChar = element.dataset.char;
                
                // Update the displayed letter based on the swap
                if (currentChar === tile1.char) {
                    letterElement.textContent = this.letterSwapHandler.getCurrentGuess(tile1.char);
                } else {
                    letterElement.textContent = this.letterSwapHandler.getCurrentGuess(tile2.char);
                }
            }
        });
    }

    updateSwapsCounter() {
        this.elements.swapsCounter.textContent = 
            `${this.letterSwapHandler.remainingSwaps} Swaps Left`;
    }

    checkSolution() {
        const currentGuesses = this.letterSwapHandler.getAllGuesses();
        const isCorrect = this.cryptogramGenerator.checkSolution(currentGuesses);

        if (isCorrect) {
            this.handlePuzzleComplete();
        }
    }

    handlePuzzleComplete() {
        // Disable further interaction
        this.elements.puzzleGrid.style.pointerEvents = 'none';
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Congratulations! Puzzle solved!';
        
        // Add try another button
        const tryAnotherBtn = document.createElement('button');
        tryAnotherBtn.textContent = 'Try Another';
        tryAnotherBtn.addEventListener('click', () => {
            this.elements.puzzleGrid.style.pointerEvents = 'auto';
            successMessage.remove();
            this.handleNewTheme();
        });
        
        successMessage.appendChild(tryAnotherBtn);
        this.container.appendChild(successMessage);
    }
}
