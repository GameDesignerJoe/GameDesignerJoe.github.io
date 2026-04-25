import { state } from '../state.js';
import { pressDown, pressUp } from '../input.js';

let keyEl = null;
let spaceHeld = false;

export function initKey() {
  keyEl = document.getElementById('telegraph-key');
  if (!keyEl) return;

  keyEl.addEventListener('pointerdown', (e) => {
    if (typeof keyEl.setPointerCapture === 'function') {
      try { keyEl.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
    pressDown();
  });
  keyEl.addEventListener('pointerup', () => pressUp());
  keyEl.addEventListener('pointercancel', () => pressUp());
  keyEl.addEventListener('pointerleave', () => pressUp());
  keyEl.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || spaceHeld) return;
    spaceHeld = true;
    e.preventDefault();
    pressDown();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    spaceHeld = false;
    e.preventDefault();
    pressUp();
  });

  renderKey();
}

export function renderKey() {
  if (!keyEl) return;
  keyEl.classList.toggle('pressing', state.pressing);
}
