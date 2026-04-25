import { state } from '../state.js';
import { renderTape } from '../ui/tape.js';

const MAX_TAPE_LENGTH = 40;
const IDLE_CLEAR_MS = 5000;

let idleTimer = null;

function cancelIdleClear() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleClear() {
  cancelIdleClear();
  idleTimer = setTimeout(() => {
    state.tape = [];
    renderTape();
  }, IDLE_CLEAR_MS);
}

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
    cancelIdleClear();
    renderTape();
  },

  exit() {
    cancelIdleClear();
  },

  // Active input cancels the pending clear so the tape doesn't wipe mid-word.
  onSymbol() {
    cancelIdleClear();
    return true;
  },

  onLetterCommit(letter) {
    state.tape = [...state.tape, letter].slice(-MAX_TAPE_LENGTH);
    renderTape();
    scheduleIdleClear();
    return true;
  },
};
