import { state } from './state.js';
import { audioEngine } from './engines/audioEngine.js';
import { vibrate, HAPTIC_DOT_MS, HAPTIC_DASH_MS } from './engines/hapticsEngine.js';
import { detectSymbol } from './engines/inputEngine.js';
import { CODE_TO_LETTER } from './data/morseTree.js';
import { getMode } from './modes/index.js';
import { renderTree } from './ui/tree.js';
import { renderTape } from './ui/tape.js';
import { renderKey } from './ui/key.js';

const FLASH_MS = 400;

function clearAutoCommit() {
  if (state.autoCommitTimer) {
    clearTimeout(state.autoCommitTimer);
    state.autoCommitTimer = null;
  }
}

function scheduleAutoCommit() {
  clearAutoCommit();
  state.autoCommitTimer = setTimeout(commitLetter, state.settings.autoCommitDelayMs);
}

function flashError(code) {
  if (state.errorTimer) clearTimeout(state.errorTimer);
  state.errorCode = code;
  state.errorTimer = setTimeout(() => {
    state.errorCode = null;
    renderTree();
  }, FLASH_MS);
}

function flashCommitted(code) {
  if (state.committedTimer) clearTimeout(state.committedTimer);
  state.committedCode = code;
  state.committedTimer = setTimeout(() => {
    state.committedCode = null;
    renderTree();
  }, FLASH_MS);
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
  vibrate(symbol === '.' ? HAPTIC_DOT_MS : HAPTIC_DASH_MS, state.settings.hapticsOn);
  state.currentCode = state.currentCode + symbol;
  state.pressing = false;

  // Mode gets a chance to reject the prefix (path-divergence in guided mode).
  const ok = getMode(state.mode).onSymbol(symbol);
  if (ok === false) {
    flashError(state.currentCode);
    state.currentCode = '';
    renderKey();
    renderTree();
    renderTape();
    return;
  }

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
  if (!letter) {
    flashError(code);
    state.currentCode = '';
    renderTree();
    renderTape();
    return;
  }
  // Mode decides whether the letter is acceptable. Returning false means
  // the letter resolved validly but doesn't fit the mode's expectation
  // (e.g. wrong letter for the target word).
  const accepted = getMode(state.mode).onLetterCommit(letter, code);
  if (accepted !== false) {
    flashCommitted(code);
  } else {
    flashError(code);
  }
  state.currentCode = '';
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
