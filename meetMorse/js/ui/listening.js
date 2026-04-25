import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { replayCurrentWord } from '../modes/listenShared.js';

let streakEl = null;
let bestEl = null;
let replayBtn = null;

export function initListeningUI() {
  streakEl = document.querySelector('#listening-status .listening-streak-current strong');
  bestEl = document.querySelector('#listening-status .listening-streak-best strong');
  replayBtn = document.getElementById('replay-button');

  replayBtn?.addEventListener('click', () => replayCurrentWord());

  renderListeningStatus();
}

export function renderListeningStatus() {
  if (streakEl) streakEl.textContent = String(state.listeningStreakCurrent || 0);
  const mode = getMode(state.mode);
  const scoreKey = mode.scoreKey || 'listeningStreak';
  const best = state.scores[scoreKey] || 0;
  if (bestEl) bestEl.textContent = String(best);
}
