import { state } from '../state.js';
import { MODE_ORDER, MODES } from '../modes/index.js';
import { startMode, setView } from './views.js';
import { formatWpm } from '../lib/timing.js';

let gridEl = null;

export function initModesScreen() {
  gridEl = document.getElementById('modes-grid');
  if (!gridEl) return;

  document
    .getElementById('modes-back-button')
    ?.addEventListener('click', () => setView('home'));

  renderModesScreen();
}

// Rebuilds the grid so any new high score shows up the next time the
// user lands on this view. Cheap (~6 cards).
export function renderModesScreen() {
  if (!gridEl) return;
  gridEl.innerHTML = '';

  for (const id of MODE_ORDER) {
    const mode = MODES[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mode-card' + (mode.available ? '' : ' disabled');
    card.dataset.modeId = id;
    if (!mode.available) card.disabled = true;

    const name = document.createElement('span');
    name.className = 'mode-card-name';
    name.textContent = mode.name;
    card.appendChild(name);

    const desc = document.createElement('span');
    desc.className = 'mode-card-desc';
    desc.textContent = mode.description;
    card.appendChild(desc);

    const scoreText = scoreForMode(id);
    if (scoreText) {
      const scoreEl = document.createElement('span');
      scoreEl.className = 'mode-card-score';
      scoreEl.textContent = scoreText;
      card.appendChild(scoreEl);
    }

    if (mode.available) {
      card.addEventListener('click', () => startMode(id, 'modes'));
    }
    gridEl.appendChild(card);
  }
}

const STREAK_KEYS = {
  listenLetters: 'listenLettersStreak',
  listenWords: 'listenWordsStreak',
  echoLetters: 'echoLettersStreak',
  echoWords: 'echoWordsStreak',
};

function scoreForMode(id) {
  if (id === 'timedWpm') {
    const best = state.scores.timedWpmBest || 0;
    if (best > 0) return `Best: ${formatWpm(best)} WPM`;
  }
  if (id === 'memory') {
    const best = state.scores.memoryWpmBest || 0;
    if (best > 0) return `Best: ${formatWpm(best)} WPM`;
  }
  if (id === 'speed') {
    const wpm = state.scores.speedBestWpm || 0;
    if (wpm > 0) return `Best: ${wpm} WPM`;
  }
  const streakKey = STREAK_KEYS[id];
  if (streakKey) {
    const best = state.scores[streakKey] || 0;
    if (best > 0) return `Best streak: ${best}`;
  }
  return null;
}
