import { state } from './state.js';
import { audioEngine } from './engines/audioEngine.js';
import { vibrate, HAPTIC_DOT_MS, HAPTIC_DASH_MS } from './engines/hapticsEngine.js';
import { detectSymbol } from './engines/inputEngine.js';
import { CODE_TO_LETTER, LETTER_TO_CODE } from './data/morseTree.js';
import { getMode } from './modes/index.js';
import { renderTree } from './ui/tree.js';
import { renderTape } from './ui/tape.js';
import { renderKey } from './ui/key.js';
import { renderDebug } from './ui/debug.js';
import { flashError, flashCommitted } from './lib/flash.js';

// "Borderline" margin: how close to the threshold the press must be for
// us to call a divergence a timing slip (red→fast, blue→slow) rather
// than a clearly-intended wrong tap. Beyond ~80 ms past the line, the
// user probably meant the symbol they got — flash plain red.
const TIMING_FEEDBACK_MARGIN_MS = 80;

function inferTimingDirection(symbol, durationMs) {
  let expected = null;
  if (state.practiceTarget) {
    expected = state.practiceTarget;
  } else if (state.currentWord) {
    const targetLetter = state.currentWord[state.completedLetters];
    if (!targetLetter) return null;
    const targetCode = LETTER_TO_CODE[targetLetter];
    if (!targetCode) return null;
    const idx = state.currentCode.length - 1;
    if (idx < 0 || idx >= targetCode.length) return null;
    expected = targetCode[idx];
  }
  if (!expected || symbol === expected) return null;
  const threshold = state.settings.dotDashThresholdMs;
  if (Math.abs(durationMs - threshold) > TIMING_FEEDBACK_MARGIN_MS) return null;
  if (expected === '-' && symbol === '.') return 'fast';
  if (expected === '.' && symbol === '-') return 'slow';
  return null;
}

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
    const direction = inferTimingDirection(symbol, duration);
    flashError(state.currentCode, direction || 'wrong');
    state.currentCode = '';
    renderKey();
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
    flashError(code, 'wrong');
    state.currentCode = '';
    renderTape();
    return;
  }
  const accepted = getMode(state.mode).onLetterCommit(letter, code);
  if (accepted !== false) {
    flashCommitted(code);
  } else {
    flashError(code, 'wrong');
  }
  state.currentCode = '';
  renderTape();
}

export function resetTape() {
  clearAutoCommit();
  state.currentCode = '';
  state.tape = [];
  state.errorCode = null;
  state.errorKind = null;
  state.committedCode = null;
  renderTree();
  renderTape();
}
