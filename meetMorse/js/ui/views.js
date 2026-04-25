import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { renderTree } from './tree.js';
import { renderTape } from './tape.js';
import { renderWord } from './wordDisplay.js';
import { renderTimerStatus } from './timer.js';
import { renderPractice } from './practice.js';
import { renderDebug } from './debug.js';

const SCREEN_IDS = {
  home: 'home-screen',
  modes: 'modes-screen',
  settings: 'settings-screen',
  game: 'game-screen',
  results: 'results-screen',
};

export function setView(view) {
  // exit current mode if leaving the game screen
  if (state.view === 'game' && view !== 'game') {
    getMode(state.mode).exit();
  }
  state.prevView = state.view;
  state.view = view;
  renderView();
}

export function renderView() {
  for (const [name, id] of Object.entries(SCREEN_IDS)) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', state.view !== name);
  }
  if (state.view === 'game') applyModeLayout();
  renderDebug();
}

// Toggles word-display, paper-tape, timer-status, tree, and practice
// content based on the active mode's flags. Each section is independent
// so a mode can mix and match what shows.
function applyModeLayout() {
  const mode = getMode(state.mode);
  document.getElementById('word-display')?.classList.toggle('hidden', !mode.showWord);
  document.getElementById('paper-tape')?.classList.toggle('hidden', !mode.showPaperTape);
  document.getElementById('timed-status')?.classList.toggle('hidden', !mode.showTimer);
  document.getElementById('tree-container')?.classList.toggle('hidden', !mode.showTree);
  document.getElementById('practice-content')?.classList.toggle('hidden', !mode.showPractice);
  const label = document.querySelector('#game-screen .mode-label');
  if (label) label.textContent = mode.name.toUpperCase();
}

export function startMode(modeId, fromView = 'home') {
  state.mode = modeId;
  state.gameBackTarget = fromView;
  state.view = 'game';
  state.prevView = fromView;

  state.currentCode = '';
  state.errorCode = null;
  state.committedCode = null;

  renderView();

  getMode(modeId).enter();

  renderTree();
  renderTape();
  renderWord();
  renderTimerStatus();
  renderPractice();
  renderDebug();
}
