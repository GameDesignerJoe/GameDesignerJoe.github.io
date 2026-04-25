import { MODE_ORDER, MODES } from '../modes/index.js';
import { startMode, setView } from './views.js';

export function initModesScreen() {
  const grid = document.getElementById('modes-grid');
  if (!grid) return;
  grid.innerHTML = '';

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

    const desc = document.createElement('span');
    desc.className = 'mode-card-desc';
    desc.textContent = mode.description;

    card.appendChild(name);
    card.appendChild(desc);

    if (mode.available) {
      card.addEventListener('click', () => startMode(id, 'modes'));
    }
    grid.appendChild(card);
  }

  document
    .getElementById('modes-back-button')
    ?.addEventListener('click', () => setView('home'));
}
