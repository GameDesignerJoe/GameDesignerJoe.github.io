import { initTree } from './ui/tree.js';
import { initTape } from './ui/tape.js';
import { initKey } from './ui/key.js';
import { renderView, setView } from './ui/views.js';

initTree();
initTape();
initKey();
renderView();

document.getElementById('play-button')?.addEventListener('click', () => setView('game'));
document.getElementById('back-button')?.addEventListener('click', () => setView('home'));
