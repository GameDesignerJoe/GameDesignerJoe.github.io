import { state } from './state.js';
import { loadSettings, loadScores } from './lib/storage.js';
import { applyAllSettings } from './settings.js';
import { initTree } from './ui/tree.js';
import { initTape } from './ui/tape.js';
import { initKey } from './ui/key.js';
import { initWordDisplay } from './ui/wordDisplay.js';
import { initModesScreen, renderModesScreen } from './ui/modes.js';
import { initSettingsScreen, renderSettingsScreen } from './ui/settings.js';
import { initTimerStatus } from './ui/timer.js';
import { initResultsScreen } from './ui/results.js';
import { initPracticeUI } from './ui/practice.js';
import { initDebug } from './ui/debug.js';
import { renderView, setView, startMode } from './ui/views.js';

// Pull persisted settings + scores before any module that reads them runs
state.settings = loadSettings();
state.scores = loadScores();
applyAllSettings();

initTree();
initTape();
initKey();
initWordDisplay();
initModesScreen();
initSettingsScreen();
initTimerStatus();
initResultsScreen();
initPracticeUI();
initDebug();
renderView();

document.getElementById('play-button')?.addEventListener('click', () => {
  startMode('freePlay', 'home');
});
document.getElementById('modes-button')?.addEventListener('click', () => {
  renderModesScreen();
  setView('modes');
});
document.getElementById('settings-gear')?.addEventListener('click', () => {
  renderSettingsScreen();
  setView('settings');
});

document.getElementById('back-button')?.addEventListener('click', () => {
  setView(state.gameBackTarget || 'home');
});
