import { state } from './state.js';
import { audioEngine } from './engines/audioEngine.js';
import { vibrate, HAPTIC_DOT_MS, HAPTIC_DASH_MS } from './engines/hapticsEngine.js';
import { detectSymbol, AUTO_COMMIT_DELAY_MS } from './engines/inputEngine.js';
import { CODE_TO_LETTER } from './data/morseTree.js';
import { renderTree } from './ui/tree.js';
import { renderTape } from './ui/tape.js';
import { renderKey } from './ui/key.js';

const MAX_TAPE_LENGTH = 40;
const FLASH_MS = 400;

function clearAutoCommit() {
  if (state.autoCommitTimer) {
    clearTimeout(state.autoCommitTimer);
    state.autoCommitTimer = null;
  }
}

function scheduleAutoCommit() {
  clearAutoCommit();
  state.autoCommitTimer = setTimeout(commitLetter, AUTO_COMMIT_DELAY_MS);
}

export function pressDown() {
  if (state.pressing) return;
  clearAutoCommit();
  audioEngine.init();
  audioEngine.startTone();
  state.pressStartMs = performance.now();
  state.pressing = true;
  renderKey();
}

export function pressUp() {
  if (!state.pressing) return;
  audioEngine.stopTone();
  const duration = state.pressStartMs != null
    ? performance.now() - state.pressStartMs
    : 0;
  state.pressStartMs = null;
  const symbol = detectSymbol(duration);
  vibrate(symbol === '.' ? HAPTIC_DOT_MS : HAPTIC_DASH_MS);
  state.currentCode = state.currentCode + symbol;
  state.pressing = false;
  scheduleAutoCommit();
  renderKey();
  renderTree();
  renderTape();
}

export function commitLetter() {
  clearAutoCommit();
  const code = state.currentCode;
  if (!code) return;
  const letter = CODE_TO_LETTER[code];
  if (letter) {
    state.tape = [...state.tape, letter].slice(-MAX_TAPE_LENGTH);
    state.currentCode = '';
    state.committedCode = code;
    if (state.committedTimer) clearTimeout(state.committedTimer);
    state.committedTimer = setTimeout(() => {
      state.committedCode = null;
      renderTree();
    }, FLASH_MS);
  } else {
    state.currentCode = '';
    state.errorCode = code;
    if (state.errorTimer) clearTimeout(state.errorTimer);
    state.errorTimer = setTimeout(() => {
      state.errorCode = null;
      renderTree();
    }, FLASH_MS);
  }
  renderTree();
  renderTape();
}

export function resetTape() {
  clearAutoCommit();
  state.currentCode = '';
  state.tape = [];
  state.errorCode = null;
  state.committedCode = null;
  renderTree();
  renderTape();
}
