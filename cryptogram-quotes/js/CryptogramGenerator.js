class CryptogramGenerator {
    constructor() {
        this.substitutionMap = new Map();
        this.solutionMap = new Map();
        this.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        this.revealedLetters = new Set();
        // Common letters in English, ordered by frequency
        this.commonLetters = 'ETAOINSHRDLUCMFWYPVBGKJQXZ'.split('');
        this.currentText = '';
    }

    generatePuzzle(quote) {
        // Convert quote to uppercase and store original for solution checking
        const originalText = quote.text.toUpperCase();
        this.currentText = originalText;
        
        // Create random substitution cipher
        this.createSubstitutionCipher();
        
        // Encode the text
        const encodedText = this.encodeText(originalText);
        
        // Create puzzle structure
        const puzzleStructure = this.createPuzzleStructure(encodedText, originalText);

        return {
            encoded: encodedText,
            original: originalText,
            author: quote.author,
            structure: puzzleStructure,
            substitutionMap: this.substitutionMap,
            solutionMap: this.solutionMap
        };
    }

    createSubstitutionCipher() {
        console.log('Creating substitution cipher for text:', this.currentText);
        
        // Clear previous maps
        this.substitutionMap.clear();
        this.solutionMap.clear();

        // Create a shuffled version of the alphabet
        const shuffledAlphabet = [...this.alphabet];
        for (let i = shuffledAlphabet.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAlphabet[i], shuffledAlphabet[j]] = [shuffledAlphabet[j], shuffledAlphabet[i]];
        }

        console.log('Shuffled alphabet:', shuffledAlphabet.join(''));

        // Create the mapping, ensuring no letter maps to itself
        this.alphabet.forEach((letter, i) => {
            let substituteLetter = shuffledAlphabet[i];
            
            // If a letter would map to itself, swap with the next letter
            if (substituteLetter === letter) {
                const nextIndex = (i + 1) % this.alphabet.length;
                [shuffledAlphabet[i], shuffledAlphabet[nextIndex]] = 
                [shuffledAlphabet[nextIndex], shuffledAlphabet[i]];
                substituteLetter = shuffledAlphabet[i];
            }

            this.substitutionMap.set(letter, substituteLetter);
            this.solutionMap.set(substituteLetter, letter);
        });

        // Log the mappings
        console.log('Letter mappings:');
        this.alphabet.forEach(letter => {
            console.log(`${letter} -> ${this.substitutionMap.get(letter)} -> ${this.solutionMap.get(this.substitutionMap.get(letter))}`);
        });

        // Verify no letter maps to itself
        const selfMapped = this.alphabet.filter(letter => 
            this.substitutionMap.get(letter) === letter
        );
        
        if (selfMapped.length > 0) {
            console.error('Error: Some letters map to themselves:', selfMapped);
        } else {
            console.log('Verification: No letters map to themselves');
        }
    }

    encodeText(text) {
        return text.split('').map(char => {
            if (this.alphabet.includes(char)) {
                return this.substitutionMap.get(char);
            }
            return char; // Preserve spaces, punctuation, and numbers
        }).join('');
    }

    createPuzzleStructure(encodedText, originalText) {
        console.log('Creating puzzle structure');
        console.log('Original text:', originalText);
        console.log('Encoded text:', encodedText);

        const structure = [];
        let row = [];
        const maxRowLength = 12; // For better word wrapping

        // Split text into words
        const words = encodedText.split(' ');
        const originalWords = originalText.split(' ');

        words.forEach((word, wordIndex) => {
            // Check if adding this word would exceed maxRowLength
            if (row.length + word.length > maxRowLength && row.length > 0) {
                // Push current row and start new one
                structure.push(row);
                row = [];
            }

            // Add each letter of the word
            word.split('').forEach((char, charIndex) => {
                const originalChar = originalWords[wordIndex][charIndex];
                
                if (this.alphabet.includes(originalChar)) {
                    const tile = {
                        char: char,
                        solution: originalChar,
                        isLetter: true
                    };

                    console.log(`Creating tile: ${JSON.stringify(tile)}`);
                    row.push(tile);
                }
            });

            // Add space after word (except for last word)
            if (wordIndex < words.length - 1) {
                row.push({
                    char: ' ',
                    solution: ' ',
                    isLetter: false
                });
            }
        });

        // Push the last row if it has any tiles
        if (row.length > 0) {
            structure.push(row);
        }

        return structure;
    }

    checkSolution(userSolution) {
        const correctSolution = new Map(this.solutionMap);
        let isCorrect = true;

        for (const [encoded, decoded] of userSolution) {
            if (correctSolution.get(encoded) !== decoded) {
                isCorrect = false;
                break;
            }
        }

        return isCorrect;
    }

    // Helper method to get a hint (reveal a random letter)
    getHint(currentGuesses) {
        const unsolvedLetters = new Map(this.solutionMap);
        
        // Remove already correctly guessed letters
        for (const [encoded, guessed] of currentGuesses) {
            if (this.solutionMap.get(encoded) === guessed) {
                unsolvedLetters.delete(encoded);
            }
        }

        if (unsolvedLetters.size === 0) return null;

        // Select a random unsolved letter
        const unsolvedArray = Array.from(unsolvedLetters);
        const randomPair = unsolvedArray[Math.floor(Math.random() * unsolvedArray.length)];
        
        return {
            encoded: randomPair[0],
            solution: randomPair[1]
        };
    }
}
