import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { renderTree } from './tree.js';
import { renderTape } from './tape.js';
import { renderWord } from './wordDisplay.js';
import { renderTimerStatus } from './timer.js';

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
}

// Toggles word-display, paper-tape, and timer-status visibility based
// on the active mode's flags.
function applyModeLayout() {
  const mode = getMode(state.mode);
  document
    .getElementById('word-display')
    ?.classList.toggle('hidden', !mode.showWord);
  document
    .getElementById('paper-tape')
    ?.classList.toggle('hidden', !mode.showPaperTape);
  document
    .getElementById('timed-status')
    ?.classList.toggle('hidden', !mode.showTimer);
  const label = document.querySelector('#game-screen .mode-label');
  if (label) label.textContent = mode.name.toUpperCase();
}

// Enter the game screen with a specific mode active. fromView is where
// the BACK button should send the user.
export function startMode(modeId, fromView = 'home') {
  state.mode = modeId;
  state.gameBackTarget = fromView;
  state.view = 'game';
  state.prevView = fromView;

  // reset shared input state so a previous session doesn't bleed in
  state.currentCode = '';
  state.errorCode = null;
  state.committedCode = null;

  renderView();

  // mode-specific setup runs AFTER the layout is applied so its renders
  // hit visible elements
  getMode(modeId).enter();

  // make sure all view-dependent UI is in sync after enter()
  renderTree();
  renderTape();
  renderWord();
  renderTimerStatus();
}
