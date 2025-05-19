class LetterSwapHandler {
    constructor(maxSwaps = 40) {
        this.maxSwaps = maxSwaps;
        this.remainingSwaps = maxSwaps;
        this.currentGuesses = new Map();
        this.selectedTile = null;
    }

    initialize(puzzleStructure) {
        this.puzzleStructure = puzzleStructure;
        this.remainingSwaps = this.maxSwaps;
        this.currentGuesses.clear();
        this.selectedTile = null;

        // Initialize current guesses with encoded letters
        this.puzzleStructure.flat().forEach(tile => {
            if (tile.isLetter) {
                this.currentGuesses.set(tile.char, tile.char);
            }
        });
    }

    handleTileClick(tile) {
        if (!tile.isLetter) return null;

        if (this.selectedTile === null) {
            // First tile selection
            this.selectedTile = tile;
            return {
                type: 'select',
                tile: tile
            };
        } else {
            // Second tile selection - perform swap
            if (this.selectedTile === tile) {
                // Deselect if same tile clicked
                this.selectedTile = null;
                return {
                    type: 'deselect',
                    tile: tile
                };
            }

            if (this.remainingSwaps > 0) {
                const swapResult = this.performSwap(this.selectedTile, tile);
                this.selectedTile = null;
                return swapResult;
            } else {
                this.selectedTile = null;
                return {
                    type: 'error',
                    message: 'No swaps remaining'
                };
            }
        }
    }

    performSwap(tile1, tile2) {
        // Get current guesses for both tiles
        const guess1 = this.currentGuesses.get(tile1.char);
        const guess2 = this.currentGuesses.get(tile2.char);

        // Update guesses
        this.currentGuesses.set(tile1.char, guess2);
        this.currentGuesses.set(tile2.char, guess1);

        // Decrease remaining swaps
        this.remainingSwaps--;

        return {
            type: 'swap',
            tile1: tile1,
            tile2: tile2,
            remainingSwaps: this.remainingSwaps
        };
    }

    getCurrentGuess(encodedChar) {
        return this.currentGuesses.get(encodedChar) || encodedChar;
    }

    applyHint(hint) {
        if (!hint) return false;

        const { encoded, solution } = hint;
        
        // Find current guess for this encoded letter
        const currentGuess = this.currentGuesses.get(encoded);
        
        // Find which other encoded letter currently maps to the solution
        let swapEncodedLetter = null;
        for (const [key, value] of this.currentGuesses) {
            if (value === solution) {
                swapEncodedLetter = key;
                break;
            }
        }

        // Perform the swap
        if (swapEncodedLetter) {
            this.currentGuesses.set(swapEncodedLetter, currentGuess);
        }
        this.currentGuesses.set(encoded, solution);

        return true;
    }

    resetSwaps() {
        this.remainingSwaps = this.maxSwaps;
        this.selectedTile = null;
        
        // Reset guesses to original encoded letters
        this.currentGuesses.clear();
        this.puzzleStructure.flat().forEach(tile => {
            if (tile.isLetter) {
                this.currentGuesses.set(tile.char, tile.char);
            }
        });
    }

    getAllGuesses() {
        return new Map(this.currentGuesses);
    }
}
