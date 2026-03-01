// ============================================================
// THE CARTOGRAPHER - debug.js
// Debug panel: hidden gear icon + diagnostic buttons.
// ============================================================

import { GRID } from './config.js';
import { state } from './state.js';
import { getTerrain } from './terrain.js';
import { updateMapPercent, updateQuestTracker } from './ui.js';

export function initDebugPanel() {
  // Gear icon — nearly invisible, bottom-right corner
  const gear = document.createElement('button');
  gear.id = 'debugGear';
  gear.textContent = '⚙';
  gear.title = 'Debug';
  document.body.appendChild(gear);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'debugPanel';

  let oceanHidden = false;
  const btnFog      = _btn('Remove Fog',     _removeFog);
  const btnComplete = _btn('Complete Map',    _completeMap);
  const btnOcean    = _btn('Hide Ocean: OFF', () => {
    oceanHidden = !oceanHidden;
    state.debug.hideOcean = oceanHidden;
    btnOcean.textContent = `Hide Ocean: ${oceanHidden ? 'ON' : 'OFF'}`;
  });

  panel.append(btnFog, btnComplete, btnOcean);
  document.body.appendChild(panel);

  gear.addEventListener('click', () => panel.classList.toggle('visible'));
}

function _btn(label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function _removeFog() {
  if (!state.gameStarted) return;
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      if (getTerrain(tx, ty) !== 'water') {
        const key = `${tx},${ty}`;
        state.revealedTiles.add(key);
        state.surveyedTiles.add(key);
      }
    }
  }
}

function _completeMap() {
  if (!state.gameStarted) return;
  _removeFog();
  for (const lm of state.landmarks) {
    state.discoveredLandmarks.add(lm.name);
  }
  for (const spec of state.specimens) {
    if (!spec.collected) {
      spec.collected = true;
      state.collectedSpecimens.push(spec);
    }
  }
  state.mapPercent = 100;
  updateMapPercent();
  updateQuestTracker();
  const btn = document.getElementById('newMapBtn');
  if (btn) btn.style.display = 'block';
}
