import { state } from '../state.js';

let lettersEl = null;
let currentEl = null;

export function initTape() {
  lettersEl = document.querySelector('#paper-tape .tape-letters');
  currentEl = document.querySelector('#paper-tape .tape-current');
  renderTape();
}

export function renderTape() {
  if (!lettersEl || !currentEl) return;

  if (state.tape.length === 0) {
    lettersEl.classList.add('empty');
    lettersEl.textContent = 'start tapping…';
  } else {
    lettersEl.classList.remove('empty');
    lettersEl.textContent = state.tape.join('');
  }

  if (state.currentCode) {
    currentEl.classList.add('active');
    currentEl.textContent = state.currentCode;
  } else {
    currentEl.classList.remove('active');
    currentEl.textContent = '·—';
  }
}
