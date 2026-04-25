import { state } from '../state.js';

let panelEl = null;
let listEl = null;

export function initDebug() {
  panelEl = document.getElementById('debug-panel');
  listEl = document.getElementById('debug-list');
  renderDebug();
}

export function renderDebug() {
  if (!panelEl) return;
  const visible = !!state.settings.debugTiming && state.view === 'game';
  panelEl.classList.toggle('hidden', !visible);
  if (!visible || !listEl) return;

  listEl.innerHTML = '';
  for (const press of state.recentPresses.slice(0, 6)) {
    const margin = press.durationMs - press.thresholdMs;
    // closeness to threshold tells us how confident the classification
    // is; a press 5 ms over the line is far less reliable than one
    // 60 ms clear of it.
    const distance = Math.abs(margin);
    let confidence = 'clear';
    if (distance < 25) confidence = 'borderline';
    else if (distance < 60) confidence = 'mild';

    const item = document.createElement('div');
    item.className = `debug-item debug-${confidence}`;
    const label = press.symbol === '.' ? 'DOT ' : 'DASH';
    const ms = Math.round(press.durationMs);
    const sign = margin > 0 ? '+' : '';
    item.innerHTML =
      `<span class="debug-symbol">${label}</span>` +
      `<span class="debug-ms">${ms}ms</span>` +
      `<span class="debug-margin">${sign}${Math.round(margin)}</span>`;
    listEl.appendChild(item);
  }
}
