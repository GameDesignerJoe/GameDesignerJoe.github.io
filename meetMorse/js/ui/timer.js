import { state } from '../state.js';
import { formatElapsed } from '../lib/timing.js';

let clockEl = null;
let progressEl = null;

export function initTimerStatus() {
  clockEl = document.querySelector('#timed-status .timed-clock');
  progressEl = document.querySelector('#timed-status .timed-progress');
}

export function renderTimerStatus() {
  if (!clockEl || !progressEl) return;
  clockEl.textContent = formatElapsed(state.timedElapsedMs);
  const total = state.timedTotalWords || 1;
  const wordNumber = Math.min(state.timedWordsCompleted + 1, total);
  progressEl.textContent = `word ${wordNumber} of ${total}`;
}
