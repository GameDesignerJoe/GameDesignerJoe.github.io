import { state } from '../state.js';
import { resetTape } from '../input.js';

export function setView(view) {
  state.view = view;
  renderView();
  if (view === 'game') resetTape();
}

export function renderView() {
  const home = document.getElementById('home-screen');
  const game = document.getElementById('game-screen');
  if (home) home.classList.toggle('hidden', state.view !== 'home');
  if (game) game.classList.toggle('hidden', state.view !== 'game');
}
