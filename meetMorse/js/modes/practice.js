import { state } from '../state.js';
import { renderPractice, startVisualizer, stopVisualizer, resetVisualizer } from '../ui/practice.js';

const NEXT_PROMPT_DELAY_MS = 550;
const RETRY_DELAY_MS = 750;

let pendingTimer = null;

function clearPending() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function pickNextPrompt() {
  // Avoid two of the same in a row (unless we want pure random — random
  // can produce streaks of "DASH DASH DASH" that feel less varied).
  let next;
  do {
    next = Math.random() < 0.5 ? '.' : '-';
  } while (next === state.practiceTarget && Math.random() < 0.5);
  state.practiceTarget = next;
  state.practiceLastResult = null;
  state.currentCode = '';
  resetVisualizer();
  renderPractice();
}

export const practice = {
  id: 'practice',
  name: 'Practice',
  description: 'Drill dot/dash timing. Visualizer shows the threshold.',
  showTree: false,
  showWord: false,
  showPaperTape: false,
  showTimer: false,
  showPractice: true,
  scored: false,
  available: true,

  enter() {
    state.practiceTarget = null;
    state.practiceStreak = 0;
    state.practiceLastResult = null;
    clearPending();
    pickNextPrompt();
  },

  exit() {
    clearPending();
    state.practiceTarget = null;
    state.practiceStreak = 0;
    state.practiceLastResult = null;
    stopVisualizer(0);
  },

  onPressDown(timestampMs) {
    startVisualizer(timestampMs);
  },

  onPressUp(_timestampMs, durationMs, _symbol) {
    stopVisualizer(durationMs);
  },

  // We use onSymbol for the success/fail check — by this point input.js
  // has already classified the press into '.' or '-' using the user's
  // current threshold. Returning false clears the buffer (which we want
  // either way — practice doesn't accumulate codes).
  onSymbol(symbol) {
    const target = state.practiceTarget;
    if (!target) return false;
    if (symbol === target) {
      state.practiceStreak += 1;
      state.practiceLastResult = 'success';
      renderPractice();
      pendingTimer = setTimeout(pickNextPrompt, NEXT_PROMPT_DELAY_MS);
    } else {
      state.practiceStreak = 0;
      state.practiceLastResult = 'fail';
      renderPractice();
      pendingTimer = setTimeout(() => {
        state.practiceLastResult = null;
        resetVisualizer();
        renderPractice();
      }, RETRY_DELAY_MS);
    }
    return false;
  },

  // Practice never resolves to a letter, but the contract requires this.
  onLetterCommit() { return false; },
};
