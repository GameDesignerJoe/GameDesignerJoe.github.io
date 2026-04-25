import { initTree } from './ui/tree.js';
import { initTape } from './ui/tape.js';
import { initKey } from './ui/key.js';
import { initWordDisplay } from './ui/wordDisplay.js';
import { initModesScreen } from './ui/modes.js';
import { renderView, setView, startMode } from './ui/views.js';
import { state } from './state.js';

initTree();
initTape();
initKey();
initWordDisplay();
initModesScreen();
renderView();

// Home screen wiring
document.getElementById('play-button')?.addEventListener('click', () => {
  startMode('freePlay', 'home');
});
document.getElementById('modes-button')?.addEventListener('click', () => {
  setView('modes');
});

// Game screen back button — goes to wherever the game was launched from
document.getElementById('back-button')?.addEventListener('click', () => {
  setView(state.gameBackTarget || 'home');
});
