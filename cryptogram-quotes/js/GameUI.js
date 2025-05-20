class GameUI {
    constructor(container) {
        this.container = container;
        this.quoteService = new QuoteService();
        this.cryptogramGenerator = new CryptogramGenerator();
        this.currentDifficulty = 'easy'; // Default to easy

        this.elements = {
            themeInput: document.getElementById('theme-input'),
            newThemeBtn: document.getElementById('new-theme-btn'),
            currentTheme: document.getElementById('current-theme'),
            author: document.querySelector('.author'),
            puzzleGrid: document.getElementById('puzzle-grid'),
            keyboard: document.querySelector('.keyboard')
        };

        this.currentPuzzle = null;
        this.selectedEncodedLetter = null;
        this.currentGuesses = new Map(); // Maps encoded letters to decoded guesses
        this.usedLetters = new Set(); // Tracks which keyboard letters have been used
        
        this.bindEvents();
    }

    bindEvents() {
        // Theme input handling
        const submitTheme = () => {
            console.log('Submitting theme');
            this.handleNewTheme();
        };

        this.elements.newThemeBtn.addEventListener('click', submitTheme);

        this.elements.themeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressed in theme input');
                e.preventDefault();
                submitTheme();
            }
        });

        // Add focus event to theme input
        this.elements.themeInput.addEventListener('focus', () => {
            console.log('Theme input focused');
        });

        // Add input event to theme input
        this.elements.themeInput.addEventListener('input', (e) => {
            console.log('Theme input value:', e.target.value);
        });

        // Puzzle grid click handling
        this.elements.puzzleGrid.addEventListener('click', (e) => {
            const encodedLetter = e.target.closest('.encoded');
            if (encodedLetter) this.handleEncodedLetterClick(encodedLetter);
        });

        // Keyboard click handling
        this.elements.keyboard.addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (key && !key.disabled) this.handleKeyboardClick(key);
        });
    }

    async handleNewTheme() {
        let theme = this.elements.themeInput.value.trim();
        console.log('Attempting to handle new theme:', theme);
        
        try {
            this.elements.newThemeBtn.disabled = true;
            
            // If no theme provided, pick a random one
            if (!theme) {
                theme = this.quoteService.themes[Math.floor(Math.random() * this.quoteService.themes.length)];
            }
            
            console.log('Handling new theme:', theme);
            const upperTheme = theme.toUpperCase();
            this.elements.currentTheme.textContent = upperTheme;
            
            console.log('Fetching quote for theme:', upperTheme);
            const quote = await this.quoteService.getQuoteByTheme(upperTheme);
            console.log('Received quote:', quote);
            
            // Update author
            this.elements.author.textContent = `By: ${quote.author}`;
            
            // Generate puzzle
            this.currentPuzzle = this.cryptogramGenerator.generatePuzzle(quote);
            console.log('Generated puzzle:', this.currentPuzzle);
            
            // Reset game state
            this.selectedEncodedLetter = null;
            this.currentGuesses = new Map(this.currentPuzzle.preFilledGuesses);
            this.usedLetters = new Set(this.currentPuzzle.preFilledGuesses.values());
            
            // Render puzzle and update keyboard
            this.renderPuzzle();
            this.updateKeyboardState();

            // Disable pre-filled letters from being changed
            const allEncodedLetters = this.elements.puzzleGrid.querySelectorAll('.encoded');
            allEncodedLetters.forEach(el => {
                if (this.currentPuzzle.preFilledGuesses.has(el.dataset.char)) {
                    el.style.cursor = 'not-allowed';
                    el.style.opacity = '0.7';
                }
            });
            
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

        // Split text into words
        const encodedWords = this.currentPuzzle.encoded.split(' ');
        const originalWords = this.currentPuzzle.original.split(' ');
        const maxCharsPerRow = 12;
        let currentRow = [];
        let currentRowLength = 0;
        let rows = [];

        // Group words into rows
        encodedWords.forEach((word, index) => {
            if (currentRowLength + word.length + 1 > maxCharsPerRow && currentRow.length > 0) {
                rows.push(currentRow);
                currentRow = [];
                currentRowLength = 0;
            }
            currentRow.push({ encoded: word, original: originalWords[index] });
            currentRowLength += word.length + 1;
        });
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        // Create rows
        rows.forEach(rowWords => {
            const rowElement = document.createElement('div');
            rowElement.className = 'puzzle-row';
            
            rowWords.forEach((wordPair, wordIndex) => {
                const { encoded, original } = wordPair;
                encoded.split('').forEach((char, charIndex) => {
                    if (char.match(/[A-Z]/)) {
                        // Create letter pair
                        const letterPair = document.createElement('div');
                        letterPair.className = 'letter-pair';
                        
                        // Decoded (solution) letter - starts empty
                        const decodedElement = document.createElement('div');
                        decodedElement.className = 'decoded';
                        decodedElement.textContent = this.currentGuesses.has(char) ? 
                            this.currentGuesses.get(char) : '_';
                        
                        // Encoded letter
                        const encodedElement = document.createElement('div');
                        encodedElement.className = 'encoded';
                        encodedElement.textContent = char;
                        encodedElement.dataset.char = char;
                        encodedElement.dataset.solution = original[charIndex];
                        
                        letterPair.appendChild(decodedElement);
                        letterPair.appendChild(encodedElement);
                        
                        rowElement.appendChild(letterPair);
                    }
                });

                // Add space between words
                if (wordIndex < rowWords.length - 1) {
                    const spaceElement = document.createElement('div');
                    spaceElement.className = 'word-space';
                    rowElement.appendChild(spaceElement);
                }
            });
            
            this.elements.puzzleGrid.appendChild(rowElement);
        });

        console.log('Puzzle rendering complete');
    }

    handleEncodedLetterClick(encodedElement) {
        // Don't allow clicking pre-filled letters
        if (this.currentPuzzle.preFilledGuesses.has(encodedElement.dataset.char)) {
            return;
        }

        // Remove previous selection and highlights
        const previousSelection = this.elements.puzzleGrid.querySelector('.encoded.selected');
        const previousHighlights = this.elements.puzzleGrid.querySelectorAll('.encoded.highlight');
        if (previousSelection) {
            previousSelection.classList.remove('selected');
        }
        previousHighlights.forEach(el => el.classList.remove('highlight'));

        // If clicking the same letter, deselect it
        if (this.selectedEncodedLetter === encodedElement.dataset.char) {
            this.selectedEncodedLetter = null;
            return;
        }

        // Select new letter and highlight all matching letters
        const selectedChar = encodedElement.dataset.char;
        const allEncodedLetters = this.elements.puzzleGrid.querySelectorAll('.encoded');
        allEncodedLetters.forEach(el => {
            if (el.dataset.char === selectedChar) {
                if (el === encodedElement) {
                    el.classList.add('selected');
                } else {
                    el.classList.add('highlight');
                }
            }
        });
        this.selectedEncodedLetter = selectedChar;

        // Highlight the current guess in the keyboard if it exists
        this.updateKeyboardSelection();
    }

    handleKeyboardClick(keyElement) {
        if (!this.selectedEncodedLetter) return;

        const decodedLetter = keyElement.textContent;

        // If this decoded letter is already used for another encoded letter, remove that mapping
        // but only if it's not a pre-filled letter
        for (const [encoded, decoded] of this.currentGuesses.entries()) {
            if (decoded === decodedLetter && !this.currentPuzzle.preFilledGuesses.has(encoded)) {
                this.currentGuesses.delete(encoded);
                this.updateDecodedLetters(encoded, '_');
            }
        }

        // Update the current guess
        this.currentGuesses.set(this.selectedEncodedLetter, decodedLetter);

        // Update all instances of this encoded letter
        this.updateDecodedLetters(this.selectedEncodedLetter, decodedLetter);

        // Reset selection
        const selectedElement = this.elements.puzzleGrid.querySelector('.encoded.selected');
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
        this.selectedEncodedLetter = null;

        // Update keyboard
        this.updateKeyboardState();

        // Check if puzzle is solved
        this.checkSolution();
    }

    updateDecodedLetters(encodedLetter, decodedLetter) {
        const letterPairs = this.elements.puzzleGrid.querySelectorAll('.letter-pair');
        letterPairs.forEach(pair => {
            const encodedElement = pair.querySelector('.encoded');
            if (encodedElement.dataset.char === encodedLetter) {
                pair.querySelector('.decoded').textContent = decodedLetter;
            }
        });
    }

    updateKeyboardState() {
        const keys = this.elements.keyboard.querySelectorAll('.key');
        keys.forEach(key => {
            const letter = key.textContent;
            // Only disable keys that are used in pre-filled letters
            const isPreFilled = Array.from(this.currentPuzzle.preFilledGuesses.values()).includes(letter);
            key.disabled = isPreFilled;
        });
    }

    updateKeyboardSelection() {
        // Reset all keys' selected state
        const keys = this.elements.keyboard.querySelectorAll('.key');
        keys.forEach(key => key.classList.remove('selected'));

        // If there's a current guess for the selected letter, highlight it
        if (this.selectedEncodedLetter && this.currentGuesses.has(this.selectedEncodedLetter)) {
            const currentGuess = this.currentGuesses.get(this.selectedEncodedLetter);
            const keyElement = Array.from(keys).find(key => key.textContent === currentGuess);
            if (keyElement) {
                keyElement.classList.add('selected');
            }
        }
    }

    resetKeyboard() {
        const keys = this.elements.keyboard.querySelectorAll('.key');
        keys.forEach(key => {
            key.disabled = false;
            key.classList.remove('selected');
        });
    }

    checkSolution() {
        if (!this.currentPuzzle) return;

        let isCorrect = true;
        for (const [encodedLetter, decodedLetter] of this.currentGuesses.entries()) {
            if (this.currentPuzzle.solutionMap.get(encodedLetter) !== decodedLetter) {
                isCorrect = false;
                break;
            }
        }

        // Make sure all letters have been guessed by comparing the number of guesses
        // to the number of unique letters in the encoded text
        const uniqueLettersCount = new Set(this.currentPuzzle.encoded.match(/[A-Z]/g)).size;
        if (isCorrect && this.currentGuesses.size === uniqueLettersCount) {
            this.handlePuzzleComplete();
        }
    }

    handlePuzzleComplete() {
        // Disable further interaction
        this.elements.puzzleGrid.style.pointerEvents = 'none';
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';

        // Create heading
        const heading = document.createElement('div');
        heading.className = 'success-heading';
        heading.textContent = 'CONGRATULATIONS!';
        successMessage.appendChild(heading);

        // Add puzzle solved text
        const solvedText = document.createElement('div');
        solvedText.className = 'success-text';
        solvedText.textContent = 'Puzzle solved!';
        successMessage.appendChild(solvedText);
        
        // Add line breaks
        successMessage.appendChild(document.createElement('br'));
        successMessage.appendChild(document.createElement('br'));
        
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
