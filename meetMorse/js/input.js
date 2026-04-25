import { state } from './state.js';
import { audioEngine } from './engines/audioEngine.js';
import { vibrate, HAPTIC_DOT_MS, HAPTIC_DASH_MS } from './engines/hapticsEngine.js';
import { detectSymbol } from './engines/inputEngine.js';
import { CODE_TO_LETTER } from './data/morseTree.js';
import { getMode } from './modes/index.js';
import { renderTree } from './ui/tree.js';
import { renderTape } from './ui/tape.js';
import { renderKey } from './ui/key.js';
import { renderDebug } from './ui/debug.js';

const FLASH_MS = 400;
const RECENT_PRESSES_LIMIT = 8;

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

function recordPress(durationMs, symbol) {
  state.recentPresses.unshift({
    durationMs,
    symbol,
    thresholdMs: state.settings.dotDashThresholdMs,
  });
  if (state.recentPresses.length > RECENT_PRESSES_LIMIT) {
    state.recentPresses.length = RECENT_PRESSES_LIMIT;
  }
}

// timestampMs comes from event.timeStamp so it reflects the dispatch
// time, not when this handler started running. That matters because a
// busy main thread (e.g. the just-finished commit's render work) can
// delay the *handler* for tens of ms, but event.timeStamp is set by
// the browser when the event was actually generated.
export function pressDown(timestampMs) {
  if (state.pressing) return;
  const ts = typeof timestampMs === 'number' ? timestampMs : performance.now();
  clearAutoCommit();
  audioEngine.init();
  audioEngine.startTone();
  state.pressStartMs = ts;
  state.pressing = true;
  getMode(state.mode).onPressDown?.(ts);
  renderKey();
}

export function pressUp(timestampMs) {
  if (!state.pressing) return;
  const ts = typeof timestampMs === 'number' ? timestampMs : performance.now();
  audioEngine.stopTone();
  const duration = state.pressStartMs != null ? ts - state.pressStartMs : 0;
  state.pressStartMs = null;
  const symbol = detectSymbol(duration, state.settings.dotDashThresholdMs);
  vibrate(symbol === '.' ? HAPTIC_DOT_MS : HAPTIC_DASH_MS, state.settings.hapticsOn);

  recordPress(duration, symbol);
  state.currentCode = state.currentCode + symbol;
  state.pressing = false;

  const mode = getMode(state.mode);
  mode.onPressUp?.(ts, duration, symbol);

  // Mode gets a chance to reject the prefix (path-divergence in guided
  // modes; raw-symbol check in practice mode).
  const ok = mode.onSymbol(symbol);
  if (ok === false) {
    flashError(state.currentCode);
    state.currentCode = '';
    renderKey();
    renderTree();
    renderTape();
    renderDebug();
    return;
  }

  scheduleAutoCommit();
  renderKey();
  renderTree();
  renderTape();
  renderDebug();
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
