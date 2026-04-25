import { state } from '../state.js';
import { formatWpm, formatElapsed } from '../lib/timing.js';
import { setView, startMode } from './views.js';

let headlineEl = null;
let badgeEl = null;
let statsEl = null;

export function initResultsScreen() {
  headlineEl = document.getElementById('results-headline');
  badgeEl = document.getElementById('results-new-high');
  statsEl = document.getElementById('results-stats');

  document.getElementById('results-again-button')?.addEventListener('click', () => {
    // Restart whatever scored mode just finished. For now only timedWpm
    // hits this screen, but if more scored modes land it'll just work.
    startMode(state.mode, state.gameBackTarget || 'modes');
  });

  document.getElementById('results-back-button')?.addEventListener('click', () => {
    setView(state.gameBackTarget || 'modes');
  });
}

export function showResults() {
  if (!state.lastResult) return;
  renderResultsScreen();
  setView('results');
}

export function renderResultsScreen() {
  if (!state.lastResult) return;
  const { wpm, elapsedMs, errors, isNewHighScore } = state.lastResult;

  if (headlineEl) headlineEl.textContent = `${formatWpm(wpm)} WPM`;
  if (badgeEl) badgeEl.classList.toggle('hidden', !isNewHighScore);

  if (statsEl) {
    const best = state.scores.timedWpmBest || 0;
    statsEl.innerHTML = `
      <div>Time <strong>${formatElapsed(elapsedMs)}</strong></div>
      <div>Errors <strong>${errors}</strong></div>
      <div>Best <strong>${formatWpm(best)} WPM</strong></div>
    `;
  }
}
