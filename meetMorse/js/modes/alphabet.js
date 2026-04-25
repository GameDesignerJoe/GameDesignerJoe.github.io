import { state } from '../state.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NEXT_LETTER_DELAY_MS = 600;

let index = 0;
let nextTimer = null;

function clearNextTimer() {
  if (nextTimer) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function startNextLetter() {
  state.currentWord = ALPHABET[index];
  state.completedLetters = 0;
  state.currentCode = '';
  index = (index + 1) % ALPHABET.length;
  renderWord();
  renderTree();
}

export const alphabet = {
  id: 'alphabet',
  name: 'Alphabet',
  description: 'Walk the alphabet letter by letter, A through Z.',
  showTree: true,
  showWord: true,
  showPaperTape: false,
  scored: false,
  available: true,

  enter() {
    index = 0;
    clearNextTimer();
    startNextLetter();
  },

  exit() {
    clearNextTimer();
    state.currentWord = null;
    state.completedLetters = 0;
  },

  // Same prefix-validation as guidedWord: typing a code that can't lead
  // to the target letter clears the buffer immediately.
  onSymbol() {
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (!target) return true;
    const targetCode = LETTER_TO_CODE[target];
    if (!targetCode) return true;
    return targetCode.startsWith(state.currentCode);
  },

  onLetterCommit(letter) {
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (letter !== target) return false;
    state.completedLetters += 1;
    renderWord();
    clearNextTimer();
    nextTimer = setTimeout(startNextLetter, NEXT_LETTER_DELAY_MS);
    return true;
  },
};
