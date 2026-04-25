import { state } from '../state.js';
import { renderTape } from '../ui/tape.js';

const MAX_TAPE_LENGTH = 40;

export const freePlay = {
  id: 'freePlay',
  name: 'Free Play',
  description: 'Tap freely. The tree lights up. Letters scroll on the paper tape.',
  showTree: true,
  showWord: false,
  showPaperTape: true,
  scored: false,
  available: true,

  enter() {
    state.tape = [];
    state.currentCode = '';
    renderTape();
  },

  exit() {
    // nothing to clean up
  },

  // free play has no path-divergence check; every prefix is fine
  onSymbol() {
    return true;
  },

  // every valid letter goes on the tape; the input layer already flashes
  // committed/error visuals for us
  onLetterCommit(letter) {
    state.tape = [...state.tape, letter].slice(-MAX_TAPE_LENGTH);
    renderTape();
    return true;
  },
};
