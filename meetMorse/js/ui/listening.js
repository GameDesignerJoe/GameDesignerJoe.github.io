import { state } from '../state.js';
import { replayCurrentWord } from '../modes/listening.js';

let statusEl = null;
let streakEl = null;
let bestEl = null;
let replayBtn = null;

export function initListeningUI() {
  statusEl = document.getElementById('listening-status');
  streakEl = document.querySelector('#listening-status .listening-streak-current strong');
  bestEl = document.querySelector('#listening-status .listening-streak-best strong');
  replayBtn = document.getElementById('replay-button');

  replayBtn?.addEventListener('click', () => replayCurrentWord());

  renderListeningStatus();
}

export function renderListeningStatus() {
  if (streakEl) streakEl.textContent = String(state.listeningStreakCurrent || 0);
  if (bestEl) bestEl.textContent = String(state.scores.listeningStreak || 0);
}
