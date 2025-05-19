class CryptogramGenerator {
    constructor() {
        this.substitutionMap = new Map();
        this.solutionMap = new Map();
        this.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    }

    generatePuzzle(quote) {
        // Convert quote to uppercase and store original for solution checking
        const originalText = quote.text.toUpperCase();
        
        // Create random substitution cipher
        this.createSubstitutionCipher();
        
        // Encode the text
        const encodedText = this.encodeText(originalText);
        
        // Create puzzle structure with numbered positions
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
        // Clear previous maps
        this.substitutionMap.clear();
        this.solutionMap.clear();

        // Create a shuffled version of the alphabet
        const shuffledAlphabet = [...this.alphabet]
            .sort(() => Math.random() - 0.5);

        // Create the substitution mapping
        this.alphabet.forEach((letter, index) => {
            let substituteLetter = shuffledAlphabet[index];
            
            // Ensure no letter maps to itself
            if (substituteLetter === letter) {
                const nextIndex = (index + 1) % this.alphabet.length;
                [shuffledAlphabet[index], shuffledAlphabet[nextIndex]] = 
                [shuffledAlphabet[nextIndex], shuffledAlphabet[index]];
                substituteLetter = shuffledAlphabet[index];
            }
            
            this.substitutionMap.set(letter, substituteLetter);
            this.solutionMap.set(substituteLetter, letter);
        });
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
        const structure = [];
        let position = 1;
        let row = [];
        const maxRowLength = 12; // Increased for better word wrapping

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
                const tile = {
                    char: char,
                    solution: originalChar,
                    position: this.alphabet.includes(char) ? position++ : null,
                    isLetter: this.alphabet.includes(char)
                };
                row.push(tile);
            });

            // Add space after word (except for last word)
            if (wordIndex < words.length - 1) {
                row.push({
                    char: ' ',
                    solution: ' ',
                    position: null,
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
