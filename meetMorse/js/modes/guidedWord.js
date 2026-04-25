import { state } from '../state.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { ALL_WORDS, shuffled } from '../data/words.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';

const HINT_DELAY_MS = 3000;
const NEXT_WORD_DELAY_MS = 700;

let pool = [];

function pickNextWord() {
  if (pool.length === 0) pool = shuffled(ALL_WORDS);
  return pool.shift();
}

function clearHintTimer() {
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }
}

function clearActiveHint() {
  if (state.hintTarget) {
    state.hintTarget = null;
    renderTree();
  }
}

function scheduleHint() {
  clearHintTimer();
  if (!state.currentWord) return;
  const target = state.currentWord[state.completedLetters];
  if (!target) return;
  state.hintTimer = setTimeout(() => {
    state.hintTarget = LETTER_TO_CODE[target] || null;
    renderTree();
  }, HINT_DELAY_MS);
}

function startNewWord() {
  state.currentWord = pickNextWord();
  state.completedLetters = 0;
  state.currentCode = '';
  renderWord();
  renderTree();
  scheduleHint();
}

export const guidedWord = {
  id: 'guidedWord',
  name: 'Guided Word',
  description: 'Spell out target words letter by letter. Hints when you stall.',
  showTree: true,
  showWord: true,
  showPaperTape: false,
  scored: false,
  available: true,

  enter() {
    pool = [];
    startNewWord();
  },

  exit() {
    clearHintTimer();
    state.hintTarget = null;
    state.currentWord = null;
    state.completedLetters = 0;
  },

  // Called after a symbol is appended to currentCode. Returning false
  // tells input.js to flash error + clear the buffer.
  onSymbol() {
    clearHintTimer();
    clearActiveHint();
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (!target) return true;
    const targetCode = LETTER_TO_CODE[target];
    if (!targetCode) return true;
    return targetCode.startsWith(state.currentCode);
  },

  // Called when auto-commit resolves currentCode → letter. Returning false
  // tells input.js to flash error instead of "committed".
  onLetterCommit(letter) {
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (letter !== target) return false;
    state.completedLetters += 1;
    renderWord();
    if (state.completedLetters >= state.currentWord.length) {
      // word complete — short pause, then next word
      setTimeout(startNewWord, NEXT_WORD_DELAY_MS);
    } else {
      scheduleHint();
    }
    return true;
  },
};
